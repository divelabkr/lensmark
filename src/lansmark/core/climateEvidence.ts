/**
 * 기후 근거(why) 생성기 — KMA 측정값을 농민이 읽을 평이한 문장으로.
 *   책임: ClimateResult(실측) → 사람이 이해할 '기후 근거' 한 줄들 + 출처·면책.
 *   왜 측정 사실만? 작물별 임계값(생육적온·작물별 GDD base)은 아직 데이터 미확보 → '추측 금지'로 날조하지 않는다.
 *     작물별 적합/위험 판정은 엔진(core/factors.climateFactors)의 기존 '데이터 기반' 근거에 위임(여기서 중복 생성 금지).
 *   ※ 데이터 한계: 최근접 ASOS·최근 1년(평년값 아님) — sourceLabel로 정직하게 표기.
 */
import type { ClimateResult } from "../data/providers/types";

export interface ClimateEvidence {
  facts: string[];     // 측정 사실(평이한 한 줄들) — 값 없으면 생략
  sourceLabel: string; // 출처·기간(정직성)
  disclaimer: string;  // 면책(보장 아님)
}

const FROST: Record<string, string> = { low: "낮음", medium: "보통", high: "높음", unknown: "정보 없음" };
const SUN: Record<string, string> = { low: "적음", medium: "보통", high: "많음", unknown: "정보 없음" };

/** ClimateResult → 평이한 기후 근거(측정 사실만). 누락 항목은 생략. */
export function climateEvidence(climate?: ClimateResult): ClimateEvidence {
  const disclaimer = "참고용 — 재배 성공·수익을 보장하지 않습니다.";
  if (!climate) return { facts: ["이 지점의 기후 자료를 불러오지 못했어요."], sourceLabel: "출처 없음", disclaimer };
  const facts: string[] = [];
  if (climate.annualMeanTempC != null) facts.push(`연평균기온 ${climate.annualMeanTempC}℃`);
  if (climate.growingDegreeDays != null) facts.push(`적산온도 ${climate.growingDegreeDays}℃·일 (생육기 4~10월·기준 10℃)`);
  if (climate.annualRainfallMm != null) facts.push(`연강수량 ${climate.annualRainfallMm}mm`);
  if (climate.minWinterTempC != null) facts.push(`겨울 최저 ${climate.minWinterTempC}℃ · 서리위험 ${FROST[climate.frostRisk ?? "unknown"]}`);
  if (climate.summerMaxTempC != null) facts.push(`여름 최고 ${Math.round(climate.summerMaxTempC)}℃`);
  if (climate.sunlightLevel && climate.sunlightLevel !== "unknown") facts.push(`일조 ${SUN[climate.sunlightLevel]}`);
  if (!facts.length) facts.push("표시할 기후 측정값이 부족해요.");
  // 정직성: '평년값 아님'을 출처에 명시(최근 1년 관측이라 연·시기 따라 변동).
  const sourceLabel = (climate.stationName ? `${climate.stationName} 관측소` : "최근접 관측소") + "·최근 1년(평년값 아님)";
  return { facts, sourceLabel, disclaimer };
}
