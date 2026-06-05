/**
 * 지원금·지자체·농협 혜택 라우트 — 무료. 대표 제도 안내 + 공식 확인 경로.
 *   GET /api/support?region=&cropId= : buildSupportPrograms(로컬 큐레이션, 외부 호출 없음).
 *   ⚠ 공공데이터포털 농림사업·지자체 보조·농협 혜택 실시간 큐레이션은 seam(Phase B).
 */
import { json } from "../respond";
import { buildSupportPrograms } from "../../src/lansmark/support/supportPrograms";
import type { RouteFn } from "../context";

const SAFE_CROP = /^[a-z_]{1,40}$/; // cropId 화이트리스트(있을 때만)

export const supportRoutes: RouteFn = async (_ctx, _req, res, url) => {
  if (url.pathname !== "/api/support") return false;
  const q = url.searchParams;
  const cropRaw = (q.get("cropId") || "").trim();
  const cropId = SAFE_CROP.test(cropRaw) ? cropRaw : undefined; // 형식 불일치/부재 → 작물 필터 없이 전체 안내
  const region = (q.get("region") || "").slice(0, 60) || undefined;
  json(res, 200, { ok: true, support: buildSupportPrograms({ region, cropId }) });
  return true;
};
