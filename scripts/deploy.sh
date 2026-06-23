#!/usr/bin/env bash
# LENSMARK 배포 스크립트(IaC) — 운영 설정의 단일 출처(SSOT). DEPLOY.md 산문 → 실행 코드로 박제.
#   배경: 2026-06-12 bare `gcloud run deploy --source .`가 설정(env·시크릿)을 못 받아 부팅 차단(bootSafety)으로 실패.
#         설정이 문서에만 있으면 드리프트로 또 깨진다 → 매 배포가 전체 설정을 '명시'한다(부분 배포 금지).
#   사용:
#     bash scripts/deploy.sh            # 배포 + 검증(버전·store·연동·스모크)
#     bash scripts/deploy.sh verify     # 검증만(배포 없이 라이브 점검)
#     bash scripts/deploy.sh rollback   # 직전 정상 리비전으로 트래픽 되돌리기(빌드 없이 즉시)
#   요구: gcloud 로그인(divelab), Secret Manager에 lansmark-* 시크릿 7종(없으면 DEPLOY.md A-7b).
set -euo pipefail

# ───── 설정 SSOT(여기만 고친다 — 명령행/문서에 흩어진 복붙 금지) ─────
SERVICE="lansmark-api"
REGION="asia-northeast3"
PROJECT="lensmark-dev"
APP_ORIGIN="https://lensmark.kr"

ENV_VARS="NODE_ENV=production"
ENV_VARS+=",LANSMARK_STORE=firestore"                # 재배포 영속(A-7)
ENV_VARS+=",LANSMARK_DATA_DIR=/tmp/lansmark-data"
ENV_VARS+=",LANSMARK_REQUIRE_ENTITLEMENT=false"      # 무료 베타(유료 전환 시 이 두 줄 제거)
ENV_VARS+=",LANSMARK_ALLOW_OPEN_PAID=1"
ENV_VARS+=",LANSMARK_ANON_ONLY=1"                    # 익명 PII-0 쓰임검증 베타 — 회원가입·전화/푸시 구독 비활성(계정·알림 열려면 이 줄 제거)
ENV_VARS+=",LANSMARK_CORS_ORIGIN=${APP_ORIGIN}"
ENV_VARS+=",LANSMARK_APP_ORIGIN=${APP_ORIGIN}"
ENV_VARS+=",LANSMARK_TRUST_PROXY_HOPS=1"             # Firebase Hosting 1홉(레이트리밋 IP 정확)

SECRETS="LANSMARK_ENTITLEMENT_SECRET=lansmark-entitlement-secret:latest"
SECRETS+=",LANSMARK_ADMIN_TOKEN=lansmark-admin-token:latest"
SECRETS+=",LANSMARK_DATA_KEY=lansmark-data-key:latest"
SECRETS+=",VWORLD_API_KEY=lansmark-vworld-api-key:latest"
SECRETS+=",KMA_API_KEY=lansmark-kma-api-key:latest"
SECRETS+=",KAMIS_API_KEY=lansmark-kamis-api-key:latest"
SECRETS+=",KAMIS_API_ID=lansmark-kamis-api-id:latest"
# 선택 시크릿(만든 경우에만 자동 포함) — 실시간 경보 웹훅(v0.64)·병해충(NCPMS,v0.67)·외래 AI요약(Perplexity,v0.68). 없는 시크릿을 참조하면 배포가 깨지므로 존재 확인 후 추가. 미생성이면 해당 기능만 무중단 degrade(NCPMS=[]·AI=null·DEM은 무키라 무관).
for OPT in "LANSMARK_ALERT_WEBHOOK=lansmark-alert-webhook" "NCPMS_API_KEY=lansmark-ncpms-api-key" "PERPLEXITY_API_KEY=lansmark-perplexity-api-key"; do
  NAME="${OPT##*=}"
  if gcloud secrets describe "$NAME" --project "$PROJECT" >/dev/null 2>&1; then SECRETS+=",${OPT}:latest"; fi
done

URL="https://lansmark-api-397463229960.${REGION}.run.app"   # 검증용(커스텀 도메인 전이라 Run URL)

# ───── 검증(배포 후·또는 단독) — '배포됨'이 아니라 '의도대로 동작함'을 확인 ─────
verify() {
  echo "── 검증: ${URL}"
  local WANT V H
  WANT=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")
  V=$(curl -fsS --max-time 20 "${URL}/api/version" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.releases?j.releases[0].version:j.version)})")
  echo "  버전: 라이브 ${V} / 레포 ${WANT}"
  [ "$V" = "$WANT" ] || { echo "  ✗ 버전 불일치 — 빌드가 옛 코드일 수 있음"; exit 1; }
  H=$(curl -fsS --max-time 20 "${URL}/api/health")
  echo "$H" | grep -q '"store":"firestore"' || { echo "  ✗ store≠firestore — 영속 설정 누락(재배포 데이터 유실 위험)"; exit 1; }
  echo "$H" | grep -q '"kamisPrice":{"keyed":true,"live":true' || echo "  ⚠ KAMIS live 아님(시크릿 확인)"
  # 스모크: 시뮬 1건(엔진+실데이터 경로) — 한국어 에러/200 확인
  local CODE
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 -X POST "${URL}/api/simulate" -H "Content-Type: application/json" \
    -d '{"land":{"areaM2":3300,"soilEvidence":{"source":"none"}},"cropId":"apple","salesChannel":"mixed","region":"경상북도"}')
  [ "$CODE" = "200" ] || { echo "  ✗ /api/simulate ${CODE}"; exit 1; }
  echo "  ✓ 버전·store·시뮬 스모크 통과"
  # 커스텀 도메인 end-to-end 스모크 — 사용자 실제 경로(도메인→Hosting→Cloudflare→Cloud Run)까지 살아있는지.
  #   과거 serviceId 오타·통신사 IP 차단 류 장애를 '배포 단계'에서 포착. 단 도메인/DNS/Cloudflare는 배포와 타이밍이 달라 실패해도 경고만(비차단).
  local DCODE
  DCODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "${APP_ORIGIN}/api/version" || echo "000")
  if [ "$DCODE" = "200" ]; then echo "  ✓ 커스텀 도메인(${APP_ORIGIN}) end-to-end 200"; else echo "  ⚠ ${APP_ORIGIN} → ${DCODE} (앱은 Run URL로 검증됨) — Hosting/도메인/Cloudflare 경로 점검 필요"; fi
}

# ───── 롤백 — 직전 READY 리비전으로 트래픽 전환(빌드 없이 수 초) ─────
rollback() {
  echo "── 롤백: 최근 리비전 목록"
  gcloud run revisions list --service "$SERVICE" --region "$REGION" --project "$PROJECT" \
    --format='table(metadata.name,status.conditions[0].status,metadata.creationTimestamp)' --limit 5
  local PREV
  PREV=$(gcloud run revisions list --service "$SERVICE" --region "$REGION" --project "$PROJECT" \
    --format='value(metadata.name)' --filter='status.conditions.status:True' --sort-by='~metadata.creationTimestamp' --limit 2 | tail -1)
  [ -n "$PREV" ] || { echo "✗ 롤백 대상 리비전 없음"; exit 1; }
  echo "→ ${PREV}(직전 정상)으로 100% 전환"
  gcloud run services update-traffic "$SERVICE" --region "$REGION" --project "$PROJECT" --to-revisions "${PREV}=100"
  verify || true   # 롤백 후 버전은 레포보다 낮을 수 있음 — 헬스만 참고
}

# ───── Hosting 배포 — firebase.json(rewrite serviceId 등) 변경을 라이브에 반영 ─────
#   배경: gcloud run deploy는 Cloud Run만 갱신 — Hosting rewrite(도메인→Cloud Run 라우팅)는 별도 배포 필요.
#         serviceId가 실제 서비스(lansmark-api)와 어긋나면 Hosting이 백엔드를 못 찾아 사이트 전체 연결 실패.
#         firebase CLI 부재 시 Cloud Run 배포까지의 성공을 깨지 않도록 '경고 후 통과'(hard-fail 금지).
hosting() {
  if ! command -v firebase >/dev/null 2>&1; then
    echo "  ⚠ firebase CLI 없음 — Hosting 미배포. 수동 실행 필요: firebase deploy --only hosting --project ${PROJECT}"
    return 0
  fi
  echo "── Hosting 배포: rewrite(** → Cloud Run ${SERVICE}) 반영 @ ${PROJECT}"
  firebase deploy --only hosting --project "$PROJECT"
}

case "${1:-deploy}" in
  verify)   verify ;;
  rollback) rollback ;;
  hosting)  hosting ;;
  deploy)
    echo "── 배포: ${SERVICE} @ ${REGION} (전체 설정 명시 — 드리프트 0)"
    # 철자 footgun 가드 — firebase.json rewrite serviceId가 SERVICE와 일치하는지(lensmark↔lansmark 오타로 인한 사이트 전체 장애 사전 차단).
    FB_SVC="$(node -e "const j=require('./firebase.json');const r=(j.hosting.rewrites||[]).find(x=>x.run);process.stdout.write((r&&r.run&&r.run.serviceId)||'')" 2>/dev/null || true)"
    [ "$FB_SVC" = "$SERVICE" ] || { echo "  ✗ firebase.json serviceId('$FB_SVC') ≠ SERVICE('$SERVICE') — lensmark/lansmark 철자 불일치 → 배포 중단(과거 전체 장애 원인)"; exit 1; }
    # 안정화(2026-06): memory 512Mi→1Gi(Node/tsx OOM 재시작 방지) + --cpu-boost(시작/재시작 시 CPU 부스트로 빠르고 안정적 부팅).
    #   ⚠ min=0(scale-to-zero)·max=1 — 무료 운영(2026-06-23 사용자 결정: "비용 안 내고 싶다, 무료로"). firestore blob 어댑터는 단일 인스턴스 정합 전제(동시 1=max).
    #     비용: min=0 → 무트래픽 시 인스턴스 0개=과금 0(Cloud Run 무료 티어 내) → 사실상 $0. (min=1은 24/7 풀CPU 상주 ~$30-50/월이라 사용자가 거부.)
    #     ⚠ 먹통 이력·완화: 과거 min=0 콜드스타트 OFFLINE_HTML 먹통(06-22, SW v3) → SW v4~v10(캐시 앱셸 SWR·버전 자동갱신)으로 차단. 먹통 재발 시 min=1 즉시 복귀.
    #     💰 0원 설정(2026-06-23 사용자 "다 꺼·0원"): no-cpu-throttling 제거 → --cpu-throttling(request-based CPU). 인스턴스가 깨어있어도 '요청 처리 시간'만 과금
    #        (이전 no-cpu-throttling = Instance-based billing = idle 인스턴스도 풀CPU 과금 = 6월 ₩67,712 폭증의 주범). min=0 + request-based = 무트래픽 시 $0.
    #        ⚠ trade-off: blob write-through의 background flush가 응답 후 CPU를 덜 받을 수 있음 → 단 무트래픽이라 쓰기 거의 0·SIGTERM flushStores(종료 시 flush)는 동작 → 실질 위험 낮음. 트래픽 상시화 시 재검토.
    gcloud run deploy "$SERVICE" --source . --region "$REGION" --project "$PROJECT" \
      --allow-unauthenticated --min-instances 0 --max-instances 1 \
      --memory 1Gi --cpu 1 --concurrency 80 --cpu-throttling --cpu-boost \
      --set-env-vars "$ENV_VARS" \
      --set-secrets "$SECRETS" \
      --quiet
    hosting   # Hosting rewrite도 함께 반영(firebase.json 변경이 라이브에 닿도록 — SSOT 일원화)
    verify
    echo "✓ 배포+검증 완료. 문제 시: bash scripts/deploy.sh rollback"
    ;;
  *) echo "사용: bash scripts/deploy.sh [deploy|verify|rollback|hosting]"; exit 1 ;;
esac
