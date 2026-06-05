/**
 * 지원금·혜택 라우트(/api/support) — 무료·작물/지역 옵션·관대한 입력.
 */
import { describe, it, expect } from "vitest";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";

function mockRes() {
  const captured = { code: 0, headers: {} as Record<string, string>, body: "" };
  const res = {
    setHeader(k: string, v: string) { captured.headers[k.toLowerCase()] = String(v); },
    writeHead(code: number, headers?: Record<string, string>) { captured.code = code; for (const k in headers ?? {}) captured.headers[k.toLowerCase()] = String((headers as any)[k]); return res; },
    end(s?: string) { captured.body = s ?? ""; },
    captured,
  };
  return res as unknown as http.ServerResponse & { captured: typeof captured };
}
const mockReq = () => ({ method: "GET", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as unknown as http.IncomingMessage);
const U = (p: string) => new URL("http://localhost" + p);
const ctx = createContext(loadConfig());

describe("support route", () => {
  it("무료 — 토큰 없이 200 + 제도 목록(작물·지역)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/support?cropId=blueberry&region=" + encodeURIComponent("전북")));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.support.programs.length).toBeGreaterThan(0);
    expect(b.support.region).toBe("전북");
  });
  it("작물·지역 없어도 200(전체 안내)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/support"));
    expect(res.captured.code).toBe(200);
    expect(JSON.parse(res.captured.body).support.programs.length).toBeGreaterThan(0);
  });
});
