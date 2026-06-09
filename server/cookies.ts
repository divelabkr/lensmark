/**
 * 쿠키 헬퍼 — 세션을 httpOnly 쿠키로 주고받기(S5: XSS 토큰탈취 방어).
 *   읽기(sessionTokenFrom): 쿠키(lm_session) 우선 → x-lansmark-session 헤더 폴백(테스트·비브라우저 API 하위호환=듀얼모드).
 *   쓰기: HttpOnly(JS 접근 차단) · SameSite=Strict(CSRF 방어) · Path=/ · Max-Age. Secure는 운영(HTTPS)만 —
 *         dev(http localhost)에서 Secure를 붙이면 브라우저가 쿠키를 저장/전송하지 않으므로 prod에서만 부여.
 */
import type * as http from "node:http";

export const SESSION_COOKIE = "lm_session";

/** Cookie 헤더 파싱(name→value, URL 디코드). */
export function parseCookies(req: http.IncomingMessage): Record<string, string> {
  const raw = req.headers["cookie"];
  const out: Record<string, string> = {};
  if (typeof raw !== "string") return out;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k && !(k in out)) { try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); } }
  }
  return out;
}

/** 요청에서 세션 토큰 추출 — 쿠키(lm_session·브라우저) 우선, 없으면 x-lansmark-session 헤더(테스트·API). */
export function sessionTokenFrom(req: http.IncomingMessage): string {
  const c = parseCookies(req)[SESSION_COOKIE];
  if (c) return c;
  const h = req.headers["x-lansmark-session"];
  return typeof h === "string" ? h : "";
}

/** Set-Cookie 값 — 세션 쿠키 발급(httpOnly·SameSite=Strict). secure=true는 운영(HTTPS)만. */
export function sessionCookie(token: string, maxAgeSec: number, secure: boolean): string {
  const attrs = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "HttpOnly", "SameSite=Strict", "Path=/", `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

/** Set-Cookie 값 — 세션 쿠키 파기(로그아웃·Max-Age=0). */
export function clearSessionCookie(secure: boolean): string {
  const attrs = [`${SESSION_COOKIE}=`, "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}
