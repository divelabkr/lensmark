/**
 * 데일리 브리핑 라우트 — "오늘 내 농장" 홈의 데이터 + 아침 브리핑 웹푸시 발송(운영자 트리거).
 *   GET  /api/briefing         : 내 재배중 일지(=내 농장)별 예보·위험·단계·병해충·특보·시세 브리핑.
 *   POST /api/ops/push-briefing: (관리자) 푸시 구독자 전원에게 각자의 아침 브리핑 발송 — 외부 크론
 *                                (Cloud Scheduler 등 · HUMAN GATE)이 아침마다 이 엔드포인트를 호출한다.
 *   경계:
 *    - 신원 = journal과 동일 규칙(requireEnt 공유): 무료베타=익명/계정 격리 · 유료=엔티틀먼트(+실효 검사).
 *    - 외부조회(예보·특보·시세)는 병렬 + 각자 실패 시 폴백(무중단). 예보 mock이면 demo=true(데모 라벨 강제).
 *    - 농장 수 상한 3곳 — 외부호출 폭증 방지(예보는 30분 캐시라 반복 열람은 저비용).
 *    - 발송은 pushSender(라이브=VAPID env·allowlist SSRF 차단). 만료 구독(404/410)은 즉시 파기.
 */
import { json } from "../respond";
import { requireEnt } from "./journal";
import { blockedOpsMutation } from "../middleware";
import { getDailyForecast } from "../../src/lansmark/data/providers/forecast";
import { buildDailyBriefing, type DailyBriefing } from "../../src/lansmark/briefing/dailyBriefing";
import { briefingPushMessage } from "../../src/lansmark/briefing/briefingPush";
import { fetchActiveWarnings, warningsForRegion } from "../../src/lansmark/integrations/kmaWarning";
import type { PushSubscriptionEntry } from "../../src/lansmark/integrations/push";
import type { PriceResult } from "../../src/lansmark/data/providers/types";
import type { Ctx, RouteFn } from "../context";

const MAX_FARMS = 3;        // 브리핑 대상 농장 상한(외부 API 보호) — 초과분은 최신순 이후 생략(클라 안내)
const MAX_PUSH_PER_RUN = 500; // 1회 발송 상한(요청 장기화·푸시 서비스 폭주 방지) — 초과분은 다음 크론 회차

/** SigmaRange 전체 유한성(부분형/NaN 앵커 차단) — market 라우트와 동일 기준. */
const isFiniteRange = (r: unknown): boolean => {
  const o = r as { p10?: unknown; p50?: unknown; p90?: unknown } | null;
  return !!o && [o.p10, o.p50, o.p90].every((n) => typeof n === "number" && Number.isFinite(n));
};

/**
 * 사용자 1명의 브리핑 목록 — GET(내 브리핑)과 푸시 발송(구독자별)이 공유하는 조립 코어.
 *   재배중 일지 최신순 상위 N곳 · 특보는 호출측이 1회 조회해 주입(전국 60초 캐시 재사용).
 */
export async function buildUserBriefings(ctx: Ctx, userId: string, allWarnings: Awaited<ReturnType<typeof fetchActiveWarnings>>): Promise<{ farms: DailyBriefing[]; totalGrowing: number }> {
  const growing = ctx.journal.listByUser(userId)
    .filter((e) => e.status === "growing")
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const todayIso = new Date().toISOString().slice(0, 10);
  const farms = (await Promise.all(growing.slice(0, MAX_FARMS).map(async (e): Promise<DailyBriefing | null> => {
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
  return { farms, totalGrowing: growing.length };
}

export const briefingRoutes: RouteFn = async (ctx, req, res, url) => {
  // ── 내 브리핑 조회(앱 홈) ──
  if (url.pathname === "/api/briefing" && req.method === "GET") {
    const ent = await requireEnt(ctx, req, res); if (!ent) return true;
    // KMA 특보는 전국 1회 조회(60초 캐시) 후 농장 지역별 매칭 — 키 없으면 [](무중단).
    const allWarnings = await fetchActiveWarnings().catch(() => []);
    const { farms, totalGrowing } = await buildUserBriefings(ctx, ent.userId, allWarnings);
    json(res, 200, { ok: true, farms, totalGrowing, generatedAt: new Date().toISOString().slice(0, 10) });
    return true;
  }

  // ── 아침 브리핑 발송(관리자·크론 트리거) — 구독자별 '자기 농장' 브리핑을 웹푸시로 ──
  if (url.pathname === "/api/ops/push-briefing" && req.method === "POST") {
    if (blockedOpsMutation(req, res, ctx)) return true; // 관리자 토큰 게이트(ops 쓰기 SSOT)
    // 구독을 구독자별로 묶는다(한 사람이 여러 기기 구독 가능 — 같은 브리핑을 각 기기로).
    //   ⚠ 유료 모드 한계(정직): 푸시 구독자ID(acct/anon)와 유료 일지 userId(order:*)가 다를 수 있음 —
    //     결제-계정 결속(로드맵 §3 잔여) 전까지는 무료베타(익명/계정 신원 일치)에서 정합.
    const bySubscriber = new Map<string, PushSubscriptionEntry[]>();
    for (const en of ctx.pushSubs.entries()) {
      if (!en.subscriberId) continue; // 소유자 불명 구독은 맞춤 발송 불가(스킵)
      const list = bySubscriber.get(en.subscriberId) ?? [];
      list.push(en); bySubscriber.set(en.subscriberId, list);
    }
    const allWarnings = await fetchActiveWarnings().catch(() => []);
    let sent = 0, failed = 0, gone = 0, skippedNoFarm = 0, capped = false;
    for (const [uid, subs] of bySubscriber) {
      if (sent + failed >= MAX_PUSH_PER_RUN) { capped = true; break; } // 상한 — 나머지는 다음 회차
      const { farms } = await buildUserBriefings(ctx, uid, allWarnings);
      if (!farms.length) { skippedNoFarm += subs.length; continue; } // 농장 없는 구독자(탐색만) — 발송 없음
      const msg = briefingPushMessage(farms[0], farms.length);
      for (const en of subs) {
        const r = await ctx.pushSender.send(en.sub, msg);
        if (r.ok) sent++;
        else if (r.gone) { ctx.pushSubs.remove(en.sub.endpoint); gone++; } // 만료 구독 즉시 파기(죽은 endpoint 재발송 방지)
        else failed++;
      }
    }
    ctx.logOps("푸시", `아침 브리핑 발송 ${sent}건 · 실패 ${failed} · 만료정리 ${gone} · 농장없음 ${skippedNoFarm} · ${ctx.pushSender.mode}${capped ? " · 상한도달" : ""}`);
    json(res, 200, { ok: true, senderMode: ctx.pushSender.mode, subscribers: bySubscriber.size, sent, failed, gone, skippedNoFarm, capped });
    return true;
  }

  return false;
};
