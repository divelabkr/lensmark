import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  genNonce, injectNonce, htmlCsp, API_CSP, baseSecurityHeaders, isHttps,
  parseOrigins, corsHeaders, RateLimiter, clientIp, clampNonNeg,
} from "../api/security";
import type * as http from "node:http";
import { bootSafety, type Config } from "../../../server/config";

const fakeReq = (headers: Record<string, string>, remote = "9.9.9.9"): http.IncomingMessage =>
  ({ headers, socket: { remoteAddress: remote } } as unknown as http.IncomingMessage);

describe("CSP", () => {
  it("genNonce is random 16-byte base64, unique per call", () => {
    const a = genNonce(), b = genNonce();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64").length).toBe(16);
  });

  it("htmlCsp carries the nonce and locks scripts (no 'unsafe-inline' in script-src)", () => {
    const csp = htmlCsp("ABC123");
    expect(csp).toContain("script-src 'self' 'nonce-ABC123' https://cdnjs.cloudflare.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    // script-src 구간엔 unsafe-inline 금지(스타일은 허용)
    const scriptDir = csp.split(";").find((s) => s.trim().startsWith("script-src"))!;
    expect(scriptDir).not.toContain("unsafe-inline");
  });

  it("API_CSP blocks all resource loads", () => {
    expect(API_CSP).toContain("default-src 'none'");
    expect(API_CSP).toContain("frame-ancestors 'none'");
  });

  it("injectNonce tags inline <script> but leaves external <script src> intact", () => {
    const html = `<script src="https://cdnjs.cloudflare.com/x.js"></script>\n<script>var a=1;</script>`;
    const out = injectNonce(html, "N1");
    expect(out).toContain(`<script nonce="N1">var a=1;</script>`);
    expect(out).toContain(`<script src="https://cdnjs.cloudflare.com/x.js"></script>`); // 외부는 그대로
    expect(out).not.toContain(`<script nonce="N1" src=`);
  });
});

describe("security headers (helmet-equivalent)", () => {
  it("always sets nosniff / frameguard / referrer / permissions", () => {
    const h = baseSecurityHeaders({ https: false });
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("geolocation=(self)"); // 내 위치 기능 허용
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Strict-Transport-Security"]).toBeUndefined(); // 평문엔 HSTS 금지
  });
  it("adds HSTS only over https", () => {
    expect(baseSecurityHeaders({ https: true })["Strict-Transport-Security"]).toContain("max-age=31536000");
  });
  it("isHttps trusts X-Forwarded-Proto ONLY when proxy trusted (trustProxyHops>0)", () => {
    expect(isHttps(fakeReq({ "x-forwarded-proto": "https, http" }), 1)).toBe(true); // 신뢰 프록시
    expect(isHttps(fakeReq({ "x-forwarded-proto": "https" }))).toBe(false);          // 기본 0 → XFP 무시(위조 차단)
    expect(isHttps(fakeReq({ "x-forwarded-proto": "http" }), 1)).toBe(false);
    expect(isHttps(fakeReq({}))).toBe(false);
  });
});

describe("CORS", () => {
  it("parseOrigins: empty/'*' → wildcard, csv → allowlist", () => {
    expect(parseOrigins(undefined)).toBe("*");
    expect(parseOrigins("  ")).toBe("*");
    expect(parseOrigins("*")).toBe("*");
    expect(parseOrigins("https://a.com, https://b.com")).toEqual(["https://a.com", "https://b.com"]);
  });
  it("wildcard echoes *", () => {
    expect(corsHeaders("https://evil.com", "*")["Access-Control-Allow-Origin"]).toBe("*");
  });
  it("allowlist echoes only matching origin and sets Vary", () => {
    const allow = ["https://app.lansmark.kr"];
    const ok = corsHeaders("https://app.lansmark.kr", allow);
    expect(ok["Access-Control-Allow-Origin"]).toBe("https://app.lansmark.kr");
    expect(ok["Vary"]).toBe("Origin");
    const blocked = corsHeaders("https://evil.com", allow);
    expect(blocked["Access-Control-Allow-Origin"]).toBeUndefined(); // 미허용 → 헤더 생략 → 브라우저 차단
  });
  it("always advertises allowed methods + custom auth headers for preflight", () => {
    const h = corsHeaders(undefined, "*");
    expect(h["Access-Control-Allow-Methods"]).toContain("POST");
    expect(h["Access-Control-Allow-Headers"]).toContain("x-lansmark-entitlement");
    expect(h["Access-Control-Allow-Headers"]).toContain("x-lansmark-admin");
  });
});

describe("RateLimiter (fixed window)", () => {
  it("allows up to limit then 429s, with Retry-After, until window resets", () => {
    let t = 1000;
    const rl = new RateLimiter(3, 60_000, () => t);
    expect(rl.check("ip").ok).toBe(true);  // 1
    expect(rl.check("ip").ok).toBe(true);  // 2
    expect(rl.check("ip").remaining).toBe(0); // 3 (limit)
    const over = rl.check("ip");            // 4 → block
    expect(over.ok).toBe(false);
    expect(over.retryAfterSec).toBeGreaterThan(0);
    t += 60_001; // 창 리셋
    expect(rl.check("ip").ok).toBe(true);
  });
  it("isolates keys (per-IP)", () => {
    let t = 0; const rl = new RateLimiter(1, 1000, () => t);
    expect(rl.check("a").ok).toBe(true);
    expect(rl.check("b").ok).toBe(true);  // 다른 키는 영향 없음
    expect(rl.check("a").ok).toBe(false); // 같은 키는 차단
  });
});

describe("clientIp (X-Forwarded-For 위조 차단 — 레드팀 H1)", () => {
  it("기본(trustProxyHops=0): XFF 무시하고 소켓 IP만", () => {
    expect(clientIp(fakeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, "10.0.0.1"))).toBe("10.0.0.1"); // 위조 XFF 무시
    expect(clientIp(fakeReq({}, "10.0.0.1"))).toBe("10.0.0.1");
  });
  it("trustProxyHops=N: XFF 우측에서 N번째(신뢰 프록시 append) 채택 + 유효 IP만", () => {
    expect(clientIp(fakeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, "10.0.0.1"), 1)).toBe("5.6.7.8"); // 1홉 → 우측 첫
    expect(clientIp(fakeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, "10.0.0.1"), 2)).toBe("1.2.3.4"); // 2홉 → 클라
    expect(clientIp(fakeReq({ "x-forwarded-for": "notanip" }, "10.0.0.1"), 1)).toBe("10.0.0.1");         // 무효 IP → 소켓
  });
});

describe("clampNonNeg (feedback anti-poisoning)", () => {
  it("clamps to [0, max], rejects negatives/NaN", () => {
    expect(clampNonNeg(50, 100)).toBe(50);
    expect(clampNonNeg(999, 100)).toBe(100); // 상한
    expect(clampNonNeg(-1, 100)).toBeUndefined();
    expect(clampNonNeg("nope", 100)).toBeUndefined();
    expect(clampNonNeg(Infinity, 100)).toBeUndefined();
    expect(clampNonNeg(0, 100)).toBe(0);
  });
});

// 서버 배선 회귀가드(소스 존재 검증) — 분해 후에도 보안 미들웨어가 빠지지 않게(모듈별 위치 확인).
describe("server wiring", () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  const mw = read("server/middleware.ts");
  const respond = read("server/respond.ts");
  const pages = read("server/routes/pages.ts");
  const cfg = read("server/config.ts");
  const dev = read("server/devServer.ts");

  it("middleware applies base security headers + CORS + API_CSP at request entry", () => {
    expect(mw).toContain("isHttps(req, ctx.config.trustProxyHops)"); // 신뢰 프록시 경계
    expect(mw).toContain("corsHeaders(req.headers.origin, ctx.config.corsAllow)");
    expect(mw).toContain('res.setHeader("Content-Security-Policy", API_CSP)');
    expect(mw).toContain("clientIp(req, ctx.config.trustProxyHops)"); // XFF 위조 차단
  });
  it("middleware handles OPTIONS preflight and rate-limits /api/*", () => {
    expect(mw).toContain('req.method === "OPTIONS"');
    expect(mw).toContain("limiters.sensitive.check");
    expect(mw).toContain("limiters.global.check");
    expect(mw).toContain("RATE_LIMITED");
  });
  it("respond serves HTML via per-request nonce injection", () => {
    expect(respond).toContain("injectNonce(html, nonce)");
    expect(respond).toContain("htmlCsp(nonce)");
    expect(pages).toContain("sendHtml(res,");
  });
  it("config: 운영 fail-closed(시크릿/CORS/콘솔) + 비운영 ephemeral 시크릿(레드팀 H2/M1)", () => {
    expect(cfg).toContain("randomBytes(32)");          // 공개 기본값 대신 임시 랜덤
    expect(cfg).toContain("secretEphemeral");
    expect(cfg).toContain("process.exit(1)");          // 운영 부팅 차단
    expect(cfg).toContain("운영 부팅 차단");
    expect(cfg).not.toContain("dev-lansmark-entitlement-secret-change-in-prod"); // 하드코딩 기본값 제거 확인
    expect(cfg).toContain("LANSMARK_REQUIRE_ENTITLEMENT=false"); // 유료게이트 우회 운영 차단(방어심화)
    expect(cfg).toContain("LANSMARK_ALLOW_OPEN_PAID");           // 명시 우회 플래그
  });
  it("orchestrator wires middleware → router pipeline", () => {
    expect(dev).toContain("applySecurity(req, res, ctx, url.pathname)");
    expect(dev).toContain("await route(ctx, req, res, url)");
  });
});

// bootSafety 행동 검증 — 운영 요건은 모두 충족시키고 requireEntitlement만 false로 격리(다른 검사 영향 배제).
describe("bootSafety: 운영 유료게이트 우회 차단(REQUIRE_ENTITLEMENT)", () => {
  const prodConfig = (over: Partial<Config> = {}): Config => ({
    port: 8787, dataMode: "auto", vworldKey: undefined, tossClientKey: undefined,
    simPriceKrw: 4900, requireEntitlement: true, adminToken: "admintoken-strong",
    corsAllow: ["https://lansmark.app"], rateGlobal: 240, rateSensitive: 30, rateWindowMs: 60000,
    trustProxyHops: 0, allowOpenCors: false, allowOpenConsole: false,
    entitlementTtlMs: 1, entitlementQuota: 50, secretEphemeral: false,
    storeMode: "memory", dataDir: "/tmp", dashboardDir: "/tmp", isProd: true, ...over,
  });
  // process.exit/console를 가로채 부팅차단 여부만 관찰(테스트 러너 보호).
  function bootExitCode(cfg: Config, env: Record<string, string | undefined>): number {
    const saved = { ...process.env };
    const origExit = process.exit, origErr = console.error, origWarn = console.warn;
    for (const k in env) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]!; }
    let exited = 0;
    process.exit = ((c?: number) => { exited = c ?? 0; throw new Error("__EXIT__"); }) as unknown as typeof process.exit;
    console.error = () => {}; console.warn = () => {};
    try { bootSafety(cfg); } catch (e) { if (!(e instanceof Error && e.message === "__EXIT__")) throw e; }
    finally { process.exit = origExit; console.error = origErr; console.warn = origWarn; process.env = saved; }
    return exited;
  }
  const strongSecret = { LANSMARK_ENTITLEMENT_SECRET: "x".repeat(40), LANSMARK_DATA_KEY: "a".repeat(64) }; // 운영 부팅 통과용 기본 — DATA_KEY는 hex64(형식검증 통과) 필수(P2 C#6 + 형식 footgun)
  it("운영 + requireEntitlement=false + 우회없음 → 부팅 차단(exit 1)", () => {
    expect(bootExitCode(prodConfig({ requireEntitlement: false }), { ...strongSecret, LANSMARK_ALLOW_OPEN_PAID: undefined })).toBe(1);
  });
  it("LANSMARK_ALLOW_OPEN_PAID=1 → 통과(exit 0)", () => {
    expect(bootExitCode(prodConfig({ requireEntitlement: false }), { ...strongSecret, LANSMARK_ALLOW_OPEN_PAID: "1" })).toBe(0);
  });
  it("requireEntitlement=true(기본) → 통과(exit 0)", () => {
    expect(bootExitCode(prodConfig({ requireEntitlement: true }), { ...strongSecret, LANSMARK_ALLOW_OPEN_PAID: undefined })).toBe(0);
  });
  it("DATA_KEY 미설정 + 우회없음 → 부팅 차단(exit 1, PII 평문 방지·P2 C#6)", () => {
    expect(bootExitCode(prodConfig({ requireEntitlement: true }), { LANSMARK_ENTITLEMENT_SECRET: "x".repeat(40), LANSMARK_DATA_KEY: undefined, LANSMARK_ALLOW_PLAINTEXT_PII: undefined })).toBe(1);
  });
  it("TOSS_CLIENT_KEY만 설정(서버 비밀키 없음) → 부팅 차단(exit 1·P2 C#6)", () => {
    expect(bootExitCode(prodConfig({ requireEntitlement: true }), { ...strongSecret, TOSS_CLIENT_KEY: "live_ck", TOSS_SECRET_KEY: undefined })).toBe(1);
  });
  it("DATA_KEY 형식 오류(hex64 아님) → 부팅 차단(exit 1·조용한 평문 PII 방지·배포 footgun)", () => {
    expect(bootExitCode(prodConfig({ requireEntitlement: true }), { LANSMARK_ENTITLEMENT_SECRET: "x".repeat(40), LANSMARK_DATA_KEY: "not-a-valid-hex64-key" })).toBe(1);
  });
});
