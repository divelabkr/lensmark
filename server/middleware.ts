/**
 * 요청 진입부 보안 파이프라인 + 관리자 인증.
 *   책임: 모든 응답에 공통 보안 헤더·CORS를 깔고, CORS 프리플라이트와 레이트리밋을 처리한다.
 *   보안 "원시함수"(헤더 생성·CSP·레이트리미터)는 src/lansmark/api/security.ts에 있고, 여기선 그걸 "요청에 적용"만 한다.
 */
import * as crypto from "node:crypto";
import type * as http from "node:http";
import { baseSecurityHeaders, isHttps, corsHeaders, API_CSP, clientIp } from "../src/lansmark/api/security";
import { json } from "./respond";
import type { Ctx } from "./context";

/** 민감 라우트 — 더 엄격한 레이트리밋. 결제·시뮬·피드백·웹훅 + 외부 API 쿼터를 쓰는 지오 조회(geocode/parcel/terrain, 레드팀 M8) + 인증 쓰기(journal) + PII·구독 저장(alerts·push subscribe = 스토어 증가 플러드 차단). */
const SENSITIVE_RE = /^\/api\/(simulate|feedback|pay\/|pg\/|geocode|parcel|terrain|journal|market|monitor|foreign|retail-price|account\/auth|account\/link|alerts|push\/(?:un)?subscribe|client-error)/; // client-error=공개 텔레메트리 · retail-price·alerts=외부 API 쿼터 보호(레드팀 L3)

/**
 * 공통 보안 헤더 + CORS를 setHeader로 깔고(이후 writeHead가 Content-Type/CSP만 덮어씀),
 * 프리플라이트·레이트리밋을 처리한다.
 * @returns true = 이 미들웨어가 응답을 종료함(라우팅 중단). false = 계속 진행.
 */
export function applySecurity(req: http.IncomingMessage, res: http.ServerResponse, ctx: Ctx, pathname: string): boolean {
  // 1) 공통 헤더(helmet 상당) + CORS — 모든 응답에 적용.
  const cors = corsHeaders(req.headers.origin, ctx.config.corsAllow);
  if (pathname.startsWith("/api/ops")) delete (cors as Record<string, string>)["Access-Control-Allow-Origin"]; // 운영 콘솔은 cross-origin 공유 금지(dev-open이어도 타 출처 JS 판독 차단·방어심도·레드팀 P2)
  const baseH = { ...baseSecurityHeaders({ https: isHttps(req, ctx.config.trustProxyHops) }), ...cors };
  for (const k in baseH) res.setHeader(k, baseH[k]);
  res.setHeader("Content-Security-Policy", API_CSP); // 기본 strict(JSON/404) · HTML 라우트는 sendHtml이 덮어씀

  // 2) CORS 프리플라이트 → 본문 없이 204.
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return true; }

  // 3) 레이트리밋(IP 고정창) — /api/* 만, 민감 라우트는 sensitive 버킷.
  if (pathname.startsWith("/api/")) {
    const ip = clientIp(req, ctx.config.trustProxyHops);
    const r = SENSITIVE_RE.test(pathname) ? ctx.limiters.sensitive.check("s:" + ip) : ctx.limiters.global.check("g:" + ip);
    if (!r.ok) {
      res.setHeader("Retry-After", String(r.retryAfterSec));
      json(res, 429, { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.", code: "RATE_LIMITED" });
      return true;
    }
    ctx.metrics.reqCount++; // 통과한 API 요청만 카운트
  }
  return false;
}

/** 운영 콘솔 관리자 인증(timing-safe 비교). 토큰 미설정이면 개발 오픈(true). */
export function adminOk(req: http.IncomingMessage, ctx: Ctx): boolean {
  const token = ctx.config.adminToken;
  if (!token) return true;
  const got = Buffer.from((req.headers["x-lansmark-admin"] as string) ?? ""), exp = Buffer.from(token);
  return got.length === exp.length && crypto.timingSafeEqual(got, exp);
}
