/**
 * 작물 시장 신호(트렌드·차별화) — Perplexity 시장조사(주기 캐시). 'crop-first 정렬 표'의 시장 데이터.
 *   표 컬럼(순서·작물·난이도·트렌드·단가·차별화) 중 'Perplexity가 답하는 정성 2축'만 담당 — 트렌드·차별화(각 1~3단계).
 *     · 난이도 = 재배 요구조건 룰(cropDifficulty, S1b) · 단가 = crops.seed 실값 → 표 조립(marketTable, S1c)에서 합침(출처 분리).
 *   ⚠ 1원칙(수치 날조 금지) 준수:
 *     ① citations(출처) 0개면 결과 폐기 ② 출처 항상 노출 ③ 하드 라벨('AI 시장조사·출처확인·보장아님')
 *     ④ 19작물(CROP_PROFILES) 화이트리스트 — 목록 밖 LLM 작물 차단
 *     ⑤ 정밀 순위(1~19) 금지 = 3단계(유지/주목/상승, 낮음/중간/높음)만 — LLM이 정밀 순위를 지어내는 환각 차단. 정성 단계는 안전.
 *   주기 캐시(TTL 30일·매 요청 호출 금지) + callBudget("perplexity") 상한.
 *   ⛔ PERPLEXITY_API_KEY = HUMAN GATE. 키 없으면 null(무중단 — UI는 기존 '땅 먼저' 흐름으로 폴백).
 */
import { CROP_PROFILES } from "../data/crops.seed";
import { tryConsume } from "../integrations/callBudget";

export type Level = 1 | 2 | 3; // 트렌드: 1유지/2주목/3상승 · 차별화: 1낮음/2중간/3높음
export const TREND_KO: Record<Level, string> = { 1: "유지", 2: "주목", 3: "상승" };
export const NICHE_KO: Record<Level, string> = { 1: "낮음", 2: "중간", 3: "높음" };

export interface CropMarketSignal {
  cropId: string;
  cropNameKo: string;
  trend: Level;   // 시장 트렌드(Perplexity·정성)
  niche: Level;   // 차별화/틈새(Perplexity·정성)
  why: string;    // 한 줄 시장 맥락(수치 아님)
}
export interface MarketSignals {
  asOf: string;
  items: CropMarketSignal[];
  sources: string[];  // citations — 필수(0이면 결과 폐기)
  label: string;
  disclaimer: string;
}

const LABEL = "AI 시장조사 결과 · 출처를 확인하세요 · 수익 보장 아님";
const DISCLAIMER =
  "트렌드·차별화 단계는 검색형 AI(Perplexity)가 공개 자료를 요약한 정성 평가입니다(정밀 순위 아님). 각 출처를 직접 확인하세요. " +
  "난이도는 재배 요구조건 기반 산출, 단가는 농진청 base 실값입니다. 시장은 수시로 변하고 재배·판매 성공을 보장하지 않습니다.";

/** 작물명(국문/영문/id) → 우리 cropId 매핑. LLM 자유 텍스트를 화이트리스트로 강제(목록 밖=폐기). */
function resolveCropId(name: string): { cropId: string; cropNameKo: string } | null {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  for (const c of CROP_PROFILES) {
    if (c.cropNameKo.toLowerCase() === n || c.cropNameEn.toLowerCase() === n || c.cropId.toLowerCase() === n) {
      return { cropId: c.cropId, cropNameKo: c.cropNameKo };
    }
  }
  for (const c of CROP_PROFILES) {
    const ko = c.cropNameKo.toLowerCase();
    if (n.includes(ko) || ko.includes(n)) return { cropId: c.cropId, cropNameKo: c.cropNameKo };
  }
  return null;
}

/** 1~3 정수만 Level로 통과(그 외=null → 항목 폐기). LLM이 0·4·소수·문자를 줄 때 방어. */
function asLevel(v: unknown): Level | null {
  const n = Math.round(Number(v));
  return n === 1 || n === 2 || n === 3 ? (n as Level) : null;
}

// 주기 캐시 — 사용자 설계(매번 조사 말고 1회 조사·저장·반영). TTL 경과 시 재조사.
let CACHE: { at: number; v: MarketSignals } | null = null;
const TTL_MS = 30 * 24 * 3600 * 1000; // 30일

/** 시장 신호(트렌드·차별화) 조사. 키 없거나 출처 0개면 null(무중단). now 주입(결정적 테스트). */
export async function fetchMarketSignals(now: number = Date.now()): Promise<MarketSignals | null> {
  const key = process.env.PERPLEXITY_API_KEY || "";
  if (!key) return null;                                          // HUMAN GATE
  if (CACHE && now - CACHE.at < TTL_MS) return CACHE.v;            // 주기 캐시
  if (!tryConsume("perplexity")) return CACHE?.v ?? null;         // 호출 상한

  const catalog = CROP_PROFILES.map((c) => c.cropNameKo).join(", ");
  const system =
    "너는 한국 농작물 시장 분석가다. 아래 '작물 목록' 안의 작물만 사용하라(목록 밖 작물 절대 금지). " +
    "각 작물에 대해 2024~2025년 한국 시장 기준으로 두 가지를 1~3 단계로 평가하라: " +
    "trend(시장 추세: 1=유지, 2=주목, 3=상승), niche(차별화·틈새·고부가: 1=낮음, 2=중간, 3=높음). " +
    "각 작물에 한 줄(40자 내) 한국어 이유를 달아라. 불확실하면 그 작물은 제외하라. " +
    "정밀 순위·구체 수치(가격·퍼센트)를 지어내지 말고 1~3 단계와 정성 이유만. 반드시 아래 JSON 배열로만 답하라(설명 문장 금지): " +
    '[{"crop":"작물명","trend":1,"niche":1,"why":"이유"}]';
  const user = `작물 목록: ${catalog}\n위 작물들의 trend·niche 단계를 평가해줘.`;

  let raw = "", sources: string[] = [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 1200, temperature: 0.2 }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return CACHE?.v ?? null;
    const j = (await r.json()) as { choices?: { message?: { content?: unknown } }[]; citations?: unknown };
    raw = String(j?.choices?.[0]?.message?.content ?? "");
    sources = Array.isArray(j?.citations)
      ? (j.citations as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 8)
      : [];
  } catch { return CACHE?.v ?? null; }

  if (sources.length === 0) return CACHE?.v ?? null;             // 출처 0개 = 검증 불가 → 폐기(1원칙)
  const items = parseSignals(raw);
  if (items.length === 0) return CACHE?.v ?? null;

  const out: MarketSignals = { asOf: new Date(now).toISOString().slice(0, 10), items, sources, label: LABEL, disclaimer: DISCLAIMER };
  CACHE = { at: now, v: out };
  return out;
}

/** LLM 응답 텍스트 → 검증된 CropMarketSignal[]. 화이트리스트·Level(1~3) 검증·중복 제거. 파싱 불가=빈 배열. */
export function parseSignals(raw: string): CropMarketSignal[] {
  let arr: unknown;
  try {
    const m = raw.match(/\[[\s\S]*\]/);                          // 첫 JSON 배열 블록(코드펜스·잡텍스트 제거)
    arr = m ? JSON.parse(m[0]) : JSON.parse(raw);
  } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: CropMarketSignal[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const resolved = resolveCropId(String(o.crop ?? ""));        // 화이트리스트(목록 밖=폐기)
    const trend = asLevel(o.trend);
    const niche = asLevel(o.niche);
    if (!resolved || trend === null || niche === null || seen.has(resolved.cropId)) continue;
    seen.add(resolved.cropId);
    out.push({ cropId: resolved.cropId, cropNameKo: resolved.cropNameKo, trend, niche, why: String(o.why ?? "").slice(0, 60) });
  }
  return out;
}

/** 테스트 전용 — 캐시 초기화. */
export function __resetMarketCache(): void { CACHE = null; }
