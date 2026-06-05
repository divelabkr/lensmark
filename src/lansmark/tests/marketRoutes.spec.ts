/**
 * 출하 시세 라우트(/api/market) 검증 — seed/live 앵커·입력검증.
 *   providers.price를 스텁으로 교체해 KAMIS 네트워크/실키 의존을 제거(결정적).
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

// providers.price 스텁 — 네트워크/실키 없이 seed/live 경로 모두 검증.
const ctxSeed = createContext(loadConfig());
(ctxSeed as any).providers = { ...ctxSeed.providers, price: { recentWholesale: async () => null } };
const ctxLive = createContext(loadConfig());
(ctxLive as any).providers = { ...ctxLive.providers, price: { recentWholesale: async () => ({ priceKrwPerKg: { p10: 2000, p50: 3000, p90: 4000 }, source: "KAMIS 일별 도매(원/kg)" }) } };
const ctxMock = createContext(loadConfig()); // mock 출처 가격(키 없을 때 auto 폴백) — 실시세로 호도 금지
(ctxMock as any).providers = { ...ctxMock.providers, price: { recentWholesale: async () => ({ priceKrwPerKg: { p10: 2000, p50: 3000, p90: 4000 }, source: "mock-kamis" }) } };

describe("market route", () => {
  it("seed 앵커 + yieldKg → 판로 비교·기대매출", async () => {
    const res = mockRes();
    await route(ctxSeed, mockReq(), res, U("/api/market?cropId=potato&yieldKg=1000"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.ok).toBe(true);
    expect(b.market.anchor).toBe("seed");
    expect(b.market.channels.length).toBeGreaterThanOrEqual(3);
    expect(b.market.channels[0].expectedRevenueKrw).toBeTruthy(); // yieldKg 반영
    expect(b.market.bestDeltaPct).toBeGreaterThan(0);
  });

  it("live 앵커 → 도매 실시세(p50=3000) 반영", async () => {
    const res = mockRes();
    await route(ctxLive, mockReq(), res, U("/api/market?cropId=potato"));
    const b = JSON.parse(res.captured.body);
    expect(b.market.anchor).toBe("live");
    expect(b.market.wholesalePriceKrwPerKg.p50).toBe(3000);
  });

  it("mock 출처 가격은 실시세로 호도하지 않음(anchor=seed · 레드팀 F1)", async () => {
    const res = mockRes();
    await route(ctxMock, mockReq(), res, U("/api/market?cropId=potato"));
    const b = JSON.parse(res.captured.body);
    expect(b.market.anchor).toBe("seed");                       // mock → live 앵커로 승격 안 됨
    expect(b.market.disclaimer).toMatch(/실시세 앵커가 적용되지 않/); // 면책도 seed로 정직(F2)
  });

  it("형식 위반 cropId → 400", async () => {
    const res = mockRes();
    await route(ctxSeed, mockReq(), res, U("/api/market?cropId=DROP%20TABLE"));
    expect(res.captured.code).toBe(400);
  });

  it("형식 OK·미존재 cropId → 400", async () => {
    const res = mockRes();
    await route(ctxSeed, mockReq(), res, U("/api/market?cropId=zzz_unknown"));
    expect(res.captured.code).toBe(400);
  });
});
