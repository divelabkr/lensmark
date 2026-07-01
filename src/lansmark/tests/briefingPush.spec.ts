/**
 * 아침 브리핑 푸시 검증 — 메시지 조립(제목 우선순위·수치 가드레일) + 발송 라우트(관리자 게이트·구독자별 맞춤·만료 정리).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";
import { briefingPushMessage } from "../briefing/briefingPush";
import { buildDailyBriefing } from "../briefing/dailyBriefing";
import { mockDailyForecast } from "../data/providers/forecast";
import type { PushSender, PushSubscription, PushMessage } from "../integrations/push";

/* ── 메시지 조립(순수) ── */
const FARM = { journalId: "j1", cropId: "apple", region: "전북 장수군" };
const T = "2026-04-05";
function briefingWith(minC: number) {
  const f = mockDailyForecast(35.6, 127.5, T);
  f.days[0].minC = minC; f.days[0].maxC = Math.max(minC + 8, f.days[0].maxC);
  return buildDailyBriefing(FARM, { todayIso: T, forecast: f });
}

describe("briefingPushMessage", () => {
  it("warn 위험이 제목이 되고, 본문에 기온·첫 할 일 포함", () => {
    const m = briefingPushMessage(briefingWith(-2)); // 사과(서리 민감 high) + 영하 → 서리 warn
    expect(m.title).toContain("사과");
    expect(m.title).toContain("서리");
    expect(m.body).toContain("℃");
    expect(m.url).toBe("/app");
  });
  it("KMA 특보가 있으면 특보가 제목 최우선", () => {
    const b = briefingWith(-2);
    b.warnings = ["전주 폭염 경보"];
    expect(briefingPushMessage(b).title).toContain("폭염 경보");
  });
  it("가드레일: 푸시 본문에 소득·원 단위 수치 없음(보장 오인 방지)", () => {
    const b = briefingWith(10);
    b.market = { p50KrwPerKg: 2500, source: "KAMIS", asOf: "x" }; // 시세가 있어도
    const m = briefingPushMessage(b);
    expect(m.title + m.body).not.toMatch(/원|수익|소득/);
  });
  it("다른 농장 수(+N곳)·본문 상한", () => {
    const m = briefingPushMessage(briefingWith(5), 3);
    expect(m.body).toContain("+2곳");
    expect(m.body.length).toBeLessThanOrEqual(160);
  });
});

/* ── 발송 라우트(/api/ops/push-briefing) ── */
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

process.env.LANSMARK_DATA_MODE = "mock"; // 예보 외부호출 차단(결정성)
const ADMIN = "admin-secret-push";
const adminH = { "x-lansmark-admin": ADMIN, "content-type": "application/json" };
const ctx = createContext({ ...loadConfig(), adminToken: ADMIN, requireEntitlement: false });

/** 가짜 발신자 — 발송 기록 + gone 시뮬레이션(만료 endpoint는 저장소에서 파기되는지 검증). */
const sentLog: { endpoint: string; msg: PushMessage }[] = [];
ctx.pushSender = {
  mode: "live",
  async send(sub: PushSubscription, msg: PushMessage) {
    if (sub.endpoint.includes("gone")) return { ok: false, reason: "gone", gone: true };
    sentLog.push({ endpoint: sub.endpoint, msg });
    return { ok: true };
  },
} as PushSender;

const anonA = "anon-aaaaaaaaaaaaaaaa"; // 농장 있는 구독자
const anonB = "anon-bbbbbbbbbbbbbbbb"; // 농장 없는 구독자(탐색만)
const SUB = (ep: string): PushSubscription => ({ endpoint: ep, keys: { p256dh: "k", auth: "a" } });

describe("POST /api/ops/push-briefing", () => {
  beforeAll(async () => {
    // A: 내 농장 1곳(재배중) + 기기 2대 구독(+만료 1대) · B: 구독만(농장 0).
    const res = mockRes();
    await route(ctx, mockReq("POST", { "x-lansmark-anon": anonA, "content-type": "application/json" },
      { cropId: "apple", region: "전북 장수군", lat: 35.65, lng: 127.52, plantedAt: "2026-04-01" }), res, U("/api/journal"));
    expect(res.captured.code).toBe(200);
    ctx.pushSubs.upsert(SUB("https://fcm.googleapis.com/send/dev1"), { subscriberId: anonA });
    ctx.pushSubs.upsert(SUB("https://fcm.googleapis.com/send/gone1"), { subscriberId: anonA });
    ctx.pushSubs.upsert(SUB("https://fcm.googleapis.com/send/devB"), { subscriberId: anonB });
  });

  it("관리자 토큰 없으면 401(쓰기 게이트)", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", { "content-type": "application/json" }, {}), res, U("/api/ops/push-briefing"));
    expect(res.captured.code).toBe(401);
  });

  it("구독자별 자기 농장 브리핑 발송 · 농장 없으면 스킵 · 만료 구독 파기", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", adminH, {}), res, U("/api/ops/push-briefing"));
    expect(res.captured.code).toBe(200);
    const r = JSON.parse(res.captured.body);
    expect(r.sent).toBe(1);            // A의 살아있는 기기 1대
    expect(r.gone).toBe(1);            // 만료 endpoint 정리
    expect(r.skippedNoFarm).toBe(1);   // B(농장 0)
    expect(ctx.pushSubs.size()).toBe(2); // gone1 파기됨(dev1 + devB 잔존)
    expect(sentLog[0].msg.title).toContain("사과"); // '자기 작물' 맞춤 확인
    expect(sentLog[0].msg.url).toBe("/app");
  });
});
