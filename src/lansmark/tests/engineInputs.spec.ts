import { describe, it, expect } from "vitest";
import { runParcelSimulation, runParcelSimulationWithProviders, type ParcelInput } from "../core/parcelSimulator";
import { getRdaBase } from "../data/rdaIncome";
import { mockProviders } from "../data/providers";

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

describe("단가 소스 우선순위 — mock 단가가 실 RDA 단가를 덮어쓰지 않음", () => {
  it("실 RDA 작물(블루베리)은 mock provider 단가(8,200)가 아니라 실 refPrice(≈23,706)를 써 소득이 양수", async () => {
    // 미검증 작물은 KAMIS가 null → mock 폴백(8,200원/kg). 이 mock이 실 RDA 농가수취가(23,706)를 덮어쓰면 소득이 음수가 됐었다.
    const r = await runParcelSimulationWithProviders(base({ cropId: "blueberry", region: "전남" }), mockProviders);
    expect(r.priceKrwPerKg.p50).toBeGreaterThan(15000); // 실 RDA ~23,706 (mock 8,200 아님)
    expect(r.incomeKrw.p50).toBeGreaterThan(0);          // mock 단가였다면 P50도 음수였음
  });
  it("실 KAMIS 시세(source 'mock' 아님)는 정상 주입 — apple 명시 단가 반영", async () => {
    // input.kamisPriceKrwPerKg(명시 실 단가)는 그대로 사용(덮어쓰기 차단은 mock 폴백에만 적용).
    const r = await runParcelSimulationWithProviders(base({ cropId: "apple", kamisPriceKrwPerKg: { p10: 6000, p50: 8000, p90: 10000 } }), mockProviders);
    expect(r.priceKrwPerKg.p50).toBeGreaterThan(4450); // 명시 단가(8,000) > refPrice(4,450) 반영
  });
});
