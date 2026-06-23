/**
 * Dream 스냅샷 캐시 배선 회귀가드 — consolidate()가 프로덕션 simulate에 실제로 연결됐는지 고정.
 *   배경: consolidate는 코드·테스트는 있었으나 프로덕션 미호출이었다(해자 정밀화 사장). 이 배선이 빠지면 회귀.
 *   상태는 store별(WeakMap)이라 각 it가 new store → 격리 자동(reset 불필요).
 */
import { describe, it, expect } from "vitest";
import { getConsolidatedCalibration, markCalibrationDirty, currentSnapshotReport } from "../core/consolidateCache";
import { InMemoryFeedbackStore, type OutcomeRecord } from "../core/feedbackStore";

const rec = (cropId: string, actualYieldKg: number, predictedYieldKg = 1000): OutcomeRecord => ({
  cropId, predictedYieldKg, predictedCostKrw: 0, predictedRevenueKrw: 0,
  actualYieldKg, createdAt: new Date().toISOString(),
});

describe("consolidateCache (Dream 배선)", () => {
  it("스냅샷에 실측이 쌓이면 정밀 보정(n>0) + 리포트 생성", async () => {
    const store = new InMemoryFeedbackStore();
    for (let i = 0; i < 6; i++) store.add(rec("apple", 1200)); // 예측 1000 → 실측 1200(수율비 1.2)
    const cal = await getConsolidatedCalibration("apple", undefined, store);
    expect(cal.n).toBeGreaterThan(0);                  // 스냅샷 보정이 적용됨
    expect(currentSnapshotReport(store)).not.toBeNull(); // consolidate가 실제로 돎(리포트 존재)
  });

  it("스냅샷에 없는 신규 작물은 raw로 폴백(콜드 n=0) — 기존 동작 보존", async () => {
    const store = new InMemoryFeedbackStore();
    store.add(rec("apple", 1200));
    const cal = await getConsolidatedCalibration("garlic", undefined, store); // 실측 없는 작물
    expect(cal.n).toBe(0);                             // 콜드(보정 없음) — 회귀 0
  });

  it("markCalibrationDirty 후 새 실측이 즉시 반영(스냅샷 재생성)", async () => {
    const store = new InMemoryFeedbackStore();
    for (let i = 0; i < 6; i++) store.add(rec("apple", 1200));
    const before = await getConsolidatedCalibration("apple", undefined, store);
    for (let i = 0; i < 6; i++) store.add(rec("apple", 1100)); // 새 실측 6건 추가
    markCalibrationDirty(store);
    const after = await getConsolidatedCalibration("apple", undefined, store);
    expect(after.n).toBeGreaterThan(before.n);         // 무효화 후 더 많은 실측이 반영됨
  });

  it("TTL 내·dirty 아니면 스냅샷 재사용(같은 now면 재생성 안 함)", async () => {
    const store = new InMemoryFeedbackStore();
    for (let i = 0; i < 6; i++) store.add(rec("apple", 1200));
    const now = 1_000_000_000_000;
    await getConsolidatedCalibration("apple", undefined, store, undefined, now);
    const gen1 = currentSnapshotReport(store)?.totalRecords;
    store.add(rec("apple", 1200));                     // 추가하되 dirty 표시 안 함
    await getConsolidatedCalibration("apple", undefined, store, undefined, now); // 같은 now·신선
    expect(currentSnapshotReport(store)?.totalRecords).toBe(gen1); // 재생성 안 됨(캐시 재사용)
  });
});
