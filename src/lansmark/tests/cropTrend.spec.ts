/** cropTrend — 시장 신호(트렌드·차별화) 정직성 가드 회귀: 화이트리스트·Level(1~3) 검증·중복제거·키게이트. */
import { describe, it, expect } from "vitest";
import { parseSignals, fetchMarketSignals, TREND_KO, NICHE_KO, __resetMarketCache } from "../market/cropTrend";

describe("cropTrend — 시장 신호(트렌드·차별화) 정직성 가드", () => {
  it("parseSignals: 우리 19작물·Level(1~3)만 통과(화이트리스트·단계검증)", () => {
    const raw = JSON.stringify([
      { crop: "고구마", trend: 3, niche: 1, why: "수요 상승" },        // sweet_potato ✓
      { crop: "감자", trend: 2, niche: 1, why: "안정" },               // potato ✓
      { crop: "존재안하는작물X", trend: 2, niche: 2, why: "x" },       // 목록 밖 → 폐기
      { crop: "옥수수(찰/단옥수수)", trend: 5, niche: 1, why: "x" },   // trend 5 = Level 밖 → 폐기
      { crop: "콩(대두)", trend: 1, niche: 0, why: "x" },              // niche 0 = Level 밖 → 폐기
    ]);
    const items = parseSignals(raw);
    expect(items.map((i) => i.cropId).sort()).toEqual(["potato", "sweet_potato"]);
    const sp = items.find((i) => i.cropId === "sweet_potato");
    expect(sp?.trend).toBe(3);
    expect(sp?.niche).toBe(1);
  });

  it("parseSignals: 코드펜스·잡텍스트 섞여도 JSON 배열만 추출", () => {
    const raw = '분석:\n```json\n[{"crop":"감자","trend":2,"niche":1,"why":"안정 수요"}]\n```';
    expect(parseSignals(raw).map((i) => i.cropId)).toEqual(["potato"]);
  });

  it("parseSignals: 중복 작물은 첫 항목만 유지", () => {
    const raw = JSON.stringify([
      { crop: "고구마", trend: 3, niche: 2, why: "a" },
      { crop: "고구마", trend: 1, niche: 1, why: "b" },
    ]);
    const items = parseSignals(raw);
    expect(items.length).toBe(1);
    expect(items[0].trend).toBe(3);
  });

  it("parseSignals: 깨진 JSON·빈 입력 → 빈 배열(폐기)", () => {
    expect(parseSignals("not json")).toEqual([]);
    expect(parseSignals("")).toEqual([]);
    expect(parseSignals('{"not":"array"}')).toEqual([]);
  });

  it("fetchMarketSignals: PERPLEXITY_API_KEY 없으면 null(HUMAN GATE·무중단)", async () => {
    __resetMarketCache();
    const saved = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    expect(await fetchMarketSignals()).toBeNull();
    if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
  });

  it("TREND_KO·NICHE_KO: 3단계 한글 라벨", () => {
    expect(TREND_KO[3]).toBe("상승");
    expect(TREND_KO[1]).toBe("유지");
    expect(NICHE_KO[3]).toBe("높음");
    expect(NICHE_KO[1]).toBe("낮음");
  });
});
