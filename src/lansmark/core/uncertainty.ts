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
