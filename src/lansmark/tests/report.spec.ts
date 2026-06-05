import { describe, it, expect } from "vitest";
import { buildReportModel } from "../core/report";
import { runLansmarkSimulation } from "../core/simulator";
import type { SimulationInput } from "../types";
describe("report model", () => {
  it("builds sections + disclaimers", () => {
    const input: SimulationInput = { land: { areaM2: 1000, soilEvidence: { source: "none" } }, cropId: "sweet_potato", cultivationType: "open_field", salesChannel: "mixed", targetYear: "mature" };
    const m = buildReportModel(runLansmarkSimulation(input), 1000, "전남 해남");
    expect(m.sections.length).toBeGreaterThanOrEqual(3);
    expect(m.disclaimers.length).toBeGreaterThan(0);
    expect(m.title).toContain("고구마");
  });
});
