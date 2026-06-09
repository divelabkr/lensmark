/**
 * 유료 접근 게이트(서버) — 요청에서 엔티틀먼트 + '로그인 세션 계정'을 함께 해석해 세션-인지 결속을 강제한다.
 *   목적(레드팀 #3 심화): 토큰이 구매자 계정에 결속(boundAccount)됐는데 로그인한 '타인'이 도용하면 403.
 *   세션이 없으면 bearer 사용 유지(익명 결제 흐름) — 단, 로그인 상태의 토큰 도용은 차단된다.
 *   모든 유료-기능 라우트(simulate·feedback·guide·foreign·budget·journal)가 이 한 곳을 거쳐 일관 적용.
 */
import type * as http from "node:http";
import { assertPaidEntitlement, type SimulationEntitlement } from "../src/lansmark/policy/entitlement";
import { sessionAccountUserId } from "../src/lansmark/account/sessionStore";
import { sessionTokenFrom } from "./cookies";
import type { Ctx } from "./context";

/** req.headers → HeaderReader(대소문자·배열 정규화). */
function headerReader(req: http.IncomingMessage) {
  return { get: (n: string) => { const v = req.headers[n.toLowerCase()]; return Array.isArray(v) ? (v[0] ?? null) : ((v as string) ?? null); } };
}

/** 세션-인지 유료권한 검증 — 결속 토큰은 로그인 계정과 일치해야 사용 가능(세션 있을 때). 실패 시 EntitlementError(402/403). */
export async function assertPaidAccess(ctx: Ctx, req: http.IncomingMessage): Promise<SimulationEntitlement> {
  const uid = sessionAccountUserId(ctx.sessions, sessionTokenFrom(req)); // "acct:Z" | null
  const sessionAccountId = uid ? uid.slice("acct:".length) : undefined;
  return assertPaidEntitlement(headerReader(req), { sessionAccountId });
}
