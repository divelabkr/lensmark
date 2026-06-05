import type { CostSimulation, IncomeSimulation, RevenueSimulation, YieldSimulation } from "../types";
import { subtractIndependent } from "./uncertainty";

export function simulateIncome(
  revenue: RevenueSimulation,
  cost: CostSimulation,
  yieldResult: YieldSimulation
): IncomeSimulation {
  const incomeKrw = subtractIndependent(revenue.revenueKrw, cost.costKrw);

  const breakEvenPriceKrwPerKg =
    yieldResult.yieldKg.p50 > 0 ? Math.round(cost.costKrw.p50 / yieldResult.yieldKg.p50) : 0;

  const warnings: string[] = [];
  if (incomeKrw.p10 < 0) warnings.push("보수 시나리오(P10)에서는 손실 가능성이 있습니다.");
  if (incomeKrw.p50 < 0) warnings.push("기준 시나리오(P50)에서도 손실 가능성이 있습니다.");
  if (breakEvenPriceKrwPerKg > 0) {
    warnings.push(`손익분기 판매단가는 약 ${breakEvenPriceKrwPerKg.toLocaleString()}원/kg입니다.`);
  }
  warnings.push("소득 범위는 매출·비용을 독립으로 가정한 근사치이며, 단일 확정값이 아닙니다.");

  return { incomeKrw, breakEvenPriceKrwPerKg, warnings };
}
