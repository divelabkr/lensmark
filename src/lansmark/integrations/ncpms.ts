/**
 * NCPMS(농진청 국가농작물병해충관리시스템) 병해충 예찰/발생 seam(HUMAN GATE).
 *   책임: npmsAPI service URL 빌더 + 키게이트 raw fetch(샘플 캡처용). 파서는 실응답(XML) 검증 후 작성(추측 금지).
 *   사실(리서치 2026-06-05): base http://ncpms.rda.go.kr/npmsAPI/service · 파라미터 apiKey·serviceCode · 응답 XML · 무료.
 *           키 경로 2가지: (A) NCPMS 자체 apiKey  (B) data.go.kr serviceKey — 서로 다름, 하나만 선택.
 *           용어: '병해충 발생정보'(기상기반 예측·발생위험) vs '병해충 예찰정보'(현장 전문가 조사) = 서로 다른 데이터셋.
 *   ⚠ 확신도: base·apiKey·XML·무료·SVC05(병해충 상세) = HIGH · 발생/예찰 전용 serviceCode(SVC01/08 등) = UNCERTAIN
 *           → NCPMS OpenAPI 안내(JS 렌더링)에서 코드표 확인 후 확정. http 예시이므로 운영 https 가능 여부도 확인.
 */
import { fetchTextSafe, fetchJsonSafe } from "../geo/fetchSafe";
import { hasEnv, ShapeUnverifiedError } from "./types";

const BASE = "https://ncpms.rda.go.kr/npmsAPI/service"; // https 실증(2026-06: 동일 JSON·사과 33건) — apiKey 평문 쿼리 전송 제거(P2 B#3)

/** 검증된 serviceCode(라이브 실증 2026-06). SVC01=작물명 병해충 검색(목록·JSON). SVC05=상세(XML). */
export const SERVICE_CODE = { PEST_LIST: "SVC01", PEST_DETAIL: "SVC05" } as const;

/** 작물 1종의 병해충 1건(검색 목록). 이미지(thumbImg)는 http라 https 페이지에서 mixed-content 차단 → 이름 위주. */
export interface NcpmsPest { nameKor: string; cropName?: string; cropCode?: string; }

/** SVC01 JSON({service:{list:[...]}}) → 병해충 이름 목록. 순수(테스트). 형태 불일치는 [](무중단). */
export function parseNcpmsPestList(json: unknown, limit = 10): NcpmsPest[] {
  const list = (json as { service?: { list?: unknown } } | null)?.service?.list;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: NcpmsPest[] = [];
  for (const it of list as Record<string, unknown>[]) {
    const nameKor = String(it.sickNameKor ?? "").trim().slice(0, 60);
    if (!nameKor || seen.has(nameKor)) continue; // 중복 병해충명 제거
    seen.add(nameKor);
    out.push({ nameKor, cropName: it.cropName ? String(it.cropName).slice(0, 30) : undefined, cropCode: it.cropCode ? String(it.cropCode).slice(0, 20) : undefined });
    if (out.length >= limit) break;
  }
  return out;
}

/** 작물(한글명) → 주요 병해충 목록(농진청 NCPMS SVC01·실데이터). 키 없거나 미매칭 작물은 [](무중단). */
export async function fetchNcpmsPests(cropNameKo: string, limit = 10): Promise<NcpmsPest[]> {
  const key = process.env.NCPMS_API_KEY || "";
  if (!key || !cropNameKo) return [];
  const j = await fetchJsonSafe(ncpmsUrl(key, SERVICE_CODE.PEST_LIST, { cropName: cropNameKo, displayCount: String(Math.min(limit, 30)) }));
  return parseNcpmsPestList(j, limit);
}

export function ncpmsConfigured(): boolean { return hasEnv("NCPMS_API_KEY"); }

// ⚠ 보안: ncpmsUrl 반환값은 apiKey(비밀)를 쿼리에 포함 — 로깅·클라이언트 반환 금지. fetchSafe로만 소비(에러 삼킴).

/** NCPMS service URL. serviceCode + 상세키 등 파라미터 부착. 키는 호출측이 명시(테스트 용이·kma.ts 패턴). */
export function ncpmsUrl(apiKey: string, serviceCode: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ apiKey, serviceCode, ...params }).toString();
  return `${BASE}?${q}`;
}

/** raw XML 텍스트 — '파서 작성용 샘플 캡처' 전용. 키 없으면 null. */
export async function fetchNcpmsSample(serviceCode: string, params: Record<string, string> = {}): Promise<string | null> {
  const key = process.env.NCPMS_API_KEY || "";
  if (!key) return null;
  return fetchTextSafe(ncpmsUrl(key, serviceCode, params));
}

/** NCPMS XML 파서 — serviceCode별 스키마 미검증이라 막는다(승격 시 구현). */
export function parseNcpms(_xml: string): never {
  throw new ShapeUnverifiedError("ncpms", "XML 응답 — serviceCode별(SVC05 검증 / 발생·예찰 코드 UNCERTAIN) 실샘플로 스키마 확정 후 구현");
}
