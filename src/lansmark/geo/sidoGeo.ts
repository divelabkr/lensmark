/**
 * 시도(광역) 행정경계 GeoJSON — crop-first '지형 색칠'(choropleth)용. VWorld 행정경계(LT_C_ADSIDO_INFO) 1회 수신·단순화·캐시.
 *   왜 단순화: VWorld 원본은 시도당 수만~수십만 좌표(제주 1MB+) — 면 색칠엔 과해상. 좌표를 STEP 간격으로 솎아 전송·렌더 경량화.
 *   왜 캐시: 행정경계는 정적(거의 안 변함) → 1회 수신 후 메모리 보관(VWorld 쿼터·지연 절감).
 *   정직성: 좌표·시도명(ctp_kor_nm)은 VWorld 실데이터. 단순화는 점 솎기(근사)일 뿐 날조 아님 — UI에 '광역 근사' 면책.
 *   ⛔ VWORLD_API_KEY=HUMAN GATE. 키 없거나 실패 시 null(클라는 색 원/마커로 폴백).
 */

export interface SidoBoundary {
  sido: string;                    // 시도명(VWorld ctp_kor_nm)
  rings: [number, number][][];     // 외곽 폴리곤 ring 목록([lng,lat] 좌표). MultiPolygon은 여러 ring.
}

const STEP = 6; // 좌표 1/6 솎기(면 색칠엔 충분·전송 경량). 값↑=더 거침·가벼움.

/** ring(좌표 배열) 단순화 — STEP 간격 샘플 + 마지막 점(닫힘) 보장. */
function simplifyRing(ring: unknown): [number, number][] {
  if (!Array.isArray(ring)) return [];
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i += STEP) {
    const c = ring[i];
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") out.push([c[0], c[1]]);
  }
  const last = ring[ring.length - 1];
  if (Array.isArray(last) && out.length && (out[out.length - 1][0] !== last[0] || out[out.length - 1][1] !== last[1])) {
    out.push([last[0], last[1]]);
  }
  return out;
}

// 정적 경계 → 1회 수신 후 메모리 캐시.
let CACHE: SidoBoundary[] | null = null;

/** 17개 시도 경계(단순화). 키 없거나 실패 시 null(무중단·클라 폴백). */
export async function getSidoBoundaries(): Promise<SidoBoundary[] | null> {
  if (CACHE) return CACHE;
  const key = process.env.VWORLD_API_KEY || "";
  if (!key) return null; // HUMAN GATE
  const url = "https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_C_ADSIDO_INFO"
    + `&key=${key}&geomFilter=BOX(124,33,132,39)&crs=EPSG:4326&format=json&size=20&geometry=true&attribute=true`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { response?: { result?: { featureCollection?: { features?: unknown[] } } } };
    const feats = j?.response?.result?.featureCollection?.features;
    if (!Array.isArray(feats)) return null;
    const out: SidoBoundary[] = [];
    for (const f0 of feats) {
      const f = f0 as { properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown } };
      const sido = typeof f.properties?.ctp_kor_nm === "string" ? f.properties.ctp_kor_nm : "";
      const g = f.geometry;
      if (!sido || !g) continue;
      // MultiPolygon coords: [ [ [ [lng,lat],... ] ] ] · Polygon: [ [ [lng,lat],... ] ] — 외곽 ring(poly[0])만 색칠용.
      const polys = g.type === "MultiPolygon" ? (g.coordinates as unknown[]) : g.type === "Polygon" ? [g.coordinates] : [];
      const rings: [number, number][][] = [];
      for (const poly of polys) {
        const outer = Array.isArray(poly) ? (poly as unknown[])[0] : null;
        const ring = simplifyRing(outer);
        if (ring.length >= 4) rings.push(ring);
      }
      if (rings.length) out.push({ sido, rings });
    }
    if (!out.length) return null;
    CACHE = out;
    return out;
  } catch {
    return null;
  }
}

/** 테스트 전용 — 캐시 초기화. */
export function __resetSidoCache(): void { CACHE = null; }
