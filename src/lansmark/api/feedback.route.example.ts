/** Next.js App Router — app/api/lansmark/feedback/route.ts */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey } from "./_rateLimit";
import type { FeedbackInput } from "@/src/lansmark/types";
// import { createRepository } from "@/src/lansmark/db/repository";
// import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const rl = rateLimit(`feedback:${clientKey(req.headers)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  try {
    const body = (await req.json()) as { feedback?: FeedbackInput };
    const f = body?.feedback;
    if (!f || (f.actualYieldKg == null && f.actualRevenueKrw == null && f.actualCostKrw == null && !f.notes)) {
      return NextResponse.json({ ok: false, error: "feedback fields required" }, { status: 400 });
    }
    // TODO(DB): const repo = createRepository(prisma); await repo.saveFeedback(f);
    return NextResponse.json({ ok: true, mode: "feedback_logged" });
  } catch (e) {
    console.error("[lansmark] feedback error", e);
    return NextResponse.json({ ok: false, error: "Request failed." }, { status: 500 });
  }
}
