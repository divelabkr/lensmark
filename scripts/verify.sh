#!/usr/bin/env bash
# /verify: 타입체크 + 테스트 + 아키텍처 지도 대조 (그린 게이트)
set -e
cd "${CLAUDE_PROJECT_DIR:-.}"
npx tsc --noEmit
npx vitest run
npx tsx scripts/archCheck.ts   # 기능 지도(featureMap) ↔ 코드 드리프트 차단
