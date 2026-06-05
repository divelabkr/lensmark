/**
 * 예산·현금흐름 라우트 — 하이브리드(무료 teaser / 유료 정밀).
 *   POST /api/budget : 시설투자(capex)+융자+보조+생활비 → 다년 현금흐름·회수기간(payback)·ROI.
 *   경계: soft-gate — 토큰 없거나 quota 소진이면 '무료 간이 미리보기'로 강등(402 차단 아님 · 무료는 항상 허용).
 *         유효 토큰이면 quota 1회 소진하고 정밀 다년 결과. 입력은 전부 sanitize/clamp(변조·DoS 차단).
 *   ⚠ parcelSimulator 호출 안 함 — 연간 소득/운영비(SigmaRange)는 클라이언트가 /api/simulate 결과를 주입(wrap).
 */
import { json, readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { clampNonNeg } from "../../src/lansmark/api/security";
import { assertPaidEntitlement } from "../../src/lansmark/policy/entitlement";
import { runCashflowPlan, buildCashflowTeaser, buildFacilityCapex } from "../../src/lansmark/budget/cashflowPlan";
import { getFacilityCost, type FacilityTier } from "../../src/lansmark/data/facilityCost.seed";
import type { CashflowInput, CapexItem, LoanTerms, IncomeMode } from "../../src/lansmark/budget/types";
import type { CultivationType, SigmaRange, WarmingScenario, EmissionPath } from "../../src/lansmark/types";
import type { RouteFn } from "../context";

/* ── 상한·허용값(이상치/변조/DoS 차단) ── */
const MONEY_MAX = 1e12;   // 원
const MAX_CAPEX_ITEMS = 20;
const CULTIVATION: CultivationType[] = ["open_field", "greenhouse", "semi_facility"];
const TIERS: FacilityTier[] = ["none", "single_span", "multi_span", "smartfarm_basic", "glass_complex"];
const CAPEX_KEYS: CapexItem["key"][] = ["facility", "machinery", "irrigation", "environment_control", "other"];
const EMISSION: EmissionPath[] = ["ssp245", "ssp585"];

/* ── 작은 정규화 헬퍼 ── */
const money = (v: unknown, dflt = 0): number => clampNonNeg(v, MONEY_MAX) ?? dflt; // 0↑·상한(비유한/음수→dflt)
const inRange = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
/** SigmaRange sanitize — 0↑·상한·단조 정렬. 전부 무효면 null. */
function sigma(raw: unknown): SigmaRange | null {
  if (!isObject(raw)) return null;
  const p10 = clampNonNeg(raw.p10, MONEY_MAX), p50 = clampNonNeg(raw.p50, MONEY_MAX), p90 = clampNonNeg(raw.p90, MONEY_MAX);
  if (p10 == null && p50 == null && p90 == null) return null;
  const a = [p10 ?? 0, p50 ?? 0, p90 ?? 0].sort((x, y) => x - y);
  return { p10: a[0], p50: a[1], p90: a[2] };
}
/** 사용자 capex 항목(추가 장비 등). amountKrw는 숫자(평탄) 또는 SigmaRange. */
function userCapex(raw: unknown): CapexItem | null {
  if (!isObject(raw)) return null;
  const key = (typeof raw.key === "string" && (CAPEX_KEYS as string[]).includes(raw.key)) ? (raw.key as CapexItem["key"]) : "other";
  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.slice(0, 80) : "기타 투자";
  let amount: SigmaRange | null;
  if (typeof raw.amountKrw === "number") { const v = money(raw.amountKrw); amount = { p10: v, p50: v, p90: v }; }
  else amount = sigma(raw.amountKrw);
  if (!amount) return null;
  return { key, label, amountKrw: amount, source: "사용자 입력", verified: false };
}
/** 융자 sanitize — 원금 0↓이면 융자 없음(undefined). */
function sanitizeLoan(raw: unknown): LoanTerms | undefined {
  if (!isObject(raw)) return undefined;
  const principalKrw = money(raw.principalKrw);
  if (principalKrw <= 0) return undefined;
  return { principalKrw, annualRatePct: inRange(raw.annualRatePct, 0, 100, 0), termYears: inRange(raw.termYears, 1, 50, 10), graceYears: inRange(raw.graceYears, 0, 30, 0) };
}
/** 온난화 시나리오 sanitize(다년 난방 점감용) — year 2025~2100·path enum·ΔT 0~6. 전부 무효면 undefined. */
function sanitizeScenario(raw: unknown): WarmingScenario | undefined {
  if (!isObject(raw)) return undefined;
  const s: WarmingScenario = {};
  const y = inRange(raw.year, 2025, 2100, NaN); if (Number.isFinite(y)) s.year = Math.round(y);
  if (typeof raw.path === "string" && (EMISSION as string[]).includes(raw.path)) s.path = raw.path as EmissionPath;
  const dt = clampNonNeg(raw.deltaTempCOverride, 6); if (dt != null) s.deltaTempCOverride = dt;
  return (s.year != null || s.path || s.deltaTempCOverride != null) ? s : undefined;
}

/** 요청 본문 → CashflowInput. 필수: annualGrossIncomeKrw. 실패 시 throw(라우트가 400). */
function buildInput(b: Record<string, unknown>): CashflowInput {
  const income = sigma(b.annualGrossIncomeKrw);
  if (!income) throw new Error("annualGrossIncomeKrw(P10/P50/P90)가 필요합니다.");
  const areaM2 = money(b.areaM2);
  const cultivationType = (typeof b.cultivationType === "string" && (CULTIVATION as string[]).includes(b.cultivationType)) ? (b.cultivationType as CultivationType) : "open_field";
  const tier = (typeof b.facilityTier === "string" && (TIERS as string[]).includes(b.facilityTier)) ? (b.facilityTier as FacilityTier) : "none";

  // capex = 시설 등급 기본(시드) + 사용자 추가 항목(농기계 등). 총 항목 수 상한.
  const items: CapexItem[] = [...buildFacilityCapex(tier, areaM2)];
  if (Array.isArray(b.capexItems)) for (const it of b.capexItems.slice(0, MAX_CAPEX_ITEMS)) { const c = userCapex(it); if (c) items.push(c); }

  const incomeMode: IncomeMode = b.incomeMode === "net_income" ? "net_income" : "gross_minus_opcost";
  const opcost = sigma(b.annualOperatingCostKrw) ?? { p10: 0, p50: 0, p90: 0 };
  const ramp = Array.isArray(b.yieldRampByYear) ? b.yieldRampByYear.slice(0, 30).map((v) => inRange(v, 0, 100, 1)) : undefined;
  // 시설 등급의 난방 비중(facilityCost 시드) → 다년 난방 점감(#2). 노지(none)=난방비중 없음 → 0.
  const heatingShareOfOpCost = getFacilityCost(tier).heatingShareOfOpCost?.p50 ?? 0;

  return {
    areaM2, cultivationType, capexItems: items.slice(0, MAX_CAPEX_ITEMS),
    equityKrw: money(b.equityKrw), loan: sanitizeLoan(b.loan), subsidyKrw: money(b.subsidyKrw),
    annualGrossIncomeKrw: income, annualOperatingCostKrw: opcost, incomeMode,
    livingCostKrwPerYear: money(b.livingCostKrwPerYear), analysisYears: inRange(b.analysisYears, 1, 30, 10),
    yieldRampByYear: ramp, climateScenario: sanitizeScenario(b.climateScenario), heatingShareOfOpCost,
  };
}

export const budgetRoutes: RouteFn = async (ctx, req, res, url) => {
  if (url.pathname !== "/api/budget") return false;
  if (req.method !== "POST") { json(res, 405, { error: "허용되지 않은 메서드" }); return true; }

  // 1) 입력 검증 먼저 — 잘못된 요청이 유료 quota를 소모하지 않도록(검증 후 소진).
  let b: unknown;
  try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
  if (!isObject(b)) { json(res, 400, { error: "본문이 필요합니다." }); return true; }
  let input: CashflowInput;
  try { input = buildInput(b); } catch (e: any) { json(res, 400, { error: e?.message || "유효하지 않은 입력입니다." }); return true; }

  // 2) soft-gate: 토큰 유효+quota 통과면 정밀(paid), 아니면 무료 미리보기로 강등(무료는 항상 허용).
  let paid = false;
  if (!ctx.config.requireEntitlement) {
    paid = true; // 게이트 비활성(개발) → 정밀
  } else {
    try {
      const ent = await assertPaidEntitlement({ get: (n) => (req.headers[n.toLowerCase()] as string) ?? null });
      if (ctx.entitlement.consume(ent.jti, ctx.config.entitlementQuota)) paid = true; // 유료 경로만 quota 소진
    } catch { /* 토큰 없음/무효 → teaser */ }
  }

  // 3) 분기 응답(budget.mode = free | paid).
  json(res, 200, { ok: true, budget: paid ? runCashflowPlan(input) : buildCashflowTeaser(input) });
  return true;
};
