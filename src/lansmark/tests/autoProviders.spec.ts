import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { autoProviders, integrationReadiness, okClimate, okTerrain, okPrice } from "../data/providers/auto";
import { recordProvider, _resetProviderHealth } from "../data/providers/runtimeHealth";

const KEYS = ["VWORLD_API_KEY", "KMA_API_KEY", "KAMIS_API_KEY", "KAMIS_API_ID"];
const clear = () => { KEYS.forEach((k) => delete process.env[k]); _resetProviderHealth(); }; // 키 + 런타임 건강 둘 다 격리(모듈 전역 누적 차단)

describe("autoProviders — drop-in (키만 붙이면 운영)", () => {
  beforeEach(clear);
  afterEach(clear);

  it("키 없으면 전부 mock으로 무중단 동작", async () => {
    const t = await autoProviders.land.terrain({ lat: 34.57, lng: 126.6 });
    expect(t).not.toBeNull();
    expect(t!.slopeDegree).toBeGreaterThanOrEqual(0);
    expect((await autoProviders.land.climate({ lat: 34.57, lng: 126.6 })).minWinterTempC).toBeTypeOf("number");
    expect(await autoProviders.land.parcel({ lat: 34.57, lng: 126.6 })).not.toBeNull();
    expect(await autoProviders.price.recentWholesale("blueberry")).not.toBeNull();
  });

  it("VWORLD 키가 있어도 DEM 미구현이면 terrain은 mock 폴백(크래시 없음)", async () => {
    process.env.VWORLD_API_KEY = "test-key"; // fetchDem이 throw → auto가 mockDem 기반으로 폴백
    const t = await autoProviders.land.terrain({ lat: 34.57, lng: 126.6 });
    expect(t).not.toBeNull();
    expect(t!.slopeDegree).toBeGreaterThanOrEqual(0);
  });

  it("readiness가 키 상태/미구현을 정확히 반영", () => {
    clear();
    let r = integrationReadiness();
    expect(r.integrations.vworldTiles.keyed).toBe(false);
    expect(r.integrations.kamisPrice.keyed).toBe(false);
    process.env.VWORLD_API_KEY = "x";
    r = integrationReadiness();
    expect(r.integrations.vworldTiles.keyed).toBe(true);
    expect(r.integrations.vworldDem.live).toBe(true); // 표고·경사 = Open-Meteo(무키) 실데이터로 승격(v0.67) — VWORLD 키와 무관하게 live(호출 전=pending)
  });

  it("런타임 폴백 시 live=false·degraded 표기 — '키=live' 거짓 녹색 차단(설계감사 정직성)", () => {
    process.env.VWORLD_API_KEY = "x"; // 키는 있음
    recordProvider("vworldParcel", "fallback"); // 그러나 실제 호출이 폴백(API 다운/형태깨짐)
    const r = integrationReadiness();
    expect(r.integrations.vworldParcel.keyed).toBe(true);
    expect(r.integrations.vworldParcel.live).toBe(false);              // 키 있어도 live 아님(정직)
    expect(r.integrations.vworldParcel.runtime.state).toBe("degraded");
  });
  it("런타임 live 성공 시 live=true·live 표기", () => {
    process.env.KMA_API_KEY = "x";
    recordProvider("kmaClimate", "live");
    const r = integrationReadiness();
    expect(r.integrations.kmaClimate.live).toBe(true);
    expect(r.integrations.kmaClimate.runtime.state).toBe("live");
  });
});

// 응답 형태 가드 — live 파서가 깨진 응답을 줘도 mock 폴백되도록(조용한 오염 방지).
describe("auto 응답 형태 가드", () => {
  it("okClimate: 의미있는 수치 하나는 있어야 채택", () => {
    expect(okClimate({ minWinterTempC: -12 })).toBe(true);
    expect(okClimate({ annualRainfallMm: 1200 })).toBe(true);
    expect(okClimate({})).toBe(false);
    expect(okClimate(null)).toBe(false);
    expect(okClimate({ minWinterTempC: NaN })).toBe(false);
  });
  it("okTerrain: 경사·표고가 유한해야 채택", () => {
    expect(okTerrain({ slopeDegree: 5, altitudeM: 50 })).toBe(true);
    expect(okTerrain({ slopeDegree: NaN, altitudeM: 50 })).toBe(false);
    expect(okTerrain({ slopeDegree: 5 })).toBe(false);
    expect(okTerrain(null)).toBe(false);
  });
  it("okPrice: P50 단가가 유한·양수여야 채택", () => {
    expect(okPrice({ priceKrwPerKg: { p10: 1000, p50: 2000, p90: 3000 } })).toBe(true);
    expect(okPrice({ priceKrwPerKg: { p50: 0 } })).toBe(false);
    expect(okPrice({ priceKrwPerKg: { p50: NaN } })).toBe(false);
    expect(okPrice(null)).toBe(false);
  });
});
