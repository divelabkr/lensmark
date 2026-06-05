/**
 * Next.js App Router example
 * Suggested path: app/api/lansmark/simulate/route.ts
 * 주의: entitlement 검증이 node:crypto를 쓰므로 이 라우트는 node 런타임 필요(edge X).
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey } from "./_rateLimit";
import { runLansmarkSimulation } from "@/src/lansmark/core/simulator";
import { assertPaidEntitlement, EntitlementError } from "@/src/lansmark/policy/entitlement";
import { validateSimulationInput, ValidationError } from "@/src/lansmark/core/validate";

// 제한 소일 API는 라우트 상단이 아니라 실제 호출부(fetchRestrictedSoilEvidence)에서만 게이트한다.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`paid-simulation:${clientKey(req.headers)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  try {
    // 1) 권한: 서버 권위 검증 (클라이언트의 paid 주장 신뢰 금지, fail-closed)
    const entitlement = await assertPaidEntitlement(req.headers);

    // 2) 입력: 런타임 검증 + 상·하한 클램프
    const body = (await req.json()) as { input?: unknown };
    const input = validateSimulationInput(body?.input);

    // 3) 시뮬레이션
    const result = runLansmarkSimulation(input);

    return NextResponse.json({
      ok: true,
      mode: "paid_simulation",
      userId: entitlement.userId,
      result,
    });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    // 내부 에러 메시지는 클라이언트에 노출하지 않는다 (M3)
    console.error("[lansmark] simulate error", error);
    return NextResponse.json({ ok: false, error: "Simulation failed." }, { status: 500 });
  }
}
