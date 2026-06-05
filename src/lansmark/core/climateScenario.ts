/**
 * 지구온난화 시나리오 primitive — ΔT(온난화 폭) 하나로 재배 적합·소득·시설 냉난방비를 구동.
 *   책임: 시나리오(연도+배출경로 또는 직접 ΔT) → 온난화 폭 ΔT(℃) 산출 + 평년 기후에 ΔT 적용(순수·결정적).
 *   ⚠ 데이터 정직성(CLAUDE.md #4): 온난화율·강수율은 기상청 「한반도 기후변화 전망보고서」·IPCC AR6(동아시아 강수↑) '근사·demo'(verified:false·외삽).
 *      선형 단순화(실제는 비선형·지역차 큼 → KMA 격자 연동 seam).
 *   범위: 겨울최저·여름최고 ΔT 이동 + 연강수 소폭↑ — 저온/서리 완화·고온 스트레스↑·건조 완화를 기존 climateFactors/fieldMonitor가 자동 처리.
 *         ⚠ 강수 '변동성↑'(집중호우·가뭄 양극화)은 불확실이라 결정적 팩터화 안 함 — 리스크 노트로만(면책). 일조는 불변.
 */
import type { ClimateResult } from "../data/providers/types";
import type { EmissionPath, WarmingScenario } from "../types";

export const BASELINE_YEAR = 2025;          // 현재 평년 기준연도(ΔT=0)
const MAX_DELTA_C = 6;                       // 외삽 상한(과신 차단 — 보장 금지 가드레일)
// 경로별 온난화율(℃/10년) — KMA SSP 전망 근사(demo·verified:false). 선형 가정.
//   ★ live-upgrade seam(HUMAN GATE): 실측 KMA SSP 시나리오 격자(연도·지역별 ΔT·강수)를 받으면 이 선형 demo 율·warmingRainPct를
//     격자 조회로 교체 → 지역차·비선형 정밀화. 기상청 기후정보포털 API 키·활용신청 필요(추측 금지). 그때까지 선형 근사 유지.
const RATE_C_PER_DECADE: Record<EmissionPath, number> = { ssp245: 0.30, ssp585: 0.60 };

/** 시나리오 → 온난화 폭 ΔT(℃). override 유한하면 우선, 아니면 경로율 × (연도−2025)/10. [0, 6] 클램프. */
export function warmingDeltaC(s?: WarmingScenario): number {
  if (!s) return 0;
  if (typeof s.deltaTempCOverride === "number" && Number.isFinite(s.deltaTempCOverride)) {
    return clamp(s.deltaTempCOverride);
  }
  const year = typeof s.year === "number" && Number.isFinite(s.year) ? s.year : BASELINE_YEAR;
  const rate = RATE_C_PER_DECADE[s.path ?? "ssp245"] ?? RATE_C_PER_DECADE.ssp245;
  return clamp((rate * Math.max(0, year - BASELINE_YEAR)) / 10);
}
const clamp = (x: number): number => Math.max(0, Math.min(MAX_DELTA_C, Math.round(x * 10) / 10)); // 0.1℃ 단위

/** 온난화 → 연강수 변화율(소폭↑). KMA/IPCC 동아시아 강수↑ 근사: ℃당 +1.5%, 상한 +12%(demo·verified:false·불확실). */
export function warmingRainPct(deltaC: number): number {
  return Math.max(0, Math.min(0.12, Math.round(0.015 * Math.max(0, deltaC) * 1000) / 1000));
}

/** 서리위험 한 단계 완화(온난화). */
const FROST_DOWN: Record<NonNullable<ClimateResult["frostRisk"]>, ClimateResult["frostRisk"]> =
  { high: "medium", medium: "low", low: "low", unknown: "unknown" };

/**
 * 평년 기후에 온난화 ΔT 적용(순수). 겨울최저·여름최고 + ΔT, 연강수 소폭↑(warmingRainPct), ΔT≥2.5마다 서리위험 완화.
 *   강수 변동성(집중호우·가뭄)은 미반영(리스크 노트). 일조 불변. ΔT≤0이면 원본 그대로.
 */
export function applyWarming(climate: ClimateResult, deltaC: number): ClimateResult {
  if (!(deltaC > 0)) return climate;
  const out: ClimateResult = { ...climate };
  if (climate.minWinterTempC != null) out.minWinterTempC = Math.round((climate.minWinterTempC + deltaC) * 10) / 10;
  if (climate.summerMaxTempC != null) out.summerMaxTempC = Math.round((climate.summerMaxTempC + deltaC) * 10) / 10; // 여름도 더워짐 → 고온 스트레스↑
  if (climate.annualRainfallMm != null) out.annualRainfallMm = Math.round(climate.annualRainfallMm * (1 + warmingRainPct(deltaC))); // 연강수 소폭↑(변동성은 별도 리스크)
  const steps = Math.floor(deltaC / 2.5);
  if (steps > 0 && climate.frostRisk) {
    let fr = climate.frostRisk;
    for (let i = 0; i < steps; i++) fr = FROST_DOWN[fr ?? "unknown"] ?? fr;
    out.frostRisk = fr;
  }
  return out;
}
