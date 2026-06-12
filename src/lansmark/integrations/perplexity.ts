/**
 * Perplexity Sonar(검색 그라운딩 LLM) — 외래·특수 작물의 '재배 요약'만 보강(HUMAN GATE: PERPLEXITY_API_KEY).
 *   ⚠ 가드레일(중요): LLM 도메인 사실 날조 금지가 LENSMARK 1원칙 → 이 통합은 아래를 강제한다.
 *     ① 외래작물(/api/foreign · incomeSimAvailable=false · 소득엔진 밖)에만 — 코어 한국작물(실 RDA/KAMIS)엔 절대 금지.
 *     ② 정량 수치(수량·소득·단가) 금지 — 관수·일조·내한성·토양 등 정성 텍스트만(프롬프트로 강제).
 *     ③ 출처(citations) 항상 동반 — 응답 메타의 URL을 그대로 노출(그라운딩≠사실, 사용자가 검증).
 *     ④ 하드 라벨 'AI 요약·출처 확인 필요·보장 아님'(프론트) + 캐시(비용·일관성) + 실패 시 null(무중단).
 *   비용: sonar online ≈ $0.005/콜 — 캐시로 작물당 1회. 무료티어 없음(유료 키).
 */
import { hasEnv } from "./types";

export interface AiCultivation { summary: string; sources: string[]; model: string; }

export function perplexityConfigured(): boolean { return hasEnv("PERPLEXITY_API_KEY"); }

// 작물별 캐시(비용·일관성) — 메모리·TTL 24h·상한 500(바운드).
const CACHE = new Map<string, { at: number; v: AiCultivation | null }>();
const TTL_MS = 24 * 3600 * 1000, CAP = 500;

/** 응답 본문에서 마크다운/인용마커 정리(esc 전 가독성) — 굵게(**)·각주([1]) 제거. */
function tidy(s: string): string { return s.replace(/\*\*/g, "").replace(/\[\d+\]/g, "").replace(/\s+\n/g, "\n").trim().slice(0, 1200); }

/**
 * 외래작물 재배 요약(한국 맥락) + 출처. 키 없거나 실패 시 null(무중단). 정량수치는 프롬프트로 금지.
 *   parser는 라이브 실증(2026-06) 형태: {choices[0].message.content, citations[]}.
 */
export async function fetchPerplexityCultivation(cropName: string): Promise<AiCultivation | null> {
  const key = process.env.PERPLEXITY_API_KEY || "";
  if (!key || !cropName) return null;
  const ck = cropName.trim().toLowerCase();
  const hit = CACHE.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v; // 캐시 적중(비용 0)

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
      if (summary) out = { summary, sources, model: "perplexity-sonar" };
    }
    if (CACHE.size > CAP) { const k = CACHE.keys().next().value as string | undefined; if (k) CACHE.delete(k); } // FIFO 축출
    CACHE.set(ck, { at: Date.now(), v: out }); // 실패(null)도 캐시(연속 호출 비용 폭주 방지)
    return out;
  } catch { return null; }
}
