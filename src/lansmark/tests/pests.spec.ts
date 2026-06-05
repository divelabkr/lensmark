import { describe, it, expect } from "vitest";
import { getCropPests } from "../data/cropPests.seed";
import { buildGrowthRiskInfo } from "../core/growthRisk";
import type { SimulationInput } from "../types";
const inp = (cropId: string): SimulationInput => ({ land: { areaM2: 1000 }, cropId, cultivationType: "open_field", salesChannel: "mixed" });
describe("pests", () => {
  it("returns pests for known crop", () => { expect(getCropPests("chili_pepper").length).toBeGreaterThan(0); });
  it("growthRisk includes real pest names", () => {
    expect(buildGrowthRiskInfo(inp("chili_pepper")).pestRisks.some(p => p.includes("탄저병"))).toBe(true);
  });
});
