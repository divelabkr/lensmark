/**
 * 아이디/비밀번호 인증 프리미티브 — scrypt 해시·타이밍세이프 대조·형식 검증(순수·테스트 대상).
 *   왜 ID/PW: 발송 인프라(SMS/이메일 키=HUMAN GATE) 없이 작동하는 가벼운 가입 — 무료 베타 즉시 운영.
 *   보안(1원칙): 평문 비밀번호 절대 미저장 — scrypt(salt) 해시만 저장. 대조는 timingSafeEqual.
 *   계정 열거 방지: 존재하지 않는 아이디 로그인 시에도 DUMMY_CRED로 '동일 비용' scrypt를 돌려 응답시간 차이를 없앤다(라우트에서 사용).
 *   무한생성 억제: scrypt CPU 비용(가입당) + 라우트 rate limit + 아이디 중복 차단(findByAuthRef)이 함께.
 */
import * as crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
// scrypt 비용 파라미터를 명시(정책 가시화·재현성). N↑ = 느림·메모리↑ → maxmem(≥128*N*r 바이트)를 함께 올려야 한다.
//   현재 N=16384(r=8) ≈ 16MB·해시 ~50-80ms. 상향 시 maxmem 동반 조정 필수(미조정 시 scryptSync가 throw — 그래서 명시).
const SCRYPT_OPTS: crypto.ScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** 비밀번호 → {hash, salt}(둘 다 hex). 평문은 버린다(저장 금지). */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTS).toString("hex");
  return { hash, salt };
}

/** 비밀번호 대조 — 타이밍세이프(바이트 길이 가드 후 timingSafeEqual). 손상 입력은 false(throw 금지). */
export function verifyPassword(password: string, hash?: string, salt?: string): boolean {
  if (!hash || !salt) return false;
  let candidate: Buffer, stored: Buffer;
  try {
    candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
    stored = Buffer.from(hash, "hex");
  } catch { return false; }
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

/**
 * 타이밍 평탄화용 더미 자격 — '존재하지 않는 아이디' 로그인에도 동일 비용 scrypt를 돌리기 위함(모듈 로드 시 1회 계산).
 *   라우트: 계정/자격이 없으면 verifyPassword(pw, DUMMY_CRED.hash, DUMMY_CRED.salt)로 결과를 버린다
 *   → 응답시간으로 아이디 존재 여부를 추론하는 '계정 열거(타이밍 사이드채널)'를 차단.
 */
export const DUMMY_CRED = hashPassword("lansmark::nonexistent-account::timing-equalizer");

/** 아이디 형식 — 영문·숫자·밑줄 4~20자(PII 아님·열거 표면 최소·DoS 길이 캡). */
export function isValidUserId(id: string): boolean {
  return typeof id === "string" && /^[a-zA-Z0-9_]{4,20}$/.test(id);
}

/** 비밀번호 강도(미니멀) — 8~200자(약한 PW 차단·초장문 scrypt DoS 캡). */
export function isValidPassword(pw: string): boolean {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 200;
}
