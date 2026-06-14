/**
 * 결제 라우트 — PG 웹훅·데모결제·승인.
 *   POST /api/pg/webhook  : Toss 웹훅 수신(HMAC 서명검증 + 멱등). userId는 서버 유래(레드팀 M2).
 *   POST /api/pay/mock    : 데모 결제 — 비운영 + Toss 키 전무일 때만 활성(레드팀 H5).
 *   POST /api/pay/confirm : 결제 승인 — 금액·userId는 서버 권위값으로 강제(클라 바디 신뢰 금지, 레드팀 H3·L1).
 */
import { json, readBody } from "../respond";
import { handlePgWebhook } from "../../src/lansmark/payment/pgWebhook";
import { confirmPayment } from "../../src/lansmark/payment/confirm";
import { mintEntitlementToken, orderJti } from "../../src/lansmark/policy/entitlement";
import { paypalConfigured, paypalWebhookConfigured, createPaypalOrder, capturePaypalToEntitlement, verifyPaypalWebhook, extractPaypalCapture, paypalAmountOk, paypalOrderKey } from "../../src/lansmark/payment/paypal";
import { sessionAccountUserId } from "../../src/lansmark/account/sessionStore";
import { sessionTokenFrom } from "../cookies";
import type { RouteFn } from "../context";

export const paymentRoutes: RouteFn = async (ctx, req, res, url) => {
  const p = url.pathname;

  if (p === "/api/pg/webhook" && req.method === "POST") {
    const raw = await readBody(req);
    const tm = (req.headers["tosspayments-webhook-transmission-time"] as string) ?? "";
    const sig = (req.headers["tosspayments-webhook-signature"] as string) ?? "";
    const r = handlePgWebhook({
      rawBody: raw, transmissionTime: tm, signature: sig, secret: process.env.PG_WEBHOOK_SECRET ?? "",
      store: ctx.idem,
      userOf: (o) => "order:" + o.orderId,  // 서버 유래 식별자(HMAC 검증된 orderId 기반) — 임의 클라 userId 주입 차단
      expectedAmount: ctx.config.simPriceKrw, // ★ 서버 권위 가격 — 금액 불일치 발급 차단(confirm과 대칭)
      ttlMs: ctx.config.entitlementTtlMs,
    });
    if (r.entitlementToken) ctx.metrics.entitlementsMinted++;
    ctx.logOps("웹훅", r.ok ? `수신 ${r.order?.orderId ?? "-"}${r.reason ? "(" + r.reason + ")" : ""}` : `거부: ${r.reason ?? "-"}`);
    json(res, r.ok ? 200 : 400, r);
    return true;
  }

  if (p === "/api/pay/mock" && req.method === "POST") {
    // 데모결제 비활성 조건: 운영(prod) 또는 Toss 키(client/secret 중 하나라도) 설정 시 — 무인증 무료토큰 차단(H5)
    if (ctx.config.isProd || ctx.config.tossClientKey || process.env.TOSS_SECRET_KEY) {
      json(res, 404, { error: "not found", path: p });
      return true;
    }
    const userId = "demo-" + Date.now().toString(36);
    const entitlementToken = mintEntitlementToken({ userId, source: "admin", reference: "mock-pay", exp: Date.now() + 7 * 86400000 }); // 데모 7일
    ctx.metrics.mockPaysIssued++; ctx.metrics.entitlementsMinted++;
    ctx.logOps("결제", `데모 결제 — 엔티틀먼트 발급(${userId})`);
    json(res, 200, { ok: true, mode: "mock", entitlementToken, userId, priceKrw: ctx.config.simPriceKrw });
    return true;
  }

  if (p === "/api/pay/confirm" && req.method === "POST") {
    let body: any = {};
    try { body = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    // 구매자 계정 결속(레드팀 #3): 로그인 상태면 엔티틀먼트를 그 계정에 묶어 타인 선점 차단(비로그인이면 미결속=웹훅 경로와 동일).
    const acctUid = sessionAccountUserId(ctx.sessions, sessionTokenFrom(req));
    try {
      const out = await confirmPayment({
        paymentKey: String(body.paymentKey ?? ""),
        orderId: String(body.orderId ?? ""),
        amount: Number(body.amount),                       // 클라 주장 결제액 — Toss가 paymentKey↔amount 바인딩 검증
        expectedAmount: ctx.config.simPriceKrw,            // ★ 서버 권위 가격(클라 expectedAmount 무시)
        userId: "order:" + String(body.orderId ?? "anon"), // ★ 서버 유래 userId(클라 userId 무시)
        secretKey: process.env.TOSS_SECRET_KEY ?? "",
        ttlMs: ctx.config.entitlementTtlMs,
        boundAccount: acctUid ? acctUid.slice("acct:".length) : undefined, // 로그인 계정에 결속(미로그인=undefined)
      });
      if (out.entitlementToken) ctx.metrics.entitlementsMinted++;
      json(res, 200, out);
    } catch (e: any) {
      ctx.logOps("결제", `confirm 실패: ${e?.message ?? e}`); // 상세는 서버 로그만(정보유출 방지)
      json(res, 402, { error: "결제 승인에 실패했습니다.", code: "PAYMENT_FAILED" });
    }
    return true;
  }

  // ── PayPal(두 번째 PG) — 키 없으면 비활성(404·노출 안 함). 흐름: create → 사용자 승인 → capture(서버권위 금액검증) → 발급. ──
  if (p === "/api/pay/paypal/create" && req.method === "POST") {
    if (!paypalConfigured()) { json(res, 404, { error: "not found", path: p }); return true; } // 키 없으면 fail-closed
    try {
      const out = await createPaypalOrder(ctx.config.simPriceKrw); // 금액=서버권위 단가(클라 금액 안 받음)
      ctx.logOps("결제", `PayPal 주문 생성 ${out.orderId}`);
      json(res, 200, { ok: true, provider: "paypal", ...out });
    } catch (e: any) {
      ctx.logOps("결제", `PayPal create 실패: ${e?.message ?? e}`); // 상세는 서버 로그만
      json(res, 502, { error: "PayPal 주문 생성에 실패했습니다.", code: "PAYPAL_CREATE_FAILED" });
    }
    return true;
  }

  if (p === "/api/pay/paypal/capture" && req.method === "POST") {
    if (!paypalConfigured()) { json(res, 404, { error: "not found", path: p }); return true; }
    let body: any = {};
    try { body = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const acctUid = sessionAccountUserId(ctx.sessions, sessionTokenFrom(req)); // 로그인 계정 결속(레드팀 #3)
    try {
      const out = await capturePaypalToEntitlement({
        orderId: String(body.orderId ?? ""),
        expectedAmount: ctx.config.simPriceKrw,            // ★ 서버 권위 가격(클라 금액 무시)
        ttlMs: ctx.config.entitlementTtlMs,
        boundAccount: acctUid ? acctUid.slice("acct:".length) : undefined,
      });
      if (out.entitlementToken) ctx.metrics.entitlementsMinted++;
      ctx.logOps("결제", `PayPal 캡처 발급 ${out.orderId}`);
      json(res, 200, { ok: true, provider: "paypal", ...out });
    } catch (e: any) {
      ctx.logOps("결제", `PayPal capture 실패: ${e?.message ?? e}`); // 상세는 서버 로그만(정보유출 방지)
      json(res, 402, { error: "결제 승인에 실패했습니다.", code: "PAYMENT_FAILED" });
    }
    return true;
  }

  if (p === "/api/pg/paypal/webhook" && req.method === "POST") {
    if (!paypalWebhookConfigured()) { json(res, 404, { error: "not found", path: p }); return true; }
    const raw = await readBody(req);
    const hdr = (n: string) => (req.headers[n] as string) ?? undefined;
    // 서명검증(PayPal verify-webhook-signature API) — 실패는 전부 거부(fail-closed). userId·금액은 서버권위(클라 신뢰 금지).
    const ok = await verifyPaypalWebhook({
      "paypal-auth-algo": hdr("paypal-auth-algo"), "paypal-cert-url": hdr("paypal-cert-url"),
      "paypal-transmission-id": hdr("paypal-transmission-id"), "paypal-transmission-sig": hdr("paypal-transmission-sig"),
      "paypal-transmission-time": hdr("paypal-transmission-time"),
    }, raw);
    if (!ok) { ctx.logOps("웹훅", "PayPal 거부: bad-signature"); json(res, 400, { ok: false, reason: "bad-signature" }); return true; }
    let event: any = {};
    try { event = JSON.parse(raw); } catch { json(res, 400, { ok: false, reason: "bad-json" }); return true; }
    const cap = extractPaypalCapture(event);
    if (!cap.completed) { json(res, 200, { ok: true, ignored: event?.event_type ?? "non-capture" }); return true; } // 캡처완료 아님 → 무시
    if (!paypalAmountOk(cap.currency, cap.amountValue, ctx.config.simPriceKrw)) { json(res, 200, { ok: true, reason: "amount-mismatch" }); return true; } // 서버권위 금액 불일치 → 발급 안 함
    const nsKey = paypalOrderKey(cap.orderId); // PG 네임스페이스(Toss orderId와 jti/userId 충돌 차단·entitlement-cross-2)
    if (ctx.idem.seen(nsKey)) { json(res, 200, { ok: true, reason: "duplicate" }); return true; }                            // 멱등(재전송 차단)
    // jti=주문 결정적 → capture 경로와 동일 토큰(quota 공유·이중발급 차단·PAY-DOUBLE-MINT)
    const token = mintEntitlementToken({ userId: "order:" + nsKey, source: "order", reference: cap.orderId, jti: orderJti(nsKey), exp: Date.now() + ctx.config.entitlementTtlMs });
    ctx.idem.mark(nsKey);
    ctx.metrics.entitlementsMinted++;
    ctx.logOps("웹훅", `PayPal 수신 ${cap.orderId}`);
    json(res, 200, { ok: true, provider: "paypal", entitlementToken: token, orderId: cap.orderId });
    return true;
  }

  return false;
};
