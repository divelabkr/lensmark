import type { ConfidenceGrade, LansmarkSimulationResult, SimulationInput } from "../types";
import { getDefaultDisclaimers } from "../policy/disclaimer";
import { getSoilMissingFields } from "../policy/soilPolicy";
import { getCandidateForCrop } from "./cropSuitability";
import { calculatePlanting } from "./planting";
import { simulateYield } from "./yield";
import { simulateCost } from "./cost";
import { simulateRevenue } from "./revenue";
import { simulateIncome } from "./income";
import { buildGrowthRiskInfo } from "./growthRisk";

function worstConfidence(...grades: ConfidenceGrade[]): ConfidenceGrade {
  const order: ConfidenceGrade[] = ["A", "B", "C", "D", "X"];
  return grades.reduce((worst, grade) => {
    return order.indexOf(grade) > order.indexOf(worst) ? grade : worst;
  }, "A" as ConfidenceGrade);
}

export function runLansmarkSimulation(input: SimulationInput): LansmarkSimulationResult {
  if (!input.land.areaM2 || input.land.areaM2 <= 0) {
    throw new Error("land.areaM2 must be greater than 0");
  }

  const candidate = getCandidateForCrop(input.land, input.cropId);
  const planting = calculatePlanting(input);
  const yieldResult = simulateYield(input);
  const cost = simulateCost(input);
  const revenue = simulateRevenue(input, yieldResult);
  const income = simulateIncome(revenue, cost, yieldResult);
  const growthRisk = buildGrowthRiskInfo(input);

  const soilMissing = getSoilMissingFields(input.land.soilEvidence);

  const nextActions = [
    ...(soilMissing.length ? [`토양검정/누락 토양항목 확인: ${soilMissing.slice(0, 5).join(", ")}`] : []),
    "우기 후 배수 상태 사진 확보",
    "관수 가능 여부 확인",
    "지역 농업기술센터 또는 전문가 상담",
    "선택 작물의 실제 지역 재배 사례 확인",
    "판매 채널과 수매/직거래 가능성 확인",
  ];

  return {
    candidate,
    planting,
    yield: yieldResult,
    cost,
    revenue,
    income,
    growthRisk,
    confidence: worstConfidence(candidate.confidence, yieldResult.confidence),
    disclaimers: getDefaultDisclaimers(),
    nextActions: Array.from(new Set(nextActions)).slice(0, 8),
  };
}
