import type { SigmaRange, SalesChannel } from "../types";
import { getCropProfile } from "./crops.seed";
import { RDA_REAL, RDA_REAL_REGION } from "./rdaIncome.real";
import { baseFromReal, REGION_CODES, type RdaRegionalRow } from "./rdaRealLoader";

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

/** 프론트가 보내는 전체 시도명(전라남도 등) → 지역표 2자 코드(전남). 이미 2자거나 미지원/미지정이면 undefined → 전국 base. */
const SIDO_SHORT: Record<string, string> = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 광주광역시: "광주",
  대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종", 경기도: "경기", 강원특별자치도: "강원",
  강원도: "강원", 충청북도: "충북", 충청남도: "충남", 전북특별자치도: "전북", 전라북도: "전북",
  전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주", 제주도: "제주",
};
function normalizeRegion(region?: string): string | undefined {
  if (!region) return undefined;
  const r = region.trim();
  if (SIDO_SHORT[r]) return SIDO_SHORT[r];   // 전체 시도명 → 2자
  if (REGION_CODES.has(r)) return r;          // 이미 2자 코드
  return undefined;                           // 미지원 → 전국 base 폴백
}

/**
 * 작물별 소득 base (10a = 1,000㎡).
 * ① 실자료 우선: RDA_REAL에 행이 있으면 농진청 실 소득자료 사용(verified=true·baseYear·출처 표기).
 *    적재 절차: 자료 CSV → `npm run rda:build <csv>` → 이 테이블 재생성(rdaIncome.real.ts).
 *    실자료는 작물 단위 전국 평균(≈성숙기·혼합판로)이라 절대수준만 RDA로 두고, '연차 정착 ramp·판로 프리미엄'의
 *    상대구조(성숙기=1·혼합=1 기준 비율)만 룰북에서 보강한다 — 다년생 과일의 정착기 손실·판로 차이를 보존하되 출처에 정직 표기.
 * ② 폴백: 룰북(crops.seed) 파생 "RDA 구조" 데모값 → verified=false(정직 라벨).
 */
export function getRdaBase(cropId: string, region?: string, opts?: RdaBaseOptions): RdaIncomeBase {
  const c = getCropProfile(cropId);
  const real = RDA_REAL[cropId];
  if (real) {
    // 지역 오버라이드: 해당 도의 실자료가 있으면 절대수준을 그 도 실값으로(없는 도·미지원 형식은 전국 base 폴백).
    const regCode = normalizeRegion(region);
    const reg: RdaRegionalRow | undefined = regCode ? RDA_REAL_REGION[cropId]?.[regCode] : undefined;
    const b = reg
      ? { cropId, cropNameKo: c.cropNameKo, yieldKgPer10a: reg.yieldKgPer10a, operatingCostPer10aKrw: reg.operatingCostPer10aKrw, refPriceKrwPerKg: reg.refPriceKrwPerKg, source: `농진청 지역별 농산물소득조사 2024(${regCode}·일부 폭 추정) 기준`, baseYear: 2024 as number | undefined, verified: true as const }
      : baseFromReal(real, c.cropNameKo); // 절대수준=전국 실 RDA(verified·연도·출처)
    const yr = c.economics.yieldKgPerM2ByYear, ch = c.economics.priceKrwPerKg;
    const yFac = (yr[opts?.targetYear ?? "mature"] ?? yr.mature).p50 / (yr.mature.p50 || 1); // 연차 상대비(성숙기=1)
    const pFac = (ch[opts?.salesChannel ?? "mixed"] ?? ch.mixed).p50 / (ch.mixed.p50 || 1);   // 판로 상대비(혼합=1)
    if (yFac === 1 && pFac === 1) return b;
    return { ...b, yieldKgPer10a: scale(b.yieldKgPer10a, yFac), refPriceKrwPerKg: scale(b.refPriceKrwPerKg, pFac), source: `${b.source} · 연차/판로 구조 룰북 보강` };
  }

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
