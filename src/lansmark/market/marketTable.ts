/**
 * crop-first 정렬 표 조립 — 19작물 × {난이도·트렌드·단가·차별화}. 컬럼별로 다른 출처를 한 행으로 합친다.
 *   · 난이도 = cropDifficulty(요구조건 룰·LLM 아님) · 단가 = crops.seed 실값(농진청 base) · 트렌드/차별화 = cropTrend(Perplexity signals).
 *   Perplexity 신호(signals)가 없으면(키없음·출처0·실패) 표 없음(null) → UI는 기존 '땅 먼저' 흐름으로 폴백(무중단).
 *   정직성: 각 칸의 출처가 row 단위로 분리(난이도=룰·단가=base·트렌드/차별화=AI). 라벨·면책·citations는 signals에서 통과.
 */
import { getCropProfile } from "../data/crops.seed";
import { fetchMarketSignals, type Level } from "./cropTrend";
import { cropDifficulty, type DifficultyLevel } from "./cropDifficulty";

export interface CropTableRow {
  cropId: string;
  cropNameKo: string;
  difficulty: DifficultyLevel;  // 룰(요구조건)
  trend: Level;                 // Perplexity
  priceP50: number;             // crops.seed 혼합판로 P50(원/kg)
  niche: Level;                 // Perplexity(차별화)
  why: string;                  // Perplexity 한 줄 맥락
}
export interface CropTable {
  asOf: string;
  rows: CropTableRow[];
  sources: string[];   // citations(검증용)
  label: string;
  disclaimer: string;
}

/** crops.seed 혼합판로 P50 단가(원/kg). 없으면 0(UI에서 '—' 처리). */
function priceP50(cropId: string): number {
  const e = getCropProfile(cropId).economics?.priceKrwPerKg?.mixed;
  return e && Number.isFinite(e.p50) ? Math.round(e.p50) : 0;
}

/** 정렬 표 조립. Perplexity 신호 없으면 null(무중단·폴백). now 주입(결정적 테스트). */
export async function buildCropTable(now: number = Date.now()): Promise<CropTable | null> {
  const sig = await fetchMarketSignals(now);
  if (!sig) return null;
  const rows: CropTableRow[] = sig.items.map((it) => ({
    cropId: it.cropId,
    cropNameKo: it.cropNameKo,
    difficulty: cropDifficulty(it.cropId),  // 룰
    trend: it.trend,                        // AI
    priceP50: priceP50(it.cropId),          // base 실값
    niche: it.niche,                        // AI
    why: it.why,
  }));
  return { asOf: sig.asOf, rows, sources: sig.sources, label: sig.label, disclaimer: sig.disclaimer };
}
