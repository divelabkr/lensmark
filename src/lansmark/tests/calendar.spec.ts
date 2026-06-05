import { describe, it, expect } from "vitest";
import { buildGrowthCalendar } from "../core/calendar";
describe("growth calendar", () => {
  it("returns 12 months and marks harvest", () => {
    const c = buildGrowthCalendar("sweet_potato");
    expect(c.months.length).toBe(12);
    expect(c.months.filter(m => m.stage === "harvest").map(m => m.month)).toContain(9);
  });
  it("flags frost risk in bloom for frost-sensitive crop", () => {
    const c = buildGrowthCalendar("apple");
    expect(c.months.filter(m => m.frostRisk).map(m => m.month)).toContain(4);
  });
});
