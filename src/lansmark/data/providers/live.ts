import type { ProviderBundle } from "./types";
import { geocodeAddress, fetchParcel } from "../../geo/vworld";
import { fetchDem } from "../../geo/dem";
import { terrainFromDem } from "../../geo/terrainFromDem";
import { bboxAround } from "../../geo/crs";
import { fetchClimate } from "../../geo/kma";
import { fetchWholesale, fetchRetailWeekly } from "../../geo/kamis";
import { cached } from "./cache";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (LANSMARK_DATA_MODE=live).`);
  return v;
}

// 외부조회 TTL 캐시(격자/작물 버킷) — 같은 땅·작물 반복분석 시 외부호출 1회로(무료 API라 '비용'보다 체감·쿼터·타임아웃 회피).
//   캐시키는 좌표/작물만(API키 인자는 키에서 제외 — 비밀 미포함·배포 환경 고정). 좌표는 데이터 성격별 정밀도로 버킷:
//   기후 ~1km(소수2)·필지 ~10m(소수4)·표고 ~110m(소수3). 시세는 전국 단일이라 작물ID. TTL은 갱신 주기 따라 차등.
const cGeocode = cached((address: string, _key: string) => geocodeAddress(address, _key), { ttlMs: 30 * 86_400e3, key: (a) => a.trim().toLowerCase(), cap: 3000 }); // 주소→좌표 불변
const cClimate = cached((lat: number, lng: number, _key: string) => fetchClimate(lat, lng, _key), { ttlMs: 12 * 3600e3, key: (lat, lng) => `${lat.toFixed(2)},${lng.toFixed(2)}`, cap: 2000 });
const cParcel = cached((lat: number, lng: number, _key: string) => fetchParcel(lat, lng, _key), { ttlMs: 30 * 86_400e3, key: (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`, cap: 3000 }); // 필지경계 거의 불변
const cDem = cached((lat: number, lng: number) => fetchDem(bboxAround({ lat, lng }, 150)), { ttlMs: 30 * 86_400e3, key: (lat, lng) => `${lat.toFixed(3)},${lng.toFixed(3)}`, cap: 5000 }); // 표고 불변
const cWholesale = cached((cropId: string, _key: string, _id: string) => fetchWholesale(cropId, _key, _id), { ttlMs: 6 * 3600e3, key: (cropId) => cropId, cap: 200 }); // 도매 시세(일별)
const cRetail = cached((cropId: string, _key: string, _id: string) => fetchRetailWeekly(cropId, _key, _id), { ttlMs: 12 * 3600e3, key: (cropId) => cropId, cap: 200 }); // 소매 시세(주간)

/** 실연동 Provider. VWorld(geocode/parcel/terrain)는 키만 있으면 동작. climate/price는 KMA/KAMIS 연동. 모든 외부조회는 위 TTL 캐시 경유(재활용·외부호출 절감). */
export const liveProviders: ProviderBundle = {
  land: {
    async geocode(q) {
      const key = reqEnv("VWORLD_API_KEY");
      if (!q.address) return { lat: q.lat, lng: q.lng };
      const r = await cGeocode(q.address, key);
      return r ? { address: q.address, lat: r.lat, lng: r.lng, pnu: r.pnu } : { address: q.address };
    },
    async climate(loc) {
      return cClimate(loc.lat, loc.lng, reqEnv("KMA_API_KEY"));
    },
    async parcel(loc) {
      return cParcel(loc.lat, loc.lng, reqEnv("VWORLD_API_KEY"));
    },
    async terrain(loc) {
      // 표고·경사 = Open-Meteo Elevation(무료·무키). 150m bbox로 ~90m DEM에서도 국소 경사. 좌표 버킷 캐시(표고 불변).
      return terrainFromDem(await cDem(loc.lat, loc.lng));
    },
  },
  price: {
    async recentWholesale(cropId) {
      return cWholesale(cropId, reqEnv("KAMIS_API_KEY"), reqEnv("KAMIS_API_ID"));
    },
    async retailWeekly(cropId) {
      return cRetail(cropId, reqEnv("KAMIS_API_KEY"), reqEnv("KAMIS_API_ID"));
    },
  },
};
