import type { ClimateResult } from "../data/providers/types";
import { fetchTextSafe } from "./fetchSafe";

/** 기상청 동네예보 LCC 격자 변환 (위경도 → nx,ny) */
export function latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180;
  const re = RE / GRID, slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5); sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5); ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5); ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

/** 주요 ASOS 지점(stn) — 최근접 산정용(부분 목록) */
export const ASOS_STATIONS: { stn: number; name: string; lat: number; lng: number }[] = [
  { stn: 108, name: "서울", lat: 37.5714, lng: 126.9658 }, { stn: 159, name: "부산", lat: 35.1047, lng: 129.0320 },
  { stn: 143, name: "대구", lat: 35.8780, lng: 128.6531 }, { stn: 156, name: "광주", lat: 35.1729, lng: 126.8916 },
  { stn: 133, name: "대전", lat: 36.3722, lng: 127.3719 }, { stn: 152, name: "울산", lat: 35.5820, lng: 129.3320 },
  { stn: 112, name: "인천", lat: 37.4778, lng: 126.6244 }, { stn: 131, name: "청주", lat: 36.6392, lng: 127.4407 },
  { stn: 146, name: "전주", lat: 35.8408, lng: 127.1190 }, { stn: 165, name: "목포", lat: 34.8167, lng: 126.3814 },
  { stn: 192, name: "진주", lat: 35.1636, lng: 128.0400 }, { stn: 105, name: "강릉", lat: 37.7515, lng: 128.8910 },
  { stn: 184, name: "제주", lat: 33.5141, lng: 126.5297 }, { stn: 232, name: "천안", lat: 36.7633, lng: 127.2817 },
];
export function nearestStation(lat: number, lng: number) {
  let best = ASOS_STATIONS[0], bd = Infinity;
  for (const s of ASOS_STATIONS) { const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2; if (d < bd) { bd = d; best = s; } }
  return best;
}

/** KMA API허브 ASOS 일자료 URL */
export function asosDailyUrl(stn: number, tm1: string, tm2: string, authKey: string): string {
  return `https://apihub.kma.go.kr/api/typ01/url/kma_sfcdd3.php?tm1=${tm1}&tm2=${tm2}&stn=${stn}&help=0&authKey=${authKey}`;
}

/** ASOS 일자료 1줄에서 뽑은 값(누락은 undefined). */
export interface AsosDailyRow { date: string; month: number; taAvgC?: number; taMaxC?: number; taMinC?: number; rainMm?: number; sunHr?: number; }

// 공백분리 컬럼 인덱스 — kma_sfcdd3.php(help=0) 응답 헤더 범례로 확정(실응답 검증).
//   0:YYMMDD 1:STN … 10:TA_AVG 11:TA_MAX 13:TA_MIN … 32:SS_DAY(일조시간) … 38:RN_DAY(일강수)
//   ⚠ TA_MAX=11은 표준 kma_sfcdd3 배열(TA_AVG=10·TA_MIN=13 사이) — 다음 live 캡처 때 값 재확인 권장.
const COL = { DATE: 0, TA_AVG: 10, TA_MAX: 11, TA_MIN: 13, SS_DAY: 32, RN_DAY: 38 } as const;

// 온도: 물리적 불가값(-90 이하 = -99 결측)만 제거. 실제 영하기온(-9.0℃ 등)은 보존.
const tempC = (s: string): number | undefined => { const n = Number(s); return Number.isFinite(n) && n > -90 ? n : undefined; };
// 누적량(강수·일조)은 음수가 불가 → 음수(-9 등)는 결측으로 간주.
const accum = (s: string): number | undefined => { const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : undefined; };

/** kma_sfcdd3 응답 텍스트 → 일자료 행 배열(주석·#START7777·#7777END 줄 제외). */
export function parseAsosDaily(text: string): AsosDailyRow[] {
  const rows: AsosDailyRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const t = line.trim().split(/\s+/);
    if (t.length < 39 || !/^\d{8}$/.test(t[COL.DATE])) continue; // 8자리 날짜로 시작하는 데이터행만
    rows.push({
      date: t[COL.DATE],
      month: Number(t[COL.DATE].slice(4, 6)),
      taAvgC: tempC(t[COL.TA_AVG]),
      taMaxC: tempC(t[COL.TA_MAX]),
      taMinC: tempC(t[COL.TA_MIN]),
      rainMm: accum(t[COL.RN_DAY]),
      sunHr: accum(t[COL.SS_DAY]),
    });
  }
  return rows;
}

/** 일자료 배열 → ClimateResult(겨울최저·연강수·일조수준·서리위험). */
export function climateFromAsos(rows: AsosDailyRow[]): ClimateResult {
  if (!rows.length) return { frostRisk: "unknown", sunlightLevel: "unknown" };
  const winterMin = rows.filter((r) => r.month === 12 || r.month === 1 || r.month === 2).map((r) => r.taMinC).filter((n): n is number => n != null);
  const minWinterTempC = winterMin.length ? Math.round(Math.min(...winterMin) * 10) / 10 : undefined;
  const summerMax = rows.filter((r) => r.month >= 6 && r.month <= 8).map((r) => r.taMaxC).filter((n): n is number => n != null);
  const summerMaxTempC = summerMax.length ? Math.round(Math.max(...summerMax) * 10) / 10 : undefined; // 6~8월 일최고의 최댓값(폭염기)
  const rain = rows.map((r) => r.rainMm).filter((n): n is number => n != null);
  const annualRainfallMm = rain.length ? Math.round(rain.reduce((a, b) => a + b, 0)) : undefined;
  // 연평균기온 — 일평균기온(taAvgC)의 단순 평균(실측). 작물 생육적온 맥락의 1차 근거.
  const avgT = rows.map((r) => r.taAvgC).filter((n): n is number => n != null);
  const annualMeanTempC = avgT.length ? Math.round((avgT.reduce((a, b) => a + b, 0) / avgT.length) * 10) / 10 : undefined;
  // 적산온도(GDD) — 생육기(4~10월) 일평균이 base(10℃)를 넘는 분을 누적(표준 농업기후 지표·실측). base 미만 일자는 0 기여(작물별 base 차이는 데이터 확보 후 — 지금은 통용 10℃ 고정·라벨로 명시).
  const GDD_BASE = 10;
  const growRows = rows.filter((r) => r.month >= 4 && r.month <= 10 && r.taAvgC != null);
  const growingDegreeDays = growRows.length ? Math.round(growRows.reduce((a, r) => a + Math.max(0, (r.taAvgC as number) - GDD_BASE), 0)) : undefined;
  const sun = rows.map((r) => r.sunHr).filter((n): n is number => n != null);
  const avgSun = sun.length ? sun.reduce((a, b) => a + b, 0) / sun.length : undefined;
  const sunlightLevel: ClimateResult["sunlightLevel"] = avgSun == null ? "unknown" : avgSun < 5 ? "low" : avgSun <= 6.5 ? "medium" : "high";
  // 서리위험: 겨울 최저기온 심도 기반 파생 지표(작물별 내한성과는 별개의 일반 신호).
  const frostRisk: ClimateResult["frostRisk"] = minWinterTempC == null ? "unknown" : minWinterTempC <= -15 ? "high" : minWinterTempC <= -8 ? "medium" : "low";
  return { annualRainfallMm, annualMeanTempC, growingDegreeDays, minWinterTempC, summerMaxTempC, frostRisk, sunlightLevel };
}

/** 좌표 → 기후. 최근접 ASOS 지점의 최근 1년 일자료를 조회·집계(실응답 형식 검증 완료). */
export async function fetchClimate(lat: number, lng: number, authKey: string): Promise<ClimateResult> {
  if (!authKey) throw new Error("KMA_API_KEY 필요.");
  const st = nearestStation(lat, lng);
  const end = new Date(), start = new Date(end.getTime() - 365 * 86400000); // 겨울 포함 1년
  const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const text = await fetchTextSafe(asosDailyUrl(st.stn, ymd(start), ymd(end), authKey)); // 타임아웃·비2xx → null
  if (text == null) return { frostRisk: "unknown", sunlightLevel: "unknown" };           // 실패 → auto가 mock 폴백
  const rows = parseAsosDaily(text);
  if (rows.length < 60) return { frostRisk: "unknown", sunlightLevel: "unknown" };        // 표본 부족(부분/단기 응답) → 폴백(레드팀 M5)
  // 정직성: 실제 관측 데이터 기간(rows 날짜 min~max)을 asOf로 — '최근 1년'이 구체적으로 언제~언제인지 명시(평년값 아님).
  const ds = rows.map((r) => r.date).filter((d) => /^\d{8}$/.test(d)).sort();
  const isoOf = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const asOf = ds.length ? `${isoOf(ds[0])}~${isoOf(ds[ds.length - 1])}` : undefined;
  return { ...climateFromAsos(rows), stationName: st.name, asOf }; // 출처 관측소명·관측기간 부착(근거 정직성)
}
