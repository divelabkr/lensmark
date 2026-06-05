/**
 * 예산·정착비용·현금흐름 계획 엔진(budget-cashflow) — 순수·결정적(동일 입력 → 동일 출력).
 *   책임: 초기 시설투자(capex)+융자(원리금균등)+보조금+생활비를, parcelSimulator가 낸
 *         연간 소득/운영비(P10/50/90)와 합쳐 '다년 현금흐름·회수기간(payback)·ROI'로 계산한다.
 *   ⚠ parcelSimulator/uncertainty.ts는 건드리지 않는다(유료 로직은 정밀엔진에만 · CLAUDE.md #3).
 *      소득/비용은 주입받아 wrap만 한다. capex 합산용 SigmaRange 헬퍼는 로컬 복제(canonical 비수정).
 *
 *   ★ 정확성 핵심 — 다년 percentile은 '분포 합성'이 아니라 '일관 시나리오 3경로':
 *      · P10(비관)=저소득(income.p10)+고비용(cost.p90) · P50=중앙 · P90(낙관)=고소득(income.p90)+저비용(cost.p10).
 *      왜? 매년 독립 합성으로 누적하면 상대 변동폭이 1/√n로 수축 → "거의 확실히 회수" 과신(수익보장 금지 위반).
 *      농가 불확실성(토양·기후·기술·판로)은 해마다 재추첨되지 않고 지속되므로, 각 경로를 스칼라로 연도 누적하고
 *      연차 표시값만 SigmaRange로 재조립한다. 소득·비용 percentile을 '반대로' 잡는 게 비관/낙관의 핵심.
 *   가드레일: 수익·회수 보장 금지 · P10/50/90 필수 · 시설비/금리/보조 실견적·공식확인 면책 · 추측 금지(IRR/NPV 미제공).
 */
import type { SigmaRange, CultivationType } from "../types";
import { getDefaultDisclaimers } from "../policy/disclaimer";
import { SUPPORT_PROGRAMS } from "../data/support.seed";
import { getFacilityCost, type FacilityTier } from "../data/facilityCost.seed";
import { warmingDeltaC, BASELINE_YEAR } from "../core/climateScenario";
import type {
  CapexItem, LoanTerms, CashflowInput, CashflowYear, EconomicMetrics,
  CashflowPlanResult, CashflowTeaser, FundingSourceLink,
} from "./types";

/* ── SigmaRange 헬퍼(로컬 — uncertainty.ts의 Z·sigmaOf 로직을 복제해 canonical 엔진 비수정) ── */
const Z = 1.2816;                                                  // P10/P90 ↔ 표준정규 분위
const sigmaOf = (r: SigmaRange): number => Math.max(0, (r.p90 - r.p10) / (2 * Z));
const round = (x: number): number => Math.round(x);
/** 단조 정렬 가드 — 반올림·음수 구간서 p10≤p50≤p90 깨짐 방지. */
const sortSigma = (r: SigmaRange): SigmaRange => {
  const a = [r.p10, r.p50, r.p90].sort((x, y) => x - y);
  return { p10: a[0], p50: a[1], p90: a[2] };
};
/** 독립 합산(capex 항목 합) — mean=Σp50, sigma=√Σσ²(uncertainty.subtractIndependent의 + 버전). */
function sumSigma(items: SigmaRange[]): SigmaRange {
  if (items.length === 0) return { p10: 0, p50: 0, p90: 0 };
  const mean = items.reduce((s, r) => s + r.p50, 0);
  const sigma = Math.sqrt(items.reduce((s, r) => s + sigmaOf(r) ** 2, 0));
  return sortSigma({ p10: round(mean - Z * sigma), p50: round(mean), p90: round(mean + Z * sigma) });
}
const scaleSigma = (r: SigmaRange, f: number): SigmaRange => ({ p10: round(r.p10 * f), p50: round(r.p50 * f), p90: round(r.p90 * f) });
const clampInt = (v: number, lo: number, hi: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
};

/* ── 융자 원리금균등(연 단위) ── */
/**
 * 해당 연차 상환액. 거치기간엔 이자만, 이후 원리금균등(A = P·r·(1+r)^n / ((1+r)^n − 1)).
 *   r=0(무이자)이면 원금/기간. 상환 완료 후엔 0. principalKrw≤0이면 융자 없음(0).
 */
export function annualLoanPayment(loan: LoanTerms | undefined, year: number): number {
  if (!loan || loan.principalKrw <= 0 || loan.termYears <= 0) return 0;
  const grace = Math.max(0, Math.floor(loan.graceYears ?? 0));
  const r = loan.annualRatePct / 100;
  if (year <= grace) return round(loan.principalKrw * Math.max(0, r));   // 거치: 이자만
  const repayYear = year - grace;
  if (repayYear > loan.termYears) return 0;                             // 상환 완료
  if (r <= 0) return round(loan.principalKrw / loan.termYears);         // 무이자
  const n = loan.termYears;
  return round((loan.principalKrw * r * (1 + r) ** n) / ((1 + r) ** n - 1));
}

/* ── 융자/보조 출처 링크(support.seed 제도 — 금액·금리 단정 금지) ── */
function linkFundingSources(input: CashflowInput): FundingSourceLink[] {
  const ids: string[] = [];
  if (input.loan && input.loan.principalKrw > 0) ids.push("nh_fund");   // 농협 영농·시설 자금 융자
  if (input.subsidyKrw > 0) { ids.push("smartfarm"); ids.push("young_farmer"); } // 시설·스마트팜 보조 · 청년 정착
  const out: FundingSourceLink[] = [];
  for (const id of ids) {
    const p = SUPPORT_PROGRAMS.find((x) => x.id === id);
    if (p) out.push({ programId: p.id, name: p.name, officialHint: p.officialHint });
  }
  return out;
}

/** budget 전용 면책(getDefaultDisclaimers 뒤에 붙임). */
const BUDGET_DISCLAIMERS = [
  "본 현금흐름·회수기간(payback)·ROI는 입력값과 데모 시설비 참고치에 기반한 추정이며, 수익이나 투자 회수를 보장하지 않습니다.",
  "시설 설치비·농기계비는 2025년 공개 시장조사 참고치(미검증)입니다. 실제 견적은 시공업체·지역·자재·규모에 따라 크게 다르므로 반드시 실견적을 받으세요.",
  "융자 한도·금리·상환조건은 금융기관(농협 등) 상담으로, 보조금 지원 여부·비율·자격은 관할 기관 공식 공고로 확인하세요(본 계산의 금리·보조금은 사용자 입력값입니다).",
  "결과는 P10(비관)·P50(중앙)·P90(낙관) 세 시나리오 경로이며 단일 확정값이 아닙니다. 다년 시나리오는 동일 percentile이 일관되게 이어진다는 단순화 가정입니다.",
  "운영비(난방 등)는 수확 규모에 비례한다고 단순 가정했습니다(고정비/변동비 분리는 향후). 내부수익률(IRR)·순현재가치(NPV)는 할인율 가정 민감도가 커 제공하지 않습니다.",
];

/** 시설 등급 + 면적 → capex 항목들(㎡당 시드 × 면적). 사용자 override가 없을 때의 기본 capex. */
export function buildFacilityCapex(tier: FacilityTier, areaM2: number): CapexItem[] {
  const f = getFacilityCost(tier);
  const area = Math.max(0, Number.isFinite(areaM2) ? areaM2 : 0);
  const items: CapexItem[] = [];
  const mk = (key: CapexItem["key"], label: string, perM2: SigmaRange): CapexItem => ({
    key, label, amountKrw: sortSigma(scaleSigma(perM2, area)), source: `${f.source} [${f.label}]`, verified: false,
  });
  if (f.capexPerM2Krw.facility.p90 > 0) items.push(mk("facility", `${f.label} 시설 본체`, f.capexPerM2Krw.facility));
  if (f.capexPerM2Krw.irrigation.p90 > 0) items.push(mk("irrigation", "자동관수 설비", f.capexPerM2Krw.irrigation));
  const env = f.capexPerM2Krw.environmentControl;
  if (env && env.p90 > 0) items.push(mk("environment_control", "환경제어 설비", env));
  return items;
}

/**
 * 시설 난방비의 다년 점감 계수(#2 온난화 에너지 궤적) — 누적 온난화로 난방-도일↓ → 연차가 갈수록 운영비 미세 감소.
 *   왜 난방만: 한국 시설은 난방 우세 → 냉방 상승은 보수적으로 미반영(과대 절감 방지). HDD_SENS=0.1/℃(데모·verified:false·외삽).
 *   시작연도=scenario.year(미지정=2025). 직접 ΔT override는 연차 궤적 없음(상수) → 1. 노지(heatingShare 0) → 1(평탄).
 */
const HDD_SENS = 0.1;    // 1℃ 추가 온난화당 난방분 10% 절감(데모)
const COOL_SENS = 0.004; // 1℃당 냉방·환기 운영비 +0.4%(데모) — 고ΔT에서 난방절감을 일부 상쇄(한국 시설은 난방 우세라 작게)
function opcostWarmingFactor(input: CashflowInput, year: number): number {
  const share = input.heatingShareOfOpCost;
  if (!input.climateScenario || !share || share <= 0) return 1;        // 노지/시나리오 없음 → 평탄
  const startYear = input.climateScenario.year ?? BASELINE_YEAR;
  const startDelta = warmingDeltaC(input.climateScenario);
  const yearDelta = warmingDeltaC({ year: startYear + (year - 1), path: input.climateScenario.path, deltaTempCOverride: input.climateScenario.deltaTempCOverride });
  const extraWarm = Math.max(0, yearDelta - startDelta);               // 시작연도 대비 추가 온난화
  const heatingSave = Math.min(0.5, share) * Math.min(1, HDD_SENS * extraWarm); // 난방 절감
  const coolingRise = COOL_SENS * extraWarm;                           // 냉방 상승(고ΔT일수록↑ — 난방절감 상쇄)
  return Math.max(0.5, 1 - heatingSave + coolingRise);                // 순 운영비 계수(바닥 0.5)
}

/** 3 시나리오 경로 1개의 연도별 스칼라 전개 결과. */
interface ScenarioPath { net: number[]; cum: number[]; }

/**
 * 유료 정밀 — 다년 현금흐름·payback·ROI·손익분기.
 *   percentile은 일관 시나리오 3경로(스칼라 누적), 연차 표시값만 SigmaRange로 재조립(헤더 ★ 참고).
 */
export function runCashflowPlan(input: CashflowInput): CashflowPlanResult {
  const years = clampInt(input.analysisYears, 1, 30);
  const initialCapex = sumSigma(input.capexItems.map((c) => c.amountKrw));

  // 조달·초기 자기자본 실투입(ROI 분모) — 융자·보조로 충당된 부분은 자기 현금유출이 아니다.
  const loanPrincipal = Math.max(0, input.loan?.principalKrw ?? 0);
  const funding = input.equityKrw + loanPrincipal + input.subsidyKrw;
  const fundingGap = sortSigma({
    p10: round(initialCapex.p10 - funding), p50: round(initialCapex.p50 - funding), p90: round(initialCapex.p90 - funding),
  });
  const initialEquityOutlay = Math.max(0, round(initialCapex.p50 - input.subsidyKrw - loanPrincipal));

  // 소득/비용 picks — net_income 모드면 운영비 0 취급(이중차감 방지).
  const inc = input.annualGrossIncomeKrw;
  const cost = input.incomeMode === "net_income" ? { p10: 0, p50: 0, p90: 0 } : input.annualOperatingCostKrw;
  const ramp = (y: number): number => {
    const v = input.yieldRampByYear?.[y - 1];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 1;
  };

  // 경로별 연도 전개(스칼라). 비관=저소득+고비용 / 낙관=고소득+저비용. cumulative는 초기 자기자본 유출(−)에서 시작.
  const buildPath = (incPick: number, costPick: number): ScenarioPath => {
    const net: number[] = [], cum: number[] = [];
    let acc = -initialEquityOutlay;
    for (let y = 1; y <= years; y++) {
      const f = ramp(y);
      const opcost = costPick * f * opcostWarmingFactor(input, y); // 온난화 난방 점감(시설 한정)
      const n = round(incPick * f - opcost - annualLoanPayment(input.loan, y) - input.livingCostKrwPerYear);
      acc += n;
      net.push(n); cum.push(round(acc));
    }
    return { net, cum };
  };
  const P = {
    p10: buildPath(inc.p10, cost.p90),
    p50: buildPath(inc.p50, cost.p50),
    p90: buildPath(inc.p90, cost.p10),
  };

  // 연차별 표시 행(SigmaRange 재조립). gross/op는 표시용으로 percentile별 ramp 반영.
  const yearsOut: CashflowYear[] = [];
  for (let i = 0; i < years; i++) {
    const f = ramp(i + 1);
    yearsOut.push({
      year: i + 1,
      grossIncomeKrw: sortSigma(scaleSigma(inc, f)),
      operatingCostKrw: sortSigma(scaleSigma(cost, f * opcostWarmingFactor(input, i + 1))), // 온난화 난방 점감 반영

      loanPaymentKrw: annualLoanPayment(input.loan, i + 1),
      livingCostKrw: input.livingCostKrwPerYear,
      netCashKrw: sortSigma({ p10: P.p10.net[i], p50: P.p50.net[i], p90: P.p90.net[i] }),
      cumulativeNetCashKrw: sortSigma({ p10: P.p10.cum[i], p50: P.p50.cum[i], p90: P.p90.cum[i] }),
    });
  }

  // payback(경로별)=누적≥0 최초 연차 · ROI=기간 총순이익/초기 자기자본 · breakEven=연 net 첫 양수.
  const paybackOf = (p: ScenarioPath): number | null => { for (let y = 0; y < p.cum.length; y++) if (p.cum[y] >= 0) return y + 1; return null; };
  const roiOf = (p: ScenarioPath): number | null => {
    if (initialEquityOutlay <= 0) return null;
    return Math.round((p.net.reduce((s, n) => s + n, 0) / initialEquityOutlay) * 1000) / 10; // 0.1% 단위
  };
  const breakEvenOf = (p: ScenarioPath): number | null => { for (let y = 0; y < p.net.length; y++) if (p.net[y] >= 0) return y + 1; return null; };
  const metrics: EconomicMetrics = {
    paybackYearP10: paybackOf(P.p10), paybackYearP50: paybackOf(P.p50), paybackYearP90: paybackOf(P.p90),
    roiPctP10: roiOf(P.p10), roiPctP50: roiOf(P.p50), roiPctP90: roiOf(P.p90),
    breakEvenYearP50: breakEvenOf(P.p50),
  };

  const warnings: string[] = [];
  if (fundingGap.p50 > 0) warnings.push("조달액(자기자본+융자+보조)이 추정 초기투자보다 부족합니다 — 추가 자금 계획이 필요합니다.");
  if (input.subsidyKrw > initialCapex.p90) warnings.push("입력한 보조금이 추정 초기투자를 초과합니다 — 보조금·시설비 입력을 재확인하세요.");
  if (metrics.paybackYearP10 == null) warnings.push("비관(P10) 시나리오에서는 분석기간 내 투자 회수가 어려울 수 있습니다.");
  if (initialEquityOutlay <= 0) warnings.push("자기자본 실투입이 0이라 ROI를 정의할 수 없습니다(전액 융자·보조 가정).");

  return {
    mode: "paid",
    areaM2: input.areaM2,
    cultivationType: input.cultivationType,
    initialCapexKrw: initialCapex,
    initialEquityOutlayKrw: initialEquityOutlay,
    fundingGapKrw: fundingGap,
    years: yearsOut,
    metrics,
    fundingSources: linkFundingSources(input),
    capexItems: input.capexItems,
    warnings,
    disclaimers: [...getDefaultDisclaimers(), ...BUDGET_DISCLAIMERS],
  };
}

/**
 * 무료 미리보기(teaser) — 단년 P50 회수기간 근사 + 가입 유도.
 *   다년표·P10/P90·ROI·손익분기는 제공하지 않는다(유료 전환 훅).
 */
export function buildCashflowTeaser(input: CashflowInput): CashflowTeaser {
  const capexP50 = sumSigma(input.capexItems.map((c) => c.amountKrw)).p50;
  // 자기부담(= capex − 보조 − 융자) — 정밀 엔진과 동일 기준. 융자를 분자(자기부담)와 분모(상환액)에 이중 반영하지 않는다.
  const loanPrincipal = Math.max(0, input.loan?.principalKrw ?? 0);
  const equityOutlay = Math.max(0, round(capexP50 - input.subsidyKrw - loanPrincipal));
  const op = input.incomeMode === "net_income" ? 0 : input.annualOperatingCostKrw.p50;
  const annualNetP50 = round(input.annualGrossIncomeKrw.p50 - op - annualLoanPayment(input.loan, 1) - input.livingCostKrwPerYear);
  const approxPaybackYears = annualNetP50 > 0 ? Math.ceil(equityOutlay / annualNetP50) : null;
  return {
    mode: "free",
    initialCapexP50Krw: capexP50,
    equityOutlayP50Krw: equityOutlay,
    approxAnnualNetCashP50Krw: annualNetP50,
    approxPaybackYears,
    upsell: "다년 P10/50/90 현금흐름·회수기간·ROI·손익분기 연차는 정밀(유료) 분석에서 제공됩니다.",
    disclaimers: [...getDefaultDisclaimers(), "무료 미리보기는 단년 P50(중앙값) 근사이며 다년 변동·시나리오를 반영하지 않습니다. " + BUDGET_DISCLAIMERS[0]],
  };
}
