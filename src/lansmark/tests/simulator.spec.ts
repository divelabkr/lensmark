import { describe, it, expect } from "vitest";
import { rankCropCandidates } from "../core/cropSuitability";
import type { LandInput } from "../types";

// 무료 작물 추천(cropSuitability) 기본 동작 — 후보가 나오는지. (레거시 엔진 simulator/yield/cost/revenue/income은 v0.76.7에서 제거)
const sampleLand: LandInput = {
  address: "전남 해남군 예시",
  areaM2: 1000,
  currentLandState: "field",
  drainage: "normal",
  waterAccess: "available",
  machineryAccess: "good",
  electricityAccess: "available",
  laborLevel: "medium",
  frostRisk: "medium",
  soilEvidence: { source: "none" },
};

describe("cropSuitability — 무료 추천 기본", () => {
  it("후보 작물을 점수순으로 반환한다", () => {
    const c = rankCropCandidates(sampleLand, 5);
    expect(c.length).toBeGreaterThan(0);
    for (let i = 1; i < c.length; i++) expect(c[i - 1].score).toBeGreaterThanOrEqual(c[i].score);
  });
});
