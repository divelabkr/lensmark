/**
 * 보안 미들웨어 (의존성 0) — 검증된 OSS 표준을 직접 구현.
 *  - 보안 헤더: helmet 기본셋 상당(CSP·nosniff·frameguard·referrer·permissions·HSTS).
 *  - CSP: HTML은 인라인 스크립트 nonce + 외부 호스트 허용목록, API(JSON)는 default-src 'none'.
 *  - 레이트리밋: express-rate-limit 상당(고정창·IP키·민감라우트 별도).
 *  - CORS: 허용목록 + 프리플라이트.
 *  - 입력 크기/값 가드.
 * 모든 함수는 순수·테스트 가능(서버 부팅 불필요).
 */
import * as crypto from "node:crypto";
import type * as http from "node:http";

/* ───────────────────────── CSP ───────────────────────── */

// 앱이 실제로 쓰는 외부 출처(감사로 확인): Leaflet(cdnjs) · Google Fonts.
const SCRIPT_CDN = "https://cdnjs.cloudflare.com";
const STYLE_HOSTS = "https://cdnjs.cloudflare.com https://fonts.googleapis.com";
const FONT_HOSTS = "https://fonts.gstatic.com";

/** 요청마다 새 nonce(인라인 `<script>` 허용용). */
export function genNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

/**
 * HTML 페이지용 CSP.
 *  - script: 'self' + nonce + cdnjs (← 'unsafe-inline' 미사용 = 주입 스크립트 차단).
 *  - style: 'unsafe-inline'(Leaflet 런타임 인라인 스타일) + 폰트/CDN.
 *  - img: 지도 타일이 다수 호스트라 https: 허용(스크립트 아님 → 저위험).
 *  - connect: 'self'(모든 /api/* 동일 출처).
 */
// Toss 결제: SDK·게이트웨이(apigw)·로깅(event) 등 여러 서브도메인 사용 → 와일드카드 허용(키 연결 시 활성, Toss 공식 권장).
const TOSS = "https://*.tosspayments.com";
export function htmlCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${SCRIPT_CDN} ${TOSS}`,
    `style-src 'self' 'unsafe-inline' ${STYLE_HOSTS}`,
    `font-src 'self' ${FONT_HOSTS}`,
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${TOSS}`,          // SDK가 apigw-sandbox/event.tosspayments.com 등에 POST
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${TOSS}`,          // 결제창 리다이렉트/제출
    "frame-ancestors 'none'",
    `frame-src ${TOSS}`,                    // 결제창 iframe
  ].join("; ");
}

/** API(JSON) 응답용 CSP — 리소스 로드 불필요 → 전면 차단. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'";

/** 인라인 `<script>`(속성 없는 것)에 nonce 부여. 외부 `<script src>`는 호스트 허용으로 통과. */
export function injectNonce(html: string, nonce: string): string {
  return html.replace(/<script>/g, `<script nonce="${nonce}">`);
}

/* ─────────────────── 공통 보안 헤더(helmet 상당) ─────────────────── */

export function baseSecurityHeaders(opts: { https: boolean }): Record<string, string> {
  const h: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), browsing-topics=()",
    "X-DNS-Prefetch-Control": "off",
  };
  // HSTS는 https에서만 의미(평문에 걸면 위험) → 프록시 X-Forwarded-Proto 신뢰.
  if (opts.https) h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return h;
}

/** https 여부. X-Forwarded-Proto는 신뢰 프록시(trustProxyHops>0)일 때만 신뢰(위조 차단). */
export function isHttps(req: http.IncomingMessage, trustProxyHops = 0): boolean {
  if (trustProxyHops > 0) {
    const xf = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim().toLowerCase();
    if (xf) return xf === "https";
  }
  return (req.socket as { encrypted?: boolean } | undefined)?.encrypted === true;
}

/* ───────────────────────── CORS ───────────────────────── */

export type OriginPolicy = "*" | string[];

/** `LANSMARK_CORS_ORIGIN`: 비었거나 '*' → 전체 허용. "a,b,c" → 허용목록. */
export function parseOrigins(env: string | undefined): OriginPolicy {
  const v = (env ?? "*").trim();
  if (v === "" || v === "*") return "*";
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function corsHeaders(reqOrigin: string | undefined, allow: OriginPolicy): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-lansmark-entitlement, x-lansmark-admin",
    "Access-Control-Max-Age": "600",
  };
  if (allow === "*") {
    h["Access-Control-Allow-Origin"] = "*";
  } else {
    h["Vary"] = "Origin";
    if (reqOrigin && allow.includes(reqOrigin)) h["Access-Control-Allow-Origin"] = reqOrigin; // 미허용 → ACAO 생략(브라우저가 차단)
  }
  return h;
}

/* ──────────────── 레이트리밋(고정창 · IP키) ──────────────── */

export interface RateResult { ok: boolean; retryAfterSec: number; remaining: number }

export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}
  check(key: string): RateResult {
    const t = this.now();
    let e = this.hits.get(key);
    if (!e || t >= e.reset) { e = { n: 0, reset: t + this.windowMs }; this.hits.set(key, e); }
    e.n++;
    if (this.hits.size > 5000) this.sweep(t); // 메모리 가드(만료 엔트리 청소)
    if (e.n > this.limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((e.reset - t) / 1000)), remaining: 0 };
    return { ok: true, retryAfterSec: 0, remaining: Math.max(0, this.limit - e.n) };
  }
  private sweep(t: number): void { for (const [k, v] of this.hits) if (t >= v.reset) this.hits.delete(k); }
}

/** 유효 IP(IPv4/IPv6) 형식만 신뢰 — 임의 문자열로 레이트리밋 키 위조 방지. */
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9A-Fa-f:.]{2,45}$/;
/**
 * 신뢰 클라이언트 IP. trustProxyHops=0(기본)이면 X-Forwarded-For를 **무시**하고 소켓 IP만 사용(위조 차단).
 * N>0이면 XFF 체인의 '오른쪽에서 N번째'(신뢰 프록시가 append한 값)만 채택하고 유효 IP인지 검증.
 *  - 직노출(프록시 없음) 기본값 0 → XFF 헤더 회전으로 레이트리밋 우회 불가(레드팀 H1).
 *  - nginx/CF 뒤 운영: LANSMARK_TRUST_PROXY_HOPS=1(체인 길이에 맞게).
 */
export function clientIp(req: http.IncomingMessage, trustProxyHops = 0): string {
  const socketIp = req.socket?.remoteAddress || "unknown";
  if (trustProxyHops <= 0) return socketIp;
  const chain = String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const cand = chain[chain.length - trustProxyHops];
  return cand && IP_RE.test(cand) ? cand : socketIp;
}

/* ──────────────── 입력 값 가드(변조·이상치 방지) ──────────────── */

/** 0 이상·유한·상한 클램프(피드백 변조/이상치 차단). 부적합 → undefined. */
export function clampNonNeg(v: unknown, max: number): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(n, max);
}
