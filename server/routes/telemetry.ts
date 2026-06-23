/**
 * 클라이언트 에러 텔레메트리 — POST /api/client-error. 브라우저 uncaught 에러를 받아 ops에 가시화 + (웹훅 설정 시) 실시간 사장님 경보.
 *   경계: sensitive 레이트리밋(middleware) · 바디 상한(readBody) · PII 0(메시지/소스만 절단) · 204(반사 없음) · '새 distinct'만 경보(스팸 차단).
 */
import { readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { notifyAlertWebhook } from "../../src/lansmark/ops/clientErrors";
import type { RouteFn } from "../context";

export const telemetryRoutes: RouteFn = async (ctx, req, res, url) => {
  // ── 환경 진단 비콘(관측 전용·복구 없음) — 먹통/SW갇힘/오프라인/콜드스타트를 앱이 부팅 때 자동 보고.
  //   window.onerror(아래 client-error)는 'JS 에러'만 잡는다. 이건 '안 뜨는/이상한 상태'(에러 아님)를 관측한다.
  if (url.pathname === "/api/client-diag" && req.method === "POST") {
    let d: Record<string, unknown> = {};
    try { const p = JSON.parse((await readBody(req)) || "{}"); if (isObject(p)) d = p; } catch { /* 깨진 바디 → 빈 객체 */ }
    const guide = ctx.clientDiag.record({
      sw: typeof d.sw === "string" ? d.sw.slice(0, 20) : undefined,
      offlinePrev: d.offlinePrev === true,
      bootMs: typeof d.bootMs === "number" && Number.isFinite(d.bootMs) ? Math.min(60000, Math.max(0, d.bootMs)) : undefined,
      online: d.online === true,
      cacheVer: typeof d.cacheVer === "string" ? d.cacheVer.slice(0, 30) : undefined,
      viewport: d.viewport === "mobile" || d.viewport === "desktop" ? d.viewport : undefined,
    });
    if (guide) { ctx.logOps("환경진단", guide.guide); void notifyAlertWebhook(`📡 [LENSMARK] ${guide.guide}`); } // 가이드(점검 권장)만 — 자동 복구 트리거 없음
    res.writeHead(204); res.end(); // 반사 0(client-error와 동일 보안)
    return true;
  }
  if (url.pathname !== "/api/client-error" || req.method !== "POST") return false;
  let b: Record<string, unknown> = {};
  try { const p = JSON.parse((await readBody(req)) || "{}"); if (isObject(p)) b = p; } catch { /* 깨진/과대 바디 → 빈 객체(아래서 204) */ }
  const message = typeof b.message === "string" ? b.message : "";
  if (!message) { res.writeHead(204); res.end(); return true; } // 빈 보고는 조용히 무시(반사 0)
  const ua = String(req.headers["user-agent"] || "").slice(0, 180);
  const row = ctx.clientErrors.record({
    message,
    source: typeof b.source === "string" ? b.source : undefined,
    url: typeof b.url === "string" ? b.url : undefined,
    ua,
  });
  if (row) { // 새 distinct 또는 같은 에러 '볼륨 폭증'(50회 배수, OP-3) → 활동로그 + 실시간 경보. 그 외 반복은 카운트만(스팸 0)
    const surge = row.n >= 50; // n≥50 = 조용히 대량 반복되던 에러(폭증)
    ctx.logOps("클라이언트에러", `${surge ? `폭증 ${row.n}회 · ` : ""}${row.msg.slice(0, 80)}${row.src ? " @ " + row.src.slice(0, 60) : ""}`);
    void notifyAlertWebhook(`⚠ [LENSMARK] ${surge ? `클라이언트 에러 폭증(${row.n}회)` : "새 클라이언트 에러"}\n${row.msg.slice(0, 160)}${row.src ? "\n  ↳ " + row.src.slice(0, 120) : ""}`);
  }
  res.writeHead(204); res.end();
  return true;
};
