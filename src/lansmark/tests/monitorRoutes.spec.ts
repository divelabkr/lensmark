/**
 * 일일 환경 모니터링 라우트(/api/monitor) — 좌표·작물 검증 + 기후 스텁(네트워크 제거).
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
// 기후 provider 스텁 — KMA 네트워크/실키 없이 결정적.
(ctx as any).providers = { ...ctx.providers, land: { ...ctx.providers.land, climate: async () => ({ annualRainfallMm: 1300, minWinterTempC: -8, sunlightLevel: "high", frostRisk: "low" }) } };

describe("monitor route", () => {
  it("좌표+작물 → 200 + 5축 환경 점검", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/monitor?cropId=rice&lat=35.8&lng=126.9"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.monitor.checks.length).toBe(5); // 강수·겨울최저·여름최고·일조·서리
    expect(["ok", "watch", "risk", "unknown"]).toContain(b.monitor.worst);
  });
  it("좌표 없으면 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/monitor?cropId=rice"));
    expect(res.captured.code).toBe(400);
  });
  it("형식 위반 cropId → 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/monitor?cropId=DROP&lat=35&lng=127"));
    expect(res.captured.code).toBe(400);
  });
});
