/**
 * LiveWebPushSender — 웹푸시 실제 발송(무의존성 직접구현).
 *   표준: RFC 8291(Message Encryption, aes128gcm) + RFC 8188(Encrypted Content-Encoding) + RFC 8292(VAPID).
 *   왜 직접구현: 이 저장소는 런타임 의존성 0 정책 — web-push 라이브러리 대신 node:crypto로 구현하고,
 *              RFC 8291 Appendix A '공식 테스트 벡터'로 암호화 경로를 검증한다(webPushSender.spec).
 *   보안:
 *    - SSRF 차단: 발송 POST는 '알려진 푸시 서비스 호스트 allowlist'만 허용(FCM·Mozilla·Windows·Apple).
 *      구독 endpoint는 사용자 유래(비신뢰)라 임의 URL POST는 내부망 타격 벡터 — allowlist가 DNS 재바인딩까지 원천 차단.
 *      다른 브라우저 벤더는 LANSMARK_PUSH_ENDPOINT_ALLOW(호스트 접미사 CSV)로 운영자가 명시 확장.
 *    - 개인키·구독키·페이로드는 로깅하지 않는다(push.ts 원칙 동일 — 엔드포인트 host만).
 */
import * as crypto from "node:crypto";
import type { PushSender, PushSubscription, PushMessage } from "./push";

const b64uDec = (s: string): Buffer => Buffer.from(s, "base64url");

/** HKDF-SHA256(RFC 5869) 단일블록(len≤32) — RFC 8291의 두 단계(IKM·CEK/NONCE) 파생 공용. */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, len: number): Buffer {
  const prk = crypto.createHmac("sha256", salt).update(ikm).digest();          // extract
  const t = crypto.createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest(); // expand(T1)
  return t.subarray(0, len);
}
/** 빅엔디언 uint32(RFC 8188 레코드 크기 필드). */
function u32(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }

/**
 * RFC 8291 aes128gcm 암호화 — 평문 → 웹푸시 요청 본문(salt‖rs‖idlen‖as_pub‖암호문).
 *   opts.asEcdh/salt 주입은 테스트 벡터(결정성) 전용 — 실발송은 항상 새 임시키·랜덤 salt.
 *   단일 레코드(구분자 0x02) — 푸시 페이로드는 ≤4KB라 레코드 분할 불필요.
 */
export function encryptAes128Gcm(
  plaintext: Buffer,
  uaPublic: Buffer,   // 구독 p256dh(65B uncompressed P-256 점)
  authSecret: Buffer, // 구독 auth(16B)
  opts?: { asEcdh?: crypto.ECDH; salt?: Buffer; recordSize?: number },
): Buffer {
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("p256dh 형식 오류(65B uncompressed 필요)");
  if (authSecret.length !== 16) throw new Error("auth 형식 오류(16B 필요)");
  let as = opts?.asEcdh;
  if (!as) { as = crypto.createECDH("prime256v1"); as.generateKeys(); }
  const asPub = as.getPublicKey();
  const salt = opts?.salt ?? crypto.randomBytes(16);
  const rs = opts?.recordSize ?? 4096;

  // 키 파생(RFC 8291 §3.3~3.4): ECDH → IKM(auth_secret 결합) → CEK(16B)·NONCE(12B)
  const ecdhSecret = as.computeSecret(uaPublic);
  const ikm = hkdf(authSecret, ecdhSecret, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPub]), 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);

  // 단일 레코드 암호화 — 평문‖0x02(마지막 레코드 구분자·RFC 8188 §2)
  const record = Buffer.concat([plaintext, Buffer.from([2])]);
  if (record.length + 16 > rs) throw new Error("페이로드가 단일 레코드 한도를 초과");
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([c.update(record), c.final(), c.getAuthTag()]);

  // 본문 헤더(RFC 8188 §2.1): salt(16)‖rs(4)‖idlen(1)‖keyid(as_pub 65)
  return Buffer.concat([salt, u32(rs), Buffer.from([asPub.length]), asPub, ct]);
}

/**
 * VAPID Authorization 헤더(RFC 8292 §3) — ES256 JWT(aud=푸시서비스 origin·exp≤24h·sub=연락처).
 *   nowSec 주입=테스트 결정성. 개인키는 base64url 32B 스칼라(genVapid.ts 출력 형식).
 */
export function vapidAuthHeader(endpointOrigin: string, publicKeyB64u: string, privateKeyB64u: string, subject: string, nowSec: number): string {
  const pub = b64uDec(publicKeyB64u);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("VAPID 공개키 형식 오류");
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signInput = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud: endpointOrigin, exp: nowSec + 12 * 3600, sub: subject }); // 12h(<24h 상한)
  // 원시 스칼라 → JWK로 키 객체 구성(파일·PEM 불필요 — env만으로 동작)
  const key = crypto.createPrivateKey({
    format: "jwk",
    key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33, 65).toString("base64url"), d: privateKeyB64u },
  });
  const sig = crypto.sign("sha256", Buffer.from(signInput), { key, dsaEncoding: "ieee-p1363" }); // JWT는 r‖s 64B(DER 아님)
  return `vapid t=${signInput}.${sig.toString("base64url")}, k=${publicKeyB64u}`;
}

/* ── SSRF 차단: 알려진 푸시 서비스 호스트만(접미사 매칭) + 운영자 명시 확장 ── */
const DEFAULT_PUSH_HOSTS = [
  "fcm.googleapis.com",            // Chrome/Edge(FCM)
  "push.services.mozilla.com",     // Firefox(autopush · updates.push.services.mozilla.com)
  "notify.windows.com",            // 구 Edge(WNS)
  "web.push.apple.com",            // Safari
];
/** endpoint 호스트가 허용 목록(기본 4대 벤더 + env 확장)에 드는가 — 정확일치 또는 '.suffix' 서브도메인. */
export function pushEndpointAllowed(endpoint: string): boolean {
  let host: string;
  try { const u = new URL(endpoint); if (u.protocol !== "https:") return false; host = u.hostname.toLowerCase(); } catch { return false; }
  const extra = (process.env.LANSMARK_PUSH_ENDPOINT_ALLOW || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...DEFAULT_PUSH_HOSTS, ...extra].some((h) => host === h || host.endsWith("." + h));
}

const SEND_TIMEOUT_MS = 7000; // 푸시 서비스 응답 대기 상한(행 방지 — fetchSafe와 동일 체감)

/**
 * 실제 웹푸시 발송자 — VAPID env 설정 시 createPushSender()가 이걸 반환(live 승격).
 *   결과: ok(수락 201) / gone(404·410=만료 구독 → 호출측이 저장소에서 파기) / reason(실패 사유·비밀 미포함).
 */
export class LiveWebPushSender implements PushSender {
  readonly mode = "live" as const;
  async send(sub: PushSubscription, msg: PushMessage): Promise<{ ok: boolean; reason?: string; gone?: boolean }> {
    // 1) 대상 검증 — allowlist 밖 endpoint는 발송 자체를 거부(SSRF 차단·DNS 재바인딩 원천 봉쇄).
    if (!pushEndpointAllowed(sub?.endpoint || "")) return { ok: false, reason: "endpoint-not-allowed(푸시 서비스 allowlist 밖 — LANSMARK_PUSH_ENDPOINT_ALLOW로 확장)" };
    let uaPub: Buffer, auth: Buffer;
    try { uaPub = b64uDec(sub.keys.p256dh); auth = b64uDec(sub.keys.auth); } catch { return { ok: false, reason: "bad-subscription-keys" }; }

    // 2) 페이로드 암호화(RFC 8291) — SW의 push 이벤트가 JSON({title,body,url})을 표시(다리 완비).
    let body: Buffer;
    try { body = encryptAes128Gcm(Buffer.from(JSON.stringify({ title: msg.title, body: msg.body, url: msg.url || "/app" })), uaPub, auth); }
    catch (e) { return { ok: false, reason: "encrypt-failed: " + (e instanceof Error ? e.message : "unknown") }; }

    // 3) VAPID 서명 + POST. TTL=86400(하루) — 아침 브리핑은 하루 지나면 무의미(오래된 알림 몰아치기 방지).
    let authz: string;
    try {
      authz = vapidAuthHeader(new URL(sub.endpoint).origin, process.env.LANSMARK_VAPID_PUBLIC_KEY || "", process.env.LANSMARK_VAPID_PRIVATE_KEY || "",
        process.env.LANSMARK_VAPID_SUBJECT || "mailto:ops@lensmark.kr", Math.floor(Date.now() / 1000));
    } catch (e) { return { ok: false, reason: "vapid-failed: " + (e instanceof Error ? e.message : "unknown") }; }
    try {
      const res = await fetch(sub.endpoint, {
        method: "POST",
        headers: { Authorization: authz, TTL: "86400", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Urgency: "normal" },
        body,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (res.status === 404 || res.status === 410) return { ok: false, reason: "gone(만료 구독)", gone: true }; // 호출측이 저장소 파기
      if (res.status === 201 || res.ok) return { ok: true };
      return { ok: false, reason: `push-service ${res.status}` }; // 본문은 읽지 않음(불필요·비밀 무관)
    } catch { return { ok: false, reason: "network/timeout" }; }
  }
}
