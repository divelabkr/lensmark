import * as crypto from "node:crypto";
import { mintEntitlementToken, orderJti } from "../policy/entitlement";

export interface PaidOrder { orderId: string; paymentKey?: string; status: string; totalAmount?: number; paid: boolean; }
export interface IdempotencyStore { seen(key: string): boolean; mark(key: string): void; }
export class InMemoryIdempotency implements IdempotencyStore {
  private s = new Set<string>();
  constructor(private readonly max = 50_000) {} // 메모리 상한(레드팀 M9). ⚠ 운영은 영속 스토어(DB unique/Redis)로 — 재시작/다중인스턴스 재생방지(M3)는 DB 필요.
  seen(k: string) { return this.s.has(k); }
  mark(k: string) { this.s.add(k); if (this.s.size > this.max) { const f = this.s.keys().next().value as string | undefined; if (f) this.s.delete(f); } }
}

/** Toss 웹훅 서명 검증: base64( HMAC-SHA256( `${rawBody}:${transmissionTime}`, secret ) ) */
export function verifyTossSignature(rawBody: string, transmissionTime: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const mac = crypto.createHmac("sha256", secret).update(`${rawBody}:${transmissionTime}`).digest("base64");
  const candidates = signatureHeader.replace(/^v1[:=]/, "").split(",").map((s) => s.trim());
  return candidates.some((c) => {
    try { const a = Buffer.from(c), b = Buffer.from(mac); return a.length === b.length && crypto.timingSafeEqual(a, b); }
    catch { return false; }
  });
}
/** 전송시각 신선도(기본 ±5분) */
export function checkFreshness(transmissionTime: string, maxSkewMs = 5 * 60 * 1000, now = Date.now()): boolean {
  const t = Date.parse(transmissionTime);
  return !isNaN(t) && Math.abs(now - t) <= maxSkewMs;
}
/** 페이로드 → 주문 상태 (DONE=결제완료) */
export function extractPaidOrder(payload: any): PaidOrder {
  const d = payload?.data ?? payload;
  const status = d?.status ?? "UNKNOWN";
  return { orderId: d?.orderId ?? "", paymentKey: d?.paymentKey, status, totalAmount: d?.totalAmount, paid: status === "DONE" };
}

export interface WebhookCtx {
  rawBody: string; transmissionTime: string; signature: string; secret: string;
  store: IdempotencyStore; userOf: (o: PaidOrder) => string;
  expectedAmount: number; // ★ 서버 권위 가격(config.simPriceKrw) — 금액 불일치 결제는 발급 차단(confirm 경로와 대칭·레드팀 PAY-WEBHOOK-AMOUNT)
  ttlMs?: number; // 발급 토큰 수명(미지정 시 30일)
}
/** 웹훅 처리: 서명→신선도→파싱→금액검증→(완료&미처리면) 엔티틀먼트 발급 */
export function handlePgWebhook(ctx: WebhookCtx): { ok: boolean; reason?: string; order?: PaidOrder; entitlementToken?: string } {
  if (!verifyTossSignature(ctx.rawBody, ctx.transmissionTime, ctx.signature, ctx.secret)) return { ok: false, reason: "bad-signature" };
  if (!checkFreshness(ctx.transmissionTime)) return { ok: false, reason: "stale" };
  let order: PaidOrder;
  try { order = extractPaidOrder(JSON.parse(ctx.rawBody)); } catch { return { ok: false, reason: "bad-json" }; }
  if (!order.paid) return { ok: true, order };                       // 상태변경 등 → 무시
  // '결제 성공' ≠ '이 제품 가격을 정확히 결제'. 서버권위 가격과 불일치면 발급 안 함(부분결제·할인·타상품·미상금액 fail-closed).
  if (order.totalAmount !== ctx.expectedAmount) return { ok: true, order, reason: "amount-mismatch" };
  if (ctx.store.seen(order.orderId)) return { ok: true, order, reason: "duplicate" };
  ctx.store.mark(order.orderId);
  // userId는 서버 유래(orderId 기반, HMAC 검증된 페이로드) — 임의 클라 userId 주입 차단(레드팀 M2).
  // jti=주문 결정적 → confirm 경로와 동일 토큰(quota 공유·이중발급 차단·레드팀 PAY-DOUBLE-MINT)
  const token = mintEntitlementToken({ userId: ctx.userOf(order), source: "order", reference: order.orderId, jti: orderJti(order.orderId), exp: Date.now() + (ctx.ttlMs ?? 30 * 86400000) });
  return { ok: true, order, entitlementToken: token };
}
