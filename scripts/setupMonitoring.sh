#!/usr/bin/env bash
# Cloud Monitoring 경보 1회 설정 — 서버가 죽어도/5xx가 터져도 사장님이 모르던 갭(P0) 해소.
#   만드는 것: ① 알림 채널(이메일) ② 업타임 체크(/api/health 60s) ③ 경보 2종(업타임 실패 · 5xx 로그 급증).
#   사용(1회): ALERT_EMAIL=you@example.com bash scripts/setupMonitoring.sh
#   비용: 업타임 체크·로그 기반 경보 이 규모는 무료 한도 내(2026 기준). 멱등(이미 있으면 건너뜀).
set -euo pipefail
PROJECT="lensmark-dev"
SERVICE="lansmark-api"
HOST="lansmark-api-397463229960.asia-northeast3.run.app"   # 커스텀 도메인 전 — 연결 후 lensmark.kr로 교체 가능
EMAIL="${ALERT_EMAIL:-}"
[ -n "$EMAIL" ] || { echo "사용: ALERT_EMAIL=you@example.com bash scripts/setupMonitoring.sh"; exit 1; }

echo "── ① 알림 채널(이메일: ${EMAIL})"
CH=$(gcloud beta monitoring channels list --project "$PROJECT" --filter="type=\"email\" AND labels.email_address=\"${EMAIL}\"" --format='value(name)' | head -1)
if [ -z "$CH" ]; then
  CH=$(gcloud beta monitoring channels create --project "$PROJECT" --display-name="LENSMARK 운영자" \
    --type=email --channel-labels="email_address=${EMAIL}" --format='value(name)')
  echo "  생성: $CH"
else echo "  기존 재사용: $CH"; fi

echo "── ② 업타임 체크(/api/health · 60초)"
if ! gcloud monitoring uptime list-configs --project "$PROJECT" --format='value(displayName)' | grep -q '^lensmark-health$'; then
  gcloud monitoring uptime create lensmark-health --project "$PROJECT" \
    --resource-type=uptime-url --resource-labels="host=${HOST},project_id=${PROJECT}" \
    --protocol=https --path="/api/health" --port=443 --period=1 --timeout=10
  echo "  생성: lensmark-health"
else echo "  기존 재사용"; fi

echo "── ③ 경보 정책(업타임 실패 + 5xx 급증)"
TMP=$(mktemp -d)
# (a) 업타임 실패 — 3회 연속(3분) 다운이면 이메일. check_id는 displayName으로 조회.
CHECK_ID=$(gcloud monitoring uptime list-configs --project "$PROJECT" --filter='displayName="lensmark-health"' --format='value(name)' | sed 's#.*/##')
cat > "$TMP/uptime.json" <<JSON
{
  "displayName": "LENSMARK 다운(업타임 실패)",
  "combiner": "OR",
  "conditions": [{
    "displayName": "/api/health 실패 3분",
    "conditionThreshold": {
      "filter": "resource.type=\\"uptime_url\\" AND metric.type=\\"monitoring.googleapis.com/uptime_check/check_passed\\" AND metric.labels.check_id=\\"${CHECK_ID}\\"",
      "aggregations": [{"alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_NEXT_OLDER", "crossSeriesReducer": "REDUCE_COUNT_FALSE", "groupByFields": ["resource.label.host"]}],
      "comparison": "COMPARISON_GT", "thresholdValue": 0, "duration": "180s",
      "trigger": {"count": 1}
    }
  }],
  "notificationChannels": ["${CH}"]
}
JSON
# (b) 5xx 급증 — Cloud Run 응답 5xx가 5분 합계 10건 초과.
cat > "$TMP/errors.json" <<JSON
{
  "displayName": "LENSMARK 5xx 급증",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Cloud Run 5xx > 10/5분",
    "conditionThreshold": {
      "filter": "resource.type=\\"cloud_run_revision\\" AND resource.labels.service_name=\\"${SERVICE}\\" AND metric.type=\\"run.googleapis.com/request_count\\" AND metric.labels.response_code_class=\\"5xx\\"",
      "aggregations": [{"alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_SUM", "crossSeriesReducer": "REDUCE_SUM"}],
      "comparison": "COMPARISON_GT", "thresholdValue": 10, "duration": "0s",
      "trigger": {"count": 1}
    }
  }],
  "notificationChannels": ["${CH}"]
}
JSON
for P in uptime errors; do
  NAME=$(node -p "require('${TMP}/${P}.json').displayName")
  if gcloud alpha monitoring policies list --project "$PROJECT" --format='value(displayName)' | grep -qx "$NAME"; then
    echo "  기존 재사용: $NAME"
  else
    gcloud alpha monitoring policies create --project "$PROJECT" --policy-from-file="$TMP/${P}.json" >/dev/null
    echo "  생성: $NAME"
  fi
done
rm -rf "$TMP"
echo "✓ 완료 — 서버 다운(3분)·5xx(10건/5분)이면 ${EMAIL}로 메일. 콘솔: https://console.cloud.google.com/monitoring/alerting?project=${PROJECT}"
