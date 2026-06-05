import type { BBox, DemGrid, LatLng } from "./types";
import { distanceM } from "./crs";

/** 필지 주변 DEM 격자(부분요청). ⚠ 전체 다운로드 불가 — 필지 주변만. */
export async function fetchDem(_bbox: BBox, key: string, _level = 15): Promise<DemGrid> {
  if (!key) throw new Error("VWORLD_API_KEY 필요(3D Data API DEM).");
  // TODO(VWorld 3D Data API): bbox 영역(레벨≤15, ~1.5m) 부분 요청 → 높이 격자 파싱.
  //   대안: 국토정보플랫폼 DEM(오프라인) 또는 자체 raster-dem 호스팅.
  throw new Error("fetchDem 미구현 — VWorld 3D Data API(DEM) 연동 필요(키 있음).");
}

/** 키 없이 동작하는 결정적 mock DEM (좌표 해시 기반 경사면) */
export function mockDem(bbox: BBox, cols = 16, rows = 16): DemGrid {
  const origin: LatLng = { lat: bbox.maxLat, lng: bbox.minLng }; // NW
  const widthM = distanceM({ lat: origin.lat, lng: bbox.minLng }, { lat: origin.lat, lng: bbox.maxLng });
  const cellSizeM = Math.max(1, widthM / cols);
  const seed = Math.abs(Math.sin(bbox.minLat * 12.9898 + bbox.minLng * 78.233));
  const baseAlt = 30 + Math.floor(seed * 270);   // 30~300m (농지 표고대)
  const dir = seed * Math.PI * 2;                  // 경사 방향
  const mag = 0.15 + seed * 1.2;                   // 셀당 고도차(완만)
  const heights: number[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      heights.push(baseAlt + (c * Math.cos(dir) + r * Math.sin(dir)) * mag + Math.sin(c * 0.9) * Math.cos(r * 0.7) * 1.5);
  return { cols, rows, cellSizeM, origin, heights };
}
