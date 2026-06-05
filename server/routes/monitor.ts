/**
 * 일일 환경 모니터링 라우트 — 무료. 지역 기후(KMA) vs 작물 요구 적합 점검.
 *   GET /api/monitor?cropId=&lat=&lng= : KMA 기후 요약 조회 → buildFieldMonitor.
 *   경계: 무료 · KMA 쿼터 보호로 sensitive 레이트리밋(middleware) · 조회 실패 시 unknown 폴백(무중단).
 *   ⚠ 일일 실측·필지별 시계열·자동 알림(인앱/푸시)은 seam(Phase B).
 */
import { json } from "../respond";
import { buildFieldMonitor } from "../../src/lansmark/monitor/fieldMonitor";
import type { ClimateResult } from "../../src/lansmark/data/providers/types";
import type { RouteFn } from "../context";

const SAFE_CROP = /^[a-z_]{1,40}$/; // cropId 화이트리스트(비신뢰 입력 차단)
const finiteIn = (v: string | null, lo: number, hi: number): number | undefined => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};

export const monitorRoutes: RouteFn = async (ctx, _req, res, url) => {
  if (url.pathname !== "/api/monitor") return false;
  const q = url.searchParams;
  const cropId = (q.get("cropId") || "").trim();
  if (!SAFE_CROP.test(cropId)) { json(res, 400, { error: "유효한 cropId가 필요합니다." }); return true; }
  const lat = finiteIn(q.get("lat"), -90, 90), lng = finiteIn(q.get("lng"), -180, 180);
  if (lat == null || lng == null) { json(res, 400, { error: "유효한 좌표(lat/lng)가 필요합니다." }); return true; }

  // KMA 기후 요약(키 있으면 live·없으면 mock). 실패/지연 시 빈 객체 → 점검 unknown(무중단).
  let climate: ClimateResult = {};
  try { climate = (await ctx.providers.land.climate({ lat, lng })) || {}; } catch { /* 폴백 */ }

  try {
    const monitor = buildFieldMonitor(cropId, climate);
    json(res, 200, { ok: true, monitor });
  } catch { json(res, 400, { error: "알 수 없는 작물입니다.", code: "UNKNOWN_CROP" }); } // getCropProfile throw
  return true;
};
