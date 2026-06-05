/**
 * 병충해·재해 주의 라우트 — 무료(안전 정보). 작물 + 기준 월 → 주의 항목 + (region 주면) 실시간 기상특보.
 *   GET /api/alerts?cropId=&month=&region= : month 없으면 서버 현재월. region(시도/시군)이면 KMA 실시간 특보 합류(live).
 *   ⚠ 실시간 발생 예찰(NCPMS)·푸시 알림은 seam(Phase B). 기상특보(KMA)는 live 승격(키·활용신청 시·없으면 [] 폴백).
 */
import { json } from "../respond";
import { finiteParam } from "../../src/lansmark/api/httpUtil";
import { buildAgriAlerts } from "../../src/lansmark/alerts/agriAlerts";
import { fetchActiveWarnings, warningsForRegion } from "../../src/lansmark/integrations/kmaWarning";
import type { RouteFn } from "../context";

const SAFE_CROP = /^[a-z_]{1,40}$/; // cropId 화이트리스트(비신뢰 입력 차단)

export const alertsRoutes: RouteFn = async (_ctx, _req, res, url) => {
  if (url.pathname !== "/api/alerts") return false;
  const cropId = (url.searchParams.get("cropId") || "").trim();
  if (!SAFE_CROP.test(cropId)) { json(res, 400, { error: "유효한 cropId가 필요합니다." }); return true; }
  const mParam = finiteParam(url.searchParams.get("month"));
  const month = mParam != null ? mParam : new Date().getMonth() + 1; // 미지정 → 서버 현재월
  const region = (url.searchParams.get("region") || "").slice(0, 30); // 시도/시군명(특보 매칭용)
  try {
    const alerts = buildAgriAlerts(cropId, month);
    // 실시간 기상특보(KMA·live·EUC-KR·60초 캐시) — region 주면 그 지역 발효 특보. 키 없으면 [](seed만).
    const weatherWarnings = region ? warningsForRegion(await fetchActiveWarnings(), region) : [];
    json(res, 200, { ok: true, alerts, weatherWarnings });
  } catch { json(res, 400, { error: "알 수 없는 작물입니다.", code: "UNKNOWN_CROP" }); } // getCropProfile throw
  return true;
};
