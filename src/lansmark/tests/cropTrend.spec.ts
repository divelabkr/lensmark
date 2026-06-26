/** cropTrend — 시장조사 3섹터(Perplexity)의 정직성 가드 회귀: 화이트리스트·섹터검증·중복제거·키게이트. */
import { describe, it, expect } from "vitest";
import { parseItems, fetchMarketTrends, SECTOR_KO, __resetMarketCache } from "../market/cropTrend";

describe("cropTrend — 시장조사 3섹터(정직성 가드)", () => {
  it("parseItems: 우리 19작물·유효 섹터만 통과(화이트리스트·섹터검증)", () => {
    const raw = JSON.stringify([
      { crop: "고구마", sector: "volume", why: "수요 큼" },     // sweet_potato ✓
      { crop: "감자", sector: "premium", why: "고가" },          // potato ✓
      { crop: "존재안하는작물X", sector: "volume", why: "x" },   // 목록 밖 → 폐기
      { crop: "콩(대두)", sector: "badsector", why: "x" },       // 잘못된 섹터 → 폐기
    ]);
    const items = parseItems(raw);
    const ids = items.map((i) => i.cropId).sort();
    expect(ids).toEqual(["potato", "sweet_potato"]); // 목록 밖·잘못된 섹터 제외
    expect(items.find((i) => i.cropId === "sweet_potato")?.sector).toBe("volume");
  });

  it("parseItems: 코드펜스·잡텍스트 섞여도 JSON 배열만 추출", () => {
    const raw = '설명문...\n```json\n[{"crop":"감자","sector":"volume","why":"대량 생산"}]\n```\n끝';
    expect(parseItems(raw).map((i) => i.cropId)).toEqual(["potato"]);
  });

  it("parseItems: 중복 작물은 첫 항목만 유지", () => {
    const raw = JSON.stringify([
      { crop: "감자", sector: "premium", why: "a" },
      { crop: "감자", sector: "volume", why: "b" },
    ]);
    const items = parseItems(raw);
    expect(items.length).toBe(1);
    expect(items[0].sector).toBe("premium");
  });

  it("parseItems: 깨진 JSON·빈 입력 → 빈 배열(폐기)", () => {
    expect(parseItems("not json at all")).toEqual([]);
    expect(parseItems("")).toEqual([]);
    expect(parseItems('{"not":"array"}')).toEqual([]);
  });

  it("fetchMarketTrends: PERPLEXITY_API_KEY 없으면 null(HUMAN GATE·무중단)", async () => {
    __resetMarketCache();
    const saved = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    expect(await fetchMarketTrends()).toBeNull();
    if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
  });

  it("SECTOR_KO: 3섹터 한글 라벨(많이/비싸게/특수)", () => {
    expect(SECTOR_KO.volume).toBe("많이 팔리는");
    expect(SECTOR_KO.premium).toBe("비싸게 팔리는");
    expect(SECTOR_KO.niche).toBe("특수하게 팔리는");
  });
});
