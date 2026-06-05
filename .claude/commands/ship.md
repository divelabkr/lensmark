---
description: 출시 게이트 체크리스트
allowed-tools: Bash, Read, Grep
---
LANSMARK 출시 준비도 평가(LANSMARK_HANDOFF.md §6):
1) `npx tsc --noEmit && npx vitest run` 그린(≥51)
2) live providers 구현 or HUMAN GATE 명시(키/라이선스)
3) 일부 작물 validated(N≥5)
4) 전자상거래 약관/환불, base 출처·연도, 면책 노출
5) 라이선스 확인(공공누리 유형, VWorld 운영키, 위성 배포권)
각 항목 ✅/⛔ 체크리스트 + 남은 차단요인을 정확히 보고.
