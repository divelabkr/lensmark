import type { SigmaRange } from "../../types";
import type { ParcelGeo } from "../../geo/types";
import type { TerrainInput } from "../../core/terrain";

export interface GeocodeResult {
  address?: string;
  pnu?: string;
  lat?: number;
  lng?: number;
}
export interface ClimateResult {
  altitudeM?: number;
  annualRainfallMm?: number;
  annualMeanTempC?: number;   // 연평균기온(℃) — 일평균기온 평균(실측). 작물 생육적온 맥락의 1차 근거
  growingDegreeDays?: number; // 적산온도 GDD(℃·일) — 생육기(4~10월) 일평균이 base(10℃) 초과분 누적(실측·표준 농업기후 지표)
  minWinterTempC?: number;
  summerMaxTempC?: number;   // 여름 최고기온(℃, 폭염기 일최고 수준) — 고온 스트레스·온난화 평가용(없으면 미평가)
  frostRisk?: "low" | "medium" | "high" | "unknown";
  sunlightLevel?: "low" | "medium" | "high" | "unknown";
  stationName?: string;      // 출처 관측소명(예: "전주") — 근거의 출처·정직성 표기용(최근접 ASOS)
}
export interface PriceResult {
  priceKrwPerKg: SigmaRange;
  source: string;
}
/** 마트 소매가(소비자 물가) 주간 통계 — 1kg당 최저·평균·최고(원). 도매가(농가 수취)와 구분되는 '소비자 체감 시세'. */
export interface RetailWeekly {
  min: number;
  avg: number;
  max: number;
  samples: number;   // 집계 표본 일수(주간)
  source: string;
}

/** 주소→좌표/PNU (VWorld), 좌표→기후 (KMA) */
export interface LandContextProvider {
  geocode(query: { address?: string; lat?: number; lng?: number }): Promise<GeocodeResult>;
  climate(loc: { lat: number; lng: number }): Promise<ClimateResult>;
  /** 좌표 → 필지경계 (VWorld 데이터 API) */
  parcel(loc: { lat: number; lng: number }): Promise<ParcelGeo | null>;
  /** 좌표 → 지형(경사/향/표고) (VWorld DEM → core/terrain 입력형) */
  terrain(loc: { lat: number; lng: number }): Promise<TerrainInput | null>;
}
/** 도매가 (KAMIS/aT) */
export interface PriceProvider {
  recentWholesale(cropId: string): Promise<PriceResult | null>;
  /** 마트 소매가(소비자 물가) 주간 min~평균~max(원/kg) — KAMIS 소매(p_productclscode=01). 미지원 작물/오류면 null. */
  retailWeekly(cropId: string): Promise<RetailWeekly | null>;
}

export interface ProviderBundle {
  land: LandContextProvider;
  price: PriceProvider;
}
