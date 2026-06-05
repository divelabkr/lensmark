import type { GrowthRiskInfo, SimulationInput } from "../types";
import { getCropProfile } from "../data/crops.seed";
import { getCropPests } from "../data/cropPests.seed";

export function buildGrowthRiskInfo(input: SimulationInput): GrowthRiskInfo {
  const crop = getCropProfile(input.cropId);
  const weatherRisks: string[] = [];
  const pestRisks: string[] = [];
  const disasterRisks: string[] = [];
  const nextActions: string[] = [];

  if (crop.requirements.frostSensitivity === "high") weatherRisks.push("봄서리/개화기 저온 리스크 확인");
  if (crop.requirements.waterNeed === "high") weatherRisks.push("가뭄·관수 부족 리스크 확인");
  if (input.land.drainage === "poor") disasterRisks.push("집중호우 후 물고임 리스크");
  if (weatherRisks.length === 0) weatherRisks.push("입력 기준 주요 기상 리스크 낮음");
  if (disasterRisks.length === 0) disasterRisks.push("입력 기준 특이 재난요인 없음");

  // 작물별 병해충 (seed)
  getCropPests(input.cropId).forEach((p) => pestRisks.push(`${p.name} (${p.season})`));
  if (pestRisks.length === 0) pestRisks.push("작물별 병해충 데이터 미등록");

  nextActions.push("기상청 단기/중기예보 연동(실시간)");
  nextActions.push("농진청 병해충 발생정보 연동");
  nextActions.push("작물별 생육 캘린더 확인");

  return { weatherRisks, pestRisks, disasterRisks, nextActions };
}
