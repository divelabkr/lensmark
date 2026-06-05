import { describe, it, expect } from "vitest";
import { multiplyIndependent, subtractIndependent } from "../core/uncertainty";

const y = { p10: 600, p50: 1125, p90: 1875 };
const p = { p10: 12000, p50: 18000, p90: 28000 };

describe("uncertainty", () => {
  it("product P50 equals product of medians", () => {
    expect(multiplyIndependent(y, p).p50).toBe(1125 * 18000);
  });
  it("product P90 is more conservative than comonotonic corner", () => {
    expect(multiplyIndependent(y, p).p90).toBeLessThan(y.p90 * p.p90);
  });
  it("keeps ordering p10<=p50<=p90", () => {
    const r = multiplyIndependent(y, p);
    expect(r.p10).toBeLessThanOrEqual(r.p50);
    expect(r.p50).toBeLessThanOrEqual(r.p90);
  });
  it("difference P50 equals difference of medians", () => {
    const rev = { p10: 5_000_000, p50: 20_000_000, p90: 35_000_000 };
    const cost = { p10: 9_000_000, p50: 18_000_000, p90: 32_000_000 };
    expect(subtractIndependent(rev, cost).p50).toBe(2_000_000);
  });
});
