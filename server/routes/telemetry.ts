/**
 * 클라이언트 에러 텔레메트리 — POST /api/client-error. 브라우저 uncaught 에러를 받아 ops에 가시화 + (웹훅 설정 시) 실시간 사장님 경보.
 *   경계: sensitive 레이트리밋(middleware) · 바디 상한(readBody) · PII 0(메시지/소스만 절단) · 204(반사 없음) · '새 distinct'만 경보(스팸 차단).
 */
import { readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { notifyAlertWebhook } from "../../src/lansmark/ops/clientErrors";
import type { RouteFn } from "../context";

export const telemetryRoutes: RouteFn = async (ctx, req, res, url) => {
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
  if (row) { // 새 distinct 에러만 → 활동로그 + 실시간 경보(채널 설정 시). 같은 에러 반복은 카운트만(스팸 0)
    ctx.logOps("클라이언트에러", `${row.msg.slice(0, 80)}${row.src ? " @ " + row.src.slice(0, 60) : ""}`);
    void notifyAlertWebhook(`⚠ [LENSMARK] 새 클라이언트 에러\n${row.msg.slice(0, 160)}${row.src ? "\n  ↳ " + row.src.slice(0, 120) : ""}`);
  }
  res.writeHead(204); res.end();
  return true;
};
