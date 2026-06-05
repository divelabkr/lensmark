#!/usr/bin/env bash
# PreToolUse(Bash) fail-closed: 파괴적/시크릿노출 명령 차단 (exit 2 = block)
input=$(cat 2>/dev/null || true)
cmd=$(printf '%s' "$input" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1)
if printf '%s' "$cmd" | grep -qiE 'rm[[:space:]]+-rf[[:space:]]+(/|~|\$HOME|\*)|git[[:space:]]+push[[:space:]].*--force|cat[[:space:]][^"]*\.env|>[[:space:]]*\.env([^.]|$)'; then
  echo "⛔ BLOCKED: 파괴적/시크릿 노출 가능 명령 (guard.sh)" >&2
  exit 2
fi
exit 0
