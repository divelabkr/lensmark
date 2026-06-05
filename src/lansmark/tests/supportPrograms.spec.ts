/**
 * 지원금·혜택(buildSupportPrograms) 검증 — 큐레이션·관련도·면책·정직성.
 */
import { describe, it, expect } from "vitest";
import { buildSupportPrograms } from "../support/supportPrograms";

describe("buildSupportPrograms", () => {
  it("전체 대표 제도 + 공식확인 면책", () => {
    const r = buildSupportPrograms({});
    expect(r.programs.length).toBeGreaterThan(3);
    expect(r.disclaimer).toMatch(/공식 출처/);
    expect(r.disclaimer).toMatch(/최신성을 보장하지 않/);
    expect(r.sources.join(" ")).toMatch(/seam|예정/); // 실시간 큐레이션 seam 명시
  });

  it("작물(과수) → 관련 제도(스마트팜) 우선 정렬·relevant=true", () => {
    const r = buildSupportPrograms({ cropId: "blueberry" }); // category=fruit
    expect(r.cropNameKo).toBeTruthy();
    expect(r.programs[0].relevant).toBe(true);
    expect(r.programs.some((p) => p.cropTags?.includes("fruit") && p.relevant)).toBe(true);
  });

  it("금액·자격을 단정하지 않음(officialHint=공식 확인 경로)", () => {
    const r = buildSupportPrograms({});
    for (const p of r.programs) expect(p.officialHint).toBeTruthy();
  });

  it("unknown cropId 무시 → 전체 안내(크래시 없음)", () => {
    const r = buildSupportPrograms({ cropId: "zzz_unknown" });
    expect(r.programs.length).toBeGreaterThan(0);
    expect(r.programs.every((p) => p.relevant === false)).toBe(true);
  });
});
