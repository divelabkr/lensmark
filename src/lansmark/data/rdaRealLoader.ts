/**
 * RDA 실 소득자료 로더(사전 구축) — 농진청 농산물소득조사 자료를 받는 날, CSV 한 장 → 명령 한 줄로 실데이터 전환.
 *   흐름: 정규화 CSV(scripts/rdaReal.example.csv 양식) → parseRdaCsv(검증·폭 유도) → scripts/buildRdaReal.ts가
 *        rdaIncome.real.ts를 재생성 → getRdaBase가 실값 사용(verified=true·baseYear·출처 표기).
 *   정직성: P10/P90이 자료에 없으면 보수적 폭을 유도하되 출처에 "(폭 추정)"을 명시 — 실값과 추정을 섞은 척하지 않는다.
 *   단위: 수량 kg/10a · 경영비 원/10a · 단가 원/kg (10a = 1,000㎡ — RDA 소득조사 표준 단위).
 */
import type { SigmaRange } from "../types";
import { CROP_PROFILES } from "./crops.seed";

/** 실자료 1행(작물 단위·전국). 지역·판로 분화는 자료 확보 범위에 따라 후속. */
export interface RdaRealRow {
  cropId: string;
  baseYear: number;                    // 자료 기준연도(가드레일 '출처·연도' 필수)
  yieldKgPer10a: SigmaRange;
  operatingCostPer10aKrw: SigmaRange;
  refPriceKrwPerKg: SigmaRange;
  source: string;                      // 예: "농진청 농산물소득조사 2024" (+폭 추정 여부 자동 병기)
}

/** 알려진 cropId 집합 — 룰북에 없는 작물 행은 거부(오타·미지원 차단). */
const KNOWN = new Set(CROP_PROFILES.map((c) => c.cropId));

const num = (s: string | undefined): number | undefined => {
  if (s == null) return undefined;
  const t = s.replace(/[",\s]/g, ""); // 천단위 콤마·공백 허용
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN; // NaN=형식 오류(거부), undefined=빈칸(폭 유도)
};

/**
 * P10/P90 누락 시 보수적 폭 유도 — 비용은 ±20%(변동 작음), 수량·단가는 −25%/+30%(농업 변동 큼).
 *   유도 사용 여부를 반환해 출처에 "(폭 추정)"을 병기한다(정직성).
 */
function rangeOf(p50: number, p10: number | undefined, p90: number | undefined, kind: "yield" | "cost" | "price"): { r: SigmaRange; derived: boolean } {
  const lo = kind === "cost" ? 0.8 : 0.75, hi = kind === "cost" ? 1.2 : 1.3;
  const derived = p10 == null || p90 == null;
  const r: SigmaRange = {
    p10: Math.round(p10 ?? p50 * lo),
    p50: Math.round(p50),
    p90: Math.round(p90 ?? p50 * hi),
  };
  if (!(r.p10 <= r.p50 && r.p50 <= r.p90)) throw new Error(`p10≤p50≤p90 위반(${kind}): ${r.p10}/${r.p50}/${r.p90}`);
  return { r, derived };
}

/** CSV(헤더 필수) → 검증된 행들. 오류는 줄번호와 함께 throw(자료 정합을 빌드 시점에 강제). */
export function parseRdaCsv(text: string): RdaRealRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) throw new Error("CSV에 헤더+데이터 행이 필요합니다.");
  const head = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => head.indexOf(name);
  for (const req of ["cropId", "baseYear", "yield_p50", "cost_p50", "price_p50", "source"]) {
    if (idx(req) < 0) throw new Error(`필수 컬럼 누락: ${req} (양식: scripts/rdaReal.example.csv)`);
  }
  const out: RdaRealRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    // 인용 셀(RFC4180) 미지원 — 셀 내 콤마/따옴표는 split을 깨 '조용한 시프트 오염'을 부른다(감사 M5).
    //   따옴표가 보이거나 컬럼 수가 헤더와 다르면 즉시 throw(잘못된 '실자료'가 verified 라벨로 생성되는 것 차단).
    if (lines[i].includes('"')) throw new Error(`행 ${i + 1}: 인용(") 셀 미지원 — 천단위 콤마는 따옴표 없이(예: 2800000) 입력하세요.`);
    const c = lines[i].split(",").map((s) => s.trim());
    const at = `행 ${i + 1}`;
    if (c.length !== head.length) throw new Error(`${at}: 컬럼 수(${c.length}) ≠ 헤더(${head.length}) — 셀 내 콤마/누락 의심(시프트 오염 차단)`);
    const cropId = c[idx("cropId")];
    if (!KNOWN.has(cropId)) throw new Error(`${at}: 알 수 없는 cropId "${cropId}" — 룰북(crops.seed) 등록 작물만 허용`);
    if (seen.has(cropId)) throw new Error(`${at}: cropId 중복 "${cropId}"`);
    seen.add(cropId);
    const baseYear = num(c[idx("baseYear")]);
    if (!baseYear || baseYear < 2015 || baseYear > 2035) throw new Error(`${at}: baseYear 비정상(${c[idx("baseYear")]})`);
    const g = (name: string) => { const v = num(c[idx(name)]); if (Number.isNaN(v)) throw new Error(`${at}: ${name} 숫자 아님`); return v; };
    const y50 = g("yield_p50"), c50 = g("cost_p50"), p50 = g("price_p50");
    if (!y50 || !c50 || !p50) throw new Error(`${at}: p50(수량·경영비·단가)은 0보다 커야 합니다`);
    const y = rangeOf(y50, g("yield_p10"), g("yield_p90"), "yield");
    const co = rangeOf(c50, g("cost_p10"), g("cost_p90"), "cost");
    const pr = rangeOf(p50, g("price_p10"), g("price_p90"), "price");
    const src = c[idx("source")] || "농진청 농산물소득조사";
    const derived = y.derived || co.derived || pr.derived;
    out.push({
      cropId, baseYear,
      yieldKgPer10a: y.r, operatingCostPer10aKrw: co.r, refPriceKrwPerKg: pr.r,
      source: derived ? `${src} (일부 폭 추정)` : src, // 실값/추정 구분 정직 표기
    });
  }
  return out;
}

/** 지역(도) 단위 실자료 — 전국 base를 해당 도 실값으로 오버라이드(있는 도만 · 없으면 전국 폴백). */
export interface RdaRegionalRow {
  yieldKgPer10a: SigmaRange;
  operatingCostPer10aKrw: SigmaRange;
  refPriceKrwPerKg: SigmaRange;
}
/** cropId → 지역(2자 코드: 전남·경기 등) → 지역 실자료. */
export type RdaRegionalTable = Record<string, Record<string, RdaRegionalRow>>;

/** 17 시도 2자 코드(지역 CSV 검증·정규화 기준). */
export const REGION_CODES = new Set(["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]);

/**
 * 지역 CSV(헤더: cropId,region,yield_p50,cost_p50,price_p50) → 검증된 지역 테이블. region은 2자 코드.
 *   폭(p10/p90)은 전국과 동일 규칙으로 보수적 유도(지역 자료도 단일 평균 → '폭 추정' 성격 동일).
 */
export function parseRdaRegionalCsv(text: string): RdaRegionalTable {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) return {};
  const head = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => head.indexOf(name);
  for (const req of ["cropId", "region", "yield_p50", "cost_p50", "price_p50"]) {
    if (idx(req) < 0) throw new Error(`지역 CSV 필수 컬럼 누락: ${req}`);
  }
  const out: RdaRegionalTable = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].includes('"')) throw new Error(`지역 행 ${i + 1}: 인용(") 셀 미지원(시프트 오염 차단)`);
    const c = lines[i].split(",").map((s) => s.trim());
    if (c.length !== head.length) throw new Error(`지역 행 ${i + 1}: 컬럼 수(${c.length})≠헤더(${head.length})`);
    const cropId = c[idx("cropId")], region = c[idx("region")];
    if (!KNOWN.has(cropId)) throw new Error(`지역 행 ${i + 1}: 알 수 없는 cropId "${cropId}"`);
    if (!REGION_CODES.has(region)) throw new Error(`지역 행 ${i + 1}: 알 수 없는 지역 "${region}"(2자 코드만)`);
    const g = (name: string) => { const v = num(c[idx(name)]); if (v == null || Number.isNaN(v) || v <= 0) throw new Error(`지역 행 ${i + 1}: ${name} 양수 아님`); return v; };
    (out[cropId] ??= {})[region] = {
      yieldKgPer10a: rangeOf(g("yield_p50"), undefined, undefined, "yield").r,
      operatingCostPer10aKrw: rangeOf(g("cost_p50"), undefined, undefined, "cost").r,
      refPriceKrwPerKg: rangeOf(g("price_p50"), undefined, undefined, "price").r,
    };
  }
  return out;
}

/** 실자료 행 → getRdaBase 반환형 보강용(검증 출처·연도 포함). rdaIncome.ts가 사용. */
export function baseFromReal(row: RdaRealRow, cropNameKo: string) {
  return {
    cropId: row.cropId,
    cropNameKo,
    yieldKgPer10a: row.yieldKgPer10a,
    operatingCostPer10aKrw: row.operatingCostPer10aKrw,
    refPriceKrwPerKg: row.refPriceKrwPerKg,
    source: `${row.source} ${row.baseYear}년 기준`,
    baseYear: row.baseYear,
    verified: true as const,
  };
}
