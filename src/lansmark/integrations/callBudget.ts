/**
 * 외부 유료 API 일일 호출 상한 — '비용 가드'(deploy.sh cost_guard)의 런타임판.
 *   왜(2026-06 교훈): Cloud Run min=1 과금처럼 '조용히 새는 비용'을 막는다. Anthropic·Perplexity는 호출당 과금이라
 *     캐시·dedup(explain.ts·perplexity.ts)으로 1차 절감하되, 그걸 우회하는 폭주(루프 버그·반복요청)에 절대 상한을 둔다.
 *   동작: 키별 일일 카운터(KST 자정 리셋). 상한 내면 소비하고 true, 초과면 false → 호출 측은 degrade(설명/요약 생략·무중단).
 *   범위·한계: in-memory(인스턴스별). max=1 인스턴스라 단일 카운터로 충분하고, burst(짧은시간 폭주)는 단일 인스턴스 생애 내 잡힌다.
 *     ⚠ 인스턴스 재시작 시 리셋(누적 일일 상한이 아니라 burst 가드) — 영속 상한이 필요하면 Firestore 카운터로 승격(백로그).
 */

// 키별 일일 카운터. 값 = 그 KST 날짜에 소비한 호출 수.
const COUNTERS = new Map<string, { day: string; n: number }>();

// 폭주 차단용 기본 일일 상한 — 정상 사용보다 훨씬 위(무료베타 트래픽은 0~수십). 환경변수로 조정 가능.
const DEFAULTS: Record<string, number> = { anthropic: 500, perplexity: 300 };

// KST(UTC+9) 날짜 문자열 — 자정에 카운터가 리셋되도록. 서버 TZ 무관(now에 9h 더해 UTC로 읽음)·결정적.
function kstDay(now: number): string {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10); // YYYY-MM-DD(KST)
}

// 키별 상한 — 환경변수 LANSMARK_<KEY>_DAILY_MAX 우선, 없으면 보수적 기본값.
function dailyMax(key: string): number {
  const raw = process.env[`LANSMARK_${key.toUpperCase()}_DAILY_MAX`];
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULTS[key] ?? 1000;
}

/** 호출 1건을 상한에 기록 시도 — 상한 내면 true(소비), 초과면 false(degrade). now 미지정 시 현재시각. */
export function tryConsume(key: string, now: number = Date.now()): boolean {
  const day = kstDay(now);
  const cur = COUNTERS.get(key);
  if (!cur || cur.day !== day) { COUNTERS.set(key, { day, n: 1 }); return true; } // 새 날/첫 호출 → 리셋·소비
  if (cur.n >= dailyMax(key)) return false;                                        // 상한 도달 → 거부
  cur.n += 1; return true;                                                          // 소비
}

/** 관측용 — 키별 used/max 스냅샷(ops 노출 가능·복구 아님). */
export function callBudgetSnapshot(now: number = Date.now()): Record<string, { used: number; max: number }> {
  const day = kstDay(now);
  const out: Record<string, { used: number; max: number }> = {};
  for (const k of new Set<string>([...Object.keys(DEFAULTS), ...COUNTERS.keys()])) {
    const cur = COUNTERS.get(k);
    out[k] = { used: cur && cur.day === day ? cur.n : 0, max: dailyMax(k) };
  }
  return out;
}

/** 테스트 전용 — 카운터 초기화. */
export function __resetCallBudget(): void { COUNTERS.clear(); }
