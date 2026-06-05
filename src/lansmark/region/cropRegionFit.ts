/**
 * 작물 → 추천 지형/지역(crop-first 탐색). 순수 함수.
 *   ① terrainConditions: 작물 요구조건(이 작물에 맞는 땅) — cultivationGuide 재사용.
 *   ② regions: 시도별 기후 적합 — 시도 평년기후(근사) vs 작물 요구를 field-monitor 로직으로 판정·정렬.
 *   정직성(가드레일): '시도 광역 기후 적합'이지 '필지 적합'이 아님(지형·토양은 필지마다 다름) · 평년값 근사 · 재배 성공 보장 금지 · 면책.
 *   lat/lng(시도 중심)는 지도 마커용으로 함께 제공(다음 단계).
 */
import { getCropProfile } from "../data/crops.seed";
import { SIDO_CLIMATE } from "../data/sidoClimate.seed";
import { buildFieldMonitor, type EnvStatus } from "../monitor/fieldMonitor";
import { buildCultivationGuide, type RequirementItem } from "../guide/cultivationGuide";
import { warmingDeltaC, applyWarming } from "../core/climateScenario";
import type { WarmingScenario } from "../types";

export type FitShift = "개선" | "유지" | "악화" | "unknown";
export interface RegionFit {
  sido: string;
  fit: EnvStatus;       // ok 적합 / watch 주의 / risk 부적합우려 / unknown 정보부족 (현재 평년)
  lat: number;          // 시도 중심(마커용)
  lng: number;
  reasons: string[];    // 주의·부적합 사유(적합이면 빈 배열)
  fitFuture?: EnvStatus; // 온난화 시나리오 적용 시 적합(ΔT>0일 때만)
  shift?: FitShift;      // 현재→미래 변화(개선/유지/악화)
}
export interface CropRegionFit {
  cropId: string;
  cropNameKo: string;
  terrainConditions: RequirementItem[]; // ① 이 작물에 맞는 땅 조건
  regions: RegionFit[];                  // ② 시도 기후 적합(적합 먼저)
  deltaC: number;                        // 적용된 온난화 폭(℃, 0=현재)
  scenarioYear?: number;                 // 가정 미래 연도(있으면)
  disclaimer: string;
}

/** 시도 겨울최저로 서리위험 근사(레드팀 F1: 서리 축 미평가 방지). 봄/가을 서리의 광역 대리지표 — 정밀은 필지. */
const frostRiskFromWinter = (minC: number): "low" | "medium" | "high" => (minC <= -10 ? "high" : minC <= -3 ? "medium" : "low");

const FIT_KO: Record<EnvStatus, string> = { ok: "적합", watch: "주의", risk: "부적합 우려", unknown: "정보 부족" };
const RANK: Record<EnvStatus, number> = { ok: 0, watch: 1, risk: 2, unknown: 3 }; // 적합 먼저 정렬
const DISCLAIMER =
  "시도별 적합은 작물 기후 요구 vs 시도 평년기후(근사)의 광역 비교입니다. 지형·토양·미기상은 시군·필지마다 달라 실제 적합성은 땅을 선택해 정밀 분석으로 확인하세요. 재배 성공을 보장하지 않습니다.";

/** 현재→미래 적합 변화 판정(낮은 RANK=더 적합). 정보부족이면 unknown. */
const shiftOf = (now: EnvStatus, fut: EnvStatus): FitShift =>
  (now === "unknown" || fut === "unknown") ? "unknown" : RANK[fut] < RANK[now] ? "개선" : RANK[fut] > RANK[now] ? "악화" : "유지";

/**
 * 작물 → 추천 지형조건 + 시도 기후 적합. scenario(온난화) 주면 시도별 '현재 + 미래(ΔT 적용)' 적합을 함께 산출.
 *   unknown cropId면 getCropProfile throw(호출측 400).
 */
export function buildCropRegionFit(cropId: string, scenario?: WarmingScenario): CropRegionFit {
  const crop = getCropProfile(cropId);
  const deltaC = warmingDeltaC(scenario);
  const regions: RegionFit[] = SIDO_CLIMATE
    .map((s) => {
      // 시도 평년기후를 ClimateResult로 보고 field-monitor 판정 재사용. 서리위험은 겨울최저로 근사(F1 — 미평가 숨김 방지).
      const present = { annualRainfallMm: s.annualRainfallMm, minWinterTempC: s.minWinterTempC, summerMaxTempC: s.summerMaxTempC, sunlightLevel: s.sunlightLevel, frostRisk: frostRiskFromWinter(s.minWinterTempC) };
      const mNow = buildFieldMonitor(cropId, present);
      const r: RegionFit = {
        sido: s.sido, fit: mNow.worst, lat: s.lat, lng: s.lng,
        reasons: mNow.checks.filter((c) => c.status === "watch" || c.status === "risk").map((c) => `${c.label} ${FIT_KO[c.status]}`),
      };
      if (deltaC > 0) {
        // 온난화 적용(applyWarming): 겨울최저·여름최고 +ΔT·연강수 평균 소폭↑, 서리위험은 온난화된 겨울최저로 재근사(광역 대리지표).
        const warmed = applyWarming(present, deltaC);
        const futClimate = { ...warmed, frostRisk: frostRiskFromWinter(warmed.minWinterTempC ?? s.minWinterTempC) };
        const mFut = buildFieldMonitor(cropId, futClimate);
        r.fitFuture = mFut.worst;
        r.shift = shiftOf(mNow.worst, mFut.worst);
      }
      return r;
    })
    .sort((a, b) => RANK[a.fit] - RANK[b.fit]);
  return {
    cropId, cropNameKo: crop.cropNameKo,
    terrainConditions: buildCultivationGuide(cropId).requirements,
    regions, deltaC, scenarioYear: scenario?.year,
    disclaimer: deltaC > 0 ? DISCLAIMER + " 미래 적합은 온난화(KMA SSP 근사) 외삽치로 미검증입니다. 연강수는 소폭↑로 가정하나 변동성(집중호우·가뭄 양극화)은 별도 리스크입니다." : DISCLAIMER,
  };
}
