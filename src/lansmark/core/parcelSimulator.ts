import type { ConfidenceGrade, SigmaRange, SimulationInput } from "../types";
import { multiplyIndependent, subtractIndependent } from "./uncertainty";
import { getRdaBase } from "../data/rdaIncome";
import { getCropProfile } from "../data/crops.seed";
import { collectFactors, type FactorContext } from "./factors";
import { warmingDeltaC, applyWarming } from "./climateScenario";
import type { Factor } from "./terrain";
import { getSoilConfidence } from "../policy/soilPolicy";
import { getDefaultDisclaimers } from "../policy/disclaimer";
import { getCalibration, VALIDATED_THRESHOLD, type CalibrationResult } from "./calibration";
import { lookupCalibration, type CalibrationSnapshot } from "./consolidate";
import { terrainBucketOf, type FeedbackStore } from "./feedbackStore";
import type { ProviderBundle } from "../data/providers/types";

const scale = (r: SigmaRange, f: number): SigmaRange => ({
  p10: Math.max(0, Math.round(r.p10 * f)), p50: Math.max(0, Math.round(r.p50 * f)), p90: Math.max(0, Math.round(r.p90 * f)),
});
const applyFactors = (r: SigmaRange, fs: Factor[]): SigmaRange => fs.reduce((acc, f) => scale(acc, f.value), r);
const widen = (r: SigmaRange): SigmaRange =>
  r.p10 === r.p50 && r.p50 === r.p90 ? { p10: Math.round(r.p50 * 0.8), p50: r.p50, p90: Math.round(r.p50 * 1.25) } : r;

/**
 * 기후 변동성(온난화) — 물 민감 작물의 '나쁜 해' 하방위험↑(강수 양극화: 집중호우 침수·가뭄 감수).
 *   왜 밴드만: 변동성은 중앙값(p50)을 낮추는 결정적 페널티가 아니라 '극단해 빈도↑'다 → p10↓·p90 소폭↑로 표현(추측 회피).
 *   ⚠ 데이터 정직성(CLAUDE.md #4): ℃당 하방 2.5%(상한 15%)는 데모·미검증. 작물별 침수/가뭄 감수 실데이터로 교체(seam).
 */
function widenClimateVariability(y: SigmaRange, cropId: string, deltaC: number): SigmaRange {
  if (!(deltaC > 0) || getCropProfile(cropId).requirements.waterNeed !== "high") return y;
  const w = Math.min(0.15, 0.025 * deltaC);
  return { p10: Math.max(0, Math.round(y.p10 * (1 - w))), p50: y.p50, p90: Math.round(y.p90 * (1 + w * 0.3)) };
}

const GRADES: ConfidenceGrade[] = ["A", "B", "C", "D"];
const step = (g: ConfidenceGrade, d: number): ConfidenceGrade => {
  const i = GRADES.indexOf(g === "X" ? "D" : g);
  return GRADES[Math.max(0, Math.min(GRADES.length - 1, i + d))];
};

export interface ParcelInput extends SimulationInput {
  region?: string;
  context?: FactorContext;
  kamisPriceKrwPerKg?: SigmaRange;
  calibration?: CalibrationResult; // 실측 보정(플라이휠). 미주입 시 콜드스타트
}
export interface ParcelResult {
  cropId: string; cropNameKo: string; baseSource: string; areaM2: number;
  yieldKg: SigmaRange; costKrw: SigmaRange; priceKrwPerKg: SigmaRange;
  revenueKrw: SigmaRange; incomeKrw: SigmaRange; breakEvenPriceKrwPerKg: number;
  factors: Factor[]; confidence: ConfidenceGrade; dataLabel: "validated" | "estimated"; disclaimers: string[];
}

export function runParcelSimulation(input: ParcelInput): ParcelResult {
  if (!input.land.areaM2 || input.land.areaM2 <= 0) throw new Error("land.areaM2 must be > 0");
  const base = getRdaBase(input.cropId, input.region, { salesChannel: input.salesChannel, targetYear: input.targetYear }); // 판로·연차 반영
  const a10 = input.land.areaM2 / 1000;
  // 지구온난화: 기후를 ΔT만큼 따뜻하게(저온·서리 완화 자동) + ΔT·재배유형을 팩터 컨텍스트에 주입.
  //   warmedClimate → climateFactors/facilityFactors가 온난화 반영 · warmingDeltaC → 냉량성 작물 고온 페널티·시설 냉방.
  const deltaC = warmingDeltaC(input.climateScenario);
  const baseClimate = input.context?.climate;
  const warmedClimate = baseClimate && deltaC > 0 ? applyWarming(baseClimate, deltaC) : baseClimate;
  const ctx: FactorContext = { ...(input.context ?? {}), climate: warmedClimate, cultivationType: input.cultivationType, warmingDeltaC: deltaC };
  const fb = collectFactors(input.cropId, input.land, ctx);

  let yieldKg = applyFactors(scale(base.yieldKgPer10a, a10), fb.yieldFactors);
  let costKrw = applyFactors(scale(base.operatingCostPer10aKrw, a10), fb.costFactors);
  let priceKrwPerKg = widen(input.kamisPriceKrwPerKg ?? base.refPriceKrwPerKg);

  // ⑧ 플라이휠: 실측 보정 적용 (있을 때만)
  const cal = input.calibration;
  if (cal && cal.n > 0) {
    yieldKg = scale(yieldKg, cal.yieldCorrection);
    costKrw = scale(costKrw, cal.costCorrection);
    priceKrwPerKg = scale(priceKrwPerKg, cal.priceCorrection);
    fb.all.push({ axis: "실측보정", target: "yield", value: cal.yieldCorrection, reason: cal.reason });
  }

  // 🌧 기후 변동성(온난화): 물 민감 작물은 강수 양극화로 '나쁜 해' 하방위험↑ — 중앙값은 두고 밴드만 확대(#3 변동성).
  yieldKg = widenClimateVariability(yieldKg, input.cropId, deltaC);

  const revenueKrw = multiplyIndependent(yieldKg, priceKrwPerKg);
  const incomeKrw = subtractIndependent(revenueKrw, costKrw);
  const breakEvenPriceKrwPerKg = yieldKg.p50 > 0 ? Math.round(costKrw.p50 / yieldKg.p50) : 0;

  let confidence = getSoilConfidence(input.land.soilEvidence);
  if (!ctx.climate) confidence = step(confidence, +1);
  if (fb.satelliteConfidenceBoost) confidence = step(confidence, -1);

  // '✓검증' 배지: 원시 건수(cal.n)가 아니라 서로 다른 제출자 수(validatedBy)로 판정 — 단일 사용자의 다중 일지/반복 제출 위조 차단(레드팀 MOAT-1·H6). (보정 적용 여부는 위 cal.n>0)
  const valN = cal?.validatedBy ?? 0;
  const dataLabel: "validated" | "estimated" = valN >= VALIDATED_THRESHOLD ? "validated" : "estimated";

  return {
    cropId: input.cropId, cropNameKo: base.cropNameKo, baseSource: base.source, areaM2: input.land.areaM2,
    yieldKg, costKrw, priceKrwPerKg, revenueKrw, incomeKrw, breakEvenPriceKrwPerKg,
    factors: fb.all, confidence, dataLabel, disclaimers: getDefaultDisclaimers(),
  };
}

/** provider(VWorld/KMA/KAMIS) 연동 — climate/price를 엔진에 주입. (enrich orphan 해결) */
export async function runParcelSimulationWithProviders(input: ParcelInput, providers: ProviderBundle): Promise<ParcelResult> {
  const ctx: FactorContext = { ...(input.context ?? {}) };
  try {
    let lat = input.land.lat, lng = input.land.lng;
    if ((lat == null || lng == null) && input.land.address) {
      const geo = await providers.land.geocode({ address: input.land.address });
      lat = geo.lat; lng = geo.lng;
    }
    if (lat != null && lng != null && !ctx.climate) ctx.climate = await providers.land.climate({ lat, lng });
    if (lat != null && lng != null && !ctx.terrain) {
      try { const t = await providers.land.terrain({ lat, lng }); if (t) ctx.terrain = t; } catch { /* 폴백: mock/manual 지형 */ }
    }
  } catch { /* 폴백: climate 없이 진행(신뢰도 하향) */ }

  let kamisPriceKrwPerKg = input.kamisPriceKrwPerKg;
  try { const p = await providers.price.recentWholesale(input.cropId); if (p) kamisPriceKrwPerKg = p.priceKrwPerKg; } catch { /* 폴백: base 단가 */ }

  return runParcelSimulation({ ...input, context: ctx, kamisPriceKrwPerKg });
}

/** ⑧ 플라이휠 러너: 저장소의 실측 보정(지형버킷 부분풀링)을 적용해 시뮬레이션. */
export async function runParcelSimulationCalibrated(input: ParcelInput, store: FeedbackStore): Promise<ParcelResult> {
  const bucket = input.context?.terrain ? terrainBucketOf(input.context.terrain) : undefined;
  const calibration = await getCalibration(input.cropId, input.region, store, bucket);
  return runParcelSimulation({ ...input, calibration });
}

/** Dream 스냅샷 기반 러너: consolidate()가 만든 스냅샷에서 보정을 읽어 적용(빠름). */
export function runParcelSimulationWithSnapshot(input: ParcelInput, snapshot: CalibrationSnapshot): ParcelResult {
  const bucket = input.context?.terrain ? terrainBucketOf(input.context.terrain) : undefined;
  const calibration = lookupCalibration(snapshot, input.cropId, input.region, bucket);
  return runParcelSimulation({ ...input, calibration });
}
