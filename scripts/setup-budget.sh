#!/usr/bin/env bash
# LENSMARK 예산 안전장치 — GCP Cloud Billing 예산 + 임계 알림(이메일). ⚠ 자동 차단 아님(알림만 → 앱은 안 죽음).
#   배경: 2026-06 비싼 설정(min=1·no-cpu-throttling)을 잡아줄 '예산 알림'이 없어 ₩67,712 폭증을 뒤늦게 발견.
#         이 스크립트는 '월 예산 초과 시 결제 관리자에게 이메일' 알림을 건다(사후 감지).
#         실시간 '설정 실수' 차단은 deploy.sh의 cost_guard(사전 차단)가 담당 — 둘은 보완 관계.
#   ⚠ 선행조건(HUMAN GATE): GCP billing이 켜져 있어야 함 — billing OFF면 budgets API도 실패한다. billing 켠 직후 1회 실행.
#   사용:
#     bash scripts/setup-budget.sh                          # 기본 월 5,000원(사용자 결정)
#     LANSMARK_BUDGET_KRW=10000 bash scripts/setup-budget.sh # 한도 변경
set -euo pipefail

PROJECT="lensmark-dev"
AMOUNT="${LANSMARK_BUDGET_KRW:-5000}"   # 월 예산 한도(원). 사용자 결정 기본 5,000원.
NAME="LENSMARK 월 예산 가드"             # 멱등 키(이미 있으면 재생성 안 함)

# 1) 프로젝트에 연결된 billing account 자동 조회 (billing OFF면 여기서 실패 → 안내 후 종료)
BA="$(gcloud billing projects describe "$PROJECT" --format='value(billingAccountName)' 2>/dev/null | sed 's#billingAccounts/##')"
if [ -z "$BA" ]; then
  echo "✗ billing account를 찾지 못했습니다 — billing이 꺼져 있거나 프로젝트가 결제 계정에 연결되지 않았습니다."
  echo "  GCP 콘솔에서 ${PROJECT} 결제를 켠 뒤 다시 실행하세요: bash scripts/setup-budget.sh"
  exit 1
fi
echo "── 예산 가드 설정: project=${PROJECT} · billing-account=${BA} · 한도=${AMOUNT}원/월 (알림 전용·자동 차단 없음)"

# 2) 멱등 — 같은 이름 예산이 이미 있으면 건너뜀(중복 생성 방지)
if gcloud billing budgets list --billing-account="$BA" --format='value(displayName)' 2>/dev/null | grep -qF "$NAME"; then
  echo "  ⚠ 이미 '${NAME}' 예산이 있습니다 — 중복 생성 건너뜀."
  echo "    금액을 바꾸려면 GCP 콘솔(결제 > 예산 및 알림)에서 수정하거나, 기존 예산 삭제 후 재실행하세요."
  exit 0
fi

# 3) 예산 + 임계 알림 생성
#    - 실지출 50%/90%/100% + 예측지출 100%(월말 예측이 한도 초과 시 더 일찍 경고)
#    - 수신자 = billing 관리자/사용자 IAM(--disable-default-iam-recipients 미지정 → 이메일 자동 발송)
#    - 통화: ₩ 청구 계정 기준 KRW. 통화 불일치 에러 시 계정 통화에 맞게 'KRW'를 교체.
gcloud billing budgets create \
  --billing-account="$BA" \
  --display-name="$NAME" \
  --budget-amount="${AMOUNT}KRW" \
  --filter-projects="projects/${PROJECT}" \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --threshold-rule=percent=1.0,basis=forecasted-spend

echo "✓ 예산 가드 생성 완료 — 월 ${AMOUNT}원의 50%·90%·100% 및 '월말 예측 100%' 도달 시 결제 관리자 이메일로 알림."
echo "  (알림만 보냅니다 — 서비스를 자동 중단하지 않으므로 lensmark.kr은 멈추지 않습니다.)"
