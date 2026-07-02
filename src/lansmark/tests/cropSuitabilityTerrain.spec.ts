/**
 * 무료 추천 지형 반영 검증 — 유료 시뮬(terrainFactors)과 동일 4단계 경사 기준 + 향(일조) + '땅마다 다른 순위'.
 */
import { describe, it, expect } from "vitest";
import { rankCropCandidates } from "../core/cropSuitability";
import type { LandInput } from "../types";

const LAND: LandInput = { areaM2: 3300 };
const pick = (list: ReturnType<typeof rankCropCandidates>, id: string) => list.find((c) => c.cropId === id)!;

describe("무료 추천 — 지형(경사·향) 반영", () => {
  it("지형 없으면 기존 점수 그대로(하위 호환)", () => {
    const a = rankCropCandidates(LAND, 99);
    const b = rankCropCandidates(LAND, 99, undefined, undefined);
    expect(a).toEqual(b);
  });
  it("평탄(허용의 절반 이하) → 가점 + 근거 문구", () => {
    const flat = pick(rankCropCandidates(LAND, 99, undefined, { slopeDegree: 2 }), "apple"); // apple 허용 10°
    const none = pick(rankCropCandidates(LAND, 99), "apple");
    expect(flat.score).toBeGreaterThan(none.score);
    expect(flat.reasons.join(" ")).toContain("평탄");
  });
  it("허용 초과 → 감점 + 위험 문구 · 급경사(2배 초과) → 더 큰 감점", () => {
    const base = pick(rankCropCandidates(LAND, 99), "apple");
    const over = pick(rankCropCandidates(LAND, 99, undefined, { slopeDegree: 15 }), "apple");  // 10° < 15° ≤ 20°
    const steep = pick(rankCropCandidates(LAND, 99, undefined, { slopeDegree: 25 }), "apple"); // > 20°
    expect(over.score).toBeLessThan(base.score);
    expect(steep.score).toBeLessThan(over.score);
    expect(over.risks.join(" ")).toContain("작업·토양유실");
    expect(steep.risks.join(" ")).toContain("급경사");
  });
  it("같은 경사도 작물 허용치에 따라 다르게 — 경사 12°는 도라지(15°) 무감점·시설딸기(5°) 감점", () => {
    const t = { slopeDegree: 12 };
    const balloon = pick(rankCropCandidates(LAND, 99, undefined, t), "balloon_flower"); // 허용 15° — 완경사
    const strawberry = pick(rankCropCandidates(LAND, 99, undefined, t), "strawberry"); // 허용 5° — 2배 초과
    expect(balloon.risks.join(" ")).not.toContain("경사");
    expect(strawberry.risks.join(" ")).toContain("급경사");
  });
  it("북사면 감점·남향 가점(일조)", () => {
    const n = pick(rankCropCandidates(LAND, 99, undefined, { aspect: "N" }), "apple");
    const s = pick(rankCropCandidates(LAND, 99, undefined, { aspect: "S" }), "apple");
    expect(s.score).toBeGreaterThan(n.score);
    expect(n.risks.join(" ")).toContain("북사면");
  });
  it("경사가 순위를 실제로 바꾼다 — 급경사 땅에선 저경사-허용 작물이 고경사-취약 작물을 앞선다", () => {
    const flatRank = rankCropCandidates(LAND, 99, undefined, { slopeDegree: 1 }).map((c) => c.cropId);
    const steepRank = rankCropCandidates(LAND, 99, undefined, { slopeDegree: 18 }).map((c) => c.cropId);
    expect(flatRank).not.toEqual(steepRank); // '전국 동일 순위'(가짜 정밀) 해소의 핵심 검증
  });
});
