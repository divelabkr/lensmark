/**
 * 외래·임의 작물 라우트(/api/foreign) — 유료 게이트·입력검증(네트워크 미접근 경로만).
 *   ※ 200 성공 경로는 GBIF/위키 실호출이라 유닛에서 제외(assemble은 foreignCrop.spec에서 검증).
 */
import { describe, it, expect } from "vitest";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";
import { mintEntitlementToken } from "../policy/entitlement";

function mockRes() {
  const captured = { code: 0, body: "" };
  const res = { setHeader() {}, writeHead(c: number) { captured.code = c; return res; }, end(s?: string) { captured.body = s ?? ""; }, captured };
  return res as unknown as http.ServerResponse & { captured: typeof captured };
}
const mockReq = (headers: Record<string, string> = {}) => ({ method: "GET", headers, socket: { remoteAddress: "127.0.0.1" } } as unknown as http.IncomingMessage);
const U = (p: string) => new URL("http://localhost" + p);
const ctx = createContext(loadConfig());

describe("foreign route (유료 게이트·입력검증)", () => {
  it("유효 작물명 + 토큰 없음 → 402(FOREIGN_PAID, 네트워크 전 차단)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/foreign?name=" + encodeURIComponent("망고")));
    expect(res.captured.code).toBe(402);
    expect(JSON.parse(res.captured.body).code).toBe("FOREIGN_PAID");
  });
  it("작물명 누락 → 400(게이트 전 검증)", async () => {
    const res = mockRes();
    await route(ctx, mockReq(), res, U("/api/foreign?name="));
    expect(res.captured.code).toBe(400);
  });
  it("형식 위반(특수문자) → 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq({ "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:F" }) }), res, U("/api/foreign?name=%3Cscript%3E"));
    expect(res.captured.code).toBe(400);
  });
});
