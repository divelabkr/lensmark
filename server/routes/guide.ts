/**
 * 재배 가이드 라우트 — 품종 선택 + 재배 환경·기술.
 *   GET /api/guide?cropId= : 작물 1종의 품종·요구조건·재배 적기·리스크.
 *   티어 게이트: 대표작물(STAPLE_FREE)은 무료, 그 외 작물은 엔티틀먼트 필요(402).
 *   ⚠ 목록 밖(임의·외래) 작물은 400(UNKNOWN_CROP) — 사용자 직접 추가 + 해외소스 병합은 Phase B(seam).
 */
import { json } from "../respond";
import { buildCultivationGuide } from "../../src/lansmark/guide/cultivationGuide";
import { assertPaidEntitlement } from "../../src/lansmark/policy/entitlement";
import type { RouteFn } from "../context";

const SAFE_CROP = /^[a-z_]{1,40}$/; // cropId 화이트리스트(비신뢰 입력 차단)

export const guideRoutes: RouteFn = async (ctx, req, res, url) => {
  if (url.pathname !== "/api/guide") return false;
  const cropId = (url.searchParams.get("cropId") || "").trim();
  if (!SAFE_CROP.test(cropId)) { json(res, 400, { error: "유효한 cropId가 필요합니다." }); return true; }

  // 1) 가이드 조립(목록 밖 작물이면 throw → 400) — 티어는 가이드 자체에서 결정.
  let guide;
  try { guide = buildCultivationGuide(cropId); }
  catch { ctx.analytics.dataGap("crop:" + cropId); json(res, 400, { error: "목록에 없는 작물입니다. 직접 작물 추가(해외 정보 병합)는 준비 중입니다(유료 예정).", code: "UNKNOWN_CROP" }); return true; } // 원했지만 미등록 작물 = 콘텐츠 갭

  // 2) 티어 게이트: 유료 작물은 엔티틀먼트 필요(대표작물은 무료 통과).
  if (guide.tier === "paid" && ctx.config.requireEntitlement) {
    try { await assertPaidEntitlement({ get: (n) => (req.headers[n.toLowerCase()] as string) ?? null }); }
    catch { json(res, 402, { error: "이 작물의 품종·재배 가이드는 유료입니다. 대표작물(사과·감자 등)은 무료로 제공됩니다.", code: "GUIDE_PAID" }); return true; }
  }

  ctx.analytics.funnel("guide"); // 퍼널: 가이드 조회(관여)
  json(res, 200, { ok: true, guide });
  return true;
};
