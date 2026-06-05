/**
 * 시설비 시드(facilityCost.seed) 정직성 가드 — 데이터 정직성(CLAUDE.md #4) 회귀 방지.
 *   전 항목 verified:false · SigmaRange 단조성 · 2025 출처 라벨 · 노지=0 · 평당 환산 일관성.
 */
import { describe, it, expect } from "vitest";
import { FACILITY_COSTS, getFacilityCost, type FacilityTier } from "../data/facilityCost.seed";

const mono = (r: { p10: number; p50: number; p90: number }) => r.p10 <= r.p50 && r.p50 <= r.p90;
const PYEONG = 3.3058; // 1평 = 3.3058㎡

describe("facilityCost.seed", () => {
  it("전 항목 verified:false(미검증 참고치) · sourceYear=2025 · 출처 라벨 존재", () => {
    for (const p of Object.values(FACILITY_COSTS)) {
      expect(p.verified).toBe(false);
      expect(p.sourceYear).toBe(2025);
      expect(/참고|미검증|노지/.test(p.source)).toBe(true);
    }
  });

  it("모든 capex SigmaRange 단조성(p10≤p50≤p90)", () => {
    for (const p of Object.values(FACILITY_COSTS)) {
      expect(mono(p.capexPerM2Krw.facility)).toBe(true);
      expect(mono(p.capexPerM2Krw.irrigation)).toBe(true);
      if (p.capexPerM2Krw.environmentControl) expect(mono(p.capexPerM2Krw.environmentControl)).toBe(true);
      if (p.heatingShareOfOpCost) expect(mono(p.heatingShareOfOpCost)).toBe(true);
    }
  });

  it("노지(none)는 시설·관수 capex 0", () => {
    const n = FACILITY_COSTS.none;
    expect(n.capexPerM2Krw.facility.p90).toBe(0);
    expect(n.capexPerM2Krw.irrigation.p90).toBe(0);
  });

  it("평당 환산 일관성: 단동 시설 p50 ㎡당 × 3.3058 ≈ 평당 8~15만 범위", () => {
    const pyeong = FACILITY_COSTS.single_span.capexPerM2Krw.facility.p50 * PYEONG;
    expect(pyeong).toBeGreaterThanOrEqual(80_000);
    expect(pyeong).toBeLessThanOrEqual(150_000);
  });

  it("난방비 비중은 시설원예 경영비의 30~40%(시설 등급)", () => {
    const h = FACILITY_COSTS.glass_complex.heatingShareOfOpCost!;
    expect(h.p10).toBeCloseTo(0.30); expect(h.p90).toBeCloseTo(0.40);
  });

  it("getFacilityCost: 알 수 없는 등급은 노지로 폴백(크래시 없음)", () => {
    expect(getFacilityCost("single_span").tier).toBe("single_span");
    expect(getFacilityCost("zzz" as FacilityTier).tier).toBe("none");
  });
});
