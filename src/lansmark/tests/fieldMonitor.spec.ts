/**
 * 일일 환경 모니터링(buildFieldMonitor) 검증 — 기후 vs 작물요구 적합 점검·면책.
 */
import { describe, it, expect } from "vitest";
import { buildFieldMonitor } from "../monitor/fieldMonitor";

describe("buildFieldMonitor", () => {
  it("5축(강수·겨울최저·여름최고·일조·서리) 점검 + 면책·seam 출처", () => {
    const m = buildFieldMonitor("rice", { annualRainfallMm: 1300, minWinterTempC: -8, summerMaxTempC: 32, sunlightLevel: "high", frostRisk: "low" });
    expect(m.checks.map((c) => c.axis).sort()).toEqual(["cold", "frost", "heat", "rain", "sun"]);
    expect(m.cropNameKo).toBeTruthy();
    expect(m.disclaimer).toMatch(/보장하지 않습니다/);
    expect(m.sources.join(" ")).toMatch(/seam|예정/);
  });

  it("다습 작물 + 강수 부족 → 강수 watch", () => {
    const rain = buildFieldMonitor("rice", { annualRainfallMm: 700 }).checks.find((c) => c.axis === "rain")!;
    expect(rain.status).toBe("watch");
  });

  it("서리 민감 작물(블루베리) + 서리위험 high → frost risk, 한파 → cold risk", () => {
    const m = buildFieldMonitor("blueberry", { frostRisk: "high", minWinterTempC: -16 });
    expect(m.checks.find((c) => c.axis === "frost")!.status).toBe("risk");
    expect(m.checks.find((c) => c.axis === "cold")!.status).toBe("risk");
    expect(m.worst).toBe("risk");
    expect(m.riskCount).toBeGreaterThanOrEqual(2);
  });

  it("고온 축: 냉량성 작물(사과)은 폭염 시 heat risk, 호온성 작물(고구마)은 같은 더위에도 ok", () => {
    const hot = { summerMaxTempC: 35 };
    expect(buildFieldMonitor("apple", hot).checks.find((c) => c.axis === "heat")!.status).toBe("risk");        // 내서성 낮음
    expect(buildFieldMonitor("sweet_potato", hot).checks.find((c) => c.axis === "heat")!.status).toBe("ok");   // 내서성 높음
  });

  it("기후 자료 없으면 unknown(크래시 없음 · 고온축 포함)", () => {
    const m = buildFieldMonitor("apple", {});
    expect(m.checks.every((c) => c.status === "unknown")).toBe(true);
    expect(m.worst).toBe("unknown");
  });

  it("unknown cropId → throw(호출측 400)", () => {
    expect(() => buildFieldMonitor("zzz_unknown", {})).toThrow();
  });
});
