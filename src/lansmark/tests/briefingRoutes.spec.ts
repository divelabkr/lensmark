/**
 * 데일리 브리핑 라우트 검증 — 신원 격리(내 농장만)·mock 예보 폴백·미등록 작물 스킵·무중단.
 *   외부호출 결정성: LANSMARK_DATA_MODE=mock(예보 즉시 mock·KMA 키 없음=특보 []) — 네트워크 없이 그린.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";
import { mintEntitlementToken } from "../policy/entitlement";

/** 응답 캡처용 가짜 ServerResponse(journalRoutes.spec와 동일 하니스). */
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
function mockReq(method = "GET", headers: Record<string, string> = {}, body?: unknown) {
  const r: any = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  r.method = method; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r as http.IncomingMessage;
}
const U = (path: string) => new URL("http://localhost" + path);

process.env.LANSMARK_DATA_MODE = "mock"; // 예보·시세 외부호출 차단(결정성) — 예보는 mock 폴백(demo=true) 검증까지 겸함
const ctx = createContext(loadConfig());
const authA = { "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:BA" }) };
const authB = { "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:BB" }) };

async function get(auth: Record<string, string>) {
  const res = mockRes();
  await route(ctx, mockReq("GET", auth), res, U("/api/briefing"));
  return { code: res.captured.code, body: JSON.parse(res.captured.body || "{}") };
}
async function createJournal(auth: Record<string, string>, body: Record<string, unknown>) {
  const res = mockRes();
  await route(ctx, mockReq("POST", auth, body), res, U("/api/journal"));
  return JSON.parse(res.captured.body);
}

describe("briefing routes", () => {
  beforeAll(async () => {
    // 사용자 A의 농장 2곳(정상 작물) + 미등록 작물 1곳(스킵 대상). B는 0곳.
    await createJournal(authA, { cropId: "apple", region: "전북 장수군", lat: 35.65, lng: 127.52, plantedAt: "2026-04-01", areaM2: 3300 });
    await createJournal(authA, { cropId: "napa_cabbage", region: "강원 평창군", lat: 37.37, lng: 128.39 });
    await createJournal(authA, { cropId: "totally_unknown_crop" }); // getCropProfile throw → 해당 농장만 스킵
  });

  it("권한 없으면 402(journal과 동일 게이트)", async () => {
    const res = mockRes();
    await route(ctx, mockReq("GET", {}), res, U("/api/briefing"));
    expect(res.captured.code).toBe(402);
  });

  it("농장 없으면 farms:[] (빈 상태 정상 응답)", async () => {
    const r = await get(authB);
    expect(r.code).toBe(200);
    expect(r.body.farms).toEqual([]);
    expect(r.body.totalGrowing).toBe(0);
  });

  it("내 농장별 브리핑 — 미등록 작물은 스킵·나머지 무중단, mock 예보는 demo 라벨", async () => {
    const r = await get(authA);
    expect(r.code).toBe(200);
    expect(r.body.totalGrowing).toBe(3);
    const crops = r.body.farms.map((f: { cropId: string }) => f.cropId).sort();
    expect(crops).toEqual(["apple", "napa_cabbage"]); // unknown은 스킵(500 아님)
    const apple = r.body.farms.find((f: { cropId: string }) => f.cropId === "apple");
    expect(apple.today).not.toBeNull();            // 좌표 있음 → mock 예보 폴백
    expect(apple.week.length).toBe(7);
    expect(apple.demo).toBe(true);                 // mock 예보 = 데모 라벨 강제(정직성)
    expect(apple.checklist.length).toBeGreaterThan(0);
    expect(apple.stage.daysSincePlanting).toBeGreaterThan(0);
    expect(apple.market).toBeNull();               // mock 시세는 앵커 거부(호도 금지)
    expect(apple.disclaimer).toContain("보장");
  });

  it("타인 농장은 안 보임(신원 격리) — B의 브리핑에 A 농장 미포함", async () => {
    const r = await get(authB);
    expect(r.body.farms).toEqual([]);
  });

  it("좌표 없는 농장은 예보 null·기본 체크리스트(무중단)", async () => {
    const auth = { "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:BC" }) };
    await createJournal(auth, { cropId: "grape" }); // lat/lng 없음
    const r = await get(auth);
    expect(r.code).toBe(200);
    expect(r.body.farms[0].today).toBeNull();
    expect(r.body.farms[0].checklist.length).toBeGreaterThan(0);
  });
});
