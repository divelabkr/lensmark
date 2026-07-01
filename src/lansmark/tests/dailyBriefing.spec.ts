/**
 * 데일리 브리핑 검증 — 위험 매칭(서리·폭염·호우·강풍·건조)·단계·체크리스트·정직성(데모 라벨·mock 시세 거부).
 */
import { describe, it, expect } from "vitest";
import { buildDailyBriefing, type BriefingFarm } from "../briefing/dailyBriefing";
import type { DailyForecast, DailyForecastDay } from "../data/providers/forecast";

const FARM: BriefingFarm = { journalId: "j1", cropId: "apple", region: "전북 장수군", plantedAt: "2026-04-01" };
/** 예보 골격 — 기본은 온화(위험 0), 테스트가 일부 일자를 덮어쓴다. */
function fc(over: Partial<DailyForecastDay>[], source = "Open-Meteo 예보(실데이터)"): DailyForecast {
  const days: DailyForecastDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = `2026-07-${String(i + 1).padStart(2, "0")}`;
    days.push({ date, minC: 18, maxC: 26, rainMm: 6, windMaxMs: 4, ...(over[i] ?? {}) });
  }
  return { days, source, asOf: "2026-07-01T00:00:00Z" };
}
const T = "2026-07-01";

describe("buildDailyBriefing — 위험 매칭(룰북 임계)", () => {
  it("서리: 최저 0℃ 이하 + 서리 민감(high) → warn, 체크리스트에 대응 포함", () => {
    const b = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([{ minC: -1 }]) });
    const frost = b.risks.find((r) => r.axis === "frost");
    expect(frost?.severity).toBe("warn"); // apple frostSensitivity=high
    expect(b.checklist.join(" ")).toContain("보온");
  });
  it("폭염: 내서성 low(apple)는 30℃부터 watch·33℃ warn", () => {
    const watch = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([{ maxC: 31 }]) });
    expect(watch.risks.find((r) => r.axis === "heat")?.severity).toBe("watch");
    const warn = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([{ maxC: 34 }]) });
    expect(warn.risks.find((r) => r.axis === "heat")?.severity).toBe("warn");
  });
  it("호우·강풍: 80mm/14m/s → warn", () => {
    const b = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([{ rainMm: 90, windMaxMs: 15 }]) });
    expect(b.risks.find((r) => r.axis === "rain")?.severity).toBe("warn");
    expect(b.risks.find((r) => r.axis === "wind")?.severity).toBe("warn");
  });
  it("위험은 오늘~모레(3일)만 — 4일째 서리는 미포함", () => {
    const b = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([{}, {}, {}, { minC: -3 }]) });
    expect(b.risks.find((r) => r.axis === "frost")).toBeUndefined();
  });
  it("같은 축 여러 날 → 가장 심한 1건으로 압축", () => {
    const b = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([{ minC: 2 }, { minC: -2 }]) });
    const frosts = b.risks.filter((r) => r.axis === "frost");
    expect(frosts).toHaveLength(1);
    expect(frosts[0].severity).toBe("warn"); // 둘째 날(-2℃)이 대표
  });
  it("건조: 물 요구 high 작물 + 주간 강수 5mm 미만 → watch (napa_cabbage)", () => {
    const dryDays = Array.from({ length: 7 }, () => ({ rainMm: 0 }));
    const b = buildDailyBriefing({ journalId: "j2", cropId: "napa_cabbage" }, { todayIso: T, forecast: fc(dryDays) });
    expect(b.risks.find((r) => r.axis === "dry")?.severity).toBe("watch");
    // 물 요구 medium(apple)은 건조 축 미발동
    const a = buildDailyBriefing(FARM, { todayIso: T, forecast: fc(dryDays) });
    expect(a.risks.find((r) => r.axis === "dry")).toBeUndefined();
  });
});

describe("buildDailyBriefing — 단계·시세·정직성", () => {
  it("생육 단계·수확월·정식 후 경과일", () => {
    const b = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([]) });
    expect(b.stage.month).toBe(7);
    expect(b.stage.harvestMonths.length).toBeGreaterThan(0); // apple 수확월 존재(캘린더 룰북)
    expect(b.stage.daysSincePlanting).toBe(91); // 4/1 → 7/1
  });
  it("예보 실패(null) → today null·위험 0·체크리스트는 기본 항목", () => {
    const b = buildDailyBriefing(FARM, { todayIso: "2026-01-15", forecast: null });
    expect(b.today).toBeNull();
    expect(b.risks).toHaveLength(0);
    expect(b.checklist.length).toBeGreaterThan(0); // 빈 브리핑 금지(기본 액션)
  });
  it("mock 예보 → demo=true (데모 라벨 강제)", () => {
    const b = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([], "mock-forecast(데모)") });
    expect(b.demo).toBe(true);
  });
  it("시세: 유효 p50만 채택, 0/비유한은 null(오염 앵커 거부)", () => {
    const ok = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([]), price: { priceKrwPerKg: { p10: 1000, p50: 2500, p90: 4000 }, source: "KAMIS", asOf: "~2026-07-01" } });
    expect(ok.market?.p50KrwPerKg).toBe(2500);
    const bad = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([]), price: { priceKrwPerKg: { p10: 0, p50: 0, p90: 0 }, source: "KAMIS" } });
    expect(bad.market).toBeNull();
  });
  it("KMA 특보 → 요약문 합류 + 출처 표기", () => {
    const w = [{ regId: "L1", regKo: "전주", regUpKo: "전북", kind: "폭염", level: "경보", cmd: "발표", effAt: "2026-07-01" }];
    const b = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([]), weatherWarnings: w });
    expect(b.warnings[0]).toContain("전주 폭염 경보");
    expect(b.sources.join(" ")).toContain("KMA 기상특보");
  });
  it("면책·출처 항상 동반(가드레일)", () => {
    const b = buildDailyBriefing(FARM, { todayIso: T, forecast: fc([]) });
    expect(b.disclaimer).toContain("보장");
    expect(b.sources.length).toBeGreaterThan(0);
  });
});
