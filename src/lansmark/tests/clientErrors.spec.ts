/**
 * 클라이언트 에러 텔레메트리 — 디듀프·상한·최근·집계 + 라우트(204·기록·새 distinct만 로그).
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { ClientErrorStore } from "../ops/clientErrors";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";

describe("ClientErrorStore — 디듀프·집계·상한", () => {
  it("같은 에러는 카운트만(첫 발생만 새 distinct 반환 — 경보 스팸 차단)", () => {
    const s = new ClientErrorStore();
    const first = s.record({ message: "x is not a function", source: "app.js:10" });
    const again = s.record({ message: "x is not a function", source: "app.js:10" });
    expect(first).not.toBeNull();   // 새 distinct → 웹훅 트리거
    expect(again).toBeNull();       // 디듀프 → null(경보 안 함)
    expect(s.distinct()).toBe(1);
    expect(s.total()).toBe(2);      // 누적은 2
  });

  it("메시지/소스 절단(PII·메모리 바운드) + 최근은 최신순", () => {
    const s = new ClientErrorStore();
    s.record({ message: "a".repeat(1000), source: "b".repeat(1000) });
    s.record({ message: "later", source: "z.js" });
    const r = s.recent();
    expect(r[0].msg).toBe("later");           // 최신 먼저
    expect(r[1].msg.length).toBeLessThanOrEqual(300); // 절단
  });

  it("distinct 상한(100) 초과 시 FIFO 축출 — 메모리 무한증가 차단", () => {
    const s = new ClientErrorStore();
    for (let i = 0; i < 130; i++) s.record({ message: "e" + i });
    expect(s.distinct()).toBeLessThanOrEqual(100);
  });

  it("같은 에러 50회 배수마다 재트리거(OP-3: 조용한 볼륨 폭증도 경보)", () => {
    const s = new ClientErrorStore();
    let triggers = 0;
    for (let i = 0; i < 100; i++) { if (s.record({ message: "boom", source: "a.js:1" })) triggers++; }
    expect(triggers).toBe(3);     // 1회(새 distinct) + 50·100회(폭증 배수) = 3회만 경보(스팸 없이)
    expect(s.total()).toBe(100);
    expect(s.distinct()).toBe(1); // 같은 에러 — distinct는 1
  });
});

// 라우트 — 가짜 req/res
function mockRes() {
  const cap = { code: 0, body: "" };
  const res = { setHeader() {}, writeHead(c: number) { cap.code = c; return res; }, end(s?: string) { cap.body = s ?? ""; }, cap };
  return res as unknown as http.ServerResponse & { cap: typeof cap };
}
function mockReq(headers: Record<string, string>, body?: unknown) {
  const r: any = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  r.method = "POST"; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r as http.IncomingMessage;
}
const U = (p: string) => new URL("http://localhost" + p);

describe("POST /api/client-error — 204·기록·빈 보고 무시", () => {
  it("유효 보고 → 204 + ctx.clientErrors에 기록", async () => {
    const ctx = createContext({ ...loadConfig(), storeMode: "memory" });
    const res = mockRes();
    await route(ctx, mockReq({ "content-type": "application/json", "user-agent": "Mozilla/x" }, { message: "TypeError: undefined", source: "app:42" }), res, U("/api/client-error"));
    expect(res.cap.code).toBe(204);
    expect(res.cap.body).toBe("");           // 반사 0
    expect(ctx.clientErrors.distinct()).toBe(1);
    expect(ctx.clientErrors.recent()[0].msg).toContain("TypeError");
  });
  it("message 없으면 조용히 204(기록 안 함)", async () => {
    const ctx = createContext({ ...loadConfig(), storeMode: "memory" });
    const res = mockRes();
    await route(ctx, mockReq({ "content-type": "application/json" }, { source: "no-msg" }), res, U("/api/client-error"));
    expect(res.cap.code).toBe(204);
    expect(ctx.clientErrors.distinct()).toBe(0);
  });
});
