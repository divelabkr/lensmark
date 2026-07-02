/**
 * 라우터 스모크 테스트 — 분해된 서버가 런타임에 올바르게 디스패치하는지 검증.
 *   listen 없이 route()만 직접 호출(가짜 req/res로 응답 캡처). 모듈 분해 회귀를 잡는다.
 */
import { describe, it, expect } from "vitest";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";
import type * as http from "node:http";

/** 응답을 캡처하는 가짜 ServerResponse(필요한 메서드만 구현). */
function mockRes() {
  const captured = { code: 0, headers: {} as Record<string, string>, body: "" };
  const res = {
    setHeader(k: string, v: string) { captured.headers[k.toLowerCase()] = String(v); },
    writeHead(code: number, headers?: Record<string, string>) {
      captured.code = code;
      for (const k in headers ?? {}) captured.headers[k.toLowerCase()] = String((headers as Record<string, string>)[k]);
      return res;
    },
    end(s?: string) { captured.body = s ?? ""; },
    captured,
  };
  return res as unknown as http.ServerResponse & { captured: typeof captured };
}
function mockReq(method = "GET", headers: Record<string, string> = {}) {
  return { method, headers, socket: { remoteAddress: "127.0.0.1" } } as unknown as http.IncomingMessage;
}
const U = (path: string) => new URL("http://localhost" + path);

const ctx = createContext(loadConfig());

describe("router dispatch (server smoke)", () => {
  it("GET /api/version → 200 + semver + releases", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/version"));
    expect(res.captured.code).toBe(200);
    const body = JSON.parse(res.captured.body);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Array.isArray(body.releases)).toBe(true);
  });

  it("GET /api/health → ok:true", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/health"));
    expect(res.captured.code).toBe(200);
    expect(JSON.parse(res.captured.body).ok).toBe(true);
  });

  it("GET /api/landclass sea coord → action:block", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/landclass?lat=36.0&lng=125.6"));
    expect(res.captured.code).toBe(200);
    expect(JSON.parse(res.captured.body).action).toBe("block");
  });

  it("GET /api/landclass missing coords → 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/landclass"));
    expect(res.captured.code).toBe(400);
  });

  it("GET /api/recommend → free candidates + 소득 실데이터 배지 + 지형 반영 표시", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/recommend?lat=35.8&lng=126.9&area=3300"));
    expect(res.captured.code).toBe(200);
    const body = JSON.parse(res.captured.body);
    expect(body.mode).toBe("free");
    expect(Array.isArray(body.candidates)).toBe(true);
    // 후보마다 소득 실데이터 검증 여부(농진청 실측 vs 데모)를 정직하게 노출 — 앱 💰 배지의 근거
    for (const c of body.candidates) expect(typeof c.incomeData?.verified).toBe("boolean");
    expect(typeof body.terrainUsed).toBe("boolean"); // 지형(경사·향) 반영 여부 — 앱 '⛰ 실측 지형 반영' 라벨의 근거
  });

  it("POST /api/simulate without entitlement → 402 (fail-closed gate)", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST"), res, U("/api/simulate"));
    expect(res.captured.code).toBe(402);
    expect(JSON.parse(res.captured.body).code).toBe("ENTITLEMENT_REQUIRED");
  });

  it("unknown path → 404", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/nope"));
    expect(res.captured.code).toBe(404);
  });
});
