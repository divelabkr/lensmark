#!/usr/bin/env bash
# PostToolUse 비차단 경고: 제품원칙 위반 "후보" 스캔.
#  - 긍정형 위반만 탐지. 부정/면책/정책파일은 정상이므로 제외.
#  - 정밀 판정은 /guardrail(서브에이전트 의미 검토)이 담당.
root="${CLAUDE_PROJECT_DIR:-.}"
hits=$(grep -rnE '수익[^ ]{0,6}보장|재배[^ ]{0,6}성공[^ ]{0,6}보장|매입[[:space:]]{0,2}추천|흙토람' \
        "$root/src" "$root/dashboard" 2>/dev/null \
      | grep -vE '/policy/' \
      | grep -vE '아닙니다|아니라|아니[^ ]|없습니다|없음|금지|차단|fail-closed|보조|범위|NOT |주석|예시')
if [ -n "$hits" ]; then
  echo "⚠ GUARDRAIL 주의(검토 필요) — /guardrail 로 정밀 검토:" >&2
  echo "$hits" >&2
fi
exit 0
