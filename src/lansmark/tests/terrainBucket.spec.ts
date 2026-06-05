import { describe, it, expect } from "vitest";
import { computeCalibrationFor } from "../core/calibrate";
import { terrainBucketOf, type OutcomeRecord } from "../core/feedbackStore";

const B_STEEP = terrainBucketOf({ slopeDegree: 25, aspect: "N", altitudeM: 500 });
const B_FLAT = terrainBucketOf({ slopeDegree: 2, aspect: "S", altitudeM: 80 });
const rec = (bucket: string, yieldRatio: number): OutcomeRecord => ({
  cropId: "apple", region: "전북", terrainBucket: bucket,
  predictedYieldKg: 1000, predictedCostKrw: 1_000_000, predictedRevenueKrw: 3_000_000,
  actualYieldKg: Math.round(1000 * yieldRatio), actualCostKrw: 1_000_000, actualRevenueKrw: 3_000_000,
});

describe("terrain-bucket calibration (#3 부분풀링)", () => {
  it("terrainBucketOf bins slope/aspect/altitude", () => {
    expect(B_STEEP).toBe("s:steep|a:N|h:high");
    expect(B_FLAT).toBe("s:flat|a:S|h:low");
    expect(terrainBucketOf({ slopeDegree: 9, aspect: "E", altitudeM: 300 })).toBe("s:gentle|a:EW|h:mid");
  });

  it("different buckets → different corrections in same crop×region", () => {
    const recs = [
      ...Array.from({ length: 12 }, () => rec(B_STEEP, 0.8)),  // 급경사: 실측 낮음
      ...Array.from({ length: 12 }, () => rec(B_FLAT, 1.2)),   // 평지: 실측 높음
    ];
    const steep = computeCalibrationFor(recs, B_STEEP).yieldCorrection;
    const flat = computeCalibrationFor(recs, B_FLAT).yieldCorrection;
    expect(steep).toBeLessThan(1);
    expect(flat).toBeGreaterThan(1);
    expect(flat).toBeGreaterThan(steep);
  });

  it("sparse bucket → shrinks toward region average (not wild)", () => {
    const recs = [
      ...Array.from({ length: 20 }, () => rec(B_FLAT, 1.15)), // 지역 대부분 평지 +15%
      rec(B_STEEP, 0.5),                                       // 급경사 단 1건(극단)
    ];
    const region = computeCalibrationFor(recs).yieldCorrection;        // 지역 평균
    const steep = computeCalibrationFor(recs, B_STEEP);                 // 급경사(표본 1)
    expect(steep.bucketN).toBe(1);
    expect(steep.scope).toBe("terrain");
    // 1건 극단치지만 지역평균 쪽으로 강하게 수축 → region 근처, 0.5로 폭주하지 않음
    expect(steep.yieldCorrection).toBeGreaterThan(0.9);
  });

  it("no matching bucket samples → falls back to region scope", () => {
    const recs = Array.from({ length: 6 }, () => rec(B_FLAT, 1.2));
    const r = computeCalibrationFor(recs, B_STEEP);
    expect(r.bucketN).toBe(0);
    expect(r.scope).toBe("region");
    expect(r.n).toBe(6); // validated 여전히 지역 표본 기준
  });
});
