/**
 * 귀농 자가진단 라우트 — 무료(의사결정 앞단 깔때기). POST /api/assess.
 *   자가응답 sanitize → buildReturnFarmAssessment(순수) → 준비도 점수·축·보완 액션. 외부호출 없음·엔티틀먼트 불필요.
 *   경계: 모든 입력 enum/0↑·상한 클램프. 가부 단정 금지(엔진이 '보완 항목'만 제시).
 */
import { json, readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { clampNonNeg } from "../../src/lansmark/api/security";
import { buildReturnFarmAssessment, type ReturnFarmAssessInput } from "../../src/lansmark/assess/returnFarmAssess";
import type { RouteFn } from "../context";

const MONEY_MAX = 1e12;   // 원
const MONTHS_MAX = 600;   // 생활비 버퍼 개월 상한(이상치 차단)
const EXP: ReturnFarmAssessInput["experience"][] = ["none", "education", "experienced"];

export const assessRoutes: RouteFn = async (_ctx, req, res, url) => {
  if (url.pathname !== "/api/assess") return false;
  if (req.method !== "POST") { json(res, 405, { error: "허용되지 않은 메서드" }); return true; }
  let b: unknown;
  try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
  if (!isObject(b)) { json(res, 400, { error: "본문이 필요합니다." }); return true; }
  const input: ReturnFarmAssessInput = {
    equityKrw: clampNonNeg(b.equityKrw, MONEY_MAX),
    livingBufferMonths: clampNonNeg(b.livingBufferMonths, MONTHS_MAX),
    motivation: b.motivation === "clear" || b.motivation === "vague" ? b.motivation : undefined,
    experience: EXP.includes(b.experience as ReturnFarmAssessInput["experience"]) ? (b.experience as ReturnFarmAssessInput["experience"]) : undefined,
    familyConsent: typeof b.familyConsent === "boolean" ? b.familyConsent : undefined,
    landSecured: typeof b.landSecured === "boolean" ? b.landSecured : undefined,
  };
  json(res, 200, { ok: true, assessment: buildReturnFarmAssessment(input) });
  return true;
};
