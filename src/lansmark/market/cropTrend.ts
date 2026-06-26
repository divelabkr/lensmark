/**
 * 작물 시장 트렌드·3섹터 — Perplexity 시장조사(주기 캐시). 'crop-first' 진입의 데이터 기반.
 *   흐름: 처음 온 사용자가 "뭘 키울지" → ① 많이 ② 비싸게 ③ 특수하게 팔리는 작물 3섹터 제시 → 작물 선택 → 적합지(녹/적) → 시뮬.
 *   ⚠ 1원칙(수치 날조 금지) 준수 — Perplexity는 '분류·맥락'만, '숫자'는 우리 데이터(crops.seed):
 *     ① citations(출처) 0개면 결과 전체 폐기(검증 불가 텍스트 금지) ② 출처를 항상 사용자에 노출 ③ 하드 라벨('AI 시장조사·출처확인·보장아님')
 *     ④ 작물은 우리 19작물(CROP_PROFILES) 화이트리스트 안에서만 — LLM이 작물명을 지어내거나 시뮬 불가 작물을 내는 것 차단
 *     ⑤ 가격·수익 '수치'는 이 모듈이 만들지 않는다 — 섹터 분류(volume/premium/niche)만. 실제 가격은 crops.seed 실값을 UI에서 노출(LLM 수치 환각 원천 차단).
 *   주기 캐시: 매 요청 LLM 호출 금지(비용·일관성) — 1회 조사 후 메모리 캐시(TTL 30일·트렌드는 월 단위로 충분). callBudget("perplexity")로 호출 상한.
 *   ⛔ PERPLEXITY_API_KEY = HUMAN GATE. 키 없으면 null(무중단 — UI는 기존 '땅 먼저' 흐름으로 폴백).
 */
import { CROP_PROFILES } from "../data/crops.seed";
import { tryConsume } from "../integrations/callBudget";

export type MarketSector = "volume" | "premium" | "niche";
export const SECTOR_KO: Record<MarketSector, string> = {
  volume: "많이 팔리는", premium: "비싸게 팔리는", niche: "특수하게 팔리는",
};
const SECTORS: MarketSector[] = ["volume", "premium", "niche"];

export interface CropTrendItem {
  cropId: string;       // 우리 19작물 — 시뮬 연결 보장
  cropNameKo: string;
  sector: MarketSector;
  why: string;          // 한 줄 시장 맥락(정성 — 수치 아님)
}
export interface MarketTrends {
  asOf: string;         // 조사 시점(YYYY-MM-DD)
  items: CropTrendItem[];
  sources: string[];    // citations — 필수(0이면 결과 폐기)
  label: string;        // 하드 라벨(사용자 노출)
  disclaimer: string;
}

const LABEL = "AI 시장조사 결과 · 출처를 확인하세요 · 수익 보장 아님";
const DISCLAIMER =
  "아래 분류·설명은 검색형 AI(Perplexity)가 공개 자료를 요약한 것입니다. 각 항목의 출처를 직접 확인하세요. " +
  "가격 숫자는 우리 작물 데이터(농진청 base) 기준이며, 시장 상황은 수시로 변하고 재배·판매 성공을 보장하지 않습니다.";

/** 작물명(국문/영문/id) → 우리 cropId 매핑. LLM이 자유 텍스트로 주므로 화이트리스트로 강제(목록 밖=폐기). */
function resolveCropId(name: string): { cropId: string; cropNameKo: string } | null {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  for (const c of CROP_PROFILES) {                              // 정확 일치 우선
    if (c.cropNameKo.toLowerCase() === n || c.cropNameEn.toLowerCase() === n || c.cropId.toLowerCase() === n) {
      return { cropId: c.cropId, cropNameKo: c.cropNameKo };
    }
  }
  for (const c of CROP_PROFILES) {                              // 부분 일치('콩(대두)' 같은 변형 표기 흡수)
    const ko = c.cropNameKo.toLowerCase();
    if (n.includes(ko) || ko.includes(n)) return { cropId: c.cropId, cropNameKo: c.cropNameKo };
  }
  return null;
}

// 주기 캐시 — 사용자 설계(매번 조사 말고 1회 조사·저장·그때그때 반영). TTL 경과 시 재조사.
let CACHE: { at: number; v: MarketTrends } | null = null;
const TTL_MS = 30 * 24 * 3600 * 1000; // 30일

/** 시장 트렌드 3섹터 조사. 키 없거나 출처 0개면 null(무중단). now 주입(결정적 테스트). */
export async function fetchMarketTrends(now: number = Date.now()): Promise<MarketTrends | null> {
  const key = process.env.PERPLEXITY_API_KEY || "";
  if (!key) return null;                                         // HUMAN GATE — 키 없으면 휴면
  if (CACHE && now - CACHE.at < TTL_MS) return CACHE.v;           // 주기 캐시(비용·일관성)
  if (!tryConsume("perplexity")) return CACHE?.v ?? null;        // 호출 상한 초과 → 기존 캐시 or null

  // 우리 19작물을 화이트리스트로 제공(목록 밖 작물 금지). 숫자 금지·정성 분류만 요청.
  const catalog = CROP_PROFILES.map((c) => c.cropNameKo).join(", ");
  const system =
    "너는 한국 농작물 시장 분석가다. 아래 '작물 목록' 안의 작물만 사용하라(목록 밖 작물 절대 금지). " +
    "각 작물을 2024~2025년 한국 시장 기준으로 ① volume(수요·생산량이 커 대량 판매) ② premium(단가가 높아 비싸게 판매) ③ niche(특수·틈새로 차별 판매) 중 하나로 분류하라. " +
    "각 작물에 한 줄(40자 내) 한국어 이유를 달아라. 불확실하거나 근거 없으면 그 작물은 제외하라. " +
    "수치(가격·수량·퍼센트)를 지어내지 말고 정성적으로만 설명하라. 반드시 아래 JSON 배열로만 답하라(설명 문장 금지): " +
    '[{"crop":"작물명","sector":"volume|premium|niche","why":"이유"}]';
  const user = `작물 목록: ${catalog}\n2024~2025 한국 시장 기준으로 위 작물을 3섹터로 분류해줘.`;

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
    // citations는 응답 레벨 출처(URL). 사용자가 직접 검증하도록 노출.
    sources = Array.isArray(j?.citations)
      ? (j.citations as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 8)
      : [];
  } catch { return CACHE?.v ?? null; }

  if (sources.length === 0) return CACHE?.v ?? null;             // 출처 0개 = 검증 불가 → 폐기(1원칙)
  const items = parseItems(raw);
  if (items.length === 0) return CACHE?.v ?? null;               // 파싱 실패·전부 목록 밖 → 폐기

  const out: MarketTrends = { asOf: new Date(now).toISOString().slice(0, 10), items, sources, label: LABEL, disclaimer: DISCLAIMER };
  CACHE = { at: now, v: out };
  return out;
}

/** LLM 응답 텍스트 → 검증된 CropTrendItem[]. 화이트리스트(우리 작물)·섹터 검증·중복 제거. 파싱 불가=빈 배열. */
export function parseItems(raw: string): CropTrendItem[] {
  let arr: unknown;
  try {
    const m = raw.match(/\[[\s\S]*\]/);                          // 첫 JSON 배열 블록(코드펜스·잡텍스트 제거)
    arr = m ? JSON.parse(m[0]) : JSON.parse(raw);
  } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: CropTrendItem[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const resolved = resolveCropId(String(o.crop ?? ""));        // 화이트리스트 강제(목록 밖=폐기)
    const sector = String(o.sector ?? "") as MarketSector;
    if (!resolved || !SECTORS.includes(sector) || seen.has(resolved.cropId)) continue;
    seen.add(resolved.cropId);
    out.push({ cropId: resolved.cropId, cropNameKo: resolved.cropNameKo, sector, why: String(o.why ?? "").slice(0, 60) });
  }
  return out;
}

/** 테스트 전용 — 캐시 초기화. */
export function __resetMarketCache(): void { CACHE = null; }
