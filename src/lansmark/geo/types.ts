/** WGS84 (EPSG:4326) 위경도 — 앱 내부 기준 좌표 */
export interface LatLng { lat: number; lng: number; }
/** 타일 좌표 (XYZ · Web Mercator EPSG:3857) */
export interface TileXYZ { z: number; x: number; y: number; }
/** 경계 박스 (WGS84) */
export interface BBox { minLat: number; minLng: number; maxLat: number; maxLng: number; }

/** 필지고유번호 (19자리) */
export type Pnu = string;
export interface ParsedPnu { legalDongCode: string; mountain: boolean; bonbun: number; bubun: number; }

/** 필지 지오메트리 (WFS 조회 결과 형태) */
export interface ParcelGeo { pnu?: Pnu; center: LatLng; polygon: LatLng[]; address?: string; }

/** DEM 격자 (필지 주변 부분요청 결과) */
export interface DemGrid {
  cols: number; rows: number;
  cellSizeM: number;   // 셀 한 변(m)
  origin: LatLng;      // 좌상단(NW)
  heights: number[];   // row-major, 길이 = cols*rows (m)
}

/** EPSG 코드 (단일 출처) */
export const EPSG = { WGS84: 4326, WEB_MERCATOR: 3857, UTM_K: 5179 } as const;
