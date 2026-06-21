/**
 * AI 설명 라우트(POST /api/explain) — route() 직접 호출.
 *   검증: ①키 없으면 configured:false·explanation:null(무중단) ②라벨/고지 항상 노출(과신·LLM06)
 *         ③입력 검증(cropNameKo·income 필수) ④유료 게이트(requireEntitlement 시 402).
 *   ※ 실제 LLM 호출은 키 있을 때만 — 여기선 키 미설정 경로(외부 네트워크 무관)만 결정적으로 검증.
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";

function mockRes() {
  const captured = { code: 0, headers: {} as Record<string, string>, body: "" };
  const res = {
    setHeader(k: string, v: string) { captured.headers[k.toLowerCase()] = String(v); },
    writeHead(code: number, h?: Record<string, string>) { captured.code = code; for (const k in h ?? {}) captured.headers[k.toLowerCase()] = String((h as any)[k]); return res; },
    end(s?: string) { captured.body = s ?? ""; },
    captured,
  };
  return res as unknown as http.ServerResponse & { captured: typeof captured };
}
function mockReq(method = "POST", headers: Record<string, string> = {}, body?: unknown) {
  const r: any = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  r.method = method; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r as http.IncomingMessage;
}
const U = (p: string) => new URL("http://localhost" + p);
const BODY = {
  cropNameKo: "사과", region: "경상북도",
  income: { p10: 5_000_000, p50: 12_000_000, p90: 19_000_000 },
  reasons: ["토양 pH 적정"], climateFacts: ["연평균기온 12.3℃"], sources: ["농진청 2024"],
};

describe("ai-explain 라우트 — 유료게이트·무중단·고지", () => {
  it("키 없으면 configured:false·explanation:null + 라벨/고지 노출(무중단)", async () => {
    // ⚠ loadConfig()가 loadDotenv로 .env의 키를 주입(undefined인 것만) → '키 없음'은 loadConfig '후' 제거해야 결정적(아니면 .env 키 부활→실호출).
    const ctx = createContext({ ...loadConfig(), requireEntitlement: false });
    const prev = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    const s = mockRes();
    await route(ctx, mockReq("POST", {}, BODY), s, U("/api/explain"));
    expect(s.captured.code).toBe(200);
    const d = JSON.parse(s.captured.body);
    expect(d.configured).toBe(false);
    expect(d.explanation).toBeNull();          // 키 없음 → fetchExplanation null
    expect(d.label).toContain("보장이 아닙니다");
    expect(d.disclosure).toContain("개인정보는 전송하지 않습니다");
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  });

  it("cropNameKo 누락은 400 BAD_INPUT", async () => {
    const ctx = createContext({ ...loadConfig(), requireEntitlement: false });
    const s = mockRes();
    await route(ctx, mockReq("POST", {}, { income: BODY.income }), s, U("/api/explain"));
    expect(s.captured.code).toBe(400);
    expect(JSON.parse(s.captured.body).code).toBe("BAD_INPUT");
  });

  it("income(p10/p50/p90) 누락은 400 BAD_INPUT", async () => {
    const ctx = createContext({ ...loadConfig(), requireEntitlement: false });
    const s = mockRes();
    await route(ctx, mockReq("POST", {}, { cropNameKo: "사과" }), s, U("/api/explain"));
    expect(s.captured.code).toBe(400);
    expect(JSON.parse(s.captured.body).code).toBe("BAD_INPUT");
  });

  it("유료 게이트 — requireEntitlement 시 권한 없으면 402 ENTITLEMENT_REQUIRED", async () => {
    const ctx = createContext({ ...loadConfig(), requireEntitlement: true });
    const s = mockRes();
    await route(ctx, mockReq("POST", {}, BODY), s, U("/api/explain"));
    expect(s.captured.code).toBe(402);
    expect(JSON.parse(s.captured.body).code).toBe("ENTITLEMENT_REQUIRED");
  });
});
