/**
 * 작물→지역 추천 라우트 — 무료(crop-first 탐색). 작물 선택 → 추천 지형조건 + 시도 기후 적합(현재/온난화 미래).
 *   GET /api/region-fit?cropId=[&year=&path=&dt=] : buildCropRegionFit(로컬, 외부 호출 없음).
 *   온난화 시나리오: year(2025~2100)+path(ssp245|ssp585) → ΔT 자동, 또는 dt(ΔT 직접·0~6) override.
 *   ⚠ 시도 광역 기후 적합 — 필지 정밀은 땅 선택 후. 미래 적합은 외삽(미검증). 전국 고해상 히트맵은 비구현.
 */
import { json } from "../respond";
import { buildCropRegionFit } from "../../src/lansmark/region/cropRegionFit";
import type { WarmingScenario, EmissionPath } from "../../src/lansmark/types";
import type { RouteFn } from "../context";

const SAFE_CROP = /^[a-z_]{1,40}$/; // cropId 화이트리스트(비신뢰 입력 차단)
const EMISSION: EmissionPath[] = ["ssp245", "ssp585"];
const finite = (v: string | null, lo: number, hi: number): number | undefined => {
  const n = Number(v); return v != null && Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};
/** 쿼리 → 온난화 시나리오(전부 무효면 undefined → 현재 평년). */
function scenarioFromQuery(q: URLSearchParams): WarmingScenario | undefined {
  const s: WarmingScenario = {};
  const y = finite(q.get("year"), 2025, 2100); if (y !== undefined) s.year = Math.round(y);
  const p = q.get("path"); if (p && EMISSION.includes(p as EmissionPath)) s.path = p as EmissionPath;
  const dt = finite(q.get("dt"), 0, 6); if (dt !== undefined) s.deltaTempCOverride = dt;
  return (s.year != null || s.path || s.deltaTempCOverride != null) ? s : undefined;
}

export const regionFitRoutes: RouteFn = async (_ctx, _req, res, url) => {
  if (url.pathname !== "/api/region-fit") return false;
  const cropId = (url.searchParams.get("cropId") || "").trim();
  if (!SAFE_CROP.test(cropId)) { json(res, 400, { error: "유효한 cropId가 필요합니다." }); return true; }
  try { json(res, 200, { ok: true, regionFit: buildCropRegionFit(cropId, scenarioFromQuery(url.searchParams)) }); }
  catch { json(res, 400, { error: "알 수 없는 작물입니다.", code: "UNKNOWN_CROP" }); } // getCropProfile throw
  return true;
};
