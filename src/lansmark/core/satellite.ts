import { getCropProfile } from "../data/crops.seed";
import type { Factor } from "./terrain";

export interface SatelliteObs {
  observed: boolean;
  ndviRelative?: "low" | "similar" | "high"; // 주변 동일작물 대비 식생활력
  frostPocket?: boolean;                      // thermal 냉기정체
  waterlogging?: boolean;                     // SAR 과습
  source?: string;
}
export interface SatelliteResult { factors: Factor[]; confidenceBoost: boolean; }

/** ★ 실연동: Sentinel-2(NDVI)/Sentinel-1(SAR)/Landsat(thermal) 파이프라인이 이 obs를 채운다. */
export function satelliteFactors(cropId: string, sat?: SatelliteObs): SatelliteResult {
  if (!sat || !sat.observed) return { factors: [], confidenceBoost: false };
  const c = getCropProfile(cropId);
  const factors: Factor[] = [];
  if (sat.ndviRelative === "low") factors.push({ axis: "위성·NDVI", target: "yield", value: 0.9, reason: "위성 식생활력(NDVI) 주변 대비 낮음 — 생산력 하향" });
  else if (sat.ndviRelative === "high") factors.push({ axis: "위성·NDVI", target: "yield", value: 1.05, reason: "위성 식생활력(NDVI) 주변 대비 높음" });
  if (sat.frostPocket && c.requirements.frostSensitivity === "high") factors.push({ axis: "위성·thermal", target: "yield", value: 0.9, reason: "위성 지표온도 — 냉기정체(서리골), 서리민감 작물 하향" });
  if (sat.waterlogging) factors.push({ axis: "위성·SAR", target: "yield", value: 0.9, reason: "위성 레이더(SAR) — 과습/물고임 탐지" });
  // 신뢰도 상향(confidenceBoost)은 **신뢰 출처(서버 위성 파이프라인)**의 실제 신호가 있을 때만 — 클라이언트 토글로 등급 위조 차단(레드팀 M6).
  const trusted = sat.source === "sentinel" || sat.source === "server";
  return { factors, confidenceBoost: trusted && factors.length > 0 };
}
