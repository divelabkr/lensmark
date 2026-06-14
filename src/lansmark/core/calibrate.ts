import type { OutcomeRecord } from "./feedbackStore";

export interface CalibrationResult {
  n: number;                       // 작물×지역 유효 실측 건수 (보정 강도 — 많을수록 수축↓)
  validatedBy: number;             // 서로 다른 제출자(userId) 수 — '✓검증' 배지 판정(자기검증 위조 차단 · 레드팀 H6/MOAT-1)
  bucketN: number;                 // 이 지형 버킷 실측 건수
  scope: "cold" | "region" | "terrain";
  yieldCorrection: number;
  costCorrection: number;
  priceCorrection: number;
  yieldDispersion: number | null;
  reason: string;
}
export interface Prior { ycLog?: number; ccLog?: number; pcLog?: number; }
export interface RecencyOpts { now?: number; halfLifeDays?: number; }

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const RAW = (a: number | undefined, p: number | undefined): number | null =>
  a != null && p != null && p > 0 ? clamp(a / p, 0.05, 20) : null;

interface WR { r: number; w: number; }
function weightOf(rec: OutcomeRecord, opts?: RecencyOpts): number {
  if (!opts || !opts.halfLifeDays) return 1; // recency 미사용 → 균등
  const now = opts.now ?? Date.now();
  const t = rec.createdAt ? Date.parse(rec.createdAt) : now;
  if (isNaN(t)) return 1;
  const ageDays = Math.max(0, (now - t) / 86400000);
  return Math.pow(0.5, ageDays / opts.halfLifeDays); // 반감기 감쇠
}
/** 단일 제출자가 보정 magnitude를 지배 못하게: 한 userId(없으면 anon) 레코드의 가중 합을 이 건수분으로 상한(레드팀 FLYWHEEL-POISON).
 *   distinctSubmitters가 '배지'를 보호하듯, 이 캡은 '보정값'을 보호한다(다중 distinct 제출자만 보정을 크게 움직임). */
const MAX_WEIGHT_PER_USER = 3;
/** 가중 캡 키 — 비인증 익명(무료 베타 anon-* · 레거시 null='anon')은 모두 단일 'anon-pool'로 합산한다.
 *   무헤더 다중제출이 매번 새 anon-<UUID>를 만들어 per-user 캡을 우회(보정 magnitude 오염)하던 벡터를 차단(레드팀 H1 후속·플라이휠 무결성).
 *   인증(유료) userId(order:·demo-…)는 각자 키 유지 → 서로 다른 '실제' 제출자만 보정을 크게 움직인다. */
const capKeyOf = (userId?: string): string => { const u = userId ?? "anon"; return u.startsWith("anon") ? "anon-pool" : u; };
function ratiosOf(records: OutcomeRecord[], opts?: RecencyOpts) {
  // per-user 가중 캡: 같은 캡키 레코드 수로 가중을 나눠 한 제출자(익명 전체=한 풀)의 총 영향력을 ≤ MAX_WEIGHT_PER_USER로.
  const perUser = new Map<string, number>();
  for (const rec of records) { const u = capKeyOf(rec.userId); perUser.set(u, (perUser.get(u) ?? 0) + 1); }
  const yR: WR[] = [], cR: WR[] = [], pR: WR[] = [];
  for (const rec of records) {
    const userScale = Math.min(1, MAX_WEIGHT_PER_USER / (perUser.get(capKeyOf(rec.userId)) ?? 1));
    const w = weightOf(rec, opts) * userScale;
    const y = RAW(rec.actualYieldKg, rec.predictedYieldKg); if (y != null) yR.push({ r: y, w });
    const c = RAW(rec.actualCostKrw, rec.predictedCostKrw); if (c != null) cR.push({ r: c, w });
    if (rec.actualYieldKg && rec.actualRevenueKrw != null && rec.predictedYieldKg && rec.predictedRevenueKrw != null) {
      const pr = RAW(rec.actualRevenueKrw / rec.actualYieldKg, rec.predictedRevenueKrw / rec.predictedYieldKg);
      if (pr != null) pR.push({ r: pr, w });
    }
  }
  return { yR, cR, pR };
}
/** 가중 기하평균 사후수축: exp((Σ w·logr + k·priorLog)/(Σw + k)) */
function shrunk(wr: WR[], k: number, priorLog = 0, lo = 0.6, hi = 1.6): number {
  const W = wr.reduce((s, x) => s + x.w, 0);
  if (W <= 0) return clamp(Math.exp(priorLog), lo, hi);
  const sw = wr.reduce((s, x) => s + x.w * Math.log(x.r), 0);
  return clamp(Math.exp((sw + k * priorLog) / (W + k)), lo, hi);
}
function cvOf(wr: WR[]): number | null {
  const xs = wr.map((x) => x.r), n = xs.length;
  if (n < 2) return null;
  const m = xs.reduce((s, r) => s + r, 0) / n;
  const v = xs.reduce((s, r) => s + (r - m) ** 2, 0) / (n - 1);
  return m > 0 ? r3(Math.sqrt(v) / m) : null;
}

/**
 * 서로 다른 '인증' 실측 제출자(userId) 수 — '✓검증' 배지 판정의 단일 출처(SSOT).
 *   단일 주체가 N건 자기보고해도 1로 카운트 → 다중 일지/반복 제출로 배지 위조 차단(레드팀 H6 · MOAT-1).
 *   ⚠ 비인증 제출은 검증에서 제외: 무료 베타 익명ID(anon-*)는 추측 불가지만 대량 위조가 가능하고,
 *      레거시 익명(userId 없음=null)도 신원이 없다 → 둘 다 검증 카운트에서 빼 무료 익명 제출이 배지를
 *      부풀리지 못하게 한다(하이브리드·레드팀 H1). 보정 magnitude는 별도 per-user 가중 캡으로 반영된다.
 *   actualYieldKg 있는 레코드만 집계.
 */
export function distinctSubmitters(records: OutcomeRecord[]): number {
  return new Set(
    records
      .filter((r) => r.actualYieldKg != null)
      .map((r) => r.userId)
      .filter((u): u is string => u != null && !u.startsWith("anon")),
  ).size;
}

/**
 * 유효 실측 건수 — 제출자별 상한(MAX_WEIGHT_PER_USER) 반영(레드팀 L1).
 *   단일 주체가 일지 다건(예: 무료 계정 1명 500건)으로 '실측 N건' 표시·보정 범위를 부풀리지 못하게,
 *   per-user 가중 캡과 동일 기준으로 표시·게이트용 건수를 제출자당 ≤ MAX_WEIGHT_PER_USER로 집계한다.
 *   익명(anon-*·null)은 한 풀로 합산(무헤더 다중제출 우회 차단). magnitude는 ratiosOf가 별도로 캡.
 */
export function effectiveSampleCount(records: OutcomeRecord[]): number {
  const per = new Map<string, number>();
  for (const r of records) { if (r.actualYieldKg == null) continue; const u = capKeyOf(r.userId); per.set(u, (per.get(u) ?? 0) + 1); }
  let n = 0; for (const c of per.values()) n += Math.min(c, MAX_WEIGHT_PER_USER);
  return n;
}

export function computeCalibration(records: OutcomeRecord[], k = 5, prior: Prior = {}, opts?: RecencyOpts): CalibrationResult {
  const { yR, cR, pR } = ratiosOf(records, opts);
  const n = Math.max(yR.length, cR.length, pR.length); // 보정강도·게이트 = raw 건수(기존 로직 유지 — 승격/scope 불변)
  const effN = effectiveSampleCount(records);          // 표시용 '유효' 건수(제출자 캡 — 단일 주체 다건 '실측 N건' 부풀리기 차단·L1)
  const yc = shrunk(yR, k, prior.ycLog ?? 0), cc = shrunk(cR, k, prior.ccLog ?? 0), pc = shrunk(pR, k, prior.pcLog ?? 0);
  const dy = Math.round((yc - 1) * 100);
  return {
    n, validatedBy: distinctSubmitters(records), bucketN: n, scope: n > 0 ? "region" : "cold",
    yieldCorrection: r3(yc), costCorrection: r3(cc), priceCorrection: r3(pc), yieldDispersion: cvOf(yR),
    reason: n > 0 ? `실측 ${effN}건 보정 (수율 ${dy >= 0 ? "+" : ""}${dy}%)` : "실측 데이터 없음(콜드스타트)", // 표시는 유효건수(L1)
  };
}

export function computeCalibrationFor(records: OutcomeRecord[], bucket?: string, k = 5, opts?: RecencyOpts): CalibrationResult {
  const broad = computeCalibration(records, k, {}, opts);
  if (!bucket) return broad;
  const bRecs = records.filter((r) => r.terrainBucket === bucket);
  const prior: Prior = { ycLog: Math.log(broad.yieldCorrection), ccLog: Math.log(broad.costCorrection), pcLog: Math.log(broad.priceCorrection) };
  const b = computeCalibration(bRecs, k, prior, opts);
  const dy = Math.round((b.yieldCorrection - 1) * 100);
  const effBroad = effectiveSampleCount(records), effBucket = effectiveSampleCount(bRecs); // 표시용 유효 건수(제출자 캡·L1) — 로직(n·bucketN·scope)은 raw 유지
  return {
    n: broad.n, validatedBy: broad.validatedBy, bucketN: bRecs.length, scope: bRecs.length > 0 ? "terrain" : (broad.n > 0 ? "region" : "cold"),
    yieldCorrection: b.yieldCorrection, costCorrection: b.costCorrection, priceCorrection: b.priceCorrection,
    yieldDispersion: b.yieldDispersion ?? broad.yieldDispersion,
    reason: bRecs.length > 0
      ? `실측 ${effBroad}건(이 지형 ${effBucket}건) 보정 (수율 ${dy >= 0 ? "+" : ""}${dy}%)`
      : (broad.n > 0 ? `실측 ${effBroad}건 보정 (이 지형 표본 부족 → 지역 평균)` : "실측 데이터 없음(콜드스타트)"),
  };
}
