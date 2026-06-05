/**
 * 병충해·재해 주의 라우트(/api/alerts) 검증 — 무료·월 파라미터·입력검증.
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

describe("alerts route", () => {
  it("무료 — 토큰 없이 200 + 작물·월 주의(벼 7월)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/alerts?cropId=rice&month=7"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.alerts.month).toBe(7);
    expect(Array.isArray(b.alerts.alerts)).toBe(true);
    expect(b.alerts.activeCount).toBeGreaterThan(0);
  });

  it("month 미지정 → 서버 현재월(1~12)로 200", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/alerts?cropId=apple"));
    expect(res.captured.code).toBe(200);
    const mth = JSON.parse(res.captured.body).alerts.month;
    expect(mth).toBeGreaterThanOrEqual(1); expect(mth).toBeLessThanOrEqual(12);
  });

  it("형식 위반 cropId → 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/alerts?cropId=DROP%20x"));
    expect(res.captured.code).toBe(400);
  });

  it("미존재 cropId → 400(UNKNOWN_CROP)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/alerts?cropId=zzz_unknown"));
    expect(res.captured.code).toBe(400);
    expect(JSON.parse(res.captured.body).code).toBe("UNKNOWN_CROP");
  });
});
