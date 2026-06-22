/**
 * 작물 전환 로드맵(G-2) — 온난화 시점(현재·2040·2060)별 적합 작물 변화('지금 사과 → 2050엔 ○○').
 *   재사용: climateScenario(applyWarming·warmingDeltaC) × cropSuitability(rankCropCandidates). 순수·결정적(새 도메인 수치 없음 — 기존 엔진 합성).
 *   왜: 경쟁앱 부재 차별점 + 저빈도(귀농 의사결정은 드묾) 약점을 '재방문/재결정' 트리거로 보완. B2B/지자체 정책 PR 무기.
 *   ⚠ 1원칙: 온난화 ΔT는 기상청/IPCC 근사 demo(외삽·미검증·SSP2-4.5 가정)이며 climateScenario가 면책을 내장. 수익·재배성공 보장 아님.
 */
import { applyWarming, warmingDeltaC } from "./climateScenario";
import { rankCropCandidates } from "./cropSuitability";
import type { EmissionPath, LandInput, CropCandidateResult } from "../types";
import type { ClimateResult } from "../data/providers/types";

export interface TransitionPoint {
  label: string;   // "현재" · "2040년대" · "2060년대"
  year: number;
  deltaC: number;  // 온난화 폭(℃) — climateScenario 산출
  top: CropCandidateResult[];
}
export interface CropTransition {
  points: TransitionPoint[];
  newcomers: string[]; // 미래(2060)에 새로 상위권 진입(온난화 수혜) 작물명
  fadeouts: string[];  // 현재 상위였으나 미래 이탈(고온 스트레스 등) 작물명
  disclaimer: string;
}

const PATH: EmissionPath = "ssp245"; // 중간 배출경로(SSP2-4.5) demo — 과신 방지(고배출 ssp585는 별도 토글 여지)
const YEARS = [
  { label: "현재", year: 2025 },
  { label: "2040년대", year: 2040 },
  { label: "2060년대", year: 2060 },
] as const;

/** 좌표 기후 + 온난화 시점별 적합 작물 → 전환 로드맵. climate 없으면 null(좌표/필지 단계 필요). */
export function buildCropTransition(land: LandInput, climate: ClimateResult | undefined, limit = 5): CropTransition | null {
  if (!climate) return null; // 기후 미확보(상위 줌 등) → 전환 분석 불가
  const points: TransitionPoint[] = YEARS.map((y) => {
    const deltaC = warmingDeltaC({ year: y.year, path: PATH });
    const fc = deltaC > 0 ? applyWarming(climate, deltaC) : climate; // 미래 기후(평년 + ΔT)
    return { label: y.label, year: y.year, deltaC, top: rankCropCandidates(land, limit, fc) };
  });
  // 현재(첫) vs 미래(마지막=2060) 상위권 비교 — 새로 유망 / 이탈
  const curIds = new Set(points[0].top.map((c) => c.cropId));
  const futIds = new Set(points[points.length - 1].top.map((c) => c.cropId));
  const newcomers = points[points.length - 1].top.filter((c) => !curIds.has(c.cropId)).map((c) => c.cropNameKo);
  const fadeouts = points[0].top.filter((c) => !futIds.has(c.cropId)).map((c) => c.cropNameKo);
  return {
    points,
    newcomers,
    fadeouts,
    disclaimer: "온난화 폭은 기상청·IPCC 근사(외삽·미검증)·중간배출(SSP2-4.5) 가정 — 지역차·비선형은 단순화했습니다. 수익·재배성공 보장이 아니라 장기 의사결정 참고용입니다.",
  };
}
