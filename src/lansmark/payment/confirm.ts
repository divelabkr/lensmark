import { mintEntitlementToken, orderJti } from "../policy/entitlement";

export class PaymentError extends Error { constructor(m: string) { super(m); this.name = "PaymentError"; } }
// ⚠ expectedAmount·userId는 호출 라우트가 **서버 권위값**(config.simPriceKrw·서버생성 ID)으로 채워야 한다 — 클라 바디 신뢰 금지(레드팀 H3).
export interface ConfirmInput { paymentKey: string; orderId: string; amount: number; expectedAmount: number; userId: string; secretKey: string; ttlMs?: number; boundAccount?: string; }

/** 결제 승인: 금액검증(서버권위 expectedAmount) → Toss confirm(amount↔paymentKey 바인딩) → 엔티틀먼트 발급 */
export async function confirmPayment(i: ConfirmInput): Promise<{ entitlementToken: string; orderId: string }> {
  if (i.amount !== i.expectedAmount) throw new PaymentError(`금액 불일치: ${i.amount} ≠ ${i.expectedAmount}`);
  if (!i.secretKey) throw new PaymentError("TOSS_SECRET_KEY 필요.");
  const auth = Buffer.from(`${i.secretKey}:`).toString("base64");
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey: i.paymentKey, orderId: i.orderId, amount: i.amount }),
    signal: AbortSignal.timeout(10_000), // 업스트림 지연 점유 방지(레드팀 L3)
  });
  if (!res.ok) { const e: any = await res.json().catch(() => ({})); throw new PaymentError(`Toss confirm 실패: ${e?.message ?? res.status}`); }
  // jti=주문 결정적 → webhook 경로와 동일 토큰(quota 공유·이중발급 차단·레드팀 PAY-DOUBLE-MINT)
  const token = mintEntitlementToken({ userId: i.userId, source: "order", reference: i.orderId, jti: orderJti(i.orderId), exp: Date.now() + (i.ttlMs ?? 30 * 86400000), ...(i.boundAccount ? { boundAccount: i.boundAccount } : {}) });
  return { entitlementToken: token, orderId: i.orderId };
}
