# DEPLOY.md — LENSMARK 배포 런북 (도메인: lensmark.kr)

> **택1 아키텍처: [A] Firebase Hosting + Cloud Run (선택·권장)** · [B] VPS+nginx(대안).
> 데이터 통합 키는 `RUN_GOLIVE.md`. ⚠ **HUMAN GATE(사장님 직접)**: 인증·콘솔·DNS·TLS·비밀값 생성·과금. 코드/AI는 설정·런북만.
> ⚠ 철자: 도메인 `lensmark.kr`(lens-) ↔ 코드 식별자 `LANSMARK`(lans-) — 의도된 구분.

## 0) 역할 분리
| 준비됨(레포) | 사람이 실행(인증·과금·콘솔) |
|---|---|
| `Dockerfile`·`.dockerignore`·`firebase.json`·`.firebaserc`·`npm run start`·`.env.example` | `firebase login`·`gcloud auth`·시크릿 생성/주입·`gcloud run deploy`·`firebase deploy`·도메인 연결 |

---

# [A] Firebase Hosting + Cloud Run (권장)

```
사용자 → https://lensmark.kr → [Firebase Hosting: TLS·CDN·도메인] → (rewrite **) → [Cloud Run: lensmark-api]
                                                                                       └ 현재 Node 서버를 컨테이너로 그대로 실행
```

## A-1. 사전 준비(1회)
```bash
# gcloud 설치: https://cloud.google.com/sdk/docs/install
gcloud auth login && gcloud config set project lensmark-dev
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
firebase login
```
> Firebase 콘솔에서 **Blaze(종량) 요금제** 활성화 필요(Cloud Run/Build 전제). 무료 등급 내 사용 가능.

## A-2. 운영 시크릿 (HUMAN GATE — 레포에 두지 않음)
`NODE_ENV=production`이면 서버가 **fail-closed 부팅 점검**: `LANSMARK_ENTITLEMENT_SECRET` 필수 · `CORS_ORIGIN=*` 거부 · 관리자 토큰 없으면 콘솔 오픈 거부.
```bash
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create lansmark-entitlement-secret --data-file=-
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create lansmark-admin-token       --data-file=-
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create lansmark-data-key           --data-file=-   # at-rest 키(분실=복구불가·백업!)
PROJ_NUM=$(gcloud projects describe lensmark-dev --format='value(projectNumber)')
for S in lansmark-entitlement-secret lansmark-admin-token lansmark-data-key; do
  gcloud secrets add-iam-policy-binding $S \
    --member="serviceAccount:${PROJ_NUM}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```
> 외부 API 키(VWORLD/KMA/KAMIS/Toss 등)는 확보된 것만 같은 방식으로 추가 → 아래 `--set-secrets`에 매핑(없으면 mock 폴백).

## A-3. Cloud Run 배포(API)
```bash
gcloud run deploy lensmark-api \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --min-instances 1 --max-instances 1 \
  --memory 512Mi --cpu 1 --concurrency 80 \
  --set-env-vars NODE_ENV=production,LANSMARK_STORE=file,LANSMARK_DATA_DIR=/tmp/lansmark-data,LANSMARK_REQUIRE_ENTITLEMENT=false,LANSMARK_ALLOW_OPEN_PAID=1,LANSMARK_CORS_ORIGIN=https://lensmark.kr,LANSMARK_APP_ORIGIN=https://lensmark.kr,LANSMARK_TRUST_PROXY_HOPS=1 \
  --set-secrets LANSMARK_ENTITLEMENT_SECRET=lansmark-entitlement-secret:latest,LANSMARK_ADMIN_TOKEN=lansmark-admin-token:latest,LANSMARK_DATA_KEY=lansmark-data-key:latest
```
- `--source .` → Cloud Build가 `Dockerfile`로 빌드. **서비스명·리전은 `firebase.json` rewrite와 일치**(`lensmark-api`/`asia-northeast3`).
- `REQUIRE_ENTITLEMENT=false` = 무료 베타(유료 OFF). ⚠ **운영에선 무료 베타가 fail-closed로 부팅 차단**되므로 의도적 우회 표시 `LANSMARK_ALLOW_OPEN_PAID=1`을 반드시 함께 준다(없으면 부팅 거부). 유료 정식 시 둘 다 제거. `TRUST_PROXY_HOPS=1` = Hosting 1홉(레이트리밋 IP 정확).
- min=max=1 단일 인스턴스 = 파일 스토어가 인스턴스 수명 동안 유지 + 콜드스타트 없음(dev 적합).

## A-4. Hosting 배포(TLS·CDN·도메인 → rewrite)
```bash
firebase deploy --only hosting --project lensmark-dev
# → https://lensmark-dev.web.app (모든 경로가 Cloud Run lensmark-api로 rewrite)
```

## A-5. 커스텀 도메인(lensmark.kr)
Firebase 콘솔 → Hosting → 커스텀 도메인 → `lensmark.kr` → 표시 A/TXT를 DNS 등록 → 자동 SSL. 발급 후 `APP_ORIGIN`/`CORS_ORIGIN`이 도메인과 일치하는지 확인(불일치 시 매직링크·CORS 깨짐).

## A-6. 검증(스모크)
```bash
BASE=https://lensmark-dev.web.app   # 또는 https://lensmark.kr
curl -s $BASE/api/version           # {"version":"0.45.0",...}
curl -s -o /dev/null -w "%{http_code}\n" $BASE/app    # 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/account/me   # 401(미로그인 정상)
```
모바일: 도메인을 휴대폰 Chrome → 웰컴/지도 + ⋮ "홈 화면에 추가"(PWA 설치).

## A-7. 영속(LANSMARK_STORE=firestore — §3-1 권장)
재배포에도 상태(계정·세션·일지·실측·quota/실효·멱등·감사로그)가 보존된다. 무의존성 REST(키 파일 불필요 — Cloud Run 메타데이터 토큰).
```bash
gcloud services enable firestore.googleapis.com
gcloud firestore databases create --location=asia-northeast3      # 서울 리전(PII 국내) · 1회
PROJ_NUM=$(gcloud projects describe lensmark-dev --format='value(projectNumber)')
gcloud projects add-iam-policy-binding lensmark-dev \
  --member="serviceAccount:${PROJ_NUM}-compute@developer.gserviceaccount.com" --role="roles/datastore.user"
gcloud run services update lensmark-api --region asia-northeast3 --update-env-vars LANSMARK_STORE=firestore \
  --no-cpu-throttling   # ⚠ 필수 — 익명 계측 디바운스 타이머가 idle 중 발화하려면 CPU always(A-8). scale-to-zero 유지(트래픽 0이면 과금 0)
```
검증: `/api/health`의 `store:"firestore"` + 일지 생성 → 재배포 → 일지 유지.
> ✅ **lensmark-dev 전환 완료(2026-06-10 · `store:firestore`)** — 재배포 생존 실증: 실측 1건 → 재배포(인스턴스 완전 교체) → **records=2**(부팅 워밍이 기존을 로드해 이어씀 · file/`tmp`였다면 0). 유료 게이트 ON/OFF 라이브 토글도 검증(무권한 `/api/simulate` 402↔400). DB·IAM은 위 1회 스크립트로 구성 완료.

## A-7b. 외부 API 실데이터(VWorld·KMA·KAMIS) — mock→live
키는 `.env`(사장님 발급·HUMAN GATE) → Secret Manager(값 비노출·stdin) → Cloud Run `--update-secrets`. Toss/webhook(결제)은 유료 정식 때 별도.
```bash
PROJ_NUM=$(gcloud projects describe lensmark-dev --format='value(projectNumber)')
for K in VWORLD_API_KEY KMA_API_KEY KAMIS_API_KEY KAMIS_API_ID; do
  S="lansmark-$(echo $K | tr 'A-Z_' 'a-z-')"
  printf '%s' "$(grep "^$K=" .env | cut -d= -f2- | tr -d '\"')" | gcloud secrets create "$S" --data-file=- --replication-policy=automatic
  gcloud secrets add-iam-policy-binding "$S" --member="serviceAccount:${PROJ_NUM}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
done
gcloud run services update lensmark-api --region asia-northeast3 --update-secrets \
  "VWORLD_API_KEY=lansmark-vworld-api-key:latest,KMA_API_KEY=lansmark-kma-api-key:latest,KAMIS_API_KEY=lansmark-kamis-api-key:latest,KAMIS_API_ID=lansmark-kamis-api-id:latest"
```
✅ 검증(2026-06-10): `/api/health` **5종 live**(타일·주소·필지·기후·시세) · `/api/geocode` 실좌표 · `/api/parcel` 실 PNU(4111313…) · `/api/simulate` apple 시세 P50 **9,086원/kg**. **미전환(정직)**: `vworldDem`(3D DEM 파싱 미구현·TODO) · Toss/webhook(유료 정식) · `rdaIncome`(RDA 소득자료 CSV 수령=HUMAN GATE → 소득 base는 아직 demo·`dataLabel:estimated`).

## A-8. ⚠ 한계
- **firestore 미사용 시 상태 휘발**: 파일스토어는 재배포/회수에 초기화 — A-7로 전환 권장(베타 데이터 보호).
- firestore 어댑터는 **단일 인스턴스 내구성**용(blob-per-store·문서 1MiB) — 다중 인스턴스 정합(유니크 제약·락)은 per-record 승격 후(§3-1 잔여 · max-instances>1 올리기 전 필수).
- **analytics(익명 수요·퍼널)** — 디바운스 write-through(첫 변경 후 5s 또는 25건 중 빠른 쪽 · v0.48.0)로 재배포 유실을 ≤5s로 한정. ⚠ 단 디바운스 타이머는 **Cloud Run `--no-cpu-throttling` 필요** — 미설정 시 idle CPU throttle로 타이머가 안 발화해 유실(라이브 실증: 미설정 6건 중 3건 유실 → 설정 후 idle 8s에도 6건 전부 영속). A-7 명령에 포함. 계정·세션·일지·실측·quota/실효 등 핵심 데이터는 write-through라 재배포 완전 생존.
- 무료 베타로 시작 → 유료 전환은 ops 토글 + 결제 키 + §3-1 잔여.
- 발송 키 전까지 로그인/알림은 dev 표시·fail-closed. 롤백: `gcloud run services update-traffic lensmark-api --to-revisions PREV=100`.

---

# [B] VPS + nginx (대안 — 영속 디스크가 필요/Firebase 미사용 시)

> 현재 파일 스토어가 **영구 디스크에 보존**됨(Cloud Run의 휘발 한계 없음). 단일 서버 운영.

```
사용자 → https://lensmark.kr → [nginx :443 TLS] → [Node 앱 127.0.0.1:8787 · pm2/systemd]
```
- Node 20 + `npm ci`(tsx 포함) · 데이터 디렉터리 `sudo mkdir -p /var/lib/lansmark/data && chown $USER … && chmod 700 …`
- env: `cp .env.example .env` → `NODE_ENV=production` · 비밀 3종 생성(`openssl rand -hex 32`) · `LANSMARK_CORS_ORIGIN=https://lensmark.kr` · `LANSMARK_TRUST_PROXY_HOPS=1` · `LANSMARK_DATA_DIR=/var/lib/lansmark/data`. (미충족 시 부팅 거부=fail-closed)
- 실행(pm2): `pm2 start "npx tsx server/devServer.ts" --name lansmark --cwd <프로젝트> && pm2 save && pm2 startup`
- nginx:
```nginx
server {
  listen 443 ssl http2;  server_name lensmark.kr www.lensmark.kr;
  ssl_certificate /etc/letsencrypt/live/lensmark.kr/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/lensmark.kr/privkey.pem;
  location / { proxy_pass http://127.0.0.1:8787; proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
}
server { listen 80; server_name lensmark.kr www.lensmark.kr; return 301 https://$host$request_uri; }
```
- 인증서: `sudo certbot --nginx -d lensmark.kr -d www.lensmark.kr` · DNS: A(lensmark.kr→서버IP)·CNAME(www). (Cloudflare 프록시 ON이면 `TRUST_PROXY_HOPS=2`)

---

## 공통 출시 전 체크리스트
- [ ] `NODE_ENV=production` + 비밀 3종(ENTITLEMENT_SECRET·ADMIN_TOKEN·DATA_KEY) 생성·주입
- [ ] CORS = lensmark.kr (전체허용 `*` 아님) · TLS/HTTPS 정상
- [ ] `APP_ORIGIN` = 실제 도메인(매직링크) · 부팅 로그에 `[SECURITY]` 경고 없음
- [ ] `/terms`·`/privacy` 초안 → **법무 검토 후 확정**(공개·PII 수집 전제)
- [ ] (무료 베타) `REQUIRE_ENTITLEMENT=false` + **`LANSMARK_ALLOW_OPEN_PAID=1`**(운영 부팅 차단 우회 — 무료 베타 의도 표시). 둘 없으면 운영 부팅 거부
- [ ] (유료 정식 — Phase 2) Firestore 어댑터(§3-1) · 실 RDA 소득 · Toss 라이브 키 · 약관 확정
