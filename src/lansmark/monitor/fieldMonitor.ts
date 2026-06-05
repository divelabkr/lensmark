/**
 * 일일 환경 모니터링(field-monitor) — Phase A: 지역 기후(KMA) vs 작물 요구조건 적합 점검.
 *   책임: 작물 + 지역 기후 요약(ClimateResult) → 강수·겨울최저기온·일조·서리 축의 적합 상태(순수·결정적).
 *   데이터 정직성(CLAUDE.md #4):
 *     - 기후 = KMA 연/계절 요약(provider, 키 있으면 live·없으면 mock). 작물 요구 = crops.seed 룰북.
 *     - ★ live-upgrade seam: 일일 실측·필지별 시계열·자동 알림(인앱/푸시)·미기상은 Phase B(수집 cron+인프라).
 *   가드레일: 재배 성공/수확 보장 금지 · '연/계절 요약'임을 명시(일일 실측 아님) · 면책.
 */
import { getCropProfile } from "../data/crops.seed";
import { heatToleranceOf } from "../data/cropClimateTraits";
import type { ClimateResult } from "../data/providers/types";

export type EnvStatus = "ok" | "watch" | "risk" | "unknown";
export interface EnvCheck {
  axis: string;        // rain | cold | sun | frost
  label: string;
  reading: string;     // 측정/요약 값(단위 포함)
  need: string;        // 작물 요구(라벨)
  status: EnvStatus;
  note: string;        // 대응/해석
}
export interface FieldMonitor {
  cropId: string;
  cropNameKo: string;
  checks: EnvCheck[];
  worst: EnvStatus;    // 가장 나쁜 축(risk>watch>ok>unknown)
  riskCount: number;
  sources: string[];
  disclaimer: string;
}

const LMH_KO: Record<"low" | "medium" | "high", string> = { low: "낮음", medium: "보통", high: "높음" };

/** 연강수량 vs 물 요구. */
function rainfallCheck(mm: number | undefined, need: "low" | "medium" | "high"): EnvCheck {
  const base = { axis: "rain", label: "연강수량", need: `물 요구 ${LMH_KO[need]}` };
  if (mm == null || !Number.isFinite(mm)) return { ...base, reading: "데이터 없음", status: "unknown", note: "KMA 강수 자료 없음" };
  const reading = `${Math.round(mm)}mm/년`;
  let status: EnvStatus = "ok", note = "작물 물 요구에 부합";
  if (need === "high" && mm < 1000) { status = "watch"; note = "다습 작물에 강수 부족 — 관수 보완 필요"; }
  else if (need === "low" && mm > 1800) { status = "watch"; note = "과습 위험 — 배수 관리"; }
  else if (need === "medium" && (mm < 800 || mm > 1900)) { status = "watch"; note = mm < 800 ? "강수 부족 — 관수" : "강수 과다 — 배수"; }
  return { ...base, reading, status, note };
}
/** 겨울 최저기온 vs 내한성. */
function winterTempCheck(minC: number | undefined, cold: "low" | "medium" | "high"): EnvCheck {
  const base = { axis: "cold", label: "겨울 최저기온", need: `내한성 ${LMH_KO[cold]}` };
  if (minC == null || !Number.isFinite(minC)) return { ...base, reading: "데이터 없음", status: "unknown", note: "KMA 최저기온 자료 없음" };
  const reading = `${Math.round(minC)}℃`;
  const thr = cold === "low" ? -5 : cold === "medium" ? -12 : -20; // 내한성 낮을수록 동해 임계 높음
  let status: EnvStatus = "ok", note = "월동 가능 범위";
  if (minC < thr) { status = "risk"; note = "동해 위험 — 방한·재배시기/품종 조정"; }
  else if (minC < thr + 5) { status = "watch"; note = "저온 주의 — 방한 대비"; }
  return { ...base, reading, status, note };
}
/** 일조 수준 vs 일조 요구. */
function sunlightCheck(level: ClimateResult["sunlightLevel"], need: "low" | "medium" | "high"): EnvCheck {
  const base = { axis: "sun", label: "일조", need: `일조 요구 ${LMH_KO[need]}` };
  if (!level || level === "unknown") return { ...base, reading: "데이터 없음", status: "unknown", note: "KMA 일조 자료 없음" };
  let status: EnvStatus = "ok", note = "일조 충분";
  if (need === "high" && level === "low") { status = "watch"; note = "일조 부족 — 차광 회피·정지전정으로 수광 개선"; }
  return { ...base, reading: LMH_KO[level], status, note };
}
/** 여름 최고기온 vs 내서성(고온 스트레스) — 온난화로 여름최고↑ 시 냉량성 작물이 불리해지는 축. */
function summerHeatCheck(maxC: number | undefined, heat: "low" | "medium" | "high"): EnvCheck {
  const base = { axis: "heat", label: "여름 최고기온", need: `내서성 ${LMH_KO[heat]}` };
  if (maxC == null || !Number.isFinite(maxC)) return { ...base, reading: "데이터 없음", status: "unknown", note: "여름 최고기온 자료 없음" };
  const reading = `${Math.round(maxC)}℃`;
  const thr = heat === "low" ? { watch: 30, risk: 33 } : heat === "medium" ? { watch: 33, risk: 36 } : { watch: 36, risk: 39 }; // 내서성 낮을수록 고온해 임계 낮음
  let status: EnvStatus = "ok", note = "고온 스트레스 낮음";
  if (maxC >= thr.risk) { status = "risk"; note = "고온해 위험 — 차광·환기·관수·재배시기/품종 조정"; }
  else if (maxC >= thr.watch) { status = "watch"; note = "고온 주의 — 차광·관수 대비"; }
  return { ...base, reading, status, note };
}

/** 서리 위험 vs 서리 민감도. */
function frostCheck(risk: ClimateResult["frostRisk"], sens: "low" | "medium" | "high"): EnvCheck {
  const base = { axis: "frost", label: "서리 위험", need: `서리 민감 ${LMH_KO[sens]}` };
  if (!risk || risk === "unknown") return { ...base, reading: "데이터 없음", status: "unknown", note: "서리 자료 없음" };
  let status: EnvStatus = "ok", note = "서리 리스크 낮음";
  if (sens === "high" && risk === "high") { status = "risk"; note = "개화기 서리 위험 — 방상팬·연소법·미세살수"; }
  else if (sens !== "low" && risk !== "low") { status = "watch"; note = "서리 주의 — 재배시기·보온 대비"; }
  return { ...base, reading: LMH_KO[risk], status, note };
}

const RANK: Record<EnvStatus, number> = { risk: 0, watch: 1, ok: 2, unknown: 3 };
const DISCLAIMER =
  "환경 점검은 작물 요구조건과 지역 기후(연/계절 요약)의 적합성 참고입니다. 일일 실측·필지별 시계열·자동 알림은 연동 예정이며, 실제 미기상은 지형·해에 따라 다릅니다. 재배 성공을 보장하지 않습니다.";

/** 작물 + 기후 요약 → 환경 적합 점검. 순수 함수. unknown cropId면 getCropProfile throw(호출측 400). */
export function buildFieldMonitor(cropId: string, climate: ClimateResult): FieldMonitor {
  const crop = getCropProfile(cropId);
  const r = crop.requirements;
  const checks: EnvCheck[] = [
    rainfallCheck(climate.annualRainfallMm, r.waterNeed),
    winterTempCheck(climate.minWinterTempC, r.coldTolerance),
    summerHeatCheck(climate.summerMaxTempC, heatToleranceOf(cropId)), // 고온 스트레스(온난화로 여름최고↑ 반영)
    sunlightCheck(climate.sunlightLevel, r.sunlightNeed),
    frostCheck(climate.frostRisk, r.frostSensitivity),
  ];
  const worst = checks.map((c) => c.status).sort((a, b) => RANK[a] - RANK[b])[0] ?? "unknown";
  return {
    cropId, cropNameKo: crop.cropNameKo, checks, worst,
    riskCount: checks.filter((c) => c.status === "risk").length,
    sources: ["KMA 기후 요약", "작물 요구조건(룰북)", "일일 실측·필지별 시계열(예정·seam)"],
    disclaimer: DISCLAIMER,
  };
}
