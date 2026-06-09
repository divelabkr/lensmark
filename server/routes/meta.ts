/**
 * 메타 라우트 — 서버/통합 상태·버전·프론트 설정.
 *   GET /api/health  : 가동·버전·통합 준비도·결제 모드
 *   GET /api/version : 버전 + 릴리스 노트(프론트 변경점 팝업 소스)
 *   GET /api/config  : 프론트 부팅 설정(데이터모드·타일 URL·결제)
 */
import { json } from "../respond";
import { paymentSummary } from "../config";
import { integrationReadiness } from "../../src/lansmark/data/providers";
import { APP_VERSION, RELEASES } from "../../src/lansmark/version";
import { tileUrlTemplate } from "../../src/lansmark/geo/vworld";
import type { RouteFn } from "../context";

export const metaRoutes: RouteFn = (ctx, _req, res, url) => {
  const p = url.pathname;

  if (p === "/api/health") {
    json(res, 200, { ok: true, version: APP_VERSION, store: ctx.storeMode, ...integrationReadiness(), payment: paymentSummary(ctx.config) });
    return true;
  }

  if (p === "/api/version") {
    json(res, 200, { version: APP_VERSION, releases: RELEASES.slice(0, 8) }); // 최신 8개만(전체=27KB 다이어트) — 변경점 팝업 델타엔 충분
    return true;
  }

  if (p === "/api/config") {
    json(res, 200, {
      mode: ctx.config.dataMode,
      version: APP_VERSION,
      // VWorld 키 있으면 위성/하이브리드/베이스 타일 URL, 없으면 null(프론트는 OSM 폴백)
      tiles: ctx.config.vworldKey ? {
        satellite: tileUrlTemplate("Satellite", ctx.config.vworldKey),
        hybrid: tileUrlTemplate("Hybrid", ctx.config.vworldKey),
        base: tileUrlTemplate("Base", ctx.config.vworldKey),
      } : null,
      payment: {
        mode: ctx.config.tossClientKey ? "live" : "mock",
        priceKrw: ctx.config.simPriceKrw,
        tossClientKey: ctx.config.tossClientKey ?? null,
        required: ctx.config.requireEntitlement,
      },
    });
    return true;
  }

  return false;
};
