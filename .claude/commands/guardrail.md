---
description: Fail-closed 제품원칙 스캔(보장/매입추천/단일값/흙토람)
allowed-tools: Bash(bash scripts/guardrail-scan.sh:*), Read, Grep
---
`bash scripts/guardrail-scan.sh` 실행 + src·dashboard 변경분 검토. 위반: 수익/재배성공 보장, 토지 매입 추천, 단일 소득값(범위 누락), 흙토람 사용, 면책/출처 누락. 각 항목 file:line + 수정안. 위반 있으면 blocking으로 처리.
