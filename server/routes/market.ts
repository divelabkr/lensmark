/**
 * 출하 시세·납품처 라우트 — 무료(가입 유도 훅). 판로별 기대 단가·도매 대비% 비교.
 *   GET /api/market?cropId=&yieldKg=&region= : KAMIS 실도매가를 앵커로 판로 비교(compareSalesChannels)
 *   경계: 무료(엔티틀먼트 불필요) · KAMIS 쿼터 보호 위해 sensitive 레이트리밋 버킷(middleware) · 실패 시 seed 폴백(무중단).
 */
import { json } from "../respond";
import { finiteParam } from "../../src/lansmark/api/httpUtil";
import { compareSalesChannels } from "../../src/lansmark/market/salesChannels";
import type { PriceResult } from "../../src/lansmark/data/providers/types";
import type { RouteFn } from "../context";
import { fetchMarketSignals } from "../../src/lansmark/market/cropTrend";

const SAFE_CROP = /^[a-z_]{1,40}$/; // cropId 화이트리스트(비신뢰 입력 차단)
/** SigmaRange가 p10/p50/p90 모두 유한수인지(부분형/NaN 앵커 차단). */
const isFiniteRange = (r: unknown): boolean => {
  const o = r as { p10?: unknown; p50?: unknown; p90?: unknown } | null;
  return !!o && [o.p10, o.p50, o.p90].every((n) => typeof n === "number" && Number.isFinite(n));
};

export const marketRoutes: RouteFn = async (ctx, req, res, url) => {
  if (url.pathname !== "/api/market") return false;
  const q = url.searchParams;
  const cropId = (q.get("cropId") || "").trim();
  if (!SAFE_CROP.test(cropId)) { json(res, 400, { error: "유효한 cropId가 필요합니다." }); return true; }
  const yRaw = finiteParam(q.get("yieldKg"));
  const yieldKg = yRaw != null && yRaw > 0 ? Math.min(yRaw, 1e9) : undefined; // 0↑·상한

  // 실도매가 앵커(KAMIS live). 키 없거나 미검증 품목/타임아웃이면 null → compareSalesChannels가 seed 폴백.
  let live: PriceResult | null = null;
  try { live = await ctx.providers.price.recentWholesale(cropId); } catch { /* 폴백(무중단) */ }
  // ⚠ '실시세 앵커'는 진짜 live일 때만 — mock/데모 가격(source에 'mock')을 실측처럼 호도하지 않는다(레드팀 F1).
  //   + SigmaRange 전체 유한성 검증(부분형/NaN 앵커 차단 · 비신뢰 provider 방어).
  const liveOk = !!live && isFiniteRange(live.priceKrwPerKg) && !/mock/i.test(live.source || "");

  try {
    const market = compareSalesChannels(cropId, {
      liveWholesale: liveOk ? live!.priceKrwPerKg : undefined,
      liveSource: liveOk ? live!.source : undefined,
      yieldKg,
    });
    json(res, 200, { ok: true, market });
  } catch { json(res, 400, { error: "알 수 없는 작물입니다." }); } // getCropProfile throw(미존재 cropId)
  return true;
};

/**
 * GET /api/crop-trend : 작물 시장 트렌드 3섹터(volume 많이/premium 비싸게/niche 특수) — Perplexity 시장조사·주기캐시·출처필수.
 *   'crop-first' 진입(작물 먼저)의 데이터. 키 없거나 출처 0개·파싱 실패면 trends:null(무중단 — 클라는 '땅 먼저' 흐름으로 폴백).
 *   ⚠ 숫자(가격)는 여기서 주지 않는다 — 섹터 분류·맥락만. 실제 가격은 /api/market(출하시세)·작물 카드의 crops.seed 실값.
 */
export const cropTrendRoutes: RouteFn = async (_ctx, _req, res, url) => {
  if (url.pathname !== "/api/crop-trend") return false;
  const signals = await fetchMarketSignals(); // 키 없음·출처0·파싱실패 → null. 표 조립(난이도·단가 합침)은 S1c.
  json(res, 200, { ok: true, signals });
  return true;
};
