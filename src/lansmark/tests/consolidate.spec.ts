import { describe, it, expect } from "vitest";
import { consolidate, lookupCalibration } from "../core/consolidate";
import { terrainBucketOf, type OutcomeRecord } from "../core/feedbackStore";
import { runParcelSimulation, runParcelSimulationWithSnapshot, type ParcelInput } from "../core/parcelSimulator";

const B_FLAT = terrainBucketOf({ slopeDegree: 2, aspect: "S", altitudeM: 80 });
const day = 86400000;
const NOW = Date.parse("2026-05-01T00:00:00Z");
const rec = (over: Partial<OutcomeRecord> = {}): OutcomeRecord => ({
  cropId: "apple", region: "전북", terrainBucket: B_FLAT,
  predictedYieldKg: 1000, predictedCostKrw: 1_000_000, predictedRevenueKrw: 3_000_000,
  actualYieldKg: 1000, actualCostKrw: 1_000_000, actualRevenueKrw: 3_000_000,
  createdAt: new Date(NOW).toISOString(), ...over,
});

describe("LANSMARK Dream v1 (consolidate)", () => {
  it("builds region + bucket snapshot entries", () => {
    const snap = consolidate(Array.from({ length: 6 }, () => rec({ actualYieldKg: 1100 })), { now: NOW });
    expect(snap.entries[`apple|전북|*`]).toBeTruthy();
    expect(snap.entries[`apple|전북|${B_FLAT}`]).toBeTruthy();
    expect(snap.report.groups).toBe(1);
  });

  it("recency: recent high outcomes outweigh old low (flips correction >1)", () => {
    const recsOldLow = Array.from({ length: 5 }, () => rec({ actualYieldKg: 700, createdAt: new Date(NOW - 1095 * day).toISOString() })); // 3년 전, -30%
    const recsNewHigh = Array.from({ length: 5 }, () => rec({ actualYieldKg: 1300, createdAt: new Date(NOW).toISOString() }));            // 최근, +30%
    const all = [...recsOldLow, ...recsNewHigh];
    const withRecency = consolidate(all, { now: NOW, halfLifeDays: 365 });
    const noRecency = consolidate(all, { now: NOW, halfLifeDays: 0 as any }); // 0=균등(미적용)
    const yWith = lookupCalibration(withRecency, "apple", "전북", B_FLAT).yieldCorrection;
    const yNo = lookupCalibration(noRecency, "apple", "전북", B_FLAT).yieldCorrection;
    expect(yWith).toBeGreaterThan(1);   // 최근(높음)이 지배
    expect(yWith).toBeGreaterThan(yNo); // recency 적용이 더 높게
  });

  it("quarantines fat-finger outlier and does not blow up correction", () => {
    const normal = Array.from({ length: 8 }, () => rec({ actualYieldKg: 1100 }));
    const outlier = rec({ actualYieldKg: 99000 }); // 입력 실수
    const snap = consolidate([...normal, outlier], { now: NOW });
    expect(snap.report.quarantined.length).toBeGreaterThanOrEqual(1);
    expect(snap.report.usedRecords).toBeLessThan(9);
    expect(lookupCalibration(snap, "apple", "전북", B_FLAT).yieldCorrection).toBeLessThan(1.3);
  });

  it("promotes bucket with enough samples", () => {
    const snap = consolidate(Array.from({ length: 6 }, () => rec({ actualYieldKg: 1100 })), { now: NOW, promoteThreshold: 5 });
    expect(snap.report.bucketsPromoted).toContain(`apple|전북|${B_FLAT}`);
  });

  it("lookup falls back: bucket→region→cold", () => {
    const snap = consolidate(Array.from({ length: 6 }, () => rec({ actualYieldKg: 1100 })), { now: NOW });
    const B_STEEP = terrainBucketOf({ slopeDegree: 25, aspect: "N", altitudeM: 500 });
    expect(lookupCalibration(snap, "apple", "전북", B_STEEP).scope).toBe("region"); // 버킷 없음 → 지역
    expect(lookupCalibration(snap, "grape", "전북").scope).toBe("cold");            // 미수록 → 콜드
  });

  it("snapshot runner applies correction + validated", () => {
    const snap = consolidate(Array.from({ length: 7 }, (_, i) => rec({ userId: "u" + i, actualYieldKg: 1250, actualRevenueKrw: 3_750_000 })), { now: NOW }); // 서로 다른 7인 → validated(distinct 제출자 기준 · MOAT-1)
    const input: ParcelInput = { land: { areaM2: 3300, soilEvidence: { source: "none" } }, cropId: "apple", cultivationType: "open_field", salesChannel: "mixed", region: "전북", context: { terrain: { slopeDegree: 2, aspect: "S", altitudeM: 80 } } };
    const before = runParcelSimulation(input);
    const after = runParcelSimulationWithSnapshot(input, snap);
    expect(after.dataLabel).toBe("validated");
    expect(after.yieldKg.p50).toBeGreaterThan(before.yieldKg.p50);
  });
});
