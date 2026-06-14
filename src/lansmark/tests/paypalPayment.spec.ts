/**
 * PayPal provider fail-closed 회귀가드 — 키 없으면 절대 발급/검증 통과 금지(거짓 성공 차단·정직성 1원칙)
 *   + 서버권위 금액검증(paypalAmountOk) + cert_url 화이트리스트(위조/SSRF 방어).
 *   ※ 키 미설정 경로는 네트워크를 타지 않음(configured 체크/accessToken throw가 fetch 전에 차단) → 오프라인 결정적.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { paypalConfigured, paypalWebhookConfigured, paypalAmountOk, paypalCertUrlOk, verifyPaypalWebhook, createPaypalOrder, capturePaypalToEntitlement, paypalOrderKey } from "../payment/paypal";
import { orderJti } from "../policy/entitlement";

const KEYS = ["PAYPAL_CLIENT_ID", "PAYPAL_SECRET", "PAYPAL_WEBHOOK_ID", "PAYPAL_ENV"];
const SAVED: Record<string, string | undefined> = {};
beforeEach(() => { for (const k of KEYS) { SAVED[k] = process.env[k]; delete process.env[k]; } }); // 키 제거(미설정 상태 보장)
afterEach(() => { for (const k of KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; } });

describe("PayPal fail-closed(키 없음)", () => {
  it("키 없으면 configured=false", () => {
    expect(paypalConfigured()).toBe(false);
    expect(paypalWebhookConfigured()).toBe(false);
  });
  it("키 없으면 웹훅 검증 false(네트워크 안 탐)", async () => {
    const v = await verifyPaypalWebhook({ "paypal-cert-url": "https://api.paypal.com/x" }, "{}");
    expect(v).toBe(false);
  });
  it("키 없으면 createOrder/capture는 throw(발급 불가)", async () => {
    await expect(createPaypalOrder(4900)).rejects.toThrow();
    await expect(capturePaypalToEntitlement({ orderId: "o1", expectedAmount: 4900 })).rejects.toThrow();
  });
});

describe("PayPal 서버권위 금액검증(paypalAmountOk)", () => {
  it("KRW·정확금액만 통과", () => {
    expect(paypalAmountOk("KRW", "4900", 4900)).toBe(true);
    expect(paypalAmountOk("KRW", "4900.0", 4900)).toBe(true);
  });
  it("통화/금액 불일치 거부(부분·타금액·미상 fail-closed)", () => {
    expect(paypalAmountOk("USD", "4900", 4900)).toBe(false);
    expect(paypalAmountOk("KRW", "4800", 4900)).toBe(false);
    expect(paypalAmountOk("KRW", "49000", 4900)).toBe(false);
    expect(paypalAmountOk("KRW", undefined, 4900)).toBe(false);
  });
});

describe("PayPal cert_url 화이트리스트(paypalCertUrlOk)", () => {
  it("paypal.com 도메인만 허용", () => {
    expect(paypalCertUrlOk("https://api.paypal.com/cert")).toBe(true);
    expect(paypalCertUrlOk("https://api.sandbox.paypal.com/cert")).toBe(true);
  });
  it("위조/타 도메인 거부(SSRF·cert 위조 방어)", () => {
    expect(paypalCertUrlOk("https://evil.com/cert")).toBe(false);
    expect(paypalCertUrlOk("https://paypal.com.evil.com/cert")).toBe(false); // 접미사 위장
    expect(paypalCertUrlOk("not-a-url")).toBe(false);
    expect(paypalCertUrlOk(undefined)).toBe(false);
  });
});

describe("PayPal 엔티틀먼트 PG 네임스페이스(orderJti 충돌 방지·entitlement-cross-2)", () => {
  it("PayPal 주문키는 동일 문자열 Toss 주문과 다른 jti(교차 PG 충돌 차단)", () => {
    expect(orderJti(paypalOrderKey("ORDER1"))).not.toBe(orderJti("ORDER1"));
  });
  it("같은 PayPal 주문은 항상 같은 jti(capture·webhook 토큰 공유 → 이중발급 차단 유지)", () => {
    expect(orderJti(paypalOrderKey("O7"))).toBe(orderJti(paypalOrderKey("O7")));
  });
});
