/**
 * 아이디/비밀번호 인증 — password 프리미티브(scrypt·검증) + register/login 라우트.
 *   가벼움(발송 인프라 0) · 무한생성 금지(중복차단·sensitive RL·scrypt) · 평문 미저장 · 열거 방지(동일 401).
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";
import { hashPassword, verifyPassword, isValidUserId, isValidPassword } from "../account/password";

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
function mockReq(method = "POST", headers: Record<string, string> = {}, body?: unknown) {
  const r: any = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  r.method = method; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r as http.IncomingMessage;
}
const U = (p: string) => new URL("http://localhost" + p);

describe("password 프리미티브(scrypt·검증)", () => {
  it("해시 라운드트립 — 맞는 비번 true·틀린 비번 false·평문 미노출", () => {
    const { hash, salt } = hashPassword("correct horse battery");
    expect(hash).not.toContain("correct"); // 평문 미저장(해시만)
    expect(verifyPassword("correct horse battery", hash, salt)).toBe(true);
    expect(verifyPassword("wrong-guess", hash, salt)).toBe(false);
  });
  it("손상/누락 입력은 false(throw 금지)", () => {
    expect(verifyPassword("x", undefined, undefined)).toBe(false);
    expect(verifyPassword("x", "zz", "")).toBe(false);
  });
  it("아이디 형식 — 영문·숫자·밑줄 4~20자만", () => {
    expect(isValidUserId("farmer123")).toBe(true);
    expect(isValidUserId("ab")).toBe(false);          // 짧음
    expect(isValidUserId("has space")).toBe(false);   // 공백
    expect(isValidUserId("a".repeat(21))).toBe(false); // 김
  });
  it("비밀번호 강도 — 8~200자", () => {
    expect(isValidPassword("12345678")).toBe(true);
    expect(isValidPassword("short")).toBe(false);
    expect(isValidPassword("a".repeat(201))).toBe(false);
  });
});

describe("account routes — 아이디/비밀번호 가입·로그인", () => {
  const ctx = createContext({ ...loadConfig(), requireEntitlement: false }); // 무료 베타
  const reg = async (body: unknown) => { const s = mockRes(); await route(ctx, mockReq("POST", {}, body), s, U("/api/account/register")); return { s, body: JSON.parse(s.captured.body || "{}") }; };
  const login = async (body: unknown) => { const s = mockRes(); await route(ctx, mockReq("POST", {}, body), s, U("/api/account/login")); return { s, body: JSON.parse(s.captured.body || "{}") }; };

  it("가입 성공 → 세션·isNew=true·methods=password", async () => {
    const { s, body } = await reg({ userId: "alice01", password: "pw12345678", passwordConfirm: "pw12345678" });
    expect(s.captured.code).toBe(200);
    expect(body.session).toBeTruthy();
    expect(body.isNew).toBe(true);
    const me = mockRes();
    await route(ctx, mockReq("GET", { "x-lansmark-session": body.session }), me, U("/api/account/me"));
    expect(JSON.parse(me.captured.body).methods).toContain("password");
  });
  it("중복 아이디 → 409(무한생성 차단) · 대소문자 무시(Bob==bob)", async () => {
    await reg({ userId: "bob02", password: "pw12345678", passwordConfirm: "pw12345678" });
    const dup = await reg({ userId: "bob02", password: "different99", passwordConfirm: "different99" });
    expect(dup.s.captured.code).toBe(409);
    expect(dup.body.code).toBe("USERID_TAKEN");
    const dupCase = await reg({ userId: "Bob02", password: "pw12345678", passwordConfirm: "pw12345678" });
    expect(dupCase.s.captured.code).toBe(409); // 대소문자 무시 중복
  });
  it("약한 비번 400 · 비번 불일치 400 · 잘못된 아이디 400", async () => {
    expect((await reg({ userId: "dave04", password: "short", passwordConfirm: "short" })).body.code).toBe("BAD_PASSWORD");
    expect((await reg({ userId: "dave04", password: "pw12345678", passwordConfirm: "mismatch99" })).body.code).toBe("PASSWORD_MISMATCH");
    expect((await reg({ userId: "ab", password: "pw12345678", passwordConfirm: "pw12345678" })).body.code).toBe("BAD_USERID");
  });
  it("로그인 성공(isNew=false) · 틀린 비번 401 · 없는 아이디도 401(열거 방지·동일 코드)", async () => {
    await reg({ userId: "eve05", password: "pw12345678", passwordConfirm: "pw12345678" });
    const ok = await login({ userId: "eve05", password: "pw12345678" });
    expect(ok.s.captured.code).toBe(200);
    expect(ok.body.isNew).toBe(false);
    expect((await login({ userId: "eve05", password: "wrongpw99" })).s.captured.code).toBe(401);
    const nouser = await login({ userId: "ghost99", password: "whatever1" });
    expect(nouser.s.captured.code).toBe(401);
    expect(nouser.body.code).toBe("AUTH_FAILED"); // 없는 아이디도 동일(계정 존재 노출 차단)
  });
  it("익명 모드(anonOnly) → register 404(PII 미수집)", async () => {
    const anonCtx = createContext({ ...loadConfig(), requireEntitlement: false, anonOnly: true });
    const s = mockRes();
    await route(anonCtx, mockReq("POST", {}, { userId: "frank06", password: "pw12345678", passwordConfirm: "pw12345678" }), s, U("/api/account/register"));
    expect(s.captured.code).toBe(404);
  });
});
