/**
 * 웹푸시 발송기 검증 — RFC 8291 Appendix A '공식 테스트 벡터'(암호화 전 과정) + 복호 왕복 + VAPID 서명 + SSRF allowlist.
 *   테스트 벡터가 그린 = 실제 브라우저 푸시 서비스와 상호운용 가능한 암호화라는 표준 근거(추측 금지 원칙의 검증판).
 */
import { describe, it, expect } from "vitest";
import * as crypto from "node:crypto";
import { encryptAes128Gcm, vapidAuthHeader, pushEndpointAllowed } from "../integrations/webPushSender";

const B = (s: string) => Buffer.from(s, "base64url");

/* ── RFC 8291 Appendix A 테스트 벡터(고정 입력·기대 출력) ── */
const V = {
  plaintext: "When I grow up, I want to be a watermelon",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  expected: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** 스펙 내 복호기(브라우저 UA 측 역연산) — 왕복 검증용. 발송기와 독립적으로 RFC 절차를 다시 기술. */
function decryptAes128Gcm(body: Buffer, uaEcdh: crypto.ECDH, authSecret: Buffer): Buffer {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPub = body.subarray(21, 21 + idlen);
  const ct = body.subarray(21 + idlen);
  const ecdhSecret = uaEcdh.computeSecret(asPub);
  const hk = (s: Buffer, ikm: Buffer, info: Buffer, len: number) => {
    const prk = crypto.createHmac("sha256", s).update(ikm).digest();
    return crypto.createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, len);
  };
  const ikm = hk(authSecret, ecdhSecret, Buffer.concat([Buffer.from("WebPush: info\0"), uaEcdh.getPublicKey(), asPub]), 32);
  const cek = hk(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hk(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const rec = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  // 마지막 레코드 구분자 0x02(+0x00 패딩) 제거
  let end = rec.length - 1;
  while (end >= 0 && rec[end] === 0) end--;
  if (rec[end] !== 2) throw new Error("record delimiter mismatch");
  return rec.subarray(0, end);
}

describe("encryptAes128Gcm — RFC 8291 공식 테스트 벡터", () => {
  it("고정 키·salt 주입 → 기대 본문과 바이트 일치", () => {
    const as = crypto.createECDH("prime256v1");
    as.setPrivateKey(B(V.asPrivate));
    expect(as.getPublicKey().toString("base64url")).toBe(V.asPublic); // 벡터 자체 sanity(개인키↔공개키 쌍)
    const out = encryptAes128Gcm(Buffer.from(V.plaintext, "utf8"), B(V.uaPublic), B(V.authSecret), { asEcdh: as, salt: B(V.salt) });
    expect(out.toString("base64url")).toBe(V.expected);
  });
  it("UA 측 복호 왕복 — 랜덤 임시키(실발송 경로)로도 평문 복원", () => {
    const ua = crypto.createECDH("prime256v1"); ua.generateKeys();
    const auth = crypto.randomBytes(16);
    const msg = JSON.stringify({ title: "🌾 사과 · 서리 경계", body: "부직포·보온 대비", url: "/app" });
    const body = encryptAes128Gcm(Buffer.from(msg), ua.getPublicKey(), auth); // 임시키·랜덤 salt(기본 경로)
    expect(decryptAes128Gcm(body, ua, auth).toString()).toBe(msg);
  });
  it("본문 헤더 구조 — salt(16)·rs(4096)·idlen(65)", () => {
    const ua = crypto.createECDH("prime256v1"); ua.generateKeys();
    const body = encryptAes128Gcm(Buffer.from("x"), ua.getPublicKey(), crypto.randomBytes(16));
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(body[20]).toBe(65);
  });
  it("형식 오류 입력 거부 — p256dh 65B/auth 16B 아니면 throw", () => {
    expect(() => encryptAes128Gcm(Buffer.from("x"), Buffer.alloc(33), Buffer.alloc(16))).toThrow();
    expect(() => encryptAes128Gcm(Buffer.from("x"), Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]), Buffer.alloc(8))).toThrow();
  });
});

describe("vapidAuthHeader — RFC 8292 ES256 JWT", () => {
  const kp = crypto.createECDH("prime256v1"); kp.generateKeys();
  const pub = kp.getPublicKey().toString("base64url"), priv = kp.getPrivateKey().toString("base64url");
  it("서명이 공개키로 검증되고 클레임(aud·exp·sub)이 정확", () => {
    const now = 1_800_000_000;
    const h = vapidAuthHeader("https://fcm.googleapis.com", pub, priv, "mailto:ops@lensmark.kr", now);
    const m = h.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(m).not.toBeNull();
    expect(m![2]).toBe(pub);
    const [hdr, claims, sig] = m![1].split(".");
    expect(JSON.parse(B(hdr).toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const c = JSON.parse(B(claims).toString());
    expect(c.aud).toBe("https://fcm.googleapis.com");
    expect(c.sub).toBe("mailto:ops@lensmark.kr");
    expect(c.exp).toBe(now + 12 * 3600); // 24h 상한 이내
    const pubKey = crypto.createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: kp.getPublicKey().subarray(1, 33).toString("base64url"), y: kp.getPublicKey().subarray(33, 65).toString("base64url") } });
    expect(crypto.verify("sha256", Buffer.from(hdr + "." + claims), { key: pubKey, dsaEncoding: "ieee-p1363" }, B(sig))).toBe(true);
  });
});

describe("pushEndpointAllowed — SSRF allowlist", () => {
  it("4대 푸시 서비스(FCM·Mozilla·WNS·Apple) 허용 · 서브도메인 포함", () => {
    expect(pushEndpointAllowed("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(pushEndpointAllowed("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(pushEndpointAllowed("https://sin.notify.windows.com/w/?token=y")).toBe(true);
    expect(pushEndpointAllowed("https://web.push.apple.com/QOX")).toBe(true);
  });
  it("임의 호스트·http·내부망은 거부(SSRF 차단)", () => {
    expect(pushEndpointAllowed("https://evil.example.com/hook")).toBe(false);
    expect(pushEndpointAllowed("http://fcm.googleapis.com/x")).toBe(false); // https만
    expect(pushEndpointAllowed("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(pushEndpointAllowed("https://fcm.googleapis.com.evil.com/x")).toBe(false); // 접미사 위장
    expect(pushEndpointAllowed("not-a-url")).toBe(false);
  });
  it("LANSMARK_PUSH_ENDPOINT_ALLOW로 운영자 명시 확장", () => {
    process.env.LANSMARK_PUSH_ENDPOINT_ALLOW = "push.example-browser.org";
    try {
      expect(pushEndpointAllowed("https://kr.push.example-browser.org/v1/x")).toBe(true);
      expect(pushEndpointAllowed("https://other.org/x")).toBe(false);
    } finally { delete process.env.LANSMARK_PUSH_ENDPOINT_ALLOW; }
  });
});
