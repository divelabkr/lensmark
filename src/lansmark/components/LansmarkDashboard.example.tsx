"use client";
/**
 * 프로덕션 대시보드 (드롭인). 실제 API(client.ts) 호출.
 * 경로 예: app/lansmark/page.tsx 또는 components/LansmarkDashboard.tsx
 * entitlementToken: 결제 성공 후 서버가 발급(mintEntitlementToken)한 토큰을 주입.
 */
import { useState } from "react";
import {
  callFreeCandidates,
  callPaidSimulation,
  LansmarkApiError,
} from "../client";
import type {
  CropCandidateResult,
  LandInput,
  LansmarkSimulationResult,
  SimulationInput,
} from "../types";

type Step = "input" | "candidates" | "result";

export function LansmarkDashboard({ entitlementToken }: { entitlementToken: string }) {
  const [step, setStep] = useState<Step>("input");
  const [land, setLand] = useState<LandInput>({
    areaM2: 3300,
    drainage: "normal",
    waterAccess: "available",
    laborLevel: "medium",
    soilEvidence: { source: "none" },
  });
  const [candidates, setCandidates] = useState<CropCandidateResult[]>([]);
  const [result, setResult] = useState<LansmarkSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadCandidates() {
    setLoading(true); setError(null);
    try {
      const res = await callFreeCandidates(land, 5);
      setCandidates(res.candidates);
      setStep("candidates");
    } catch (e) {
      setError(e instanceof LansmarkApiError ? e.message : "요청 실패");
    } finally { setLoading(false); }
  }

  async function runSimulation(cropId: string) {
    setLoading(true); setError(null);
    const input: SimulationInput = {
      land, cropId, cultivationType: "open_field", salesChannel: "mixed", targetYear: "mature",
    };
    try {
      const res = await callPaidSimulation(input, entitlementToken);
      setResult(res.result);
      setStep("result");
    } catch (e) {
      // 402/403 → 결제/권한 흐름으로 유도
      setError(e instanceof LansmarkApiError ? `(${e.status}) ${e.message}` : "시뮬레이션 실패");
    } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">LANSMARK</h1>
      <p className="text-sm text-gray-600">추천하지 않습니다. 범위를 보여줍니다.</p>
      {error && <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {step === "input" && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">면적(㎡)
            <input type="number" className="mt-1 w-full rounded border p-2" value={land.areaM2}
              onChange={(e) => setLand({ ...land, areaM2: Number(e.target.value) })} />
          </label>
          {/* 배수/관수/노동/토양검정서 select 등 추가 */}
          <button disabled={loading} onClick={loadCandidates}
            className="rounded-lg bg-green-700 px-4 py-2 text-white">무료 후보 보기</button>
        </div>
      )}

      {step === "candidates" && (
        <div className="mt-4 grid gap-3">
          {candidates.map((c) => (
            <article key={c.cropId} className="rounded-xl border p-4">
              <h3 className="font-semibold">{c.cropNameKo}</h3>
              <p className="text-sm text-gray-600">적합 {c.suitability} · 신뢰도 {c.confidence} · 점수 {c.score}</p>
              <button disabled={loading} onClick={() => runSimulation(c.cropId)}
                className="mt-2 rounded border px-3 py-1 text-sm">수확·소득 시뮬레이션</button>
            </article>
          ))}
        </div>
      )}

      {step === "result" && result && (
        <div className="mt-4 rounded-xl border p-4">
          <h2 className="text-xl font-semibold">{result.candidate.cropNameKo} · 신뢰도 {result.confidence}</h2>
          {(["yield", "cost", "revenue", "income"] as const).map((k) => {
            const r = k === "yield" ? result.yield.yieldKg
              : k === "cost" ? result.cost.costKrw
              : k === "revenue" ? result.revenue.revenueKrw
              : result.income.incomeKrw;
            const label = { yield: "예상 수확량(kg)", cost: "예상 비용(원)", revenue: "예상 매출(원)", income: "예상 소득(원)" }[k];
            return (
              <div key={k} className="mt-2 text-sm">
                <span className="font-medium">{label}</span>: {r.p10.toLocaleString()} / {r.p50.toLocaleString()} / {r.p90.toLocaleString()}
              </div>
            );
          })}
          <ul className="mt-3 list-disc pl-5 text-xs text-gray-600">
            {result.disclaimers.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
