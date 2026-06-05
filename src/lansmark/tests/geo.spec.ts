import { describe, it, expect } from "vitest";
import { polygonAreaM2 } from "../core/geo";
describe("polygon area", () => {
  it("approximates a small square near lat 34.5", () => {
    const lat = 34.5, lng = 126.6, d = 0.001;
    const ring: [number, number][] = [[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d]];
    const a = polygonAreaM2(ring);
    expect(a).toBeGreaterThan(9000);
    expect(a).toBeLessThan(11500);
  });
  it("degenerate ring -> 0", () => { expect(polygonAreaM2([[0, 0], [1, 1]] as [number, number][])).toBe(0); });
});
