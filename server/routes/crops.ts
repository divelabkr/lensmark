/**
 * 작물 카탈로그 라우트 — 무료. 전체 작물 목록(추천 밖 작물 직접 선택용).
 *   GET /api/crops : listCropCatalog (id·이름·카테고리·무료/유료 가이드 티어).
 */
import { json } from "../respond";
import { listCropCatalog } from "../../src/lansmark/crops/catalog";
import type { RouteFn } from "../context";

export const cropsRoutes: RouteFn = async (_ctx, _req, res, url) => {
  if (url.pathname !== "/api/crops") return false;
  json(res, 200, { ok: true, crops: listCropCatalog() });
  return true;
};
