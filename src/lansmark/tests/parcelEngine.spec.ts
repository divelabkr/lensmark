import { describe, it, expect } from "vitest";
import { runParcelSimulation, runParcelSimulationWithProviders, type ParcelInput } from "../core/parcelSimulator";
import { facilityFactors } from "../core/factors";
import { mockProviders } from "../data/providers/mock";

const base = (over: Partial<ParcelInput> = {}): ParcelInput => ({
  land: { areaM2: 3300, soilEvidence: { source: "none" } },
  cropId: "apple", cultivationType: "open_field", salesChannel: "mixed",
  ...over,
});

describe("parcel adjustment engine", () => {
  it("produces ranges + logged factor reasons", () => {
    const r = runParcelSimulation(base({ context: { terrain: { slopeDegree: 5, aspect: "S", altitudeM: 100 } } }));
    expect(r.yieldKg.p50).toBeGreaterThan(0);
    expect(r.incomeKrw.p10).toBeLessThanOrEqual(r.incomeKrw.p50);
    expect(r.factors.length).toBeGreaterThan(0);
    expect(r.factors.every((f) => f.reason.length > 0)).toBe(true);
  });

  it("CORE: same crop, different terrain → different income", () => {
    const good = runParcelSimulation(base({ context: { terrain: { slopeDegree: 3, aspect: "S", altitudeM: 100 } } }));
    const poor = runParcelSimulation(base({ context: { terrain: { slopeDegree: 28, aspect: "N", altitudeM: 500 } } }));
    expect(good.incomeKrw.p50).toBeGreaterThan(poor.incomeKrw.p50);
    expect(good.yieldKg.p50).toBeGreaterThan(poor.yieldKg.p50);
  });

  it("시설(greenhouse) 재배 → 수량·운영비 모두 상향(노지 대비) + 시설 팩터 로깅", () => {
    const open = runParcelSimulation(base({ cultivationType: "open_field" }));
    const green = runParcelSimulation(base({ cultivationType: "greenhouse" }));
    expect(green.yieldKg.p50).toBeGreaterThan(open.yieldKg.p50);   // 환경제어 수량↑
    expect(green.costKrw.p50).toBeGreaterThan(open.costKrw.p50);   // 난방·운영비↑
    expect(green.factors.some((f) => f.axis.startsWith("시설"))).toBe(true);
  });

  it("facilityFactors: 온실/반시설은 수량↑·비용↑, 노지·미지정은 보정 없음", () => {
    const g = facilityFactors("greenhouse");
    expect(g.find((f) => f.target === "yield")!.value).toBeGreaterThan(1);
    expect(g.find((f) => f.target === "cost")!.value).toBeGreaterThan(1);
    expect(facilityFactors("semi_facility").length).toBe(2);
    expect(facilityFactors("open_field")).toEqual([]);
    expect(facilityFactors(undefined)).toEqual([]);
  });

  it("온난화: 냉량성 작물(사과)은 미래 ΔT에서 고온 페널티로 수량↓, 호온성 작물(고추)은 페널티 없음", () => {
    const climate = { minWinterTempC: -8, annualRainfallMm: 1300, summerMaxTempC: 33, frostRisk: "medium" as const, sunlightLevel: "high" as const };
    const appleNow = runParcelSimulation(base({ cropId: "apple", context: { climate } }));
    const appleFut = runParcelSimulation(base({ cropId: "apple", context: { climate }, climateScenario: { deltaTempCOverride: 3 } })); // 여름 33→36
    expect(appleFut.yieldKg.p50).toBeLessThan(appleNow.yieldKg.p50);                 // 내서성 낮음 → 여름최고↑ 고온 스트레스
    expect(appleFut.factors.some((f) => f.axis === "기후·고온")).toBe(true);
    const pepperFut = runParcelSimulation(base({ cropId: "chili_pepper", context: { climate }, climateScenario: { deltaTempCOverride: 3 } }));
    expect(pepperFut.factors.some((f) => f.axis === "기후·고온")).toBe(false);         // 호온성(내서성 높음) → 고온 페널티 없음
  });

  it("시설 난방비는 추운 지역일수록↑(겨울최저 연동)", () => {
    const cold = { minWinterTempC: -12, annualRainfallMm: 1300, sunlightLevel: "high" as const, frostRisk: "high" as const };
    const warm = { minWinterTempC: 2, annualRainfallMm: 1500, sunlightLevel: "medium" as const, frostRisk: "low" as const };
    const cost = (climate: any) => runParcelSimulation(base({ cropId: "strawberry", cultivationType: "greenhouse", context: { climate } })).costKrw.p50;
    expect(cost(cold)).toBeGreaterThan(cost(warm)); // 강원형(−12℃) 난방비 ≫ 제주형(+2℃)
  });

  it("온난화 강수: 물요구 큰 작물(벼)의 소우지 건조 페널티가 ΔT↑(연강수 소폭↑)로 완화", () => {
    const dry = { annualRainfallMm: 1080, minWinterTempC: -3, summerMaxTempC: 30, sunlightLevel: "high" as const };
    const now = runParcelSimulation(base({ cropId: "rice", context: { climate: dry } }));
    const fut = runParcelSimulation(base({ cropId: "rice", context: { climate: dry }, climateScenario: { deltaTempCOverride: 3 } }));
    expect(now.factors.some((f) => f.axis === "기후·강수")).toBe(true);  // 소우지(1080mm) 건조 페널티 있음
    expect(fut.factors.some((f) => f.axis === "기후·강수")).toBe(false); // ΔT3 → 강수 1080→~1129>1100 → 페널티 소멸
  });

  it("기후 변동성(B): 물 민감 작물(벼)은 온난화 시 수량 하방위험↑(p10↓·중앙값 유지)", () => {
    const wet = { annualRainfallMm: 1500, minWinterTempC: -3, summerMaxTempC: 30, sunlightLevel: "high" as const }; // 강수 충분(건조 페널티 없음 — B 격리)
    const now = runParcelSimulation(base({ cropId: "rice", context: { climate: wet } }));
    const fut = runParcelSimulation(base({ cropId: "rice", context: { climate: wet }, climateScenario: { deltaTempCOverride: 4 } }));
    expect(fut.yieldKg.p10).toBeLessThan(now.yieldKg.p10); // 나쁜 해(가뭄·홍수) 하방위험↑
    expect(fut.yieldKg.p50).toBe(now.yieldKg.p50);          // 중앙값은 유지(변동성≠중앙값 페널티)
  });

  it("satellite NDVI low lowers yield", () => {
    const noSat = runParcelSimulation(base());
    const lowNdvi = runParcelSimulation(base({ context: { satellite: { observed: true, ndviRelative: "low" } } }));
    expect(lowNdvi.yieldKg.p50).toBeLessThan(noSat.yieldKg.p50);
  });

  it("soil certificate improves confidence vs none", () => {
    const none = runParcelSimulation(base());
    const cert = runParcelSimulation(base({ land: { areaM2: 3300, soilEvidence: { source: "official_soil_test", ph: 6.0 } } }));
    const ORDER = ["A", "B", "C", "D", "X"];
    expect(ORDER.indexOf(cert.confidence)).toBeLessThan(ORDER.indexOf(none.confidence));
  });

  it("cold-start label is estimated", () => {
    expect(runParcelSimulation(base()).dataLabel).toBe("estimated");
  });

  it("provider wiring: KAMIS price flows into revenue (enrich)", async () => {
    const r = await runParcelSimulationWithProviders(
      base({ cropId: "sweet_potato", land: { areaM2: 3300, address: "전남 해남군", soilEvidence: { source: "none" } } }),
      mockProviders
    );
    expect(r.priceKrwPerKg.p50).toBeGreaterThan(0);
    expect(r.incomeKrw.p50).not.toBeNaN();
  });
});
