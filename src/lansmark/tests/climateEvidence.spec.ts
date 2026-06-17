import { describe, it, expect } from "vitest";
import { climateFromAsos, type AsosDailyRow } from "../geo/kma";
import { climateEvidence } from "../core/climateEvidence";

// 합성 일자료 — 연평균기온·적산온도(GDD) 계산이 실측 규칙대로인지 검증.
function row(date: string, taAvgC?: number, rainMm?: number, taMinC?: number, taMaxC?: number): AsosDailyRow {
  return { date, month: Number(date.slice(4, 6)), taAvgC, taMaxC, taMinC, rainMm, sunHr: 6 };
}

describe("climateFromAsos — 연평균기온·적산온도(GDD)", () => {
  it("연평균기온 = 일평균기온들의 평균(반올림 0.1)", () => {
    const rows = [row("20250115", 0), row("20250715", 25), row("20251015", 10)]; // 평균 (0+25+10)/3=11.67
    const c = climateFromAsos(rows);
    expect(c.annualMeanTempC).toBe(11.7);
  });

  it("GDD = 생육기(4~10월) 일평균의 base(10℃) 초과분 누적 — 그 외 월·base 미만은 0", () => {
    const rows = [
      row("20250620", 20), // +10
      row("20250621", 15), // +5
      row("20250622", 8),  // 0 (base 미만)
      row("20250115", 30), // 1월 → 생육기 아님(제외)
    ];
    const c = climateFromAsos(rows);
    expect(c.growingDegreeDays).toBe(15); // 10+5+0
  });

  it("값 없는 행이 섞여도 안전(undefined 무시)", () => {
    const rows = [row("20250620", undefined), row("20250621", 20)];
    const c = climateFromAsos(rows);
    expect(c.growingDegreeDays).toBe(10);
    expect(c.annualMeanTempC).toBe(20);
  });
});

describe("climateEvidence — 측정 사실만, 출처에 '평년값 아님' 명시", () => {
  it("측정값을 평이한 문장으로 + 출처/면책", () => {
    const ev = climateEvidence({ annualMeanTempC: 12.3, growingDegreeDays: 2840, annualRainfallMm: 1340, minWinterTempC: -8.2, frostRisk: "medium", summerMaxTempC: 33.4, sunlightLevel: "high", stationName: "전주" });
    expect(ev.facts.some((f) => f.includes("연평균기온 12.3℃"))).toBe(true);
    expect(ev.facts.some((f) => f.includes("적산온도 2840℃·일"))).toBe(true);
    expect(ev.facts.some((f) => f.includes("서리위험 보통"))).toBe(true);
    expect(ev.sourceLabel).toContain("전주 관측소");
    expect(ev.sourceLabel).toContain("평년값 아님"); // 정직성
    expect(ev.disclaimer).toContain("보장");
  });

  it("누락 항목은 생략, climate 없으면 안내", () => {
    const ev = climateEvidence({ annualMeanTempC: 11 });
    expect(ev.facts).toHaveLength(1);
    expect(climateEvidence(undefined).facts[0]).toContain("불러오지 못");
  });
});
