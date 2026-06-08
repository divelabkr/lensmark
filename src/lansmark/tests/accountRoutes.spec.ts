/**
 * 계정·세션 라우트 — 휴대폰 OTP 가입·세션·로그아웃·익명→계정 이관 검증.
 *   route() 직접 호출. dev(비운영)에선 SMS 미발송이라 start 응답의 devHint=OTP 코드 → 그것으로 verify.
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

describe("account routes — 휴대폰 OTP 가입·세션·익명→계정 이관(코어)", () => {
  const ctx = createContext({ ...loadConfig(), requireEntitlement: false }); // 무료 베타

  /** dev OTP 로그인 → {session, accountId, isNew}. */
  async function login(contact: string): Promise<{ session: string; accountId: string; isNew: boolean }> {
    const s1 = mockRes();
    await route(ctx, mockReq("POST", {}, { method: "phone", contact }), s1, U("/api/account/auth/start"));
    const { challengeId, devHint } = JSON.parse(s1.captured.body); // devHint=OTP 코드(dev 미발송)
    const s2 = mockRes();
    await route(ctx, mockReq("POST", {}, { challengeId, code: devHint }), s2, U("/api/account/auth/verify"));
    return JSON.parse(s2.captured.body);
  }

  it("start → verify(devHint 코드) → 세션 발급(신규)", async () => {
    const s1 = mockRes();
    await route(ctx, mockReq("POST", {}, { method: "phone", contact: "010-1111-2222" }), s1, U("/api/account/auth/start"));
    expect(s1.captured.code).toBe(200);
    const { challengeId, devHint } = JSON.parse(s1.captured.body);
    expect(challengeId).toBeTruthy();
    expect(devHint).toMatch(/^\d{6}$/); // dev: 6자리 코드 노출
    const s2 = mockRes();
    await route(ctx, mockReq("POST", {}, { challengeId, code: devHint }), s2, U("/api/account/auth/verify"));
    expect(s2.captured.code).toBe(200);
    const v = JSON.parse(s2.captured.body);
    expect(v.session).toBeTruthy();
    expect(v.isNew).toBe(true);
  });

  it("같은 번호 재로그인은 기존 계정(isNew=false)", async () => {
    const a = await login("01033334444");
    const b = await login("01033334444");
    expect(b.accountId).toBe(a.accountId);
    expect(b.isNew).toBe(false);
  });

  it("잘못된 번호는 400(BAD_PHONE)", async () => {
    const s1 = mockRes();
    await route(ctx, mockReq("POST", {}, { method: "phone", contact: "not-a-phone" }), s1, U("/api/account/auth/start"));
    expect(s1.captured.code).toBe(400);
    expect(JSON.parse(s1.captured.body).code).toBe("BAD_PHONE");
  });

  it("틀린 코드는 401", async () => {
    const s1 = mockRes();
    await route(ctx, mockReq("POST", {}, { method: "phone", contact: "01055556666" }), s1, U("/api/account/auth/start"));
    const { challengeId, devHint } = JSON.parse(s1.captured.body);
    const wrong = devHint === "000000" ? "111111" : "000000"; // devHint와 반드시 다른 코드
    const s2 = mockRes();
    await route(ctx, mockReq("POST", {}, { challengeId, code: wrong }), s2, U("/api/account/auth/verify"));
    expect(s2.captured.code).toBe(401);
  });

  it("me: 세션 있으면 200·없으면 401 · logout 후 무효", async () => {
    const { session } = await login("01077778888");
    const me = mockRes();
    await route(ctx, mockReq("GET", { "x-lansmark-session": session }), me, U("/api/account/me"));
    expect(me.captured.code).toBe(200);
    const no = mockRes();
    await route(ctx, mockReq("GET", {}), no, U("/api/account/me"));
    expect(no.captured.code).toBe(401);
    const lo = mockRes();
    await route(ctx, mockReq("POST", { "x-lansmark-session": session }, {}), lo, U("/api/account/logout"));
    expect(lo.captured.code).toBe(200);
    const me2 = mockRes();
    await route(ctx, mockReq("GET", { "x-lansmark-session": session }), me2, U("/api/account/me"));
    expect(me2.captured.code).toBe(401); // 로그아웃 후 세션 무효
  });

  it("운영(prod)+SMS키 없음 → 로그인 차단(503 AUTH_NOT_CONFIGURED·코드 비노출)", async () => {
    const prodCtx = createContext({ ...loadConfig(), isProd: true });
    const s1 = mockRes();
    await route(prodCtx, mockReq("POST", {}, { method: "phone", contact: "01012345678" }), s1, U("/api/account/auth/start"));
    expect(s1.captured.code).toBe(503);
    expect(JSON.parse(s1.captured.body).code).toBe("AUTH_NOT_CONFIGURED");
  });

  it("익명→계정 이관: 익명 일지가 로그인 계정으로 귀속(이관 후 anon은 0·세션은 1)", async () => {
    const anon = { "x-lansmark-anon": "anon-" + "d".repeat(32) };
    const mk = mockRes();
    await route(ctx, mockReq("POST", anon, { cropId: "tomato", lat: 35.8, lng: 127.1 }), mk, U("/api/journal"));
    expect(mk.captured.code).toBe(200);

    const { session } = await login("01099990000");
    const link = mockRes();
    await route(ctx, mockReq("POST", { "x-lansmark-session": session, ...anon }, {}), link, U("/api/account/link-anon"));
    expect(link.captured.code).toBe(200);
    expect(JSON.parse(link.captured.body).linked).toBe(1);

    const bySess = mockRes();
    await route(ctx, mockReq("GET", { "x-lansmark-session": session }), bySess, U("/api/journal"));
    expect(JSON.parse(bySess.captured.body).entries.length).toBe(1); // 세션으로 보임

    const byAnon = mockRes();
    await route(ctx, mockReq("GET", anon), byAnon, U("/api/journal"));
    expect(JSON.parse(byAnon.captured.body).entries.length).toBe(0); // 이관되어 anon엔 없음

    const noauth = mockRes();
    await route(ctx, mockReq("POST", anon, {}), noauth, U("/api/account/link-anon"));
    expect(noauth.captured.code).toBe(401); // 이관은 로그인 필수
  });
});
