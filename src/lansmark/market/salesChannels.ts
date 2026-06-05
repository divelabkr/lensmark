/**
 * 출하 판로 비교(harvest-market) — "지금 어디에 납품하면 몇 % 더 받나".
 *   책임: 작물 룰북의 판로별 단가(도매/직거래/혼합/가공/체험)를 KAMIS 실도매가에 앵커링해
 *         판로별 기대 단가·도매 대비%·기대 매출을 순수 계산한다(부수효과 없음 · 결정적 · 테스트 용이).
 *   데이터 정직성(CLAUDE.md #4 추측 금지):
 *     - 판로 '비율'은 crops.seed 룰북(데모·verified:false) → anchorSource 라벨로 명시.
 *     - 도매 '실시세'는 KAMIS 일별 도매가(live, 있을 때) → 이 값으로 전체 판로를 실시장 수준으로 레벨링.
 *     - 시장별·등급별 세분화는 미구현(seam) — KAMIS kind/rank 파라미터 검증 후 확장.
 *   가드레일: 수익 보장 아님 · 등급·물량·시기·지역 변동 면책 · 매입추천 아님.
 */
import type { SigmaRange, SalesChannel } from "../types";
import { getCropProfile } from "../data/crops.seed";

/** 판로 한글 라벨. */
const CHANNEL_LABEL: Record<SalesChannel, string> = {
  wholesale: "도매", direct: "직거래", mixed: "혼합", processed: "가공", experience_farm: "체험",
};
/** 비교·표시 후보 순서(존재하는 판로만 사용). */
const CHANNEL_ORDER: SalesChannel[] = ["wholesale", "direct", "mixed", "processed", "experience_farm"];

/** 판로 1건 견적. */
export interface ChannelQuote {
  channel: SalesChannel;
  label: string;
  priceKrwPerKg: SigmaRange;        // 앵커 반영 후 단가(원/kg)
  deltaPctVsWholesale: number;      // p50 기준 도매 대비 %(+면 더 받음)
  expectedRevenueKrw?: SigmaRange;  // yieldKg 주면 단가×수량(원)
}

/** 판로 비교 결과. */
export interface SalesChannelComparison {
  cropId: string;
  cropNameKo: string;
  anchor: "live" | "seed";          // 도매 기준 출처(실시세 앵커 여부)
  anchorSource: string;
  wholesalePriceKrwPerKg: SigmaRange;
  yieldKg?: number;
  channels: ChannelQuote[];         // p50 내림차순
  best: SalesChannel;
  bestDeltaPct: number;             // 최고 판로의 도매 대비 %
  disclaimer: string;
}

const r0 = (x: number) => Math.round(x);
const scaleR = (s: SigmaRange, f: number): SigmaRange => ({ p10: r0(s.p10 * f), p50: r0(s.p50 * f), p90: r0(s.p90 * f) });
const round1 = (x: number) => Math.round(x * 10) / 10;

export interface CompareOpts {
  liveWholesale?: SigmaRange;  // KAMIS 실도매가(있으면 앵커)
  liveSource?: string;
  yieldKg?: number;            // 있으면 판로별 기대매출 동봉
}

const DISCLAIMER_TAIL = "실제 거래가는 등급·물량·시기·지역에 따라 다르며 수익 보장이 아닙니다. 시장별·등급별 세분화는 추후 제공.";
/** 면책 문구 — 앵커 상태에 따라 '근거'를 정직하게 분기(레드팀 F2: seed인데 실시세 앵커라 단언 금지). */
const disclaimerFor = (useLive: boolean): string =>
  (useLive
    ? "판로별 단가는 작물 룰북(데모) 비율에 도매 실시세(KAMIS)를 앵커한 추정입니다. "
    : "도매가를 포함한 모든 단가가 작물 룰북(데모·미검증) 비율 기반 추정이며, 실시세 앵커가 적용되지 않았습니다. ") + DISCLAIMER_TAIL;

/**
 * 판로 비교. 순수 함수: 동일 입력 → 동일 출력.
 *   - useLive: 실도매가가 유효(p50>0)하면 도매 기준으로 채택하고, seed 대비 배율(lift)로 다른 판로를 실시장 수준으로 끌어올린다.
 *   - 도매 채널은 실시세 그대로, 그 외는 seed비율 × lift → 판로 간 상대비(룰북)는 보존하면서 절대값만 실시장에 맞춘다.
 *   - unknown cropId면 getCropProfile이 throw(호출측에서 400 처리).
 */
export function compareSalesChannels(cropId: string, opts: CompareOpts = {}): SalesChannelComparison {
  const c = getCropProfile(cropId);
  const prices = c.economics.priceKrwPerKg as Partial<Record<SalesChannel, SigmaRange>>;
  const seedWholesale = prices.wholesale ?? prices.mixed; // 도매 비율 기준(없으면 혼합으로 폴백)

  const useLive = !!(opts.liveWholesale && opts.liveWholesale.p50 > 0);
  const wholesale = useLive ? opts.liveWholesale! : (seedWholesale ?? { p10: 0, p50: 0, p90: 0 });
  const lift = (useLive && seedWholesale && seedWholesale.p50 > 0) ? wholesale.p50 / seedWholesale.p50 : 1;

  const channels: ChannelQuote[] = [];
  for (const ch of CHANNEL_ORDER) {
    const seedP = prices[ch];
    if (!seedP) continue;
    const price = (ch === "wholesale" && useLive) ? wholesale : scaleR(seedP, lift);
    const deltaPctVsWholesale = wholesale.p50 > 0 ? round1(((price.p50 - wholesale.p50) / wholesale.p50) * 100) : 0;
    const q: ChannelQuote = { channel: ch, label: CHANNEL_LABEL[ch], priceKrwPerKg: price, deltaPctVsWholesale };
    if (opts.yieldKg && opts.yieldKg > 0) q.expectedRevenueKrw = scaleR(price, opts.yieldKg);
    channels.push(q);
  }
  channels.sort((a, b) => b.priceKrwPerKg.p50 - a.priceKrwPerKg.p50); // p50 내림차순(가장 잘 받는 판로 먼저)
  const best = channels[0];

  return {
    cropId, cropNameKo: c.cropNameKo,
    anchor: useLive ? "live" : "seed",
    anchorSource: useLive ? (opts.liveSource ?? "KAMIS 도매(live)") : "작물 룰북(데모·미검증)",
    wholesalePriceKrwPerKg: wholesale, yieldKg: opts.yieldKg,
    channels, best: best?.channel ?? "wholesale", bestDeltaPct: best?.deltaPctVsWholesale ?? 0,
    disclaimer: disclaimerFor(useLive),
  };
}
