import { describe, it, expect } from "vitest";
import { multiplyIndependent, subtractIndependent, floorIncomeLoss } from "../core/uncertainty";

const y = { p10: 600, p50: 1125, p90: 1875 };
const p = { p10: 12000, p50: 18000, p90: 28000 };

describe("uncertainty", () => {
  it("product P50 equals product of medians", () => {
    expect(multiplyIndependent(y, p).p50).toBe(1125 * 18000);
  });
  it("product P90 is more conservative than comonotonic corner", () => {
    expect(multiplyIndependent(y, p).p90).toBeLessThan(y.p90 * p.p90);
  });
  it("keeps ordering p10<=p50<=p90", () => {
    const r = multiplyIndependent(y, p);
    expect(r.p10).toBeLessThanOrEqual(r.p50);
    expect(r.p50).toBeLessThanOrEqual(r.p90);
  });
  it("difference P50 equals difference of medians", () => {
    const rev = { p10: 5_000_000, p50: 20_000_000, p90: 35_000_000 };
    const cost = { p10: 9_000_000, p50: 18_000_000, p90: 32_000_000 };
    expect(subtractIndependent(rev, cost).p50).toBe(2_000_000);
  });
});

describe("floorIncomeLoss — 현실 손실 하한 가드레일(#5)", () => {
  it("물리적 불가능 손실(p10 < -cost.p90)만 -cost.p90으로 클램프 · p50/p90 무변", () => {
    const r = floorIncomeLoss({ p10: -80_000_000, p50: 10_000_000, p90: 90_000_000 }, 30_000_000);
    expect(r.p10).toBe(-30_000_000); // -8천만 < -3천만(=-cost.p90) → 하한으로 클램프
    expect(r.p50).toBe(10_000_000);  // 무변(인위적 축소 아님)
    expect(r.p90).toBe(90_000_000);
  });
  it("하한 위면 그대로 — 범위를 인위적으로 좁히지 않음", () => {
    const r = floorIncomeLoss({ p10: -10_000_000, p50: 5_000_000, p90: 20_000_000 }, 50_000_000);
    expect(r.p10).toBe(-10_000_000); // -1천만 > -5천만 → 무변(현재 데모 데이터가 이 케이스=휴면)
  });
  it("단조성 p10<=p50<=p90 유지 + 항상 p10 >= -cost.p90", () => {
    const r = floorIncomeLoss({ p10: -80_000_000, p50: 10_000_000, p90: 90_000_000 }, 30_000_000);
    expect(r.p10).toBeLessThanOrEqual(r.p50);
    expect(r.p50).toBeLessThanOrEqual(r.p90);
    expect(r.p10).toBeGreaterThanOrEqual(-30_000_000);
  });
});
