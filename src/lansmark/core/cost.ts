import type { CostSimulation, SigmaRange, SimulationInput } from "../types";
import { getCropProfile } from "../data/crops.seed";

function multiplyRange(range: SigmaRange, factor: number): SigmaRange {
  return {
    p10: Math.round(range.p10 * factor),
    p50: Math.round(range.p50 * factor),
    p90: Math.round(range.p90 * factor),
  };
}

const COST_LABELS: Record<string, string> = {
  seed_or_seedling: "종자/묘목",
  soil_amendment: "토양개량/비료",
  materials: "멀칭/자재",
  water: "관수/물관리",
  labor: "인건비/작업비",
  packaging_transport: "포장/운송",
};

export function simulateCost(input: SimulationInput): CostSimulation {
  const crop = getCropProfile(input.cropId);

  if (input.userOverrideCostKrw !== undefined) {
    const v = input.userOverrideCostKrw;
    const value = { p10: v, p50: v, p90: v };
    return {
      costKrw: value,
      lineItems: [{ key: "user_override", label: "사용자 입력 비용", value }],
      assumptions: ["사용자 입력 비용을 우선 적용했습니다."],
    };
  }

  const total = multiplyRange(crop.economics.costKrwPerM2, input.land.areaM2);

  // 원본 가중치 (합이 1이 아닐 수 있음)
  const rawFrac: Record<string, number> = {
    seed_or_seedling: crop.category === "fruit" ? 0.32 : 0.16,
    soil_amendment: crop.category === "fruit" ? 0.24 : 0.18,
    materials: 0.16,
    water: crop.requirements.waterNeed === "high" ? 0.18 : 0.08,
    labor: crop.requirements.laborNeed === "high" ? 0.28 : 0.18,
    packaging_transport: 0.1,
  };
  // 정규화: 세부 항목 합이 총비용과 일치하도록 보장 (H3 수정)
  const fracSum = Object.values(rawFrac).reduce((a, b) => a + b, 0) || 1;

  const lineItems = Object.entries(rawFrac).map(([key, frac]) => ({
    key,
    label: COST_LABELS[key] ?? key,
    value: multiplyRange(total, frac / fracSum),
  }));

  return {
    costKrw: total,
    lineItems,
    assumptions: [
      "작물별 기준 비용을 면적에 곱한 추정값입니다.",
      "세부 항목은 합이 총비용과 일치하도록 정규화되어 있습니다(반올림 오차 수원 단위).",
      "임대료, 시설 설치비, 장비 구매비는 별도 입력이 없으면 제한적으로만 반영됩니다.",
    ],
  };
}
