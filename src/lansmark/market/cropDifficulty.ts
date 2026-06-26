/**
 * 작물 재배 난이도 — crop-first 정렬 표의 '난이도' 컬럼(우리 룰·LLM 아님·결정적).
 *   crops.seed 재배 요구조건(노동·내한·서리·시설·물·배수)의 '까다로움'을 가중 합산 → 1쉬움/2보통/3어려움.
 *   정직성: 도메인 수치 날조 아님 — 기존 룰북 요구조건을 결정적 룰로 환산(출처=crops.seed). 트렌드(Perplexity)와 출처 분리.
 *   ⚠ 절대 난이도가 아니라 '요구조건 상대 까다로움'의 근사 — 지역·숙련도에 따라 다름(UI 면책).
 */
import { getCropProfile } from "../data/crops.seed";

export type DifficultyLevel = 1 | 2 | 3;
export const DIFFICULTY_KO: Record<DifficultyLevel, string> = { 1: "쉬움", 2: "보통", 3: "어려움" };

const LMH = { low: 0, medium: 1, high: 2 } as const;

/** cropId → 재배 난이도(1~3). 요구조건 까다로움 가중합 → 구간화. unknown cropId면 getCropProfile throw. */
export function cropDifficulty(cropId: string): DifficultyLevel {
  const r = getCropProfile(cropId).requirements;
  let s = 0;
  s += LMH[r.laborNeed];               // 노동 강도(가장 직접적 지표)
  s += 2 - LMH[r.coldTolerance];       // 내한 약할수록 ↑(재배지·월동 제약)
  s += LMH[r.frostSensitivity];        // 서리 민감할수록 ↑(피해 위험)
  if (r.facilityRecommended) s += 2;   // 시설재배 권장(투자·관리 부담)
  if (r.waterNeed === "high") s += 1;  // 관수 인프라 필요
  if (r.drainage === "high") s += 1;   // 배수 양호한 땅 요구(입지 제약)
  return s <= 2 ? 1 : s <= 5 ? 2 : 3;  // 0~2 쉬움 / 3~5 보통 / 6+ 어려움
}
