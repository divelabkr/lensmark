import type { DemGrid } from "./types";
import type { TerrainInput, Aspect } from "../core/terrain";

const DIRS: Aspect[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** DEM 격자 → 경사(°)·향·표고(m)  (= core/terrain.ts 입력형) */
export function terrainFromDem(grid: DemGrid): TerrainInput {
  const { cols, rows, cellSizeM, heights } = grid;
  const at = (c: number, r: number) =>
    heights[Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))];

  let gx = 0, gy = 0, n = 0, sum = 0;
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    // Horn 방식: dz/dE(동), dz/dS(남, r증가=남)
    const dzdx = ((at(c + 1, r - 1) + 2 * at(c + 1, r) + at(c + 1, r + 1))
                - (at(c - 1, r - 1) + 2 * at(c - 1, r) + at(c - 1, r + 1))) / (8 * cellSizeM);
    const dzdy = ((at(c - 1, r + 1) + 2 * at(c, r + 1) + at(c + 1, r + 1))
                - (at(c - 1, r - 1) + 2 * at(c, r - 1) + at(c + 1, r - 1))) / (8 * cellSizeM);
    gx += dzdx; gy += dzdy; n++;
  }
  for (let i = 0; i < heights.length; i++) sum += heights[i];
  gx /= n || 1; gy /= n || 1;

  const slopeDegree = Math.round(Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI * 10) / 10;
  let aspect: Aspect = "flat";
  if (slopeDegree >= 1) {
    // 하강(물 흐르는) 방향의 방위각: 동=-gx, 북=+gy(남쪽 grad의 반대)
    const az = (Math.atan2(-gx, gy) * 180 / Math.PI + 360) % 360;
    aspect = DIRS[Math.round(az / 45) % 8];
  }
  const altitudeM = Math.round(sum / (heights.length || 1));
  return { slopeDegree, aspect, altitudeM, source: "dem" };
}
