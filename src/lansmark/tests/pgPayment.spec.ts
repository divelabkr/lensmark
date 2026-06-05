import { describe, it, expect, beforeAll } from "vitest";
import * as crypto from "node:crypto";
import { verifyTossSignature, checkFreshness, extractPaidOrder, handlePgWebhook, InMemoryIdempotency } from "../payment/pgWebhook";
import { confirmPayment, PaymentError } from "../payment/confirm";
import { orderJti } from "../policy/entitlement";

const SECRET = "whsec_test";
const sign = (raw: string, tm: string) => crypto.createHmac("sha256", SECRET).update(`${raw}:${tm}`).digest("base64");

describe("payment/pgWebhook", () => {
  beforeAll(() => { process.env.LANSMARK_ENTITLEMENT_SECRET = "ent_test_secret"; });

  it("서명 검증: 정상 통과 / 변조 거부", () => {
    const raw = '{"data":{"orderId":"o1","status":"DONE"}}', tm = new Date().toISOString();
    expect(verifyTossSignature(raw, tm, sign(raw, tm), SECRET)).toBe(true);
    expect(verifyTossSignature(raw, tm, "v1:" + sign(raw, tm), SECRET)).toBe(true);
    expect(verifyTossSignature(raw + "x", tm, sign(raw, tm), SECRET)).toBe(false);
  });
  it("신선도: 오래된 전송시각 거부", () => {
    expect(checkFreshness(new Date().toISOString())).toBe(true);
    expect(checkFreshness(new Date(Date.now() - 30 * 60000).toISOString())).toBe(false);
  });
  it("extractPaidOrder: DONE→paid", () => {
    expect(extractPaidOrder({ data: { orderId: "o1", status: "DONE", totalAmount: 49000 } }).paid).toBe(true);
    expect(extractPaidOrder({ data: { orderId: "o2", status: "WAITING" } }).paid).toBe(false);
  });
  it("handlePgWebhook: 발급 + 멱등(중복 무시)", () => {
    const store = new InMemoryIdempotency();
    const raw = '{"data":{"orderId":"o9","status":"DONE","totalAmount":4900}}', tm = new Date().toISOString();
    const ctx = { rawBody: raw, transmissionTime: tm, signature: sign(raw, tm), secret: SECRET, store, userOf: () => "u1", expectedAmount: 4900 };
    const r1 = handlePgWebhook(ctx);
    expect(r1.ok && !!r1.entitlementToken).toBe(true);
    const r2 = handlePgWebhook(ctx);
    expect(r2.reason).toBe("duplicate");
    expect(r2.entitlementToken).toBeUndefined();
  });
  it("금액 불일치 웹훅 → 토큰 미발급(서버권위 가격 게이트·confirm 대칭)", () => {
    const store = new InMemoryIdempotency();
    const raw = '{"data":{"orderId":"o-bad","status":"DONE","totalAmount":49000}}', tm = new Date().toISOString();
    const r = handlePgWebhook({ rawBody: raw, transmissionTime: tm, signature: sign(raw, tm), secret: SECRET, store, userOf: () => "u1", expectedAmount: 4900 });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("amount-mismatch");
    expect(r.entitlementToken).toBeUndefined(); // 금액 4900 아니면 발급 안 함
  });
  it("PAY-DOUBLE-MINT: 웹훅 발급 토큰 jti가 주문 결정적(confirm과 동일 → quota 공유·이중발급 차단)", () => {
    const store = new InMemoryIdempotency();
    const raw = '{"data":{"orderId":"oX","status":"DONE","totalAmount":4900}}', tm = new Date().toISOString();
    const r = handlePgWebhook({ rawBody: raw, transmissionTime: tm, signature: sign(raw, tm), secret: SECRET, store, userOf: (o) => "order:" + o.orderId, expectedAmount: 4900 });
    const body = JSON.parse(Buffer.from(r.entitlementToken!.split(".")[0], "base64url").toString());
    expect(body.jti).toBe(orderJti("oX"));      // 같은 orderId면 confirm과 동일 jti
    expect(orderJti("oX")).not.toBe(orderJti("oY")); // 주문별 고유
  });
  it("나쁜 서명이면 즉시 거부", () => {
    const store = new InMemoryIdempotency();
    const r = handlePgWebhook({ rawBody: "{}", transmissionTime: new Date().toISOString(), signature: "bad", secret: SECRET, store, userOf: () => "u", expectedAmount: 4900 });
    expect(r).toEqual({ ok: false, reason: "bad-signature" });
  });
});

describe("payment/confirm", () => {
  it("금액 불일치 → 네트워크 전에 throw", async () => {
    await expect(confirmPayment({ paymentKey: "p", orderId: "o", amount: 1000, expectedAmount: 49000, userId: "u", secretKey: "sk" }))
      .rejects.toBeInstanceOf(PaymentError);
  });
});
