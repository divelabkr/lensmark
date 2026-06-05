import type { CropProfile, LandInput, CultivationType } from "../types";
import { getCropProfile } from "../data/crops.seed";
import { heatToleranceOf } from "../data/cropClimateTraits";
import type { ClimateResult } from "../data/providers/types";
import { terrainFactors, type Factor, type TerrainInput } from "./terrain";
import { satelliteFactors, type SatelliteObs } from "./satellite";

const isFruit = (c: CropProfile) => c.category === "fruit";

export function soilFactors(cropId: string, land: LandInput): Factor[] {
  const c = getCropProfile(cropId);
  const out: Factor[] = [];
  const soil = land.soilEvidence;
  if (soil && soil.ph != null && c.requirements.phMin != null && c.requirements.phMax != null) {
    const { phMin, phMax } = c.requirements;
    const dev = Math.max(0, Math.abs(soil.ph - (phMin + phMax) / 2) - (phMax - phMin) / 2);
    let yf = 1.0, reason = `토양 pH ${soil.ph} — 적정범위(${phMin}~${phMax}) 내`;
    if (dev > 0 && dev <= 0.5) { yf = isFruit(c) ? 0.92 : 0.95; reason = `토양 pH ${soil.ph} — 적정범위 소폭 이탈`; }
    else if (dev > 0.5) { yf = isFruit(c) ? 0.75 : 0.85; reason = `토양 pH ${soil.ph} — 적정범위 크게 이탈`; }
    out.push({ axis: "토양·pH", target: "yield", value: yf, reason });
  }
  const need = c.requirements.drainage;
  if (land.drainage === "poor") {
    const yf = need === "high" ? (isFruit(c) ? 0.6 : 0.7) : 0.85;
    out.push({ axis: "토양·배수", target: "yield", value: yf, reason: "배수 불량 — 습해/품질 저하 리스크" });
  } else if (land.drainage === "good") {
    out.push({ axis: "토양·배수", target: "yield", value: 1.0, reason: "배수 양호" });
  }
  return out;
}

export function climateFactors(cropId: string, climate?: ClimateResult): Factor[] {
  if (!climate) return [];
  const c = getCropProfile(cropId);
  const out: Factor[] = [];
  const coldThreshold: Record<string, number> = { high: -15, medium: -8, low: -3 };
  const thr = coldThreshold[c.requirements.coldTolerance ?? "medium"] ?? -8;
  if (climate.minWinterTempC != null) {
    if (climate.minWinterTempC < thr - 3) out.push({ axis: "기후·내한", target: "yield", value: 0.85, reason: `지역 최저기온 ${climate.minWinterTempC}℃ < 작물 내한한계(~${thr}℃) — 동해/조건부` });
    else if (climate.minWinterTempC < thr) out.push({ axis: "기후·내한", target: "yield", value: 0.92, reason: `지역 최저기온 ${climate.minWinterTempC}℃ — 내한 경계` });
  }
  if (climate.frostRisk === "high" && c.requirements.frostSensitivity === "high") {
    out.push({ axis: "기후·서리", target: "yield", value: 0.9, reason: "서리위험 높음 + 서리민감 작물 — 개화기 저온 리스크" });
  }
  if (climate.annualRainfallMm != null && climate.annualRainfallMm < 1100 && c.requirements.waterNeed === "high") {
    out.push({ axis: "기후·강수", target: "yield", value: 0.85, reason: `연강수 ${climate.annualRainfallMm}mm — 물 요구 큰 작물엔 부족` });
  }
  // 고온 스트레스: 여름최고 vs 내서성. 온난화로 여름최고↑(applyWarming) → 냉량성 작물 페널티 자동 증가(온난화의 '지는' 면).
  const sm = climate.summerMaxTempC;
  if (sm != null) {
    const heatThr = heatToleranceOf(cropId) === "low" ? 30 : heatToleranceOf(cropId) === "medium" ? 33 : 36;
    if (sm > heatThr) {
      const v = Math.max(0.75, Math.round((1 - 0.03 * (sm - heatThr)) * 1000) / 1000); // 임계 초과 1℃당 -3%, 바닥 0.75
      out.push({ axis: "기후·고온", target: "yield", value: v, reason: `여름 최고 ${Math.round(sm)}℃ > 내서성 한계(~${heatThr}℃) — 고온 스트레스(데모·미검증)` });
    }
  }
  return out;
}

/**
 * 시설(비닐하우스/스마트팜) 재배 보정 — 재배유형 + 지역 겨울최저(난방) + 온난화 ΔT(냉방).
 *   왜 yield↑ & cost↑: 환경제어로 수량↑이지만 난방·전기·양액·관리로 운영비↑ → 시설이 항상 이득은 아님(보장 금지 정합).
 *   '냉난방 비용의 엄청난 차이' 주동인 = 지역 겨울최저: 추운 지역(강원 −12℃)일수록 난방비↑(제주 +2℃ ≪).
 *     온난화는 winterTemp↑로 난방분↓, 여름 더위로 냉방분↑. ※ climate는 parcelSimulator가 이미 온난화 적용(applyWarming)한 값.
 *   ⚠ 데이터 정직성(CLAUDE.md #4): 배율·난방계수는 작물-무관 '데모 근사'(verified 아님). 근거: 시설원예 난방비=경영비의 30~40%(2025 참고). 실 RDA 시설소득자료로 교체(TODO).
 *   범위: 출하시기 프리미엄(price↑)은 시기·시장 의존이라 미반영(엔진은 yield/cost 팩터만 — 별도 seam).
 */
export function facilityFactors(cultivationType?: CultivationType, climate?: ClimateResult, deltaC = 0): Factor[] {
  if (cultivationType !== "greenhouse" && cultivationType !== "semi_facility") return []; // 노지/미지정 → 보정 없음
  const isGreen = cultivationType === "greenhouse";
  const baseStruct = isGreen ? 1.3 : 1.15;                                      // 구조·인건 기저(난방 제외)
  // 난방분: 겨울최저 5℃ 미만부터 1℃당 +0.02(상한 0.5). climate 없으면 보수 기본(온실 0.2/반시설 0.1) → 무climate 후방호환(온실 cost 1.5/반시설 1.2).
  const winter = climate?.minWinterTempC;
  const heat = winter != null ? Math.max(0, Math.min(0.5, 0.02 * Math.max(0, 5 - winter))) : (isGreen ? 0.2 : 0.1);
  const heatShare = isGreen ? heat : heat * 0.5;                                // 반시설은 난방 부담 작음
  // 냉방분 < 난방절감(한국 시설은 난방 우세) → 한랭지는 온난화 시 순 운영비 절감. 냉방계수 보수적.
  const cooling = 0.012 * Math.max(0, deltaC);                                  // 여름 더위 — 환기·냉방(ΔT 비례)
  const cost = Math.round((baseStruct + heatShare + cooling) * 1000) / 1000;
  const note = `시설 운영비(난방=지역 겨울최저${winter != null ? ` ${Math.round(winter)}℃` : ""} 연동${deltaC > 0 ? ` · 온난화 +${deltaC}℃ 난방↓·냉방↑` : ""}) — 난방비 경영비의 30~40%(2025 참고·미검증)`;
  return [
    { axis: "시설·환경제어", target: "yield", value: isGreen ? 1.3 : 1.12, reason: isGreen ? "시설(온실) — 환경제어로 수량·재배안정 향상(데모·미검증)" : "반시설(비가림 등) — 기상 리스크 일부 완화(데모·미검증)" },
    { axis: "시설·운영비", target: "cost", value: cost, reason: note },
  ];
}

export interface FactorContext { terrain?: TerrainInput; climate?: ClimateResult; satellite?: SatelliteObs; cultivationType?: CultivationType; warmingDeltaC?: number; }
export interface FactorBundle { yieldFactors: Factor[]; costFactors: Factor[]; all: Factor[]; satelliteConfidenceBoost: boolean; }

export function collectFactors(cropId: string, land: LandInput, ctx: FactorContext): FactorBundle {
  const sat = satelliteFactors(cropId, ctx.satellite);
  const all: Factor[] = [
    ...terrainFactors(cropId, ctx.terrain),
    ...soilFactors(cropId, land),
    ...climateFactors(cropId, ctx.climate), // ctx.climate=온난화 적용 기후(parcelSimulator) → 저온·서리 완화 + 고온 스트레스 자동
    ...facilityFactors(ctx.cultivationType, ctx.climate, ctx.warmingDeltaC), // 시설 수량↑·운영비↑(난방=지역×온난화)
    ...sat.factors,
  ];
  return {
    yieldFactors: all.filter((f) => f.target === "yield"),
    costFactors: all.filter((f) => f.target === "cost"),
    all,
    satelliteConfidenceBoost: sat.confidenceBoost,
  };
}
