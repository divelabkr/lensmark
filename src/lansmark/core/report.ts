import type { LansmarkSimulationResult, SigmaRange } from "../types";

export interface ReportSection { heading: string; rows: { label: string; value: string }[]; notes?: string[]; }
export interface ReportModel { title: string; subtitle: string; generatedAt: string; confidence: string; sections: ReportSection[]; disclaimers: string[]; }

const krw = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const kg = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}kg`;
const range = (r: SigmaRange, f: (n: number) => string) => `${f(r.p10)} / ${f(r.p50)} / ${f(r.p90)}`;

export function buildReportModel(result: LansmarkSimulationResult, areaM2: number, addr?: string): ReportModel {
  return {
    title: `${result.candidate.cropNameKo} 수확·소득 시뮬레이션 리포트`,
    subtitle: `${addr ?? "토지"} · ${Math.round(areaM2).toLocaleString("ko-KR")}㎡ · 혼합판매·성목 기준`,
    generatedAt: new Date().toISOString().slice(0, 10),
    confidence: result.confidence,
    sections: [
      { heading: "예상 결과 (P10 / P50 / P90)", rows: [
        { label: "예상 수확량", value: range(result.yield.yieldKg, kg) },
        { label: "예상 비용", value: range(result.cost.costKrw, krw) },
        { label: "예상 매출", value: range(result.revenue.revenueKrw, krw) },
        { label: "예상 소득", value: range(result.income.incomeKrw, krw) },
        { label: "손익분기 단가", value: `${result.income.breakEvenPriceKrwPerKg.toLocaleString("ko-KR")}원/kg` },
      ] },
      { heading: "비용 구성", rows: result.cost.lineItems.map((li) => ({ label: li.label, value: krw(li.value.p50) })) },
      { heading: "생육 리스크", rows: [
        { label: "기상", value: result.growthRisk.weatherRisks.join(", ") || "-" },
        { label: "병해충", value: result.growthRisk.pestRisks.join(", ") || "-" },
        { label: "재난", value: result.growthRisk.disasterRisks.join(", ") || "-" },
      ] },
      { heading: "다음 확인 항목", rows: result.nextActions.map((a, i) => ({ label: `${i + 1}`, value: a })) },
    ],
    disclaimers: result.disclaimers,
  };
}
