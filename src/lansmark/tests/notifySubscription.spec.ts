/**
 * 알림 구독(opt-in) — 도메인 검증·저장소·SMS seam·라우트.
 *   핵심 고정: 동의 필수 · 번호 형식검증 · 마스킹(원번호 비노출) · dedupe · 해지 · 발송 미전송(seam).
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { buildSubscription, normalizePhone, maskPhone } from "../notify/alertSubscription";
import { InMemorySubscriptionStore } from "../notify/subscriptionStore";
import { createSmsSender } from "../notify/smsSender";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";

describe("alertSubscription 도메인", () => {
  it("normalizePhone: 하이픈·공백 제거 + 한국 휴대폰만", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone(" 011 123 4567 ")).toBe("0111234567");
    expect(normalizePhone("02-123-4567")).toBeNull();  // 휴대폰 아님
    expect(normalizePhone("0101234")).toBeNull();        // 짧음
    expect(normalizePhone(12345 as unknown)).toBeNull(); // 비문자열
  });
  it("maskPhone: 가운데 가림(원번호 비노출)", () => {
    expect(maskPhone("01012345678")).toBe("010****5678");
  });
  it("buildSubscription: 동의 없으면 거부 · 번호형식 거부 · 정상 생성", () => {
    const ids = { id: "x", now: "2026-06-05T00:00:00Z" };
    expect(buildSubscription({ phone: "010-1234-5678", consent: false }, ids)).toMatchObject({ ok: false, code: "CONSENT_REQUIRED" });
    expect(buildSubscription({ phone: "bad", consent: true }, ids)).toMatchObject({ ok: false, code: "BAD_PHONE" });
    const r = buildSubscription({ phone: "010-1234-5678", consent: true, region: "경북", cropId: "apple" }, ids);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.sub.phone).toBe("01012345678"); expect(r.sub.consent).toBe(true); expect(r.sub.region).toBe("경북"); expect(r.sub.cropId).toBe("apple"); }
  });
  it("buildSubscription(give/get B): cropId 화이트리스트 — 비신뢰 값은 미저장", () => {
    const ids = { id: "x", now: "2026-06-05T00:00:00Z" };
    const ok = buildSubscription({ phone: "010-1234-5678", consent: true, cropId: "sweet_potato" }, ids);
    if (ok.ok) expect(ok.sub.cropId).toBe("sweet_potato");
    for (const bad of ["DROP TABLE", "Apple", "양파", "a".repeat(50), 123 as unknown]) {
      const r = buildSubscription({ phone: "010-1234-5678", consent: true, cropId: bad }, ids); // 대문자·공백·한글·과길이·비문자열 거부
      if (r.ok) expect(r.sub.cropId).toBeUndefined();
    }
  });
});

describe("SubscriptionStore", () => {
  it("dedupe(같은 번호 갱신) · 해지=실제 삭제(파기) · 활성 카운트", () => {
    const s = new InMemorySubscriptionStore();
    const a = buildSubscription({ phone: "01011112222", consent: true }, { id: "1", now: "t" });
    if (!a.ok) throw new Error("setup");
    s.upsert(a.sub); s.upsert(a.sub); // 재신청 → 중복 누적 X
    expect(s.size()).toBe(1);
    expect(s.countActive()).toBe(1);
    expect(s.unsubscribe("01011112222")).toBe(true);
    expect(s.size()).toBe(0);          // 해지=파기(레코드 삭제 — PII 미잔존)
    expect(s.countActive()).toBe(0);
    expect(s.getByPhone("01011112222")).toBeUndefined();
    expect(s.unsubscribe("01011112222")).toBe(false); // 이미 삭제됨
    expect(s.unsubscribe("01099998888")).toBe(false); // 없음
  });
});

describe("smsSender seam", () => {
  it("createSmsSender=console · 미전송(ok:false)", async () => {
    const s = createSmsSender();
    expect(s.mode).toBe("console");
    expect((await s.send("01012345678", "테스트")).ok).toBe(false);
  });
});

describe("notify 라우트(/api/alerts/subscribe·unsubscribe)", () => {
  function mockRes() {
    const captured = { code: 0, body: "" };
    const res = { setHeader() {}, writeHead(c: number) { captured.code = c; return res; }, end(s?: string) { captured.body = s ?? ""; }, captured };
    return res as unknown as http.ServerResponse & { captured: typeof captured };
  }
  function mockReq(body?: unknown) {
    const r: any = Readable.from(body == null ? [] : [JSON.stringify(body)]);
    r.method = "POST"; r.headers = {}; r.socket = { remoteAddress: "127.0.0.1" };
    return r as http.IncomingMessage;
  }
  const U = (p: string) => new URL("http://localhost" + p);
  const ctx = createContext(loadConfig());

  it("subscribe: 동의+번호 → 200 · 마스킹 응답 · 원번호 비노출", async () => {
    const res = mockRes();
    await route(ctx, mockReq({ phone: "010-1234-5678", consent: true }), res, U("/api/alerts/subscribe"));
    expect(res.captured.code).toBe(200);
    const j = JSON.parse(res.captured.body);
    expect(j.ok).toBe(true);
    expect(j.phone).toBe("010****5678");
    expect(res.captured.body).not.toContain("01012345678"); // 원번호 응답 비노출
    expect(ctx.subscriptions.countActive()).toBe(1);
  });
  it("subscribe: 동의 없으면 400(CONSENT_REQUIRED)", async () => {
    const res = mockRes();
    await route(ctx, mockReq({ phone: "010-1234-5678", consent: false }), res, U("/api/alerts/subscribe"));
    expect(res.captured.code).toBe(400);
    expect(JSON.parse(res.captured.body).code).toBe("CONSENT_REQUIRED");
  });
  it("subscribe: 번호 형식 위반 400", async () => {
    const res = mockRes();
    await route(ctx, mockReq({ phone: "123", consent: true }), res, U("/api/alerts/subscribe"));
    expect(res.captured.code).toBe(400);
  });
  it("unsubscribe: 번호 정규화 후 해지(항상 ok)", async () => {
    const res = mockRes();
    await route(ctx, mockReq({ phone: "010-1234-5678" }), res, U("/api/alerts/unsubscribe"));
    expect(res.captured.code).toBe(200);
    expect(JSON.parse(res.captured.body).ok).toBe(true);
  });
});
