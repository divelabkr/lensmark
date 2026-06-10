/**
 * 운영 콘솔 라우트 — 유료 게이트 런타임 토글(무료베타↔유료)·관리자 인증·운영 무료개방 가드.
 *   route()를 직접 호출(가짜 req/res). 토글이 ctx.config를 변형하므로 테스트마다 새 ctx로 격리.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { loadConfig, type Config } from "../../../server/config";
import { createContext, type Ctx } from "../../../server/context";
import { route } from "../../../server/router";

function mockRes() {
  const captured = { code: 0, headers: {} as Record<string, string>, body: "" };
  const res = {
    setHeader(k: string, v: string) { captured.headers[k.toLowerCase()] = String(v); },
    writeHead(code: number, h?: Record<string, string>) { captured.code = code; for (const k in h ?? {}) captured.headers[k.toLowerCase()] = String((h as any)[k]); return res; },
    end(s?: string) { captured.body = s ?? ""; },
    captured,
  };
  return res as unknown as http.ServerResponse & { captured: typeof captured };
}
function mockReq(method = "GET", headers: Record<string, string> = {}, body?: unknown) {
  const r: any = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  r.method = method; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r as http.IncomingMessage;
}
const U = (p: string) => new URL("http://localhost" + p);
const ADMIN = "admin-secret-xyz";
const adminH = { "x-lansmark-admin": ADMIN, "content-type": "application/json" }; // ops 변이는 JSON content-type 필수(CSRF 가드·M4)

/** 매 테스트 새 ctx(토글이 ctx.config.requireEntitlement를 변형하므로 격리). */
function freshCtx(over: Partial<Config> = {}): Ctx {
  return createContext({ ...loadConfig(), adminToken: ADMIN, requireEntitlement: true, ...over });
}

describe("ops 유료 게이트 토글(/api/ops/paid-gate)", () => {
  beforeEach(() => { delete process.env.LANSMARK_ALLOW_OPEN_PAID; }); // prod 가드 테스트 격리

  it("관리자 인증 없으면 401", async () => {
    const res = mockRes();
    await route(freshCtx(), mockReq("POST", {}, { requireEntitlement: false }), res, U("/api/ops/paid-gate"));
    expect(res.captured.code).toBe(401);
  });

  it("관리자: 무료 베타로 끄고(false) 다시 켠다(true) — config 즉시 반영", async () => {
    const ctx = freshCtx();
    expect(ctx.config.requireEntitlement).toBe(true);
    const off = mockRes();
    await route(ctx, mockReq("POST", adminH, { requireEntitlement: false }), off, U("/api/ops/paid-gate"));
    expect(off.captured.code).toBe(200);
    expect(ctx.config.requireEntitlement).toBe(false); // 즉시 반영(요청 readers가 ctx.config 경유)
    const on = mockRes();
    await route(ctx, mockReq("POST", adminH, { requireEntitlement: true }), on, U("/api/ops/paid-gate"));
    expect(ctx.config.requireEntitlement).toBe(true);
  });

  it("boolean 아닌 값은 400", async () => {
    const res = mockRes();
    await route(freshCtx(), mockReq("POST", adminH, { requireEntitlement: "no" }), res, U("/api/ops/paid-gate"));
    expect(res.captured.code).toBe(400);
  });

  it("운영(prod)에서 무료개방은 ALLOW_OPEN_PAID=1 없으면 400(런타임 우회 차단)", async () => {
    const ctx = freshCtx({ isProd: true });
    const res = mockRes();
    await route(ctx, mockReq("POST", adminH, { requireEntitlement: false }), res, U("/api/ops/paid-gate"));
    expect(res.captured.code).toBe(400);
    expect(JSON.parse(res.captured.body).code).toBe("OPEN_PAID_NOT_ACKED");
    expect(ctx.config.requireEntitlement).toBe(true); // 변경되지 않음
  });

  it("운영에서 유료로 켜기(true)는 항상 허용", async () => {
    const ctx = freshCtx({ isProd: true, requireEntitlement: false });
    const res = mockRes();
    await route(ctx, mockReq("POST", adminH, { requireEntitlement: true }), res, U("/api/ops/paid-gate"));
    expect(res.captured.code).toBe(200);
    expect(ctx.config.requireEntitlement).toBe(true);
  });

  // ── 감사 M4: 변이는 Content-Type JSON 필수(CSRF 단순요청 차단) + 운영 open-console로 쓰기 안 열림 ──
  it("content-type 없는 변이 POST는 415(CSRF 단순요청 차단)", async () => {
    const res = mockRes();
    await route(freshCtx(), mockReq("POST", { "x-lansmark-admin": ADMIN }, { requireEntitlement: false }), res, U("/api/ops/paid-gate"));
    expect(res.captured.code).toBe(415);
    const rv = mockRes();
    await route(freshCtx(), mockReq("POST", { "x-lansmark-admin": ADMIN }, { jti: "x" }), rv, U("/api/ops/revoke"));
    expect(rv.captured.code).toBe(415);
  });
  it("운영+관리자 토큰 미설정이면 변이는 403(콘솔 공개여도 쓰기는 안 열림)", async () => {
    const ctx = createContext({ ...loadConfig(), adminToken: undefined, isProd: true, requireEntitlement: false });
    const res = mockRes();
    await route(ctx, mockReq("POST", { "content-type": "application/json" }, { jti: "x" }), res, U("/api/ops/revoke"));
    expect(res.captured.code).toBe(403);
    expect(JSON.parse(res.captured.body).code).toBe("ADMIN_TOKEN_REQUIRED");
  });
  it("revoke는 durable 플래그 반환(file/memory는 항상 durable:true)", async () => {
    const res = mockRes();
    await route(freshCtx(), mockReq("POST", adminH, { jti: "ent-x" }), res, U("/api/ops/revoke"));
    expect(res.captured.code).toBe(200);
    expect(JSON.parse(res.captured.body).durable).toBe(true);
  });
});
