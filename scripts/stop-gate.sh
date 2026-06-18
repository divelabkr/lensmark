#!/usr/bin/env bash
# Stop 훅: 완료 전 그린 강제(빨가면 exit 2로 멈춤 차단). 무한루프 방지 가드 포함.
input=$(cat 2>/dev/null || true)
printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"
if npx tsc --noEmit >/tmp/lm_tsc.log 2>&1 && npx vitest run >/tmp/lm_test.log 2>&1 && npx tsx scripts/archCheck.ts >/tmp/lm_arch.log 2>&1 && npx tsx scripts/sizeGuard.ts >/tmp/lm_size.log 2>&1 && GUARDRAIL_STRICT=1 bash scripts/guardrail-scan.sh >/tmp/lm_guard.log 2>&1; then
  exit 0
else
  echo "⛔ 그린 아님(tsc/vitest/arch/size/guardrail 실패) — 완료 전 복구 필요:" >&2
  tail -n 6 /tmp/lm_tsc.log /tmp/lm_test.log /tmp/lm_arch.log /tmp/lm_size.log /tmp/lm_guard.log 2>/dev/null >&2
  exit 2
fi
