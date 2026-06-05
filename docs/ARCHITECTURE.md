# LANSMARK Architecture

## Core Modules

```txt
types.ts
  공통 타입

data/crops.seed.ts
  초기 작물 룰북

policy/soilPolicy.ts
  토양 데이터 신뢰도, 제한 API 차단

policy/disclaimer.ts
  수익보장/품종확정/토지매입 오해 방지 문구

core/cropSuitability.ts
  무료 작물 후보 TOP 5

core/planting.ts
  면적 기준 식재량 계산

core/yield.ts
  수확량 P10/P50/P90

core/cost.ts
  비용 P10/P50/P90

core/revenue.ts
  판매가/매출 P10/P50/P90

core/income.ts
  예상소득, 손익분기 단가

core/growthRisk.ts
  생육 리스크 뼈대

core/simulator.ts
  전체 유료 시뮬레이션 orchestration
```

## Free Boundary

무료는 `rankCropCandidates()`까지만 제공한다.

## Paid Boundary

유료는 `runLansmarkSimulation()` 결과를 제공한다.
