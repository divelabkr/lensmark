/**
 * 예산·현금흐름 라우트(/api/budget) 검증 — 하이브리드 soft-gate·입력검증·클램프.
 *   무료(토큰 없음)=teaser / 유료(토큰)=정밀 다년 · quota 소진 시 teaser 강등(차단 아님) · teaser는 quota 미소진.
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
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
/** body가 객체면 JSON 직렬화, raw=true면 문자열 그대로 emit(잘못된 JSON 테스트용). */
function mockReq(method = "POST", headers: Record<string, string> = {}, body?: unknown, raw = false) {
  const payload = body == null ? [] : [raw ? String(body) : JSON.stringify(body)];
  const r: any = Readable.from(payload);
  r.method = method; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r as http.IncomingMessage;
}
const U = (p: string) => new URL("http://localhost" + p);

const ctx = createContext(loadConfig());
const auth = () => ({ "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:B" }) }); // 매 호출 새 jti

const validBody = {
  areaM2: 1000, cultivationType: "greenhouse", facilityTier: "single_span",
  equityKrw: 100_000_000, subsidyKrw: 0,
  annualGrossIncomeKrw: { p10: 10_000_000, p50: 20_000_000, p90: 30_000_000 },
  annualOperatingCostKrw: { p10: 5_000_000, p50: 8_000_000, p90: 12_000_000 },
  incomeMode: "gross_minus_opcost", livingCostKrwPerYear: 0, analysisYears: 10,
};

describe("budget route (/api/budget)", () => {
  it("토큰 없음 → 200 무료 teaser(다년·ROI 미포함)", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", {}, validBody), res, U("/api/budget"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body).budget;
    expect(b.mode).toBe("free");
    expect(typeof b.initialCapexP50Krw).toBe("number");
    expect(b.metrics).toBeUndefined();
    expect(b.years).toBeUndefined();
  });

  it("유료 토큰 → 200 정밀 다년(years·metrics·면책)", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", auth(), validBody), res, U("/api/budget"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body).budget;
    expect(b.mode).toBe("paid");
    expect(b.years.length).toBe(10);
    expect(b.metrics).toBeTruthy();
    expect(b.disclaimers.some((d: string) => /실견적/.test(d))).toBe(true);
  });

  it("필수 소득(annualGrossIncomeKrw) 누락 → 400", async () => {
    const res = mockRes();
    const { annualGrossIncomeKrw, ...noIncome } = validBody;
    await route(ctx, mockReq("POST", auth(), noIncome), res, U("/api/budget"));
    expect(res.captured.code).toBe(400);
  });

  it("잘못된 JSON → 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", auth(), "{not json", true), res, U("/api/budget"));
    expect(res.captured.code).toBe(400);
  });

  it("GET → 405", async () => {
    const res = mockRes();
    await route(ctx, mockReq("GET", {}), res, U("/api/budget"));
    expect(res.captured.code).toBe(405);
  });

  it("analysisYears 클램프(999 → 30)", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", auth(), { ...validBody, analysisYears: 999 }), res, U("/api/budget"));
    expect(JSON.parse(res.captured.body).budget.years.length).toBe(30);
  });

  it("quota 소진 시 teaser로 강등(402 차단 아님)", async () => {
    const ctxQ1 = createContext({ ...loadConfig(), entitlementQuota: 1 });
    const token = { "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:Q" }) }; // 같은 jti 재사용
    const first = mockRes();
    await route(ctxQ1, mockReq("POST", token, validBody), first, U("/api/budget"));
    expect(JSON.parse(first.captured.body).budget.mode).toBe("paid"); // 1회 소진
    const second = mockRes();
    await route(ctxQ1, mockReq("POST", token, validBody), second, U("/api/budget"));
    expect(second.captured.code).toBe(200);
    expect(JSON.parse(second.captured.body).budget.mode).toBe("free"); // 소진 후 강등
  });

  it("무료 teaser는 quota를 소진하지 않는다(이후 유료 1회 정상)", async () => {
    const ctxQ1 = createContext({ ...loadConfig(), entitlementQuota: 1 });
    const noTok = mockRes();
    await route(ctxQ1, mockReq("POST", {}, validBody), noTok, U("/api/budget")); // teaser(미소진)
    expect(JSON.parse(noTok.captured.body).budget.mode).toBe("free");
    const paidRes = mockRes();
    await route(ctxQ1, mockReq("POST", { "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:T" }) }, validBody), paidRes, U("/api/budget"));
    expect(JSON.parse(paidRes.captured.body).budget.mode).toBe("paid"); // quota 보존됨
  });
});
