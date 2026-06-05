/** dev 서버 입력 유틸 — 테스트 가능하도록 분리. */

export const MAX_BODY_BYTES = 512 * 1024; // 요청 바디 상한(메모리 고갈 DoS 방지)

/** 쿼리 파라미터 → 유한수만 허용. NaN/Infinity/빈값/null → undefined(좌표·면적 가드). */
export function finiteParam(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
