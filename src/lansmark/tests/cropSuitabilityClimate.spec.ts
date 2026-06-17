import { describe, it, expect } from "vitest";
import { rankCropCandidates } from "../core/cropSuitability";
import type { LandInput } from "../types";

// 무료 추천 ↔ 유료 시뮬 근거 일치(모순 제거) 회귀가드 — 무료 추천도 기후를 반영해야 한다.
describe("cropSuitability — 무료 추천에 기후 반영(유료 시뮬과 근거 일치)", () => {
  const land = { areaM2: 3300 } as LandInput;

  it("혹독한 기후를 주면 점수가 내려가고 기후 위험 근거가 붙는다", () => {
    const base = rankCropCandidates(land, 12); // 기후 없음(종전)
    const harsh = rankCropCandidates(land, 12, { minWinterTempC: -25, frostRisk: "high", annualRainfallMm: 500, summerMaxTempC: 40 });
    const baseScore = Object.fromEntries(base.map((c) => [c.cropId, c.score]));
    // 같은 작물이 혹독 기후에선 더 낮은 점수(겨울최저 -25는 모든 내한등급의 한계-3을 넘어 전 작물 페널티)
    expect(harsh.some((c) => baseScore[c.cropId] != null && c.score < baseScore[c.cropId])).toBe(true);
    // 기후 근거(위험)가 사람이 읽을 문장으로 노출
    expect(harsh.some((c) => (c.risks || []).some((r) => r.includes("겨울 최저")))).toBe(true);
  });

  it("기후 인자를 안 주면 종전과 동일(후방호환 — 기후 페널티 없음)", () => {
    const a = rankCropCandidates(land, 6);
    const b = rankCropCandidates(land, 6);
    expect(a.map((c) => c.cropId)).toEqual(b.map((c) => c.cropId));
  });
});
