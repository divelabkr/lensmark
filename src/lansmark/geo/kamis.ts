import type { SigmaRange } from "../types";
import type { PriceResult, RetailWeekly } from "../data/providers/types";
import { getKamisCode } from "../data/providers/kamisItemCodes";
import { fetchJsonSafe } from "./fetchSafe";

/** 정렬된 배열의 백분위(선형보간) */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
/** 가격 표본 → P10/P50/P90 */
export function priceRangeFromSamples(samples: number[]): SigmaRange | null {
  const xs = samples.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!xs.length) return null;
  return { p10: Math.round(percentile(xs, 0.1)), p50: Math.round(percentile(xs, 0.5)), p90: Math.round(percentile(xs, 0.9)) };
}
/** KAMIS 일별 품목별 도·소매 URL (도매=02) */
export function kamisDailyUrl(p: { certKey: string; certId: string; category: string; item: string; kind?: string; rank?: string; start: string; end: string; cls?: "01" | "02" }): string {
  const u = new URL("https://www.kamis.or.kr/service/price/xml.do");
  u.searchParams.set("action", "periodProductList");
  u.searchParams.set("p_cert_key", p.certKey); u.searchParams.set("p_cert_id", p.certId);
  u.searchParams.set("p_returntype", "json");
  u.searchParams.set("p_startday", p.start); u.searchParams.set("p_endday", p.end);
  u.searchParams.set("p_itemcategorycode", p.category); u.searchParams.set("p_itemcode", p.item);
  if (p.kind) u.searchParams.set("p_kindcode", p.kind);
  if (p.rank) u.searchParams.set("p_productrankcode", p.rank);
  u.searchParams.set("p_productclscode", p.cls ?? "02"); // 02=도매(기본·농가 수취) · 01=소매(마트 소비자가)
  u.searchParams.set("p_convert_kg_yn", "Y");    // ★ 원/kg 환산(미설정=원/박스 → 단위오류). 실응답으로 확인: N=91,180 vs Y=9,118
  return u.toString();
}
/** KAMIS 응답 item[] → 가격 표본(원/kg). "평균"(전국평균) 행 우선, 없으면 전체. price는 "9,118" 형태 문자열. */
export function pricesFromKamisItems(items: unknown): number[] {
  const all = Array.isArray(items) ? (items as any[]) : [];
  const avg = all.filter((it) => it && it.countyname === "평균"); // 전국 평균 행
  const rows = avg.length ? avg : all;
  return rows.map((it: any) => Number(String(it.price ?? it.dpr1 ?? "").replace(/[^0-9.]/g, ""))).filter((n) => Number.isFinite(n) && n > 0);
}
/** cropId → 최근 도매가 범위(원/kg). 코드 미검증/오류면 null → 엔진은 base 단가로 폴백. */
export async function fetchWholesale(cropId: string, certKey: string, certId: string): Promise<PriceResult | null> {
  const code = getKamisCode(cropId);
  if (!code || !code.verified || !code.itemCode) return null;
  const end = new Date(), start = new Date(end.getTime() - 30 * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = kamisDailyUrl({ certKey, certId, category: code.categoryCode, item: code.itemCode, kind: code.kindCode, rank: code.rankCode, start: fmt(start), end: fmt(end) });
  const j: any = await fetchJsonSafe(url); // 타임아웃·비JSON → null
  if (!j || (j?.data?.error_code && j.data.error_code !== "000")) return null; // 실패/KAMIS 오류코드 → 폴백
  const range = priceRangeFromSamples(pricesFromKamisItems(j?.data?.item));
  // 정직성: 표시값이 '오늘 실시세'가 아니라 '최근 30일 분포'임을 asOf로 명시(조회 종료일=오늘 기준 윈도우).
  return range ? { priceKrwPerKg: range, source: "KAMIS 일별 도매(원/kg)", asOf: `~${fmt(end)}·최근 30일` } : null;
}

/** 가격 표본 → 주간 min·평균·max(원/kg). percentile이 아닌 '실최저~최고'(소비자 체감 시세는 직관적 폭이 적합). */
export function retailStatsFromSamples(samples: number[]): { min: number; avg: number; max: number; samples: number } | null {
  const xs = samples.filter((n) => Number.isFinite(n) && n > 0);
  if (!xs.length) return null;
  const sum = xs.reduce((a, b) => a + b, 0);
  return { min: Math.round(Math.min(...xs)), avg: Math.round(sum / xs.length), max: Math.round(Math.max(...xs)), samples: xs.length };
}

/** cropId → 최근 7일 마트 소매가 주간 min~평균~max(원/kg). 소매(cls=01). 코드 미검증/오류면 null → 표시 안 함. */
export async function fetchRetailWeekly(cropId: string, certKey: string, certId: string): Promise<RetailWeekly | null> {
  const code = getKamisCode(cropId);
  if (!code || !code.verified || !code.itemCode) return null;
  const end = new Date(), start = new Date(end.getTime() - 7 * 86400000); // 최근 7일(주간)
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = kamisDailyUrl({ certKey, certId, category: code.categoryCode, item: code.itemCode, kind: code.kindCode, rank: code.rankCode, start: fmt(start), end: fmt(end), cls: "01" });
  const j: any = await fetchJsonSafe(url); // 타임아웃·비JSON → null
  if (!j || (j?.data?.error_code && j.data.error_code !== "000")) return null; // 실패/KAMIS 오류코드 → 표시 안 함
  const stats = retailStatsFromSamples(pricesFromKamisItems(j?.data?.item));
  return stats ? { ...stats, source: "KAMIS 소매 주간(원/kg)", asOf: `~${fmt(end)}·최근 7일` } : null;
}
