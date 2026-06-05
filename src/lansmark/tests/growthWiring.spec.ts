import { describe, it, expect } from "vitest";
import { buildGrowthCalendar } from "../core/calendar";
import { buildGrowthRiskInfo } from "../core/growthRisk";
import type { SimulationInput } from "../types";

// /api/simulate가 result에 합쳐 내보내는 growth = { calendar, risk } 계약을
// 프론트 growthCard가 의존하므로 그 형태를 고정한다(생육·출하 흐름 배선).
const input = (cropId: string, drainage?: SimulationInput["land"]["drainage"]): SimulationInput => ({
  land: { areaM2: 3300, drainage }, cropId, cultivationType: "open_field", salesChannel: "mixed",
});

describe("생육·출하 배선 contract (calendar + risk)", () => {
  it("buildGrowthCalendar: 12개월 + 유효 stage + 수확월 존재", () => {
    for (const crop of ["garlic", "sweet_potato", "blueberry"]) {
      const cal = buildGrowthCalendar(crop);
      expect(cal.cropId).toBe(crop);
      expect(cal.months).toHaveLength(12);
      for (const m of cal.months) {
        expect(m.month).toBeGreaterThanOrEqual(1);
        expect(m.month).toBeLessThanOrEqual(12);
        expect(["idle", "sow", "growth", "bloom", "harvest"]).toContain(m.stage);
      }
      // 출하 타이밍 소스: 수확월이 최소 1개
      expect(cal.months.filter((m) => m.stage === "harvest").length).toBeGreaterThan(0);
    }
  });

  it("마늘: 가을 파종→이듬해 수확 note + 6월 수확(출하 적기)", () => {
    const cal = buildGrowthCalendar("garlic");
    expect(cal.months.find((m) => m.month === 6)?.stage).toBe("harvest");
    expect(cal.note ?? "").toMatch(/수확/);
  });

  it("buildGrowthRiskInfo: 4개 리스크 배열 + 배수 불량 시 재난리스크", () => {
    const r = buildGrowthRiskInfo(input("blueberry"));
    for (const k of ["weatherRisks", "pestRisks", "disasterRisks", "nextActions"] as const) {
      expect(Array.isArray(r[k])).toBe(true);
      expect(r[k].length).toBeGreaterThan(0);
    }
    expect(buildGrowthRiskInfo(input("blueberry", "poor")).disasterRisks.join()).toMatch(/물고임|호우/);
  });

  it("월별 frostRisk 필드는 boolean|undefined 계약을 지킴", () => {
    const cal = buildGrowthCalendar("apple");
    for (const m of cal.months) expect(["boolean", "undefined"]).toContain(typeof m.frostRisk);
  });
});
