import type { LansmarkSimulationResult } from "../types";

function krw(value: number) {
  return `${Math.round(value).toLocaleString()}원`;
}

function kg(value: number) {
  return `${Math.round(value).toLocaleString()}kg`;
}

export function SimulationSummaryTable({ result }: { result: LansmarkSimulationResult }) {
  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-xl font-semibold">{result.candidate.cropNameKo} 시뮬레이션</h2>
      <p className="text-sm text-gray-600">신뢰도: {result.confidence}</p>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border p-2">구분</th>
            <th className="border p-2">보수 P10</th>
            <th className="border p-2">기준 P50</th>
            <th className="border p-2">낙관 P90</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">예상 수확량</td>
            <td className="border p-2">{kg(result.yield.yieldKg.p10)}</td>
            <td className="border p-2">{kg(result.yield.yieldKg.p50)}</td>
            <td className="border p-2">{kg(result.yield.yieldKg.p90)}</td>
          </tr>
          <tr>
            <td className="border p-2">예상 비용</td>
            <td className="border p-2">{krw(result.cost.costKrw.p10)}</td>
            <td className="border p-2">{krw(result.cost.costKrw.p50)}</td>
            <td className="border p-2">{krw(result.cost.costKrw.p90)}</td>
          </tr>
          <tr>
            <td className="border p-2">예상 매출</td>
            <td className="border p-2">{krw(result.revenue.revenueKrw.p10)}</td>
            <td className="border p-2">{krw(result.revenue.revenueKrw.p50)}</td>
            <td className="border p-2">{krw(result.revenue.revenueKrw.p90)}</td>
          </tr>
          <tr>
            <td className="border p-2">예상 소득</td>
            <td className="border p-2">{krw(result.income.incomeKrw.p10)}</td>
            <td className="border p-2">{krw(result.income.incomeKrw.p50)}</td>
            <td className="border p-2">{krw(result.income.incomeKrw.p90)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
