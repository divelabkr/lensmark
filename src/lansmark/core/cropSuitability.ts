import { CROP_PROFILES } from "../data/crops.seed";
import type { CropCandidateResult, CropProfile, LandInput, SuitabilityLevel } from "../types";
import { getSoilConfidence } from "../policy/soilPolicy";

function toLevel(score: number, conditional: boolean): SuitabilityLevel {
  if (conditional) return "conditional";
  if (score >= 80) return "high";
  if (score >= 65) return "medium_high";
  if (score >= 50) return "medium";
  if (score >= 35) return "conditional";
  return "low";
}

function scoreCrop(land: LandInput, crop: CropProfile): CropCandidateResult {
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

export function rankCropCandidates(land: LandInput, limit = 5): CropCandidateResult[] {
  return CROP_PROFILES
    .map((crop) => scoreCrop(land, crop))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getCandidateForCrop(land: LandInput, cropId: string): CropCandidateResult {
  const crop = CROP_PROFILES.find((item) => item.cropId === cropId);
  if (!crop) throw new Error(`Unknown cropId: ${cropId}`);
  return scoreCrop(land, crop);
}
