/** cropDifficulty(난이도 룰)·buildCropTable(표 조립) 회귀: 1~3 범위·등급 분포·키없음 폴백. */
import { describe, it, expect } from "vitest";
import { cropDifficulty, DIFFICULTY_KO } from "../market/cropDifficulty";
import { buildCropTable } from "../market/marketTable";
import { CROP_PROFILES } from "../data/crops.seed";
import { __resetMarketCache } from "../market/cropTrend";

describe("cropDifficulty — 재배 난이도 룰(요구조건→1~3)", () => {
  it("모든 작물이 1~3 난이도 반환(throw 없음)", () => {
    for (const c of CROP_PROFILES) expect([1, 2, 3]).toContain(cropDifficulty(c.cropId));
  });
  it("난이도 등급이 2개 이상 분포(룰이 작물을 실제로 구분)", () => {
    const all = CROP_PROFILES.map((c) => cropDifficulty(c.cropId));
    expect(new Set(all).size).toBeGreaterThanOrEqual(2);
  });
  it("DIFFICULTY_KO: 1쉬움/2보통/3어려움", () => {
    expect(DIFFICULTY_KO[1]).toBe("쉬움");
    expect(DIFFICULTY_KO[2]).toBe("보통");
    expect(DIFFICULTY_KO[3]).toBe("어려움");
  });
});

describe("buildCropTable — 정렬 표 조립", () => {
  it("Perplexity 키 없으면 null(무중단·땅먼저 폴백)", async () => {
    __resetMarketCache();
    const saved = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    expect(await buildCropTable()).toBeNull();
    if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
  });
});
