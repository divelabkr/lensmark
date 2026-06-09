/**
 * 웹푸시 라우트 — VAPID 키 노출·구독 등록/해지 검증. route() 직접 호출.
 *   정직성: VAPID 미설정이면 configured:false(프론트 '준비 중'). 잘못된 구독은 400.
 *   PII: 구독 endpoint/키는 응답에 에코하지 않음(ok만).
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
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
const SUB = { endpoint: "https://push.example.com/abc123", keys: { p256dh: "PKEY", auth: "AKEY" } };

describe("web-push 라우트 — VAPID 노출·구독/해지", () => {
  const ctx = createContext({ ...loadConfig(), requireEntitlement: false });

  it("GET /api/push/vapid — 키 미설정이면 configured:false·publicKey null (프론트 '준비 중')", async () => {
    const prev = process.env.LANSMARK_VAPID_PUBLIC_KEY;
    delete process.env.LANSMARK_VAPID_PUBLIC_KEY;
    const s = mockRes();
    await route(ctx, mockReq("GET"), s, U("/api/push/vapid"));
    expect(s.captured.code).toBe(200);
    const d = JSON.parse(s.captured.body);
    expect(d.configured).toBe(false);
    expect(d.publicKey).toBeNull();
    if (prev !== undefined) process.env.LANSMARK_VAPID_PUBLIC_KEY = prev;
  });

  it("GET /api/push/vapid — 키 설정 시 configured:true·publicKey 노출", async () => {
    const prev = process.env.LANSMARK_VAPID_PUBLIC_KEY;
    process.env.LANSMARK_VAPID_PUBLIC_KEY = "BPUBLICKEYTEST";
    const s = mockRes();
    await route(ctx, mockReq("GET"), s, U("/api/push/vapid"));
    const d = JSON.parse(s.captured.body);
    expect(d.configured).toBe(true);
    expect(d.publicKey).toBe("BPUBLICKEYTEST");
    if (prev === undefined) delete process.env.LANSMARK_VAPID_PUBLIC_KEY; else process.env.LANSMARK_VAPID_PUBLIC_KEY = prev;
  });

  it("POST /api/push/subscribe — 유효 구독 저장(200)·스토어 반영·endpoint 미에코(PII)", async () => {
    const before = ctx.pushSubs.size();
    const s = mockRes();
    await route(ctx, mockReq("POST", { "x-lansmark-anon": "test-anon-1" }, { subscription: SUB }), s, U("/api/push/subscribe"));
    expect(s.captured.code).toBe(200);
    expect(JSON.parse(s.captured.body).ok).toBe(true);
    expect(ctx.pushSubs.size()).toBe(before + 1);
    expect(s.captured.body).not.toContain(SUB.endpoint); // 구독 endpoint를 응답에 노출하지 않음
  });

  it("POST /api/push/subscribe — 같은 endpoint 재구독은 dedupe(증가 없음)", async () => {
    const before = ctx.pushSubs.size();
    const s = mockRes();
    await route(ctx, mockReq("POST", {}, { subscription: SUB }), s, U("/api/push/subscribe"));
    expect(s.captured.code).toBe(200);
    expect(ctx.pushSubs.size()).toBe(before); // endpoint 키 dedupe
  });

  it("POST /api/push/subscribe — endpoint/keys 누락은 400 BAD_SUB", async () => {
    const s = mockRes();
    await route(ctx, mockReq("POST", {}, { subscription: { foo: "bar" } }), s, U("/api/push/subscribe"));
    expect(s.captured.code).toBe(400);
    expect(JSON.parse(s.captured.body).code).toBe("BAD_SUB");
  });

  it("POST /api/push/subscribe — 비-https endpoint는 400(SSRF·위생 가드)", async () => {
    const before = ctx.pushSubs.size();
    const s = mockRes();
    await route(ctx, mockReq("POST", {}, { subscription: { endpoint: "http://169.254.169.254/latest/meta-data", keys: { p256dh: "x", auth: "y" } } }), s, U("/api/push/subscribe"));
    expect(s.captured.code).toBe(400);
    expect(JSON.parse(s.captured.body).code).toBe("BAD_SUB");
    expect(ctx.pushSubs.size()).toBe(before); // 저장 안 됨
  });

  it("POST /api/push/unsubscribe — endpoint로 구독 파기(200)·스토어 감소", async () => {
    const before = ctx.pushSubs.size();
    const s = mockRes();
    await route(ctx, mockReq("POST", {}, { endpoint: SUB.endpoint }), s, U("/api/push/unsubscribe"));
    expect(s.captured.code).toBe(200);
    expect(JSON.parse(s.captured.body).ok).toBe(true);
    expect(ctx.pushSubs.size()).toBe(before - 1);
  });
});
