import type { ProviderBundle } from "./types";
import { geocodeAddress, fetchParcel } from "../../geo/vworld";
import { fetchDem } from "../../geo/dem";
import { terrainFromDem } from "../../geo/terrainFromDem";
import { bboxAround } from "../../geo/crs";
import { fetchClimate } from "../../geo/kma";
import { fetchWholesale, fetchRetailWeekly } from "../../geo/kamis";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (LANSMARK_DATA_MODE=live).`);
  return v;
}

/** 실연동 Provider. VWorld(geocode/parcel/terrain)는 키만 있으면 동작. climate/price는 KMA/KAMIS 연동 자리. */
export const liveProviders: ProviderBundle = {
  land: {
    async geocode(q) {
      const key = reqEnv("VWORLD_API_KEY");
      if (!q.address) return { lat: q.lat, lng: q.lng };
      const r = await geocodeAddress(q.address, key);
      return r ? { address: q.address, lat: r.lat, lng: r.lng, pnu: r.pnu } : { address: q.address };
    },
    async climate(loc) {
      const key = reqEnv("KMA_API_KEY");
      return fetchClimate(loc.lat, loc.lng, key);
    },
    async parcel(loc) {
      const key = reqEnv("VWORLD_API_KEY");
      return fetchParcel(loc.lat, loc.lng, key);
    },
    async terrain(loc) {
      // 표고·경사 = Open-Meteo Elevation(무료·무키 — VWORLD 키 불필요). 넓게(150m≈300m폭) 떠서 ~90m DEM에서도 의미있는 국소 경사.
      const grid = await fetchDem(bboxAround({ lat: loc.lat, lng: loc.lng }, 150));
      return terrainFromDem(grid);
    },
  },
  price: {
    async recentWholesale(cropId) {
      const key = reqEnv("KAMIS_API_KEY");
      const id = reqEnv("KAMIS_API_ID");
      return fetchWholesale(cropId, key, id);
    },
    async retailWeekly(cropId) {
      return fetchRetailWeekly(cropId, reqEnv("KAMIS_API_KEY"), reqEnv("KAMIS_API_ID"));
    },
  },
};
