import { describe, it, expect } from "vitest";
import { percentile, priceRangeFromSamples, kamisDailyUrl, pricesFromKamisItems, retailStatsFromSamples } from "../geo/kamis";
import { getKamisCode } from "../data/providers/kamisItemCodes";

describe("geo/kamis (백분위·URL)", () => {
  it("percentile 선형보간", () => {
    const s = [1000, 2000, 3000, 4000, 5000];
    expect(percentile(s, 0.5)).toBe(3000);
    expect(percentile(s, 0.1)).toBe(1400);
    expect(percentile(s, 0.9)).toBe(4600);
  });
  it("priceRangeFromSamples → P10/50/90 (0·음수 제거)", () => {
    const r = priceRangeFromSamples([3000, 1000, 5000, 0, -2, 2000, 4000])!;
    expect(r).toEqual({ p10: 1400, p50: 3000, p90: 4600 });
  });
  it("표본 없으면 null", () => {
    expect(priceRangeFromSamples([0, -1])).toBeNull();
  });
  it("도매 URL은 도매코드(02) + kg환산(Y) 포함", () => {
    const u = kamisDailyUrl({ certKey: "K", certId: "I", category: "400", item: "411", start: "2026-01-01", end: "2026-01-31" });
    expect(u).toContain("p_productclscode=02");
    expect(u).toContain("p_itemcategorycode=400");
    expect(u).toContain("p_convert_kg_yn=Y"); // ★ 원/kg 환산(미설정 시 원/박스 → 10배 단위오류)
  });
  it("소매 URL은 소매코드(01) — cls 파라미터(마트 소비자가)", () => {
    const u = kamisDailyUrl({ certKey: "K", certId: "I", category: "400", item: "411", start: "2026-06-01", end: "2026-06-08", cls: "01" });
    expect(u).toContain("p_productclscode=01");
    expect(u).toContain("p_convert_kg_yn=Y");
  });
  it("retailStatsFromSamples → min·평균·max (0·음수 제거)", () => {
    expect(retailStatsFromSamples([3000, 5000, 4000])).toEqual({ min: 3000, avg: 4000, max: 5000, samples: 3 });
    expect(retailStatsFromSamples([0, -5, 2000])).toEqual({ min: 2000, avg: 2000, max: 2000, samples: 1 });
    expect(retailStatsFromSamples([])).toBeNull();
  });

  it("pricesFromKamisItems: 전국'평균' 행 우선 + 콤마 가격 파싱(원/kg)", () => {
    const items = [
      { countyname: "평균", price: "9,118" },
      { countyname: "평균", price: "9,400" },
      { countyname: "서울", price: "10,500" }, // 평균이 있으면 시장행은 제외
    ];
    expect(pricesFromKamisItems(items)).toEqual([9118, 9400]);
  });
  it("pricesFromKamisItems: '평균' 없으면 전체 사용, 무효값 제거", () => {
    expect(pricesFromKamisItems([{ price: "1,000" }, { price: "-" }, { price: "0" }])).toEqual([1000]);
    expect(pricesFromKamisItems(null)).toEqual([]);
  });

  it("apple 품목코드는 실연동 검증 완료(verified)", () => {
    const c = getKamisCode("apple")!;
    expect(c.verified).toBe(true);
    expect(c.itemCode).toBe("411");
    expect(c.categoryCode).toBe("400");
  });
  it("미검증 작물은 verified=false (→ base 단가 폴백)", () => {
    expect(getKamisCode("onion")!.verified).toBe(false);
  });
});
