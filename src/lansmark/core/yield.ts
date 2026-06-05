import type { ConfidenceGrade, SigmaRange, SimulationInput, YieldSimulation } from "../types";
import { getCropProfile } from "../data/crops.seed";
import { getSoilConfidence } from "../policy/soilPolicy";

function multiplyRange(range: SigmaRange, factor: number): SigmaRange {
  return {
    p10: Math.max(0, Math.round(range.p10 * factor)),
    p50: Math.max(0, Math.round(range.p50 * factor)),
    p90: Math.max(0, Math.round(range.p90 * factor)),
  };
}

export function simulateYield(input: SimulationInput): YieldSimulation {
  const crop = getCropProfile(input.cropId);
  const targetYear = input.targetYear ?? "mature";
  const baseYield = crop.economics.yieldKgPerM2ByYear[targetYear] ?? crop.economics.yieldKgPerM2ByYear.mature;

  let factor = input.land.areaM2;
  let confidence: ConfidenceGrade = getSoilConfidence(input.land.soilEvidence);
  const adjustmentFactors: YieldSimulation["adjustmentFactors"] = [];

  const addFactor = (key: string, label: string, value: number, reason: string) => {
    factor *= value;
    adjustmentFactors.push({ key, label, factor: value, reason });
  };

  if (!input.land.soilEvidence || input.land.soilEvidence.source === "none") {
    addFactor("soil_missing", "토양검정서 미제출", crop.category === "fruit" ? 0.75 : 0.9, "토양 정보 부족으로 보수 계수를 적용했습니다.");
    confidence = "D";
  }

  if (input.land.drainage === "poor") {
    addFactor("poor_drainage", "배수 불량", crop.requirements.drainage === "high" ? 0.65 : 0.85, "배수 불량 리스크를 반영했습니다.");
  }

  if (input.land.waterAccess !== "available" && crop.requirements.waterNeed === "high") {
    addFactor("water_limited", "관수 제한", 0.75, "물 요구량이 큰 작물의 관수 리스크를 반영했습니다.");
  }

  if (input.land.laborLevel === "low" && crop.requirements.laborNeed === "high") {
    addFactor("labor_limited", "노동력 제한", 0.85, "관리·수확 노동 부족 가능성을 반영했습니다.");
  }

  return {
    yieldKg: multiplyRange(baseYield, factor),
    confidence,
    adjustmentFactors,
    assumptions: [
      "수확량은 단일값이 아니라 P10/P50/P90 범위입니다.",
      "P10은 보수적, P50은 기준, P90은 조건 양호 시나리오입니다.",
      "실제 결과는 품종, 토양, 날씨, 병해충, 재배기술에 따라 달라집니다.",
    ],
  };
}
