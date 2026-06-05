/**
 * 시도(광역) 평년기후 시드 — 작물→지역 적합 판정용.
 *   ⚠ 데이터 정직성(CLAUDE.md #4): 아래 연강수·겨울최저·일조는 **근사 평년값(데모)**이다.
 *      상대 패턴(제주·남해안 온화 / 강원·내륙 한랭 / 대구 소우)은 일반적 사실이나, 정확 평년값은 KMA 평년자료로 검수 필요.
 *      ★ live-upgrade seam: KMA 평년값(1991–2020) 또는 지점 격자로 교체(키 보유). 그때까지 '참고'.
 *   lat/lng = 시도 대표 중심(지도 마커용). sunlightLevel은 ClimateResult 형식(low/medium/high).
 */
export interface SidoClimate {
  sido: string;
  annualRainfallMm: number;   // 연강수(근사 평년)
  minWinterTempC: number;     // 겨울 최저(근사, 1월 평균최저 수준)
  summerMaxTempC: number;     // 여름 최고(근사, 폭염기 일최고 수준) — 고온 스트레스·온난화 평가용(데모)
  sunlightLevel: "low" | "medium" | "high";
  lat: number;                // 대표 중심(마커)
  lng: number;
}

export const SIDO_CLIMATE: SidoClimate[] = [
  { sido: "제주",   annualRainfallMm: 1500, minWinterTempC: 2,   summerMaxTempC: 31, sunlightLevel: "medium", lat: 33.38, lng: 126.55 },
  { sido: "경남",   annualRainfallMm: 1500, minWinterTempC: -4,  summerMaxTempC: 32, sunlightLevel: "high",   lat: 35.30, lng: 128.20 },
  { sido: "전남",   annualRainfallMm: 1400, minWinterTempC: -4,  summerMaxTempC: 32, sunlightLevel: "medium", lat: 34.80, lng: 126.90 },
  { sido: "부산",   annualRainfallMm: 1500, minWinterTempC: 0,   summerMaxTempC: 30, sunlightLevel: "medium", lat: 35.10, lng: 129.05 },
  { sido: "울산",   annualRainfallMm: 1300, minWinterTempC: -3,  summerMaxTempC: 32, sunlightLevel: "medium", lat: 35.55, lng: 129.30 },
  { sido: "전북",   annualRainfallMm: 1300, minWinterTempC: -6,  summerMaxTempC: 32, sunlightLevel: "medium", lat: 35.70, lng: 127.10 },
  { sido: "광주",   annualRainfallMm: 1350, minWinterTempC: -5,  summerMaxTempC: 33, sunlightLevel: "medium", lat: 35.15, lng: 126.90 },
  { sido: "경북",   annualRainfallMm: 1100, minWinterTempC: -7,  summerMaxTempC: 33, sunlightLevel: "high",   lat: 36.30, lng: 128.80 },
  { sido: "대구",   annualRainfallMm: 1050, minWinterTempC: -5,  summerMaxTempC: 34, sunlightLevel: "high",   lat: 35.85, lng: 128.60 },
  { sido: "충남",   annualRainfallMm: 1250, minWinterTempC: -8,  summerMaxTempC: 31, sunlightLevel: "medium", lat: 36.60, lng: 126.80 },
  { sido: "대전",   annualRainfallMm: 1400, minWinterTempC: -8,  summerMaxTempC: 32, sunlightLevel: "medium", lat: 36.35, lng: 127.40 },
  { sido: "세종",   annualRainfallMm: 1250, minWinterTempC: -9,  summerMaxTempC: 32, sunlightLevel: "medium", lat: 36.50, lng: 127.25 },
  { sido: "충북",   annualRainfallMm: 1200, minWinterTempC: -9,  summerMaxTempC: 32, sunlightLevel: "medium", lat: 36.80, lng: 127.70 },
  { sido: "경기",   annualRainfallMm: 1300, minWinterTempC: -10, summerMaxTempC: 31, sunlightLevel: "medium", lat: 37.40, lng: 127.50 },
  { sido: "인천",   annualRainfallMm: 1200, minWinterTempC: -8,  summerMaxTempC: 30, sunlightLevel: "medium", lat: 37.45, lng: 126.70 },
  { sido: "서울",   annualRainfallMm: 1400, minWinterTempC: -9,  summerMaxTempC: 31, sunlightLevel: "low",    lat: 37.55, lng: 126.98 },
  { sido: "강원",   annualRainfallMm: 1300, minWinterTempC: -12, summerMaxTempC: 30, sunlightLevel: "high",   lat: 37.80, lng: 128.20 },
];
