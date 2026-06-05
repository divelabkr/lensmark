import type { OutcomeRecord } from "./feedbackStore";
import { computeCalibrationFor, type CalibrationResult, type RecencyOpts } from "./calibrate";

const REGION = "*";
const keyOf = (c: string, r: string, b: string) => `${c}|${r}|${b}`;
const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const yieldRatio = (r: OutcomeRecord): number | null =>
  r.actualYieldKg != null && r.predictedYieldKg > 0 ? r.actualYieldKg / r.predictedYieldKg : null;

export interface SnapshotEntry extends CalibrationResult { cropId: string; region: string; bucket: string; }
export interface ConsolidationReport {
  totalRecords: number;
  usedRecords: number;
  quarantined: { cropId: string; region: string; ratio: number; reason: string }[];
  groups: number;
  bucketsPromoted: string[];
  notes: string[];
}
export interface CalibrationSnapshot {
  generatedAt: string;
  entries: Record<string, SnapshotEntry>; // key `${cropId}|${region}|${bucket}` (bucket "*"=지역레벨)
  report: ConsolidationReport;
}
export interface ConsolidateOpts { now?: number; halfLifeDays?: number; promoteThreshold?: number; outlierMadK?: number; k?: number; }

/**
 * LANSMARK "Dream": 실측 데이터 정리(consolidation).
 * - recency 가중(낡은 시즌 ↓) · 이상치 격리(robust) · 버킷 승격 · 스냅샷/리포트 생성.
 * ★ 운영: 스케줄러(야간/주간)로 호출해 스냅샷 저장. getCalibration은 스냅샷을 읽음.
 */
export function consolidate(records: OutcomeRecord[], opts: ConsolidateOpts = {}): CalibrationSnapshot {
  const now = opts.now ?? Date.now();
  const halfLifeDays = opts.halfLifeDays ?? 540;
  const promote = opts.promoteThreshold ?? 5;
  const madK = opts.outlierMadK ?? 3.5;
  const k = opts.k ?? 5;
  const rec: RecencyOpts = { now, halfLifeDays };

  const groups = new Map<string, OutcomeRecord[]>();
  for (const r of records) {
    const g = `${r.cropId}|${r.region ?? ""}`;
    let arr = groups.get(g); if (!arr) { arr = []; groups.set(g, arr); }
    arr.push(r);
  }

  const entries: Record<string, SnapshotEntry> = {};
  const quarantined: ConsolidationReport["quarantined"] = [];
  const bucketsPromoted: string[] = [];
  let usedRecords = 0;

  for (const [g, recs] of groups) {
    const [cropId, region] = g.split("|");
    // 이상치 격리(수율비, robust median±MAD; 표본 4건 이상일 때만)
    let used = recs;
    const ratios = recs.map(yieldRatio).filter((x): x is number => x != null);
    if (ratios.length >= 4) {
      const med = median(ratios);
      const mad = median(ratios.map((x) => Math.abs(x - med))) || 1e-9;
      used = recs.filter((r) => {
        const yr = yieldRatio(r);
        if (yr == null) return true;
        const out = Math.abs(yr - med) > madK * mad && (yr < 0.5 || yr > 2);
        if (out) quarantined.push({ cropId, region, ratio: +yr.toFixed(2), reason: `수율비 ${yr.toFixed(2)} 이상치(중앙값 ${med.toFixed(2)})` });
        return !out;
      });
    }
    usedRecords += used.length;

    // 지역레벨 + 버킷레벨 (recency 가중)
    const regionCal = computeCalibrationFor(used, undefined, k, rec);
    entries[keyOf(cropId, region, REGION)] = { ...regionCal, cropId, region, bucket: REGION };
    const buckets = new Set(used.map((r) => r.terrainBucket).filter((b): b is string => !!b));
    for (const b of buckets) {
      const cal = computeCalibrationFor(used, b, k, rec);
      entries[keyOf(cropId, region, b)] = { ...cal, cropId, region, bucket: b };
      if (cal.bucketN >= promote) bucketsPromoted.push(keyOf(cropId, region, b));
    }
  }

  return {
    generatedAt: new Date(now).toISOString(),
    entries,
    report: {
      totalRecords: records.length, usedRecords, quarantined,
      groups: groups.size, bucketsPromoted,
      notes: [`recency 반감기 ${halfLifeDays}일`, `이상치 격리 MAD×${madK}`, `버킷 승격 임계 ${promote}건`],
    },
  };
}

const COLD: CalibrationResult = { n: 0, validatedBy: 0, bucketN: 0, scope: "cold", yieldCorrection: 1, costCorrection: 1, priceCorrection: 1, yieldDispersion: null, reason: "보정 없음(스냅샷 미수록)" };

/** 스냅샷에서 보정 조회: 버킷 → 없으면 지역 → 없으면 콜드 */
export function lookupCalibration(snap: CalibrationSnapshot, cropId: string, region?: string, bucket?: string): CalibrationResult {
  const r = region ?? "";
  if (bucket && snap.entries[keyOf(cropId, r, bucket)]) return snap.entries[keyOf(cropId, r, bucket)];
  if (snap.entries[keyOf(cropId, r, REGION)]) return snap.entries[keyOf(cropId, r, REGION)];
  return COLD;
}
