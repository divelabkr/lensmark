import type { LatLng, ParcelGeo } from "./types";
import { fetchJsonSafe } from "./fetchSafe";

export type VWorldTileLayer = "Base" | "gray" | "midnight" | "Satellite" | "Hybrid";
const TILE_EXT: Record<VWorldTileLayer, "png" | "jpeg"> = {
  Base: "png", gray: "png", midnight: "png", Satellite: "jpeg", Hybrid: "png",
};

/** WMTS XYZ 타일 URL 템플릿({z}/{y}/{x}) — Leaflet/MapLibre 등에 그대로 사용 (z5~19) */
export function tileUrlTemplate(layer: VWorldTileLayer, key: string): string {
  return `https://api.vworld.kr/req/wmts/1.0.0/${key}/${layer}/{z}/{y}/{x}.${TILE_EXT[layer]}`;
}

/** 주소 → 좌표/PNU (VWorld Geocoder 2.0). ⚠ 결과 DB 저장 금지(실시간 사용). */
export async function geocodeAddress(
  address: string, key: string, type: "road" | "parcel" = "road"
): Promise<{ lat: number; lng: number; pnu?: string } | null> {
  const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0`
    + `&crs=epsg:4326&format=json&type=${type}&key=${key}&address=${encodeURIComponent(address)}`;
  const j: any = await fetchJsonSafe(url); // 타임아웃·비JSON → null
  if (j?.response?.status !== "OK") {
    if (type === "road") return geocodeAddress(address, key, "parcel"); // 도로명 실패 → 지번 재시도
    return null;
  }
  const pt = j.response.result.point;
  return { lat: +pt.y, lng: +pt.x };
}

/** 좌표 → 필지경계 (VWorld 데이터 API, 연속지적도 LP_PA_CBND_BUBUN) */
export async function fetchParcel(lat: number, lng: number, key: string): Promise<ParcelGeo | null> {
  const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN`
    + `&key=${key}&geomFilter=POINT(${lng}%20${lat})&crs=EPSG:4326&format=json&size=1&geometry=true&attribute=true`;
  const j: any = await fetchJsonSafe(url); // 타임아웃·비JSON → null
  const feat = j?.response?.result?.featureCollection?.features?.[0];
  if (!feat) return null;
  const pnu = feat.properties?.pnu ?? feat.properties?.PNU;
  const ring = feat.geometry?.coordinates?.[0]?.[0] ?? feat.geometry?.coordinates?.[0];
  const polygon: LatLng[] = Array.isArray(ring) ? ring.map((c: number[]) => ({ lng: c[0], lat: c[1] })) : [];
  const center = polygon.length ? centroid(polygon) : { lat, lng };
  return { pnu, center, polygon, address: feat.properties?.addr };
}
function centroid(poly: LatLng[]): LatLng {
  const n = poly.length || 1;
  return { lat: poly.reduce((s, p) => s + p.lat, 0) / n, lng: poly.reduce((s, p) => s + p.lng, 0) / n };
}

/** 키 없이 동작하는 mock 필지(중심 주변 ~60m 사각형) */
export function mockParcel(lat: number, lng: number): ParcelGeo {
  const d = 0.0006;
  return {
    pnu: undefined,
    center: { lat, lng },
    polygon: [
      { lat: lat - d, lng: lng - d }, { lat: lat - d, lng: lng + d },
      { lat: lat + d, lng: lng + d }, { lat: lat + d, lng: lng - d },
    ],
    address: "mock parcel",
  };
}
