import type { LandInput, SigmaRange } from "../types";
import type { ProviderBundle } from "../data/providers/types";

/** 주소/좌표 → 좌표·PNU·기후 보강된 LandInput */
export async function buildLandInput(
  query: { address?: string; lat?: number; lng?: number },
  areaM2: number,
  base: Partial<LandInput>,
  providers: ProviderBundle
): Promise<LandInput> {
  const geo = await providers.land.geocode(query);
  let climate = {};
  if (geo.lat !== undefined && geo.lng !== undefined) {
    climate = await providers.land.climate({ lat: geo.lat, lng: geo.lng });
  }
  return {
    ...base,
    areaM2,
    address: geo.address ?? query.address ?? base.address,
    pnu: geo.pnu ?? base.pnu,
    lat: geo.lat ?? base.lat,
    lng: geo.lng ?? base.lng,
    ...climate,
  } as LandInput;
}

/** 최근 도매가 힌트 (UI/리포트 참고용; 시뮬레이터 기본값은 작물 룰북) */
export async function getPriceHint(cropId: string, providers: ProviderBundle): Promise<SigmaRange | null> {
  const r = await providers.price.recentWholesale(cropId);
  return r ? r.priceKrwPerKg : null;
}
