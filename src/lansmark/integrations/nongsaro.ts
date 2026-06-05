/**
 * 농사로(농진청 농업기술포털) OpenAPI seam(HUMAN GATE) — '국내 작물' 재배정보(재배시기·관수·품종·병해충).
 *   책임: REST URL 빌더 + 키게이트 raw fetch(샘플 캡처용). 파서는 serviceName·출력필드 확정 후 작성(추측 금지).
 *   사실(리서치 2026-06-05·HTTP 실측):
 *     · base http://api.nongsaro.go.kr/service/{serviceName}/{operationName} — /service/garden/lightList → HTTP 200 XML 확인.
 *     · 키 apiKey(미등록 시 resultCode=11 "인증키가 등록되지 않았습니다") · apiType=xml(기본)|json · 무료 · 서버사이드 REST 직접호출 권장.
 *     · 재배법 제공(HIGH): 품목별 관리메뉴얼(재배 시기·방법) · 텃밭작물 재배캘린더(생육단계별 관수량) 등.
 *   용도: 국내 재배가이드(cultivationGuide)를 '룰북 데모 → 실 RDA 데이터'로 격상하는 seam. ⚠ 국내 작물 한정(외래작물은 Perenual seam).
 *   ⚠ 확신도: base·apiKey·XML/JSON = HIGH(실측) · 텃밭/품종 serviceName 문자열·출력필드·일 호출한도 = UNCERTAIN
 *           → 발급 후 서비스목록(133종) REST 샘플로 serviceName·필드 확정 뒤 parseNongsaro 구현.
 */
import { fetchTextSafe } from "../geo/fetchSafe";
import { hasEnv, ShapeUnverifiedError } from "./types";

const BASE = "http://api.nongsaro.go.kr/service"; // ⚠ http(비암호화) 예시 — 운영 https 가능 여부 확인 권장

// ⚠ 보안: ngsUrl 반환값은 apiKey(비밀)를 쿼리에 포함 — 로깅·클라이언트 반환 금지. fetchSafe로만 소비(에러 삼킴).

export function nongsaroConfigured(): boolean { return hasEnv("NONGSARO_API_KEY"); }

/**
 * 농사로 REST URL. serviceName/operationName은 발급 후 '서비스 목록'에서 확정(실측 예: garden/lightList).
 *   키는 호출측이 명시(테스트 용이·kma.ts 패턴). apiType 기본 xml(json도 가능).
 */
export function ngsUrl(apiKey: string, serviceName: string, operationName: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ apiKey, apiType: "xml", ...params }).toString();
  return `${BASE}/${encodeURIComponent(serviceName)}/${encodeURIComponent(operationName)}?${q}`;
}

/** raw 텍스트(XML) — '파서 작성용 샘플 캡처' 전용. 키 없으면 null. */
export async function fetchNongsaroSample(serviceName: string, operationName: string, params: Record<string, string> = {}): Promise<string | null> {
  const key = process.env.NONGSARO_API_KEY || "";
  if (!key) return null;
  return fetchTextSafe(ngsUrl(key, serviceName, operationName, params));
}

/** 농사로 XML 파서 — serviceName별 출력필드 미확정이라 막는다(승격 시 구현). */
export function parseNongsaro(_xml: string): never {
  throw new ShapeUnverifiedError("nongsaro", "serviceName/operationName(133종)·출력필드를 발급 후 REST 샘플로 확정 후 구현 · resultCode=11=인증키 미등록");
}
