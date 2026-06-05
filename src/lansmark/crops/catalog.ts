/**
 * 작물 카탈로그 — 전체 작물 목록(id·이름·카테고리·가이드 티어).
 *   용도: '전체 작물 보기' — 추천(적합도 top-N) 밖이라 안 보이던 작물(벼·보리 등)도 사용자가 직접 선택.
 *   순수 함수(룰북 파생). 무료(대표작물) 먼저, 같은 티어 안에서 가나다순.
 */
import { CROP_PROFILES } from "../data/crops.seed";
import { isStapleFree } from "../guide/cultivationGuide";

export interface CropCatalogItem {
  cropId: string;
  cropNameKo: string;
  category: string;
  guideTier: "free" | "paid"; // 재배가이드 무료(대표작물)/유료 — 칩 배지 표시용
}

export function listCropCatalog(): CropCatalogItem[] {
  return CROP_PROFILES
    .map((c) => ({
      cropId: c.cropId,
      cropNameKo: c.cropNameKo,
      category: c.category,
      guideTier: isStapleFree(c.cropId) ? ("free" as const) : ("paid" as const),
    }))
    .sort((a, b) => (a.guideTier === b.guideTier ? a.cropNameKo.localeCompare(b.cropNameKo, "ko") : a.guideTier === "free" ? -1 : 1));
}
