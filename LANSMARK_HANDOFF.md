# LANSMARK 핸드오프 & 잔여 계획 (v1)

## ⟢ 세션 업데이트 — 2026-06-02 (Phase 0 부팅 + Phase 5 실엔진 연동)
- **부팅(Phase 0)**: `lansmark_simulator_v4.zip` → `lansmark_simulator_skeleton/` 부팅. `npm run typecheck` ✅, **vitest 77/77 ✅**. (이 맥엔 시스템 Node 부재 → `~/.local/node-current`에 Node 20.20.2 LTS 로컬 설치, sha256 검증. `export PATH="$HOME/.local/node-current/bin:$PATH"` 후 npm 사용.)
- **Phase 5 (map-first atlas)**: `dashboard/lansmark_app.html`의 **클라이언트 내장 시뮬엔진 제거** → 전부 백엔드 실호출로 전환(가드레일 "내부 하드코딩 금지" 충족).
  - 필지단계: `/api/recommend`(무료 후보) → 작물 클릭 → `POST /api/simulate`(P10/50/90·6축 근거·손익분기·신뢰도·dataLabel·면책·출처) 실호출. 지형은 `/api/terrain`, 경계는 `/api/parcel`(지도에 폴리곤), 타일은 `/api/config`(VWorld 키 있으면 WMTS, 없으면 OSM 폴백).
  - 시·도/시·군 줌단계는 대표작물 **예시 시드(라벨 명시)** 유지(지역 엔드포인트 부재 — 알려진 한계).
  - **이벤트 레이어 + LIVE 피드(C3)**: 가격↑↓/서리/수요/위성 펄스 + 피드, 클릭 시 flyTo+핀 오픈. (mock 트리거 · 실연동 seam: KAMIS/KMA/위성)
- **완료 seam(devServer)**: `GET /api/recommend`(rankCropCandidates), `POST /api/feedback`(InMemoryFeedbackStore) + `/api/simulate`를 **지형버킷 보정 적용**(getCalibration)으로 격상 → **플라이휠(해자) 서버사이드 end-to-end 동작**(실측 5건 → validated, 예측이 실측쪽으로 이동).
- **검증**: tsc ✅ · vitest 77/77 ✅ · 전 엔드포인트 curl ✅ · 플라이휠 end-to-end ✅ · 인라인 JS 구문 ✅ · 렌더/클릭경로 vm 테스트(실서버 페이로드) 25/25 ✅. (브라우저 시각 확인은 미실시 — 시스템 Node 부재로 preview_start 보류.)
- **⛔ HUMAN GATE(미해결, 위조 금지)**: `VWORLD_API_KEY`(타일·필지·DEM 실데이터) · `KMA_API_KEY` · `KAMIS_API_KEY/ID`+품목코드 · `TOSS_SECRET_KEY`/`PG_WEBHOOK_SECRET` · **실 RDA 소득자료**(현재 base `verified:false` → 소득 P50 음수 placeholder, 키 연결 시 정상화). 없으면 mock+seam 유지.
- **다음**: (1) 키 수령 시 `LANSMARK_DATA_MODE=live` provider 채우기 (2) RDA 실 소득자료 로더 → `data/rdaIncome.ts` `verified:true` (3) 브라우저 시각 검증 ✅ (4) 우선순위 확인 — 마스터 문서 메모상 **JUPA 8.28이 본진**, atlas는 Phase C.

### ⟢ 보안·테스트 하드닝 (2차 패스, 2026-06-02)
- **반사형 XSS 차단**(공유링크 `#s=` → 악성 cropId → 서버 에러 echo → `innerHTML`): 프론트 `esc()`(innerHTML 주입 무력화)·`SAFE_CROP` 화이트리스트·에러메시지/PNU/칩 이스케이프·restore 입력 sanitize(tier/좌표/crop). 서버는 입력 미반영(generic). 브라우저에서 페이로드 미실행 확인.
- **devServer 입력 하드닝**: `validate.ts` 배선(면적≤100ha·enum·cropId 검증/클램프) + 신규 `src/lansmark/api/parcelRequest.ts`(지형/위성 sanitize, **클라이언트 calibration/climate 불신** — 서버 계산). 잘못된 입력 **400**, 내부오류 **비노출 500**(정보유출 차단).
- **tsconfig `server/**` 포함** → devServer 타입체크 활성(이전엔 미검사였음).
- **부모 `engine/blueberry/.env.example` 복원**(README엔 있으나 파일 누락 → `toram-policy` 테스트 통과).
- **2차 하드닝**: (1) 프론트 **방어적 esc 전면화** — 엔진 유래 문자열(factor reason/axis·cropNameKo·baseSource·disclaimers·regionText·calibration reason) 전부 이스케이프(live 데이터 대비) (2) 서버 `num`→`finiteParam`(**NaN/Infinity 좌표 거부**) (3) **요청 바디 512KB 상한**(메모리 DoS) (4) `/api/feedback` JSON 파싱 가드(400) (5) `confirm`은 운영 시 `expectedAmount` 서버조회 필요 주석. 신규 `api/httpUtil.ts`.
- **테스트**: skeleton **93/93**(신규 `parcelRequest` 8 + `appSecurity` 4 + `httpUtil` 4) · parent lansmark-mvp **9/9**(toram 포함) · tsc ✅(server 포함) · guardrail ✅. 런타임: XSS페이로드→400(미echo)·면적폭주→400·NaN좌표→400·600KB바디→차단(000)·지형 sanitize→200·플라이휠 validated·브라우저 XSS 미실행·렌더 정상.
- **남은(저위험) 노트**: dev `/api/simulate`는 무게이트(운영은 `assertPaidEntitlement` 게이트 — `api/paid-simulation.route.example.ts`) · devServer 레이트리밋/CORS는 운영 시 강화(`_rateLimit.ts` 존재) · `/api/feedback`은 운영 시 인증·레이트리밋 필요.

### ⟢ 토지 유형 구분 (강·바다·도시·기존 농경지) — 2026-06-02
- 신규 `geo/landClass.ts`: 분류 8종(전/답/과수원/하천/바다/대지/임야/기타) → group(agri/water/urban/forest/other) + **action**(reconfirm/warn/block) + cultivable. mock=좌표 분류기, live=VWorld **지목(地目)** 매핑(`classifyJimok`, 지목 28종 공개표준 — WFS 지목 '추출 키'만 docs-gated seam, 추측 금지).
- `GET /api/landclass?lat&lng`. 프론트: 필지 클릭 시 **분류 먼저** → 🌊 수면(강/바다)=소득시뮬 **차단**(분류·사유 카드) · 🏙 도시·🌲 임야=경고 카드 + ‘그래도 분석’ override · 🌾 기존 농경지=**재확인 배너** 후 진행. 핀/필지폴리곤/선택셀을 유형 색으로(수면 파랑·도시 회색·임야 갈녹·농경지 초록). pin/select/openAt/restore 전 경로 반영.
- 테스트 `landClass.spec.ts`(9) + 런타임 4종 + 브라우저(농경지 배너+시뮬 / 바다 차단 / 도시 경고+override) 확인. skeleton **102/102** · tsc·guardrail ✅.

### ⟢ 생육·출하 흐름 배선 (P0 — UX 검토 후속) — 2026-06-03
- 다중 페르소나 UX 검토(12×8=96패스, `LANSMARK_UX_REVIEW.md`)에서 **최대 갭 = 생육·출하 dead path**(calendar/growthRisk가 레거시 simulator.ts에서만 호출, canonical 경로 미연결)로 확인 → 해소.
- 검증 코어 `core/calendar.buildGrowthCalendar`·`core/growthRisk.buildGrowthRiskInfo`를 **devServer `/api/simulate` 응답에 `growth={calendar,risk}`로 합쳐** 노출(엔진 `parcelSimulator.ts` 미변경 — 저위험 배선).
- 프론트 소득카드 아래 **🌱 생육·출하 타임라인** 카드: 12개월 파종→생육→개화→수확 스트립(+❄서리), 캘린더 note, 🚚 출하 적기(수확월=출하; 조기/저장 출하 단가 차이 안내 + 월별 시장가 연동 seam), ⚠ 생육 리스크(기상·병해충·재난).
- 테스트 `growthWiring.spec.ts`(4) 계약 고정. skeleton **106/106** · tsc·guardrail ✅. 런타임(마늘 파종9·10→수확6·note·병해충·물고임) + 브라우저(타임라인 렌더) 확인.
- **남은 P0**(UX 검토): 판로(salesChannel)·재배연차(targetYear)·실필지 면적의 엔진 반영(현재 무시), 음수 P50 히어로 카드 문구 개선. P1: 주소검색/내위치·자동줌, 시군단계 수면경고, 비교/PDF 가드레일, 추천 점수 범례. → **아래 v0.4.0/v0.5.0에서 전부 해소.**

### ⟢ 운영화 · 결제 · 버전관리 (v0.4.0 → v0.5.0) — 2026-06-03
- **v0.4.0**: 운영자 콘솔(`/ops`, 통합 준비도 9·결제·플라이휠·활동로그 + `LANSMARK_ADMIN_TOKEN` 인증) · 결제(Toss seam·데모결제·HMAC 엔티틀먼트 게이트)+프리미엄 페이월 · 드롭인 `auto` provider(키 꽂으면 통합별 자동 live, mock 무중단 폴백)+`RUN_GOLIVE.md` · 생육·출하 타임라인 + 판로/재배연차/실면적 소득 반영 · 토지유형(강·바다·도시·농경지)+주소·지번 검색·내위치.
- **v0.5.0**: 버전 SSOT(`version.ts` `RELEASES`)+`/api/version`↔localStorage 변경점 팝업(신버전 델타만) · 운영 콘솔 버전 KPI · **시·군/전국 줌에서도 수면(강·바다) 차단**(onClick·restore 전 줌 분류) · 기존 농경지 **재확인 입력**(현재 재배 현황 → 재배중이면 전작 정리비·공백기 안내) · 비교표 **보정상태(검증/추정) 컬럼**.
- 검증: tsc ✅ · vitest **115/115** ✅ · guardrail-scan exit 0 ✅ · 앱·콘솔 HTML inline-JS 파싱 ✅ · 브라우저(버전팝업 v0.5.0 델타·시군 수면차단·재확인 폼·콘솔 버전 KPI) ✅.
- 버전업 절차(3종 동반): `version.ts` RELEASES 맨 앞 추가 → `package.json` version → `CHANGELOG.md` 맨 앞 → 자동으로 앱 팝업·콘솔 KPI 반영.
- **HUMAN GATE 잔존(추측 금지)**: VWorld DEM 파싱·KMA ASOS 파싱·KAMIS 품목코드·실 RDA 소득자료 — 키/공식 docs 확보 시 `live.ts`/`rdaIncome.ts` seam 채우면 즉시 live(현재 mock 폴백, 콘솔 "키 필요" 표기).

### ⟢ 보안 강화 (v0.6.0) — 2026-06-03
- **신규 `src/lansmark/api/security.ts`(의존성 0)** — helmet+express-rate-limit 표준을 직접 구현. devServer 요청 진입부에 배선.
- **보안 헤더**: 모든 응답에 `nosniff·X-Frame-Options:DENY·Referrer-Policy·Permissions-Policy(geolocation=self만)·COOP/CORP`, https면 `HSTS`. **CSP** — HTML은 인라인 `<script>` **요청별 nonce**(`injectNonce`)+외부 호스트 허용목록(cdnjs/fonts/타일), API(JSON)는 `default-src 'none'`.
- **레이트리밋**: IP 고정창, `/api/*` 글로벌 240/분 · 결제·시뮬·피드백·웹훅 30/분 → 429+`Retry-After`. env `LANSMARK_RATE_GLOBAL`/`LANSMARK_RATE_SENSITIVE`.
- **CORS**: `LANSMARK_CORS_ORIGIN`(기본 `*`) 허용목록 + `OPTIONS` 프리플라이트(커스텀 인증헤더 광고).
- **부팅 안전점검**: `NODE_ENV=production`에서 기본 엔티틀먼트 시크릿이면 **부팅 차단**(위조 방지, 우회 `LANSMARK_ALLOW_DEFAULT_SECRET=1`) · 관리자 토큰 미설정/전체 CORS 경고.
- **피드백 변조 방지**: `/api/feedback` 실측값 `clampNonNeg`(0↑·상한) → 플라이휠(해자) 무결성.
- 기존 보안(이미 적용)도 확인: HMAC 엔티틀먼트(timing-safe·exp·fail-closed)·관리자 timing-safe 비교·웹훅 서명+멱등·바디상한·입력검증·일반화 에러·프론트 `esc()` 전수.
- 검증: tsc ✅ · vitest **133**(+security.spec 18) ✅ · guardrail exit 0 ✅ · 브라우저 CSP 위반 0·앱 정상 렌더·v0.6.0 팝업 ✅.

### ⟢ 서버 기능별 분리(유지보수) — 2026-06-03
- **목적**: `server/devServer.ts` 단일파일(보안+14라우트+헬퍼 혼재)을 **책임별 모듈**로 분해 — 섞임/흩어짐 제거. 동작 변화 0(사용자 버전 미상승, 내부 리팩터).
- **구조**: `devServer.ts`(조립만) · `config.ts`(설정·부팅점검·paymentSummary) · `context.ts`(공유상태 `Ctx`=스토어·카운터·레이트리미터 + `RouteFn` 타입) · `respond.ts`(json·sendHtml·readBody·badInput) · `middleware.ts`(보안헤더·CORS·프리플라이트·레이트리밋·adminOk) · `router.ts` + `routes/{meta,geo,analysis,payment,ops,pages}.ts`.
- **원칙**: 모듈 전역 가변변수 제거 → `Ctx` 주입. 비밀값(TOSS/PG/ENTITLEMENT secret)은 사용처에서 `process.env` 직접(설정객체·로그 유출 방지). 모든 파일 상단 책임 1줄 + 비자명 로직 주석.
- **회귀가드**: `security.spec`(모듈별 배선 소스검증) + 신규 `serverRoutes.spec`(router 스모크 — health/version/landclass/recommend/simulate402/404).
- 검증: tsc ✅ · vitest **142**(+serverRoutes 7) ✅ · guardrail 0 ✅ · 전 라우트 curl 동등성(200/400/402/404/204·sea→block·agri→reconfirm) ✅ · pay→simulate(+growth)→feedback→ops 카운터 ✅ · 브라우저 CSP 위반 0 ✅.
- **규칙 영속화**: `CLAUDE.md` 개발불변식 #6(기능분리)·#7(주석) + "코드 구성·주석 규칙" 섹션 추가.

### ⟢ 레드팀 보안 강화 (v0.7.0) — 2026-06-04
- **다중 전문 레드팀(70 에이전트) → 적대적 검증**으로 확정 27건(고유 21) **전부 수정** → **재검증(21 에이전트)에서 21/21 FIXED**.
- 핵심: 레이트리밋 XFF 위조 차단(`clientIp` 신뢰 프록시 경계 `LANSMARK_TRUST_PROXY_HOPS`) · 운영 **fail-closed**(약한 시크릿/CORS*/오픈콘솔이면 부팅차단) · 하드코딩 시크릿 제거(비운영 부팅별 임시랜덤) · 결제 무결성(confirm 서버금액·userId · 토큰 `jti`+소진 quota+실효 · 웹훅 userId 서버유래) · `/api/feedback` 엔티틀먼트 게이트 + validated=서로 다른 제출자 수 · `fetchJsonSafe`/`fetchTextSafe`(타임아웃+파싱가드) · okClimate 표본검증 · confidence 서버결속 · 핀 경쟁조건 세대토큰 · CDN SRI.
- 신규: `api/fetchSafe.ts` · `POST /api/ops/revoke`(토큰 실효) · 회귀 `redteamFixes.spec`. 런타임 실증(XFF우회 차단·quota·revoke·fail-closed 부팅).

### ⟢ 영속성 (v0.8.0) — 2026-06-04
- 레드팀이 남긴 in-memory 잔존(재시작 소실)을 **무의존성 파일 스토어**로 해소.
- `db/jsonFile.ts`(원자적 temp→rename) + `db/stores.ts`: 실측 플라이휠·웹훅 멱등·유료권한 소진/실효 — **memory↔file 드롭인**(`LANSMARK_STORE`, 기본 file·`.data/`, 쓰기불가 시 memory 폴백). 다중인스턴스/고throughput은 같은 인터페이스로 **DB 어댑터(seam)**.
- 런타임 실증: 재시작 후 플라이휠 records·토큰 소진내역·실효 **보존**. `health.store`/콘솔 노출. `db.spec`(재시작 보존). vitest **164**.
- 잔존(인프라 결정): 다중 인스턴스=DB 어댑터, 로그인-유저 결속=인증 계층(엔티틀먼트 userId/parcelId 필드 준비됨).

### ⟢ 기능 흐름 아키텍처 지도 (거버넌스) — 2026-06-04
- **목적**: 기능을 계속 붙일 때 흩어짐·잘못된 위치를 방지. 정적 문서는 썩으므로 **자동 대조되는 SSOT**로 구축.
- `scripts/featureMap.ts`(SSOT: 14기능 × 흐름·엔드포인트·파일·테스트·가드레일·상태) → `npm run arch`(지도↔코드 자동 대조: 파일/엔드포인트 존재·**미등록 엔드포인트(드리프트)**·**orphan 파일(흩어짐)** 검출, 어긋나면 exit 1) → `ARCHITECTURE.md`(`npm run arch:render`, Mermaid 흐름도 자동생성).
- **게이트 연결**: `verify.sh`·`stop-gate.sh`에 `arch` 추가(미동기화 시 완료 차단). **CLAUDE.md**: 시작 의식에 "ARCHITECTURE.md 먼저", 불변식 #8(지도 우선·동기화), 🧭 헤더 박스.
- 검증: `arch` 최초 실행이 실제 드리프트 2건 잡음(ops/stats `!==` 가드 누락·`_rateLimit.ts` orphan) → 수정 후 **지도↔코드 일치(오류 0)**. 코딩 전 이 지도부터.

---


> 목적: 지금까지 만든 것을 정리하고 **남은 작업을 계획 대비**로 명시해, Codex(또는 집 작업)가 바로 이어가게 한다.
> 짝 문서: 전략=`LANSMARK_PLAN.md`, 엔진 스펙·해자=`LANSMARK_ENGINE_AND_BUILD_PLAN.md`.

## 0. 한 줄 현황
현실 기반 **작물·수확·소득 시뮬레이터**. 엔진(6축)+토지이음식 맵+통합 여정+플라이휠(지형버킷)+저장/PDF/공유 = **코드 완료** (typecheck ✅, **45/45 테스트**). 남은 건 **외부 연결(seam) · 라이선스 확정 · 운영화**뿐.

---

## 1. 자산 인벤토리 (실제 파일)

### A. TS 엔진 패키지 (제품 코드) — `lansmark_simulator_skeleton/src/lansmark/`
| 영역 | 파일 | 역할 | 상태 |
|---|---|---|---|
| **보정엔진(canonical)** | `core/parcelSimulator.ts` | 유료 정밀 시뮬: base×면적×6축보정 → P10/50/90·근거·손익분기, provider 배선, 플라이휠 적용 | ✅ |
| | `core/factors.ts` `core/terrain.ts` `core/satellite.ts` | 6축 보정계수(+근거 로그) | ✅ |
| | `data/rdaIncome.ts` | 10a base(농진청 구조) | ✅ (verified:false=데모) |
| **플라이휠(해자)** | `core/feedbackStore.ts` | 예측↔실측 저장 + `terrainBucketOf` + `toOutcomeRecord` | ✅ (InMemory) |
| | `core/calibrate.ts` | 수축 보정 + 지형버킷 부분풀링 | ✅ |
| | `core/calibration.ts` | store 기반 `getCalibration`/`getValidationLevel` | ✅ |
| 불확실성/검증 | `core/uncertainty.ts` `core/validate.ts` | 분산 합성·입력 검증 | ✅ |
| **가드레일/정책** | `policy/soilPolicy.ts` `policy/disclaimer.ts` `policy/entitlement.ts` | 토양 게이팅·면책·엔티틀먼트 HMAC | ✅ (검증 테스트됨) |
| **provider seam** | `data/providers/{types,mock,live,index}.ts` `data/providers/kamisItemCodes.ts` | mock↔live 전환(`LANSMARK_DATA_MODE`) | 🟡 live 미구현 |
| 무료후보/적합도 | `core/cropSuitability.ts` `core/enrich.ts` | 무료 작물 후보 랭킹 | ✅ |
| 레거시 시뮬 | `core/simulator.ts` `core/{yield,cost,revenue,income}.ts` | 초기 시뮬 경로(테스트 유지, 유료는 parcelSimulator로 대체됨) | ⚠️ 레거시 |
| 부가 | `core/{calendar,growthRisk,planting,report,geo}.ts` `share.ts` `data/*.seed.ts` | 생육달력·병해충·리포트 등 | ✅ |
| 라우트 예시 | `api/{free-candidates,paid-simulation,feedback}.route.example.ts` `api/_rateLimit.ts` | 엔드포인트 골격 | 🟡 예시 |
| DB seam | `db/repository.ts` | Prisma 주입 골격 | 🟡 seam |
| 테스트 | `tests/*.spec.ts` (14개) | **45 tests 통과** | ✅ |

### B. 데모(프론트, 단일 HTML)
| 파일 | 내용 |
|---|---|
| **`lansmark_app_v1.html`** | **통합 앱(canonical 데모)**: 토지이음식 맵 + 핀(단일)/토지선택(다중) + 줌별 추천 + 작물→정밀 시뮬 + 플라이휠 + 저장/PDF/공유 |
| `lansmark_dashboard_v6.html` | 엔진 단독 데모(보정 근거 패널 중심) |
| `lansmark_map_v1.html` | 맵 단독(추천까지) |

### C. 계획/설계 문서
`LANSMARK_PLAN.md`(전략·페르소나·기능·데이터맵) · `LANSMARK_ENGINE_AND_BUILD_PLAN.md`(엔진 스펙·값보정·구현순서·§8 해자).

---

## 2. 계획 대비 진척 (BUILD_PLAN §6)
| 단계 | 상태 |
|---|---|
| ① RDA base 로더 / ② 6축 factors 엔진 / ③ 통합 / ④ enrich 배선 | ✅ |
| ⑤ 지형(DEM) | ✅ 자동(mock)+수정 · 실 DEM=seam |
| ⑥ 위성(Sentinel) | ✅ 토글 반영 · 파이프라인=seam |
| ⑦ 근거표시·신뢰도·validated/estimated | ✅ |
| ⑧ 피드백→보정 플라이휠 | ✅ (지형버킷 부분풀링까지) · Firestore 운영화=seam |
| + 토지이음식 맵(핀/다중선택/줌tier) | ✅ |
| + 저장/PDF/공유 | ✅ (JSON·URL·인쇄) |

---

## 3. 남은 작업 (우선순위 · seam)
| # | 작업 | 어디(파일) | 무엇을 | 검증 | 차단 |
|---|---|---|---|---|---|
| 1 | **실 API fetch** | `data/providers/live.ts` (geocode/climate/recentWholesale 3곳 throw) | VWorld·KMA·KAMIS 호출 구현 + 키(.env) | mock과 동일 출력 형태로 시뮬 동작 | 라이선스 |
| 2 | KAMIS 품목코드 확정 | `data/providers/kamisItemCodes.ts` | cropId→품목코드 매핑 검증 | 실 도매가 조회 | — |
| 3 | **실 RDA 소득자료** | `data/rdaIncome.ts` `getRdaBase` | 농진청 소득자료 로더로 교체 → `verified:true` | validated 라벨 정상화 | 이용범위 확인 |
| 4 | 실 DEM | 앱 `LAND_API.terrain` / 백엔드 | 국토지리원 DEM에서 경사·향·표고 | 필지별 실제 지형 | 공공누리 |
| 5 | Sentinel 위성 | `core/satellite.ts`(obs 입력) | NDVI/thermal/SAR 파이프라인이 obs 채움 | 위성 보정 반영 | GEE 유료 주의 |
| 6 | **Firestore 실측 저장** | `core/feedbackStore.ts` 구현체 | InMemory→Firestore/Postgres 어댑터 | 플라이휠 운영 누적 | — |
| 7 | **결제 webhook** | `policy/entitlement.ts` + `api/paid-simulation.route.example.ts` | PG 결제→엔티틀먼트 토큰 발급 | 유료 게이팅 | PG 계약 |
| 8 | 실 필지경계 | 앱 맵(격자 대체) | VWorld/토지이음 WFS GeoJSON | 진짜 필지 선택 | 배포권 |
| 9 | 지역 데이터 확정 | 앱 `SIDO_CROPS`/`SIGUNGU_PRODUCE` | 농산물 통계·지자체로 확정 | 추천 신뢰 | 출처 |
| 10 | 저장 서버화 | 앱(현재 JSON/URL) | 배포 시 로그인+서버 저장 | 세션 영속 | — |

---

## 4. Seam 상세 (어디를 어떻게)
**(공통 원칙: mock과 live의 출력 타입이 같아서 대부분 drop-in 교체)**

1. **providers (1·2번)**
   - `data/providers/index.ts`가 `LANSMARK_DATA_MODE`로 mock/live 선택. `live.ts`의 3함수만 채우면 됨.
   - 반환 타입: `data/providers/types.ts`의 `GeocodeResult`/`ClimateResult`/`PriceResult` (mock 구현 참고).
   - 앱 쪽은 `LANSMARK_API.mode="live"` + `baseUrl` 한 줄 → 백엔드 라우트가 위 provider 호출.

2. **rdaIncome (3번)**
   - 현재 `getRdaBase`=crops.seed×1000 + `verified:false`. 실 소득자료 로더로 교체 후 `verified:true`면 `validated` 라벨이 데이터로 켜진다.

3. **terrain/satellite (4·5번)**
   - terrain: 앱 `LAND_API.terrain`(mock hash) → DEM API. satellite: `satelliteFactors(obs)`의 obs를 Sentinel 파이프라인이 채움(Copernicus Data Space/Sentinel Hub; **GEE 상업=유료** 주의).

4. **플라이휠 운영화 (6번)**
   - `FeedbackStore` 인터페이스 구현(Firestore/Postgres). `toOutcomeRecord(예측, 실측)`로 기록 → `runParcelSimulationCalibrated(input, store)`가 자동으로 지형버킷 보정 적용. 임계 `VALIDATED_THRESHOLD=5`.
   - 실측 수집 UI/리마인더 필요(앱 데모의 "실측 입력" → 운영 폼).

5. **결제 (7번)**
   - `policy/entitlement.ts`에 HMAC 검증 구현·테스트됨. PG webhook→토큰 발급만 추가. `api/paid-simulation.route.example.ts`가 게이팅 흐름 예시.

---

## 5. 라이선스 최종 확인 (직접 신청/문의)
| 대상 | 확인할 것 | 메모 |
|---|---|---|
| KAMIS(aT) | 상업 이용 — **확정**(민간 비즈니스 지원 명시) | cert_key/cert_id |
| 기상청(KMA) | 데이터셋별 **공공누리 유형**(대부분 1유형) | apihub.kma.go.kr |
| VWorld | **운영키 심사**(반려 사례) — 대안 행안부/Kakao/Naver | 개발키는 6개월 |
| 농진청 소득자료 | 공공데이터포털 이용범위 | base 출처 표기 |
| 국토위성/KOMPSAT | **배포권** 직접 확인(고해상은 까다로움) | 보조 용도 |
| Sentinel | 상업 **확정**(출처표시) / **GEE 상업=유료** | Copernicus |
| 팜맵/DEM | 상업 이용범위 | — |
| 지역 특산물 데이터 | 통계/지자체 출처로 확정 | 현재 예시 시드 |

---

## 6. 출시 게이트 (BUILD_PLAN §7)
- [ ] 라이선스 최종(공공누리 유형·VWorld 운영키·위성 배포권)
- [ ] 일부 작물 `validated`(실측 N건 보정)
- [ ] 근거·범위·면책 노출(✅ 코드 완료)
- [ ] 전자상거래(환불·약관) + 결제 연동
- [ ] base 출처·연도 명시(농진청 ○○년)

---

## 7. 권장 로드맵
| Phase | 목표 | 핵심 |
|---|---|---|
| **A (MVP-α)** | 유료 시뮬 실동작 | live.ts 3종 + RDA 로더 + 결제 webhook |
| **B** | 플라이휠 운영 | Firestore 저장 + 실측 수집 UI/리마인더 |
| **C** | 정밀화 | 실 필지경계(WFS) + DEM + Sentinel |
| **D** | 해자 가속 | validated 트랙레코드 마케팅 · 특허 · 데이터 파트너십(농협/지자체/RDA) |

---

## 8. 가드레일/원칙 (계속 지킬 것)
수익·재배성공 **보장 금지**, **매입추천 금지**, 항상 **P10/50/90**(나쁠때/보통/좋을때), 토양검정 시 정밀↑·`validated`, **흙토람(제한 API) 미사용**, base 출처·연도 표기, 면책 노출. 추천=무료 / 정밀시뮬·비교·저장=유료(Pro).

---

## 9. Codex / 집 작업 시작 (첫 명령)
```
# 1) 패키지
cd lansmark_simulator_skeleton
npm i
npx tsc --noEmit && npx vitest run     # 45 tests 통과 확인

# 2) 실데이터(Phase A)
#  - data/providers/live.ts 의 throw 3곳 구현 (VWorld/KMA/KAMIS) + .env 키
#  - data/rdaIncome.ts getRdaBase → 농진청 소득자료 로더, verified:true
#  - 앱 LANSMARK_API.mode="live" + baseUrl
#  - 결제: policy/entitlement.ts + paid-simulation.route 연결

# 3) 플라이휠 운영(Phase B)
#  - core/feedbackStore.ts FeedbackStore → Firestore 어댑터
#  - 실측 수집 UI + runParcelSimulationCalibrated 사용
```
**세션 시작 프롬프트(예):** `LANSMARK_HANDOFF.md 읽고 현황 파악 → Phase A부터: live.ts 3함수 구현 + rdaIncome 실데이터 교체 → typecheck/test 통과 유지하며 진행.`
