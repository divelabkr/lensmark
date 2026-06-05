/**
 * 귀농 자가진단(buildReturnFarmAssessment) 검증 — 점수·밴드·자금 최대 가중·보수 처리·가부 단정 금지.
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { buildReturnFarmAssessment, type ReturnFarmAssessInput } from "../assess/returnFarmAssess";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";

const ALL_OK: ReturnFarmAssessInput = { equityKrw: 100_000_000, livingBufferMonths: 12, motivation: "clear", experience: "experienced", familyConsent: true, landSecured: true };

describe("buildReturnFarmAssessment", () => {
  it("준비 충분 → score 100·ready, 톱리스크 없음", () => {
    const r = buildReturnFarmAssessment(ALL_OK);
    expect(r.score).toBe(100);
    expect(r.band).toBe("ready");
    expect(r.topRisks.length).toBe(0);
  });

  it("준비 부족 → caution + 자금·생활비 톱리스크 + 보완 액션", () => {
    const r = buildReturnFarmAssessment({ equityKrw: 10_000_000, livingBufferMonths: 3, motivation: "vague", experience: "none", familyConsent: false, landSecured: false });
    expect(r.band).toBe("caution");
    expect(r.topRisks).toEqual(expect.arrayContaining(["초기 자기자본", "생활비 버퍼(개월)"]));
    expect(r.nextActions.length).toBeGreaterThan(0); // 가부 단정 대신 '보완' 제시
  });

  it("미입력은 보수(unknown=0.5) → score 50·prepare", () => {
    const r = buildReturnFarmAssessment({});
    expect(r.score).toBe(50);
    expect(r.band).toBe("prepare");
  });

  it("자금이 최대 가중 — 자기자본만 risk로 떨어지면 25점 하락", () => {
    const full = buildReturnFarmAssessment(ALL_OK).score;            // 100
    const lowCapital = buildReturnFarmAssessment({ ...ALL_OK, equityKrw: 10_000_000 }).score; // capital ok(25)→risk(0)
    expect(full - lowCapital).toBe(25);
  });

  it("가부 단정 금지: 면책 + 축별 가중합=100", () => {
    const r = buildReturnFarmAssessment(ALL_OK);
    expect(r.disclaimer).toMatch(/보장하지 않|판단·보장/);
    expect(r.axes.reduce((s, a) => s + a.weight, 0)).toBe(100); // 가중 정합
  });
});

describe("assess route (/api/assess · 무료)", () => {
  function mockRes() {
    const c = { code: 0, body: "" };
    const res = { setHeader() {}, writeHead(x: number) { c.code = x; return res; }, end(s?: string) { c.body = s ?? ""; }, captured: c };
    return res as unknown as http.ServerResponse & { captured: typeof c };
  }
  function mockReq(method = "POST", body?: unknown, raw = false) {
    const r: any = Readable.from(body == null ? [] : [raw ? String(body) : JSON.stringify(body)]);
    r.method = method; r.headers = {}; r.socket = { remoteAddress: "127.0.0.1" };
    return r as http.IncomingMessage;
  }
  const ctx = createContext(loadConfig());
  const U = new URL("http://localhost/api/assess");

  it("무료 200 + 준비도 결과(토큰 불필요)", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", { equityKrw: 100000000, livingBufferMonths: 12, motivation: "clear", experience: "experienced", familyConsent: true, landSecured: true }), res, U);
    expect(res.captured.code).toBe(200);
    const a = JSON.parse(res.captured.body).assessment;
    expect(a.band).toBe("ready");
    expect(a.score).toBe(100);
  });
  it("GET → 405 · 잘못된 JSON → 400 · 빈 본문도 보수 처리(200)", async () => {
    const g = mockRes(); await route(ctx, mockReq("GET"), g, U); expect(g.captured.code).toBe(405);
    const bad = mockRes(); await route(ctx, mockReq("POST", "{x", true), bad, U); expect(bad.captured.code).toBe(400);
    const empty = mockRes(); await route(ctx, mockReq("POST", {}), empty, U); expect(empty.captured.code).toBe(200);
  });
});
