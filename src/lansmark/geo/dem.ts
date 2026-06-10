import type { BBox, DemGrid, LatLng } from "./types";
import { distanceM } from "./crs";

/** 필지 주변 DEM 격자(부분요청). ⚠ 전체 다운로드 불가 — 필지 주변만. */
export async function fetchDem(_bbox: BBox, _key: string, _level = 15): Promise<DemGrid> {
  // 소스 조사 완료(2026-06): VWorld는 geocoder/data API만 제공 — 좌표→표고 REST가 없다.
  //   국토지리정보원 DEM도 '대용량 파일 다운로드'(오프라인)뿐, 점 표고 조회 API 미제공 → 무료 정밀 REST 부재.
  //   소스 옵션(확정 시 여기 구현): Google Elevation(유료키)·Open-Elevation(SRTM 30m 무료·거침)·자체 raster-dem 호스팅.
  //   무료베타 결정(사용자): mock 유지 — terrain은 mockDem→terrainFromDem로 좌표 기반 추정(정직 라벨 source:"mock").
  throw new Error("fetchDem 미구현 — 정밀 표고 소스 미확정(VWorld·국토지리정보원 REST 미제공). mock 폴백 사용 중.");
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
