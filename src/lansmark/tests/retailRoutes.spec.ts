/**
 * /api/retail-price(마트 소매가 주간 min~평균~max) 라우트 검증.
 *   providers.price.retailWeekly를 스텁으로 교체해 KAMIS 네트워크/실키 의존 제거(결정적).
 *   도매가(/api/market·recentWholesale)와 구분되는 '소비자 체감 시세' 경로.
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

// retailWeekly 스텁: apple만 값, 나머지 null(미검증 작물 = 표시 생략). recentWholesale도 타입 충족용으로 둠.
const ctx = createContext(loadConfig());
(ctx as any).providers = {
  ...ctx.providers,
  price: {
    recentWholesale: async () => null,
    retailWeekly: async (cropId: string) =>
      cropId === "apple" ? { min: 4000, avg: 5000, max: 6500, samples: 7, source: "KAMIS 소매 주간(원/kg)" } : null,
  },
};

describe("retail-price route", () => {
  it("지원 작물 → 주간 min~평균~max(원/kg)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/retail-price?cropId=apple"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.ok).toBe(true);
    expect(b.retail).toEqual({ min: 4000, avg: 5000, max: 6500, samples: 7, source: "KAMIS 소매 주간(원/kg)" });
  });

  it("미지원 작물 → retail:null(프론트가 표시 생략)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/retail-price?cropId=onion"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.retail).toBeNull();
  });

  it("cropId 없으면 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/retail-price"));
    expect(res.captured.code).toBe(400);
  });
});
