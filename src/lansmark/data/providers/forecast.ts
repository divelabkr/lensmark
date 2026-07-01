/**
 * 일일 예보 provider — Open-Meteo Forecast API(무료·무키)로 필지 좌표의 7일 일별 예보를 가져온다.
 *   왜: 데일리 브리핑("오늘 내 농장에 무슨 일이") 의 핵심 축. 기존 ClimateResult는 '연/계절 요약'이라
 *       "오늘/내일" 질문에 답하지 못한다 → 일별 최저/최고·강수·강풍을 위치별 실데이터로 공급.
 *   정직성(CLAUDE.md #4): live 실패/형태 불일치 시 mock 폴백하되 source에 'mock' 명시(브리핑이 데모 라벨 분기).
 *   ⚠ SHAPE_UNVERIFIED(2026-07-01): 파서는 공식 docs 스키마 기준 — 개발 컨테이너 네트워크 차단으로 라이브 실응답 미검증.
 *     배포 환경에서 첫 호출 확인 후 이 라벨 제거. 어긋나도 형태가드→mock 폴백+runtimeHealth 'fallback' 기록(조용한 오염 없음).
 *   ⚠ Open-Meteo 무료티어=비상업 — 유료 전환 시 KMA 단기예보(동네예보) 등으로 교체(반환형 동일·seam).
 */
import { fetchJsonSafe } from "../../geo/fetchSafe";
import { cached } from "./cache";
import { recordProvider } from "./runtimeHealth";

/** 하루치 예보 — 브리핑 위험 매칭(서리·폭염·호우·강풍·건조)의 입력 축. */
export interface DailyForecastDay {
  date: string;        // "yyyy-mm-dd"(Asia/Seoul 기준)
  minC: number;        // 일 최저기온(℃)
  maxC: number;        // 일 최고기온(℃)
  rainMm: number;      // 일 강수량 합(mm)
  rainProbPct?: number; // 강수확률 최대(%) — 응답에 없으면 미표기
  windMaxMs?: number;  // 일 최대풍속(m/s) — 도복·낙과 위험 축
}
export interface DailyForecast {
  days: DailyForecastDay[]; // 오늘부터 7일(응답 순서 그대로)
  source: string;           // "Open-Meteo 예보(실데이터)" | "mock-forecast(데모)"
  asOf: string;             // 조회 시각(ISO) — '언제 기준 예보'인지 정직 표기
}

const fin = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Open-Meteo daily 응답 → DailyForecast. 순수 함수(테스트 가능).
 *   형태 가드: 배열 길이 일치·필수 수치 유한성 — 어긋나면 null(조용한 오염 차단 → 호출측 mock 폴백).
 */
export function parseOpenMeteoDaily(j: unknown, asOf: string): DailyForecast | null {
  const d = (j as { daily?: Record<string, unknown> } | null)?.daily;
  if (!d) return null;
  const time = d.time, tmin = d.temperature_2m_min, tmax = d.temperature_2m_max, rain = d.precipitation_sum;
  const prob = d.precipitation_probability_max, wind = d.wind_speed_10m_max; // 선택 축(없어도 채택)
  if (!Array.isArray(time) || !Array.isArray(tmin) || !Array.isArray(tmax) || !Array.isArray(rain)) return null;
  const n = time.length;
  if (n < 1 || tmin.length !== n || tmax.length !== n || rain.length !== n) return null;
  const days: DailyForecastDay[] = [];
  for (let i = 0; i < n; i++) {
    // 필수 축(기온·강수)이 하나라도 비정상이면 전체 거부 — 부분 오염 예보로 위험 매칭을 오도하지 않는다.
    if (typeof time[i] !== "string" || !fin(tmin[i]) || !fin(tmax[i]) || !fin(rain[i])) return null;
    const day: DailyForecastDay = { date: time[i] as string, minC: tmin[i] as number, maxC: tmax[i] as number, rainMm: rain[i] as number };
    if (Array.isArray(prob) && fin(prob[i])) day.rainProbPct = prob[i] as number;
    if (Array.isArray(wind) && fin(wind[i])) day.windMaxMs = wind[i] as number;
    days.push(day);
  }
  return { days, source: "Open-Meteo 예보(실데이터)", asOf };
}

/** 키 없이 동작하는 결정적 mock 예보 — 좌표·시작일 시드(월별 계절성 반영). 데모 라벨 필수. */
export function mockDailyForecast(lat: number, lng: number, startIso: string): DailyForecast {
  const start = new Date(startIso + "T00:00:00Z");
  const month = start.getUTCMonth() + 1;
  // 월별 대략적 계절 기온(한반도 근사) — 데모 시각화용이며 실측이 아님을 source로 명시.
  const seasonalMax = [3, 6, 12, 19, 24, 27, 30, 31, 27, 21, 13, 5][month - 1];
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233));
  const days: DailyForecastDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const wob = Math.sin(seed * 10 + i * 1.3) * 3; // 일별 요동(결정적)
    days.push({
      date: d.toISOString().slice(0, 10),
      minC: Math.round((seasonalMax - 9 + wob) * 10) / 10,
      maxC: Math.round((seasonalMax + wob) * 10) / 10,
      rainMm: Math.max(0, Math.round(Math.sin(seed * 20 + i * 2.1) * 12 * 10) / 10),
      rainProbPct: Math.round(Math.abs(Math.sin(seed * 30 + i)) * 70),
      windMaxMs: Math.round((3 + Math.abs(Math.sin(seed * 40 + i)) * 5) * 10) / 10,
    });
  }
  return { days, source: "mock-forecast(데모)", asOf: startIso };
}

/** live 조회(비캐시) — 실패·형태 불일치는 null(호출측 폴백). */
async function fetchLive(lat: number, lng: number): Promise<DailyForecast | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&wind_speed_unit=ms&timezone=Asia%2FSeoul&forecast_days=7`;
  const j = await fetchJsonSafe(url); // 타임아웃·비2xx·비JSON → null
  return parseOpenMeteoDaily(j, new Date().toISOString());
}

// 30분 TTL·~1km 격자 캐시 — 같은 필지/이웃의 반복 브리핑이 외부 호출을 재사용(쿼터·체감 보호).
const cachedLive = cached(fetchLive, { ttlMs: 30 * 60 * 1000, key: (lat, lng) => `${lat.toFixed(2)},${lng.toFixed(2)}`, cap: 500 });

/**
 * 일일 예보 — 무키라 항상 live 시도(vworldDem과 동일 정책), 실패 시 mock 폴백(무중단·데모 라벨).
 *   LANSMARK_DATA_MODE=mock이면 외부호출 없이 곧장 mock(테스트·오프라인 결정성).
 */
export async function getDailyForecast(lat: number, lng: number): Promise<DailyForecast> {
  const mode = (process.env.LANSMARK_DATA_MODE ?? "auto").toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  if (mode === "mock") return mockDailyForecast(lat, lng, today);
  try {
    const live = await cachedLive(lat, lng);
    if (live && live.days.length >= 1) { recordProvider("openMeteoForecast", "live", Date.now()); return live; }
  } catch { /* 폴백 */ }
  recordProvider("openMeteoForecast", "fallback"); // 조용한 폴백을 런타임 건강에 기록(거짓 녹색 차단)
  return mockDailyForecast(lat, lng, today);
}
