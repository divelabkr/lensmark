/**
 * 운영 라우트 — 콘솔용 통계(읽기 전용 · 시크릿 미노출) + 토큰 실효.
 *   GET  /api/ops/stats  : 플라이휠·사용량·결제·최근활동·설정. 관리자 인증(adminOk) 게이트.
 *   POST /api/ops/revoke : 유료권한 토큰 실효(환불/분쟁 시 무력화) — jti 기반(레드팀 H4 revoke 배선).
 */
import { json, readBody } from "../respond";
import { adminOk } from "../middleware";
import type { RouteFn } from "../context";

export const opsRoutes: RouteFn = async (ctx, req, res, url) => {
  // 토큰 실효(환불/분쟁) — 관리자 전용. revoke 능력을 실제 운영 경로에 연결.
  if (url.pathname === "/api/ops/revoke" && req.method === "POST") {
    if (!adminOk(req, ctx)) { json(res, 401, { error: "관리자 인증 필요", code: "ADMIN_REQUIRED" }); return true; }
    let b: any = {};
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const jti = typeof b.jti === "string" ? b.jti.trim() : "";
    if (!jti) { json(res, 400, { error: "jti가 필요합니다.", code: "JTI_REQUIRED" }); return true; }
    ctx.entitlement.revoke(jti);
    ctx.logOps("실효", `엔티틀먼트 실효 jti=${jti.slice(0, 12)}…`);
    json(res, 200, { ok: true, revoked: jti, revokedTotal: ctx.entitlement.revokedSize() });
    return true;
  }

  if (url.pathname !== "/api/ops/stats") return false;
  if (!adminOk(req, ctx)) { json(res, 401, { error: "관리자 인증 필요", code: "ADMIN_REQUIRED" }); return true; }

  const rows = ctx.feedbackStore.all();
  const byCrop: Record<string, number> = {};
  let withActuals = 0;
  // 작물·지형버킷별 집계(검증=실측 5건↑)
  const bk: Record<string, { cropId: string; bucket: string; n: number; actuals: number }> = {};
  for (const r of rows) {
    byCrop[r.cropId] = (byCrop[r.cropId] ?? 0) + 1;
    if (r.actualYieldKg != null) withActuals++;
    const key = r.cropId + "|" + (r.terrainBucket ?? "-");
    const e = bk[key] ?? (bk[key] = { cropId: r.cropId, bucket: r.terrainBucket ?? "-", n: 0, actuals: 0 });
    e.n++;
    if (r.actualYieldKg != null) e.actuals++;
  }
  const validatedBuckets = Object.values(bk)
    .map((b) => ({ ...b, validated: b.actuals >= 5 }))
    .sort((a, b) => b.actuals - a.actuals)
    .slice(0, 20);

  json(res, 200, {
    authConfigured: !!ctx.config.adminToken,
    flywheel: { records: rows.length, withActuals, byCrop, validatedBuckets },
    analytics: ctx.analytics.snapshot(20), // 익명 수요·퍼널 집계(PII 0) — 무료 베타에서 '무엇을 얻는가'
    usage: {
      simRuns: ctx.metrics.simRuns,
      entitlementsMinted: ctx.metrics.entitlementsMinted,
      mockPaysIssued: ctx.metrics.mockPaysIssued,
      requests: ctx.metrics.reqCount,
      errors: ctx.metrics.errCount,
    },
    payment: { mode: ctx.config.tossClientKey ? "live" : "mock", requireEntitlement: ctx.config.requireEntitlement, priceKrw: ctx.config.simPriceKrw },
    recent: ctx.opsLog.slice(0, 20),
    config: { dataMode: ctx.config.dataMode, port: ctx.config.port, store: ctx.storeMode },
  });
  return true;
};
