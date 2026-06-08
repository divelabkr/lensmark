# 변경 이력 (CHANGELOG)

> 단일 출처: `src/lansmark/version.ts`(`RELEASES`). 이 문서·`package.json` version·`version.ts`를 **함께** 올린다.
> 사용자에겐 버전업 시 앱에서 "변경점" 팝업으로 노출(`/api/version` ↔ localStorage 마지막 본 버전).

## 0.30.0 — 2026-06-08 · ops 유료 게이트 런타임 토글 — 무료베타↔유료 재시작 없이 전환
> 사장님 요청("ops에 토글로 만들어놔, 시점 되면 반영"). 유료 게이트를 운영 콘솔에서 재시작 없이 ON/OFF. 머니 게이트라 고위험 → qwen vote3=**0건** + Claude 적대검토(무결함) + 런타임 스모크. tsc·vitest **379**·arch 0.
- **유료 게이트 토글**(`dashboard/lansmark_ops.html` 결제 패널) — 무료베타(OFF)↔유료(ON) 버튼. 현재 상태·런타임 오버라이드 여부 표기. confirm 후 `POST /api/ops/paid-gate` → 즉시 반영(`/api/config`·프론트 FREEBETA 자동 추종)·영속(재시작 보존)
- **안전(머니 게이트)** — ① 관리자 인증(timing-safe `adminOk`) ② **운영(prod)에서 무료개방은 `LANSMARK_ALLOW_OPEN_PAID=1` 필요**(bootSafety와 동일 가드 → 런타임 우회·실수 차단, `OPEN_PAID_NOT_ACKED`) ③ 켜기(유료)는 항상 허용 ④ boolean 아닌 값 400
- **배선** — `server/runtimeFlags.ts`(RuntimeFlagsStore·file|memory 영속) 신설. `createContext`가 부팅 시 영속 오버라이드를 `config.requireEntitlement`에 적용(요청 readers 8곳 무변경) → `devServer`는 `createContext`→`bootSafety` 순서로 조정해 **bootSafety가 '실효값'을 검증**(오버라이드된 free-in-prod도 fail-closed)
- 검증: qwen vote3=0 + 적대검토(부팅순서 안전·prod가드 정합·CSRF 안전[커스텀헤더+ops ACAO제거]·config변형 race-free) + 런타임 스모크(True→OFF→config False→영속파일→stats overridden→복구) · 회귀 +5(`opsRoutes.spec`)

## 0.29.0 — 2026-06-08 · 유료 전환 전 법무 마무리 — 일지 삭제권·at-rest 암호화 seam·ops 방어심도
> "전부진행해" — LEGAL_CHECKLIST ③(at-rest 암호화)·④(일지 삭제 UI) 코드 갭 마감 + 레드팀 flag(ops CORS) 방어심도. 표준 규율: 빌드→qwen Mode1(vote3=**0건**)→Claude 직접검토(**데이터손실 footgun 1건 발견·수정**)→그린. tsc·vitest **374**·arch 그린.
- **일지 삭제권(PIPA 정보주체 삭제권)** — 재배일지 패널에 "🗑 이 일지 삭제(파기)" + `POST /api/journal/delete`. `loadOwned`로 소유권 검사(타인 일지 404·존재 누설 방지) → `journalStore.delete()` 즉시 파기(정확 PII=위치·수확). 익명 보정 레코드(`feedbackStore`)는 **지역단위 가명정보**라 잔존 → 처리방침에 "실측은 지역단위 익명집계로 보정 활용, 개별 식별정보는 일지 삭제 시 파기" 명시 대상
- **at-rest 암호화 seam**(`db/jsonFile.ts`) — `LANSMARK_DATA_KEY`(hex 64자=32B) 설정 시 **AES-256-GCM**(iv12|tag16|ct·`ENC1:` 프리픽스), 미설정이면 평문+0600(**기존 동작 무영향**). 평문↔암호 자동 이행(로드는 프리픽스 감지, 다음 flush에서 암호화). 키는 운영자 주입(**HUMAN GATE**) — 코드/AI 생성 금지
- **fix(데이터손실 가드 · Claude 직접검토 — qwen 못 잡음)** — 암호화 파일을 키 없이/불일치로 열면 `initial` 로드 후 **첫 flush가 암호문을 평문으로 덮어써 원본 파기**되던 footgun(운영 키 누락 오설정 시 일지 전체 손실). `sealed` 플래그 도입 → 못 읽은 암호화 파일은 flush no-op(원본 보존, 메모리-only로 degrade + 경고). 의미론적·상태의존 결함이라 qwen 파일별 그물이 못 잡음 → 직접검토의 가치
- **ops CORS 방어심도(레드팀 P2 flag 해소)** — `middleware.applySecurity`가 `/api/ops/*`에서 `Access-Control-Allow-Origin` 제거 → **dev-open(CORS\*)이어도 타 출처 JS가 운영 집계를 cross-origin 판독 불가**(prod `bootSafety`와 이중 방어). 동일출처 운영콘솔은 영향 없음
- 회귀가드 +4(`jsonFile.spec`: 암호화 라운드트립·PII 평문 미노출·sealed 덮어쓰기 차단 / `journalRoutes.spec`: 삭제 소유권·파기 후 404) · `featureMap` `/api/journal/delete` 등록(arch 드리프트 해소)

## 0.28.0 — 2026-06-05 · 2차 보안검증(교차파일 Workflow) — 확정 5건 중 3건 수정
> 무료근육+Claude 2트랙. qwen 전수 스윕(55파일×vote3=165호출·**0건**·무료) = 넓이 / Claude Workflow 6축 교차파일 적대검증(11→**확정5·기각6**) = 깊이. qwen이 구조상 못 잡는 교차파일·의미 결함을 Workflow가 포착. tsc·vitest **370**·arch 그린.
- **fix(P1) 엔티틀먼트 실효(revoke) 갭** — revoke 검사가 `EntitlementStore.consume()` 안에만 있어, consume을 호출 안 하는 유료 surface(guide 유료작물·foreign·journal)는 환불/분쟁으로 admin이 `/api/ops/revoke` 해도 **실효 토큰이 계속 동작**(킬스위치가 6개 중 3개에만 적용). → `EntitlementStore.isRevoked(jti)` 추가 + guide/foreign/journal에 실효 거부(`ENTITLEMENT_REVOKED`). 현재 무료베타라 dormant지만 페이월 활성(유료) 시 현실화 → 전환 前 필수. 회귀가드(journalRoutes.spec)
- **fix(P2) ops 검증 정합** — 운영콘솔 `validated` 버킷이 `actuals≥5`(익명 포함)로 판정 → 고객측 SSOT(`distinctSubmitters`, anon-* 제외, `VALIDATED_THRESHOLD`)와 불일치. **인증 제출자 distinct ≥ 임계**로 변경(익명 5회로 운영지표 위조 차단)
- **fix(P2) quota 소진 순서** — `/api/simulate`·`/api/feedback`이 입력검증 *前*에 `consume` → 깨진/cropId없는 본문에도 quota 1회 차감. **검증 통과 後 소진**으로 이동(budget 패턴과 통일)
- **flag(수정 안 함 — 결정/방어심도)**: ① 무료베타 익명 feedback의 보정 영향 = 이미 `anon-pool` 가중캡으로 바운드(collect-only 전환은 사장님 결정) ② dev-open+CORS* 시 ops 집계 cross-origin 읽힘 = prod `bootSafety` 이중차단(ALLOW_OPEN_CORS+ALLOW_OPEN_CONSOLE)으로 무력 → 운영 배포(.env.production.example=도메인 제한+admin토큰)에선 비해당
- 기각 6건 타당(parcelId seam·테스트격차·정책 삭제미구현=`LEGAL_CHECKLIST.md` ③에 이미 등재·mock-pay jti=dev한정)

## 0.27.0 — 2026-06-05 · 지도 형태 3종(일반·위성·지형) 전환
> 사용자 요청. 지도 basemap을 일반/위성/지형으로 구분·전환. 프론트 전용. tsc·vitest 369·arch 그린 · 브라우저 검증.
- **지도 토글**(`dashboard/lansmark_app.html`) — 우상단 `#mapsw` 3버튼: **일반**(VWorld Base)·**위성**(VWorld Satellite)·**지형**(OpenTopoMap). `setBasemap(k)`가 Leaflet 타일레이어 교체 + 활성표시 + `localStorage("lansmark_basemap")` 보존(기본 위성). VWorld 키 없으면 OSM 폴백
- **지형 소스** — VWorld는 지형(terrain) basemap 미제공이라 **OpenTopoMap**(SRTM 등고·음영, 키 불필요, CC-BY-SA) 사용. CSP `img-src https:`가 허용·출처표기. `maxNativeZoom`(17)으로 필지 고배율에서도 스케일 표시(공백 방지)
- 백엔드 무변경(`/api/config`의 `tiles.base/satellite` 재사용) · 브라우저 검증: 3종 전환 시 OpenTopoMap·VWorld WMTS 타일 실제 로드 확인
- 참고(기존): VWorld WMTS는 키가 타일 URL에 포함(클라 노출) — VWorld 콘솔에서 **도메인 제한** 필요(운영 HUMAN GATE)

## 0.26.0 — 2026-06-05 · give/get B — 수확기 리마인드 옵트인 다리(익명→연락처)
> 사장님 결정(give/get 로드맵 B). Phase A(계측)로 '무엇을 원하나'를 잡았으니, 이제 익명→재방문 가능(연락처)으로 전환하는 다리. 발송(C)은 SMS 키=HUMAN GATE라 '저장만'. tsc·vitest **369**·arch 그린 · qwen 1차 리뷰 + 브라우저 검증.
- **수확기 리마인드 다리**(`dashboard/lansmark_app.html`) — 시뮬 카드에 "🔔 {작물} 수확기에 시세·리마인드 받기(무료·발송 준비 중)" 맥락 CTA → `openAlarmModal(intent)`(기존 알림 옵트인 재사용, 작물·지역 맥락 배너 + cropId/region 전송). `AlertSubscription`/`buildSubscription`에 **cropId 의도 캡처**(화이트리스트 `^[a-z_]{1,40}$` · PII 아님)
- **정직성·PIPA 유지** — 실제 발송은 SMS 게이트웨이 키(HUMAN GATE) 후. 지금은 **"발송 준비 중"** 라벨로 동의·번호·의도만 저장. 번호 마스킹·해지 즉시 파기·가입여부 열거방지(고정 ok 응답) 그대로. 동의 없으면 거부
- **로컬 qwen '무료 근육' 첫 실전(Mode 1)** — B 백엔드(`alertSubscription`·`notify`·spec)를 `review-files`로 1차 리뷰 → **삼각검증 결과 확정 0**. qwen이 *enumeration-safe unsubscribe*(고정 ok)를 거꾸로 '존재여부 노출 위험'이라 오판한 것 등 노이즈를 걸러냄 → "qwen=1차 보조, 최종판단은 Claude/사람" 워크플로 입증
- 회귀가드: `notifySubscription.spec`에 cropId 캡처 + 화이트리스트 거부(대문자·한글·과길이·비문자열) · 브라우저 검증(작물 CTA→모달 맥락 배너) · tsc·vitest **369**·arch 그린
- 다음: **C**(SMS 발송 live → 수확기 실제 리마인드, ⛔ SMS 키 HUMAN GATE) · **D**(전환 신호 코호트)

## 0.25.0 — 2026-06-05 · 익명 수요·퍼널 계측 (Phase A) — 무료 베타에서 '무엇을 얻는가'
> 사장님 결정(익명 give/get → A.계측부터). 서버측 집계(PII0·새 공개 엔드포인트0)로 진짜 수요·퍼널·데이터갭. 집중 레드팀(H0·확정 M2 PII·L3) 전부 수정. tsc·vitest **368**·arch 그린 · 런타임 검증.
- **수요·퍼널 계측**(`src/lansmark/analytics/{types,eventStore}.ts` + `db/stores.ts` FileAnalyticsStore) — 기존 라우트 성공 시점에 집계: `recommend/simulate/guide/foreign/journal/subscribe` funnel + `simulate`의 작물×지역 **demand 히트맵** + 미등록 작물 **dataGap**. `/api/ops/stats`(adminOk) → 운영콘솔 '수요·퍼널' 패널(`lansmark_ops.html`)
- **설계 원칙** — 집계만(개별 여정 추적 X)·PII 0·익명 신호=위조 가능('검증된 사실' 아님, '베타 관심도'로 라벨). 새 공개 엔드포인트 0(스팸·poison 표면 최소). 지도 탐색·이탈(클라 비콘)은 공개 ingress라 **A.2**로 분리
- **영속·내구** — 파일 저장(throttle 25건·동기 fs 부담↓)·재시작 누적(`since` 보존)·**graceful flush**(SIGTERM/SIGINT, `devServer.ts`)·신규키 상한(DEMAND 10k·GAP 2k, DoS 가드)
- **fix(집중 레드팀 — H0)** — **M-1**: `simulate.region`(free-text)이 demand 키로 영속돼 PII 유입 가능 → **행정구역명 형태(한글·공백·괄호·≤20·숫자無)만 통과, 그 외 '기타' 버킷**(`eventStore.safeRegionKey`) · **M-2**: 외래 검색어(free-text)가 dataGap 키로 영속+제3자 송신 → **GBIF가 실제 종으로 해석한 정규명(canonicalName)만 기록**(원입력 미기록) → 'PII 0'를 코드로 강제 · **L**: 상한 도달 1회 경고(관측성)·콘솔 패널 '위조 가능·참고용' 표기(정직성)·종료 flush 훅(버퍼 손실 방지)
- **반증**(레드팀): lat/lng·anonId·휴대폰 혼입 없음 · analytics throw→500 불가(flush가 오류 흡수) · 운영 무인증 노출은 bootSafety fail-closed로 차단 · 기존 ops/stats 소비자 회귀 없음
- 다음: **A.2**(클라 비콘=지도 탐색·이탈) → **B**(분석/일지에 '수확기 리마인드' 옵트인 다리) → **C**(SMS 발송 live=수확기 리마인드 → 실측, HUMAN GATE) → **D**(전환 신호 코호트 유료 제안)

## 0.24.0 — 2026-06-05 · LENSMARK 리브랜드 + 무료 베타 오픈(유료 추후)
> 사장님 결정: 도메인 lensmark.kr 정합 리브랜드 + 무료 접근(플라이휠 축적 후 유료) + 유료 게이트 '추후 오픈' 비활성. H1 보안결함은 하이브리드(일지 익명ID 개방 / 검증은 인증한정)로 처리. tsc·vitest **361**·arch 그린 · 브라우저 검증 완료.
- **리브랜드(표기만)** — 사용자 노출 LANSMARK→**LENSMARK**(앱 타이틀·로고·버전팝업·알림모달, 운영콘솔, 이용약관·개인정보, 면책 disclaimer, 결제상품명, 서버 응답/기동로그). ⚠ **기술 식별자는 보존**(env 접두사 `LANSMARK_`·HTTP 헤더 `x-lansmark-entitlement`·localStorage `lansmark_ent`·파일명 `lansmark_*.html`·CSS 클래스) — 설정/배포 호환 위해 의도적 유지(도메인 lens-, 코드 lans-)
- **무료 베타(유료 게이트 비활성)** — `requireEntitlement=false`면 정밀 소득시뮬·재배가이드(전체)·외래작물 조회를 **무료 제공**. 프론트 `FREEBETA`가 `/api/config.payment.required===false`로 자동 점화 → 페이월 대신 "🎁 무료 베타 (유료 전환은 추후 오픈)" 배너·라벨. `true`로 되돌리면 페이월 부활(대칭). `.env.production.example`=무료베타 프리셋(`REQUIRE_ENTITLEMENT=false`+`ALLOW_OPEN_PAID=1`)
- **fix(무료베타 점화·정직성)** — ① `/api/config` 필드명(`required`)과 프론트 읽기 불일치로 FREEBETA가 안 켜지던 결함 정합 ② `ensureSim` 엔진가드가 `!isPro()`만 봐서 페이월은 숨었는데 정밀시뮬이 안 돌던 결함→`&&!FREEBETA` ③ 잠금/유료 라벨(6축·예산 '🔒 정밀', 다중비교 '결제(Pro)', 외래/가이드 배지)을 FREEBETA-aware로 — 무료인데 '유료/잠금' 표기하는 거짓 라벨 제거
- **보안(집중 레드팀 확정 4 + 적대 재검증 M, 전부 수정)** — **H1 재배일지 IDOR**: 무료게이트 해제 시 전 사용자가 고정 `userId:"dev"`로 합쳐져 위치·매출 PII가 교차노출되던 결함 → **브라우저별 익명ID(`x-lansmark-anon`) 격리**(`anonSubmitterId`, journal·feedback). **하이브리드**: 무료 익명 실측은 보정엔 반영하되 **'✓검증' 배지는 인증(유료) 제출만 인정**(`distinctSubmitters`가 anon-* 제외 — 무료 위조로 검증 부풀리기 차단). **플라이휠 무결성**: 무헤더 다중신원으로 per-user 캡을 우회하던 magnitude 오염 → 익명 전체를 **단일 풀(`anon-pool`)로 캡 공유**
- **정직성·문서** — 개인정보처리방침에 '재배일지=위치·수확 저장(익명ID 격리)' 행 추가(현실 정합) · bootSafety 주석/경고를 익명ID 격리·검증 인증한정 반영으로 갱신 · 회귀가드 5(일지 익명격리 3·검증 anon제외 1·익명풀 캡 1)
- 다음(유료 전환 Phase 2): 실 RDA 소득자료 · Toss 라이브 키 · 약관 법무확정 → `REQUIRE_ENTITLEMENT=true`로 게이트 복원

## 0.23.0 — 2026-06-05 · KMA 기상특보 라이브 승격 (Phase 1)
> 라이브 승격 실측: KMA 특보=포맷 검증(EUC-KR·typ01) → live 승격 / Perenual 무료=분류뿐(케어 유료)·GBIF 중복 → 보류 / 농사로=승인 대기. tsc·vitest 349·arch 그린.
- **KMA 기상특보 실연동**(`integrations/kmaWarning.ts`) — `fetchTextSafeEnc(euc-kr)` + `parseWarnings`/`parseWarningRegions`/`warningsForRegion`. 컬럼=help=1 공식 범례 검증·행=typ01 공백분리(wrn_reg 실데이터로 확인)·**종류/수준 값 패스스루**(임의 코드 해석 안 함)·60초 캐시(과다호출 방지)
- **배선** — `/api/alerts?region=` → 병충해·재해 패널에 **KMA 실시간 특보 합류**(LIVE 배지·지역 부분매칭·키 없으면 [] seed 폴백). renderAlerts에 특보 섹션(esc·레벨별 색)
- **정직성** — ⚠ 캡처 시점 발효 특보 0건이라 '활성 데이터 행' 미관측 → **컬럼·행포맷만 검증, 활성 표시는 발효 시 확인**(featureMap·주석 명시). EUC-KR 미적용 시 한글 깨짐도 명시
- integrations seam→live 졸업(kmaWarning은 agri-alerts 소속·verified:true) · 신규 kmaWarning.spec(7) · 다음: 농사로(승인 시)·NCPMS
- **fix(집중 레드팀 H/M)** — ① 시도 전체명("경상남도")이 KMA 약칭("경남")과 불일치해 **5개 도(경남·경북·충남·충북·전남) 광역특보가 조용히 누락**되던 결함 → 시도 약칭 매핑 도입 ② 동명 시군 과매칭(광주광역시↔경기 광주시) → 상위구역(regUpKo) 정확매칭. 회귀가드 추가 · 보안·정직성 축은 clean · tsc·vitest **349**·arch 그린

## 0.22.0 — 2026-06-05 · 무료 베타 오픈 준비 (Phase 0) — 법무 초안·정직성·해자 CTA
> 런칭 준비도 평가(유료 ❌ 핵심데이터 미검증 / 무료베타 ✅) → 추천 계획 Phase 0. 라이브 승격 실측 결과: Perenual 무료=분류뿐(케어 유료)·KMA 특보=포맷검증(풀슬라이스 P1). tsc·vitest 345·arch 그린.
- **법무 최소셋(초안)** — `/terms`·`/privacy` 페이지(`lansmark_terms.html`·`lansmark_privacy.html`, pages.ts 라우트, server-core 등록, 앱 푸터 링크). 실제 수집 관행 반영(휴대폰=알림·동의·해지파기 / 실측=보정 / 위치=분석·비저장 / 결제=PG). ⚠ **초안·법무검토 전 적용 금지**(배너) — 공개·PII 수집의 게이트
- **플라이휠(해자) CTA** — 시뮬 카드에 "수확 후 실측 입력 → 예측을 추정→검증으로" 안내(실측 데이터 엔진 가속 = 유료 전환의 연료)
- **공개 정직성 감사** — 면책/데모/미검증 라벨이 렌더 경로 전반(disclaimer 13·데모 12·미검증 8·서버 31파일)에 존재 확인(제품 전체 레드팀 정직성 검증과 일치) — 누락 없음
- 다음(P1): KMA 특보 라이브 승격(EUC-KR·구역매핑·위치연동)

## 0.21.0 — 2026-06-05 · 종합 점검 — 제품 전체 레드팀 확정 6건 수정(결제·해자·거버넌스)
> 사장님 선택(종합 점검 먼저): 전체 회귀 + 브라우저 스모크 + **제품 전체(30기능) 횡단 레드팀**(6축·12에이전트, 확정 6·기각 0) → 전부 수정. live 승격 전 known-good 확정. tsc·vitest **345**·arch 그린.
- **결제 무결성(H+M)** — PG 웹훅도 결제 **금액 서버검증**(confirm 경로와 대칭, 불일치=발급 차단) · confirm·webhook이 **주문 결정적 jti**를 써 1결제=1토큰(quota 50→100 이중발급 차단) · 회귀가드 2
- **해자(플라이휠) 보호(M)** — 실측 보정 계산에 **per-user 가중 캡**(단일 제출자가 보정 magnitude 지배 못함; distinctSubmitters가 '배지'를 보호하듯 '보정값'을 보호) + `/api/feedback`도 quota 소진 · 회귀가드 1
- **정직성·거버넌스(M/L)** — featureMap·ARCHITECTURE의 기후모델 문구를 코드와 일치(여름최고·연강수도 ΔT 이동 — 거짓 '스키마 미지원·불변' 제거) · 엔티틀먼트 cap FIFO 축출 가시화(활성토큰 quota 리셋·실효토큰 부활 경고+DB seam 명시)
- 회귀(tsc·vitest 345·arch 오류0·경고0) + 브라우저 스모크(작물검색·핀추천·알림모달·콘솔0) · featureMap 외부 확장(30기능·assess/act/climate) 드리프트 0 확인

## 0.20.0 — 2026-06-05 · 알림 opt-in 팝업 (핸드폰 동의 수집 · VAPID 대체)
> 사장님 결정(VAPID 폐기 → 자체 팝업·번호 수집·지정된 방식). 저장만 먼저, 발송은 seam. 다중 레드팀(확정 8 전부 수정) — tsc·vitest **339**·arch 그린.
- **알림 신청 팝업**(`openAlarmModal`, 병충해 패널 "🔔 알림 신청" 진입) — 개인정보 수집·이용 동의 체크 + 휴대폰 입력 → `POST /api/alerts/subscribe`로 동의·번호 저장. 실제 SMS 발송은 `smsSender` seam(한국 SMS 게이트웨이 키=HUMAN GATE)
- **도메인/저장/라우트**(`src/lansmark/notify/*` + `server/routes/notify.ts`) — `/api/alerts/subscribe`·`/unsubscribe` · 동의 필수(미동의 400)·번호 형식검증·dedupe·**해지=즉시 파기** · 민감 RL(번호 수확 차단) · FileSubscriptionStore(persistence)
- **정직성·PIPA(레드팀 확정 8 수정)**: 원번호 로그·응답 마스킹(`010****5678`) · 해지 UI 제공(수집만큼 쉬운 철회) · 해지 시 레코드 실삭제(파기) · 가입여부 누설 차단(고정 `{ok:true}`) · PII 파일 권한 0600 · 10자리폰(011/016등) 검증 일치 · 발송 미전송을 성공으로 위장 안 함 · 발송 승격 시 위탁/제3자 동의 TODO
- featureMap `alert-subscribe`(operate·live) 등록 · 테스트 9 · VAPID(integrations/push)는 미사용 dormant로 대체 · 브라우저+실서버(file·0600·파기) 실증

## 0.19.0 — 2026-06-05 · 농사로 국내 재배정보 seam (국내=농사로 / 외래=Perenual)
> 사장님 결정(#2를 한국 소스로): 식물 재배정보를 **국내=농사로 / 외래=Perenual** 역할 분리. 세 국내 후보(농사로·국립수목원·AI-Hub) 공식문서·HTTP 실측 리서치 후 — tsc·vitest **326**·arch 그린 · **집중 레드팀(확정 0)**.
- **농사로(농진청) seam**(`integrations/nongsaro.ts`) — 국내 작물 재배정보(재배시기·관수·품종). `http://api.nongsaro.go.kr/service/{svc}/{op}?apiKey=&apiType=xml|json` **HTTP 실측 검증**(garden/lightList→200, 미등록키→resultCode=11). 우리 국내 재배가이드(`cultivationGuide`)를 **데모 룰북→실 RDA 데이터**로 격상하는 경로
- **역할 분리(정직성)** — 국내=농사로(권위·무료), **외래작물은 Perenual**(한국 소스는 외래작물 재배법 미제공). **국립수목원**=종·도감 메타(재배법 無·구API 폐지)·**AI-Hub**=벌크 다운로드(실시간 API X·내국인/학습용/해외반출 제약) → 둘 다 **재배정보 seam 미생성**으로 정직 표기
- 파서는 `SHAPE_UNVERIFIED`(serviceName 133종·출력필드 발급 후 확정) · 비밀 URL 로깅금지 주석 · `listIntegrations` 7종 · 오프라인 테스트 22 · `.env.example`·`HUMAN_GATE.md`(§3 국내/외래 분리)·featureMap 갱신
- fix(arch): 병렬 작업 잔여 orphan `cropClimateTraits.ts`(내서성 시드)를 field-monitor에 등록(경고 0)

## 0.18.0 — 2026-06-05 · 외부연동 준비 — HUMAN GATE seam·발급 체크리스트
> 사장님 선택("준비 먼저"): 키/신청이 선행되는 6종을 **키 꽂으면 live** 되게 준비. 프론트/엔드포인트 무변경(준비층) — tsc·vitest **323**(통합 20 신규)·arch 그린 · **다중 전문 레드팀(확정 5·전부 수정)**.
- **연동 seam 6종**(`src/lansmark/integrations/`) — KMA 기상특보(기존 KMA_API_KEY+활용신청)·NCPMS 병해충 예찰·Perenual/Trefle 식물정보·data.go.kr 농업 지원금·VAPID 브라우저 푸시·모니터링 크론. URL 빌더(문서 기준·확신도 표기) + 키게이트 + `listIntegrations()` 준비 현황(키 **존재여부만**)
- **정직성(추측 금지)** — 실응답 파서는 `SHAPE_UNVERIFIED`로 명시 차단(키 확보 후 실샘플로 작성) · 키 '값' 비노출 · 푸시는 미설정/미구현 시 `ConsolePushSender`(미전송·ok:false)로 **거짓 'live' 라벨 없이** 폴백 · 크론 기본 off(최소 1분·unref)
- **발급 체크리스트(`HUMAN_GATE.md`)** + `.env.example` 빈 템플릿 — 어디서·무엇을·어떤 환경변수로(확신도·UNCERTAIN·출처 포함). 핵심: KMA 403은 키 아닌 '특보 API 활용신청' 클릭(자동승인) · NCPMS serviceCode 일부 UNCERTAIN · Perenual 우선(Trefle 불안정) · 보조금24 자동승인(오퍼레이션 UNCERTAIN) · VAPID 자체생성(web-push 권장)
- featureMap `integrations-seam`(status seam·빈 endpoints) 등록 · 오프라인 테스트 20(URL·키게이트·파서차단·스케줄러·현황집계)
- **fix(레드팀 확정 5)** — ① HUMAN_GATE Perenual 유료가·KMA 포털ID/쿼터에 '변동 가능' caveat(추측 금지 일관) ② 키-포함 URL '로깅 금지' 주석(승격 잠재누수 차단) ③ 스케줄러 NaN everyMs 최소주기 클램프 우회 수정 ④ start() '신규 가동 수' 반환(JSDoc 계약) — F1/F2 회귀 테스트 고정

## 0.17.0 — 2026-06-05 · 작물 검색 → 추천 지역 (검색창 독립 진입)
> 사장님 원안("검색창에 작물을 고르면 추천 지형을 리스트/지도로") 완성 — 필지 없이 작물만으로 진입. 다중 전문 레드팀(제기 2·**확정 0**, UX 1건 선반영). 프론트 전용(엔드포인트 재사용) — tsc·vitest **256**·arch 그린.
- **검색창 2모드** — 상단 검색창 `.srch`에 📍주소/🌱작물 토글(`#smode`). 작물 모드는 `/api/crops` 자동완성 드롭다운(무료/유료 배지·↑↓·Enter·Esc·외부클릭 닫기, 모두 `addEventListener`로 CSP-safe·`esc()`)
- **작물→지역 독립 진입(`renderCropRegion`)** — 작물만 고르면 **필지 없이** `/api/region-fit` 재사용 → 우측 패널에 ① 추천 지형·환경 요구조건 + ② 시도별 기후 적합 칩(적합 먼저·색구분) + ③ **지도 마커 자동 표시**(전국 뷰) + 면책. "← 지도 탐색으로" 복귀
- **상태 위생** — `CROPVIEW` 스테일 가드(연속 선택·fetch 실패), 지도 클릭·주소검색·이벤트 진입 시 작물 마커 정리(`__rgnShown`). 작물 모드에선 '내 위치' 숨겨 흐름 일관(레드팀 UX 선반영)
- 브라우저 프리뷰 실증: 검색 "블루" → 블루베리 선택 → 8지형조건·17시도칩(남부 적합/북부 주의)·17지도마커, 콘솔 에러 0

## 0.16.1 — 2026-06-04 · 작물→지역 적합 지도 마커
- **지도 마커** — 작물 적합 지역(시도)을 지도에 색 마커로(초록=적합·노랑=주의·빨강=부적합우려). "🗺 적합 지역" 리스트의 "지도에 표시" 토글 → 17개 시도 중심에 마커, 클릭 시 사유 팝업. 브라우저 프리뷰 실증(블루베리 남부 초록/북부 노랑). REGION 레이어그룹.

## 0.16.0 — 2026-06-04 · 작물→지역 추천 (시도별 기후 적합)
> "땅→작물"의 역방향 "작물→어디서". 다중 전문 레드팀(제기 1·확정 0, 단 F1 서리축 honesty 반영). tsc·vitest **256**·arch 그린.
- **작물→지역 추천(region-discover · recommend)** — `GET /api/region-fit?cropId=`: 작물 선택 → ① 추천 지형조건(요구조건) + ② **시도별 기후 적합**(적합/주의/부적합, 적합 먼저). 품종 가이드 패널에 "🗺 적합 지역" 리스트(초록=적합·노랑=주의)
- **데이터 정직성** — 시도 평년기후(`sidoClimate.seed`, 근사·검수필요·KMA 평년 seam) × 작물 요구(서리위험=겨울최저 근사) via `field-monitor` 로직 재사용. ⚠ "시도 광역 기후 적합 ≠ 필지 적합(지형·토양·미기상)" 명시 · 재배 성공 보장 금지 · 색은 **초록=적합**(빨강=경고, 추천색 아님)
- **fix(레드팀 F1, honesty)** — 서리 축이 시도 데이터 없어 미평가(unknown)되던 점을 **겨울최저로 서리위험 근사**해 평가(서리민감 작물의 한랭지 '적합' 과장 방지·사유 노출)
- 시도 중심좌표 포함 → **지도 마커(다음 단계)** 준비. ⚠ 전국 고해상 적합 히트맵은 비구현(전국 기후·지형 그리드 필요)
- 신규 테스트: cropRegionFit(6, F1 회귀 포함) → vitest **256** · 실 HTTP(블루베리 남부 적합/북부 주의)·브라우저 프리뷰(17시도 색칩) 실증

## 0.15.0 — 2026-06-04 · 외래작물 기후대 적합성 (GBIF 관측 위도대 × 필지)
- **외래작물 기후대 적합성** — `/api/foreign`에 필지 좌표(lat/lng) 제공 시: **GBIF 관측 분포(위도 300표본)** vs 이 필지 위도·겨울최저(KMA)를 병치 → 소프트 신호(유사/주의). 예: 망고(Mangifera indica) 관측 위도대 7~25°(열대) vs 한국 36° → "노지 어려움·시설 검토·월동 확인"
- **정직성** — '재배 가능/불가' 단정이 아닌 관측 위도대(사실)+필지 기후(사실) 병치 + 별도 검증·면책. 키 불필요. 한글 일반명은 GBIF(학명 기반) 미해결 → 학명 입력 시 기후대 제공(seam: 위키→학명 추출 재질의)
- 신규 테스트: assessForeignClimate(4) → vitest **250** · 실 GBIF 관측분포 HTTP 실증(망고 표본 300·signal=caution)

## 0.14.0 — 2026-06-04 · Phase B 착수 — 외래·임의 작물 조회(GBIF+위키)
> 영농 동반 Phase B 첫 슬라이스: 키 없는 공개 API(GBIF·위키백과)로 외래·임의 작물 실연동. 다중 전문 레드팀(제기 0·확정 0). tsc·vitest **246**·arch 그린.
- **외래·임의 작물 조회(`/api/foreign` · 유료)** — 작물명(국문/학명) → **GBIF 생물분류(species/match)** + **위키백과(ko) 설명** 실연동(키 불필요). 품종 가이드 패널에 '직접 조회' 입력 활성(유료 게이트)
- **정직성 경계** — 임의 작물은 **소득 시뮬 비활성**(`incomeSimAvailable=false`, 엔진 economics 없음) · 해외/일반 '참고 정보'로만(출처 GBIF·위키백과 표기) · 국내 기후·토양 적합성 별도 검증·재배 성공 보장 안 함(면책). ⚠ 실응답 형태를 실연동 캡처로 검증(추측 금지)
- **seam(추가 Phase B)** — 정밀 재배요구(Trefle/Perenual·키=HUMAN GATE)·실전 재배법(OpenFarm)·기후대 적합성 매칭. 한글 일반명은 GBIF(학명 기반) 미해결 → 위키 설명 제공(학명 입력 시 분류까지)
- 신규 테스트: foreignCrop(4)·foreignRoutes(3) → vitest **246** · 실 GBIF/위키 HTTP 실증(망고) + 브라우저 프리뷰(직접 조회 카드)
- 보안: 유료 게이트가 네트워크 호출 **前** 차단 · name 정규식+encodeURIComponent · sensitive RL · 외부 텍스트 esc

## 0.13.1 — 2026-06-04 · 전체 작물 보기 (무료 대표작물 선택)
- **전체 작물 보기** — 추천(적합도 top-N) 밖이라 안 보이던 작물(벼·보리 등)을 토글로 펼쳐 직접 선택. 무료/유료(가이드 티어) 배지. `GET /api/crops`(전체 작물 카탈로그)
- 신규 테스트: cropsCatalog(2) → vitest **239** · 브라우저 프리뷰(전체 17작물 칩·벼·보리 노출) 실증

## 0.13.0 — 2026-06-04 · 환경 점검 + 지원금·혜택 (영농 동반 비전 완성)
> 영농 동반 마지막 2슬라이스(일일 환경 모니터링·지원금). 통합 다중 레드팀(제기 0·확정 0). tsc·vitest **237**·arch 그린. **영농 동반 6/6 완성.**
- **환경 점검(field-monitor · operate)** — `GET /api/monitor?cropId=&lat=&lng=`: 지역 기후(KMA 연/계절 요약: 강수·겨울최저기온·일조·서리) vs 작물 요구조건 → 축별 적합(양호/주의/위험). 무료·sensitive RL. ⚠ 일일 실측·필지별 시계열·자동 알림(인앱/푸시)은 Phase B seam
- **지원금·지자체·농협 혜택(support-programs · recommend)** — `GET /api/support?region=&cropId=`: 대표 지원 제도(정부/지자체/농협) 안내 + 작물 관련도 + **공식 확인 경로**. 무료. ⚠ 금액·자격은 단정하지 않음(공식 출처 확인) · 공공데이터포털·농협 실시간 큐레이션은 Phase B seam
- **영농 동반 비전 6/6 완성** — 재배일지·리포트(0.9) / 출하 시세·납품처(0.10) / 품종·재배 가이드(0.11) / 병충해·재해 주의(0.12) / **환경 점검 + 지원금(0.13)**. `operate` 단계 가동
- 데이터 정직성: 기후=KMA 요약(일일 아님 명시)·작물요구=룰북 / 지원금=대표 제도 큐레이션(공개 사실)+공식 확인. 면책·추측 금지 일관
- 신규 테스트: fieldMonitor(5)·monitorRoutes(3)·supportPrograms(4)·supportRoutes(2) → vitest **237** · 브라우저 프리뷰(환경점검·지원금 패널 라이브 렌더) 실증
- 레드팀: 4에이전트·4렌즈(모니터링 정직성·지원금 정직성·견고성·XSS) → 제기 0·확정 0
- **화면 레이아웃 정리** — 동반 정보 패널 5종(출하·병충해·환경·지원·재배일지)을 시뮬 카드 내 **탭 그룹**으로 통합(세로 스택 5칸 → 1칸·한 번에 하나만·CSP 안전 addEventListener) · 브라우저 프리뷰로 탭 전환 실증

## 0.12.0 — 2026-06-04 · 병충해·재해 주의 (작물·이번 달)
> 영농 동반 4번 슬라이스(병충해·재해 알람). 다중 전문 레드팀(제기 1·확정 1·수정). tsc·vitest **223**·arch 그린.
- **병충해·재해 주의(agri-alerts · operate)** — `GET /api/alerts?cropId=&month=`: 작물 **병해충**(룰북: 발생 시기·대응) + **기상/재해**(작물 특성+계절 농학: 서리·가뭄·장마·폭염·태풍·한파) → **기준 월 '지금 주의'(active)** 매칭·정렬. 시뮬 카드에 패널(무료·안전 정보)
- **데이터 정직성** — 병해충=cropPests.seed 룰북, 기상/재해=일반 계절 농학. '예보/예찰' 단정 없이 **참고·시기 기반** + 면책(방제 효과 보장 안 함). ⚠ 실시간 NCPMS 예찰·KMA 기상특보·지역(lat/lng) 특보·인앱/푸시는 Phase B seam(키·인프라=HUMAN GATE)
- **fix(레드팀 F1): 발생 시기 과대 산출** — `monthsOfSeason` 키워드 부분문자열 충돌('초/한/늦여름'이 광역 '여름'에도 매칭)로 active 월이 1~2개월 넓게 잡히던 과대 경보. 긴 키 우선+매칭분 소거로 수정(초여름→6월만)
- 신규 테스트: agriAlerts(10)·alertsRoutes(4) → vitest **223** · 브라우저 프리뷰(벼 6월 '지금 4건' 패널) 실증

## 0.11.0 — 2026-06-04 · 품종·재배 가이드 (무료 대표작물 / 유료 전체)
> 영농 동반 3번 슬라이스(재배 가이드·품종). 다중 전문 레드팀 검증 통과(제기 1·확정 0). tsc·vitest **208**·arch 그린.
- **품종·재배 가이드(cultivation-guide · growth)** — `GET /api/guide?cropId=`: 작물 1종의 **품종 후보**(품종군) + **재배 환경 요구조건**(pH·배수·물·일조·내한성·서리·노동·경사) + 재배 적기(월력) + 리스크. 시뮬/페이월 화면에 패널 노출(작물 선택 시)
- **무료/유료 티어** — 무료=대표작물(STAPLE_FREE: 사과·감자·고구마·배추·콩·옥수수·양파·마늘·고추), 유료=전체 작물(엔티틀먼트 게이트 → 402 `GUIDE_PAID`). 목록 밖(임의·외래) 작물은 400(`UNKNOWN_CROP`)
- **외래·임의 작물 = Phase B seam(유료)** — 사용자 직접 작물 추가 + 국내(농사로)·해외(GBIF/Wikidata/Trefle/OpenFarm) 정보 병합 + 기후 적합성 경고 + **소득시뮬 비활성(가이드만)**. 프론트에 '직접 추가(유료·준비중)' 자리 노출
- **데이터 정직성** — 현재 출처=룰북(데모·미검증)+표준 월력 조립, **농사로(농촌진흥청) live-upgrade seam**(키=HUMAN GATE). 재배 성공/수익 보장 금지·면책
- 신규 테스트: cultivationGuide(5)·guideRoutes(5) → vitest **208** · 브라우저 프리뷰(무료/유료 패널 라이브 렌더) 실증
- 레드팀: 제기 1·**확정 0** — 만료토큰 402-평탄화 지적은 `/api/feedback`과 동일 관행·fail-closed·통과테스트 고정으로 적대검증이 반증
- **벼·보리(대표 식량작물) 무료 티어 포함** — `crops.seed`에 데모 프로필 + 재배월력 추가, `STAPLE_FREE`에 등록(⚠ 수치는 데모 근사값·실 RDA 소득자료 검증 필요)

## 0.10.0 — 2026-06-04 · 출하 판로 비교(KAMIS 실시세 앵커) + 운영 게이트 강화
> 영농 동반 2번 슬라이스(출하). 다중 전문 레드팀 + **브라우저 프리뷰**로 통합 버그 3건 포착·수정. tsc·vitest **198**·arch 그린.
- **출하 판로 비교(harvest-market · operate)** — `GET /api/market?cropId=&yieldKg=`: 작물 룰북 판로비율(도매/직거래/혼합/가공/체험)에 **KAMIS 실도매가를 앵커**로 레벨링 → 판로별 기대 단가·도매 대비%·기대매출. 무료(가입 훅)·sensitive 레이트리밋. 시뮬 카드에 패널(라이브 실증: 사과 도매 9,102원/kg → 직거래 +78.6%)
- **fix(프리뷰 포착): 재배일지 GET 인증 누락** — `jget`이 엔티틀먼트 헤더를 안 보내 일지 조회·시즌 리포트가 실브라우저에서 402로 안 열리던 버그. 헤더 동봉으로 수정(유닛테스트가 헤더를 직접 줘서 못 잡은 통합 결함)
- **fix(레드팀 F1): mock 가격을 '실시세'로 호도 금지** — KAMIS 키 없을 때 auto가 mock 가격을 반환하는데 `anchor:"live"`로 표기하던 문제. source가 mock이거나 SigmaRange 부분형이면 live 앵커에서 제외(seed 강등) → 데이터 정직성
- **fix(레드팀 F2): 면책 문구 분기** — seed 폴백인데 '실시세 앵커한 추정'이라 단언하던 모순을 앵커 상태(live/seed)에 따라 정직하게 분기
- **운영 게이트 강화(방어심화)** — `NODE_ENV=production`에서 `LANSMARK_REQUIRE_ENTITLEMENT=false`(유료게이트 전체 우회·해자 붕괴)면 부팅 차단(`LANSMARK_ALLOW_OPEN_PAID=1`로만 우회) + bootSafety 행동 테스트
- 신규 테스트: salesChannels(7)·marketRoutes(5)·bootSafety(3) → vitest **198** · 브라우저 프리뷰(출하·재배일지 패널 라이브 렌더) 실증

## 0.9.0 — 2026-06-04 · 영농 동반 시작(재배 기록·리포트) + 비전 로드맵
> "한 번 쓰는 계산기 → 심고~수확까지 매일 쓰는 영농 비서"로의 첫 슬라이스. 다중 전문 레드팀(9에이전트·5렌즈) 적대검증 → 확정 2건 수정. tsc·vitest **183**·arch 그린.
- **재배 일지(`operate` 단계 신설)** — 시뮬 결과를 예측 baseline으로 결속해 재배 시작 → 작업(파종·시비·방제·관수…)·수확 기록 → 시즌 리포트(기간·투입비·수확·순수익·예측 대비 정확도). `POST /api/journal`·`/api/journal/event`·`/api/journal/harvest` · `GET /api/journal[?id=]`·`/api/journal/report` — 엔티틀먼트 게이트·소유권 격리(타인 404)·입력 클램프(변조/DoS)
- **수확 → 플라이휠 환류(해자)** — 수확 실측을 OutcomeRecord로 승격(**최초 1회만** · 반복 POST 중복 차단). `actualCost`는 기록 작업비라 부분원가 → 미전송(비용 보정 왜곡 방지). 재시작 보존(`FileJournalStore`, memory↔file↔DB seam)
- **영농 동반 비전 6종 지도 등록** — 재배가이드·품종(농사로) / 지원금·지자체·농협 혜택(공공데이터) / 일일 환경 모니터링(KMA) / 병충해·재난 알람(NCPMS·KMA특보) / 출하 시세·납품처(KAMIS) / 재배기록·리포트. `status:seam` + 데이터소스·필요인프라·HUMAN GATE를 notes에 로드맵화(흩어짐 방지 — 한 슬라이스씩 승격)
- **fix(레드팀 MOAT-1): '✓검증' 배지 위조 차단** — `dataLabel`을 원시 건수(`cal.n`)가 아니라 **서로 다른 제출자 수(`validatedBy`)**로 판정. 단일 사용자가 다중 일지/반복 제출로 validated를 위조하던 경로 차단(`getValidationLevel`과 `distinctSubmitters`로 SSOT 통일). 보정 강도는 건수 유지(데이터 많을수록 정확)
- **fix(레드팀 DOS-2): create 핫패스 비용 절감** — 사용자당 상한 체크를 `listByUser`(전체 스캔+전건 복제+정렬)에서 `countByUser`(카운트 전용)로 교체
- 신규 테스트: journalReport(6)·journalRoutes(8)·db journal(2)·MOAT-1 위조차단 회귀(3) → vitest **183** · 실 HTTP E2E(결제→시작→작업→수확→리포트·소유권·디스크 환류) 실증
- 레드팀 결과: 제기 4 · 확정 2(수정) · **기각 2(오탐)** — 전역 엔티틀먼트 스위치(canonical도 동일·의도된 마스터 토글)·전역 evict(동기 제어흐름+get-404 가드로 에스컬레이션 불가)를 적대 검증자가 코드 근거로 반증

## 0.8.0 — 2026-06-04 · 영속성 (재시작 내구) + 토큰 실효
> 레드팀 재검증이 남긴 운영 인프라 잔존(in-memory→재시작 소실)을 **무의존성 파일 스토어**로 해소.
- **영속 스토어 3종** — 실측 플라이휠(`feedback.json`)·웹훅 멱등(`idempotency.json`)·유료권한 소진·실효(`entitlement.json`)를 원자적(temp→rename) 파일로 저장 → **재시작에도 보존**
- **드롭인 전환** — `LANSMARK_STORE=file`(기본·단일 인스턴스) | `memory`(휘발) · 쓰기 불가 시 memory 자동 폴백 · `LANSMARK_DATA_DIR`
- **DB seam** — 같은 인터페이스(`db/stores.ts`)로 Postgres/Redis 어댑터 추가 시 다중 인스턴스/고throughput 지원
- **토큰 실효 API** — `POST /api/ops/revoke {jti}`(관리자 전용) → 환불/분쟁 시 유료권한 무력화(레드팀 H4 마무리)
- `/api/health`·운영 콘솔에 저장모드 노출 · 신규 `db.spec`(재시작 보존) · vitest **164**
- **기능 흐름 아키텍처 지도(거버넌스 도구)** — SSOT `scripts/featureMap.ts` + `npm run arch`(지도↔코드 자동 대조·드리프트 차단, verify·Stop 훅 포함) + 자동생성 시각본 `ARCHITECTURE.md`(Mermaid). 코딩 전 지도 우선(CLAUDE.md 규칙)
- **Toss 결제 목업 + 실연동 seam** — Toss풍 결제창 모달(데모 결제, 키 없이 흐름 완성) + 실 Toss v2 SDK redirect seam(`TOSS_CLIENT_KEY` 연결 시 자동 전환) + 복귀 승인(`handlePaymentReturn`→`/api/pay/confirm`). CSP에 Toss 도메인 허용. 브라우저 실증(페이월→모달→승인→잠금해제)
- **fix: `.env`/`.data` 경로를 cwd 의존 → 프로젝트 루트(`__dirname`) 고정** — 프리뷰/특정 런치 환경(cwd≠프로젝트)에서 키를 못 읽던 잠복 버그. 수정 후 Toss 테스트키로 live 전환·confirm 실 Toss 도달(시크릿 인증 성공) 실증
- **fix: CSP를 `*.tosspayments.com` 와일드카드로** — Toss SDK가 게이트웨이(`apigw-sandbox`)·로깅(`event`) 등 다중 서브도메인에 호출하는데 `api.`만 허용해 결제창 초기화가 "UNKNOWN"으로 실패하던 버그. script/connect/frame/form-action 전부 허용 → 결제창 리다이렉트 정상(네트워크 실증)

## 0.7.0 — 2026-06-04 · 레드팀 보안 강화 (27건 수정)
> 다중 전문 레드팀(70 에이전트) → 적대적 검증으로 확정한 27건(고유 21)을 전부 수정. tsc·vitest **159**·guardrail 그린 + 런타임 실증.
- **레이트리밋 우회 차단(H1)** — `clientIp`가 `X-Forwarded-For`를 기본 무시(소켓IP), 신뢰 프록시(`LANSMARK_TRUST_PROXY_HOPS`)일 때만 채택+IP검증. 지오조회도 민감버킷
- **배포 fail-closed(H2·H5·M1)** — 운영에서 약한 시크릿/전체 CORS/무인증 콘솔이면 **부팅 차단**. 하드코딩 기본 시크릿 제거(비운영은 부팅별 임시 랜덤). 데모결제는 운영/Toss키 시 비활성
- **결제 무결성(H3·H4·M2·M3)** — confirm 금액=서버 `simPriceKrw`·userId 서버유래 · 토큰 **소진형 quota+실효(jti)** · 웹훅 userId 서버유래·멱등 상한
- **피드백 무결성(H6)** — `/api/feedback` 엔티틀먼트 게이트 + 'validated'를 **서로 다른 제출자 수**로 판정(자기검증 위조 차단)
- **live 견고성(M4·M5·L3)** — `fetchJsonSafe`/`fetchTextSafe`(타임아웃+파싱가드) · `okClimate` 표본·범위 검증 · 저장소 상한(M9)
- **가드레일·프론트(M6·M7·M10·L1·L2·L4·L5)** — 신뢰도 부스트는 서버 관측만 · validated/base.verified 분리 · 핀 경쟁조건 세대토큰 · 에러 일반화 · baseYear · CDN SRI · 복원 경쟁

## 0.6.0 — 2026-06-03 · 보안 강화 (CSP · 보안헤더 · 레이트리밋 · CORS)
- **CSP**: HTML은 인라인 스크립트 nonce + 외부 호스트 허용목록(cdnjs/fonts), API(JSON)는 `default-src 'none'`
- **보안 헤더(helmet 상당, 의존성 0)**: `X-Content-Type-Options:nosniff` · `X-Frame-Options:DENY`(+`frame-ancestors`) · `Referrer-Policy` · `Permissions-Policy`(geolocation=self만) · `COOP/CORP` · https일 때 `HSTS`
- **레이트리밋(express-rate-limit 상당)**: IP 고정창 · `/api/*` 글로벌 240/분, 결제·시뮬·피드백·웹훅 30/분 → 초과 시 429+`Retry-After` (`LANSMARK_RATE_GLOBAL`/`LANSMARK_RATE_SENSITIVE`)
- **CORS**: 허용목록(`LANSMARK_CORS_ORIGIN`, 기본 `*`) + `OPTIONS` 프리플라이트(커스텀 인증헤더 포함)
- **부팅 안전점검**: 운영(`NODE_ENV=production`)에서 기본 엔티틀먼트 시크릿이면 부팅 차단(위조 방지) · 관리자 토큰 미설정/전체 CORS 경고
- **피드백 변조 방지**: 실측 입력 0↑·상한 클램프 → 보정 플라이휠(해자) 무결성 보호
- 신규 `api/security.ts` + `security.spec.ts`(18) · skeleton **133 테스트** 그린

## 0.5.0 — 2026-06-03 · 시군 수면경고 · 재확인 입력 · 비교 보정상태 · 버전 알림
- 버전 관리 + 업데이트 변경점 팝업(`/api/version` ↔ localStorage) · 운영 콘솔 버전 표시
- 시·군/전국 줌에서도 강·바다(수면) 탭 시 경작 불가 차단(이전엔 필지 줌만)
- 기존 농경지 '재확인' 입력(현재 재배 현황: 빈 땅/벼/밭/과수) — 이미 재배 중이면 전작 정리비·공백기 안내
- 다중 비교표에 보정상태(검증/추정) 컬럼

## 0.4.0 — 2026-06-03 · 운영 콘솔 · 결제 · 드롭인 연동
- 운영자 콘솔(`/ops`): 통합 준비도·결제·플라이휠·보정버킷·활동로그 + 관리자 인증(`LANSMARK_ADMIN_TOKEN`)
- 결제(PG) 페이월 + 유료권한: 무료 추천 → 결제 → 정밀 분석 잠금해제 (Toss seam · 데모결제 · 엔티틀먼트 게이트)
- 드롭인 provider(`auto`): API 키만 꽂으면 통합별 자동 운영 전환(mock 폴백 무중단) · `RUN_GOLIVE.md`
- 생육·출하 타임라인(파종→수확·출하) + 판로(salesChannel)·재배연차(targetYear)·실필지면적 소득 반영
- 토지유형 구분(강·바다·도시·기존농경지) · 주소·지번 검색 · 내 위치

## 0.3.0 — 2026-06-02 · 보안·정밀 하드닝
- 반사형 XSS 차단 · 입력검증 · 요청바디 상한 등 보안 강화
- 추천 점수 범례 · 비교/PDF 가드레일 · 음수소득(미검증 placeholder) 안내 개선

## 0.2.0 — 2026-06-02 · 지도 메인 실엔진 연동
- 지도 클릭 → 실엔진 정밀 소득 시뮬(P10/50/90 · 근거 6축 · 손익분기 · 면책)
- 실측 보정 플라이휠 · LIVE 이벤트 피드

## 0.1.0 — 2026-05-30 · 초기 스캐폴딩
- 작물·수확·소득 시뮬레이터 코어 · 지오스택 · 결제 모듈 (77 테스트)
