import type { LatLng, TileXYZ, BBox, Pnu, ParsedPnu } from "./types";

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const EARTH_M = 6378137;   // Web Mercator 반경
const HAVER_R = 6371000;   // 거리용 평균 반경
const asinh = (v: number) => Math.log(v + Math.sqrt(v * v + 1));   // lib 비의존
const sinh = (v: number) => (Math.exp(v) - Math.exp(-v)) / 2;
const clampLat = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

/** WGS84 → Web Mercator(EPSG:3857) 미터 */
export function lonLatToMeters({ lat, lng }: LatLng): { x: number; y: number } {
  return { x: EARTH_M * lng * D2R, y: EARTH_M * Math.log(Math.tan(Math.PI / 4 + clampLat(lat) * D2R / 2)) };
}
export function metersToLonLat({ x, y }: { x: number; y: number }): LatLng {
  return { lng: (x / EARTH_M) * R2D, lat: (2 * Math.atan(Math.exp(y / EARTH_M)) - Math.PI / 2) * R2D };
}

/** WGS84 → 타일 인덱스(z) (slippy/XYZ) */
export function lonLatToTile(lng: number, lat: number, z: number): TileXYZ {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - asinh(Math.tan(clampLat(lat) * D2R)) / Math.PI) / 2) * n);
  const c = (v: number) => Math.min(n - 1, Math.max(0, v));
  return { z, x: c(x), y: c(y) };
}
/** 타일 NW(좌상단) 좌표 */
export function tileToLonLat({ x, y, z }: TileXYZ): LatLng {
  const n = 2 ** z;
  return { lng: (x / n) * 360 - 180, lat: Math.atan(sinh(Math.PI * (1 - (2 * y) / n))) * R2D };
}
/** 타일 중심 좌표 */
export function tileCenter({ x, y, z }: TileXYZ): LatLng {
  const nw = tileToLonLat({ x, y, z }), se = tileToLonLat({ x: x + 1, y: y + 1, z });
  return { lat: (nw.lat + se.lat) / 2, lng: (nw.lng + se.lng) / 2 };
}

/** 하버사인 거리(m) */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * D2R, dLng = (b.lng - a.lng) * D2R;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLng / 2) ** 2;
  return HAVER_R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** 폴리곤 → bbox */
export function bboxOf(poly: LatLng[]): BBox {
  const lats = poly.map(p => p.lat), lngs = poly.map(p => p.lng);
  return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
}
/** 중심+반경(m) → bbox (근사) */
export function bboxAround(c: LatLng, radiusM: number): BBox {
  const dLat = radiusM / 111320;
  const dLng = radiusM / ((111320 * Math.cos(c.lat * D2R)) || 1);
  return { minLat: c.lat - dLat, maxLat: c.lat + dLat, minLng: c.lng - dLng, maxLng: c.lng + dLng };
}
export function bboxCenter(b: BBox): LatLng {
  return { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 };
}

/** PNU(19자리: 법정동10 + 필지구분1 + 본번4 + 부번4) */
export function isValidPnu(pnu: Pnu): boolean { return /^\d{19}$/.test(pnu); }
export function parsePnu(pnu: Pnu): ParsedPnu {
  if (!isValidPnu(pnu)) throw new Error("PNU는 19자리 숫자여야 합니다: " + pnu);
  return {
    legalDongCode: pnu.slice(0, 10),
    mountain: pnu[10] === "2",
    bonbun: parseInt(pnu.slice(11, 15), 10),
    bubun: parseInt(pnu.slice(15, 19), 10),
  };
}
