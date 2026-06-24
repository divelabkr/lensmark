/**
 * Perplexity Sonar(검색 그라운딩 LLM) — 외래·특수 작물의 '재배 요약'만 보강(HUMAN GATE: PERPLEXITY_API_KEY).
 *   ⚠ 가드레일(중요): LLM 도메인 사실 날조 금지가 LENSMARK 1원칙 → 이 통합은 아래를 강제한다.
 *     ① 외래작물(/api/foreign · incomeSimAvailable=false · 소득엔진 밖)에만 — 코어 한국작물(실 RDA/KAMIS)엔 절대 금지(라우트 isCoreCropName 코드 게이트로 강제).
 *     ② 정량 수치(수량·소득·단가) 금지 — 관수·일조·내한성·토양 등 정성 텍스트만(프롬프트=연성 + 출력 후처리 hasQuantClaim=경성, 이중 강제).
 *     ③ 출처(citations) 필수 — 응답 메타의 URL을 그대로 노출(그라운딩≠사실, 사용자가 검증). 출처 0개면 요약 폐기(검증수단 없는 텍스트 금지).
 *     ④ 하드 라벨 'AI 요약·출처 확인 필요·보장 아님'(프론트) + 캐시(비용·일관성) + 실패 시 null(무중단).
 *   비용: sonar online ≈ $0.005/콜 — 캐시로 작물당 1회. 무료티어 없음(유료 키).
 */
import { hasEnv } from "./types";
import { tryConsume } from "./callBudget"; // 일일 호출 상한(폭주 비용 차단)

export interface AiCultivation { summary: string; sources: string[]; model: string; }

export function perplexityConfigured(): boolean { return hasEnv("PERPLEXITY_API_KEY"); }

// 작물별 캐시(비용·일관성) — 메모리·상한 500(바운드). 성공은 24h, 실패(null)는 짧게(음성TTL 10분 — 일시 장애가 만 하루 고착되지 않게, P2).
const CACHE = new Map<string, { at: number; v: AiCultivation | null }>();
const TTL_MS = 24 * 3600 * 1000, NEG_TTL_MS = 10 * 60 * 1000, CAP = 500;

/** 응답 본문에서 마크다운/인용마커 정리(esc 전 가독성) — 굵게(**)·각주([1]) 제거. */
function tidy(s: string): string { return s.replace(/\*\*/g, "").replace(/\[\d+\]/g, "").replace(/\s+\n/g, "\n").trim().slice(0, 1200); }

/**
 * 정량 경성가드(설계감사 P1#3) — 프롬프트(연성)만으로는 LLM 미준수·프롬프트인젝션을 못 막으므로 출력 후처리로 이중화.
 *   금지: 수확량·소득·단가(금액·면적당수율) 수치 — 새면 요약 전체 폐기(fail-closed).
 *   허용: 온도(℃)·pH·일조시간·간격(cm/m) 등 농학 정성맥락(금액/수율 단위 아님).
 */
const QUANT_FORBIDDEN: RegExp[] = [
  /\d[\d,.]*\s*(만원|억원|천원|원)/,                                   // 금액·단가(원)
  /(수확량|수량|소득|매출|수익|조수입|단가|도매가|소매가|생산량)\D{0,6}\d/, // 경제·수율 키워드 + 인접 수치
  /(10a|평|주|그루|ha|마지기)\s*당\s*\D{0,4}\d/,                       // 면적/개체 당 수치(수율·금액)
  /\d[\d,.]*\s*(kg|톤|t)\s*(\/|당|\s*(수확|생산|내외|정도|가량))/,       // N kg/톤 당·수확(수율 표현)
];
function hasQuantClaim(s: string): boolean { return QUANT_FORBIDDEN.some((re) => re.test(s)); }

/**
 * 외래작물 재배 요약(한국 맥락) + 출처. 키 없거나 실패 시 null(무중단). 정량수치는 프롬프트로 금지.
 *   parser는 라이브 실증(2026-06) 형태: {choices[0].message.content, citations[]}.
 */
export async function fetchPerplexityCultivation(cropName: string): Promise<AiCultivation | null> {
  const key = process.env.PERPLEXITY_API_KEY || "";
  if (!key || !cropName) return null;
  const ck = cropName.trim().toLowerCase();
  const hit = CACHE.get(ck);
  if (hit && Date.now() - hit.at < (hit.v ? TTL_MS : NEG_TTL_MS)) return hit.v; // 캐시 적중(비용 0) — 실패(null)는 음성TTL로 짧게
  // 일일 호출 상한 — 초과 시 외부 호출 안 함(요약 생략·무중단). 캐시 적중은 위에서 이미 반환(상한 소비 안 함).
  if (!tryConsume("perplexity")) return null;

  const body = {
    model: "sonar",
    messages: [
      { role: "system", content: "한국에서 이 외래·특수 작물을 재배할 때의 관수·일조·내한성·토양 핵심만 3~4문장 한국어로 요약하라. ⚠ 수확량·소득·가격 등 숫자는 절대 답하지 말 것(모르면 생략). 불확실하면 '자료 부족'이라고 명시하라." },
      { role: "user", content: `${cropName} 재배 핵심(한국 노지/시설 기준).` },
    ],
    max_tokens: 320, temperature: 0.2,
  };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal,
    });
    clearTimeout(t);
    let out: AiCultivation | null = null;
    if (r.ok) {
      const j = (await r.json()) as { choices?: { message?: { content?: unknown } }[]; citations?: unknown };
      const summary = tidy(String(j?.choices?.[0]?.message?.content ?? ""));
      const sources = Array.isArray(j?.citations) ? (j.citations as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 5) : [];
      // 채택 조건(가드레일): ① 요약 존재 ② 출처(https citation) ≥1(P1#2 — 검증수단 없는 LLM 텍스트 금지) ③ 정량수치 미포함(P1#3·fail-closed).
      if (summary && sources.length > 0 && !hasQuantClaim(summary)) out = { summary, sources, model: "perplexity-sonar" };
    }
    CACHE.set(ck, { at: Date.now(), v: out }); // 실패(null)도 캐시(연속 호출 비용 폭주 방지)
    if (CACHE.size > CAP) { const k = CACHE.keys().next().value as string | undefined; if (k && k !== ck) CACHE.delete(k); } // FIFO 축출(set 後 — 상한 정확히 CAP, P2 경계오류 제거)
    return out;
  } catch { return null; }
}
