/**
 * 정적 페이지 라우트 — 고객 앱·운영 콘솔 HTML 서빙(요청별 nonce 주입은 sendHtml가 처리).
 *   GET /  | /app    : 고객용 지도 앱(dashboard/lansmark_app.html)
 *   GET /ops | /admin : 운영자 콘솔(dashboard/lansmark_ops.html)
 *   GET /terms | /privacy : 이용약관·개인정보처리방침(초안 — 공개·PII 수집 게이트)
 * 파일이 없으면 JSON 안내로 폴백.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { json, sendHtml } from "../respond";
import type { RouteFn } from "../context";

export const pageRoutes: RouteFn = (ctx, _req, res, url) => {
  const p = url.pathname;

  if (p === "/ops" || p === "/admin") {
    try { sendHtml(res, readFileSync(join(ctx.config.dashboardDir, "lansmark_ops.html"), "utf-8")); }
    catch { json(res, 200, { msg: "운영 콘솔(dashboard/lansmark_ops.html) 없음" }); }
    return true;
  }

  // 법무 페이지(초안) — 무료 베타 공개·PII 수집의 게이트. 파일 없으면 폴백.
  if (p === "/terms" || p === "/privacy") {
    const file = p === "/terms" ? "lansmark_terms.html" : "lansmark_privacy.html";
    try { sendHtml(res, readFileSync(join(ctx.config.dashboardDir, file), "utf-8")); }
    catch { json(res, 200, { msg: `${file} 없음(초안 준비 중)` }); }
    return true;
  }

  if (p === "/" || p === "/app") {
    try { sendHtml(res, readFileSync(join(ctx.config.dashboardDir, "lansmark_app.html"), "utf-8")); }
    catch {
      json(res, 200, {
        msg: "LENSMARK dev server",
        endpoints: ["/api/health", "/api/config", "/api/geocode", "/api/parcel", "/api/terrain", "/api/landclass", "/api/recommend", "POST /api/simulate", "POST /api/feedback"],
      });
    }
    return true;
  }

  return false;
};
