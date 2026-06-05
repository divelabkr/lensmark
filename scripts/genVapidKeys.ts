/**
 * VAPID 키쌍 생성기(무의존성·웹푸시) — 외부 발급 없이 로컬에서 1회 생성한다.
 *   실행: npx tsx scripts/genVapidKeys.ts
 *   출력된 두 키를 .env 의 LANSMARK_VAPID_PUBLIC_KEY / LANSMARK_VAPID_PRIVATE_KEY 에 붙여넣는다(개인키는 비밀·커밋 금지).
 *   형식(표준 VAPID): 공개키 = uncompressed P-256 포인트(0x04||X||Y, 65B) base64url · 개인키 = 32B 스칼라 base64url(JWK d).
 *   web-push(npm)의 generateVAPIDKeys()와 같은 형식이라, 승격 시 그 라이브러리로도 그대로 사용 가능.
 *   ⚠ 이 스크립트는 '생성·출력'만 한다 — 키를 파일에 저장하거나 전송·로깅하지 않는다(실행한 사람만 콘솔에서 본다).
 */
import { generateKeyPairSync } from "node:crypto";

// base64 ↔ base64url(웹푸시 표준 인코딩) 변환.
const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

// P-256(prime256v1) EC 키쌍 — 내장 crypto만 사용(무의존성).
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pubJwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
const privJwk = privateKey.export({ format: "jwk" }) as { d: string };

// 공개키 = 0x04 || X(32B) || Y(32B) = 65B 비압축 포인트(applicationServerKey 형식).
const pub = Buffer.concat([Buffer.from([0x04]), b64urlDecode(pubJwk.x), b64urlDecode(pubJwk.y)]);

console.log("# ── VAPID 키쌍 (.env 에 붙여넣기 · 개인키는 비밀·커밋 금지) ──");
console.log("LANSMARK_VAPID_PUBLIC_KEY=" + b64url(pub));
console.log("LANSMARK_VAPID_PRIVATE_KEY=" + privJwk.d);
console.log("LANSMARK_VAPID_SUBJECT=mailto:ops@yourdomain.com  # 본인 연락 이메일로 교체");
console.log("# 공개키 길이(=87): " + b64url(pub).length + " · 개인키 길이(=43): " + privJwk.d.length);
