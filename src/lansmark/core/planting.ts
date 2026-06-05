import type { PlantingCalculation, SigmaRange, SimulationInput } from "../types";
import { getCropProfile } from "../data/crops.seed";

function multiplyRange(range: SigmaRange, factor: number): SigmaRange {
  return {
    p10: Math.round(range.p10 * factor),
    p50: Math.round(range.p50 * factor),
    p90: Math.round(range.p90 * factor),
  };
}

export function calculatePlanting(input: SimulationInput): PlantingCalculation {
  const crop = getCropProfile(input.cropId);
  const estimatedPlantingCount = multiplyRange(crop.economics.plantingDensityPerM2, input.land.areaM2);
  const selectedPlantingCount = input.userPlantingCount ?? estimatedPlantingCount.p50;

  const assumptions = [
    "작물별 일반 식재 밀도 기준을 사용했습니다.",
    "실제 식재량은 품종, 통로, 이랑, 기계화 여부에 따라 달라질 수 있습니다.",
  ];

  // M1: 사용자 식재량이 권장 범위(P10~P90)를 벗어나면 안내.
  // (식재 밀도를 수확량 모델에 직접 곱하지는 않는다 = 면적 기반 수확량과의 이중계산 방지)
  if (
    input.userPlantingCount !== undefined &&
    (selectedPlantingCount < estimatedPlantingCount.p10 || selectedPlantingCount > estimatedPlantingCount.p90)
  ) {
    assumptions.push(
      "입력 식재량이 권장 밀도 범위를 벗어납니다. 식재 밀도는 수확량·품질에 영향을 줄 수 있어 별도 검토가 필요합니다."
    );
  }

  return { areaM2: input.land.areaM2, estimatedPlantingCount, selectedPlantingCount, assumptions };
}
