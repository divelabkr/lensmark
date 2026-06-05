import { describe, it, expect } from "vitest";
import { latLngToGrid, nearestStation } from "../geo/kma";

describe("geo/kma (격자변환·최근접지점)", () => {
  it("서울 → 격자 (60,127)", () => {
    expect(latLngToGrid(37.5665, 126.9780)).toEqual({ nx: 60, ny: 127 });
  });
  it("최근접 ASOS: 서울 인근→108, 부산 인근→159", () => {
    expect(nearestStation(37.55, 126.99).stn).toBe(108);
    expect(nearestStation(35.12, 129.02).stn).toBe(159);
  });
});
