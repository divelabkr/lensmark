---
description: 실 데이터 provider를 seam에 구현(스캐폴드)
argument-hint: [vworld|kma|kamis]
allowed-tools: Read, Grep, Edit, Write, WebFetch, Bash
---
"$ARGUMENTS" provider를 `data/providers/live.ts`에 구현.
순서: (1) `data/providers/types.ts`+`mock.ts`로 반환 타입 확인 → (2) 공식 API 스펙 docs 확인(추측 금지) → (3) 동일 타입 반환하도록 fetch 구현, 키는 env에서(.env.example 추가, 하드코딩 금지) → (4) mock 폴백 유지 → (5) /verify 실행.
HUMAN GATE: 키/라이선스 없으면 코드는 작성하되 key-pending 상태로 두고 요청.
