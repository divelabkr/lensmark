import type { RevenueSimulation, SigmaRange, SimulationInput, YieldSimulation } from "../types";
import { getCropProfile } from "../data/crops.seed";
import { multiplyIndependent } from "./uncertainty";

function getPriceRange(input: SimulationInput): SigmaRange {
  if (input.userOverridePriceKrwPerKg !== undefined) {
    const v = input.userOverridePriceKrwPerKg;
    return { p10: v, p50: v, p90: v };
  }
  const crop = getCropProfile(input.cropId);
  const prices = crop.economics.priceKrwPerKg;
  if (input.salesChannel === "experience_farm" && prices.experience_farm) return prices.experience_farm;
  if (input.salesChannel === "processed" && prices.processed) return prices.processed;
  return prices[input.salesChannel] ?? prices.mixed;
}

export function simulateRevenue(input: SimulationInput, yieldResult: YieldSimulation): RevenueSimulation {
  const priceKrwPerKg = getPriceRange(input);
  const revenueKrw = multiplyIndependent(yieldResult.yieldKg, priceKrwPerKg);

  return {
    revenueKrw,
    priceKrwPerKg,
    salesChannel: input.salesChannel,
    assumptions: [
      "매출 범위는 수확량과 단가를 서로 독립으로 가정해 분산을 합산한 근사치입니다.",
      "실제 농산물은 수확량이 많을 때 가격이 낮아지는 경향(음의 상관)이 있어 낙관(P90)은 더 보수적일 수 있습니다.",
      "실제 판매가는 품질, 시기, 지역, 판로, 저장성, 브랜드에 따라 변동됩니다.",
    ],
  };
}
