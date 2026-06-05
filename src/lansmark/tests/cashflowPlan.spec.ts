/**
 * 현금흐름 엔진(runCashflowPlan/buildCashflowTeaser/annualLoanPayment) 검증.
 *   초점: payback·ROI 계산, percentile 일관 시나리오 전파(과신 방지), 원리금균등, 엣지케이스, 면책.
 */
import { describe, it, expect } from "vitest";
import { runCashflowPlan, buildCashflowTeaser, annualLoanPayment, buildFacilityCapex } from "../budget/cashflowPlan";
import type { CashflowInput, CapexItem } from "../budget/types";

const capex = (p50: number): CapexItem[] => [
  { key: "facility", label: "시설", amountKrw: { p10: p50 * 0.8, p50, p90: p50 * 1.2 }, source: "test", verified: false },
];
/** 최소 입력(net_income·운영비0·무융자·생활비0) — 케이스별 override. */
const baseInput = (over: Partial<CashflowInput> = {}): CashflowInput => ({
  areaM2: 1000, cultivationType: "greenhouse", capexItems: capex(10_000_000),
  equityKrw: 10_000_000, subsidyKrw: 0,
  annualGrossIncomeKrw: { p10: 1_000_000, p50: 2_500_000, p90: 4_000_000 },
  annualOperatingCostKrw: { p10: 0, p50: 0, p90: 0 }, incomeMode: "net_income",
  livingCostKrwPerYear: 0, analysisYears: 10, ...over,
});

/** SigmaRange 단조성(p10≤p50≤p90). */
const mono = (r: { p10: number; p50: number; p90: number }) => r.p10 <= r.p50 && r.p50 <= r.p90;

describe("runCashflowPlan — payback/ROI", () => {
  it("기본 payback·ROI(P50): 자기자본 10M·연순현금 2.5M → 4년 회수·ROI 250%", () => {
    const r = runCashflowPlan(baseInput());
    expect(r.initialEquityOutlayKrw).toBe(10_000_000);
    expect(r.metrics.paybackYearP50).toBe(4);
    expect(r.metrics.roiPctP50).toBe(250);
  });

  it("percentile 일관 시나리오: 회수기간 P10≥P50≥P90, 누적 P10≤P50≤P90(매 연차)", () => {
    const r = runCashflowPlan(baseInput());
    expect(r.metrics.paybackYearP10).toBe(10); // 연 1M × 10년 = 10M
    expect(r.metrics.paybackYearP50).toBe(4);
    expect(r.metrics.paybackYearP90).toBe(3);
    // 비관 회수가 가장 늦고 낙관이 가장 빠름(나쁜 시나리오일수록 payback 큼)
    expect(r.metrics.paybackYearP10!).toBeGreaterThanOrEqual(r.metrics.paybackYearP50!);
    expect(r.metrics.paybackYearP50!).toBeGreaterThanOrEqual(r.metrics.paybackYearP90!);
    // 누적 순현금 밴드 단조 + ROI 비관<중앙<낙관
    for (const y of r.years) expect(mono(y.cumulativeNetCashKrw)).toBe(true);
    expect(r.metrics.roiPctP10!).toBeLessThan(r.metrics.roiPctP50!);
    expect(r.metrics.roiPctP50!).toBeLessThan(r.metrics.roiPctP90!);
  });

  it("다년 밴드 비수축(과신 방지): 누적 P10~P90 폭이 해마다 좁아지지 않고 누적되어 커진다", () => {
    const r = runCashflowPlan(baseInput());
    const widthAt = (i: number) => r.years[i].cumulativeNetCashKrw.p90 - r.years[i].cumulativeNetCashKrw.p10;
    // 분포 합성(독립)이면 상대폭이 1/√n로 수축 — 시나리오 경로는 연차마다 폭이 단조 증가해야 함.
    expect(widthAt(9)).toBeGreaterThan(widthAt(0));
  });

  it("payback 미회수: 비관(P10) 순현금 음수면 null + 경고", () => {
    const r = runCashflowPlan(baseInput({ livingCostKrwPerYear: 2_000_000 })); // P10 net=1M−2M=−1M
    expect(r.metrics.paybackYearP10).toBeNull();
    expect(r.warnings.some((w) => w.includes("비관"))).toBe(true);
  });

  it("ROI 분모 0: 전액 융자+보조로 자기자본 실투입 0 → ROI null + 경고", () => {
    const r = runCashflowPlan(baseInput({ equityKrw: 0, loan: { principalKrw: 10_000_000, annualRatePct: 0, termYears: 10 } }));
    expect(r.initialEquityOutlayKrw).toBe(0);
    expect(r.metrics.roiPctP50).toBeNull();
    expect(r.warnings.some((w) => w.includes("ROI"))).toBe(true);
  });

  it("보조금 > 초기투자: fundingGap 음수·자기자본 0 클램프·경고", () => {
    const r = runCashflowPlan(baseInput({ equityKrw: 0, subsidyKrw: 50_000_000 }));
    expect(r.fundingGapKrw.p50).toBeLessThan(0);
    expect(r.initialEquityOutlayKrw).toBe(0);
    expect(r.warnings.some((w) => w.includes("보조금"))).toBe(true);
  });

  it("다년작물 ramp(year1=0): 회수가 단년작 대비 늦어진다", () => {
    const noRamp = runCashflowPlan(baseInput({ annualGrossIncomeKrw: { p10: 5_000_000, p50: 5_000_000, p90: 5_000_000 } }));
    const ramp = runCashflowPlan(baseInput({ annualGrossIncomeKrw: { p10: 5_000_000, p50: 5_000_000, p90: 5_000_000 }, yieldRampByYear: [0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1] }));
    expect(noRamp.metrics.paybackYearP50).toBe(2); // 5M/yr → -10,-5,0
    expect(ramp.metrics.paybackYearP50).toBe(4);   // 0,2.5,5,5 → -10,-7.5,-2.5,+2.5
    expect(ramp.metrics.paybackYearP50!).toBeGreaterThan(noRamp.metrics.paybackYearP50!);
  });

  it("출력 SigmaRange 단조성·면책·verified 유지", () => {
    const r = runCashflowPlan(baseInput());
    expect(mono(r.initialCapexKrw)).toBe(true);
    expect(mono(r.fundingGapKrw)).toBe(true);
    for (const y of r.years) { expect(mono(y.netCashKrw)).toBe(true); expect(mono(y.cumulativeNetCashKrw)).toBe(true); }
    expect(r.capexItems.every((c) => c.verified === false)).toBe(true);
    expect(r.disclaimers.some((d) => /보장/.test(d))).toBe(true);
    expect(r.disclaimers.some((d) => /실견적/.test(d))).toBe(true);
  });

  it("analysisYears 클램프(1~30)", () => {
    expect(runCashflowPlan(baseInput({ analysisYears: 999 })).years.length).toBe(30);
    expect(runCashflowPlan(baseInput({ analysisYears: 0 })).years.length).toBe(1);
  });

  it("incomeMode gross_minus_opcost: 운영비를 엔진이 차감(이중차감 아님)", () => {
    const r = runCashflowPlan(baseInput({
      incomeMode: "gross_minus_opcost",
      annualGrossIncomeKrw: { p10: 5_000_000, p50: 5_000_000, p90: 5_000_000 },
      annualOperatingCostKrw: { p10: 2_000_000, p50: 2_000_000, p90: 2_000_000 },
    }));
    // P50 net = 5M − 2M = 3M → 누적 시작 -10 → -7 → -4 → -1 → +2 → 4년차 회수
    expect(r.metrics.paybackYearP50).toBe(4);
  });

  it("융자/보조 출처 링크: 융자 있으면 nh_fund, 보조 있으면 smartfarm·young_farmer", () => {
    const withLoan = runCashflowPlan(baseInput({ loan: { principalKrw: 5_000_000, annualRatePct: 3, termYears: 5 } }));
    expect(withLoan.fundingSources.some((s) => s.programId === "nh_fund")).toBe(true);
    const withSubsidy = runCashflowPlan(baseInput({ subsidyKrw: 3_000_000 }));
    expect(withSubsidy.fundingSources.some((s) => s.programId === "smartfarm")).toBe(true);
    const none = runCashflowPlan(baseInput());
    expect(none.fundingSources.length).toBe(0);
  });

  it("온난화 에너지 궤적(H2): 시설 난방비 연차 점감 → 후반 운영비<1년차, payback ≤ 미반영. 노지(난방비중0)는 평탄", () => {
    const fac = baseInput({
      incomeMode: "gross_minus_opcost",
      annualGrossIncomeKrw: { p10: 5_000_000, p50: 5_000_000, p90: 5_000_000 },
      annualOperatingCostKrw: { p10: 2_000_000, p50: 2_000_000, p90: 2_000_000 },
      heatingShareOfOpCost: 0.35, analysisYears: 15,
    });
    const flat = runCashflowPlan(fac);                                                  // 시나리오 없음 → 평탄
    const warm = runCashflowPlan({ ...fac, climateScenario: { year: 2025, path: "ssp585" } }); // 연차↑ 난방↓
    expect(warm.years[14].operatingCostKrw.p50).toBeLessThan(warm.years[0].operatingCostKrw.p50); // 후반 점감
    expect(flat.years[14].operatingCostKrw.p50).toBe(flat.years[0].operatingCostKrw.p50);          // 평탄
    expect(warm.metrics.paybackYearP50!).toBeLessThanOrEqual(flat.metrics.paybackYearP50!);        // 회수 같거나 단축
    const none = runCashflowPlan({ ...fac, heatingShareOfOpCost: 0, climateScenario: { year: 2025, path: "ssp585" } });
    expect(none.years[14].operatingCostKrw.p50).toBe(none.years[0].operatingCostKrw.p50);          // 노지=난방비중0 → 평탄
  });

  it("냉방비 상승(H6): 고ΔT에서 난방절감을 냉방상승이 일부 상쇄(순절감 < 난방만)", () => {
    const fac = baseInput({
      incomeMode: "gross_minus_opcost",
      annualGrossIncomeKrw: { p10: 5_000_000, p50: 5_000_000, p90: 5_000_000 },
      annualOperatingCostKrw: { p10: 1_000_000, p50: 1_000_000, p90: 1_000_000 },
      heatingShareOfOpCost: 0.5, analysisYears: 11, climateScenario: { year: 2025, path: "ssp585" },
    });
    const r = runCashflowPlan(fac);
    const op1 = r.years[0].operatingCostKrw.p50, opN = r.years[10].operatingCostKrw.p50;
    expect(opN).toBeLessThan(op1);        // 순 운영비 감소(난방 우세)
    expect(opN).toBeGreaterThan(970_000); // '난방만'(1M×(1−0.5×0.06)=970,000)보다 덜 절감 — 냉방 상쇄
  });
});

describe("annualLoanPayment — 원리금균등", () => {
  it("이자 있는 원리금균등: 10M·5%·5년 → 연 ~2.31M, 상환완료 후 0", () => {
    const loan = { principalKrw: 10_000_000, annualRatePct: 5, termYears: 5 };
    const pay = annualLoanPayment(loan, 1);
    expect(pay).toBeGreaterThan(2_300_000);
    expect(pay).toBeLessThan(2_320_000);
    expect(annualLoanPayment(loan, 6)).toBe(0); // 기간 종료
  });
  it("무이자: 원금/기간 균등", () => {
    expect(annualLoanPayment({ principalKrw: 10_000_000, annualRatePct: 0, termYears: 5 }, 1)).toBe(2_000_000);
  });
  it("거치기간: 거치 중 이자만, 이후 원리금균등", () => {
    const loan = { principalKrw: 10_000_000, annualRatePct: 5, termYears: 5, graceYears: 2 };
    expect(annualLoanPayment(loan, 1)).toBe(500_000); // 거치: 이자만(10M×5%)
    expect(annualLoanPayment(loan, 3)).toBeGreaterThan(2_000_000); // 상환 시작
  });
  it("융자 없음(undefined·0원): 0", () => {
    expect(annualLoanPayment(undefined, 1)).toBe(0);
    expect(annualLoanPayment({ principalKrw: 0, annualRatePct: 5, termYears: 5 }, 1)).toBe(0);
  });
});

describe("buildCashflowTeaser — 무료 미리보기", () => {
  it("단년 P50 회수 근사 + 다년/ROI 미제공", () => {
    const t = buildCashflowTeaser(baseInput());
    expect(t.mode).toBe("free");
    expect(t.initialCapexP50Krw).toBe(10_000_000);
    expect(t.equityOutlayP50Krw).toBe(10_000_000); // 융자·보조 없음 → 자기부담=총투자
    expect(t.approxAnnualNetCashP50Krw).toBe(2_500_000);
    expect(t.approxPaybackYears).toBe(4); // ceil(10M/2.5M)
    expect((t as any).metrics).toBeUndefined();
    expect((t as any).years).toBeUndefined();
  });

  it("자기부담 기준 회수: 보조·융자가 분자를 줄임(융자 이중반영 아님)", () => {
    // capex 10M, 보조 4M, 무이자융자 3M → 자기부담 3M. 연순현금 = 2.5M − 융자(3M/10y=0.3M) = 2.2M.
    const t = buildCashflowTeaser(baseInput({ subsidyKrw: 4_000_000, loan: { principalKrw: 3_000_000, annualRatePct: 0, termYears: 10 } }));
    expect(t.equityOutlayP50Krw).toBe(3_000_000);       // 10M − 4M − 3M
    expect(t.approxAnnualNetCashP50Krw).toBe(2_200_000);
    expect(t.approxPaybackYears).toBe(2);               // ceil(3M / 2.2M)
  });
  it("연순현금 0 이하면 회수 근사 null", () => {
    const t = buildCashflowTeaser(baseInput({ livingCostKrwPerYear: 5_000_000 }));
    expect(t.approxPaybackYears).toBeNull();
  });
});

describe("buildFacilityCapex — 시설 등급 → capex 항목", () => {
  it("단동: 시설+관수 2항목, 면적 비례", () => {
    const items = buildFacilityCapex("single_span", 1000);
    expect(items.length).toBe(2);
    expect(items[0].amountKrw.p50).toBe(35_000_000); // 35,000원/㎡ × 1000㎡
    expect(items.every((i) => i.verified === false)).toBe(true);
  });
  it("보급형 스마트팜: 환경제어 포함 3항목", () => {
    expect(buildFacilityCapex("smartfarm_basic", 1000).length).toBe(3);
  });
  it("노지: capex 0항목", () => {
    expect(buildFacilityCapex("none", 1000).length).toBe(0);
  });
});
