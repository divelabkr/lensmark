/**
 * Next.js App Router example
 * Suggested path: app/api/lansmark/free-candidates/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey } from "./_rateLimit";
import { LANSMARK_CONFIG } from "@/src/lansmark/config";
import { rankCropCandidates } from "@/src/lansmark/core/cropSuitability";
import { validateLandInput, clampCandidateLimit, ValidationError } from "@/src/lansmark/core/validate";

export async function POST(req: NextRequest) {
  const rl = rateLimit(`free-candidates:${clientKey(req.headers)}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  try {
    const body = (await req.json()) as { land?: unknown; limit?: unknown };
    const land = validateLandInput(body?.land);
    const limit = clampCandidateLimit(body?.limit, LANSMARK_CONFIG.freeCandidateLimit);

    const candidates = rankCropCandidates(land, limit);

    return NextResponse.json({
      ok: true,
      mode: "free",
      paywallAfter: "crop_candidate_top5",
      candidates,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[lansmark] free-candidates error", error);
    return NextResponse.json({ ok: false, error: "Request failed." }, { status: 500 });
  }
}
