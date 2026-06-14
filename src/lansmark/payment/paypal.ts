/**
 * PayPal 결제 provider — Toss와 함께 '두 번째 PG'. REST v2(checkout/orders) 기반.
 *   흐름(토스와 다름): createOrder → 사용자 승인(approve) → captureOrder → (서버권위 금액검증) → 엔티틀먼트.
 *   웹훅: PAYMENT.CAPTURE.COMPLETED 수신 → PayPal verify-webhook-signature API로 검증(로컬 HMAC 아님) → 발급.
 *
 *   ⛔ HUMAN GATE: PAYPAL_CLIENT_ID/PAYPAL_SECRET/PAYPAL_WEBHOOK_ID 미설정이면 모든 경로 fail-closed —
 *      절대 미검증 이벤트로 엔티틀먼트를 발급하지 않는다(키 없음 = 결제 불가, 거짓 성공 금지·정직성 1원칙).
 *   ⚠ 공식 docs 재검증 필요(추측 금지·CLAUDE.md#4): 아래 엔드포인트/필드는 PayPal REST v2 공개 스펙 기준이나,
 *      실 가맹 계정 연결 시 ①통화(KRW 무소수점) ②webhook 이벤트/필드 경로 ③verify-webhook-signature 응답을
 *      운영 키로 1건 E2E 확인 후 live 승격할 것. 그 전까지 기본 sandbox + fail-closed.
 */
import { mintEntitlementToken, orderJti } from "../policy/entitlement";

export class PaypalError extends Error { constructor(m: string) { super(m); this.name = "PaypalError"; } }

/** client+secret 둘 다 있어야 API 호출 가능(비밀값 비노출 — boolean만). */
export function paypalConfigured(): boolean {
  return !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_SECRET;
}
/** 웹훅 검증까지 가능한 완비 상태(webhook id 포함). */
export function paypalWebhookConfigured(): boolean {
  return paypalConfigured() && !!process.env.PAYPAL_WEBHOOK_ID;
}
/** API 베이스: PAYPAL_ENV=live(또는 prod & !sandbox)면 운영, 기본 sandbox(안전 기본값). */
export function paypalBaseUrl(): string {
  const env = (process.env.PAYPAL_ENV || "").toLowerCase();
  const live = env === "live" || (env !== "sandbox" && process.env.NODE_ENV === "production");
  return live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

/** 서버권위 금액검증(순수·검증가능) — 캡처 통화/금액이 제품 단가와 정확히 일치해야 true. KRW 무소수점 가정. */
export function paypalAmountOk(currency: unknown, paidValue: unknown, expectedKrw: number): boolean {
  const paid = Number(paidValue);
  return currency === "KRW" && Number.isFinite(paid) && Math.round(paid) === Math.round(expectedKrw);
}
/** cert_url 호스트 화이트리스트(순수·검증가능) — verify-webhook-signature에 넘기기 전 paypal.com 도메인만 허용(SSRF/위조 cert 방어). */
export function paypalCertUrlOk(url: unknown): boolean {
  if (typeof url !== "string" || !url) return false;
  try { const h = new URL(url).hostname.toLowerCase(); return /(^|\.)paypal\.com$/.test(h); } catch { return false; }
}

/** PayPal 주문의 엔티틀먼트 네임스페이스 — Toss orderId와 동일 문자열이어도 jti/userId가 겹치지 않게 'pp:' 접두(감사 entitlement-cross-2·교차 PG 충돌 차단). capture·webhook 양 경로가 동일 사용 → 같은 주문=같은 jti(이중발급 차단 유지). */
export function paypalOrderKey(orderId: string): string { return "pp:" + orderId; }

/** OAuth2 client_credentials → access token. 미설정이면 throw(fail-closed). */
async function accessToken(): Promise<string> {
  if (!paypalConfigured()) throw new PaypalError("PAYPAL 키 미설정");
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10_000), // 업스트림 지연 점유 방지(레드팀 L3 대칭)
  });
  if (!res.ok) throw new PaypalError(`oauth 실패: ${res.status}`);
  const j: any = await res.json().catch(() => ({}));
  if (!j.access_token) throw new PaypalError("access_token 없음");
  return j.access_token as string;
}

/** 주문 생성 — KRW 정밀분석 단가. 반환: {orderId, approveUrl}. 키 없으면 throw. */
export async function createPaypalOrder(amountKrw: number): Promise<{ orderId: string; approveUrl: string }> {
  const tok = await accessToken();
  // ⚠ KRW는 PayPal 무소수 통화 — value는 정수 문자열. 일부 가맹계정은 KRW 미지원일 수 있음(가맹 확인 필요).
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ amount: { currency_code: "KRW", value: String(Math.round(amountKrw)) } }] }),
    signal: AbortSignal.timeout(10_000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.id) throw new PaypalError(`order 생성 실패: ${j?.message ?? res.status}`);
  const approve = Array.isArray(j.links) ? j.links.find((l: any) => l?.rel === "approve")?.href : undefined;
  return { orderId: String(j.id), approveUrl: approve ?? "" };
}

/** 주문 캡처 → 서버권위 금액검증 → 엔티틀먼트 발급. 클라 금액 신뢰 안 함(서버 expectedAmount·레드팀 H3 대칭). */
export async function capturePaypalToEntitlement(i: { orderId: string; expectedAmount: number; ttlMs?: number; boundAccount?: string }): Promise<{ entitlementToken: string; orderId: string }> {
  if (!i.orderId) throw new PaypalError("orderId 필요");
  const tok = await accessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(i.orderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j.status !== "COMPLETED") throw new PaypalError(`capture 실패: ${j?.message ?? res.status}`);
  // 서버권위 금액 검증 — '결제 성공' ≠ '이 제품 가격 결제'. 캡처 실금액이 단가와 일치해야 발급(부분/타금액 fail-closed).
  const cap = j?.purchase_units?.[0]?.payments?.captures?.[0];
  if (!paypalAmountOk(cap?.amount?.currency_code, cap?.amount?.value, i.expectedAmount))
    throw new PaypalError(`금액 불일치: ${cap?.amount?.currency_code} ${cap?.amount?.value} ≠ KRW ${i.expectedAmount}`);
  // jti=주문 결정적(PG 네임스페이스 적용) → capture·webhook 동일 토큰(quota 공유·이중발급 차단·PAY-DOUBLE-MINT), Toss와는 충돌 안 함
  const nsKey = paypalOrderKey(i.orderId);
  const token = mintEntitlementToken({ userId: "order:" + nsKey, source: "order", reference: i.orderId, jti: orderJti(nsKey), exp: Date.now() + (i.ttlMs ?? 30 * 86400000), ...(i.boundAccount ? { boundAccount: i.boundAccount } : {}) });
  return { entitlementToken: token, orderId: i.orderId };
}

/**
 * 웹훅 서명검증 — PayPal verify-webhook-signature API(로컬 계산 아님). 미설정/실패/비정상은 전부 false(fail-closed).
 *   ⚠ 공식 docs 재검증 필요: PayPal은 cert 기반 검증을 이 엔드포인트로 대행. 운영 승격 전 실 webhook 1건으로 SUCCESS 확인.
 */
export async function verifyPaypalWebhook(headers: Record<string, string | undefined>, rawBody: string): Promise<boolean> {
  if (!paypalWebhookConfigured()) return false;                  // 키 없으면 검증 자체 불가 → 거부
  if (!paypalCertUrlOk(headers["paypal-cert-url"])) return false; // paypal.com 아닌 cert_url 거부(위조/SSRF 방어)
  let event: unknown;
  try { event = JSON.parse(rawBody); } catch { return false; }   // 파싱 불가 → 거부
  let tok: string;
  try { tok = await accessToken(); } catch { return false; }
  try {
    const res = await fetch(`${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const j: any = await res.json().catch(() => ({}));
    return res.ok && j.verification_status === "SUCCESS";
  } catch { return false; }
}

/**
 * 캡처-완료 웹훅 이벤트 → 주문/금액 추출(보수적). 필드 누락이면 completed=false로 발급 차단.
 *   ⚠ 공식 docs 재검증 필요: capture 이벤트의 order_id 경로(supplementary_data.related_ids.order_id)는 스펙 기준 — 실 페이로드로 확인.
 */
export function extractPaypalCapture(event: any): { orderId: string; amountValue: unknown; currency: unknown; completed: boolean } {
  const r = event?.resource;
  const orderId = r?.supplementary_data?.related_ids?.order_id ?? "";
  const completed = event?.event_type === "PAYMENT.CAPTURE.COMPLETED" && r?.status === "COMPLETED" && !!orderId;
  return { orderId: String(orderId), amountValue: r?.amount?.value, currency: r?.amount?.currency_code, completed };
}
