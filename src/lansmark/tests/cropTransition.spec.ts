/**
 * 작물 전환 로드맵(G-2) — climateScenario × cropSuitability 합성이 시점별로 결정적·면책 부착인지 회귀가드.
 */
import { describe, it, expect } from "vitest";
import { buildCropTransition } from "../core/cropTransition";
import type { LandInput } from "../types";
import type { ClimateResult } from "../data/providers/types";

const land: LandInput = { areaM2: 3300, lat: 36, lng: 127 };
const climate: ClimateResult = { minWinterTempC: -10, summerMaxTempC: 32, annualRainfallMm: 1200, annualMeanTempC: 12, frostRisk: "high" };

describe("buildCropTransition — 온난화 시점별 작물 전환", () => {
  it("climate 없으면 null(좌표/필지 단계 필요)", () => {
    expect(buildCropTransition(land, undefined)).toBeNull();
  });

  it("3시점(현재·2040·2060) + ΔT 단조 증가 + 현재 ΔT=0", () => {
    const t = buildCropTransition(land, climate);
    expect(t).not.toBeNull();
    expect(t!.points).toHaveLength(3);
    expect(t!.points[0].deltaC).toBe(0);                              // 현재=평년(ΔT 0)
    expect(t!.points[2].deltaC).toBeGreaterThan(t!.points[1].deltaC); // 2060 > 2040(온난화 누적)
    expect(t!.points[0].top.length).toBeGreaterThan(0);              // 작물 랭킹 존재
  });

  it("결과는 면책·외삽 라벨 부착 + newcomers/fadeouts 배열(작물 변화)", () => {
    const t = buildCropTransition(land, climate)!;
    expect(Array.isArray(t.newcomers)).toBe(true);
    expect(Array.isArray(t.fadeouts)).toBe(true);
    expect(t.disclaimer).toMatch(/외삽|미검증|참고용/);
  });

  it("결정적 — 같은 입력은 같은 결과(순수 합성)", () => {
    const a = JSON.stringify(buildCropTransition(land, climate));
    const b = JSON.stringify(buildCropTransition(land, climate));
    expect(a).toBe(b);
  });
});
