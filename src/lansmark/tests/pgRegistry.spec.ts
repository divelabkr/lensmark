/**
 * PG 레지스트리(스위칭 SSOT) 회귀가드 — 키 조합 → 상태/활성 판정이 정직(키 없으면 live 아님)하고 검증가능한지 고정.
 */
import { describe, it, expect } from "vitest";
import { pgRegistry, type PgPresence } from "../payment/pgRegistry";

const none: PgPresence = { tossClient: false, tossSecret: false, tossWebhook: false, paypalClient: false, paypalSecret: false, paypalWebhook: false };
const tossLive: PgPresence = { ...none, tossClient: true, tossSecret: true, tossWebhook: true };
const bothLive: PgPresence = { tossClient: true, tossSecret: true, tossWebhook: true, paypalClient: true, paypalSecret: true, paypalWebhook: true };

describe("pgRegistry 스위칭", () => {
  it("키 전무 → 둘 다 off · active=null(데모/mock 폴백)", () => {
    const r = pgRegistry(none);
    expect(r.active).toBeNull();
    expect(r.enabledKinds).toEqual([]);
    expect(r.providers.find((p) => p.kind === "toss")!.state).toBe("off");
    expect(r.providers.find((p) => p.kind === "paypal")!.state).toBe("off");
  });

  it("Toss만 완비 → active=toss · paypal off", () => {
    const r = pgRegistry(tossLive);
    expect(r.active).toBe("toss");
    expect(r.enabledKinds).toEqual(["toss"]);
  });

  it("client만(secret 없음) → pending(결제 불가) · missing=secret(webhook은 결제 불요라 제외)", () => {
    const r = pgRegistry({ ...none, paypalClient: true });
    const pp = r.providers.find((p) => p.kind === "paypal")!;
    expect(pp.state).toBe("pending");
    expect(pp.enabled).toBe(false);
    expect(pp.missing).toContain("PAYPAL_SECRET");
    expect(pp.missing).not.toContain("PAYPAL_WEBHOOK_ID"); // webhook은 결제 가능 판정과 무관(별도 readiness)
  });

  it("client+secret · webhook 없음 → live(결제 가능)이되 webhookReady=false(정직 라벨·런타임 게이트와 일치)", () => {
    const r = pgRegistry({ ...none, paypalClient: true, paypalSecret: true });
    const pp = r.providers.find((p) => p.kind === "paypal")!;
    expect(pp.state).toBe("live");       // 결제 가능 = client+secret (paypalConfigured와 동일 기준 — 라벨 거짓 금지)
    expect(pp.enabled).toBe(true);
    expect(pp.webhookReady).toBe(false); // 웹훅 미설정은 라벨에 정직 노출(운영은 부팅차단)
  });

  it("키 완비(client+secret+webhook) → live + webhookReady=true", () => {
    const r = pgRegistry(bothLive);
    expect(r.providers.find((p) => p.kind === "toss")!.webhookReady).toBe(true);
    expect(r.providers.find((p) => p.kind === "paypal")!.webhookReady).toBe(true);
  });

  it("둘 다 live + preference=paypal → active=paypal", () => {
    const r = pgRegistry(bothLive, "paypal");
    expect(r.active).toBe("paypal");
    expect(r.enabledKinds.slice().sort()).toEqual(["paypal", "toss"]);
  });

  it("preference=paypal 인데 paypal이 live 아님 → 무시·active=toss(자동 폴백)", () => {
    const r = pgRegistry(tossLive, "paypal"); // paypal off → 선호 무시
    expect(r.active).toBe("toss");
    expect(r.preference).toBe("paypal"); // 선호 자체는 보존(표시용)하되 active엔 미반영
  });

  it("둘 다 live · preference 없음 → 우선순위 toss", () => {
    const r = pgRegistry(bothLive);
    expect(r.active).toBe("toss");
  });
});
