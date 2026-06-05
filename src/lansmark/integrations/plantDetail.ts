/**
 * 식물 재배정보 seam(HUMAN GATE) — 외래·임의 작물의 관수/일조/내한성/병해 등 상세.
 *   책임: Perenual(우선)·Trefle(폴백) URL 빌더 + 키게이트 raw fetch(샘플 캡처용). 파서는 실응답(JSON) 검증 후 작성.
 *   사실(리서치 2026-06-05):
 *     · Perenual: base https://perenual.com/api/v2 · key 파라미터 · JSON · 무료 100건/일(캐싱 필수) · species-list / species-care-guide-list.
 *     · Trefle:   base https://trefle.io/api/v1 · token 파라미터 · JSON · 120/분 · ⚠ /search 500 에러 반복(2025) — 불안정, 폴백 권장.
 *   기존 foreignCrop.ts(GBIF 분류 + 위키 설명, 키불필요)에 '재배 상세'를 더하는 보강 seam. 영어 데이터 위주.
 *   ⚠ 확신도: 두 API 모두 base/키/JSON = HIGH · 정확한 응답 필드 매핑은 실샘플 검증 후(추측 금지).
 */
import { fetchJsonSafe } from "../geo/fetchSafe";
import { hasEnv, ShapeUnverifiedError } from "./types";

const PERENUAL = "https://perenual.com/api/v2";
const TREFLE = "https://trefle.io/api/v1";

export function perenualConfigured(): boolean { return hasEnv("PERENUAL_API_KEY"); }
export function trefleConfigured(): boolean { return hasEnv("TREFLE_TOKEN"); }
/** 둘 중 하나라도 있으면 재배상세 보강 가능. */
export function plantDetailConfigured(): boolean { return perenualConfigured() || trefleConfigured(); }

// ⚠ 보안: 아래 빌더 반환값은 key/token(비밀)을 쿼리에 포함 — 로깅·클라이언트 반환 금지. fetchSafe로만 소비(에러 삼킴).
/** Perenual 종 검색(이름 q). 무료 100/일 — 결과는 작물별 캐싱 권장. */
export function perenualSpeciesListUrl(key: string, q: string): string {
  return `${PERENUAL}/species-list?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}`;
}
/** Perenual 케어가이드(관수·일조 등) — species_id 기준. */
export function perenualCareGuideUrl(key: string, speciesId: number): string {
  return `${PERENUAL}/species-care-guide-list?key=${encodeURIComponent(key)}&species_id=${encodeURIComponent(String(speciesId))}`;
}
/** Trefle 검색(폴백·불안정). */
export function trefleSearchUrl(token: string, q: string): string {
  return `${TREFLE}/plants/search?token=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
}

/** Perenual raw JSON — '파서 작성용 샘플 캡처' 전용. 키 없으면 null. */
export async function fetchPerenualSample(q: string): Promise<unknown | null> {
  const key = process.env.PERENUAL_API_KEY || "";
  if (!key) return null;
  return fetchJsonSafe(perenualSpeciesListUrl(key, q));
}

/** 재배상세 파서 — Perenual/Trefle 필드 매핑 미검증이라 막는다(승격 시 구현·우선 Perenual). */
export function parsePlantDetail(_json: unknown): never {
  throw new ShapeUnverifiedError("plant-detail", "Perenual species-care-guide JSON 실샘플로 필드 매핑 확정 후 구현(무료 100/일 캐싱). Trefle는 불안정 폴백");
}
