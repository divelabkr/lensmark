# HUMAN GATE — 외부연동 발급/신청 체크리스트

> **목적**: LANSMARK가 코드로는 못 넘는 벽(사장님이 직접 키 발급·활용신청·약관동의·계정생성 하셔야 하는 부분)을 한 곳에 정리.
> **원칙**: 보안상 키 입력·활용신청·결제·약관동의·계정생성은 **사장님이 직접** 하십니다(저는 빈 템플릿만 만들고 값 노출 없이 읽어 씁니다).
> **정직성(CLAUDE.md #4)**: 키 없이 실응답을 못 받으면 **파서를 날조하지 않습니다**. seam은 `SHAPE_UNVERIFIED`로 막아두고, 키 확보 후 **실샘플을 캡처해 파서를 작성→슬라이스 승격**합니다.
> 조사일 2026-06-05 · 확신도(HIGH/MED/UNCERTAIN)와 출처를 함께 표기. UNCERTAIN은 로그인/JS 게이트로 공개검색 캡처가 막힌 부분 — 포털 로그인 후 명세서로 확정.

## 한눈에 — 환경변수 매핑

| 통합 | 환경변수(`.env`) | 발급처 | 신청 후 즉시? | seam 파일 |
|---|---|---|---|---|
| 기상특보 | (기존 `KMA_API_KEY` 재사용) | apihub.kma.go.kr | 예 — **활용신청 클릭** 필요(자동승인) | `integrations/kmaWarning.ts` |
| NCPMS 병해충 | `NCPMS_API_KEY` | ncpms.rda.go.kr | 활용신청 후(승인방식 UNCERTAIN) | `integrations/ncpms.ts` |
| **국내** 재배정보 | `NONGSARO_API_KEY` | nongsaro.go.kr | 신청 후(휴대폰 인증·승인) | `integrations/nongsaro.ts` |
| **외래** 재배정보 | `PERENUAL_API_KEY` · `TREFLE_TOKEN` | perenual.com · trefle.io | 예 | `integrations/plantDetail.ts` |
| 농업 지원금 | `DATA_GO_KR_SERVICE_KEY` | data.go.kr | 예(자동승인) | `integrations/publicSupport.ts` |
| 브라우저 푸시 | `LANSMARK_VAPID_PUBLIC_KEY` · `..._PRIVATE_KEY` · `..._SUBJECT` | **자체 생성** | 즉시(외부 발급 없음) | `integrations/push.ts` |
| 모니터링 크론 | `LANSMARK_MONITOR_CRON=1` | (인프라·자체) | 즉시 | `integrations/scheduler.ts` |

현재 준비 현황은 코드로 확인: `listIntegrations()` (`src/lansmark/integrations/index.ts`) — 키 **존재 여부만** 노출(값 비노출).

---

## 1. 기상청 기상특보 (주의보/경보)

- **핵심**: 새 키 불필요 — **기존 `KMA_API_KEY` 그대로**. 다만 apihub는 **API마다 '활용신청' 버튼**을 눌러야 그 엔드포인트가 열립니다. 특보에서 **403은 키 문제가 아니라 '특보 API 활용신청 미완료'**(자동승인이라 클릭만 하면 됨).
- **할 일**: ① https://apihub.kma.go.kr 로그인 → ② **예특보 카테고리**에서 특보 자료 조회 메뉴(메뉴 ID `seqApi=10`·`seqApiSub=288`은 **변동 가능·로그인 후 확인**) → ③ **[API 활용신청] 클릭**(자동승인) → ④ 마이페이지에서 신청현황 확인.
- **엔드포인트**: base `https://apihub.kma.go.kr/api/typ01/url/` · `wrn_now_data.php`(현재 특보) · `wrn_reg.php`(구역코드). 파라미터 `authKey`(+`disp`/`help`).
- **응답**: 고정폭 텍스트(JSON 아님) · 무료 · 호출한도 일 ~10만건(**운영계정 기준·미검증**).
- **확신도**: authKey·무료·자동승인 **HIGH** / 엔드포인트명·파라미터·**포털 메뉴 ID·호출한도 MED**(로그인 게이트로 원문 미캡처 — 변동 가능).
- **승격 시 할 일(저)**: 활용신청 후 `wrn_now_data.php?help=1` 실샘플 캡처 → 고정폭 컬럼 확정 → `parseWarnings` 구현 → agri-alerts에 실특보 합류.
- 출처: apihub.kma.go.kr · `/api/typ01/url/wrn_reg.php` · `/static/html/attach/wrn_table.html`

## 2. NCPMS 병해충 예찰·발생 (농촌진흥청)

- **핵심**: 병해충 OpenAPI. **키 경로 2가지 중 택1** — (A) NCPMS 자체 `apiKey`(ncpms.rda.go.kr) 또는 (B) data.go.kr `serviceKey`. **두 키는 다릅니다**(혼용 불가).
- **할 일**: ncpms.rda.go.kr OpenAPI 안내에서 apiKey 발급(또는 data.go.kr에서 해당 데이터셋 활용신청) → `.env`의 `NCPMS_API_KEY`.
- **엔드포인트**: `http://ncpms.rda.go.kr/npmsAPI/service` · 파라미터 `apiKey`·`serviceCode`. 응답 **XML** · 무료.
- **용어 구분**: **발생정보**=기상기반 예측/발생위험(실시간) vs **예찰정보**=현장 전문가 조사 — 서로 다른 데이터셋.
- **확신도**: base·apiKey·XML·`SVC05`(병해충 상세) **HIGH** / **발생·예찰 전용 serviceCode(SVC01/08 등) UNCERTAIN** — NCPMS 안내(JS 렌더링)에서 코드표 확인 필요. http 예시라 운영 https 가능 여부도 확인.
- **승격 시 할 일(저)**: serviceCode 확정 → 실 XML 샘플 캡처 → `parseNcpms` 구현 → agri-alerts 실예찰 합류.
- 출처: data.go.kr/data/15058504·15058192 · ncpms.rda.go.kr

## 3. 식물 재배정보 — 국내(농사로) / 외래(Perenual)

> **두 소스는 역할이 다릅니다(교체 아님)**: 국내 작물은 **농사로(권위·무료)**, 국내 DB에 없는 **외래작물은 Perenual**. 한국 소스는 외래작물 재배법을 주지 않습니다.

### 3-A. 국내 작물 — 농사로(농진청) ★권장
- **핵심**: 국내 작물 재배시기·관수·품종·병해충. 우리 국내 재배가이드(`cultivationGuide`)를 **데모 룰북 → 실 RDA 데이터**로 격상.
- **할 일**: ① https://www.nongsaro.go.kr/portal/ps/psz/psza/contentMain.ps?menuId=PS00191 → ② **본인 휴대폰 인증 → OpenAPI 신청 → 승인 → 신청내역에서 apiKey 확인**(자동/즉시승인 여부 UNCERTAIN) → ③ `.env`의 `NONGSARO_API_KEY`.
- **엔드포인트**(HTTP 실측): `http://api.nongsaro.go.kr/service/{serviceName}/{operationName}?apiKey=...&apiType=xml|json` (예: `/service/garden/lightList` → 200). 미등록 키 → `resultCode=11`.
- **제공**(HIGH): 품목별 관리메뉴얼(재배 시기·방법) · 텃밭작물 재배캘린더(생육단계별 관수). **국내 작물 한정**.
- **확신도**: base·apiKey·XML/JSON **HIGH(실측)** / 텃밭·품종 `serviceName` 문자열·출력필드·**일 호출한도 UNCERTAIN**(공식 수치 미게시 — data.go.kr 표준 1,000~10,000/일은 별개 포털 값) → 발급 후 서비스목록(133종)에서 확정.
- **승격 시 할 일(저)**: serviceName/필드 실샘플 확정 → `parseNongsaro` 구현 → `/api/guide` 국내 가이드를 실데이터로.
- 출처: nongsaro.go.kr/portal/ps/psz/psza/contentMain.ps · api.nongsaro.go.kr/sample · rda.go.kr/etc/api

### 3-B. 외래작물 — Perenual(우선) · Trefle(폴백)
- **핵심**: 국내 DB에 없는 외래·임의 작물의 관수/일조/내한성(기존 GBIF+위키 보강). **Perenual 우선**(무료 100/일), **Trefle 폴백**(불안정 — `/search` 500 반복).
- **할 일**: Perenual https://perenual.com/user/developer 가입 → `key` → `PERENUAL_API_KEY`. (선택) Trefle → `token` → `TREFLE_TOKEN`.
- **엔드포인트**: Perenual `https://perenual.com/api/v2/`(`species-list`, `species-care-guide-list`, `key`) · Trefle `https://trefle.io/api/v1/`(`token`). JSON.
- **비용**: Perenual **Free 100건/일**(캐싱 필수) · 유료(조사 시 예: $59.99/$139.99·월 — **변동 가능, perenual.com/subscription-api-pricing 확인**) · Trefle 무료 120/분.
- **확신도**: base·키·JSON·무료 100/일 **HIGH** / 유료 가격·필드 매핑 **변동·실샘플 후**(추측 금지). 영어 데이터 위주.

### 3-C. 참고 — 재배정보 seam 아님(정직성)
- **국립수목원/산림청**(nature.go.kr · data.go.kr 15000312): 식물 **종·학명·도감** 메타만 — **재배법 없음**. 구 API(15000236) 폐지. → 종 식별 보조용이지 재배정보 소스 아님(현재 seam 미생성).
- **AI-Hub**(aihub.or.kr): **실시간 API 없음 = 벌크 다운로드**(작물 질병 이미지 등 ML 학습데이터). **내국인·학습용 한정·해외반출 곤란**. → 연동 키 대상이 아니라 오프라인 데이터셋(현재 seam 미생성).

## 4. 공공데이터 농업 지원금 (data.go.kr)

- **핵심**: 개인 농장주 셀프서비스엔 **보조금24/공공서비스 혜택 정보**(data.go.kr `15113968`)가 최적 — `serviceKey`·JSON+XML·무료·**자동승인**.
- **할 일**: data.go.kr 가입 → 15113968 페이지에서 **활용신청**(자동승인) → 발급된 `serviceKey`(디코딩 키 권장)를 `.env`의 `DATA_GO_KR_SERVICE_KEY`.
- **확신도**: serviceKey·JSON+XML·무료·자동승인·개발 1만건 **HIGH** / **정확한 오퍼레이션명·엔드포인트 경로 UNCERTAIN**(명세서 확인) — 그래서 seam은 base를 추측하지 않고 `withServiceKey(전체endpoint, key)`로 둠.
- **주의**: 보조금24는 **전 부처 혜택 포함**(농업 전용 아님) → 농업 분야 필터링 필요. **AgriX(농림사업)** 는 수혜이력까지 주지만 '지자체→농정원 심의 승인'이라 개인 즉시발급 불가(기관용). 농식품부 보조금 상당수는 파일데이터(CSV)라 실시간 OpenAPI 아님.
- **승격 시 할 일(저)**: 명세서에서 오퍼레이션 경로 확정 → 실샘플 → 농업 필터 + `parsePublicSupport` 구현 → `/api/support` 실시간 보강.
- 출처: data.go.kr/data/15113968/openapi.do · uni.agrix.go.kr(기관용)

## 5. 브라우저 푸시 (VAPID) — 외부 키 불필요

- **핵심**: 서드파티 키 **없음**. VAPID 키쌍은 **자체 생성**(1회). 푸시 서비스 엔드포인트는 **브라우저가 구독으로 제공**.
- **할 일**: ① 키 생성 — `npx web-push generate-vapid-keys` (또는 openssl prime256v1) → 공개키 `LANSMARK_VAPID_PUBLIC_KEY`, 개인키 `LANSMARK_VAPID_PRIVATE_KEY`(**비밀**), `LANSMARK_VAPID_SUBJECT=mailto:...`. ② 클라이언트 service worker + `pushManager.subscribe(applicationServerKey=공개키)` → 구독 저장.
- **구현 난이도(HUMAN GATE 결정)**: 표준이 VAPID JWT **ES256** + 페이로드 **aes128gcm**(RFC 8292/8188)이라 무의존성 직접구현은 오류 유발 → **`web-push`(npm) 도입 권장**. 무의존성 원칙을 깰지 = 승격 시 사장님 결정.
- **주의**: iOS Safari는 **홈화면 추가(PWA 설치) 후에만** 웹푸시 허용 → 모바일 안내 필요.
- **확신도**: **HIGH**(RFC 8292/8188 · web-push 공식). 현재 코드: `createPushSender()`가 미설정/미구현이면 `ConsolePushSender`(미전송·`ok:false`)로 **거짓 'live' 라벨 없이** 폴백.
- 출처: github.com/web-push-libs/web-push · datatracker.ietf.org/doc/html/rfc8292 · web.dev/articles/push-notifications-web-push-protocol

## 6. 모니터링 크론 — 외부 키 불필요

- **핵심**: 인프라. `MonitorScheduler`(`integrations/scheduler.ts`)가 등록된 점검을 주기 실행. **기본 off** — `LANSMARK_MONITOR_CRON=1`일 때만 가동(최소 1분·`unref`).
- **할 일**: 외부 발급 없음. 데이터 seam(특보·예찰)이 승격돼 점검 작업이 생기면 `register()`로 붙이고 플래그를 켭니다.

---

## 승격 절차(키 확보 후 — 저의 작업)

1. 키를 `.env`에 넣으시면 → `listIntegrations()`가 `configured:true`로 인식(값은 안 봄).
2. 저는 **실응답 샘플을 캡처**(`fetch*Sample()`)해 형태를 확인.
3. 그 실샘플로 **파서를 작성**(`parse*`의 `SHAPE_UNVERIFIED` 해제) + 테스트.
4. 해당 도메인(agri-alerts/support/foreign/notify)에 **한 슬라이스씩 승격**(featureMap status seam→live) + 레드팀 + 프리뷰 + 버전.

> 한 번에 다 켜지 않고 **한 슬라이스씩**(CLAUDE.md #6) — 흩어짐·미검증 혼입을 막습니다.

---

## 🌤 기후 근거 확장 — 전국 색지도 + 작물별 GDD 판정 (신규 요청 · 2026-06-17)

> 배경: nullschool풍 "기후 지도 + 근거" 요청. **지금 가능한 부분**(필지 지점의 실측 기후를 평이한 '기후 근거'로)은 이미 구현(`core/climateEvidence.ts` · 실측 연평균기온·적산온도GDD·강수 등). **막힌 부분**(전국 매끄러운 색지도, 작물별 "GDD 충분/부족" 판정)은 아래 실데이터가 있어야 함 — 없으면 **보간/임계값 날조 = '추측 금지' 위반**이라 안 함.

### A) KMA 격자 평년값 (전국 색지도용) — **사장님 직접 신청**
- **무엇**: 전국 격자(예: 1km/5km) **평년값(1991–2020)** — 연평균기온·강수량·(가능시)적산온도. 매끄러운 색지도(choropleth)에 필요.
- **어디서**: 기상청 **기후정보포털**(data.kma.go.kr) 또는 **기상자료개방포털**(data.kma.go.kr) → 격자 평년값/시나리오 자료 신청·다운로드. (API 또는 대용량 파일)
- **확신도**: MED — 포털 로그인 후 '격자 평년값/SSP 시나리오' 메뉴에서 제공형식(NetCDF/CSV/타일) 확정 필요.
- **왜 직접**: 로그인·약관동의·대용량 신청은 사장님 계정 사안(HUMAN GATE).

### B) 작물별 GDD 기준온도·요구 적산온도 (충분/부족 판정용) — **자료 수집**
- **무엇**: 작물별 **base 온도**(현재 통용 10℃ 고정 사용 중)와 **생육 완료 요구 GDD**. 있어야 "이 땅 적산온도면 ○○ 수확 가능/부족" 판정 가능.
- **어디서**: 농진청(RDA)·농사로·표준영농교본·학술자료. (작물 기준표는 **도메인 사실** → qwen 등 LLM 추정 절대 금지, 출처 명시 자료만)
- **확신도**: UNCERTAIN — 작물·문헌마다 base/요구 GDD 상이 → 출처·연도 표기 필수.

### 확보 시 저의 작업(승격)
1. `data/providers/kmaGrid.ts`(격자 적재) + `GET /api/climate-grid?bbox=` 추가.
2. 지도 `CLIMATE_GRID` 레이어(choropleth) + 범례 + 출처·연도 라벨.
3. 작물 GDD 데이터로 `climateEvidence`에 "작물별 충분/부족" 판정 추가(출처 표기).
4. featureMap `climate-evidence` status seam→live + 테스트 + 프리뷰 + 버전.

> 그 전까지: **필지 '기후 근거'(측정 사실)는 정직하게 제공**, 전국 색지도·작물별 판정은 "데이터 확보 후"로 명시(가짜로 칠하지 않음).
