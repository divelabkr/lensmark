import type { FeedbackStore } from "./feedbackStore";
import { computeCalibration, computeCalibrationFor, distinctSubmitters, type CalibrationResult } from "./calibrate";

export { computeCalibration, computeCalibrationFor };
export type { CalibrationResult };

export const VALIDATED_THRESHOLD = 5;

/** 작물×지역(×지형버킷) 보정. store 없으면 콜드스타트. */
export async function getCalibration(cropId: string, region?: string, store?: FeedbackStore, bucket?: string): Promise<CalibrationResult> {
  if (!store) return computeCalibrationFor([], bucket);
  const recs = await store.query(cropId, region);
  return computeCalibrationFor(recs, bucket);
}

/**
 * validation 레벨 = 실측을 제출한 **서로 다른 주체(userId) 수**.
 *  - 단일 주체가 N건 자기보고해도 1로 카운트 → '✓검증' 배지 위조 차단(레드팀 H6).
 *  - userId 없는(레거시/익명) 실측은 모두 'anon' 하나로 합산(보수적).
 */
export async function getValidationLevel(cropId: string, region?: string, store?: FeedbackStore): Promise<number> {
  if (!store) return 0;
  return distinctSubmitters(await store.query(cropId, region)); // distinct 제출자(SSOT: calibrate.distinctSubmitters) — 배지·레벨 동일 기준
}

// ⑧+ Dream(정리층)
export { consolidate, lookupCalibration } from "./consolidate";
export type { CalibrationSnapshot, SnapshotEntry, ConsolidationReport } from "./consolidate";
export function getCalibrationFromSnapshot(snapshot: import("./consolidate").CalibrationSnapshot, cropId: string, region?: string, bucket?: string) {
  return lookupCalibrationImpl(snapshot, cropId, region, bucket);
}
import { lookupCalibration as lookupCalibrationImpl } from "./consolidate";
