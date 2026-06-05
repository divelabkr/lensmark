/**
 * 외래·임의 작물 조회(Phase B) — 키 없는 공개 API로 해외/일반 참고 정보 조립.
 *   소스(실연동·키 불필요): GBIF 생물분류(species/match) + 위키백과(ko) 요약.
 *   ★ seam: 정밀 재배 요구조건(Trefle/Perenual·키=HUMAN GATE)·실전 재배법(OpenFarm)은 추후.
 *   정직성 경계(CLAUDE.md #4·가드레일):
 *     - 국내 표준 재배자료가 없는 작물 → '참고 정보'로만 제시(출처 표기), 재배 성공/적합성 단정 금지.
 *     - ⚠ 소득 시뮬레이션 비활성(incomeSimAvailable=false) — 임의 작물은 엔진 economics 데이터가 없음(핵심 경계).
 *   조립(assemble)은 순수 함수(테스트 용이), fetch는 별도(네트워크).
 */
import { fetchJsonSafe } from "../geo/fetchSafe";

export interface ForeignTaxon {
  scientificName?: string; canonicalName?: string; rank?: string;
  family?: string; genus?: string; matchType?: string; confidence?: number; gbifKey?: number;
}
export interface ForeignDescription { title?: string; extract?: string; thumbnail?: string; source: string; }

/**
 * 기후대 적합성 — GBIF 관측 위도대(사실) vs 이 필지 위도/겨울최저(KMA, 사실)의 소프트 병치.
 *   ⚠ '재배 가능/불가' 단정이 아니다. 관측 위도대와 한국 위도의 겹침 여부 + 월동 온도 경고만 제시(가드레일: 재배 성공 보장 금지).
 */
export interface ForeignClimateFit {
  sampleN: number;                              // 관측 표본 수
  cropAbsLat: { p10: number; p50: number; p90: number }; // 작물 관측 |위도| 분포
  cropZone: string;                             // 열대/아열대/온대/냉온대
  parcelLat: number;
  parcelZone: string;
  overlap: boolean;                             // 필지 위도가 작물 관측대(p10~p90)에 포함
  signal: "similar" | "caution" | "neutral";
  note: string;
}

export interface ForeignCropInfo {
  query: string;
  resolved: boolean;            // GBIF 분류 매칭 성공 여부
  taxon?: ForeignTaxon;
  description?: ForeignDescription;
  climateFit?: ForeignClimateFit; // 필지(lat) 제공 + 매칭 성공 시 기후대 병치
  incomeSimAvailable: false;    // 항상 false — 임의 작물은 소득엔진 데이터 없음(정직 경계)
  sources: string[];
  disclaimer: string;
}

const zoneOf = (absLat: number): string => (absLat < 23.5 ? "열대" : absLat < 35 ? "아열대" : absLat < 50 ? "온대" : "냉온대");
const pctl = (sorted: number[], p: number): number => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/** 관측 위도 표본 + 필지 → 기후대 소프트 신호. 표본 10 미만이면 미제공(정직). */
export function assessForeignClimate(lats: number[], parcel: { lat: number; minWinterTempC?: number }): ForeignClimateFit | undefined {
  if (!parcel || !Number.isFinite(parcel.lat)) return undefined;
  const abs = lats.filter((n) => typeof n === "number" && Number.isFinite(n) && n >= -90 && n <= 90).map(Math.abs).sort((a, b) => a - b);
  if (abs.length < 10) return undefined; // 표본 부족 → 신호 미제공
  const p10 = Math.round(pctl(abs, 0.1)), p50 = Math.round(pctl(abs, 0.5)), p90 = Math.round(pctl(abs, 0.9));
  const pLat = Math.abs(parcel.lat);
  const overlap = pLat >= p10 && pLat <= p90;
  let signal: "similar" | "caution" | "neutral" = "neutral", note = "";
  if (overlap) { signal = "similar"; note = `관측 위도대(${p10}~${p90}°)가 이 필지(${Math.round(pLat)}°)와 겹침 — 기후대 유사. 다만 노지 재배 가능성은 품종·미기상·월동으로 별도 검증 필요.`; }
  else if (pLat > p90) { signal = "caution"; note = `이 작물은 주로 저위도(${zoneOf(p50)}, ${p10}~${p90}°) 분포 — 한국(${Math.round(pLat)}°) 노지 재배는 어려울 수 있어 시설 재배를 검토하세요.`; }
  else { note = `관측 위도대 ${p10}~${p90}°(${zoneOf(p50)}). 적합성은 별도 검증 필요.`; }
  if (parcel.minWinterTempC != null && Number.isFinite(parcel.minWinterTempC)) note += ` 이 필지 겨울 최저 ${Math.round(parcel.minWinterTempC)}℃ — 월동 가능 온도 확인 필수.`;
  return { sampleN: abs.length, cropAbsLat: { p10, p50, p90 }, cropZone: zoneOf(p50), parcelLat: Math.round(parcel.lat), parcelZone: zoneOf(pLat), overlap, signal, note };
}

const DISCLAIMER =
  "국내 표준 재배자료가 없는 작물의 해외/일반 참고 정보입니다. 국내 기후·토양 적합성과 재배 가능성은 별도 검증이 필요하며, 소득 시뮬레이션은 제공되지 않습니다. 재배 성공을 보장하지 않습니다.";

/** GBIF match + 위키 요약(원시 응답) + (선택) 기후대 평가 → ForeignCropInfo. 순수 함수. */
export function assembleForeignCrop(query: string, gbif: any, wiki: any, climateFit?: ForeignClimateFit): ForeignCropInfo {
  const matchType = gbif && typeof gbif.matchType === "string" ? gbif.matchType : undefined;
  const resolved = !!matchType && matchType !== "NONE";
  const taxon: ForeignTaxon | undefined = resolved
    ? { scientificName: gbif.scientificName, canonicalName: gbif.canonicalName, rank: gbif.rank, family: gbif.family, genus: gbif.genus, matchType, confidence: gbif.confidence, gbifKey: gbif.usageKey }
    : undefined;
  // 위키 요약: 모호페이지(disambiguation)/누락은 설명 생략.
  const extract = wiki && wiki.type === "standard" && typeof wiki.extract === "string" ? wiki.extract : undefined;
  const description: ForeignDescription | undefined = (extract || (wiki && wiki.type === "standard" && wiki.title))
    ? { title: wiki.title, extract: extract ? extract.slice(0, 600) : undefined, thumbnail: wiki?.thumbnail?.source, source: "위키백과(ko)" }
    : undefined;
  return {
    query, resolved, taxon, description, climateFit,
    incomeSimAvailable: false,
    sources: ["GBIF 생물분류(species match)", climateFit ? "GBIF 관측 분포(위도대)" : null, "위키백과(ko) 요약", "정밀 재배요구(Trefle/Perenual)·재배법(OpenFarm)은 연동 예정(seam)"].filter(Boolean) as string[],
    disclaimer: DISCLAIMER,
  };
}

/**
 * 작물명(국문/학명) → 해외 참고 정보. GBIF 분류 + 위키 병렬 조회(실패는 null 폴백).
 *   parcel(필지 위도/겨울최저) 제공 + GBIF 매칭 성공 시 → GBIF 관측 분포(위도)를 추가 조회해 기후대 적합성 평가.
 */
export async function fetchForeignCrop(query: string, parcel?: { lat: number; lng?: number; minWinterTempC?: number }): Promise<ForeignCropInfo> {
  const q = query.trim().slice(0, 80);
  const [gbif, wiki] = await Promise.all([
    fetchJsonSafe(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(q)}`),
    fetchJsonSafe(`https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`),
  ]);
  let climateFit: ForeignClimateFit | undefined;
  if (parcel && Number.isFinite(parcel.lat) && gbif && gbif.usageKey && gbif.matchType !== "NONE") {
    const occ = await fetchJsonSafe(`https://api.gbif.org/v1/occurrence/search?taxonKey=${gbif.usageKey}&hasCoordinate=true&limit=300`);
    const lats = Array.isArray(occ?.results) ? occ.results.map((r: any) => r.decimalLatitude) : [];
    climateFit = assessForeignClimate(lats, parcel);
  }
  return assembleForeignCrop(q, gbif, wiki, climateFit);
}
