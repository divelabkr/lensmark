/**
 * VAPID 키쌍 자가생성(무료·외부발급 불필요) — 웹푸시(RFC 8292) 서버 신원 키.
 *   사용: npm run vapid:gen  →  출력된 3줄을 .env(또는 배포 환경변수)에 넣는다.
 *   보안: 개인키는 비밀 — 이 스크립트는 '생성해 출력'만 하고 어디에도 저장/전송하지 않는다.
 *         출력 후 터미널 기록이 남지 않게 주의(운영 시크릿과 동일 취급).
 */
import * as crypto from "node:crypto";

const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();
const pub = ecdh.getPublicKey();   // 65바이트 uncompressed point(0x04||X||Y) — PushManager.applicationServerKey 형식
const priv = ecdh.getPrivateKey(); // 32바이트 스칼라

const b64u = (b: Buffer) => b.toString("base64url");
console.log("# VAPID 키쌍(웹푸시) — 아래 3줄을 .env / 배포 환경변수에 추가");
console.log(`LANSMARK_VAPID_PUBLIC_KEY=${b64u(pub)}`);
console.log(`LANSMARK_VAPID_PRIVATE_KEY=${b64u(priv)}`);
console.log(`LANSMARK_VAPID_SUBJECT=mailto:ops@lensmark.kr  # 연락 가능한 주소로 수정(푸시 서비스가 남용 연락에 사용)`);
