/**
 * 재배 가이드(buildCultivationGuide) 검증 — 품종·요구조건·티어·면책.
 */
import { describe, it, expect } from "vitest";
import { buildCultivationGuide, isStapleFree, STAPLE_FREE } from "../guide/cultivationGuide";

describe("buildCultivationGuide", () => {
  it("대표작물(사과)은 free 티어 + 품종·요구조건·캘린더 조립", () => {
    const g = buildCultivationGuide("apple");
    expect(g.tier).toBe("free");
    expect(g.cropNameKo).toBeTruthy();
    expect(g.varieties.length).toBeGreaterThanOrEqual(1);
    expect(g.requirements.some((r) => r.key === "drainage")).toBe(true);
    expect(g.requirements.some((r) => r.key === "sunlight")).toBe(true);
    expect(g.calendar.months.length).toBeGreaterThanOrEqual(1);
    expect(g.disclaimer).toMatch(/보장하지 않습니다/);
    expect(g.sources.join(" ")).toMatch(/농사로/); // live-upgrade seam 명시
  });

  it("특용작물(블루베리)은 paid 티어", () => {
    expect(buildCultivationGuide("blueberry").tier).toBe("paid");
  });

  it("요구조건 값은 한국어 라벨", () => {
    const g = buildCultivationGuide("potato");
    const drain = g.requirements.find((r) => r.key === "drainage")!;
    expect(["불량", "보통", "양호"]).toContain(drain.value);
  });

  it("isStapleFree: 대표작물 true, 그 외 false", () => {
    expect(isStapleFree("apple")).toBe(true);
    expect(isStapleFree("blueberry")).toBe(false);
    expect(STAPLE_FREE.size).toBeGreaterThan(0);
  });

  it("unknown cropId → throw(호출측 400)", () => {
    expect(() => buildCultivationGuide("zzz_unknown")).toThrow();
  });

  it("벼·보리(대표 식량작물)는 free + 캘린더 수확월 존재", () => {
    const rice = buildCultivationGuide("rice");
    expect(rice.tier).toBe("free");
    expect(isStapleFree("rice")).toBe(true);
    expect(rice.calendar.months.some((m) => m.stage === "harvest")).toBe(true);
    expect(buildCultivationGuide("barley").tier).toBe("free");
  });
});
