import { describe, it, expect } from "vitest";
import { simulateCost } from "../core/cost";
import type { SimulationInput } from "../types";

const baseInput = (over: Partial<SimulationInput> = {}): SimulationInput => ({
  land: { areaM2: 1000 },
  cropId: "blueberry",
  cultivationType: "open_field",
  salesChannel: "mixed",
  ...over,
});

describe("cost reconciliation", () => {
  it("line items sum equals total (within rounding)", () => {
    const c = simulateCost(baseInput());
    const sum = c.lineItems.reduce((a, li) => a + li.value.p50, 0);
    expect(Math.abs(sum - c.costKrw.p50)).toBeLessThanOrEqual(c.lineItems.length);
  });
  it("override collapses to single value", () => {
    const c = simulateCost(baseInput({ userOverrideCostKrw: 1234 }));
    expect(c.costKrw.p50).toBe(1234);
    expect(c.lineItems[0].key).toBe("user_override");
  });
});
