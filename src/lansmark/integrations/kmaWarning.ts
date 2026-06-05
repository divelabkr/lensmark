/**
 * 기상청 기상특보 — LIVE 승격(KMA_API_KEY apihub authKey, '특보 API 활용신청' 완료 시).
 *   책임: 특보 현황/구역 URL 빌더 + EUC-KR fetch + 파서(현재 발효 특보·구역코드) + 지역 매칭.
 *   검증(2026-06-05 실캡처): wrn_now_data.php 200·EUC-KR(한글 정상)·컬럼=help=1 공식 범례 / 행포맷=typ01 공백분리(wrn_reg 실데이터로 확인).
 *     컬럼: REG_UP·REG_UP_KO·REG_ID·REG_KO·TM_FC·TM_EF·WRN(종류)·LVL(수준)·CMD·ED_TM. 값(종류·수준)은 KMA 원문 패스스루(임의 해석 안 함).
 *   ⚠ 캡처 시점 발효 특보 0건이라 '활성 데이터 행'은 미관측 — 컬럼/행포맷은 검증, 활성 표시는 발효 시 확인. 응답은 EUC-KR(UTF-8이면 한글 깨짐).
 */
import { fetchTextSafeEnc } from "../geo/fetchSafe";
import { hasEnv } from "./types";

const BASE = "https://apihub.kma.go.kr/api/typ01/url";

// ⚠ 보안: 아래 URL 빌더의 반환값은 authKey(비밀)를 쿼리에 포함한다 — 로깅·에러메시지·클라이언트 반환 금지.
//    fetchSafe(텍스트/JSON)로만 소비할 것: 그 catch는 에러를 삼켜(return null) 키-포함 TypeError를 노출하지 않는다.

/** 현재 특보 발효현황 URL(고정폭 텍스트). help=1이면 컬럼 범례 포함 → 파서 작성용 샘플 캡처에 사용. */
export function warningNowUrl(authKey: string, opts: { disp?: 0 | 1; help?: 0 | 1 } = {}): string {
  const disp = opts.disp ?? 0, help = opts.help ?? 0;
  return `${BASE}/wrn_now_data.php?disp=${disp}&help=${help}&authKey=${encodeURIComponent(authKey)}`;
}

/** 특보 구역코드 URL(특보 데이터의 구역코드 → 시도/시군 매핑용). */
export function warningRegionUrl(authKey: string): string {
  return `${BASE}/wrn_reg.php?authKey=${encodeURIComponent(authKey)}`;
}

export function kmaWarningConfigured(): boolean { return hasEnv("KMA_API_KEY"); }

/** 현재 발효 특보 1건. 종류(kind)·수준(level)은 KMA 원문 그대로(임의 해석·코드 매핑 안 함). */
export interface KmaWarning { regId: string; regKo: string; regUpKo: string; kind: string; level: string; cmd: string; effAt: string; }

// 컬럼 인덱스 — wrn_now_data.php help=1 공식 범례(검증). 행=공백분리(typ01, wrn_reg 실데이터로 확인).
const W = { REG_UP: 0, REG_UP_KO: 1, REG_ID: 2, REG_KO: 3, TM_FC: 4, TM_EF: 5, WRN: 6, LVL: 7, CMD: 8 } as const;
const REG_CODE = /^[A-Z]\d{6,8}$/; // 특보구역코드(예: L1010100) — 데이터행 식별

/** wrn_now 텍스트 → 현재 발효 특보 배열. 주석·헤더(#)·짧은 행 제외. 값 패스스루. */
export function parseWarnings(text: string): KmaWarning[] {
  const out: KmaWarning[] = [];
  for (const line of (text || "").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const t = line.trim().split(/\s+/);
    if (t.length < 9 || !REG_CODE.test(t[W.REG_ID])) continue; // 특보구역코드 있는 데이터행만
    out.push({ regId: t[W.REG_ID], regKo: t[W.REG_KO], regUpKo: t[W.REG_UP_KO], kind: t[W.WRN], level: t[W.LVL], cmd: t[W.CMD], effAt: t[W.TM_EF] });
  }
  return out;
}

/** wrn_reg 텍스트 → 특보구역코드(REG_ID) → 구역명 맵(지역 매칭 참고용). 컬럼: REG_ID TM_ST TM_ED REG_SP REG_UP REG_KO REG_NAME. */
export function parseWarningRegions(text: string): Map<string, { regKo: string; regName: string }> {
  const m = new Map<string, { regKo: string; regName: string }>();
  for (const line of (text || "").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const t = line.trim().split(/\s+/);
    if (t.length < 6 || !REG_CODE.test(t[0])) continue;
    m.set(t[0], { regKo: t[5], regName: t.slice(6).join(" ") || t[5] });
  }
  return m;
}

// 시도 전체명/구버전명 → KMA 약칭(REG_UP_KO 형식). 접미사 제거로는 충청남도→충남이 안 되므로 매핑 필수(레드팀 H — 5개 도 누락 방지).
const SIDO_ABBR: Record<string, string> = {
  "서울": "서울", "서울특별시": "서울", "부산": "부산", "부산광역시": "부산", "대구": "대구", "대구광역시": "대구",
  "인천": "인천", "인천광역시": "인천", "광주": "광주", "광주광역시": "광주", "대전": "대전", "대전광역시": "대전",
  "울산": "울산", "울산광역시": "울산", "세종": "세종", "세종특별자치시": "세종", "경기": "경기", "경기도": "경기",
  "강원": "강원", "강원도": "강원", "강원특별자치도": "강원", "충북": "충북", "충청북도": "충북", "충남": "충남", "충청남도": "충남",
  "전북": "전북", "전라북도": "전북", "전북특별자치도": "전북", "전남": "전남", "전라남도": "전남",
  "경북": "경북", "경상북도": "경북", "경남": "경남", "경상남도": "경남", "제주": "제주", "제주도": "제주", "제주특별자치도": "제주",
};

/**
 * 지역명으로 현재 발효 특보 필터.
 *   시도(전체명/약칭) → 매핑 후 상위구역(regUpKo) '정확매칭' = 그 시도 전체 특보(동명 시군 과매칭 없음·레드팀 H/M).
 *   시군 등 → 접미사 제거 후 구역명(regKo) 정확매칭(부분매칭 과매칭 회피).
 */
export function warningsForRegion(warnings: KmaWarning[], region: string | undefined): KmaWarning[] {
  const raw = (region || "").trim();
  if (!raw) return [];
  const sido = SIDO_ABBR[raw];
  if (sido) return warnings.filter((w) => w.regUpKo === sido); // 시도 전체 특보(상위구역 일치)
  const r = raw.replace(/(시|군|구)$/, "").trim();             // 시군: 접미사 제거 후 구역명 정확매칭
  return r ? warnings.filter((w) => w.regKo === r || w.regKo === raw) : [];
}

// 전국 발효현황은 분 단위 변화 → 60초 캐시(KMA 과다호출·레이트 보호). 실패는 캐시 안 함(다음 호출 재시도).
let _cache: { at: number; data: KmaWarning[] } | null = null;

/** 현재 발효 특보 조회(EUC-KR·60초 캐시). 키 없거나 미응답(활용신청 미완료=403 등) → [](seed 폴백). */
export async function fetchActiveWarnings(): Promise<KmaWarning[]> {
  const key = process.env.KMA_API_KEY || "";
  if (!key) return [];
  const now = Date.now();
  if (_cache && now - _cache.at < 60_000) return _cache.data;
  const text = await fetchTextSafeEnc(warningNowUrl(key, { disp: 0, help: 0 }), "euc-kr"); // EUC-KR(한글 정상)
  if (text == null) return []; // 실패 → 캐시하지 않음
  const data = parseWarnings(text);
  _cache = { at: now, data };
  return data;
}
