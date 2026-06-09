/**
 * 결제 라우트 — PG 웹훅·데모결제·승인.
 *   POST /api/pg/webhook  : Toss 웹훅 수신(HMAC 서명검증 + 멱등). userId는 서버 유래(레드팀 M2).
 *   POST /api/pay/mock    : 데모 결제 — 비운영 + Toss 키 전무일 때만 활성(레드팀 H5).
 *   POST /api/pay/confirm : 결제 승인 — 금액·userId는 서버 권위값으로 강제(클라 바디 신뢰 금지, 레드팀 H3·L1).
 */
import { json, readBody } from "../respond";
import { handlePgWebhook } from "../../src/lansmark/payment/pgWebhook";
import { confirmPayment } from "../../src/lansmark/payment/confirm";
import { mintEntitlementToken } from "../../src/lansmark/policy/entitlement";
import { sessionAccountUserId } from "../../src/lansmark/account/sessionStore";
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
    const acctUid = sessionAccountUserId(ctx.sessions, req.headers["x-lansmark-session"]);
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

  return false;
};
