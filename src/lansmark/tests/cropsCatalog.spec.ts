/**
 * 작물 카탈로그(listCropCatalog) + /api/crops 라우트 — 전체 작물·티어·무료선노출.
 */
import { describe, it, expect } from "vitest";
import type * as http from "node:http";
import { listCropCatalog } from "../crops/catalog";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";

describe("listCropCatalog", () => {
  it("전체 작물 + 무료/유료 티어 + 무료(대표) 먼저", () => {
    const list = listCropCatalog();
    expect(list.length).toBeGreaterThanOrEqual(15);
    expect(list.some((c) => c.cropId === "rice" && c.guideTier === "free")).toBe(true);     // 벼 무료
    expect(list.some((c) => c.cropId === "barley" && c.guideTier === "free")).toBe(true);   // 보리 무료
    expect(list.some((c) => c.cropId === "blueberry" && c.guideTier === "paid")).toBe(true); // 블루베리 유료
    // 무료가 유료보다 앞(정렬)
    const lastFree = list.map((c) => c.guideTier).lastIndexOf("free");
    const firstPaid = list.findIndex((c) => c.guideTier === "paid");
    expect(firstPaid).toBeGreaterThan(lastFree);
  });
});

describe("crops route", () => {
  function mockRes() {
    const captured = { code: 0, body: "" };
    const res = { setHeader() {}, writeHead(c: number) { captured.code = c; return res; }, end(s?: string) { captured.body = s ?? ""; }, captured };
    return res as unknown as http.ServerResponse & { captured: typeof captured };
  }
  const ctx = createContext(loadConfig());
  it("GET /api/crops → 200 + 전체 작물", async () => {
    const res = mockRes();
    await route(ctx, { method: "GET", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any, res, new URL("http://localhost/api/crops"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.ok).toBe(true);
    expect(b.crops.length).toBeGreaterThanOrEqual(15);
  });
});
