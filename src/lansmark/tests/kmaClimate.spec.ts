import { describe, it, expect } from "vitest";
import { parseAsosDaily, climateFromAsos } from "../geo/kma";

/**
 * kma_sfcdd3.php 실응답 형식(헤더 범례 + 데이터행). 앞 2행은 실제 캡처값, 마지막 행은
 * 겨울(12월) 최저기온 집계 검증용으로 동일 포맷으로 구성(TA_MIN=-11.2, RN_DAY=5.0).
 */
const SAMPLE = `#START7777
# YYMMDD STN ... TA_AVG ... TA_MIN ... SS_DAY ... RN_DAY ...
20260429 146  2.0  1722  27  4.6 1717  25  6.6 1645  13.9  19.1 1436   8.8  606   5.7  18.3   3.5  59.8  39.0 1440   9.2   4.6   3.2 -9.00 1011.4 1018.7 1020.1  740 1016.9 1553  8.6  3.4 13.6 -9.0 17.53  2.47 1200   -9.0   -9.0 -9.00   -9.0   -9   -9.0   -9   -9.0   -9   -9.0   -9   -9.0   -9 -99.0 -99.0 -99.0 -99.0 -99.0
20260503 146  2.5  2187  29  8.2 2311  29 12.9 2303  12.9  16.2    1  10.4 2350  11.1  14.9  10.0  89.0  70.0   20  13.3   1.4   1.0 -9.00  996.8 1004.0 1009.4    1 1000.4 1245  9.9  0.0 13.7 -9.0  3.17  0.61 1400   17.3    2.8 16.00    3.2  531    0.7  618   -9.0   -9   -9.0   -9   -9.0   -9   -9.0   -9 -99.0 -99.0 -99.0 -99.0 -99.0
20251215 146  2.0  1722  27  4.6 1717  25  6.6 1645   1.0   5.0 1436 -11.2  606   5.7  18.3   3.5  59.8  39.0 1440   9.2   4.6   3.2 -9.00 1011.4 1018.7 1020.1  740 1016.9 1553  8.6  3.4 13.6 -9.0 17.53  2.47 1200    5.0   -9.0 -9.00   -9.0   -9   -9.0   -9   -9.0   -9   -9.0   -9   -9.0   -9 -99.0 -99.0 -99.0 -99.0 -99.0
#7777END`;

describe("KMA ASOS 파서 (실응답 형식 검증)", () => {
  it("parseAsosDaily: 주석/마커 제외 · 컬럼 인덱스(TA_AVG/TA_MIN/SS_DAY/RN_DAY) 정확", () => {
    const rows = parseAsosDaily(SAMPLE);
    expect(rows.length).toBe(3); // # 줄 전부 제외
    expect(rows[0]).toMatchObject({ date: "20260429", month: 4, taAvgC: 13.9, taMaxC: 19.1, taMinC: 8.8, sunHr: 3.4 }); // TA_MAX=col11
    expect(rows[0].rainMm).toBeUndefined();              // RN_DAY=-9.0 → 결측(음수 누적 불가)
    expect(rows[1]).toMatchObject({ taMinC: 10.4, rainMm: 17.3, sunHr: 0.0 });
  });

  it("climateFromAsos: 겨울최저·연강수·일조·서리위험 집계", () => {
    const c = climateFromAsos(parseAsosDaily(SAMPLE));
    expect(c.minWinterTempC).toBe(-11.2);  // 12월 행 TA_MIN(영하기온은 결측 아님 — 보존)
    expect(c.frostRisk).toBe("medium");     // -15 < -11.2 ≤ -8
    expect(c.annualRainfallMm).toBe(22);    // 17.3 + 5.0 (0429는 결측 제외)
    expect(c.sunlightLevel).toBe("low");    // 평균 일조 < 5h
  });

  it("climateFromAsos: 여름최고(TA_MAX) 6~8월 max 산출 — 고온 스트레스 live 반영", () => {
    // 7월 행 1개(TA_MAX=col11=34.0). 나머지 컬럼은 형식 충족용.
    const SUMMER = `#START7777
20260715 146  2.5  2187  29  8.2 2311  29 12.9 2303  28.0  34.0    1  24.0 2350  11.1  14.9  10.0  89.0  70.0   20  13.3   1.4   1.0 -9.00  996.8 1004.0 1009.4    1 1000.4 1245  9.9  0.0 13.7 -9.0  3.17  0.61 1400   17.3    2.8 16.00    3.2  531    0.7  618   -9.0   -9   -9.0   -9   -9.0   -9   -9.0   -9 -99.0 -99.0 -99.0 -99.0 -99.0
#7777END`;
    expect(climateFromAsos(parseAsosDaily(SUMMER)).summerMaxTempC).toBe(34.0);
  });

  it("빈/무효 입력 → unknown (auto가 mock 폴백하도록)", () => {
    expect(climateFromAsos([])).toMatchObject({ frostRisk: "unknown", sunlightLevel: "unknown" });
    expect(parseAsosDaily("#7777END\n").length).toBe(0);
  });
});
