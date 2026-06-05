---
description: 타입체크 + 테스트 그린 게이트
allowed-tools: Bash(npx tsc:*), Bash(npx vitest:*)
---
`npx tsc --noEmit` 실행 후 `npx vitest run` 실행. 보고: 타입체크 통과/실패, 테스트 N passed, 실패 스펙과 최소 원인. 코드는 수정하지 말 것(검증 전용).
