import type { ProviderBundle } from "./types";
import { mockProviders } from "./mock";
import { liveProviders } from "./live";
import { RDA_REAL_META } from "../rdaIncome.real"; // 실 RDA 적재 메타 — health rdaIncome 표시를 빌드 사실과 동기(낡은 하드코딩 금지)

/**
 * Drop-in provider — "API만 붙이면 바로 운영".
 *  - 통합별로 키가 있으면 live 시도, 실패(미구현·네트워크·null)하면 mock으로 폴백 → 크래시 없음.
 *  - 키가 없으면 곧장 mock. 키를 하나씩 추가할 때마다 그 통합만 점진적으로 운영 전환된다.
 *  - DEM(VWorld 3D)·climate(KMA ASOS)는 응답 파싱이 docs-미확인이라 현재 live가 throw → 자동 mock 폴백.
 */
const has = (...names: string[]) => names.every((n) => !!process.env[n]);

async function pick<T>(useLive: boolean, live: () => Promise<T>, mock: () => Promise<T>, ok?: (v: T) => boolean): Promise<T> {
  if (useLive) {
    try { const v = await live(); if (!ok || ok(v)) return v; } catch { /* live 실패 → mock 폴백 */ }
  }
  return mock();
}

/* ── 응답 형태 가드 ──
 * live 파서가 깨지거나 빈/이상 응답을 주면 mock으로 폴백시켜 "조용한 오염"을 막는다.
 * (특히 climate/terrain/price는 엔진이 그대로 소비하므로, throw가 아니어도 형태가 어긋나면 폴백.) */
const fin = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
/** 기후: 겨울최저가 있거나 연강수가 합리범위(≥200mm)여야 채택 — 단기/부분 응답의 미세 연강수 오염 차단(레드팀 M5). */
export const okClimate = (v: any): boolean => !!v && (fin(v.minWinterTempC) || (fin(v.annualRainfallMm) && v.annualRainfallMm >= 200));
/** 지형: 경사·표고가 유한해야 채택. */
export const okTerrain = (v: any): boolean => !!v && fin(v.slopeDegree) && fin(v.altitudeM);
/** 가격: P50 단가가 유한·양수여야 채택. */
export const okPrice = (v: any): boolean => !!v && !!v.priceKrwPerKg && fin(v.priceKrwPerKg.p50) && v.priceKrwPerKg.p50 > 0;
/** 소매 주간: 평균가가 유한·양수여야 채택(미검증 작물은 live가 null → mock 폴백). */
export const okRetail = (v: any): boolean => !!v && fin(v.avg) && v.avg > 0;

export const autoProviders: ProviderBundle = {
  land: {
    // geocode/parcel은 "찾지 못함"(null/주소만)도 정상 응답이므로 형태가드 없이(throw 시에만 폴백).
    geocode: (q) => pick(has("VWORLD_API_KEY"), () => liveProviders.land.geocode(q), () => mockProviders.land.geocode(q)),
    climate: (loc) => pick(has("KMA_API_KEY"), () => liveProviders.land.climate(loc), () => mockProviders.land.climate(loc), okClimate),
    parcel: (loc) => pick(has("VWORLD_API_KEY"), () => liveProviders.land.parcel(loc), () => mockProviders.land.parcel(loc), (v) => v != null),
    terrain: (loc) => pick(has("VWORLD_API_KEY"), () => liveProviders.land.terrain(loc), () => mockProviders.land.terrain(loc), okTerrain),
  },
  price: {
    recentWholesale: (cropId) => pick(has("KAMIS_API_KEY", "KAMIS_API_ID"), () => liveProviders.price.recentWholesale(cropId), () => mockProviders.price.recentWholesale(cropId), okPrice),
    retailWeekly: (cropId) => pick(has("KAMIS_API_KEY", "KAMIS_API_ID"), () => liveProviders.price.retailWeekly(cropId), () => mockProviders.price.retailWeekly(cropId), okRetail),
  },
};

/** 통합별 운영 준비도(operator readiness) — /api/health 에 노출. */
export function integrationReadiness() {
  const k = (n: string) => !!process.env[n];
  const vworld = k("VWORLD_API_KEY");
  return {
    mode: (process.env.LANSMARK_DATA_MODE ?? "auto").toLowerCase(),
    integrations: {
      vworldTiles: { keyed: vworld, live: vworld, note: "WMTS 타일(키 있으면 live)" },
      vworldGeocode: { keyed: vworld, live: vworld, note: "주소→좌표/PNU(실구현)" },
      vworldParcel: { keyed: vworld, live: vworld, note: "필지경계 WFS(실구현)" },
      vworldDem: { keyed: vworld, live: false, note: "VWorld·국토지리정보원 모두 좌표→표고 REST 미제공(조사 완료) → mock 경사면. 정밀 표고는 외부 API(Google Elevation 등) 필요·무료베타는 mock 유지" },
      kmaClimate: { keyed: k("KMA_API_KEY"), live: k("KMA_API_KEY"), note: "ASOS 일자료 1년 집계(겨울최저·연강수·일조) — 실응답 형식 검증" },
      kamisPrice: { keyed: k("KAMIS_API_KEY") && k("KAMIS_API_ID"), live: k("KAMIS_API_KEY") && k("KAMIS_API_ID"), note: "원/kg(convert_kg_yn=Y) · 검증 품목(apple 등)만 live, 그 외 base 단가 폴백" },
      tossPayment: { keyed: k("TOSS_CLIENT_KEY") && k("TOSS_SECRET_KEY"), live: k("TOSS_CLIENT_KEY") && k("TOSS_SECRET_KEY"), note: "confirm+webhook 실구현(키 필요)" },
      pgWebhook: { keyed: k("PG_WEBHOOK_SECRET"), live: k("PG_WEBHOOK_SECRET"), note: "HMAC 서명검증" },
      // 실 RDA 적재 여부를 빌드 메타에서 동적으로 — v0.59 적재 후에도 '데모'로 표기되던 낡은 하드코딩 교정(반대방향 정직성 오류).
      rdaIncome: RDA_REAL_META
        ? { keyed: true, live: true, note: `실 농산물소득조사 ${RDA_REAL_META.baseYears.join(",")} · ${RDA_REAL_META.rows}작물${RDA_REAL_META.regions ? ` · 지역행 ${RDA_REAL_META.regions}` : ""}(미수록 작물은 데모 폴백)` }
        : { keyed: false, live: false, note: "base는 구조 데모(verified:false) — 실 RDA 소득자료 로더 연결 시 정상화" },
    },
  };
}
