---
description: 실측 보정 정리(LANSMARK Dream) — recency + 이상치격리 + 스냅샷 리포트
argument-hint: [halfLifeDays(기본540)]
allowed-tools: Bash(npx:*), Read, Write
---
`core/consolidate.ts`의 `consolidate()`로 누적 실측(OutcomeRecord)을 정리한다. 피드백 스토어/스냅샷 경로가 있으면 로드, 없으면 데모 데이터로 실행. halfLifeDays=$ARGUMENTS(없으면 540).
실행 방법: 작은 tsx/node 스니펫으로 `consolidate(records,{halfLifeDays})` 호출 → 스냅샷 생성. 보고: total/used 건수, 격리된 이상치(사유), 승격된 버킷, 보정 변화. 스토어가 설정돼 있으면 스냅샷 저장, 아니면 출력.
