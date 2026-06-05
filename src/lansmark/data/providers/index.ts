import { mockProviders } from "./mock";
import { liveProviders } from "./live";
import { autoProviders } from "./auto";
import type { ProviderBundle } from "./types";

/**
 * LANSMARK_DATA_MODE:
 *   mock  = 전부 mock(데모)
 *   live  = 전부 실연동(키 없으면 throw — 운영 강제)
 *   auto(기본) = 키 있는 통합만 live, 나머지/실패는 mock 폴백 ("API만 붙이면 운영")
 */
export function getProviders(): ProviderBundle {
  const mode = (process.env.LANSMARK_DATA_MODE ?? "auto").toLowerCase();
  if (mode === "mock") return mockProviders;
  if (mode === "live") return liveProviders;
  return autoProviders;
}

export * from "./types";
export { mockProviders } from "./mock";
export { liveProviders } from "./live";
export { autoProviders, integrationReadiness } from "./auto";
