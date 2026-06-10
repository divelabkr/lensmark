import type { SigmaRange, SalesChannel } from "../types";
import { getCropProfile } from "./crops.seed";
import { RDA_REAL } from "./rdaIncome.real";
import { baseFromReal } from "./rdaRealLoader";

export interface RdaBaseOptions {
  salesChannel?: SalesChannel;
  targetYear?: "year1" | "year2" | "year3" | "mature";
}

export interface RdaIncomeBase {
  cropId: string;
  cropNameKo: string;
  yieldKgPer10a: SigmaRange;          // 10a(1,000㎡)당 수량
  operatingCostPer10aKrw: SigmaRange; // 10a당 경영비
  refPriceKrwPerKg: SigmaRange;       // 기준 단가(KAMIS 없을 때 폴백)
  source: string;
  baseYear?: number;                  // 기준 자료 연도(가드레일 '출처·연도'). 데모는 미정(undefined).
  verified: boolean;                  // 실 RDA 소득자료로 교체되면 true
}

const scale = (r: SigmaRange, f: number): SigmaRange => ({
  p10: Math.round(r.p10 * f), p50: Math.round(r.p50 * f), p90: Math.round(r.p90 * f),
});

/**
 * 작물별 소득 base (10a = 1,000㎡).
 * ① 실자료 우선: RDA_REAL에 행이 있으면 농진청 실 소득자료 사용(verified=true·baseYear·출처 표기).
 *    적재 절차: 자료 CSV → `npm run rda:build <csv>` → 이 테이블 재생성(rdaIncome.real.ts).
 *    ⚠ v1 실자료는 작물 단위 전국 평균 — 판로·연차 분화는 자료 범위 확보 후(그 전까지 옵션은 실값 기준 미분화).
 * ② 폴백: 룰북(crops.seed) 파생 "RDA 구조" 데모값 → verified=false(정직 라벨).
 */
export function getRdaBase(cropId: string, _region?: string, opts?: RdaBaseOptions): RdaIncomeBase {
  const c = getCropProfile(cropId);
  const real = RDA_REAL[cropId];
  if (real) return baseFromReal(real, c.cropNameKo); // 실자료 우선 — 시뮬 카드에 실연도·출처가 뜬다

  const yieldByYear = c.economics.yieldKgPerM2ByYear;
  const yieldM2 = yieldByYear[opts?.targetYear ?? "mature"] ?? yieldByYear.mature; // 연차별 수량(없으면 성숙기)
  const price = c.economics.priceKrwPerKg[opts?.salesChannel ?? "mixed"] ?? c.economics.priceKrwPerKg.mixed; // 판로별 단가(없으면 혼합)
  return {
    cropId,
    cropNameKo: c.cropNameKo,
    yieldKgPer10a: scale(yieldM2, 1000),
    operatingCostPer10aKrw: scale(c.economics.costKrwPerM2, 1000),
    refPriceKrwPerKg: price,
    // 데모값은 룰북 파생(실 RDA 미연결) → 연도 미정(undefined). 실데이터 로더가 baseYear(예: 2023)를 필수 주입.
    source: "RDA 구조(데모·미검증) — 농진청 소득조사 실자료로 교체 예정",
    baseYear: undefined,
    verified: false,
  };
}
