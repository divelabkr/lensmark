import type { SigmaRange } from "../types";

// P10/P90를 정규분포 분위로 보면 z ≈ 1.2816.
const Z = 1.2816;

function sigmaOf(r: SigmaRange): number {
  return Math.max(0, (r.p90 - r.p10) / (2 * Z));
}

/**
 * 두 변수의 곱(예: 수확량 × 단가)의 범위.
 *
 * 기존 코드는 p10*p10, p90*p90 (완전 양의 상관=comonotonic) 가정 → 밴드 과대, 낙관 과대.
 * 여기서는 '서로 독립'을 가정해 상대분산(변동계수²)을 합산한다(1차 근사).
 * 농산물 수율-가격은 보통 '음의 상관'이라, 독립 가정도 여전히 낙관 꼬리를
 * 기존보다 보수적으로 만든다(가드레일 친화).
 */
export function multiplyIndependent(a: SigmaRange, b: SigmaRange): SigmaRange {
  const meanA = a.p50;
  const meanB = b.p50;
  const mean = meanA * meanB;
  if (mean <= 0 || meanA <= 0 || meanB <= 0) {
    // 0/음수 경계: 보수적으로 코너값 사용
    return {
      p10: Math.max(0, Math.round(Math.min(a.p10 * b.p10, mean))),
      p50: Math.max(0, Math.round(mean)),
      p90: Math.max(0, Math.round(a.p90 * b.p90)),
    };
  }
  const cvA = sigmaOf(a) / meanA;
  const cvB = sigmaOf(b) / meanB;
  const cv = Math.sqrt(cvA * cvA + cvB * cvB);
  const sigma = mean * cv;
  return {
    p10: Math.max(0, Math.round(mean - Z * sigma)),
    p50: Math.round(mean),
    p90: Math.max(0, Math.round(mean + Z * sigma)),
  };
}

/**
 * 차(예: 매출 − 비용)의 범위. 독립 가정 하 분산 합산.
 * 기존 코드의 (매출.p90 − 비용.p10) = '최선코너 − 최선코너' 중복을 제거한다.
 */
export function subtractIndependent(a: SigmaRange, b: SigmaRange): SigmaRange {
  const mean = a.p50 - b.p50;
  const sa = sigmaOf(a);
  const sb = sigmaOf(b);
  const sigma = Math.sqrt(sa * sa + sb * sb);
  return {
    p10: Math.round(mean - Z * sigma),
    p50: Math.round(mean),
    p90: Math.round(mean + Z * sigma),
  };
}

/**
 * 소득(매출−비용) 범위에 '현실 손실 하한'을 적용 — 물리적으로 불가능한 손실만 차단(가드레일·불변식 #5).
 *   한 해 최대 손실 = 매출 0(multiplyIndependent가 0으로 클램프) − 최악 경영비(cost.p90). 그보다 더 음수일 수 없다.
 *   고가·범위 넓은 작물의 P10이 정규근사(mean − Z·σ)로 -∞ 팽창하는 것만 잘라낸다 — 범위·단조성 유지·인위적 축소 아님.
 *   p10만 올린다: p50/p90은 매출≥0이라 구조적으로 ≥ -cost.p90(p50 ≥ -cost.p50 ≥ -cost.p90)이므로 무변·단조성 보존.
 *   ⚠ 현재 '데모 base'는 비용이 비현실적으로 커서 어느 작물도 P10이 -cost.p90 아래로 가지 않음 → 이 하한은 '비활성(휴면)'.
 *     실 RDA(현실 비용) 적재 시 자동 활성화되는 미래 가드레일. (알람 magnitude 자체 해결은 데이터 몫이지 이 하한이 아님.)
 */
export function floorIncomeLoss(income: SigmaRange, costP90: number): SigmaRange {
  return { ...income, p10: Math.max(income.p10, -Math.max(0, costP90)) };
}
