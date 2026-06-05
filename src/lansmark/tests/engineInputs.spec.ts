import { describe, it, expect } from "vitest";
import { runParcelSimulation, type ParcelInput } from "../core/parcelSimulator";
import { getRdaBase } from "../data/rdaIncome";

const base = (over: Partial<ParcelInput> = {}): ParcelInput => ({
  land: { areaM2: 3300, soilEvidence: { source: "none" } },
  cropId: "apple", cultivationType: "open_field", salesChannel: "mixed", ...over,
});

describe("엔진이 판로(salesChannel)·연차(targetYear)를 반영", () => {
  it("판로별 단가가 결과 가격에 반영(직거래 > 도매)", () => {
    const wholesale = runParcelSimulation(base({ salesChannel: "wholesale" }));
    const direct = runParcelSimulation(base({ salesChannel: "direct" }));
    expect(wholesale.priceKrwPerKg.p50).toBeGreaterThan(0);
    expect(direct.priceKrwPerKg.p50).toBeGreaterThan(wholesale.priceKrwPerKg.p50);
  });

  it("기본값 mixed/mature 하위호환(기존 동작 불변)", () => {
    const def = getRdaBase("apple");
    const explicit = getRdaBase("apple", undefined, { salesChannel: "mixed", targetYear: "mature" });
    expect(def.refPriceKrwPerKg).toEqual(explicit.refPriceKrwPerKg);
    expect(def.yieldKgPer10a).toEqual(explicit.yieldKgPer10a);
  });

  it("targetYear가 다년생 정착연차를 반영(apple year1 수량 < 성숙기) → 정착기 손실 노출", () => {
    const y1 = getRdaBase("apple", undefined, { targetYear: "year1" });
    const mature = getRdaBase("apple", undefined, { targetYear: "mature" });
    expect(y1.yieldKgPer10a.p50).toBeLessThan(mature.yieldKgPer10a.p50); // 정착기 수량≈0
    // 수량은 0이지만 경영비는 발생 → 정착기 소득이 성숙기보다 낮게(손실로) 드러난다
    const inc1 = runParcelSimulation(base({ cropId: "apple", targetYear: "year1" })).incomeKrw.p50;
    const incM = runParcelSimulation(base({ cropId: "apple", targetYear: "mature" })).incomeKrw.p50;
    expect(inc1).toBeLessThan(incM);
  });
});
