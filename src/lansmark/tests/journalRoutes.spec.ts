/**
 * 재배일지 라우트 검증 — 엔티틀먼트 게이트·소유권 격리·입력검증·수확→플라이휠 승격(중복 방지).
 *   route()를 직접 호출(가짜 req/res). POST는 Readable 스트림으로 바디 전달. 실제 토큰을 발급해 게이트를 통과.
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";
import { mintEntitlementToken } from "../policy/entitlement";

/** 응답 캡처용 가짜 ServerResponse. */
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
/** 가짜 IncomingMessage — body가 있으면 Readable로 data/end를 emit(readBody 호환). */
function mockReq(method = "GET", headers: Record<string, string> = {}, body?: unknown) {
  const r: any = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  r.method = method; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r as http.IncomingMessage;
}
const U = (path: string) => new URL("http://localhost" + path);

// loadConfig가 비운영 임시 시크릿을 env에 주입 → 같은 시크릿으로 토큰 발급(게이트 통과).
const ctx = createContext(loadConfig());
const authA = { "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:A" }) };
const authB = { "x-lansmark-entitlement": mintEntitlementToken({ userId: "order:B" }) };

/** 일지 1건 생성하고 id 반환(헬퍼). */
async function createEntry(auth: Record<string, string>, body: Record<string, unknown>): Promise<string> {
  const res = mockRes();
  await route(ctx, mockReq("POST", auth, body), res, U("/api/journal"));
  return JSON.parse(res.captured.body).id;
}

describe("journal routes", () => {
  it("권한 없으면 402(fail-closed 게이트)", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", {}, { cropId: "apple" }), res, U("/api/journal"));
    expect(res.captured.code).toBe(402);
    expect(JSON.parse(res.captured.body).code).toBe("ENTITLEMENT_REQUIRED");
  });

  it("cropId 없으면 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq("POST", authA, {}), res, U("/api/journal"));
    expect(res.captured.code).toBe(400);
  });
  it("실효(revoke)된 토큰은 일지 접근 거부 — consume 미호출 경로도 킬스위치(레드팀 P1)", async () => {
    const tok = mintEntitlementToken({ userId: "order:R", jti: "rev-journal-1" });
    ctx.entitlement.revoke("rev-journal-1"); // 환불/분쟁 시 admin이 실효
    const res = mockRes();
    await route(ctx, mockReq("GET", { "x-lansmark-entitlement": tok }), res, U("/api/journal"));
    expect(res.captured.code).toBe(402); // 일지는 quota 미소진이라 과거엔 실효 무시됐음 → 이제 명시 거부
    expect(JSON.parse(res.captured.body).code).toBe("ENTITLEMENT_REVOKED");
  });

  it("생성 → 단건 조회(소유자), 타인은 404(존재 누설 방지)", async () => {
    const id = await createEntry(authA, { cropId: "apple", region: "전북", areaM2: 1000 });
    expect(id).toBeTruthy();

    const own = mockRes();
    await route(ctx, mockReq("GET", authA), own, U("/api/journal?id=" + id));
    expect(own.captured.code).toBe(200);
    expect(JSON.parse(own.captured.body).entry.status).toBe("growing");

    const other = mockRes();
    await route(ctx, mockReq("GET", authB), other, U("/api/journal?id=" + id));
    expect(other.captured.code).toBe(404); // 타인 소유 → 404
  });

  it("목록은 소유자별 격리", async () => {
    await createEntry(authA, { cropId: "grape" });
    const listA = mockRes();
    await route(ctx, mockReq("GET", authA), listA, U("/api/journal"));
    const entriesA = JSON.parse(listA.captured.body).entries;
    expect(entriesA.every((e: any) => e.userId === "order:A")).toBe(true);
    expect(entriesA.length).toBeGreaterThanOrEqual(2);
  });

  it("작업 추가 → 리포트에 집계 반영", async () => {
    const id = await createEntry(authA, { cropId: "onion", areaM2: 500 });
    const ev = mockRes();
    await route(ctx, mockReq("POST", authA, { id, event: { at: "2026-04-01", kind: "fertilize", costKrw: 50000, laborHours: 3 } }), ev, U("/api/journal/event"));
    expect(ev.captured.code).toBe(200);

    const rep = mockRes();
    await route(ctx, mockReq("GET", authA), rep, U("/api/journal/report?id=" + id));
    const report = JSON.parse(rep.captured.body).report;
    expect(report.eventCount).toBe(1);
    expect(report.totalInputCostKrw).toBe(50000);
    expect(report.totalLaborHours).toBe(3);
  });

  it("수확 → 예측 baseline 있으면 플라이휠 1회 적재(중복 POST는 미적재)", async () => {
    const crop = "blueberry"; // 이 테스트 전용 작물(다른 테스트와 격리)
    const before = ctx.feedbackStore.query(crop).length;
    const id = await createEntry(authA, { cropId: crop, predicted: { yieldKg: 1000, costKrw: 2000000, revenueKrw: 5000000 } });

    const h1 = mockRes();
    await route(ctx, mockReq("POST", authA, { id, harvest: { at: "2026-09-01", yieldKg: 1200, revenueKrw: 6000000, salesChannel: "직거래" } }), h1, U("/api/journal/harvest"));
    expect(h1.captured.code).toBe(200);
    expect(JSON.parse(h1.captured.body).flywheel).toBe(true);
    expect(ctx.feedbackStore.query(crop).length).toBe(before + 1);

    const h2 = mockRes(); // 같은 일지에 수확 재기록 → 중복 적재 금지
    await route(ctx, mockReq("POST", authA, { id, harvest: { at: "2026-09-02", yieldKg: 1300 } }), h2, U("/api/journal/harvest"));
    expect(JSON.parse(h2.captured.body).flywheel).toBe(false);
    expect(ctx.feedbackStore.query(crop).length).toBe(before + 1); // 변화 없음
  });

  it("타인 일지에는 작업/수확 기록 불가(404)", async () => {
    const id = await createEntry(authA, { cropId: "pepper" });
    const ev = mockRes();
    await route(ctx, mockReq("POST", authB, { id, event: { at: "2026-04-01", kind: "spray" } }), ev, U("/api/journal/event"));
    expect(ev.captured.code).toBe(404);
  });

  it("잘못된 수확(날짜·수확량 누락)은 400", async () => {
    const id = await createEntry(authA, { cropId: "corn" });
    const bad = mockRes();
    await route(ctx, mockReq("POST", authA, { id, harvest: { at: "not-a-date", yieldKg: 10 } }), bad, U("/api/journal/harvest"));
    expect(bad.captured.code).toBe(400);
  });
  it("삭제(삭제권·PIPA): 타인은 404 · 소유자는 파기 후 조회불가", async () => {
    const id = await createEntry(authA, { cropId: "tomato", lat: 35.8, lng: 127.1 });
    const other = mockRes();
    await route(ctx, mockReq("POST", authB, { id }), other, U("/api/journal/delete"));
    expect(other.captured.code).toBe(404); // 타인은 삭제 불가(존재 누설 방지)
    const del = mockRes();
    await route(ctx, mockReq("POST", authA, { id }), del, U("/api/journal/delete"));
    expect(del.captured.code).toBe(200);
    expect(JSON.parse(del.captured.body).deleted).toBe(id);
    const gone = mockRes();
    await route(ctx, mockReq("GET", authA), gone, U("/api/journal?id=" + id));
    expect(gone.captured.code).toBe(404); // 파기 후 조회 불가
  });
});

// ── 무료 베타: 인증 토큰 없이 '브라우저 익명ID(x-lansmark-anon)'로 일지를 사용자별 격리(레드팀 H1 IDOR 회귀가드) ──
describe("journal routes — 무료 베타 익명ID 격리(H1)", () => {
  // requireEntitlement=false 컨텍스트(무료 베타). 자체 인메모리 스토어라 위 테스트와 격리.
  const ctxFree = createContext({ ...loadConfig(), requireEntitlement: false });
  const anonA = { "x-lansmark-anon": "anon-" + "a".repeat(32) };
  const anonB = { "x-lansmark-anon": "anon-" + "b".repeat(32) };

  it("익명ID 일지: 본인은 조회, 다른 익명ID는 404(위치·매출 PII 교차노출 차단)", async () => {
    const mk = mockRes();
    await route(ctxFree, mockReq("POST", anonA, { cropId: "apple", region: "전북", lat: 35.8, lng: 127.1 }), mk, U("/api/journal"));
    expect(mk.captured.code).toBe(200);
    const id = JSON.parse(mk.captured.body).id;

    const own = mockRes();
    await route(ctxFree, mockReq("GET", anonA), own, U("/api/journal?id=" + id));
    expect(own.captured.code).toBe(200); // 본인 익명ID → 조회 가능

    const other = mockRes();
    await route(ctxFree, mockReq("GET", anonB), other, U("/api/journal?id=" + id));
    expect(other.captured.code).toBe(404); // 다른 익명ID → 404(IDOR 차단)
  });

  it("목록도 익명ID별 격리 — 타인 일지 미노출", async () => {
    await route(ctxFree, mockReq("POST", anonA, { cropId: "grape" }), mockRes(), U("/api/journal"));
    const listB = mockRes();
    await route(ctxFree, mockReq("GET", anonB), listB, U("/api/journal"));
    expect(JSON.parse(listB.captured.body).entries.length).toBe(0); // B는 A의 일지를 보지 못함
  });

  it("익명 헤더 없는 요청은 빈 목록 — 과거 고정 'dev' 전체노출 회귀 차단", async () => {
    await route(ctxFree, mockReq("POST", anonA, { cropId: "onion" }), mockRes(), U("/api/journal"));
    const noHdr = mockRes();
    await route(ctxFree, mockReq("GET", {}), noHdr, U("/api/journal"));
    expect(noHdr.captured.code).toBe(200);
    expect(JSON.parse(noHdr.captured.body).entries.length).toBe(0); // 헤더 없으면 요청별 임시신원 → 전 사용자 일지 열거 불가
  });
});
