import type { BBox, DemGrid, LatLng } from "./types";
import { distanceM } from "./crs";
import { fetchJsonSafe } from "./fetchSafe";

/**
 * 필지 주변 DEM 격자 — Open-Meteo Elevation API(무료·무키·Copernicus DEM ~90m)로 실표고 조회(2026-06 mock→실데이터).
 *   bbox에 NxN 격자점을 깔아 1회 batch 조회 → terrainFromDem(Horn)이 경사/향/표고 산출.
 *   ⚠ 해상도 ~90m: 셀 간격을 그보다 작게 잡으면 인접점이 같은 값 → '의미있는 국소 경사'를 위해 셀≈100m로 격자 크기 적응(호출측이 넓게 bbox).
 *   ⚠ Open-Meteo 무료티어=비상업 — 유료 전환 시 Google Elevation 등으로 교체(반환형 동일·seam). _key/_level은 인터페이스 호환용(미사용).
 */
export async function fetchDem(bbox: BBox, _key?: string, _level = 15): Promise<DemGrid> {
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const wM = distanceM({ lat: bbox.minLat, lng: bbox.minLng }, { lat: bbox.minLat, lng: bbox.maxLng });
  const hM = distanceM({ lat: bbox.minLat, lng: bbox.minLng }, { lat: bbox.maxLat, lng: bbox.minLng });
  const cols = clamp(Math.round(wM / 100) + 1, 3, 6); // 목표 셀 ~100m(DEM 해상도 근사) · 3~6점
  const rows = clamp(Math.round(hM / 100) + 1, 3, 6);
  const lats: number[] = [], lngs: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    lats.push(bbox.maxLat - (bbox.maxLat - bbox.minLat) * (r / (rows - 1))); // 원점 NW · r↑=남(lat↓)
    lngs.push(bbox.minLng + (bbox.maxLng - bbox.minLng) * (c / (cols - 1))); // c↑=동(lng↑)
  }
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(",")}&longitude=${lngs.join(",")}`;
  const j = (await fetchJsonSafe(url)) as { elevation?: unknown } | null; // 타임아웃·비JSON·실패 → null
  const el = j?.elevation;
  if (!Array.isArray(el) || el.length !== cols * rows || el.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    throw new Error("Open-Meteo elevation 응답 형식 불일치 — mock 폴백"); // auto provider가 catch → mock
  }
  return { cols, rows, cellSizeM: Math.max(1, wM / (cols - 1)), origin: { lat: bbox.maxLat, lng: bbox.minLng } as LatLng, heights: el as number[] };
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
