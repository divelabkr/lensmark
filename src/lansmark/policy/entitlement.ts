import * as crypto from "node:crypto";

// 프레임워크 독립: NextRequest 대신 헤더 reader만 받는다(테스트 용이).
// 라우트에서는 assertPaidEntitlement(req.headers) 로 호출 (Headers.get 호환).
export interface HeaderReader {
  get(name: string): string | null;
}

export type EntitlementSource = "order" | "subscription" | "admin";

export interface SimulationEntitlement {
  userId: string;
  source: EntitlementSource;
  reference?: string;
  parcelId?: string; // 발급 시 특정 필지에 결속(선택) — 결속 시 해당 필지 외 사용 거부 가능
  jti?: string;      // 토큰 고유 ID — 소진(quota)·실효(revocation) 추적용
  exp?: number;      // 만료 epoch ms(있으면) — 계정 연결 후 만료 판정용(레드팀 #1: 만료 후에도 pro 유지 차단)
  boundAccount?: string; // 발급 시 구매자 계정에 결속(있으면) — 타 계정 연결 차단(레드팀 #3 bearer 선점)
}

export class EntitlementError extends Error {
  status: 401 | 402 | 403;
  constructor(status: 401 | 402 | 403, message: string) {
    super(message);
    this.name = "EntitlementError";
    this.status = status;
  }
}

/**
 * 유료 시뮬레이션 권한 검증 — 서버 권위(server-authoritative), fail-closed.
 * ⚠️ 권한은 절대 클라이언트(body/query)가 주장하게 두지 않는다.
 */
export async function assertPaidEntitlement(headers: HeaderReader): Promise<SimulationEntitlement> {
  const token = headers.get("x-lansmark-entitlement");
  if (!token) throw new EntitlementError(402, "Paid simulation access required.");
  const ent = verifyEntitlementToken(token);
  if (!ent) throw new EntitlementError(403, "Invalid or expired entitlement.");
  return ent;
}

interface EntitlementPayload {
  userId: string;
  source?: EntitlementSource;
  reference?: string;
  parcelId?: string;
  jti?: string;
  exp?: number; // epoch ms
  boundAccount?: string; // 구매자 계정 결속(confirm 경로에서 세팅)
}

/**
 * 주문 단위 결정적 jti — 같은 orderId의 두 발급 경로(confirm·webhook)가 '동일 jti'를 갖게 해
 *   quota(jti 단위 소진)를 1회로 공유하고 revoke도 한 번에 적용(이중발급=quota 2배 차단·레드팀 PAY-DOUBLE-MINT).
 */
export function orderJti(orderId: string): string {
  return "ord-" + crypto.createHash("sha256").update(String(orderId)).digest("hex").slice(0, 24);
}

/**
 * 무료 베타 익명 제출자 ID — 인증 토큰이 없는 무료 단계에서 '브라우저별' 신원을 부여한다.
 *   · 클라가 보낸 x-lansmark-anon(브라우저당 1회 생성·localStorage 보관)을 형식검증 후 그대로 사용 →
 *     재배일지를 사용자별로 격리(고정 'dev' 공유로 인한 교차사용자 노출=IDOR 차단·레드팀 H1).
 *   · 헤더가 없거나 형식 불량이면 요청별 임시 ID(= 타인 데이터 조회 불가, 무해한 격리 실패).
 *   · 반드시 'anon-' 접두사 → distinctSubmitters('✓검증' 배지)에서 제외되어, 무료 익명 제출이 검증을 부풀리지 못한다(위조 차단).
 *   ⚠ 무작위ID 기반 격리는 '추측 불가'에 의존하는 무료베타용 — 암호학적 인증(유료 엔티틀먼트)과 다르다.
 */
export function anonSubmitterId(headerVal: unknown): string {
  return (typeof headerVal === "string" && /^anon-[a-f0-9]{8,64}$/.test(headerVal))
    ? headerVal
    : "anon-" + crypto.randomUUID().replace(/-/g, "");
}

/** 서버에서만 호출: 결제 성공 후 토큰 발급. jti 미지정 시 자동 생성(소진·실효 추적용). */
export function mintEntitlementToken(payload: EntitlementPayload): string {
  const secret = requireSecret();
  const full: EntitlementPayload = { ...payload, jti: payload.jti ?? crypto.randomUUID() };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${sig}`;
}

function verifyEntitlementToken(token: string): SimulationEntitlement | null {
  const secret = process.env.LANSMARK_ENTITLEMENT_SECRET;
  if (!secret) return null; // fail-closed
  if (typeof token !== "string" || token.length > 4096) return null; // 비정상 큰 토큰 → HMAC/base64/JSON 비용증폭 차단(레드팀: 입력 길이 미제한)
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as EntitlementPayload;
    if (!payload.userId) return null;
    if (typeof payload.exp === "number" && Date.now() > payload.exp) return null;
    return { userId: payload.userId, source: payload.source ?? "order", reference: payload.reference, parcelId: payload.parcelId, jti: payload.jti, exp: payload.exp, boundAccount: payload.boundAccount };
  } catch {
    return null;
  }
}

function requireSecret(): string {
  const secret = process.env.LANSMARK_ENTITLEMENT_SECRET;
  if (!secret) throw new Error("LANSMARK_ENTITLEMENT_SECRET is not set.");
  return secret;
}
