/**
 * 재배 가이드 라우트(/api/guide) 검증 — 무료(대표작물)/유료 게이트·목록밖 400.
 */
import { describe, it, expect } from "vitest";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";
import { mintEntitlementToken } from "../policy/entitlement";

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
const mockReq = (headers: Record<string, string> = {}) => ({ method: "GET", headers, socket: { remoteAddress: "127.0.0.1" } } as unknown as http.IncomingMessage);
const U = (p: string) => new URL("http://localhost" + p);

const ctx = createContext(loadConfig());
const auth = { "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:G" }) };

describe("guide route", () => {
  it("대표작물(apple)은 무료 — 토큰 없이 200 + 품종·요구조건", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/guide?cropId=apple"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.guide.tier).toBe("free");
    expect(b.guide.varieties.length).toBeGreaterThanOrEqual(1);
    expect(b.guide.requirements.length).toBeGreaterThan(0);
  });

  it("대표 식량작물(rice)은 무료 — 토큰 없이 200 + tier=free", async () => {
    // 사장님 명시: 벼는 무료 대표작물 → 토큰 없이도 라우트가 free로 서빙해야 한다(비즈니스 요건 회귀가드).
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/guide?cropId=rice"));
    expect(res.captured.code).toBe(200);
    expect(JSON.parse(res.captured.body).guide.tier).toBe("free");
  });

  it("유료작물(blueberry)은 토큰 없으면 402(GUIDE_PAID)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/guide?cropId=blueberry"));
    expect(res.captured.code).toBe(402);
    expect(JSON.parse(res.captured.body).code).toBe("GUIDE_PAID");
  });

  it("유료작물(blueberry)은 토큰 있으면 200(tier=paid)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(auth), res, U("/api/guide?cropId=blueberry"));
    expect(res.captured.code).toBe(200);
    expect(JSON.parse(res.captured.body).guide.tier).toBe("paid");
  });

  it("목록 밖(임의·외래) 작물은 400(UNKNOWN_CROP · Phase B seam) — 토큰 무관", async () => {
    const res = mockRes();
    await route(ctx, mockReq(auth), res, U("/api/guide?cropId=zzz_unknown"));
    expect(res.captured.code).toBe(400);
    expect(JSON.parse(res.captured.body).code).toBe("UNKNOWN_CROP");
  });

  it("형식 위반 cropId → 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/guide?cropId=DROP%20x"));
    expect(res.captured.code).toBe(400);
  });
});
