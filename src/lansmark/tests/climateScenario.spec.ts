/**
 * 지구온난화 시나리오 primitive 검증 — ΔT 산출(연도·경로·override·클램프) + applyWarming(온도 가산·서리 완화).
 */
import { describe, it, expect } from "vitest";
import { warmingDeltaC, applyWarming, warmingRainPct, BASELINE_YEAR } from "../core/climateScenario";

describe("climateScenario", () => {
  it("기준연도/미지정 → ΔT 0(현재 평년)", () => {
    expect(warmingDeltaC()).toBe(0);
    expect(warmingDeltaC({ year: BASELINE_YEAR })).toBe(0);
  });

  it("연도·경로 → ΔT(고배출 SSP5-8.5가 더 큼)", () => {
    const mid = warmingDeltaC({ year: 2075, path: "ssp245" }); // 0.30 × 50/10 = 1.5
    const hi = warmingDeltaC({ year: 2075, path: "ssp585" });  // 0.60 × 50/10 = 3.0
    expect(mid).toBeCloseTo(1.5);
    expect(hi).toBeCloseTo(3.0);
    expect(hi).toBeGreaterThan(mid);
  });

  it("연도↑ → ΔT 단조 증가", () => {
    expect(warmingDeltaC({ year: 2060, path: "ssp585" })).toBeGreaterThan(warmingDeltaC({ year: 2040, path: "ssp585" }));
  });

  it("클램프 [0,6] · override가 연도·경로보다 우선", () => {
    expect(warmingDeltaC({ deltaTempCOverride: 99 })).toBe(6);
    expect(warmingDeltaC({ deltaTempCOverride: -5 })).toBe(0);
    expect(warmingDeltaC({ year: 2050, path: "ssp585", deltaTempCOverride: 2 })).toBe(2);
    expect(warmingDeltaC({ year: 9999, path: "ssp585" })).toBe(6);
  });

  it("warmingRainPct: ΔT↑ 연강수율 단조↑·상한 +12%", () => {
    expect(warmingRainPct(0)).toBe(0);
    expect(warmingRainPct(2)).toBeCloseTo(0.03);          // 0.015 × 2
    expect(warmingRainPct(4)).toBeGreaterThan(warmingRainPct(2));
    expect(warmingRainPct(100)).toBe(0.12);               // 상한
  });

  it("applyWarming: 겨울최저·여름최고 +ΔT · 연강수 소폭↑ · 서리 완화 · ΔT0은 원본", () => {
    const c = { minWinterTempC: -10, summerMaxTempC: 31, annualRainfallMm: 1300, frostRisk: "high" as const, sunlightLevel: "medium" as const };
    const w = applyWarming(c, 3);
    expect(w.minWinterTempC).toBeCloseTo(-7); // -10 + 3
    expect(w.summerMaxTempC).toBeCloseTo(34); // 31 + 3 (여름도 더워짐 → 고온 스트레스↑)
    expect(w.annualRainfallMm).toBeGreaterThan(1300); // 연강수 소폭↑(+4.5% ≈ 1359) — 변동성은 별도 리스크
    expect(w.annualRainfallMm).toBeLessThan(1400);
    expect(w.frostRisk).toBe("medium");        // ΔT 3 → 1단계 완화(high→medium)
    expect(applyWarming(c, 0)).toBe(c);         // ΔT0 → 원본 그대로
  });
});
