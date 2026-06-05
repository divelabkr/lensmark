/**
 * 작물 기후 형질(내서성) 시드 — 지구온난화/고온 스트레스 평가용.
 *   왜 별도 파일: heatTolerance는 온난화 모델 전용 형질이고, crops.seed(룰북 16종)를 대량 수정하지 않으려 단일 맵으로 모았다.
 *   ⚠ 데이터 정직성(CLAUDE.md #4): 아래 내서성은 작물 일반 특성에 기반한 '데모 근사'(verified 아님).
 *      냉량성(저온·고지대 선호) 작물=low(더위에 약함), 호온성(고온 선호) 작물=high. 정밀은 작물별 고온 한계온도·chill 요구 실데이터(seam).
 */
export type HeatTolerance = "low" | "medium" | "high";

/** cropId → 내서성(더위 견디는 정도). 미등록 작물은 heatToleranceOf가 medium 폴백. */
export const HEAT_TOLERANCE: Record<string, HeatTolerance> = {
  // 냉량성·서늘한 기후 선호(더위·고온해에 취약) → low
  apple: "low", blueberry: "low", strawberry: "low", napa_cabbage: "low", potato: "low",
  // 중간
  grape: "medium", garlic: "medium", onion: "medium", soybean: "medium", corn: "medium",
  perilla: "medium", balloon_flower: "medium", barley: "medium",
  // 호온성·고온 적응(더위에 강함) → high
  sweet_potato: "high", chili_pepper: "high", sesame: "high", rice: "high",
};

/** 작물 내서성(없으면 medium 폴백 — 미상 작물 보수적). */
export function heatToleranceOf(cropId: string): HeatTolerance {
  return HEAT_TOLERANCE[cropId] ?? "medium";
}
