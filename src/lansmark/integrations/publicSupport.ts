/**
 * 공공데이터포털(data.go.kr) 농업 지원금/보조금 seam(HUMAN GATE).
 *   책임: serviceKey 부착 헬퍼 + 키게이트 raw fetch(샘플 캡처용). 파서는 실응답 검증 후 작성(추측 금지).
 *   사실(리서치 2026-06-05):
 *     · 개인 농장주 셀프서비스엔 '보조금24/공공서비스 혜택 정보'(data.go.kr 15113968)가 최적 — serviceKey · JSON+XML · 무료 · 자동승인.
 *     · ⚠ 보조금24는 전 부처 혜택 포함(농업 전용 아님) → 분야/키워드 농업 필터링 필요.
 *     · AgriX(농림사업정보)는 수혜이력까지 주지만 '지자체→농정원 심의 승인'이라 개인 즉시발급 불가(기관/사업자용).
 *     · 농식품부 보조금 상당수는 파일데이터(CSV/엑셀)라 실시간 OpenAPI 아님.
 *   ⚠ 확신도: serviceKey·JSON+XML·무료·자동승인 = HIGH · 정확한 오퍼레이션명·엔드포인트 경로 = UNCERTAIN
 *           → 그래서 base URL을 '날조하지 않고', 호출측이 명세서의 전체 endpoint를 넘기면 serviceKey만 부착한다.
 */
import { fetchJsonSafe } from "../geo/fetchSafe";
import { hasEnv, ShapeUnverifiedError } from "./types";

/** 참고 데이터셋(보조금24/공공서비스 혜택 정보) — 오퍼레이션 경로는 이 페이지 '참고문서'에서 확정. */
export const DATASET_URL = "https://www.data.go.kr/data/15113968/openapi.do";

export function publicSupportConfigured(): boolean { return hasEnv("DATA_GO_KR_SERVICE_KEY"); }

/**
 * data.go.kr 엔드포인트에 serviceKey + returnType(JSON) 부착.
 *   ⚠ endpoint(오퍼레이션 전체 URL)는 UNCERTAIN이라 base를 추측하지 않고 호출측이 명세서대로 넘긴다.
 *   ⚠ 보안: 반환값은 serviceKey(비밀)를 쿼리에 포함 — 로깅·클라이언트 반환 금지. fetchSafe로만 소비(에러 삼킴).
 */
export function withServiceKey(endpoint: string, serviceKey: string, params: Record<string, string> = {}): string {
  const u = new URL(endpoint); // 잘못된 endpoint면 throw → 호출측이 명세서 경로를 정확히 넣게 강제
  u.searchParams.set("serviceKey", serviceKey);
  u.searchParams.set("returnType", "JSON");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/** raw JSON — '파서 작성용 샘플 캡처' 전용. 키 없거나 endpoint 미지정이면 null. */
export async function fetchSupportSample(endpoint: string, params: Record<string, string> = {}): Promise<unknown | null> {
  const key = process.env.DATA_GO_KR_SERVICE_KEY || "";
  if (!key || !endpoint) return null;
  try { return await fetchJsonSafe(withServiceKey(endpoint, key, params)); }
  catch { return null; } // endpoint 형식 오류 등
}

/** 지원금 파서 — 오퍼레이션/필드 미검증이라 막는다(승격 시 구현·농업 필터 포함). */
export function parsePublicSupport(_json: unknown): never {
  throw new ShapeUnverifiedError("public-support", "보조금24(data.go.kr 15113968) 오퍼레이션/필드 UNCERTAIN — 명세서·실샘플로 확정 후 구현(전부처 포함→농업 필터 필요)");
}
