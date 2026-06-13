/**
 * provider 런타임 건강(설계감사·정직성 보강) — auto.pick()이 연동별 '실제 결과'(live 성공 vs mock 폴백)를 집계한다.
 *   왜: listIntegrations의 `live`는 원래 '키 존재'(설정)일 뿐 'API가 지금 동작'이 아니었다 → 키 있는데 API 다운→조용히
 *       mock 폴백이면 ops가 거짓 녹색(false confidence). 이 모듈이 *실제 런타임 결과*를 모아 '키 있으나 폴백 중(실 다운)'을
 *       정직하게 노출하게 한다. (누적 카운트 + 마지막 결과만 — Date.now/타임스탬프 없음 → 결정성·테스트 용이.)
 *   소비처: integrationReadiness(런타임 상태 부착) → /api/health → OPS 통합목록·신뢰 피쉬본.
 */
export type ProviderOutcome = "live" | "fallback";
export interface ProviderHealth { live: number; fallback: number; last: ProviderOutcome | null }

const H = new Map<string, ProviderHealth>();

/** auto.pick()이 매 호출 결과를 기록 — live=실 API 채택, fallback=throw/형태가드 실패로 mock 사용(조용한 폴백 가시화). */
export function recordProvider(key: string, outcome: ProviderOutcome): void {
  const h = H.get(key) || { live: 0, fallback: 0, last: null };
  if (outcome === "live") h.live++; else h.fallback++;
  h.last = outcome;
  H.set(key, h);
}

/** 연동별 런타임 상태(키 있음 전제) — pending=실호출 0(미검증) · live=마지막 성공 · degraded=마지막 폴백(실 다운 추정). */
export function runtimeState(key: string): "pending" | "live" | "degraded" {
  const h = H.get(key);
  if (!h || h.last === null) return "pending";
  return h.last === "live" ? "live" : "degraded";
}

/** 누적 카운트(live/fallback) — ops 맥락 표시용. */
export function runtimeCounts(key: string): { live: number; fallback: number } {
  const h = H.get(key);
  return { live: h?.live ?? 0, fallback: h?.fallback ?? 0 };
}

export function _resetProviderHealth(): void { H.clear(); } // 테스트 전용(상태 격리)
