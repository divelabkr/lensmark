/**
 * 일일 예보 provider 검증 — 파서 형태가드(부분 오염 거부)·mock 결정성·데모 라벨 정직성.
 */
import { describe, it, expect } from "vitest";
import { parseOpenMeteoDaily, mockDailyForecast } from "../data/providers/forecast";

const ASOF = "2026-07-01T00:00:00Z";
/** 정상 Open-Meteo daily 응답 골격(2일치). */
const okBody = () => ({
  daily: {
    time: ["2026-07-01", "2026-07-02"],
    temperature_2m_min: [21.5, 22.0],
    temperature_2m_max: [30.1, 31.4],
    precipitation_sum: [0, 12.5],
    precipitation_probability_max: [10, 80],
    wind_speed_10m_max: [4.2, 9.9],
  },
});

describe("parseOpenMeteoDaily(형태 가드)", () => {
  it("정상 응답 → 일자·기온·강수·확률·풍속 매핑", () => {
    const f = parseOpenMeteoDaily(okBody(), ASOF);
    expect(f).not.toBeNull();
    expect(f!.days).toHaveLength(2);
    expect(f!.days[0]).toMatchObject({ date: "2026-07-01", minC: 21.5, maxC: 30.1, rainMm: 0, rainProbPct: 10, windMaxMs: 4.2 });
    expect(f!.source).toContain("Open-Meteo"); // live 라벨(데모 아님)
    expect(f!.asOf).toBe(ASOF);
  });
  it("선택 축(확률·풍속) 없어도 채택 — 필수 축만으로 동작", () => {
    const b = okBody() as { daily: Record<string, unknown> };
    delete b.daily.precipitation_probability_max;
    delete b.daily.wind_speed_10m_max;
    const f = parseOpenMeteoDaily(b, ASOF);
    expect(f).not.toBeNull();
    expect(f!.days[0].rainProbPct).toBeUndefined();
  });
  it("배열 길이 불일치 → null(부분 오염 거부)", () => {
    const b = okBody();
    b.daily.temperature_2m_min = [21.5]; // 2일치 time에 1일치 기온
    expect(parseOpenMeteoDaily(b, ASOF)).toBeNull();
  });
  it("필수 수치에 NaN/문자 → null(오염 예보로 위험 매칭 오도 차단)", () => {
    const b = okBody() as { daily: Record<string, unknown[]> };
    b.daily.precipitation_sum = [0, "많음"];
    expect(parseOpenMeteoDaily(b, ASOF)).toBeNull();
  });
  it("daily 없음/비객체 → null", () => {
    expect(parseOpenMeteoDaily(null, ASOF)).toBeNull();
    expect(parseOpenMeteoDaily({}, ASOF)).toBeNull();
  });
});

describe("mockDailyForecast(결정성·정직성)", () => {
  it("같은 입력 → 같은 출력(결정적) · 7일 · 데모 라벨", () => {
    const a = mockDailyForecast(35.1, 127.2, "2026-07-01");
    const b = mockDailyForecast(35.1, 127.2, "2026-07-01");
    expect(a).toEqual(b);
    expect(a.days).toHaveLength(7);
    expect(a.source).toContain("mock"); // 데모 라벨(실측 호도 금지)
    expect(a.days[0].date).toBe("2026-07-01");
    expect(a.days[6].date).toBe("2026-07-07");
  });
  it("min ≤ max · 강수 0↑ (물리적 sanity)", () => {
    const f = mockDailyForecast(37.5, 128.9, "2026-01-15");
    for (const d of f.days) {
      expect(d.minC).toBeLessThanOrEqual(d.maxC);
      expect(d.rainMm).toBeGreaterThanOrEqual(0);
    }
  });
});
