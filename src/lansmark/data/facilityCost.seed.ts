/**
 * 시설(비닐하우스·스마트팜) 투자비 시드 — budget-cashflow의 capex 기본값.
 *   ⚠ 데이터 정직성(CLAUDE.md #4): 아래 ㎡당 단가는 2025년 공개 시장조사 '참고치'다.
 *      전부 verified:false · illustrative. 실제 견적은 시공업체·지역·자재·규모·연동수에 따라 크게 다르므로
 *      반드시 실견적(3곳 이상)을 받아야 한다. 사용자가 모든 값을 override 가능.
 *   출처 근거(2025 · 평당 → ㎡당 ÷3.3058 환산):
 *     - 비닐하우스 단동 평당 8~15만 · 연동 평당 21~50만
 *     - 스마트팜 보급형(비닐+ICT) 평당 50~100만 · 복합환경제어 유리온실 평당 200~400만
 *     - 자동관수 평당 10~20만 · 환경제어 평당 15~25만
 *     - 난방비 = 시설원예 경영비의 30~40%(겨울 운영비 핵심)
 *   ★ 정부 스마트팜 보조(컨테이너형 보조 최대 55%+저리융자 25%)·ICT 표준사업비(0.33ha 복합 2,000만/단순 700만)는
 *     금액·비율·자격이 공고마다 달라 시드에 단정하지 않는다 → support.seed(smartfarm/nh_fund) 링크 + 공식 공고 확인.
 */
import type { SigmaRange } from "../types";

/** 시설 등급(노지 → 단동 → 연동 → 보급형 스마트팜 → 복합 유리온실). */
export type FacilityTier = "none" | "single_span" | "multi_span" | "smartfarm_basic" | "glass_complex";

export interface FacilityCostProfile {
  tier: FacilityTier;
  label: string;
  capexPerM2Krw: {
    facility: SigmaRange;             // 시설 본체(㎡당)
    irrigation: SigmaRange;           // 자동관수(㎡당)
    environmentControl?: SigmaRange;  // 환경제어(스마트팜·㎡당)
  };
  heatingShareOfOpCost?: SigmaRange;  // 난방비 비중(시설원예 경영비의 30~40%) — 운영비 핵심 라인 노출용
  source: string;                     // 출처 라벨(참고·미검증)
  sourceYear: number;                 // 2025
  verified: false;                    // 항상 false(미검증 참고치)
}

/* 공통 보조 설비(㎡당) — 시설 유형 무관하게 비슷한 범위라 상수로 공유. */
const IRRIGATION: SigmaRange = { p10: 30000, p50: 45000, p90: 60000 };          // 평당 10~20만
const ENV_CONTROL: SigmaRange = { p10: 45000, p50: 60000, p90: 75000 };         // 평당 15~25만
const HEATING_SHARE: SigmaRange = { p10: 0.30, p50: 0.35, p90: 0.40 };          // 경영비의 30~40%

export const FACILITY_COSTS: Record<FacilityTier, FacilityCostProfile> = {
  none: {
    tier: "none", label: "노지(시설 없음)",
    capexPerM2Krw: { facility: { p10: 0, p50: 0, p90: 0 }, irrigation: { p10: 0, p50: 0, p90: 0 } },
    source: "노지 — 시설 capex 없음", sourceYear: 2025, verified: false,
  },
  single_span: {
    tier: "single_span", label: "비닐하우스(단동)",
    capexPerM2Krw: { facility: { p10: 24000, p50: 35000, p90: 45000 }, irrigation: IRRIGATION }, // 평당 8~15만
    heatingShareOfOpCost: HEATING_SHARE,
    source: "2025 비닐하우스 단동 평당 8~15만 시장 참고치(미검증·실견적 필수)", sourceYear: 2025, verified: false,
  },
  multi_span: {
    tier: "multi_span", label: "비닐하우스(연동)",
    capexPerM2Krw: { facility: { p10: 60000, p50: 100000, p90: 150000 }, irrigation: IRRIGATION }, // 평당 21~50만
    heatingShareOfOpCost: HEATING_SHARE,
    source: "2025 비닐하우스 연동 평당 21~50만 시장 참고치(미검증·실견적 필수)", sourceYear: 2025, verified: false,
  },
  smartfarm_basic: {
    tier: "smartfarm_basic", label: "스마트팜(보급형·비닐+ICT)",
    capexPerM2Krw: { facility: { p10: 150000, p50: 230000, p90: 300000 }, irrigation: IRRIGATION, environmentControl: ENV_CONTROL }, // 평당 50~100만
    heatingShareOfOpCost: HEATING_SHARE,
    source: "2025 스마트팜 보급형 평당 50~100만+환경제어 시장 참고치(미검증·실견적 필수)", sourceYear: 2025, verified: false,
  },
  glass_complex: {
    tier: "glass_complex", label: "복합환경제어 유리온실",
    capexPerM2Krw: { facility: { p10: 600000, p50: 900000, p90: 1200000 }, irrigation: IRRIGATION, environmentControl: ENV_CONTROL }, // 평당 200~400만
    heatingShareOfOpCost: HEATING_SHARE,
    source: "2025 복합환경제어 유리온실 평당 200~400만 시장 참고치(미검증·실견적 필수)", sourceYear: 2025, verified: false,
  },
};

/** 등급 조회. 미상 등급은 노지(capex 0)로 폴백(크래시 없음). */
export function getFacilityCost(tier: FacilityTier): FacilityCostProfile {
  return FACILITY_COSTS[tier] ?? FACILITY_COSTS.none;
}
