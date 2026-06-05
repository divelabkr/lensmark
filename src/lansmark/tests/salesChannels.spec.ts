/**
 * 출하 판로 비교(compareSalesChannels) 검증 — 랭킹·도매대비%·실시세 앵커·기대매출.
 */
import { describe, it, expect } from "vitest";
import { compareSalesChannels } from "../market/salesChannels";

describe("compareSalesChannels", () => {
  it("seed 기준: p50 내림차순 랭킹 + 도매 대비%(직거래>도매, 도매=0%)", () => {
    const r = compareSalesChannels("potato"); // wholesale/direct/mixed 보유
    expect(r.anchor).toBe("seed");
    expect(r.channels.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < r.channels.length; i++) {
      expect(r.channels[i - 1].priceKrwPerKg.p50).toBeGreaterThanOrEqual(r.channels[i].priceKrwPerKg.p50);
    }
    expect(r.channels.find((c) => c.channel === "wholesale")!.deltaPctVsWholesale).toBe(0);
    expect(r.channels.find((c) => c.channel === "direct")!.deltaPctVsWholesale).toBeGreaterThan(0); // 직거래가 도매보다 비쌈
    expect(["direct", "experience_farm", "processed"]).toContain(r.best); // 최고 판로는 도매가 아님
    expect(r.bestDeltaPct).toBeGreaterThan(0);
  });

  it("live 앵커: 도매 채널은 실시세 그대로, 판로 상대비(%)는 seed와 보존", () => {
    const live = { p10: 2000, p50: 3000, p90: 4000 };
    const withLive = compareSalesChannels("potato", { liveWholesale: live, liveSource: "KAMIS 도매(live)" });
    const seedOnly = compareSalesChannels("potato");
    expect(withLive.anchor).toBe("live");
    expect(withLive.channels.find((c) => c.channel === "wholesale")!.priceKrwPerKg.p50).toBe(3000); // 실시세 그대로
    // 직거래 도매대비% 는 앵커와 무관하게 룰북 비율 보존(반올림 오차 내).
    const dLive = withLive.channels.find((c) => c.channel === "direct")!.deltaPctVsWholesale;
    const dSeed = seedOnly.channels.find((c) => c.channel === "direct")!.deltaPctVsWholesale;
    expect(Math.abs(dLive - dSeed)).toBeLessThanOrEqual(1);
    // 절대값은 실시장 수준으로 상승(직거래 p50 > seed 직거래 p50).
    expect(withLive.channels.find((c) => c.channel === "direct")!.priceKrwPerKg.p50)
      .toBeGreaterThan(seedOnly.channels.find((c) => c.channel === "direct")!.priceKrwPerKg.p50);
  });

  it("p50<=0 실시세는 앵커 무시(seed 폴백)", () => {
    const r = compareSalesChannels("potato", { liveWholesale: { p10: 0, p50: 0, p90: 0 } });
    expect(r.anchor).toBe("seed");
  });

  it("yieldKg 주면 기대매출 = 단가×수량", () => {
    const r = compareSalesChannels("potato", { yieldKg: 1000 });
    const w = r.channels.find((c) => c.channel === "wholesale")!;
    expect(w.expectedRevenueKrw!.p50).toBe(w.priceKrwPerKg.p50 * 1000);
  });

  it("unknown cropId → throw(호출측 400)", () => {
    expect(() => compareSalesChannels("nope_crop_zzz")).toThrow();
  });

  it("면책·출처 라벨 포함", () => {
    const r = compareSalesChannels("potato");
    expect(r.disclaimer).toMatch(/수익 보장이 아닙니다/);
    expect(r.anchorSource).toMatch(/룰북/);
  });

  it("면책 분기(레드팀 F2): seed='실시세 앵커 미적용', live='KAMIS 실시세 앵커'", () => {
    const seed = compareSalesChannels("potato");
    const live = compareSalesChannels("potato", { liveWholesale: { p10: 2000, p50: 3000, p90: 4000 } });
    expect(seed.disclaimer).toMatch(/실시세 앵커가 적용되지 않/);
    expect(live.disclaimer).toMatch(/실시세\(KAMIS\)/);
  });
});
