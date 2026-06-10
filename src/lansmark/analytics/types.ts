/**
 * 익명 수요·퍼널 계측 타입 — 무료 베타에서 '무엇을 얻는가'를 집계로만 본다(PII 0·개별 여정 추적 X).
 *   · funnel: 단계별 이벤트 수(추천→시뮬→가이드/외래→일지→옵트인) — 어디서 빠지나.
 *   · demand: '시뮬한 작물×지역' 카운트 = 진짜 수요 히트맵(idle 탐색 아닌 진지한 의도).
 *   · dataGap: 사용자가 원했지만 데이터 없던 키(예: 미등록 작물) = 다음에 채울 1순위.
 *   ⚠ 익명 집계 신호는 위조 가능 — 마케팅엔 '베타 관심도'로만(검증된 사실 아님).
 */
export type FunnelStage = "recommend" | "simulate" | "guide" | "foreign" | "journal" | "subscribe";

export interface DemandRow { cropId: string; region: string; sims: number; }
export interface DataGapRow { key: string; hits: number; }

/** 일별 집계 1행(시계열·롤링 N일) — 퍼널 단계 + 신규/재방문 + 가입. PII 0(수만 보관). */
export interface DayRow {
  date: string;        // YYYY-MM-DD(UTC)
  recommend: number; simulate: number; guide: number; foreign: number; journal: number; subscribe: number;
  newVisitors: number; // 그날 처음 본 익명 기기(유입=recommend 기준·당일 1회)
  returning: number;   // 그날 재방문 익명 기기(이전에 본 적 있음)
  signups: number;     // 그날 신규 가입(계정 생성)
}

export interface AnalyticsSnapshot {
  funnel: Record<FunnelStage, number>; // 단계별 누적 이벤트 수
  demand: DemandRow[];                 // 수요 상위(시뮬 기준 내림차순, top-N)
  dataGaps: DataGapRow[];              // 데이터갭 상위(top-N)
  demandKeys: number;                  // 관측된 작물×지역 distinct 수(상한 가시화)
  since: string;                       // 집계 시작 시각(ISO)
  days: DayRow[];                      // 최근 N일 시계열(날짜 오름차순) — 유입/전환/신규·재방문/가입 추세
  signups: Record<string, number>;     // 가입 방법별 누적(email|phone|kakao|mock|…)
}

/** 집계 저장소 — 라우트가 성공 시점에 호출(실패·차단은 미집계). 절대 throw하지 않는다(응답 흐름 보호). */
export interface AnalyticsStore {
  funnel(stage: FunnelStage, anonId?: string): void; // anonId=원본 x-lansmark-anon 헤더 — recommend에서 신규/재방문 판정(유효 포맷만)
  demand(cropId: string, region?: string): void;     // 시뮬 성공 시
  dataGap(key: string): void;                         // 원했지만 데이터 없음
  signup(method: string): void;                       // 계정 생성(가입) 1건 — 방법별·일별 집계
  snapshot(topN?: number): AnalyticsSnapshot;
  flush?(): void;                                     // 종료 훅 등에서 throttle 무시 즉시 저장(file 구현만; memory=no-op·미정의)
}
