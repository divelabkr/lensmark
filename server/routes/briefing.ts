/**
 * 데일리 브리핑 라우트 — "오늘 내 농장" 홈의 데이터. 리텐션 루프 1호(매일 올 이유).
 *   GET /api/briefing : 내 재배중 일지(=내 농장)별로 7일 예보·위험·단계·병해충·특보·시세를 조립해 반환.
 *   경계:
 *    - 신원 = journal과 동일 규칙(requireEnt 공유): 무료베타=익명/계정 격리 · 유료=엔티틀먼트(+실효 검사).
 *    - 외부조회(예보·특보·시세)는 병렬 + 각자 실패 시 폴백(무중단). 예보 mock이면 demo=true(데모 라벨 강제).
 *    - 농장 수 상한 3곳 — 외부호출 폭증 방지(예보는 30분 캐시라 반복 열람은 저비용).
 */
import { json } from "../respond";
import { requireEnt } from "./journal";
import { getDailyForecast } from "../../src/lansmark/data/providers/forecast";
import { buildDailyBriefing, type DailyBriefing } from "../../src/lansmark/briefing/dailyBriefing";
import { fetchActiveWarnings, warningsForRegion } from "../../src/lansmark/integrations/kmaWarning";
import type { PriceResult } from "../../src/lansmark/data/providers/types";
import type { RouteFn } from "../context";

const MAX_FARMS = 3; // 브리핑 대상 농장 상한(외부 API 보호) — 초과분은 최신순 이후 생략(클라 안내)

/** SigmaRange 전체 유한성(부분형/NaN 앵커 차단) — market 라우트와 동일 기준. */
const isFiniteRange = (r: unknown): boolean => {
  const o = r as { p10?: unknown; p50?: unknown; p90?: unknown } | null;
  return !!o && [o.p10, o.p50, o.p90].every((n) => typeof n === "number" && Number.isFinite(n));
};

export const briefingRoutes: RouteFn = async (ctx, req, res, url) => {
  if (url.pathname !== "/api/briefing" || req.method !== "GET") return false;
  const ent = await requireEnt(ctx, req, res); if (!ent) return true;

  // 내 농장 = 재배중(growing) 일지. 최신 갱신순 상위 N곳만 브리핑(외부호출 가드).
  const growing = ctx.journal.listByUser(ent.userId)
    .filter((e) => e.status === "growing")
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const targets = growing.slice(0, MAX_FARMS);
  if (!targets.length) { json(res, 200, { ok: true, farms: [], totalGrowing: 0 }); return true; }

  const todayIso = new Date().toISOString().slice(0, 10);
  // KMA 특보는 전국 1회 조회(60초 캐시) 후 농장 지역별 매칭 — 키 없으면 [](무중단).
  const allWarnings = await fetchActiveWarnings().catch(() => []);

  const farms = (await Promise.all(targets.map(async (e): Promise<DailyBriefing | null> => {
    // 예보(좌표 필요 · 무키 live→mock 폴백)와 시세(live 검증분만)를 병렬 수집.
    const [forecast, priceRaw] = await Promise.all([
      e.lat != null && e.lng != null ? getDailyForecast(e.lat, e.lng).catch(() => null) : Promise.resolve(null),
      ctx.providers.price.recentWholesale(e.cropId).catch(() => null as PriceResult | null),
    ]);
    // mock/오염 시세는 브리핑 앵커로 쓰지 않는다(실시세 호도 금지 — market 라우트와 동일 정직성).
    const liveOk = !!priceRaw && isFiniteRange(priceRaw.priceKrwPerKg) && !/mock/i.test(priceRaw.source || "");
    try {
      return buildDailyBriefing(
        { journalId: e.id, cropId: e.cropId, region: e.region, plantedAt: e.plantedAt, areaM2: e.areaM2, lat: e.lat, lng: e.lng },
        { todayIso, forecast, weatherWarnings: warningsForRegion(allWarnings, e.region), price: liveOk ? priceRaw : null },
      );
    } catch { return null; } // 미등록 cropId 등 — 해당 농장만 건너뜀(브리핑 전체 무중단)
  }))).filter((b): b is DailyBriefing => b != null);

  json(res, 200, { ok: true, farms, totalGrowing: growing.length, generatedAt: todayIso });
  return true;
};
