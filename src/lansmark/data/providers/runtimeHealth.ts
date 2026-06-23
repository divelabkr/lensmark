/**
 * provider 런타임 건강(설계감사·정직성 보강) — auto.pick()이 연동별 '실제 결과'(live 성공 vs mock 폴백)를 집계한다.
 *   왜: listIntegrations의 `live`는 원래 '키 존재'(설정)일 뿐 'API가 지금 동작'이 아니었다 → 키 있는데 API 다운→조용히
 *       mock 폴백이면 ops가 거짓 녹색(false confidence). 이 모듈이 *실제 런타임 결과*를 모아 '키 있으나 폴백 중(실 다운)'을
 *       정직하게 노출하게 한다. (누적 카운트 + 마지막 결과 + 마지막 live 시각 — 시각은 at 주입식이라 Date.now를 직접 호출하지 않음 → 결정성 유지. 신선도='언제 마지막으로 live였나'를 ops가 본다.)
 *   소비처: integrationReadiness(런타임 상태 부착) → /api/health → OPS 통합목록·신뢰 피쉬본.
 */
export type ProviderOutcome = "live" | "fallback";
export interface ProviderHealth { live: number; fallback: number; last: ProviderOutcome | null; lastLiveAt: number | null }

const H = new Map<string, ProviderHealth>();

/** auto.pick()이 매 호출 결과를 기록 — live=실 API 채택, fallback=throw/형태가드 실패로 mock 사용(조용한 폴백 가시화).
 *  at=호출 시각(live일 때 신선도용·결정성 위해 호출부가 주입). 미주입이면 시각 갱신 생략(카운트만). */
export function recordProvider(key: string, outcome: ProviderOutcome, at?: number): void {
  const h = H.get(key) || { live: 0, fallback: 0, last: null, lastLiveAt: null };
  if (outcome === "live") { h.live++; if (at != null) h.lastLiveAt = at; } else h.fallback++;
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

/** 연동별 신선도 — 마지막 live 성공 시각·경과ms(now 주입=결정성). null=live 성공 이력 없음(pending/항상폴백). */
export function runtimeFreshness(key: string, now: number): { lastLiveAt: number | null; ageMs: number | null } {
  const at = H.get(key)?.lastLiveAt ?? null;
  return { lastLiveAt: at, ageMs: at == null ? null : Math.max(0, now - at) };
}

export function _resetProviderHealth(): void { H.clear(); } // 테스트 전용(상태 격리)
