import { describe, it, expect } from "vitest";
import { rankCropCandidates } from "../core/cropSuitability";
import { runLansmarkSimulation } from "../core/simulator";
import type { LandInput } from "../types";

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

describe("LANSMARK simulator", () => {
  it("returns free crop candidates", () => {
    expect(rankCropCandidates(sampleLand, 5).length).toBeGreaterThan(0);
  });
  it("runs paid simulation with ordered ranges + disclaimers", () => {
    const r = runLansmarkSimulation({
      land: sampleLand, cropId: "sweet_potato",
      cultivationType: "open_field", salesChannel: "mixed", targetYear: "mature",
    });
    expect(r.yield.yieldKg.p10).toBeLessThanOrEqual(r.yield.yieldKg.p50);
    expect(r.yield.yieldKg.p50).toBeLessThanOrEqual(r.yield.yieldKg.p90);
    expect(r.cost.costKrw.p50).toBeGreaterThan(0);
    expect(r.disclaimers.length).toBeGreaterThan(0);
  });
  it("blueberry without soil -> confidence D", () => {
    const r = runLansmarkSimulation({
      land: sampleLand, cropId: "blueberry",
      cultivationType: "open_field", salesChannel: "direct", targetYear: "mature",
    });
    expect(r.confidence).toBe("D");
  });
});
