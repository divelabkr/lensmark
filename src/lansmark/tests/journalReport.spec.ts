/**
 * 재배일지 리포트(순수 함수) 검증 — 집계·예측대비 오차·기간·이상치 처리.
 */
import { describe, it, expect } from "vitest";
import { buildJournalReport } from "../journal/report";
import type { JournalEntry } from "../journal/types";

/** 테스트용 최소 일지 생성기(필드 덮어쓰기). */
function entry(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "j1", userId: "order:1", createdAt: "2026-03-01", updatedAt: "2026-03-01",
    cropId: "apple", events: [], status: "growing", ...over,
  };
}

describe("buildJournalReport", () => {
  it("빈 일지: 집계 0, 수확 없음, 예측 없으면 accuracy 생략", () => {
    const r = buildJournalReport(entry());
    expect(r.eventCount).toBe(0);
    expect(r.totalInputCostKrw).toBe(0);
    expect(r.totalLaborHours).toBe(0);
    expect(r.harvested).toBe(false);
    expect(r.netProfitKrw).toBeUndefined();
    expect(r.durationDays).toBeUndefined(); // 수확일 없음
    expect(r.accuracy).toBeUndefined();
    expect(r.disclaimer).toMatch(/보장이 아닙니다/);
  });

  it("작업 집계: 종류별 횟수 + 비용·노동 합계", () => {
    const r = buildJournalReport(entry({
      events: [
        { at: "2026-03-05", kind: "sow", costKrw: 30000, laborHours: 4 },
        { at: "2026-04-01", kind: "fertilize", costKrw: 50000, laborHours: 2 },
        { at: "2026-04-10", kind: "fertilize", costKrw: 20000 },
        { at: "2026-05-01", kind: "observe", note: "착과 양호" },
      ],
    }));
    expect(r.eventCount).toBe(4);
    expect(r.eventsByKind).toEqual({ sow: 1, fertilize: 2, observe: 1 });
    expect(r.totalInputCostKrw).toBe(100000);
    expect(r.totalLaborHours).toBe(6);
  });

  it("이상치 방어: 음수 비용/노동은 0으로 클램프", () => {
    const r = buildJournalReport(entry({
      events: [{ at: "2026-03-05", kind: "spray", costKrw: -99999, laborHours: -3 }],
    }));
    expect(r.totalInputCostKrw).toBe(0);
    expect(r.totalLaborHours).toBe(0);
  });

  it("수확·수익: 순수익 = 매출 - 기록된 투입비, 단위면적 수확량", () => {
    const r = buildJournalReport(entry({
      areaM2: 1000, status: "harvested",
      events: [{ at: "2026-04-01", kind: "fertilize", costKrw: 200000 }],
      harvest: { at: "2026-09-20", yieldKg: 2500, revenueKrw: 9000000, salesChannel: "도매" },
    }));
    expect(r.harvested).toBe(true);
    expect(r.yieldKg).toBe(2500);
    expect(r.netProfitKrw).toBe(9000000 - 200000);
    expect(r.yieldPerAreaKgM2).toBe(2.5);
    expect(r.salesChannel).toBe("도매");
  });

  it("기간: plantedAt → harvest.at 일수", () => {
    const r = buildJournalReport(entry({
      plantedAt: "2026-03-01",
      harvest: { at: "2026-03-31", yieldKg: 10 },
    }));
    expect(r.durationDays).toBe(30);
  });

  it("예측 대비 정확도: 오차% 계산, 예측 0이면 해당 항목 생략", () => {
    const r = buildJournalReport(entry({
      predicted: { yieldKg: 2000, costKrw: 0, revenueKrw: 8000000 },
      events: [{ at: "2026-04-01", kind: "fertilize", costKrw: 100000 }],
      harvest: { at: "2026-09-20", yieldKg: 2400, revenueKrw: 9000000 },
    }));
    expect(r.accuracy?.yieldErrPct).toBe(20);        // (2400-2000)/2000*100
    expect(r.accuracy?.revenueErrPct).toBe(12.5);    // (9000000-8000000)/8000000*100
    expect(r.accuracy?.costErrPct).toBeUndefined();  // 예측 cost=0 → 생략
  });
});
