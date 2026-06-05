import { describe, it, expect } from "vitest";
import { computeCalibration } from "../core/calibrate";
import { InMemoryFeedbackStore, toOutcomeRecord, type OutcomeRecord } from "../core/feedbackStore";
import { runParcelSimulation, runParcelSimulationCalibrated, type ParcelInput } from "../core/parcelSimulator";
import { getCalibration } from "../core/calibration";

const rec = (over: Partial<OutcomeRecord> = {}): OutcomeRecord => ({
  cropId: "apple", region: "전남",
  predictedYieldKg: 1000, predictedCostKrw: 1_000_000, predictedRevenueKrw: 3_000_000,
  actualYieldKg: 1000, actualCostKrw: 1_000_000, actualRevenueKrw: 3_000_000, ...over,
});

describe("flywheel calibration (실측 보정)", () => {
  it("cold start → identity, n=0", () => {
    const c = computeCalibration([]);
    expect(c.n).toBe(0); expect(c.yieldCorrection).toBe(1); expect(c.costCorrection).toBe(1); expect(c.priceCorrection).toBe(1);
  });

  it("actual > predicted yield → correction > 1 but shrunk below raw +20%", () => {
    const c = computeCalibration(Array.from({ length: 10 }, () => rec({ actualYieldKg: 1200 })));
    expect(c.yieldCorrection).toBeGreaterThan(1);
    expect(c.yieldCorrection).toBeLessThan(1.2);
    expect(c.n).toBe(10);
  });

  it("shrinkage: 1 sample moves less than 30 samples", () => {
    const one = computeCalibration([rec({ actualYieldKg: 1400 })]).yieldCorrection;
    const many = computeCalibration(Array.from({ length: 30 }, () => rec({ actualYieldKg: 1400 }))).yieldCorrection;
    expect(Math.abs(one - 1)).toBeLessThan(Math.abs(many - 1));
  });

  it("clamps extreme outliers", () => {
    const c = computeCalibration(Array.from({ length: 30 }, () => rec({ actualYieldKg: 50000 })));
    expect(c.yieldCorrection).toBeLessThanOrEqual(1.6);
  });

  it("store add/query filters by crop×region", () => {
    const s = new InMemoryFeedbackStore();
    s.add(rec()); s.add(rec({ cropId: "grape" })); s.add(rec({ region: "경북" }));
    expect((s.query("apple", "전남") as OutcomeRecord[]).length).toBe(1);
  });

  it("CORE: enough real outcomes flip estimated→validated AND shift prediction", async () => {
    const s = new InMemoryFeedbackStore();
    const base: ParcelInput = {
      land: { areaM2: 3300, soilEvidence: { source: "none" } },
      cropId: "apple", cultivationType: "open_field", salesChannel: "mixed", region: "전남",
      context: { terrain: { slopeDegree: 5, aspect: "S", altitudeM: 100 } },
    };
    const before = runParcelSimulation(base);
    expect(before.dataLabel).toBe("estimated");
    for (let i = 0; i < 7; i++) {
      s.add(toOutcomeRecord(
        { cropId: "apple", region: "전남", userId: "u" + i, yieldKg: before.yieldKg.p50, costKrw: before.costKrw.p50, revenueKrw: before.revenueKrw.p50 }, // 서로 다른 7인(distinct 제출자) → validated
        { actualYieldKg: Math.round(before.yieldKg.p50 * 1.25), actualCostKrw: before.costKrw.p50, actualRevenueKrw: Math.round(before.revenueKrw.p50 * 1.25) }
      ));
    }
    const after = await runParcelSimulationCalibrated(base, s);
    expect(after.dataLabel).toBe("validated");
    expect(after.yieldKg.p50).toBeGreaterThan(before.yieldKg.p50);
    expect(after.factors.some((f) => f.axis === "실측보정")).toBe(true);
  });

  it("MOAT-1: 단일 제출자의 다건은 validated 위조 못함(distinct 기준)", async () => {
    const s = new InMemoryFeedbackStore();
    for (let i = 0; i < 6; i++) s.add(rec({ userId: "solo", actualYieldKg: 1250 }));
    const cal = await getCalibration("apple", "전남", s);
    expect(cal.n).toBe(6);            // 보정은 6건으로 작동(수축)
    expect(cal.validatedBy).toBe(1);  // 검증 배지 기준은 1 — 위조 차단
  });

  it("MOAT-1: 서로 다른 5인 제출 → validatedBy=5", async () => {
    const s = new InMemoryFeedbackStore();
    for (let i = 0; i < 5; i++) s.add(rec({ userId: "u" + i, actualYieldKg: 1250 }));
    expect((await getCalibration("apple", "전남", s)).validatedBy).toBe(5);
  });

  it("HYBRID(H1): 무료 베타 익명 제출(anon-*)은 보정엔 반영되나 '✓검증'엔 미반영 — 인증 제출만 카운트(위조 차단)", async () => {
    const s = new InMemoryFeedbackStore();
    for (let i = 0; i < 6; i++) s.add(rec({ userId: "anon-" + i.toString(16).padStart(16, "0"), actualYieldKg: 1250 })); // 서로 다른 익명 6 = 검증 위조 시도
    const anonOnly = await getCalibration("apple", "전남", s);
    expect(anonOnly.n).toBe(6);          // 보정 데이터로는 반영(예측 개선)
    expect(anonOnly.validatedBy).toBe(0); // 그러나 검증 배지는 0 — 무료 익명으로 부풀릴 수 없음
    s.add(rec({ userId: "order:X", actualYieldKg: 1250 }));
    s.add(rec({ userId: "order:Y", actualYieldKg: 1250 }));
    expect((await getCalibration("apple", "전남", s)).validatedBy).toBe(2); // 인증(유료) 2인만 검증으로 카운트
  });

  it("MOAT-1: 단일 제출자 7건은 시뮬에서도 estimated 유지(보정은 적용)", async () => {
    const s = new InMemoryFeedbackStore();
    const base: ParcelInput = {
      land: { areaM2: 3300, soilEvidence: { source: "none" } },
      cropId: "apple", cultivationType: "open_field", salesChannel: "mixed", region: "전남",
      context: { terrain: { slopeDegree: 5, aspect: "S", altitudeM: 100 } },
    };
    const before = runParcelSimulation(base);
    for (let i = 0; i < 7; i++) {
      s.add(toOutcomeRecord(
        { cropId: "apple", region: "전남", userId: "solo", yieldKg: before.yieldKg.p50, costKrw: before.costKrw.p50, revenueKrw: before.revenueKrw.p50 },
        { actualYieldKg: Math.round(before.yieldKg.p50 * 1.25), actualRevenueKrw: Math.round(before.revenueKrw.p50 * 1.25) }
      ));
    }
    const after = await runParcelSimulationCalibrated(base, s);
    expect(after.dataLabel).toBe("estimated");                       // 단일 제출자 → 위조 차단
    expect(after.yieldKg.p50).toBeGreaterThan(before.yieldKg.p50);   // 보정은 정상 적용
  });

  it("FLYWHEEL-POISON: 단일 제출자 다건 극단값은 보정 magnitude를 지배 못함(per-user 가중 캡)", () => {
    // 같은 userId 30건 vs 서로 다른 30인 — 둘 다 actual=1.5×predicted(비-clamp 영역)
    const solo = computeCalibration(Array.from({ length: 30 }, () => rec({ userId: "solo", actualYieldKg: 1500 })));
    const distinct = computeCalibration(Array.from({ length: 30 }, (_, i) => rec({ userId: "u" + i, actualYieldKg: 1500 })));
    expect(solo.yieldCorrection).toBeLessThan(distinct.yieldCorrection); // 단일 제출자는 가중 캡으로 덜 끌려감
    expect(solo.yieldCorrection).toBeLessThan(1.3);                       // 단일 제출자만으로는 보정 magnitude 제한
    expect(solo.n).toBe(30);                                              // 건수(n)·배지 기준은 불변
  });

  it("FLYWHEEL-POISON(H1 후속): 무료 익명 다중신원(매번 다른 anon-*)도 magnitude 캡 우회 못함 — anon-pool 공유", () => {
    // 무료베타 공격: 무헤더 반복 제출 → 매번 새 anon-<UUID>(distinct userId)로 per-user 캡 우회 시도, actual=1.5×predicted
    const flood = computeCalibration(Array.from({ length: 1000 }, (_, i) => rec({ userId: "anon-" + i.toString(16).padStart(16, "0"), actualYieldKg: 1500 })));
    const solo = computeCalibration(Array.from({ length: 1000 }, () => rec({ userId: "solo", actualYieldKg: 1500 })));
    expect(flood.yieldCorrection).toBeCloseTo(solo.yieldCorrection, 5); // 익명 1000신원 ≈ 단일 제출자(캡 공유로 묶임)
    expect(flood.yieldCorrection).toBeLessThan(1.3);                    // 캡 유지(미캡이면 하드클램프 1.6 근처까지 끌려갔음)
    expect(flood.n).toBe(1000);                                         // 데이터 수집(n)은 그대로 — 영향력만 제한
  });
});
