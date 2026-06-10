import type { ProviderBundle } from "./types";
import type { SigmaRange } from "../../types";
import { mockParcel } from "../../geo/vworld";
import { mockDem } from "../../geo/dem";
import { terrainFromDem } from "../../geo/terrainFromDem";
import { bboxAround } from "../../geo/crs";

const PRICE_FIXTURE: Record<string, SigmaRange> = {
  sweet_potato: { p10: 950, p50: 1450, p90: 2150 },
  potato: { p10: 650, p50: 1150, p90: 1850 },
  garlic: { p10: 2600, p50: 4200, p90: 6200 },
  onion: { p10: 420, p50: 820, p90: 1450 },
  blueberry: { p10: 5200, p50: 8200, p90: 12500 },
  apple: { p10: 1600, p50: 2900, p90: 4600 },
  strawberry: { p10: 5200, p50: 8300, p90: 12500 },
};

export const mockProviders: ProviderBundle = {
  land: {
    async geocode(q) {
      // 데모 기본 좌표: 전남 해남군 인근
      return {
        address: q.address ?? "전남 해남군 (mock)",
        pnu: "4682025021100010000",
        lat: q.lat ?? 34.5734,
        lng: q.lng ?? 126.5990,
      };
    },
    async climate(_loc) {
      return {
        altitudeM: 35,
        annualRainfallMm: 1450,
        minWinterTempC: -7,
        summerMaxTempC: 32,   // 데모 평년 폭염기 일최고(근사)
        frostRisk: "medium",
        sunlightLevel: "high",
      };
    },
    async parcel(loc) {
      return mockParcel(loc.lat, loc.lng);
    },
    async terrain(loc) {
      return terrainFromDem(mockDem(bboxAround({ lat: loc.lat, lng: loc.lng }, 80)));
    },
  },
  price: {
    async recentWholesale(cropId) {
      const r = PRICE_FIXTURE[cropId];
      return r ? { priceKrwPerKg: r, source: "mock-kamis" } : null;
    },
    async retailWeekly(cropId) {
      const r = PRICE_FIXTURE[cropId];
      if (!r) return null;
      // mock 소매가: 도매 p50에 소매 마진(×1.6) 가정 + ±15% 주간 폭(결정적). 실제는 live KAMIS 소매(01).
      const mid = Math.round(r.p50 * 1.6);
      return { min: Math.round(mid * 0.85), avg: mid, max: Math.round(mid * 1.15), samples: 7, source: "mock-retail" };
    },
  },
};
