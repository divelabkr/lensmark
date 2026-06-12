/**
 * 병충해·재해 주의 라우트 — 무료(안전 정보). 작물 + 기준 월 → 주의 항목 + (region 주면) 실시간 기상특보 + 작물 주요 병해충(NCPMS).
 *   GET /api/alerts?cropId=&month=&region= : month 없으면 서버 현재월. region(시도/시군)이면 KMA 실시간 특보 합류(live).
 *   실데이터: 기상특보(KMA apihub·live) + 주요 병해충(농진청 NCPMS SVC01·live·작물명 매칭). 키 없거나 미매칭이면 빈 배열(seed만·무중단).
 */
import { json } from "../respond";
import { finiteParam } from "../../src/lansmark/api/httpUtil";
import { buildAgriAlerts } from "../../src/lansmark/alerts/agriAlerts";
import { fetchActiveWarnings, warningsForRegion } from "../../src/lansmark/integrations/kmaWarning";
import { fetchNcpmsPests } from "../../src/lansmark/integrations/ncpms";
import { getCropProfile } from "../../src/lansmark/data/crops.seed";
import type { RouteFn } from "../context";

const SAFE_CROP = /^[a-z_]{1,40}$/; // cropId 화이트리스트(비신뢰 입력 차단)

export const alertsRoutes: RouteFn = async (_ctx, _req, res, url) => {
  if (url.pathname !== "/api/alerts") return false;
  const cropId = (url.searchParams.get("cropId") || "").trim();
  if (!SAFE_CROP.test(cropId)) { json(res, 400, { error: "유효한 cropId가 필요합니다." }); return true; }
  const mParam = finiteParam(url.searchParams.get("month"));
  const month = mParam != null ? mParam : new Date().getMonth() + 1; // 미지정 → 서버 현재월
  const region = (url.searchParams.get("region") || "").slice(0, 30); // 시도/시군명(특보 매칭용)
  let cropNameKo: string;
  try { cropNameKo = getCropProfile(cropId).cropNameKo; } // 미존재 cropId → 400
  catch { json(res, 400, { error: "알 수 없는 작물입니다.", code: "UNKNOWN_CROP" }); return true; }
  const alerts = buildAgriAlerts(cropId, month);
  // 실시간 합류(병렬·각자 실패 시 빈 배열) — 기상특보(KMA·EUC-KR·60초 캐시) + 주요 병해충(NCPMS·작물명 검색).
  const [weatherWarnings, pests] = await Promise.all([
    region ? fetchActiveWarnings().then((w) => warningsForRegion(w, region)).catch(() => []) : Promise.resolve([] as unknown[]),
    fetchNcpmsPests(cropNameKo, 8).catch(() => []),
  ]);
  json(res, 200, { ok: true, alerts, weatherWarnings, pests }); // pests=[{nameKor,cropName,cropCode}] 농진청 NCPMS
  return true;
};
