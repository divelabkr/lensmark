/**
 * 계정·세션 도메인 타입 — 가입(로그인) 후 영속 신원.
 *   익명ID(기기 기반)·결제토큰(HMAC)과 별개의 '사람' 신원. 신원 종류: anon-Y(기기) · order:X(결제) · acct:Z(계정).
 *   ⚠ 인증 검증(OTP/소셜/이메일)은 verifier seam(HUMAN GATE) — 여기 타입은 검증 방식과 무관(코어).
 */
export interface AuthRef {
  method: string;       // 검증기 종류(mock|phone|kakao|email)
  subjectHash: string;  // 외부 식별자(전화/이메일/소셜ID)의 keyed-hash — 평문 PII 미저장, 계정 조회는 해시로
}
export interface Account {
  id: string;           // "acct_" + 무작위
  createdAt: string;    // ISO
  displayName?: string; // 선택(표시명)
  authRefs: AuthRef[];  // 연결된 로그인 수단(여러 개 — 추후 소셜+전화 병합 가능)
  entitlements?: AccountEntitlement[]; // 연결된 유료권한(계정 귀속 — 결제가 기기 토큰이 아니라 계정을 따라감)
}

/** 계정에 연결된 유료권한 1건 — jti + 만료(있으면). exp로 만료 후 pro 자동 해제(레드팀 #1). */
export interface AccountEntitlement { jti: string; exp?: number; }
export interface Session {
  token: string;        // 무작위 불투명 토큰(클라 보관 → 서버가 신원 해석). 추측 불가.
  accountId: string;
  createdAt: string;    // ISO
  expiresAt: string;    // ISO(만료 후 자동 무효)
}
