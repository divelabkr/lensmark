/**
 * 예산·정착비용·현금흐름 계획기(budget-cashflow) 도메인 타입.
 *   책임: 초기 시설투자(capex)+융자+보조금+생활비를 다년 현금흐름으로 합산하는 데 필요한 입출력 형태 정의.
 *   ⚠ 데이터 정직성(CLAUDE.md #4): 시설비·금리·보조금은 추측 금지 — 사용자 입력 또는 데모 시드(출처·verified 라벨).
 *   가드레일: SigmaRange(P10/P50/P90)만 쓴다(단일값 단정 금지). SigmaRange·CultivationType은 공유 types.ts 재사용.
 */
import type { SigmaRange, CultivationType, WarmingScenario } from "../types";

/** capex(초기 자본투자) 1개 항목. 시드 기본값을 사용자가 override 가능. */
export interface CapexItem {
  key: "facility" | "machinery" | "irrigation" | "environment_control" | "other";
  label: string;
  amountKrw: SigmaRange;   // 항목 총액(㎡당 시드 × 면적, 또는 사용자 직접 입력)
  source: string;          // 출처(시드 vs 사용자입력) — 데이터 정직성
  verified: boolean;       // 시드는 false(미검증 참고치)
}

/** 융자 조건(원리금균등 상환). 금리·한도는 사용자 입력(금융기관 확인 전제). */
export interface LoanTerms {
  principalKrw: number;    // 융자 원금(0이면 융자 없음)
  annualRatePct: number;   // 연이자율(%)
  termYears: number;       // 상환기간(년)
  graceYears?: number;     // 거치기간(년·선택) — 거치 중 이자만
}

/** 소득 주입 방식 — 운영비 이중차감 방지. */
export type IncomeMode = "gross_minus_opcost" | "net_income";

/**
 * 현금흐름 엔진 입력. 소득/비용 SigmaRange는 parcelSimulator(/api/simulate) 결과 주입 또는 사용자 직접.
 *   - gross_minus_opcost(기본): annualGrossIncomeKrw=조소득(revenue) + annualOperatingCostKrw=운영비 따로 → 엔진이 차감.
 *   - net_income: annualGrossIncomeKrw=이미 순소득(income) → 운영비는 0 취급(이중차감 방지).
 */
export interface CashflowInput {
  areaM2: number;
  cultivationType: CultivationType;
  capexItems: CapexItem[];
  equityKrw: number;                  // 자기자본
  loan?: LoanTerms;
  subsidyKrw: number;                 // 보조금(공고·실견적 확인 전제, 0 가능)
  annualGrossIncomeKrw: SigmaRange;   // 연간 조소득(또는 순소득 — incomeMode 따라)
  annualOperatingCostKrw: SigmaRange; // 연간 운영비(난방 등 포함)
  incomeMode: IncomeMode;
  livingCostKrwPerYear: number;       // 생활비(연)
  analysisYears: number;              // 분석기간(년) — 엔진서 1~30 클램프
  yieldRampByYear?: number[];         // 다년작물 연차 수확 계수(year1=0 등). 미지정 시 매년 1.0
  climateScenario?: WarmingScenario;  // 지구온난화 가정(다년) — 시설 난방비 연차 점감에 사용(시작연도=scenario.year)
  heatingShareOfOpCost?: number;      // 운영비 중 난방 비중(0~0.5, facilityCost.seed 주입) — 노지=0(궤적 없음)
}

/** 연차별 현금흐름 1행(표시용 — 3 시나리오 경로를 SigmaRange로 재조립). */
export interface CashflowYear {
  year: number;                     // 1-based
  grossIncomeKrw: SigmaRange;       // 연차 계수 반영 조소득
  operatingCostKrw: SigmaRange;     // 운영비
  loanPaymentKrw: number;           // 해당 연차 원리금 상환액(결정적)
  livingCostKrw: number;            // 생활비
  netCashKrw: SigmaRange;           // 연 순현금 = 조소득 − 운영비 − 원리금 − 생활비
  cumulativeNetCashKrw: SigmaRange; // 누적 순현금(초기 자기자본 유출부터)
}

/** payback·ROI 등 경제지표 — 시나리오별(P10 비관 / P50 중앙 / P90 낙관). */
export interface EconomicMetrics {
  paybackYearP10: number | null;    // 누적순현금≥0 최초 연차(비관) · 기간 내 미회수면 null
  paybackYearP50: number | null;
  paybackYearP90: number | null;
  roiPctP10: number | null;         // 기간 총순이익 / 초기 자기자본투입 × 100 · 분모 0이면 null
  roiPctP50: number | null;
  roiPctP90: number | null;
  breakEvenYearP50: number | null;  // 연 순현금이 처음 양(+)이 되는 연차(누적 아님)
}

/** 융자/보조 출처 안내(금액·금리 단정 금지 — support.seed 제도 링크). */
export interface FundingSourceLink {
  programId: string;
  name: string;
  officialHint: string;
}

/** 유료 정밀 결과(다년 P10/50/90 현금흐름). */
export interface CashflowPlanResult {
  mode: "paid";
  areaM2: number;
  cultivationType: CultivationType;
  initialCapexKrw: SigmaRange;        // capex 항목 독립 합산
  initialEquityOutlayKrw: number;     // 초기 자기자본 실투입(= ROI 분모) = max(0, capex.p50 − 보조 − 융자)
  fundingGapKrw: SigmaRange;          // capex − (자기자본+융자+보조) · 양수면 자금부족
  years: CashflowYear[];
  metrics: EconomicMetrics;
  fundingSources: FundingSourceLink[];
  capexItems: CapexItem[];            // 출처·verified 노출(데이터 정직성)
  warnings: string[];
  disclaimers: string[];
}

/** 무료 미리보기(teaser) — 단년 P50 회수기간 근사 + 가입 유도. */
export interface CashflowTeaser {
  mode: "free";
  initialCapexP50Krw: number;         // 총 초기투자(P50)
  equityOutlayP50Krw: number;         // 자기부담(= capex.p50 − 보조 − 융자) — payback 분자(정밀 엔진과 동일 기준)
  approxAnnualNetCashP50Krw: number;  // 단년 P50 순현금 근사(연차 계수·다년 미반영)
  approxPaybackYears: number | null;  // 자기부담 ÷ 연순현금.p50(양수일 때만)
  upsell: string;
  disclaimers: string[];
}
