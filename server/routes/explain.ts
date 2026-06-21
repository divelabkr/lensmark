/**
 * AI 근거설명 라우트 — POST /api/explain (key-pending seam · UI 노출은 배포·데이터 뒤).
 *   책임: 유료 정밀 결과(P10/50/90·근거·기후)를 Claude가 '쉬운 한국어로 설명만' 하도록 중계.
 *   가드(AI_SECURITY.md):
 *     ① 유료 게이트(fail-closed) — 설명 대상이 유료 산출물이라 simulate와 동일 엔티틀먼트 필요.
 *     ② sensitive 레이트리밋(middleware SENSITIVE_RE) + 캐시(explain.ts)로 LLM 비용폭증 차단(LLM04).
 *     ③ 숫자/URL 날조는 explain.ts 출력가드가 폐기(fail-closed) · 입력은 sanitizeForPrompt로 인젝션 무력화.
 *     ④ 키 없으면 explanation:null·configured:false(무중단) — 프론트는 설명 블록을 생략.
 *   주의: 설명할 '숫자'는 클라이언트가 보낸 유료결과를 그대로 서술한다(엔진이 표시 권위 — LLM은 새 숫자 못 만듦).
 *         권한 없는 익명 호출은 ①에서 차단되어 임의 LLM 호출(비용)·자기설명 악용을 막는다.
 */
import { json, badInput, readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { clampNonNeg } from "../../src/lansmark/api/security";
import { fetchExplanation, explainConfigured } from "../../src/lansmark/integrations/explain";
import { assertPaidAccess } from "../paidAccess";
import type { SimulationEntitlement } from "../../src/lansmark/policy/entitlement";
import type { RouteFn } from "../context";

const MONEY_MAX = 1e12;                 // 원 상한(이상치·변조 클램프)
const strArr = (v: unknown, cap: number, itemMax: number): string[] =>
  Array.isArray(v) ? v.filter((s) => typeof s === "string").slice(0, cap).map((s) => String(s).slice(0, itemMax)) : [];

// 사용자에게 항상 같이 노출할 하드 라벨·고지(과신 차단·LLM06 데이터 전송 고지).
const LABEL = "AI가 엔진이 계산한 숫자를 쉽게 풀어 설명한 것입니다 — 숫자·근거는 엔진 산출이며 수익 보장이 아닙니다.";
const DISCLOSURE = "쉬운 설명을 위해 작물·지역·추정 소득 범위가 외부 AI(Anthropic)에 전송됩니다. 이름·연락처 등 개인정보는 전송하지 않습니다.";

export const explainRoutes: RouteFn = async (ctx, req, res, url) => {
  if (url.pathname !== "/api/explain" || req.method !== "POST") return false;

  // ① 유료 게이트(fail-closed) — 설명 대상이 유료 산출물. 권한 없으면 LLM 호출 자체를 안 함(비용·악용 차단).
  let _ent: SimulationEntitlement | null = null;
  if (ctx.config.requireEntitlement) {
    try { _ent = await assertPaidAccess(ctx, req); }
    catch (e: any) { json(res, e?.status ?? 402, { error: "AI 설명은 유료 정밀 분석 권한이 필요합니다.", code: "ENTITLEMENT_REQUIRED" }); return true; }
  }

  // ② 입력 파싱·클램프(인젝션 무력화는 explain.ts buildExplainMessages가 담당)
  let body: any;
  try { body = JSON.parse((await readBody(req)) || "{}"); } catch (e) { badInput(res, e); return true; }
  const cropNameKo = typeof body?.cropNameKo === "string" ? body.cropNameKo.slice(0, 40) : "";
  if (!cropNameKo) { json(res, 400, { error: "cropNameKo가 필요합니다.", code: "BAD_INPUT" }); return true; }
  const inc = isObject(body?.income) ? body.income : {};
  const p10 = clampNonNeg(inc.p10, MONEY_MAX), p50 = clampNonNeg(inc.p50, MONEY_MAX), p90 = clampNonNeg(inc.p90, MONEY_MAX);
  if (p10 == null || p50 == null || p90 == null) { json(res, 400, { error: "income(p10/p50/p90)이 필요합니다.", code: "BAD_INPUT" }); return true; }

  // ③ 설명 생성(키 없으면 null·무중단). 날조 금액/URL은 explain.ts가 폐기.
  const explanation = await fetchExplanation({
    cropNameKo,
    region: typeof body?.region === "string" ? body.region.slice(0, 40) : undefined,
    income: { p10, p50, p90 },
    reasons: strArr(body?.reasons, 8, 120),
    climateFacts: strArr(body?.climateFacts, 8, 80),
    sources: strArr(body?.sources, 6, 120),
  });

  json(res, 200, { ok: true, configured: explainConfigured(), explanation, label: LABEL, disclosure: DISCLOSURE });
  return true;
};
