import { describe, it, expect } from "vitest";
import { terrainFromDem } from "../geo/terrainFromDem";
import { mockDem } from "../geo/dem";
import type { DemGrid } from "../geo/types";

function grid(cols: number, rows: number, cellSizeM: number, fn: (c: number, r: number) => number): DemGrid {
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(fn(c, r));
  return { cols, rows, cellSizeM, origin: { lat: 36, lng: 127 }, heights };
}

describe("geo/terrainFromDem (Stage2 DEM→경사/향/표고)", () => {
  it("평지 → flat, 경사 0", () => {
    const t = terrainFromDem(grid(10, 10, 10, () => 100));
    expect(t.slopeDegree).toBe(0);
    expect(t.aspect).toBe("flat");
    expect(t.altitudeM).toBe(100);
  });
  it("남쪽으로 하강(r↑=남) → 향 S, 경사 ~27°", () => {
    const t = terrainFromDem(grid(10, 10, 10, (_c, r) => 100 - r * 5)); // 남으로 갈수록 낮아짐
    expect(t.aspect).toBe("S");
    expect(t.slopeDegree).toBeGreaterThan(24);
    expect(t.slopeDegree).toBeLessThan(30);
  });
  it("동쪽으로 하강(c↑=동) → 향 E", () => {
    const t = terrainFromDem(grid(10, 10, 10, (c) => 100 - c * 5));
    expect(t.aspect).toBe("E");
  });
  it("표고는 평균 고도", () => {
    const t = terrainFromDem(grid(10, 10, 10, (_c, r) => 200 - r * 2)); // 평균 ~191
    expect(t.altitudeM).toBeGreaterThan(185);
    expect(t.altitudeM).toBeLessThan(196);
  });
  it("mockDem→terrainFromDem 파이프라인 동작(결정적)", () => {
    const bbox = { minLat: 35.2, minLng: 128.5, maxLat: 35.201, maxLng: 128.501 };
    const t = terrainFromDem(mockDem(bbox));
    expect(t.source).toBe("dem");
    expect(["flat","N","NE","E","SE","S","SW","W","NW"]).toContain(t.aspect);
    expect(t.altitudeM).toBeGreaterThanOrEqual(20);
  });
});
