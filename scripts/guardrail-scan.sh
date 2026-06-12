#!/usr/bin/env bash
# 제품원칙 위반 "후보" 스캔 (설계감사 P1#6 강화).
#  - 범위: src·dashboard·server·concept — 사용자 노출 JSON/HTML 생성지를 모두 포함(이전엔 server·concept가 사각이었음).
#  - 긍정형 위반만 탐지. 부정·면책·정책파일은 정상이므로 제외(아님·아닌·아닙니다·금지 등).
#  - 기본 = 비차단 경고(PostToolUse·작업 흐름 방해 없음). GUARDRAIL_STRICT=1 = 위반 시 exit 2(Stop·CI 결정적 게이트).
#  - 정밀 의미판정은 /guardrail(서브에이전트)이 보강. 이 스캔은 '명백한 위험어 신규 유입'의 자동 차단망.
root="${CLAUDE_PROJECT_DIR:-.}"
hits=$(grep -rnE '수익[^ ]{0,6}보장|재배[^ ]{0,6}성공[^ ]{0,6}보장|매입[[:space:]]{0,2}추천|흙토람' \
        "$root/src" "$root/dashboard" "$root/server" "$root/concept" 2>/dev/null \
      | grep -vE '/policy/' \
      | grep -vE '아님|아닌|아닙니다|아니라|아니[^ ]|없습니다|없음|금지|차단|fail-closed|보조|범위|NOT |주석|예시')
if [ -n "$hits" ]; then
  echo "⚠ GUARDRAIL 위반 후보(검토 필요) — /guardrail 로 정밀 검토:" >&2
  echo "$hits" >&2
  if [ "${GUARDRAIL_STRICT:-0}" = "1" ]; then
    echo "⛔ GUARDRAIL_STRICT — 위반 후보가 남아 차단(exit 2). 부정/면책 문맥이면 제외어 추가, 실위반이면 수정." >&2
    exit 2
  fi
fi
exit 0
