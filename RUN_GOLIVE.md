# RUN_GOLIVE.md — "API만 붙이면 운영" 체크리스트

LANSMARK는 provider seam(mock↔live)으로 설계돼 **키를 추가하면 그 통합만 점진적으로 운영 전환**된다 (`LANSMARK_DATA_MODE=auto` 기본). 미구현/미키 통합은 **mock 폴백**이라 크래시 없이 무중단.

## 1) 준비
`cp .env.example .env` → 아래 키 채우기. 통합별 준비도는 **`GET /api/health`**로 확인(`integrations.*.keyed/live`).

## 2) 키 → 무엇이 켜지나
| 키 | 켜지는 것 | 상태 |
|---|---|---|
| `VWORLD_API_KEY` | 위성/하이브리드 **타일**, 주소→좌표/PNU **geocode**, **필지경계** parcel | ✅ 실구현 |
| 〃 (DEM) | **지형**(경사/향/표고) | ⚠ 3D DEM 응답 파싱 미구현 → mock 폴백. `geo/dem.ts fetchDem` 완성 필요 |
| `KMA_API_KEY` | **기후**(최저기온/서리/강수) | ⚠ ASOS 응답 파싱 미구현 → mock 폴백. `geo/kma.ts fetchClimate`(격자변환·URL은 구현됨) |
| `KAMIS_API_KEY` + `KAMIS_API_ID` | **도매가** P10/50/90 | ✅ 실구현 — 단 `data/providers/kamisItemCodes.ts` 품목코드 `verified:true` 필요(아니면 base 폴백) |
| `TOSS_CLIENT_KEY` + `TOSS_SECRET_KEY` | **실결제**(카드/간편) | ✅ 실구현(confirm) |
| `PG_WEBHOOK_SECRET` | 웹훅 서명검증 | ✅ 실구현(HMAC) |
| `LANSMARK_ENTITLEMENT_SECRET` | 유료권한 토큰 서명 | ✅ 운영은 **강한 랜덤값 필수**(dev 기본값 금지) |
| (실 RDA 소득자료) | 소득 base 정상화(음수 placeholder 해소) | `data/rdaIncome.ts getRdaBase` 로더 교체 → `verified:true` |

## 3) 운영 스위치(.env)
- `LANSMARK_DATA_MODE=auto` (기본) — 키 있는 통합만 live. `live`로 강제도 가능(키 없으면 throw, 운영 강제용).
- `LANSMARK_REQUIRE_ENTITLEMENT=true` (기본) — 정밀 시뮬 결제 강제(서버 게이트).
- `LANSMARK_SIM_PRICE_KRW=4900` — 정밀분석 단가.

## 4) 남은 실구현 (공식 docs 확인 후 — 추측 금지)
1. **VWorld 3D Data API(DEM)** 부분요청·높이격자 파싱 → `geo/dem.ts fetchDem`
2. **KMA ASOS/평년값** 고정폭 텍스트 파싱 → `geo/kma.ts fetchClimate`
3. **KAMIS 품목코드** 검증 → `data/providers/kamisItemCodes.ts`(`verified:true`)
4. **RDA 농축산물 소득자료** 로더 → `data/rdaIncome.ts`

→ 이 4개를 채우면 전 기능 live. 그 전까지도 **auto 폴백으로 무중단 운영** 가능(타일·필지·주소검색·결제는 키만 꽂으면 즉시 live).

## 5) 검증
`npm run typecheck && npm test` (tsc + vitest 그린) → `GET /api/health`로 통합별 keyed/live 확인 → 결제 흐름(잠금→결제→해제) 점검.

---

## 6) 🔴 P0 오픈 체크리스트 — 사용자 받기 전 '반드시'(2026-06-12 기준 현황)

### 6-1. lensmark.kr 도메인 연결 (사장님 · ~20분 + 전파 대기)
현황: **미연결**(`lensmark.kr` → 응답 없음 — 사용자가 "안 떠요"의 1순위 원인). 작동 주소는 Cloud Run URL뿐.
1. [Firebase 콘솔](https://console.firebase.google.com/project/lensmark-dev/hosting) → Hosting → **커스텀 도메인 추가** → `lensmark.kr`(+`www.lensmark.kr`).
2. 콘솔이 보여주는 **TXT(소유 확인) → A 레코드 2개**를 **hosting.co.kr DNS 관리**에 그대로 등록(값은 콘솔 표시값만 — 임의 IP 금지).
3. 상태가 '연결됨' + 자동 SSL 발급(보통 수 시간~48h). 그 동안 사이트는 `https://lensmark-dev.web.app`으로도 동작.
4. 발급 후 스모크: `curl -s https://lensmark.kr/api/version` → 200.
   (서버 `LANSMARK_APP_ORIGIN/CORS_ORIGIN`은 이미 `https://lensmark.kr` — 추가 작업 없음.)

### 6-2. 실시간 경보 웹훅 (사장님 · ~5분)
현황: 코드 완료(v0.64 — 새 클라이언트 에러 즉시 푸시) · **URL만 미설정**.
1. Slack: 워크스페이스 → 앱 'Incoming Webhooks' → 채널 지정 → Webhook URL 복사. (또는 Discord: 채널 설정 → 연동 → 웹후크.)
2. 시크릿으로 주입(값 비노출):
   ```bash
   printf '%s' '<WEBHOOK_URL>' | gcloud secrets create lansmark-alert-webhook --data-file=- --replication-policy=automatic
   PROJ_NUM=$(gcloud projects describe lensmark-dev --format='value(projectNumber)')
   gcloud secrets add-iam-policy-binding lansmark-alert-webhook --member="serviceAccount:${PROJ_NUM}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
   bash scripts/deploy.sh   # deploy.sh가 시크릿 존재를 감지해 자동 포함
   ```

### 6-3. 서버 다운·5xx 경보 (1회 · 1줄)
현황: 미설정(서버가 죽어도 능동 알림 없음).
```bash
ALERT_EMAIL=<사장님 이메일> bash scripts/setupMonitoring.sh
```
→ 업타임 체크(1분 간격) + '다운 3분'·'5xx 10건/5분' 이메일 경보 생성(무료 한도 내·멱등).

### 6-4. 배포·롤백 — 항상 스크립트로 (드리프트 0)
2026-06-12 bare 배포가 설정 누락으로 실패한 재발 방지 — **설정 SSOT는 `scripts/deploy.sh`**:
```bash
npm run deploy            # 배포 + 자동 검증(버전·store·시뮬 스모크)
bash scripts/deploy.sh verify     # 라이브 점검만
bash scripts/deploy.sh rollback   # 직전 정상 리비전 즉시 복귀
```

### 6-5. 부하 한계(실측 2026-06-12 · mock 로컬·동시 50)
`npm run load` — 엔진 `/api/simulate` **~17,800 RPS**(p50 1–3ms·5xx 0) · `/app` HTML **~423 RPS**(요청당 gzip이 병목). 베타(30–50명) 대비 수천 배 여유 — 실제 한계는 설계상 레이트리밋(IP당 240/분)이 먼저. ⚠ 부하는 **mock 로컬에만**(하니스가 라이브 대상이면 거부).

### 6-6. 남은 HUMAN GATE(오픈엔 비차단)
법무 검토(처리방침·약관) · Toss live 키(유료 전환 시) · 농사로 승인(대기) · RDA 미수록 6작물(쌀·마늘·양파·콩·도라지·옥수수=별도 조사).
