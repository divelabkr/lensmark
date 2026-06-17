import { CROP_PROFILES } from "../data/crops.seed";
import type { CropCandidateResult, CropProfile, LandInput, SuitabilityLevel } from "../types";
import { getSoilConfidence } from "../policy/soilPolicy";
import { heatToleranceOf } from "../data/cropClimateTraits";
import type { ClimateResult } from "../data/providers/types";

function toLevel(score: number, conditional: boolean): SuitabilityLevel {
  if (conditional) return "conditional";
  if (score >= 80) return "high";
  if (score >= 65) return "medium_high";
  if (score >= 50) return "medium";
  if (score >= 35) return "conditional";
  return "low";
}

// 무료 추천에 기후 반영 — 유료 시뮬(core/factors.climateFactors)과 '동일 데이터 기준'을 점수델타로 옮긴 것.
//   목적: 무료 추천 ↔ 유료 시뮬의 근거 불일치(추천해놓고 시뮬에선 페널티) 모순 제거 + '🌤 기후 근거'를 정직하게.
//   임계값(내한·내서성·물요구·서리민감)은 모두 작물 데이터(requirements / cropClimateTraits) — 날조 없음.
function applyClimate(score: number, crop: CropProfile, climate: ClimateResult, reasons: string[], risks: string[]): number {
  const cold: Record<string, number> = { high: -15, medium: -8, low: -3 };
  const thr = cold[crop.requirements.coldTolerance ?? "medium"] ?? -8;
  if (climate.minWinterTempC != null) {
    if (climate.minWinterTempC < thr - 3) { score -= 18; risks.push(`겨울 최저 ${climate.minWinterTempC}℃ < 내한 한계(~${thr}℃) — 동해 위험`); }
    else if (climate.minWinterTempC < thr) { score -= 8; risks.push(`겨울 최저 ${climate.minWinterTempC}℃ — 내한 경계`); }
    else if (climate.frostRisk !== "high") reasons.push("지역 겨울기온이 작물 내한 범위 안입니다.");
  }
  if (climate.frostRisk === "high" && crop.requirements.frostSensitivity === "high") { score -= 8; risks.push("서리위험 높음 + 서리민감 작물 — 개화기 저온 리스크"); }
  if (climate.annualRainfallMm != null && climate.annualRainfallMm < 1100 && crop.requirements.waterNeed === "high") { score -= 8; risks.push(`연강수 ${climate.annualRainfallMm}mm — 물 요구 큰 작물엔 부족(관수 필요)`); }
  if (climate.summerMaxTempC != null) {
    const ht = heatToleranceOf(crop.cropId) === "low" ? 30 : heatToleranceOf(crop.cropId) === "medium" ? 33 : 36;
    if (climate.summerMaxTempC > ht) { score -= 8; risks.push(`여름 최고 ${Math.round(climate.summerMaxTempC)}℃ > 내서성(~${ht}℃) — 고온 스트레스`); }
  }
  return score;
}

function scoreCrop(land: LandInput, crop: CropProfile, climate?: ClimateResult): CropCandidateResult {
  let score = 50;
  const reasons: string[] = [];
  const risks: string[] = [];
  const requiredChecks = [...crop.additionalChecks];
  const blockedBy: string[] = [];

  const soil = land.soilEvidence;
  const req = crop.requirements;

  if (soil?.ph !== undefined && req.phMin !== undefined && req.phMax !== undefined) {
    if (soil.ph >= req.phMin && soil.ph <= req.phMax) {
      score += 18;
      reasons.push("토양 pH가 작물 권장 범위에 가깝습니다.");
    } else {
      score -= 20;
      risks.push("토양 pH가 작물 권장 범위와 다릅니다.");
    }
  } else if (req.phMin !== undefined && req.phMax !== undefined) {
    score -= crop.category === "fruit" ? 12 : 5;
    risks.push("토양 pH 미확인으로 정밀 판단이 제한됩니다.");
    blockedBy.push("토양검정서 미제출");
  }

  if (land.drainage === "good") {
    score += req.drainage === "high" ? 12 : 5;
    reasons.push("배수 조건이 유리하게 입력되었습니다.");
  } else if (land.drainage === "poor") {
    score -= req.drainage === "high" ? 24 : 10;
    risks.push("배수 불량 가능성이 있습니다.");
  } else {
    risks.push("배수 상태 확인이 필요합니다.");
  }

  if (land.waterAccess === "available") {
    score += req.waterNeed === "high" ? 10 : 4;
    reasons.push("관수 가능성이 입력되었습니다.");
  } else if (req.waterNeed === "high") {
    score -= 15;
    risks.push("물 요구량이 큰 작물인데 관수 정보가 부족합니다.");
  }

  if (land.laborLevel === "low" && req.laborNeed === "high") {
    score -= 15;
    risks.push("노동력 수준 대비 관리·수확 부담이 큽니다.");
  }

  // 기후 반영을 먼저 — 위치별 기후 근거(위험)가 일반 작물 주의보다 우선 노출되게(risks.slice(0,5)에 살아남도록).
  if (climate) score = applyClimate(score, crop, climate, reasons, risks); // 유료 시뮬과 동일 기준 — 근거 일치

  crop.riskNotes.forEach((risk) => {
    if (!risks.includes(risk)) risks.push(risk);
  });

  if (reasons.length === 0) {
    reasons.push("현재 입력값 기준으로 1차 검토 대상입니다.");
  }

  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  const isConditional = blockedBy.length > 0 && crop.category === "fruit";

  return {
    cropId: crop.cropId,
    cropNameKo: crop.cropNameKo,
    suitability: toLevel(normalized, isConditional),
    score: normalized,
    confidence: getSoilConfidence(soil),
    cultivarDirections: crop.cultivarGroups,
    reasons: reasons.slice(0, 4),
    risks: risks.slice(0, 5),
    requiredChecks: Array.from(new Set(requiredChecks)).slice(0, 8),
    blockedBy: blockedBy.length ? blockedBy : undefined,
  };
}

export function rankCropCandidates(land: LandInput, limit = 5, climate?: ClimateResult): CropCandidateResult[] {
  return CROP_PROFILES
    .map((crop) => scoreCrop(land, crop, climate)) // climate 주면 기후 반영(무료↔유료 일치)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getCandidateForCrop(land: LandInput, cropId: string): CropCandidateResult {
  const crop = CROP_PROFILES.find((item) => item.cropId === cropId);
  if (!crop) throw new Error(`Unknown cropId: ${cropId}`);
  return scoreCrop(land, crop);
}
