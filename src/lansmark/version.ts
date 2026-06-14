/**
 * 버전 · 릴리스 노트 — 단일 출처(SSOT).
 *  - APP_VERSION = RELEASES[0].version (최신).
 *  - 버전업 시: 맨 앞에 새 Release를 추가하고 package.json version·CHANGELOG.md를 함께 올린다.
 *  - 프론트는 /api/version 으로 읽어 "마지막 본 버전"과 비교 → 신버전이면 변경점 팝업.
 */
export interface Release {
  version: string; // semver (x.y.z)
  date: string;    // YYYY-MM-DD
  title: string;
  items: string[];
}

export const RELEASES: Release[] = [
  {
    version: "0.74.3",
    date: "2026-06-14",
    title: "라이브 UX 수정 — 비교뷰 정리(따로=작물/합쳐서=소득) + 큰필지 경고 + 지도 preconnect",
    items: [
      "비교뷰 중복 정리(라이브 피드백): '따로'가 전 구역을 자동 시뮬해 작물+소득이 중복 표시되던 것 → '따로'=구역별 추천 작물만, '합쳐서'=소득 비교(랭킹)로 명확 분리. 따로는 시뮬 안 해 더 빠름.",
      "큰 필지 정직 경고: 대면적(>10ha·산지/임야 통째) 선택 시 '소득은 전체 면적 기준이라 단일작물엔 비현실적' 토스트 + '⚠대면적 N ha' 표기 — −2.7억 같은 숫자가 전체면적 기준임을 오인 차단(정직성).",
      "지도 초기 로드 가속: VWorld 타일·cdnjs·gstatic preconnect 추가(작은 개선 — 근본 느림은 VWorld 서버 지연·전국 zoom7 다수타일이라 후속 프로파일링 필요).",
      "프런트 단일파일 — 인라인 JS 구문 OK·서빙 검증. tsc·vitest 무관·arch 0.",
    ],
  },
  {
    version: "0.74.2",
    date: "2026-06-14",
    title: "익명(PII-0) 쓰임검증 모드 + L1 표시 정직성",
    items: [
      "익명 PII-0 모드(LANSMARK_ANON_ONLY) — 무료 '쓰임 검증' 베타용. 회원가입(이메일/전화)·알림 전화구독·푸시구독 엔드포인트를 서버에서 404로 차단(개인정보 미수집)하고, /api/config로 노출해 앱이 로그인·알림 UI를 숨긴다. 핵심 무료 흐름(땅선택→추천→시뮬)은 익명ID로 그대로 작동. deploy.sh에 ANON_ONLY=1(계정·알림 열려면 제거). 라이브 검증: account/alerts/push=404 · recommend=200 · config.anonOnly=true.",
      "L1(표시 정직성): 보정 '실측 N건' 표시가 원시 건수라 단일 사용자가 일지 다건으로 부풀릴 수 있었음 → 표시(reason)를 제출자 캡(MAX_WEIGHT_PER_USER) 반영 '유효 건수'(effectiveSampleCount)로. 보정 magnitude·승격·scope 로직(n)은 raw 유지(무회귀). 익명 다중신원은 한 풀로 합산.",
      "검증: tsc·vitest 553(+2: L1 유효건수·anonOnly 게이트) · arch 0. ⚠ 익명 모드 배포는 개인정보 수집 0이라 처리방침 부담 없이 쓰임·지불의사(가격노출 클릭) 측정 가능 — 회원가입/문자를 켜려면 개인정보방침 확정이 선행.",
    ],
  },
  {
    version: "0.74.1",
    date: "2026-06-14",
    title: "보안 패치 — 비결제 레드팀(정직성 위반 2건) + at-rest 키 형식검증",
    items: [
      "비결제 표면 멀티에이전트 red-team(16에이전트·7확정) 수정. H1(정직성 1원칙): validateLandInput이 클라 soilEvidence.source를 무검증 통과 → 'official_soil_test' 위조로 신뢰등급 'A'(공식 토양검정) 날조 가능했음. sanitizeSoilEvidence로 클라값을 manual_input(C)/none(D)으로 강등(위성 sanitizeSatellite와 동일 서버 신뢰경계), 검정등급(A/B)은 서버 인증 파이프라인만 부여.",
      "H2(해자·정직성): 무료베타에서 일지 수확이 계정ID(acct:*)를 '✓검증' 배지에 산입(/api/feedback는 anon 제외인데 일지만 acct 산입 비대칭) → 무결제 이메일 다계정으로 검증배지 위조 가능했음. flywheelSubmitterId로 무료 계정ID를 anon 네임스페이스로 강등(배지 제외·보정 magnitude 기여는 유지) — 피드백 경로와 대칭.",
      "L2: 무인증 /api/client-error가 운영자 Slack/Discord 경보로 새니타이즈 없이 전송 → @everyone 핑·피싱링크 인젝션 가능. @<> 무력화 + allowed_mentions:{parse:[]}. L3: retail-price·alerts(외부 API 쿼터 소모)를 sensitive 레이트버킷 편입. (L1=일지 수확 표시건수 부풀리기는 후속 Low.)",
      "at-rest: bootSafety가 LANSMARK_DATA_KEY '존재'만 검사하던 것 → hex64 형식검증 추가(형식 틀린 운영키가 dataKey()에서 null이 되어 조용히 평문 PII 저장하는 배포 footgun 차단). 미서빙 레거시 데모 브랜드 LENSMARK 정합(사용자 노출면은 이미 전부 LEN).",
      "검증: tsc·vitest 551(+3: soil 위조·flywheel 배지·DATA_KEY 형식) · arch 0 · guardrail STRICT 0. 결제 red-team(v0.74.0)에 이어 비결제 표면 종결. ⚠ 무료베타 배포는 이 패치 후 기술 게이트 통과(법적 통신판매/개인정보방침은 별개 HUMAN GATE).",
    ],
  },
  {
    version: "0.74.0",
    date: "2026-06-14",
    title: "PG 2종 스위칭(Toss+PayPal) + 결제·인증 멀티에이전트 red-team",
    items: [
      "결제대행 2종화 — Toss 직결에 PayPal(REST v2 orders) 추가 + 스위칭. pgRegistry(순수 SSOT)가 키 조합으로 off/pending/live + 활성 PG 판정(체크아웃·ops·부팅 공용). PayPal provider는 키 없으면 전 경로 fail-closed(create/capture/webhook throw·발급 0) — 키=HUMAN GATE(PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID). 웹훅은 PayPal verify-webhook-signature API + cert_url paypal.com 화이트리스트(SSRF 방어) + 서버권위 금액검증(KRW 정확액). ⚠ webhook 이벤트 필드·KRW 통화는 공식 docs 재검증 마커(운영 키 E2E 1건 후 live 승격).",
      "ops PG 스위칭 — /api/ops/pg-preference(관리자 토글·CSRF 가드)로 활성 PG 전환(키 미완비 PG는 409 거부) + PG 위젯(provider별 live/pending/off pill·웹훅 readiness·활성 전환). 부팅 점검을 레지스트리 SSOT 기준으로 일원화(반쪽설정 전수 차단 — Toss/PayPal/향후 PG 자동).",
      "멀티에이전트 red-team(qwen 1차 + 6차원 적대감사 스웜·15에이전트·반증검증) — 무인증 위조발급·금액우회·이중민트 0건(전 경로 fail-closed 확인). 확정 2건(Low·정직성 1원칙) 수정: ① 레지스트리 라벨('결제 가능=client+secret')을 런타임 게이트와 일치 — 'pending인데 실발급'되던 거짓 라벨 제거(webhook은 별도 readiness로 정직 노출) ② 부팅을 레지스트리 pending 전수 차단으로(client-less 반쪽설정 사각 해소). + PG 네임스페이스(orderJti 'pp:' 접두 — Toss·PayPal orderId 동일문자열 충돌 차단). uncertain 3건(capture-hijack·boundAccount webhook·런타임 의존)은 실 PayPal 키 E2E 시 검증 대상으로 명시.",
      "검증: tsc·vitest 548(+17: pgRegistry 8·paypal fail-closed/금액/cert/네임스페이스 9) · arch 0(paywall-entitlement에 paypal·pgRegistry 등록) · ops 위젯 라이브 서빙 확인. ⚠ PayPal 운영 활성 = 키 주입 + webhook 이벤트 docs 재검증 + 통신판매/가맹 심사가 HUMAN GATE.",
    ],
  },
  {
    version: "0.73.1",
    date: "2026-06-13",
    title: "토지선택 복원 버그 수정 — 저장/공유 선택도 실필지로",
    items: [
      "v0.73 회귀 수정: 저장된 선택 복원(새로고침 resume·공유링크 #s=)이 옛 격자(cellOf·L.rectangle)로 떠서 실제 필지와 모양·면적이 달랐다. restore가 저장 lat/lng로 apiParcel을 재호출해 실폴리곤·PNU·실면적으로 재구성(onClick과 동일). 면적은 실필지 기준으로 보정, 저장된 판로·연차 옵션은 보존.",
    ],
  },
  {
    version: "0.73.0",
    date: "2026-06-13",
    title: "토지선택 UI — 격자→실제 필지 경계 + 평/㎡ 합산 + 라이브이벤트 숨김",
    items: [
      "토지선택을 격자(줌단계별 셀)에서 **실제 필지 폴리곤**으로 — 클릭한 점의 필지 경계를 VWorld 실데이터로 렌더. PNU로 키잉해 줌해도 선택이 안정(같은 필지=같은 키 → 확대/축소 시 중복 선택 버그 해소). 기본 모드를 '필지 선택'으로. 폴리곤 없으면 작은 점선 사각형(원 표기 제거).",
      "면적을 '구역: N평 · M㎡'로 — 평(1평=3.3058㎡) 병기, 다필지 선택 시 합산. 라이브 이벤트(데모 트리거) 숨김 토글(👁) — 피드 본문 + 지도 마커.",
      "피드백 반영: ① 위성+일반 basemap 오버랩 차단(전환 시 기존 타일레이어 전부 제거) + 경계·라벨 보이는 일반맵 기본 ② 다중선택 재렌더 시 스크롤 보존(추가 선택해도 위로 안 튐) ③ 대지·도시(warn) 토지도 작물 표시(차단 대신 경고 배너 — 지목≠실이용) ④ AI 출처 href 프론트 스킴가드.",
      "제도화: preview 서버 좀비 무응답 감지(preview-check.sh PostToolUse 훅 · CLAUDE.md #9) — '죽은 서버를 반영됨으로 보고'한 혼선 재발 방지. ⚠ 적합도 그라데이션 시각화(작물 아이콘·빨강~파랑)는 후속 슬라이스.",
    ],
  },
  {
    version: "0.72.0",
    date: "2026-06-13",
    title: "ops 정직성 — provider 런타임 건강(거짓 녹색 차단) + 프런트 반영 안전장치",
    items: [
      "거짓 녹색 차단(정직성 1원칙): 기존 ops의 연동 'live/녹색'은 '키가 꽂힘'(설정)일 뿐 'API가 지금 동작'이 아니었다 — 키 있는데 API 다운→조용히 mock 폴백이면 ops가 거짓 녹색(false confidence). 신규 runtimeHealth가 auto.pick()의 *실제 호출 결과*(live 성공 vs mock 폴백)를 연동별 집계 → integrationReadiness의 live를 런타임-인지로(degraded=마지막 폴백이면 live=false). 상태 4분: off(키없음)·pending(미검증)·live(실 성공)·degraded(실 API 다운 추정). 라이브 실증: parcel·DEM·KAMIS=🟢실데이터, 미트리거 경로=⚪미검증(거짓 LIVE 아님)",
      "ops 노출: 통합목록이 degraded를 '⚠폴백중'으로 강등·pending을 '키있음·검증전'으로 정직 표시 + 요약 '🟢실데이터 N·⚪검증전·🔴폴백·⚫키없음'(사용자가 실제 받는 게 라이브인지 mock인지). 신뢰 피쉬본(qualityGate)도 'mock(키없음)'과 '키 있으나 폴백 중(실 다운)'을 구분. ※ 서버 다운 시 연결실패 배너(O3)·'운영 녹색≠데이터 정확'은 기존대로 유지 — 사용자 노출 정확도(✓검증/추정)는 실 RDA·보정 기반이라 키-API 다운에 안 속음(보호 유지)",
      "프런트 반영 안전장치(제도화): preview 서버가 좀비로 무응답인데 '반영됨' 보고→캐시 옛 페이지 혼선난 사건 재발 방지. scripts/preview-check.sh가 dashboard/*.html 편집 시 서버가 *실제 서빙 중인지* 자동 점검(무응답/0바이트=⛔, 정상=✓), PostToolUse 훅 등록 + CLAUDE.md 불변식 #9",
      "검증: tsc·vitest 531(+7: runtimeHealth 5·readiness degraded/live 2) · arch 0(runtimeHealth→provider-seam 등록) · guardrail STRICT 0",
    ],
  },
  {
    version: "0.71.0",
    date: "2026-06-13",
    title: "설계감사 P2 일괄 — 방어·정합·부팅 하드닝(12건)",
    items: [
      "입력·방어: fetchSafe 응답 본문 바이트 상한(거대/무한 업스트림 메모리 고갈 차단·스트림 증분) · AI 출처 href 프론트 스킴가드(서버 https 필터 + 클라 이중) · injectNonce를 속성 있는 인라인 스크립트까지(가용성 함정 제거) · geocode address 길이캡 · Perplexity 실패 캐시 음성TTL(10분) 분리 + FIFO 상한 경계 정정",
      "수치·가드레일: floorIncomeLoss에 단조성 가드(p10≤p50) — costP90=0·전음수 income 경계의 분포역전 잠재 차단 · 면책 횡단 회귀가드(공유 프리미티브 비거나 paid 결과에서 면책 누락 시 실패)",
      "영속 신뢰성: FsDoc 영구실패 시 스냅샷 보존 + whenDrained 종료 재시도(조용한 유실 차단) · 감사로그 in-flight를 flushAll이 대기(종료 유실창 축소) · firestoreLite getJson 재시도(부팅 일시장애로 불필요한 sealed 방지) · entitlement warm을 allSettled로(첫 실패에도 모든 문서 sealed 보장)",
      "보안 부팅·전송: NCPMS BASE를 https로(apiKey 평문 쿼리 전송 제거·사과 33건 실증) · 운영 부팅 강제 추가 — TOSS_CLIENT_KEY만 있고 서버 비밀키/웹훅 시크릿 없으면 차단, LANSMARK_DATA_KEY 미설정(PII 평문)이면 차단(LANSMARK_ALLOW_PLAINTEXT_PII=1 명시 우회)",
      "검증: tsc·vitest 524(+5) · arch 0 · guardrail STRICT 0 · NCPMS https·foreign 라이브 무손상. 보류(근거): 토큰 httpOnly 이관(§3-1①②③·유료 결제흐름 아키텍처)·revoked per-record(멀티인스턴스)·widen/year1(트레이드오프) — 유료 정식 전/별 슬라이스",
    ],
  },
  {
    version: "0.70.0",
    date: "2026-06-13",
    title: "설계감사 후속 — 가드레일 P0(외래 LLM 게이트) + 영속·훅 P1 보강",
    items: [
      "P0(가드레일·라이브): 외래작물 AI 재배요약(Perplexity)이 '엔드포인트 신뢰'에만 의존해 /api/foreign?name=사과 등 코어 한국작물(실 RDA/KAMIS)에도 LLM 요약이 새던 1원칙 위반을 코드로 차단. crops.seed.isCoreCropName(한글 정식·괄호前 기본형·괄호內 이형·영문)으로 라우트에서 게이트 — 라이브 실증: 사과·마늘→cultivationAI null, 망고→유지(5출처). 회귀 spec(coreCropGate) 고정",
      "P1(LLM 가드레일 이중화): ② 출처(citations) 0개면 요약 폐기(검증수단 없는 LLM 텍스트 금지) ③ 정량수치(수확량·소득·단가) 경성 후처리 필터(hasQuantClaim) — 프롬프트(연성) 우회·인젝션 대비, 온도(℃)·pH 등 정성맥락은 허용(false-positive 방지)",
      "P1(영속 정합): ④ FsDoc.saveNow를 save()의 단일 drain 큐로 합류 — 두 경로 동시 PATCH로 옛 스냅샷이 새 스냅샷을 덮어 실효가 부활하던 lost-update 제거(동시 PATCH 0 실증). ⑤ entitlement use 축출을 FIFO→만료(exp) 우선으로 — 활성 토큰 quota 재부여 차단(consume에 토큰 exp 전달·하위호환 직렬화)",
      "P1(훅 차단망): guardrail-scan 범위에 server·concept 추가(이전 사각) + GUARDRAIL_STRICT 차단모드(exit 2)를 Stop·CI에 편입 — '보장·매입추천·흙토람' 위험어 신규 유입의 자동 차단망(부정/면책 제외어 보강). 라이브: 현재 코드 위반 0",
      "검증: tsc·vitest 519(+12: coreCropGate +5·perplexity +3·use축출 +2·saveNow +2) · arch 0 · guardrail STRICT 0. 설계감사 6영역 중 P0 1·P1 5 종결(잔여 P2는 유료 정식 전 처리)",
    ],
  },
  {
    version: "0.69.0",
    date: "2026-06-12",
    title: "농사로 재배 e-book 링크아웃 — 심층연동 대신 정직한 외부 링크",
    items: [
      "농사로(농진청) 영농기술 e-book 링크 추가 — 재배 가이드 패널 하단에 '📚 농사로 재배 e-book(농진청 ↗)' 외부 링크(작물별 영농기술 전자책). cropEbook OpenAPI를 라이브로 끝까지 호출(mainCategoryList→middleCategoryList(VC)→ebookList·resultCode 00)한 결과 구조화 데이터가 아니라 전자책 파일(PDF류)을 반환함을 확인 → 작물명 매칭 모호·http 혼합콘텐츠 회피 위해 심층 파싱 대신 공개 포털 링크아웃이 정직·저비용(추측 금지 준수). 링크 URL은 도달성 검증(200)",
    ],
  },
  {
    version: "0.68.0",
    date: "2026-06-12",
    title: "외래작물 AI 재배요약(Perplexity Sonar) live — 외래 한정·정량 금지·출처 동반",
    items: [
      "외래·특수 작물(/api/foreign)에 'AI 재배 요약' 보강 — Perplexity Sonar(검색 그라운딩 LLM)로 관수·일조·내한성·토양 핵심을 한국 맥락 3~4문장으로 요약 + citations(출처 URL). foreignCrop(GBIF·위키)과 병렬 호출, 키 없으면 null(무중단). 라이브 실증: 망고→시설재배·생육적온 24~27℃·물빠짐 토양 요약 + 한국어 출처 5종(RDA 웹진·한경 등)",
      "⚠ 가드레일(LENSMARK 1원칙=LLM 도메인사실 날조 금지) 강제: ① 외래작물 한정 — 코어 한국작물(실 RDA/KAMIS 소득엔진)엔 절대 미적용 ② 정량수치(수확량·소득·단가) 프롬프트로 차단 — 정성 텍스트만(온도 등 농학 맥락은 허용) ③ citations 항상 노출(그라운딩≠사실, 사용자 검증) ④ 하드라벨 '🤖 AI 요약·출처 확인 필요·보장 아님·영문/타지역 자료 기반' + 24h 캐시(비용·일관성)·FIFO 상한 500",
      "검증: 회귀 +6(perplexity.spec — 파서 정리·https citations만·정량금지 프롬프트·캐시 1회·non-ok null·빈content null) · tsc·vitest 507·arch 0(perplexity→cultivation-guide 등록). ⚠ 운영 배포 시 PERPLEXITY_API_KEY는 Secret Manager 주입 필요(없으면 AI 요약만 생략·나머지 정상)",
    ],
  },
  {
    version: "0.67.0",
    date: "2026-06-12",
    title: "실DEM(Open-Meteo 무키) + NCPMS 병해충 live — mock 2종 제거",
    items: [
      "표고·경사 mock→실데이터 — fetchDem을 Open-Meteo Elevation(무료·무키·Copernicus DEM ~90m)으로 구현. bbox에 ~100m 격자(3~6점)를 깔아 1회 batch 조회 → 기존 terrainFromDem(Horn)이 경사/향/표고 산출. auto provider가 키 없이 항상 live 시도(실패·형태불일치만 mock 폴백). 라이브 실증: 평창 산간 28.4°(669m) vs 김제평야 5.4°(23m)·태백 305m. ⚠ Open-Meteo 무료=비상업 → 유료 전환 시 Google Elevation으로 seam 교체(반환형 동일)",
      "병해충 mock→실데이터 — NCPMS SVC01(작물명 검색·JSON) 파서(parseNcpmsPestList: sickNameKor 추출·중복제거·상한·형태가드) + fetchNcpmsPests(작물 한글명 매칭). /api/alerts가 KMA 기상특보와 병렬로 합류 → 앱 병충해 패널에 '🐛 주요 병해충(농진청 NCPMS)' 이름 칩. 라이브 실증: 사과 5종(갈색무늬병·검은별무늬병·겹무늬썩음병…). 작물명 미매칭은 [] 무중단, 이미지(http)는 mixed-content 회피로 제외",
      "검증: 회귀 +4(fetchDem 격자/폴백 가드 +2 · NCPMS 파서 추출·중복·상한·형태 +2) · health vworldDem=live(Open-Meteo) · tsc·vitest 501·arch 0(ncpms→agri-alerts 등록). ⚠ 운영 배포 시 NCPMS_API_KEY는 Secret Manager 주입 필요(DEM은 무키라 불필요)",
    ],
  },
  {
    version: "0.66.1",
    date: "2026-06-12",
    title: "health rdaIncome 정직 표시 — 실 RDA 적재를 빌드 메타와 동기",
    items: [
      "integrationReadiness().rdaIncome이 v0.59 실 RDA 적재 후에도 하드코딩 '데모(live:false)'로 남아 있던 낡은 표시 교정(반대방향 정직성 오류 — 실데이터인데 데모로 보임). RDA_REAL_META 기반 동적 표시: '실 농산물소득조사 2024 · 10작물 · 지역행 66(미수록 작물은 데모 폴백)'. 콘솔 통합 도넛·health 소비처 즉시 정상화",
      "운영 점검 실증(2026-06-12) — 서버: deploy.sh verify 통과(버전 일치·firestore·시뮬 200)·/ops 200·5xx 0·클라이언트 에러 0. 피쉬본: 라이브 quality(B·estimated·7소스)로 헤드리스 렌더 6/6(머리 등급·신뢰 라벨·폰 1열 fbgrid·뼈 7점·행동 권고 3건 표시·'운영 녹색≠데이터 정확' 고지)",
    ],
  },
  {
    version: "0.66.0",
    date: "2026-06-12",
    title: "at-rest 보안 보강 — firestore PII 암호화(G1) + 세션 토큰 해시(G2)",
    items: [
      "G1: firestore 문서 at-rest 암호화 — 보안 점검에서 발견된 갭(AES-256-GCM이 file 모드에만 구현 → 운영 firestore의 전화번호·일지 좌표/매출이 앱레벨 평문) 보강. 공용 모듈 db/atRest.ts(ENC1: 포맷·LANSMARK_DATA_KEY 동일 키)를 추출해 jsonFile과 FsDoc(save/saveNow/load)이 공유 — 운영에 이미 주입된 DATA_KEY가 즉시 활성. legacy 평문 문서는 로드 허용 + 다음 저장부터 암호화(업그레이드-온-라이트), 복호 불가(키 없음/불일치)=sealed(원본 덮어쓰기 금지 — jsonFile 철학 동일). 크기 한도는 실제 저장 페이로드(암호문) 기준",
      "G2: 세션 토큰 at-rest 해시(SHA-256) — 저장소가 읽혀도(콘솔·백업·유출) 원토큰 미노출=세션 탈취 불가. 쿠키엔 원토큰·저장/조회 키와 레코드 token 필드는 해시(인터페이스 무변경 — 호출부 0 수정). 192bit 무작위 토큰이라 평문 SHA-256로 충분. ⚠ 기존 세션은 1회 무효화(재로그인) — 베타 수용",
      "운영 경보 가동 — setupMonitoring.sh 실행 완료(divelab.kr@gmail.com): 업타임 체크(1분) + 'LENSMARK 다운(3분)'·'5xx 급증(10건/5분)' 경보 정책 생성(P0 #3 해소). gcloud 필터 문법 교정(값 인용)",
      "검증: 회귀 +5(atRestSecurity — FsDoc 암호문에 평문 PII 0·왕복 복호·legacy 이행·키없음 sealed 덮어쓰기 0·세션 파일에 원토큰 0/원토큰 조회 정상) · tsc·vitest 497·arch 0(persistence 피처에 atRest 등록)",
    ],
  },
  {
    version: "0.65.0",
    date: "2026-06-12",
    title: "배포가능 수준 — 배포 IaC·부하 실측·경보 설정·P0 오픈 체크리스트",
    items: [
      "배포 IaC(scripts/deploy.sh = npm run deploy) — 2026-06-12 bare 배포가 설정 누락(bootSafety 차단)으로 실패한 재발 방지: env 8종·시크릿 7종(+선택 웹훅 자동감지)·플래그(--no-cpu-throttling 등)를 코드로 박제(SSOT). 배포 후 자동 검증(라이브 버전=package.json·store=firestore·시뮬 스모크 200) + rollback 서브커맨드(직전 정상 리비전 즉시 복귀) + verify(점검만). DEPLOY.md는 설명·1회 인프라용으로 강등",
      "부하 테스트 하니스(scripts/loadTest.ts = npm run load) — 무의존(fetch·k6/autocannon 불필요)·closed-loop 동시 워커·p50/95/99·코드 분포·5xx면 exit 1. 안전핀: 라이브(run.app·lensmark.kr) 대상이면 거부(쿼터·계측 오염 방지)·mock 권장 경고. 실측(mock·동시50): 엔진 /api/simulate ~17,800 RPS(p50 1–3ms·5xx 0)·/app HTML ~423 RPS(요청당 gzip 병목) — 베타 50명 대비 수천 배 여유, 실제 한계는 설계상 레이트리밋(IP 240/분)",
      "Cloud Monitoring 경보(scripts/setupMonitoring.sh · 1회) — 업타임 체크(/api/health 1분) + '다운 3분'·'5xx 10건/5분' 이메일 경보 + 알림 채널 생성(멱등·무료 한도 내). '서버가 죽어도 모름' 갭 해소",
      "P0 오픈 체크리스트(RUN_GOLIVE.md §6) — lensmark.kr DNS 연결 단계(현황: 미연결 — 접속 불가 원인)·경보 웹훅 시크릿 주입 절차(deploy.sh가 자동 포함)·모니터링 1줄·배포/롤백 규율·부하 실측·남은 HUMAN GATE. tsc·vitest 492·arch 0",
    ],
  },
  {
    version: "0.64.0",
    date: "2026-06-12",
    title: "클라이언트 에러 텔레메트리 + 실시간 경보 — 사용자 화면 에러를 사장님께",
    items: [
      "사용자 브라우저의 uncaught JS 에러·promise 거부를 POST /api/client-error로 수집(이전엔 0 — 사용자 화면 에러가 사장님께 전혀 안 보였음). 프론트 리포터(window.onerror/unhandledrejection): 세션 상한 8·디듀프·keepalive(이탈 중 전송)·경로만(쿼리 PII 제외)·자기 실패 무시",
      "실시간 경보 — '새 distinct 에러'만 활동로그 + 웹훅(LANSMARK_ALERT_WEBHOOK · Slack/Discord {text,content} 둘 다 호환) 즉시 푸시. 같은 에러 반복은 카운트만(스팸 0). 웹훅 미설정이면 조용히 기록만(채널은 사장님 설정=URL 붙이면 즉시 작동)",
      "가시화 — ClientErrorStore(디듀프·집계·최근 링버퍼·PII 0·distinct 상한 100 FIFO) · /api/ops/stats.clientErrors → OPS '서버' 탭 '🐞 클라이언트 에러'(×n·메시지·KST) + watch 종합판정(opsWatch distinct≥1 warn·≥5 crit '프론트 회귀 의심')",
      "보안·바운드 — sensitive 레이트리밋(공개 엔드포인트 플러드 차단)·바디 상한·204 반사 0·메시지/소스 절단. featureMap 등록(client-error-telemetry). 회귀 +5(디듀프·절단·FIFO·204·빈보고 무시) · tsc·vitest 492·arch 0",
    ],
  },
  {
    version: "0.63.0",
    date: "2026-06-12",
    title: "디테일 5종 — 이어보기·실측 변화 체감·오프라인·운영 추세/예측·권고 SSOT",
    items: [
      "이어보기(최대 갭 해소) — 새로고침·뒤로가기에 분석이 통째 소실되던 것을, 시뮬 완료 시 localStorage 자동저장 + 시작화면 '↩ 지난 분석 이어보기 · 상주시 사과' 칩 1개로(자동 강제복원은 안 함 — 빈 지도 시작도 유효). opts 포함이라 같은 숫자 재현 · ✕로 지우기",
      "실측 '변화 한 줄' — 수확 실측 기록 후 보정 전후 P50을 비교해 '✓ 실측 반영 — 보통값 +3% 조정' 토스트(플라이휠 가치를 즉시 체감시키는 최저비용 장치). 만원 병기(소득·매출 '약 N만원')·수확 D-day 배지('다음 수확까지 약 N개월'·기존 데이터만)",
      "오프라인 배너 — navigator.onLine + online/offline로 상단 띠 '오프라인 — 연결되면 자동 복구'(시골 모바일 회선 직결). 연결되면 자동 소멸",
      "운영 30초 판단 강화 — 오늘 KPI 전일 델타('오늘 유입 12 +5'·days에 어제 값 이미 있음) + 저장소 도달 예측('이 속도면 약 N개월 후 도달'·활성일당 증가율 근사, 추가 계측 0)",
      "권고 SSOT — qualityGate.sources에 action 필드 추가 → OPS 피쉬본(빨강/노랑 옆 '무엇을 할지')·Tier1 감시자(opsWatch)·아침 요약이 같은 문장 소비(이중관리 제거). ops:watch --line(메일 제목·슬랙용 한 줄). 회귀 +1(action SSOT 소비) · tsc·vitest 487·arch 0",
    ],
  },
  {
    version: "0.62.0",
    date: "2026-06-12",
    title: "UX 디테일 일제 정비 — 농부 친화 문구·무음 실패 금지·운영 30초 판단",
    items: [
      "고객앱(2-에이전트 감사 → P1 4건 포함 24건) — ① 실측 기록 무음 성공/실패 금지(토스트+버튼 복구·플라이휠 핵심 입력 보호) ② 유료 권한 만료 시 사유 명시 후 페이월(말없는 회귀 금지) ③ 원시 에러('… 500'·영문) 노출 금지: 15초 타임아웃 + 친화 문구 + '다시 시도' 버튼(핀·선택 모두) ④ LIVE 데모 피드에 항목별 '예시·연동 예정' 명시(가짜 시세로 작물 선택 오도 차단) ⑤ 데모 실측 5건 버튼 localhost 한정(실 보정 오염 차단) ⑥ 페이월 '무제한'→'재계산 50회'(서버 quota와 일치·과장 금지) ⑦ 공유 링크에 opts 포함(받는 사람 동일 숫자)",
      "농부 친화 — 면적 ㎡↔평 병기(카드+입력 실시간), 향 'S'→'남향(S)', NDVI↓→'생육 낮음', 예산 회수·ROI를 '나쁠 때/보통/좋을 때'로(비교표 헤더 동일), 내부 용어 제거(업셀·플라이휠·해자·mock provider·validated → 사용자 어휘). 서버 검증 문구 한국어화(validate.ts — 'land object is required' 등 영문 400 응답 종결, 복구 힌트 포함)",
      "운영콘솔(P1 4건 포함 16건) — ① 10초 자동갱신이 revoke 입력·durable 경고를 파괴하던 것 종결(1회 렌더) ② 로그인 4중 결함(galaxy 폼 리셋·Enter 무반응·실패 무피드백·로그아웃 부재) 수정 ③ 서버 다운 시 전역 배너+갱신시각 적색(스테일=정상 거짓신호 차단) ④ revoke 오타 무음 차단 — hasUsage로 known:false면 '이력 없는 jti' 황색 경고(stores.hasUsage+ops known) ⑤ 종합판정 띠 — stats.watch(evaluateOps SSOT·감시자와 같은 문장) ⑥ 시각 KST 통일·'오늘(09시 기준)' 정직 표기 ⑦ 색 일관(0% 전환 상시녹색 제거·5xx 1~9 주의/10+ 시급=감시자 임계·도넛 amber) ⑧ 피쉬본 폰 1열 ⑨ 숫자 콤마·운영자 어휘(저장 방식·포트·트리거 결과 중심)",
      "모바일·접근성 최소 — 입력 16px(iOS 강제 줌 방지)·전화/인증/토큰 입력 Enter 제출·ESC 모달 닫기·빈 추천 안내 문구·동반 패널 5종 빈 탭 금지(사유+다시 시도). 검증: 인라인 스크립트 구문(앱 133KB·콘솔) node --check + 라이브 실증(watch 띠·known:false·한국어 400) · 회귀 +2(watch 노출·revoke known) · tsc·vitest 486·arch 0",
    ],
  },
  {
    version: "0.61.0",
    date: "2026-06-12",
    title: "지역(도)별 실 RDA 소득 + 외래식물 seam 정직 교정",
    items: [
      "지역별 농산물소득조사 2024(도별 상세표) → 10작물 66개 도 실값 적재(rda:build 2번째 CSV). getRdaBase(cropId, region)이 해당 도 실자료로 절대수준 오버라이드(없는 도·미지원 형식은 전국 폴백). 프론트 전체 시도명(전라남도 등)→2자 코드 정규화. 예: 블루베리 전남 수량 630·경영비 860만(전국 491·518만과 다름) → 소득 전남 2,533만 vs 전국 2,131만",
      "스키마: RdaRegionalTable + parseRdaRegionalCsv(검증·폭 유도·인용/컬럼 시프트 가드) · buildRdaReal이 <전국>.regional.csv 자동탐지해 RDA_REAL_REGION 생성 · getRdaBase에 normalizeRegion(17시도) 배선. 연차/판로 상대구조 보강은 지역값에도 동일. 데이터 검증: 체크섬(총수입−경영비=소득) 100%·전국값이 지역 min~max 내(9/10, barley만 단일도)",
      "외래식물(Perenual) seam 정직 교정 — 라이브 실측(2026-06-12): 무료 티어는 species-list(분류)만, 재배상세(관수·일조·내한성)는 유료 전용(429 'Upgrade'). care-guide는 v1 경로(v2엔 없음). parsePlantDetail는 ShapeUnverifiedError 유지(추측 금지)·재배상세=새 HUMAN GATE(유료 Perenual)로 문서화·URL 교정. GBIF가 이미 분류를 더 정확히 줘 무료 티어는 제품가치 낮음",
      "검증: 회귀 +2(지역 오버라이드·시도명 정규화·미수록 폴백) · tsc·vitest 484·arch 0",
    ],
  },
  {
    version: "0.60.0",
    date: "2026-06-11",
    title: "실 RDA 단가 우선 — mock 시세가 실데이터 단가를 덮어쓰던 소득 음수 오류 수정",
    items: [
      "라이브 배포 검증에서 발견 — 미검증 작물(블루베리 등 apple 외 9종)은 KAMIS가 null→mock 단가(블루베리 8,200원/kg)로 폴백하는데, 이 mock이 실 RDA 농가수취가(23,706원/kg)를 덮어써 매출이 1/3로 깎이고 소득이 음수로 표시됐다(블루베리 전남 P50 −381만). enrich(runParcelSimulationWithProviders)가 provider 단가를 무조건 주입하던 것을, source가 'mock-…'이 아닌 실 시세만 주입하도록 수정 → 실 refPrice 사용(블루베리 P50 +2,131만 복원)",
      "우선순위 명확화 — 실 KAMIS 시세(source 'KAMIS …', apple) > 실 RDA refPrice(verified base) > mock. '실데이터가 mock을 이긴다'. apple은 실 KAMIS 그대로, 나머지 9 실RDA 작물은 실 refPrice 사용. v0.59가 비용을·v0.60이 단가를 바로잡아 실 소득 현실화(블루베리 데모 −5,694만 → 실 +599~+2,131~+3,663만)",
      "검증: 회귀 +2(블루베리 mock 단가 미주입→실 refPrice·소득 양수 / 명시 실단가 정상 주입) · tsc·vitest 482·arch 0. 라이브 재배포로 9작물 단가 교정 반영",
    ],
  },
  {
    version: "0.59.0",
    date: "2026-06-11",
    title: "실 RDA 소득자료 적재(2024) — 10작물 데모→검증 + 연차/판로 구조 보존",
    items: [
      "농진청 농산물소득조사 2024 전국 총괄표(자료집 p17-19) → 10작물 실 base 적재(rda:build): 사과·블루베리·포도·고구마·감자·딸기·배추(가을)·참깨·들깨·보리. getRdaBase가 RDA_REAL 우선(verified·baseYear 2024·출처). 데모 비용 과대(현실 3~5배) 종결 — 블루베리 1,000평 '나쁠 때 −5,694만'(데모) → +509만~+2,046만~+3,582만(실데이터). v0.58 하한캡은 실 비용이 현실적이라 여전히 휴면",
      "실데이터 path 판로·연차 미분화 회귀 수정 — baseFromReal이 작물 단위 전국 평균(≈성숙기·혼합판로)만 줘 다년생 과일의 '정착연차 손실'·판로 단가차가 사라지던 것을, 절대수준=실 RDA + '연차 ramp·판로 프리미엄' 상대구조만 룰북에서 보강(성숙기=1·혼합=1 기준 비율)으로 보존. 출처에 '연차/판로 구조 룰북 보강' 정직 표기",
      "정직 매핑 — barley←쌀보리·potato←봄감자·napa_cabbage←노지가을배추(김장)·strawberry←시설딸기(토경). chili_pepper 제외(소득조사는 시설고추뿐 — 경영비 976만/10a로 노지 건고추를 4-6배 과대표현). 미수록 데모 유지: rice(미곡 별도)·마늘·양파·콩(생산비조사)·도라지·옥수수('개' 단위). 단가=총수입÷수량 참고(엔진은 KAMIS 라이브로 override)",
      "검증: rdaReal 회귀 갱신(적재=verified·미수록 rice 데모 폴백)·기존 계약/스냅샷 무변경(engineInputs 판로>도매·정착연차 보존) · tsc·vitest 480·arch 0. NCPMS·Perenual 키 라이브 검증 완료(파서 승격 후속)·농사로 승인 대기(resultCode=12)",
    ],
  },
  {
    version: "0.58.0",
    date: "2026-06-11",
    title: "소득 P10 현실 손실 하한 가드레일(휴면·미래 활성) — floorIncomeLoss",
    items: [
      "소득(매출−비용) P10에 '현실 손실 하한' 추가(uncertainty.floorIncomeLoss, parcelSimulator 최종단계) — 한 해 최대 손실 = 매출 0(매출은 0으로 클램프) − 최악 경영비(cost.p90). 그보다 더 음수인 '물리적 불가능 손실'(고σ 작물 P10이 정규근사로 -∞ 팽창)만 차단. p10만 올림(p50/p90 구조적 보존)·단조성 유지·범위 인위적 축소 아님",
      "⚠ 정직 고지(중요) — 현재 '데모 base'는 비용이 비현실적으로 커서 전 작물 휴면: 17작물×3시나리오 51건 중 binding 0. 즉 이 하한은 마케팅 실증에서 본 알람(블루베리 1,000평 '나쁠 때 −5,694만')을 '지금' 고치지 않는다. 그 magnitude의 원인은 데모 비용(median 6,237만·p90 1.1억 = 현실의 3~5배)이라 실 RDA(현실 비용) 적재로 해결됨. 이 하한은 실데이터 적재 시 자동 활성화되는 '재작업 0'의 미래 가드레일",
      "검증: 회귀 +4(floorIncomeLoss binding/비활성/단조성 + 5작물 계약 income.p10≥−cost.p90). 휴면이라 기존 스냅샷·계약 숫자 0 변경(479=475+4). 진단 실증: 51건 재현으로 '제안된 단순 floor는 현재 no-op이며 원인은 데모 데이터'임을 확인 후 가드레일로만 채택. tsc·vitest 479·arch 0",
    ],
  },
  {
    version: "0.57.0",
    date: "2026-06-11",
    title: "Tier 1 ops watcher(읽기·진단) — 품질·트리거를 평문 진단·권고로",
    items: [
      "읽기 전용 감시자(ops/opsWatch.ts) — /api/ops/stats(신뢰 피쉬본·최적화 트리거·스토어 저하·5xx)를 crit/warn/ok로 롤업 + 항목별 평문 진단·권고. ⚠ 행동권 0(재시작·토글·삭제 X) — Tier 1=조언만(레드팀 합의: AI는 조언, 행동은 결정적·사람). fail-closed로 알림(모르면 묻어두지 않음)",
      "채널 무관 — 순수 평가기(evaluateOps) + 텍스트 리포트(formatReport) + CLI(scripts/opsWatch.ts · npm run ops:watch · exit 0=ok/1=findings/2=접근오류). cron·GitHub Action·Claude Code 루틴이 stdout/exit code를 얇게 래핑(슬랙·이메일·푸시). 임계는 콘솔 트리거와 단일 출처",
      "실증 — 로컬 서버 대상 ops:watch가 실제 상태를 정확 진단: 소득 base 데모→crit(미검증·rda:build 권고)·DEM 구조적 warn·보정 표본 warn·payload 55KB warn. live 소스(VWorld/KMA/KAMIS)는 경고 없음(정직)",
      "검증: 회귀 +6(opsWatch: ok·스토어crit·미검증crit·warn롤업·임계crit·formatReport) · tsc·vitest 475·arch 0(featureMap ops-watcher 등록). Tier 2(좁은 가역 자동행동·킬스위치)는 신뢰 검증 후 별 슬라이스",
    ],
  },
  {
    version: "0.56.0",
    date: "2026-06-11",
    title: "데이터 품질 게이트 v1 — 신뢰 피쉬본 + 제품 자동 보수(✓검증 차단)",
    items: [
      "'운영 녹색 ≠ 데이터 정확' — 넘기는 데이터가 검증/정직한지 차원별 게이트로 평가하는 품질층(quality/qualityGate.ts·순수·fail-closed). 기존 신호 집계(integrationReadiness·RDA_REAL_META·flywheel): 소득 base(데모=fail)·시세·기후·지도·DEM·보정·가드레일 → ok/warn/fail + dataTrust(unverified/estimated/verified) + 등급 A~D. 핵심: '에러 없음'이 아니라 '양성 신호'로 채점(조용한 mock/데모=녹색 아님)·모르면 warn",
      "OPS 신뢰 피쉬본(종합 최상단) — 머리(등급·verdict) + 카테고리 뼈(원인별 ok/warn/fail 색)로 '어디가 문제인지' 한눈에. '운영 녹색 ≠ 데이터 정확' 명시. /api/ops/stats.quality 노출(admin 게이트)",
      "제품 자동 보수 — base가 데모/미검증이면 앱 결과 카드·비교표의 '✓검증' 배지를 차단하고 '추정' 강제(보정이 validated여도). 품질 게이트가 정직성 가드레일을 운영화. 현재 RDA=데모(RDA_REAL_META=null)라 즉시 효력 — '검증' 오인 차단",
      "검증: 회귀 +7(qualityGate 5 — fail-closed·verified·estimated·mock=녹색아님·구조형 / 앱 자동보수 게이트 2) + 헤드리스 피쉬본 렌더 6/6 · tsc·vitest 469·arch 0(featureMap data-quality-gate 등록). v1=린(탐지형 통합 live vs 구조형 RDA/DEM 구분) · 후속: 값-범위 sanity·신선도/스키마 게이트, Tier 1 ops watcher가 이 quality 소비",
    ],
  },
  {
    version: "0.55.0",
    date: "2026-06-11",
    title: "OPS 최적화 트리거 — 페이로드·저장소 헤드룸을 데이터로 ('언제' 판정)",
    items: [
      "최적화를 '느낌'이 아니라 '측정'으로 — OPS 종합에 '⚡ 최적화 트리거' 패널: ① 앱 첫로드 페이로드(gzip/raw KB) ② 저장소 헤드룸(실측 n/20k·수요키 n/10k) ③ 참여(이탈)는 동향 퍼널로 연결. 각 항목을 임계로 '여유/검토/시급' 색 판정 → 선 넘을 때만 손대도록",
      "백엔드(/api/ops/stats) — optimization{payload, headroom}. payload는 앱 HTML gzip(over-the-wire 비용)·mtime 캐시(파일 변경 시에만 재계산 → 운영 1회). headroom 분모는 blob 1MiB·차원폭증 한계(feedback 20k·demandKeys 10k) = per-record/DB 승격 신호",
      "정직성 — 없는 '페이지뷰 이탈'은 만들지 않음. 측정 가능한 '지렛대(페이로드)'와 '스케일 벽(저장소)'만 노출하고, 참여 트리거는 기존 퍼널 드롭오프로 연결. '검토/시급일 때만 최적화 — 그 전엔 학습 우선' 문구 명시",
      "검증: 회귀 +1(opsRoutes — stats 트리거 노출·gzip<raw·캡) + 헤드리스 스모크(임계 판정 6/6: gzip 58→검토·실측 71%→검토·수요키 88%→시급) · tsc·vitest 462·arch 0. qwen 생략(소규모·admin 읽기·자체검토+node)",
    ],
  },
  {
    version: "0.54.0",
    date: "2026-06-11",
    title: "Red-team 잔여 처리 — 처리방침 익명계측 고지 + OPS XSS 가드 + 스팸 한계 명시",
    items: [
      "(#1 프라이버시) 개인정보처리방침에 '익명 접속 집계(신규/재방문)' 수집항목 명시 — 브라우저 익명ID는 비식별 해시로 중복제거에만 사용·집계 수치만 보존·개별 여정 미저장. ⚠ 법무 검토는 HUMAN GATE",
      "(#2 OPS XSS 회귀가드) opsSecurity.spec 신설 — 운영 콘솔도 app html처럼 esc 배선(감사로그·데이터갭·수요 등 서버유래 싱크)·CSP-safe(inline onclick 0·addEventListener만)·관리자 게이트를 회귀로 고정. 5섹션 재편(v0.53) 후 미escape 싱크 유입 차단",
      "(#3 스팸 한계 명시) 익명 신규/재방문은 조작된 anon-id 스팸으로 부풀리기 가능 → /api/* 글로벌 레이트리밋(IP당)으로 바운드 + 콘솔 '참고용' 라벨. '검증된 사실' 아님(마케팅 수치 금지). eventStore 주석 + SECURITY.md §5 기록",
      "(#4 실브라우저 렌더) 프리뷰 브라우저가 이 환경 루프백 격리로 불가 → 헤드리스 실행 스모크(DOM 스텁으로 ops load()를 실 stats 형상 데이터에 실행)로 런타임 무오류·5섹션 패널 렌더·활동로그 esc 페이로드 무력화 실증(10/10). 실픽셀·CSP는 사용자 /ops 확인 몫",
      "검증: tsc·vitest 461(+3 opsSecurity)·arch 0. 적대 점검은 솔로 red-team(주입·PII·스팸·동시성) — 결제·인증·해자 변경 아니라 멀티에이전트 풀 red-team은 결제 라이브/실 RDA 시로 보류",
    ],
  },
  {
    version: "0.53.0",
    date: "2026-06-11",
    title: "OPS 콘솔 5섹션 재편(종합·회원·동향·매출·서버) + 고객 흐름 시각화",
    items: [
      "운영 콘솔을 5섹션 탭으로 — 종합(핵심 KPI·유입추세·상태) / 회원(가입·세션·신규vs재방문·가입추세) / 동향(퍼널 드롭오프·유입·전환 추세·수요·플라이휠) / 매출(결제·게이트·실효·매출추정) / 서버(통합·건전성·활동로그). 기존 패널·동작(게이트 토글·revoke·게이지·10초 갱신)은 무변경 — 컨테이너만 섹션으로 재배치(id 보존)",
      "신규 시각화(무의존 SVG·외부 라이브러리 0) — ① 퍼널 드롭오프: 단계→단계 전환%·이탈%, 절대 인원 감소 최대 구간을 '최대 누수'로 적색 강조 ② 스파크라인: 일별 유입/전환/가입 추세(14일) ③ 신규 vs 재방문 split. v0.52 데이터(analytics.days·signups·members)에 결선",
      "정직성·보안 유지 — CSP-safe(addEventListener)·모든 동적 텍스트 esc(XSS)·시크릿 0·PII 0(신규/재방문은 익명 기기 집계·여정 미저장 표기). '오늘 유입'은 최근일 기준",
      "검증 — 브라우저 프리뷰는 이 환경의 루프백 격리로 픽셀 확인 불가(서버 200·정상 서빙) → node 결정적 검증: 인라인 스크립트 17.8KB 구문 무손상 + 새 viz 함수 실제 렌더(드롭오프 6행·최대이탈 적색·전환%·스파크라인·split) 실측. tsc·vitest 458·arch 0. qwen은 순수 프론트라 생략(자체 적대검토+node 검증). 사용자 확인: http://127.0.0.1:8801/ops",
    ],
  },
  {
    version: "0.52.0",
    date: "2026-06-11",
    title: "OPS 고객 흐름 데이터(백엔드) — 일별 시계열 + 신규/재방문 + 가입(방법별)",
    items: [
      "일별 시계열(롤링 30일) — 퍼널 6단계·신규/재방문·가입을 날짜별 버킷으로 집계(snapshot.days). '유입/전환/가입 추세'(어제 짚은 시계열 0 갭)의 토대. 전부 수(count)만·바운드(메모리/blob<1MiB 안전)",
      "신규 vs 재방문(체류) — 익명 기기ID(x-lansmark-anon)를 FNV 해시 토큰으로 '중복제거 집합'(seenAnon)에만 보관 → 일별 신규/재방문 '수'만 집계, 개별 여정·시퀀스는 미저장(PII 0 유지·사용자 승인 방식). 유입(recommend)에서 당일 1회 판정(중복 클릭/헤더없음/위조 제외). 상한 20k·FIFO·재배포 영속(firestore)",
      "가입 추적(방법별) — 계정 신규 생성 시 analytics.signup(method)로 email/phone 구분 누적 + 일별. /api/ops/stats에 members(가입 총원·활성 세션) + analytics(days·signups) 노출. 이메일 로그인 가입이 OPS에 집계로 반영(로그인 기능은 v0.43 기존)",
      "정직성/바운드 유지 — 집계만·롤링·상한, 디바운스 영속(v0.48) 그대로. anonId는 유효 포맷만 인정(즉석 생성·위조 제외 → '신규' 오염 방지). 함수 호환(funnel anonId 선택적)",
      "검증: 회귀 +4(일별 버킷·신규/재방문·가입 화이트리스트·File/firestore 영속+재배포 재방문) · tsc·vitest 458(+4)·arch 0 · qwen 1차(치명 0). 다음(Slice 2): OPS 5섹션(회원·동향·매출·서버·종합) 재편 + 퍼널 드롭오프·시계열·신규vs재방문 시각화",
    ],
  },
  {
    version: "0.51.0",
    date: "2026-06-11",
    title: "결과 카드 시각화 — 소득 확률 밴드 + 6축 근거 토네이도(정직성 유지)",
    items: [
      "예상 소득 P10–P50–P90을 '확률 밴드'로 — 평평한 밴드 한 줄 → P50에서 가장 진한 농도 그라디언트 + P10·P50·P90 분위 눈금. 범위뿐 아니라 '가운데(보통)일수록 흔함'을 분위 그대로 표현(엔진은 3분위만 주므로 가짜 정규곡선은 그리지 않음 — 일기예보·핀테크식 표준 패턴). 단일 결과 카드 + 다중 비교뷰 공용 bar() 동시 개선",
      "6축 근거를 '토네이도(발산 막대)'로 — ±% 텍스트 행 → 중앙 0 기준 좌우 막대(기여 크기순 정렬). 정직성 핵심: 막대 방향·색을 '소득 방향'으로 매핑(수율↑ 또는 비용↓ = 소득↑ 초록·오른쪽 / 소득↓ 주황·왼쪽) — 기존 텍스트는 비용 증가도 초록(+)으로 보이던 모호함을 교정. 라벨은 요인 자체 ±%(엔진 value 그대로·날조 X), axis·reason은 esc()(XSS). 범용 .frow는 불변(신규 .trow/.tbar/.tfill)",
      "검증(브라우저 프리뷰는 이 환경에서 루프백 격리로 픽셀 확인 불가 — 사용자 127.0.0.1로 확인) — 대신 node로 결정적 검증: 인라인 스크립트 130KB 구문 무손상 + HTML에서 추출한 실제 bar()/factorList()를 호출해 그라디언트 P50 피크·토네이도 방향/색·정직성 매핑(비용+10%→소득↓) 실측. 회귀가드 +2(appSecurity: 밴드·토네이도 배선 + cost→소득↓ 매핑 문자열 고정)",
      "tsc·vitest 454(+2)·arch 0 · qwen 1차(치명 0)",
    ],
  },
  {
    version: "0.50.0",
    date: "2026-06-10",
    title: "마트 소매가(소비자 물가) 주간 min~평균~max — KAMIS 소매(01)",
    items: [
      "도매가(농가 수취)와 별개로 '마트 소비자가' 추가 — KAMIS periodProductList 소매(p_productclscode=01) 최근 7일 → 1kg당 min~평균~max(원/kg). GET /api/retail-price?cropId (무료·무인증). 도매가와 소비자가를 함께 보여 시세를 입체적으로",
      "provider seam(무의존·mock↔live drop-in) — types RetailWeekly · kamis.fetchRetailWeekly(cls=01) · live/mock/auto(okRetail 폴백). kamisDailyUrl에 도·소매 cls 파라미터(기본 02). 주간 통계는 percentile 아닌 실최저~최고(소비자 체감 직관)",
      "한계 정직: 현재 KAMIS 코드는 apple만 verified → apple은 live 소매가, 미검증 16작물은 mock(도매×1.6 마진·라벨 구분). KAMIS 품목코드 채우면 작물 확장. 소매 rankCode는 라이브 실증으로 확정",
      "프론트(고객앱) — 정밀 시뮬 결과에 '시세 비교' 카드: 농가 도매가(받는 값) vs 마트 소비자가(주간 평균·최저~최고) + 도매 대비 배율. 소매가 출처 라벨(KAMIS 실데이터 / 추정 데모) 정직 구분. 시뮬 후 /api/retail-price 부가 호출(실패해도 시뮬 표시·CSP-safe·esc)",
      "라이브 실증: apple 마트 소매가 27,214원(min 27,140~max 27,358) vs 도매 9,086원 = 약 3배(소비자가≫농가가). 미검증 작물(onion)은 mock-retail 폴백. tsc·vitest 452(+5)·arch 0",
    ],
  },
  {
    version: "0.49.0",
    date: "2026-06-10",
    title: "운영 콘솔 시각화 리디자인 — 라이트 위젯 + SVG 게이지/도넛/바",
    items: [
      "ops 콘솔(dashboard/lansmark_ops.html) 전면 리디자인 — OpsNow360 풍 라이트 테마 위젯 대시보드. 다크→라이트, '통합 준비도·플라이휠/해자·시스템 건전성'을 3열 시각화 위젯으로(반응형: 좁으면 1열). 직관적 한눈 파악",
      "무의존 SVG 시각화(외부 차트 라이브러리 0) — 반원 게이지(실측 포함률·LIVE 연동 가동률), 도넛 링(LIVE 연동 N/총), 가로 막대(작물별 보정·퍼널 6단계·수요 히트맵). 모두 inline SVG로 직접 그림",
      "기능·데이터 계약 전부 보존 — 관리자 로그인·게이트 토글·revoke·degraded(배너+게이지 적색+게이트 차단)·10초 자동갱신. /api/health·/api/ops/stats 무변경. CSP-safe(addEventListener)·모든 동적 텍스트 esc()(XSS)·외부 리소스 0·클라이언트 시크릿 0",
      "검증: 브라우저 스모크(위젯 렌더·3열 반응형·degraded UI 적색 전환·콘솔 에러 0)·arch 0",
    ],
  },
  {
    version: "0.48.0",
    date: "2026-06-10",
    title: "Firestore 익명 계측 재배포 유실 수정 — 디바운스 write-through",
    items: [
      "저트래픽 유실 종결 — 익명 수요·퍼널 계측이 throttle(25건)을 평시 못 채우는 저트래픽 베타에선 firestore 평시 쓰기가 0이라, 유일 영속 통로가 종료 flush(SIGTERM)뿐이었다. SIGTERM 미수신(Cloud Run idle scale-down)/race 1800ms 부족 시 재배포에 통째 유실(lm_state/analytics 미생성 실증). FirestoreAnalyticsStore에 디바운스 write-through 추가: '마지막 flush 후 첫 변경에서 5s 뒤' 또는 '25건' 중 빠른 쪽으로 영속 → 유실 폭을 ≤5s로 한정하고 종료 flush 의존을 제거",
      "진단(인프로세스 경로는 정상) — flushAll→analytics.flush→FsDoc.save→drain→whenDrained 경로가 in-flight save를 끝까지 await함을 테스트로 실증(가설 ③ 레이스 반증). 유실 원인은 '평시 미영속'. 1800ms race는 backstop으로 충분(워밍된 토큰 기준 단일 PATCH<500ms)하고 디바운스가 의존도 자체를 제거 → devServer 종료 경로 무변경(blast radius 최소)",
      "디바운스 타이머는 unref(analytics 단독으로 프로세스 종료를 막지 않음·서버 핸들이 이벤트루프 유지) · 종료(flushAll) 시 대기 타이머 해제 후 즉시 flush(늦은 중복 쓰기 없음) · debounceMs 생성자/팩토리 주입(테스트·튜닝 seam, 기본 5s·0=비활성) · 익명 집계(PII 0)라 저장 데이터 형태 무변경(언제 쓰는지만 변경)",
      "검증: 회귀 +6(디바운스 자동영속=SIGTERM 없이 재배포 생존·버스트 25건 즉시·비활성·종료 backstop·대기 타이머 해제 1회 영속) · tsc·vitest 447·arch 0 · qwen 1차(치명 0)",
      "라이브 운영 의존성(추가 실증) — 디바운스 setTimeout은 Cloud Run 기본(요청당 CPU)에선 idle 중 발화하지 못한다: --no-cpu-throttling 미설정 시 6건 중 3건 유실 실증. 설정(CPU always while alive · scale-to-zero 유지 → idle 과금 ~0) 후 idle 8s에도 6/6 영속 실증. 코드(디바운스)+인프라(CPU always) 조합이 필요 → DEPLOY A-7 명령에 반영",
    ],
  },
  {
    version: "0.47.0",
    date: "2026-06-10",
    title: "운영 콘솔 — 스토어 저하 경고 + 엔티틀먼트 실효(revoke) 컨트롤",
    items: [
      "운영 콘솔(ops)에 엔티틀먼트 실효(revoke) UI — 지금까지 curl로만 가능하던 환불·분쟁·오용 대응을 콘솔에서: jti 입력→확인(파괴적)→POST /api/ops/revoke. durable=false(원격 영속 실패)면 '재배포 시 부활 가능' 경고로 운영자가 재시도 인지(H3 정합)",
      "스토어 저하(sealed) 경고 배너 — firestore 워밍 실패 시 콘솔 상단에 명시(유료 소진·실효 미영속 위험). 결제 섹션에 스토어 정상/저하 pill + 저하면 '유료로 전환(켜기)' 버튼 비활성(서버 409 STORE_DEGRADED와 UI 일치 — 켰다 실패하는 경험 제거, H2 정합)",
      "시스템 패널에 STORE(file/firestore) 노출 + 저하 시 경고 색. 모든 동적 텍스트 esc()(XSS)·외부 리소스 0·클라이언트 시크릿 0·CSP-safe(addEventListener) 유지",
      "검증: tsc·vitest 441·arch 0 · 브라우저 스모크(배너 노출·revoke durable 결과·게이트 차단)",
    ],
  },
  {
    version: "0.46.0",
    date: "2026-06-10",
    title: "재배포 데이터 보존(Firestore 영속) + CI + 3-에이전트 보안감사 수정(High 4·Med·Low)",
    items: [
      "Firestore 영속 어댑터(LANSMARK_STORE=firestore) — Cloud Run '재배포=데이터 소실' 종결: 계정·세션·재배일지·실측(해자)·유료권한 소진/실효·웹훅 멱등·구독·계측·감사로그·런타임 토글이 재배포 후 유지. 무의존성(메타데이터 토큰+REST)·write-through·부팅 워밍(listen 前)",
      "GitHub Actions CI — push/PR마다 tsc·vitest·arch 강제 + RDA 실데이터 파이프라인 사전구축(npm run rda:build — 자료 수령일 CSV 한 장으로 데모→실값 전환·verified 표기)",
      "보안 감사 수정(3-에이전트 화이트박스 → 확정 결함) — H1: firestore 모드 유료게이트 토글 비영속/타입에러(→ flags firestore 백엔드+워밍 후 적용). H2: 워밍실패(sealed)×게이트 ON에서 실효토큰 부활(→ 409 STORE_DEGRADED 거부+stats 노출). H3: revoke 내구확인(원격 반영 후 응답·durable 플래그)+SIGTERM drain 대기. M2: entitlement use/revoked 2문서 분리(revoked 한도 무관). M1: 워밍 allSettled(늦은 warm 덮어쓰기 차단)",
      "추가 수정 — M3: 평문 스토어 손상도 sealed(빈 상태 덮어쓰기 금지). M4: ops 변이는 콘솔공개로 안 열림+JSON content-type 필수(CSRF). M5: RDA CSV 인용/컬럼불일치 거부(오염 차단). M8: 결속 토큰은 본인 로그인 필수(익명 도용 봉쇄). H4: 캡처 샘플 본문 키 마스킹. Low: quota 환불·만료 챌린지 정리·OTP 타이밍세이프·웹훅 mint-후-mark·firestore 컬렉션 검증",
      "한계 정직 고지: 단일 인스턴스 내구성용(blob-per-store·1MiB) — 다중 인스턴스 정합은 per-record 승격 시(§3-1 잔여). tsc·vitest 441(+19)·arch 0 · 잔여 키회전(KAMIS)·git 이력 확인은 HUMAN GATE",
    ],
  },
  {
    version: "0.45.0",
    date: "2026-06-09",
    title: "출시 전 종합 테스트 — 보안 감사 확정결함 수정(P1 결속강제 + P2 4종)",
    items: [
      "P1 — 유료권한 '계정 결속' 미강제 결함 수정: 결속 토큰(boundAccount)이 유료 기능에서 순수 bearer로 동작하던 갭을 막음. server/paidAccess.ts(세션-인지 게이트)로 simulate·feedback·guide·foreign·budget·journal을 일관 적용 — 로그인한 타인의 유출 토큰 도용 시 403(세션 없으면 bearer 유지)",
      "P2 — 원시 JSON 바디(null/숫자/배열)가 500 유발하던 account·ops 라우트를 isObject 정규화로 400 처리(정보누출·errCount 오염 방지)",
      "P2 — 프론트 서버 enum 필드(신뢰도·dataLabel·DEM source) esc() 일관 적용(XSS 방어심도)",
      "P2 — 서비스워커가 opaque/에러 응답을 캐시하던 것을 ok+basic/cors만 캐시(캐시 오염·stale 방지)",
      "P2 — 서버 소켓 타임아웃(requestTimeout 20s·headersTimeout 10s·keepAlive 5s)로 slow-loris류 완화",
      "검증: 3-에이전트 병렬 화이트박스 감사(인증·세션·결제 / 입력검증·DoS·누락 / 프론트·XSS·SW) + 블랙박스(오류·악성·미인증 입력)·부하/레이트리밋·기기 인수 · tsc·vitest 422(+4 결속)·arch 0",
    ],
  },
  {
    version: "0.44.0",
    date: "2026-06-09",
    title: "출시 전 하드닝 — 세션 httpOnly 쿠키(S5) + 핀 분석 병렬화(U2)",
    items: [
      "보안 S5 — 세션을 httpOnly·SameSite=Strict 쿠키로 전환(XSS가 세션 토큰을 읽지 못함). Secure는 운영(HTTPS)만. 듀얼모드(쿠키 우선·x-lansmark-session 헤더 폴백)로 비브라우저 API·테스트 하위호환. CSRF는 SameSite=Strict + CORS 잠금으로 차단",
      "프론트는 토큰을 localStorage에 보관하지 않음 — 로그인 상태는 /api/account/me로 판정(ACCT). 모든 세션 읽기(account·payment·push·journal)는 sessionTokenFrom 헬퍼 경유",
      "성능 U2 — 핀(필지) 분석에서 recommend·terrain·parcel을 병렬 실행(Promise.allSettled, 독립 호출). 지연=합→최댓값. parcel 실패는 분석 지속, 세대 가드(경쟁조건) 유지. SEL 분기도 recommend·terrain 병렬",
      "검증: tsc·vitest 418(+7 cookies)·arch 0 · end-to-end curl(Set-Cookie httpOnly 발급·쿠키 인증·로그아웃 파기) · qwen 1차 + Claude 레드팀(CSRF/세션고정/매직링크 무영향 확인)",
    ],
  },
  {
    version: "0.43.0",
    date: "2026-06-09",
    title: "이메일 매직링크 로그인(M2) — 휴대폰 OTP와 병행",
    items: [
      "로그인 수단 추가 — 계정 모달에 '📱 휴대폰 / ✉️ 이메일' 탭. 이메일 입력 → 1회용 로그인 링크 수신 → 링크 클릭 시 자동 로그인(/app?lm_login 착지 → verify). 휴대폰 OTP는 그대로 병행",
      "CompositeVerifier — challengeId의 'method:' 프리픽스로 검증기 라우팅(휴대폰/이메일). 새 엔드포인트 0(기존 auth/start·auth/verify 재사용)",
      "보안(qwen 1차 + Claude 레드팀): 매직링크 256bit 1회용·타이밍세이프 비교·15분 TTL·시도상한 · 이메일/번호 평문 미저장(subjectHash) · 토큰 URL 즉시 제거(잔류·공유 방지) · 매직링크 토큰 유출 차단 확인(Referrer-Policy strict-origin + 서버 URL 미로깅) · 이메일 열거 불가(항상 링크 발송)",
      "⚠ 이메일 실발송은 제공자 키=HUMAN GATE(LANSMARK_APP_ORIGIN + 이메일 제공자) — 미설정이면 dev는 화면에 링크 표시·운영은 fail-closed. 그 전까지 ConsoleEmailSender(미전송 정직)",
      "tsc·vitest 411(+11: emailMagicLink 9·account 2)·arch 0 · end-to-end curl 검증(start→링크→verify→methods:email)",
    ],
  },
  {
    version: "0.42.0",
    date: "2026-06-09",
    title: "웹푸시 알림 다리(M1) — 무과금 앱 푸시(SMS 대체) opt-in",
    items: [
      "웹푸시 알림 채널 — SMS 과금 회피(사용자 선택)로 무료 브라우저/PWA 푸시 도입. 알림 모달에 '🔔 이 브라우저로 알림 받기(무료·문자 불필요)' opt-in: 권한 요청 → 서비스워커 pushManager.subscribe → /api/push/subscribe 저장. 서비스워커에 push(알림 표시)·notificationclick(앱 포커스/열기) 핸들러 추가",
      "엔드포인트 3종(server/routes/push.ts) — GET /api/push/vapid(공개키+configured), POST subscribe/unsubscribe. 구독 스토어(integrations/push.ts InMemoryPushSubscriptionStore·endpoint dedupe·DoS cap)",
      "보안(qwen 1차 + Claude 레드팀): endpoint는 https URL만 허용(발송기 SSRF 입력 위생, 실 사설IP 차단은 발송 시점 seam TODO)·cropId/키 길이 상한(메모리 그리핑)·subscribe/unsubscribe 민감 레이트리밋 버킷·구독 endpoint/키 로그·응답 비노출(PII)",
      "⚠ 실제 발송(LiveWebPushSender: VAPID JWT ES256 + aes128gcm)·VAPID 키 생성은 HUMAN GATE — 미설정이면 configured:false로 '준비 중' 정직 안내(거짓 '켜짐' 금지). 구독 영속(File store)=follow-up",
      "featureMap web-push 기능 등록 · tsc·vitest 400(+7 push)·arch 0(34기능·51엔드포인트)",
    ],
  },
  {
    version: "0.41.0",
    date: "2026-06-09",
    title: "모바일 헤더 정리 — 보조 액션 '⋯ 더보기' 메뉴",
    items: [
      "모바일(≤600px) 헤더 정리 — 보조 액션(저장·불러오기·PDF·공유·초기화)을 '⋯ 더보기' 드롭다운으로 묶어 헤더 5줄 줄바꿈 클러터 제거. 데스크탑(>600px)은 인라인 유지. 항목선택·외부클릭 시 자동 닫힘",
      "프론트 전용(버튼 ID·리스너 그대로 — 래핑만) · tsc·vitest 393·arch 0",
    ],
  },
  {
    version: "0.40.0",
    date: "2026-06-09",
    title: "첫 방문 웰컴 온보딩 — 빈 지도 이탈 방지 (3단계 + 능동 CTA)",
    items: [
      "첫 방문 웰컴 코치(1회) — '빈 지도만 덩그러니' 이탈 방지: 환영 + 3단계 흐름(① 지도에서 땅 탭 ② 무료 작물 추천 ③ 작물 눌러 예상 소득 P10/50/90) + 능동 CTA(📍 내 위치에서 시작·🧭 귀농 자가진단·지도 둘러보기) + 무료베타·면책 고지",
      "기존엔 첫 방문자에게 기술 릴리스노트 팝업이 떠 농부 사용자 온보딩에 부적합 → 웰컴으로 교체. 재방문 + 신버전은 변경점 팝업 유지(분리)",
      "내 위치 CTA는 기존 검색 geo 버튼 재사용·자가진단은 openAssess 재사용(중복 없음). vmodal 패턴·CSP-safe·esc",
      "에뮬레이터(API35) 검증 — 웰컴 정상 렌더. 프론트 전용 · tsc·vitest 393·arch 0",
    ],
  },
  {
    version: "0.39.0",
    date: "2026-06-09",
    title: "PWA 쉘 — 설치형 모바일 앱 (manifest·서비스워커·아이콘)",
    items: [
      "LENSMARK를 설치형 PWA로 — manifest(standalone·테마 #2e7d32)·서비스워커(앱 쉘 네트워크-우선 캐시·오프라인 폴백·/api 캐시 제외)·아이콘. HTML head에 manifest/theme/apple-touch-icon + SW 등록 스크립트. 모바일 로드맵 키스톤(웹푸시의 토대)",
      "서빙: pages.ts가 /manifest.webmanifest·/sw.js(Service-Worker-Allowed:/)·/icon.svg를 올바른 content-type으로 제공. featureMap에 pwa-shell 기능 등록",
      "검증: 에셋 content-type curl 검증 ✓ · 에뮬레이터(API35·411px)·실기기 앱 로드 ✓. ⚠ SW 등록/설치는 보안컨텍스트(localhost·HTTPS) 필요 — 에뮬 adb reverse 불안정으로 SW-active/오프라인/설치 검증은 실기기 localhost 또는 배포 HTTPS에서",
      "아이콘=placeholder(실디자인 HUMAN GATE) · tsc·vitest 393·arch 0",
    ],
  },
  {
    version: "0.38.0",
    date: "2026-06-09",
    title: "운영 보안 — 감사 로그 영속화 + SECURITY 런북 + 실기기 모바일 검증",
    items: [
      "감사 로그 영속화(#4) — logOps가 보안 이벤트(로그인·실효·결제·게이트 토글·일지 삭제)를 audit.jsonl에 append-only(0600·재시작 보존)로 기록. 기존 메모리 링버퍼(40)는 콘솔 표시용 유지. 사고대응·PIPA 추적 durable화",
      "SECURITY.md 운영 보안 런북 — 배포 직전 HUMAN GATE(TLS·키 6종·CORS·시크릿)·코드 내장 보호 목록·키 관리(DATA_KEY 백업·회전)·사고 대응·강화 로드맵",
      "보안 포스처 감사: 코드 레벨 견고(헤더·CSP·레이트리밋·결제무결성·계정/세션·암호화 seam·감사로그) — 실질 갭은 운영 HUMAN GATE(TLS·키 주입)",
      "실기기 모바일 검증(Galaxy Note 20·384px CSS) — 바텀시트 정상(접힘=지도 풀스크린+시트 peek / 펼침=86vh)·버전 팝업 렌더 OK. adb reverse 터널",
      "회귀 +2(감사로그 file/memory) · tsc·vitest 393·arch 0",
    ],
  },
  {
    version: "0.37.0",
    date: "2026-06-09",
    title: "결제-구매자 바인딩 — bearer 토큰 선점 차단 (레드팀 #3 해소)",
    items: [
      "결제 confirm 시 로그인 계정에 엔티틀먼트 결속(boundAccount) — 유효 토큰을 타인이 선점해도 본인 계정 외엔 연결 거부(403 ENTITLEMENT_BOUND_OTHER). 레드팀 #3(bearer 토큰 선점) 해소",
      "배선: SimulationEntitlement.boundAccount 노출 + confirm.ts 전달 + payment confirm 라우트가 세션→계정으로 결속 + account.link-entitlement에서 결속 위반 403",
      "범위: confirm 경로(사용자 브라우저·세션 있음)만 결속. 웹훅(서버-서버·세션 없음)·mock은 미결속 → 기존 1-jti-1계정 배타성으로 보호(완전 결속은 주문생성 시 order→account 매핑 필요·후속)",
      "검증: panel-review 다모델(Gemini·Codex·qwen 병렬) + 회귀 +1(결속 위반 403) · tsc·vitest 391·arch 0",
    ],
  },
  {
    version: "0.36.0",
    date: "2026-06-09",
    title: "모바일 바텀시트 — 지도 풀스크린 + 하단 시트 패널 (모바일 1단계)",
    items: [
      "폰(≤600px)에서 패널을 하단 바텀시트로(네이버/카카오 지도 패턴): 지도 풀스크린 + 시트 핸들 탭으로 펼침/접힘, 지도 탭 시 자동 펼침(결과 노출). peek 134px(핸들+제목)→expand 86vh. 데스크탑·태블릿(>600px) 레이아웃 무변경",
      "z-index 정합: 시트 1200(지도·컨트롤 1000 위)·모달/자동완성 3000(시트 위) → 충돌 없음. CSP-safe(addEventListener)",
      "모바일 전환 로드맵 1단계 — SMS는 비용이라 폐기, 모바일=PWA·알람=웹푸시·로그인=이메일 매직링크로 확정(사장님). 다음: ② 결제-구매자 바인딩 → PWA 쉘 → 웹푸시 알람 → 이메일 로그인",
      "tsc·vitest 390·arch 0. ⚠ 라이브 모바일 스크린샷은 Chrome 익스텐션 복구 후(현재 CSS·z-index 코드 검증 완료)",
    ],
  },
  {
    version: "0.35.0",
    date: "2026-06-09",
    title: "성능 최적화 — 응답 gzip + /api/version 다이어트 (실측 기반)",
    items: [
      "실측 진단: 서버 연산은 <1.1ms로 병목이 아님(health 0.99·config 0.64·simulate 0.60ms). 진짜 비용은 페이로드 전송 — 앱 HTML 159KB(비압축)·/api/version 27KB → 모바일 네트워크에서 체감 지연",
      "gzip 응답 압축(sendHtml) — 앱 HTML 159KB→**50KB(~69%↓)**. Accept-Encoding 협상 + Vary 헤더. nonce 주입 후 압축(요청별 동적). 모바일 첫로드 대역폭 대폭↓",
      "/api/version 다이어트 — 전체 릴리스 → 최신 8개만(27KB→10KB). 변경점 팝업 델타엔 충분",
      "후속 최적화 후보(문서화): 핀 분석 워터폴(landClass→recommend→terrain→parcel 순차→병렬) · 외부 API(geocode/KAMIS) 단기 캐시 · 비핵심 스토어 flush throttle · 배포층 nginx(gzip+TLS+정적캐시)",
      "tsc·vitest 390·arch 0 · 런타임 실증(curl 크기 검증)",
    ],
  },
  {
    version: "0.34.0",
    date: "2026-06-09",
    title: "보안 하드닝(멀티모델 패널 P2) — 계정 해시 시크릿 분리·토큰 길이 cap",
    items: [
      "subjectHash 전용 시크릿 분리 — 계정 식별자 해시에 LANSMARK_ACCOUNT_SECRET(있으면) 사용 → 엔티틀먼트 시크릿 회전이 계정 조회를 깨뜨리지 않음. 미설정 시 엔티틀먼트 시크릿로 폴백(새 HUMAN GATE 불필요)",
      "엔티틀먼트 토큰 길이 cap — verifyEntitlementToken이 4096자 초과 토큰을 HMAC/base64/JSON 처리 前 즉시 거부(비정상 큰 헤더의 요청당 CPU/메모리 증폭 차단)",
      "출처: 멀티모델 패널(panel-review: Gemini·Codex·qwen 병렬 적대리뷰)이 P2로 지목 → Claude 트리아지 후 채택. 나머지(devHint=verifier isProd 게이트로 오탐·anonId 비암호학적 격리=기존 문서화)는 기각/기존",
      "회귀 +1(토큰 길이 cap) · tsc·vitest 390·arch 0",
    ],
  },
  {
    version: "0.33.0",
    date: "2026-06-08",
    title: "유료-계정 연계 + 4모델 파이프라인 실증(감독·Gemini·Codex·qwen)",
    items: [
      "유료-계정 연계 — 로그인 계정에 엔티틀먼트(jti)를 귀속해 결제가 '기기 토큰'이 아니라 '계정'을 따라가게 함. POST /api/account/link-entitlement(세션+엔티틀먼트 검증·1 jti=1 계정 409·멱등·감사로그·sensitive 레이트리밋) + /api/account/me에 pro·entitlementCount",
      "4모델 파이프라인 첫 실증(7단계) — ①감독(Claude) ②사전리뷰(Gemini Flash·4건) ③사전레드팀(Claude) ④코딩(Codex gpt-5.5 초안→Claude 적용) ⑤사후레드팀(Codex·Gemini·qwen+Claude) ⑥사후리뷰(qwen 전수=0) ⑦감독승인(Claude). codex·gemini CLI를 Bash로 실제 호출",
      "fix(레드팀 확정 2건 — Codex·Gemini가 독립 지목, Claude·qwen 미검출) — #1 만료된 토큰이 /me에서 pro로 계속 인정(exp 미검사) → SimulationEntitlement에 exp 노출 + 계정에 {jti,exp} 저장 + /me 만료검사. #2 동시 연결 lost-update(acct 클론을 await 前 읽고 後 덮어씀) → 원자적 linkEntitlement(await 없는 단일 블록)",
      "flag(후속) — #3 bearer 토큰 선점(구매자 바인딩=결제연동 후속) · #4 멀티인스턴스 중복 귀속(DB 유니크=DB 어댑터 seam). 멀티모델 폴백 체인(토큰 소진 시 2순위→qwen/Claude) 규약화",
      "회귀 +3(연결·me.pro·409·만료) · featureMap 등록 · tsc·vitest 389·arch 0",
    ],
  },
  {
    version: "0.32.0",
    date: "2026-06-08",
    title: "휴대폰 OTP 로그인 + 로그인/내 계정 UI (가입 흐름 완성)",
    items: [
      "휴대폰 OTP 로그인 — PhoneOtpVerifier(기존 SMS seam 재사용): 6자리 코드 발송→검증. 키 있으면 실발송 / dev는 코드 노출(테스트) / 운영+키없음은 fail-closed(코드 비노출). 카카오·이메일은 같은 AuthVerifier 인터페이스로 추후 드롭인",
      "로그인/내 계정 UI — 헤더 '로그인' 버튼 → 2단계 모달(번호→인증번호) → 세션 저장 + 기존 익명 일지 자동 이관(link-anon). 로그인 시 '👤 계정'(가입정보·로그아웃). 세션 헤더를 모든 요청에 동봉(계정 신원이 일지에 따라옴)",
      "보안 — 잘못된 번호 400(BAD_PHONE)·미지원 method 503·OTP 챌린지당 시도 상한(brute-force)·운영 fail-closed. qwen vote3=0 + 적대검토 + 런타임 스모크(start→devHint→verify→세션·이관)",
      "SMS 실발송 = HUMAN GATE: 알리고/네이버 SENS/CoolSMS 키 + 동의화면 위탁 고지 추가 후 LiveSmsSender 드롭인. 그 전까지 dev는 화면에 인증번호 노출로 테스트 가능",
      "tsc·vitest 386·arch 0 · 로그인 모달은 검증된 알림모달 패턴(CSP-safe·esc·전화 자동하이픈) 재사용",
    ],
  },
  {
    version: "0.31.0",
    date: "2026-06-08",
    title: "계정·세션 코어 + 익명→계정 이관 (가입 기반 서비스 토대)",
    items: [
      "계정·세션 코어 — 익명(기기 anon-Y)→가입→계정(acct:Z) 신원 + 세션(무작위 192bit 토큰·만료). 로그인 시 일지를 계정으로 귀속, link-anon이 기존 익명 일지를 계정으로 이관. (BM: 네이버/카카오의 '로그인하면 내 기록이 따라온다' 리텐션 루프 = 가장 큰 갭이었던 자리)",
      "인증 검증기 seam — dev=MockVerifier(코드 000000), 실제 로그인(휴대폰 OTP·카카오·이메일)은 키 확보 시 드롭인(HUMAN GATE·'코어만 먼저' 결정). 원 식별자(전화/이메일) 미저장 — authRef.subjectHash(keyed-hash)만",
      "보안(적대검토 확정 수정) — 운영에 mock 노출 시 '아무 번호나 000000으로 로그인=계정 탈취' 발견 → DisabledVerifier로 운영 fail-closed(실제 검증기 전까지 로그인 차단) + 챌린지당 시도 상한(brute-force) + auth는 sensitive 레이트리밋",
      "BM 반영 — 네이버/카카오맵·농사로 사용자흐름 점검: 지도 표준(검색·위치·3종 레이어)은 이미 동급, 농사로 영농일지는 소득예측 결속+플라이휠로 차별화 유지, 카카오 즐겨찾기 프라이버시 사고는 익명격리·기본비공개로 선반영",
      "회귀 +6(accountRoutes.spec: 가입·재로그인·틀린코드·me/logout·이관·운영가드) · qwen vote3=0 + 적대검토 + 런타임 스모크(가입→이관→로그아웃) · tsc·vitest 385·arch 0",
    ],
  },
  {
    version: "0.30.0",
    date: "2026-06-08",
    title: "ops 유료 게이트 런타임 토글 — 무료베타↔유료 재시작 없이 전환",
    items: [
      "운영 콘솔에 유료 게이트 토글 — 무료베타(OFF)↔유료(ON)를 관리자가 재시작 없이 즉시 전환·영속(재시작 보존). '시점 되면 반영'을 코드로. ops 결제 패널에 현재 상태·전환 버튼·오버라이드 표기",
      "안전(머니 게이트) — 관리자 인증(timing-safe) + 운영(prod)에서 무료개방은 ALLOW_OPEN_PAID=1 동의 필요(bootSafety 불변식과 정합·런타임 우회/실수 차단). 부팅 시 영속 오버라이드를 config에 적용한 뒤 bootSafety가 '실효값'을 fail-closed 검증",
      "배선 — RuntimeFlagsStore(영속·file|memory) + createContext에서 config.requireEntitlement에 오버라이드 적용(요청 readers 8곳 무변경) + devServer는 createContext→bootSafety 순서로 조정",
      "검증 — qwen vote3=0건 + Claude 적대검토(부팅순서·prod가드·CSRF·config변형 무결함) + 런타임 스모크(토글 라이브 반영·영속·복구) · 회귀가드 +5(opsRoutes.spec) · tsc·vitest 379·arch 0",
    ],
  },
  {
    version: "0.29.0",
    date: "2026-06-08",
    title: "유료 전환 전 법무 마무리 — 일지 삭제권·at-rest 암호화 seam·ops 방어심도",
    items: [
      "일지 삭제권(PIPA 정보주체 삭제권) — 재배일지에 '삭제(파기)' 버튼 + POST /api/journal/delete(소유권 loadOwned 검사·타인 404). 정확 PII(위치·수확)를 즉시 파기. 익명 보정 레코드는 지역단위 가명정보로 잔존(처리방침 명시 대상)",
      "at-rest 암호화 seam — db/jsonFile.ts에 AES-256-GCM(LANSMARK_DATA_KEY=hex64/32B 설정 시 활성, 미설정이면 평문+0600으로 기존 동작 무영향). PII 스토어(휴대폰·일지 좌표/매출) 디스크 암호화. 키는 운영자 주입(HUMAN GATE) — 코드/AI가 만들지 않음",
      "fix(데이터손실 가드 · Claude 직접검토 발견 — qwen vote3=0건) — 암호화 파일을 키 없이/불일치로 열면 initial 로드 후 첫 flush가 암호문을 평문으로 덮어써 원본 파기되던 footgun. sealed 플래그로 '못 읽은 암호화 파일은 flush 차단' → 운영 키 누락 오설정 시 데이터 손실 방지",
      "ops CORS 방어심도(레드팀 P2) — /api/ops/* 응답에서 Access-Control-Allow-Origin 제거 → dev-open(CORS*)이어도 타 출처 JS가 운영 집계를 cross-origin 판독 불가(prod bootSafety와 이중 방어)",
      "회귀가드 +4(jsonFile 암호화 라운드트립·PII 평문 미노출·sealed 덮어쓰기 차단·일지 삭제 소유권) · featureMap 등록(/api/journal/delete) · tsc·vitest 374·arch 그린",
    ],
  },
  {
    version: "0.28.0",
    date: "2026-06-05",
    title: "2차 보안검증(교차파일 Workflow) — 확정 5건 중 3건 수정",
    items: [
      "2트랙 보안검증: qwen 무료 전수 스윕(보안+core+integ 55파일×vote3=165호출·0건) + Claude Workflow 6축 교차파일 적대검증(11→확정 5·기각 6). qwen이 구조상 못 잡는 '교차파일·의미' 결함을 Workflow가 포착.",
      "fix(P1 실효 갭) — 엔티틀먼트 revoke 검사가 consume() 안에만 있어, consume을 안 부르는 유료 surface(guide 유료작물·foreign·journal)는 환불/분쟁 실효 후에도 동작하던 갭. EntitlementStore.isRevoked 도입 + 3개 라우트에 실효 거부(ENTITLEMENT_REVOKED) — 킬스위치를 전 유료 surface로 확장(유료 전환 전 필수). 회귀가드 추가",
      "fix(P2 ops 검증 정합) — 운영콘솔 'validated' 버킷이 raw actuals≥5로 익명 포함 판정 → SSOT(distinctSubmitters·anon-* 제외, VALIDATED_THRESHOLD)와 일치하게 '인증 제출자 distinct'로 변경. 무료 익명 5회로 운영지표 위조 차단",
      "fix(P2 quota 순서) — /api/simulate·/api/feedback이 입력검증 前에 quota 소진 → 깨진/cropId없는 본문에도 1회 차감되던 것을, 검증 통과 後 소진으로 이동(budget 패턴과 통일)",
      "flag(수정 안 함·결정/방어심도): 무료베타 익명 feedback의 보정 영향(이미 anon-pool 가중캡으로 바운드 — collect-only 전환은 결정사항) · dev-open+CORS* 시 ops cross-origin 읽힘(prod bootSafety 이중차단으로 무력). tsc·vitest 370·arch 그린",
    ],
  },
  {
    version: "0.27.0",
    date: "2026-06-05",
    title: "지도 형태 3종(일반·위성·지형) 전환",
    items: [
      "지도 basemap 토글 — 일반(VWorld Base)·위성(VWorld Satellite)·지형(OpenTopoMap 등고·음영). 지도 우상단 토글, 선택은 localStorage 보존(기본 위성). VWorld 키 없으면 OSM 폴백",
      "지형은 VWorld 미제공이라 OpenTopoMap(SRTM·CC-BY-SA·키 불필요) 사용 — CSP img-src https: 허용·출처표기. maxNativeZoom으로 고배율(필지) 스케일 표시",
      "프론트 전용(백엔드 무변경 · /api/config의 tiles.base/satellite 재사용) · tsc·vitest 369·arch 그린 · 브라우저 검증(3종 전환·타일 실로드 확인)",
    ],
  },
  {
    version: "0.26.0",
    date: "2026-06-05",
    title: "give/get B — 수확기 리마인드 옵트인 다리(익명→연락처)",
    items: [
      "수확기 리마인드 다리 — 시뮬 카드에 '이 작물 수확기 시세·리마인드 받기' 맥락 CTA. 기존 알림 옵트인 재사용 + 작물·지역 맥락 전달, 구독에 cropId 의도 캡처. 익명→'재방문 가능(연락처)' 전환 = slow loop(실측 회수)·유료 전환의 연료",
      "정직성·PIPA 유지 — 실제 발송은 SMS 게이트웨이 키(HUMAN GATE) 후. 지금은 '발송 준비 중' 라벨로 동의·번호·의도만 저장(번호 마스킹·해지 즉시 파기·가입여부 열거방지 그대로). cropId는 화이트리스트(소문자·밑줄) 검증 — PII 아님",
      "로컬 qwen '무료 근육' 첫 실전 — B 백엔드를 qwen 1차 리뷰(Mode 1) → 삼각검증으로 확정 0(qwen이 enumeration-safe unsubscribe를 '위험'으로 오판한 것 등 걸러냄). 'qwen=1차 보조·최종판단 아님' 워크플로 입증",
      "tsc·vitest 369(+cropId 화이트리스트 회귀)·arch 그린 · 브라우저 검증(작물 CTA→모달 맥락 배너·발송 준비 중)",
    ],
  },
  {
    version: "0.25.0",
    date: "2026-06-05",
    title: "익명 수요·퍼널 계측 (Phase A) — 무료 베타에서 '무엇을 얻는가'",
    items: [
      "익명 수요·퍼널 계측 — 서버측 집계(PII 0·새 공개 엔드포인트 0)로 ① 진짜 수요(시뮬한 작물×지역 히트맵) ② 퍼널(추천→시뮬→가이드/외래→일지→옵트인, 어디서 빠지나) ③ 데이터갭(원했지만 미등록 작물). /api/ops/stats·운영콘솔 '수요·퍼널' 패널에 노출",
      "영속·내구 — 파일 저장(throttle 25건마다·동기 fs 부담↓)·재시작 누적·종료 시 graceful flush(SIGTERM/SIGINT)·신규키 상한(DoS 가드)",
      "정직성 — 익명 신호는 위조 가능 → '검증된 사실' 아닌 '베타 관심도·참고용'으로 라벨(타입·featureMap·콘솔 패널)",
      "레드팀(집중·적대검증) 확정 수정 — region/외래 검색어 free-text가 집계 키로 영속되던 PII 경로 차단(행정구역명 형태만·GBIF 정규명만 기록 → 'PII 0'를 코드로 강제) + 상한 도달 경고·콘솔 위조가능 표기",
      "featureMap 등록(demand-analytics·31기능) · 회귀가드 +7(집계·화이트리스트·상한·PII차단·파일영속) · tsc·vitest 368·arch 그린 · 런타임 검증(수요 히트맵·퍼널·데이터갭)",
    ],
  },
  {
    version: "0.24.0",
    date: "2026-06-05",
    title: "LENSMARK 리브랜드 + 무료 베타 오픈(유료 추후)",
    items: [
      "브랜드 표기 LANSMARK→LENSMARK(도메인 lensmark.kr 정합) — 앱·콘솔·이용약관·개인정보·면책·결제상품명. 기술 식별자(env LANSMARK_·헤더 x-lansmark·localStorage·파일명)는 호환 위해 그대로 보존",
      "무료 베타 — 정밀 소득분석·재배가이드·외래작물 조회를 무료 제공(유료 게이트 비활성, '유료 전환은 추후 오픈' 배너·라벨). 서버 requireEntitlement=false면 자동 전환, true로 되돌리면 페이월 부활(대칭)",
      "fix(무료베타 점화) — /api/config 결제 필드명(required) 정합 + ensureSim 엔진가드 FREEBETA 해제(페이월만 숨고 정밀시뮬이 안 돌던 결함). 잠금/유료 라벨을 FREEBETA-aware로(무료인데 '유료·🔒' 표기 제거·정직성)",
      "보안(레드팀 확정 수정) — 재배일지 무료베타 교차사용자 노출(IDOR) 차단: 브라우저별 익명ID로 사용자 격리 · '✓검증' 배지는 인증(유료) 제출만 인정(무료 익명 위조 차단) · 익명 보정 가중을 단일 풀로 캡(단일 공격자의 플라이휠 magnitude 오염 차단)",
      "리브랜드·무료베타 집중 레드팀(4축+적대 재검증) 확정 결함 전부 수정·회귀가드 5 추가 · tsc·vitest 361·arch 그린 · 브라우저 검증(무료베타 배너·시뮬 무료실행·LENSMARK 표기)",
    ],
  },
  {
    version: "0.23.0",
    date: "2026-06-05",
    title: "KMA 기상특보 라이브 승격 (Phase 1)",
    items: [
      "기상특보 실연동(kmaWarning): EUC-KR·typ01 공백분리 파서(help=1 공식 범례 검증)·구역코드·지역 부분매칭·60초 캐시 — 종류/수준 값은 KMA 원문 패스스루",
      "/api/alerts?region= → 병충해·재해 패널에 KMA 실시간 특보 합류(키 없으면 seed 폴백). ⚠ 캡처 시점 발효 0건이라 컬럼·행포맷 검증(활성 표시는 발효 시)",
      "integrations seam→live 졸업(agri-alerts) · Perenual 무료는 분류뿐(케어 유료)이라 보류 · tsc·vitest 349·arch 그린",
    ],
  },
  {
    version: "0.22.0",
    date: "2026-06-05",
    title: "무료 베타 오픈 준비 (Phase 0) — 법무 초안·정직성·해자 CTA",
    items: [
      "이용약관·개인정보처리방침 페이지(초안·법무검토 필요) — 실제 수집 관행(휴대폰=알림·실측=보정·위치=분석) 반영 · 앱 푸터 링크 · 공개·PII 수집 게이트",
      "플라이휠 CTA — 시뮬 후 '수확 실측 입력 → 예측을 추정→검증으로'(해자 데이터 엔진 가속)",
      "공개 정직성 감사 통과(데모·미검증·면책 라벨이 렌더 경로 전반에 존재) · tsc·vitest 345·arch 그린",
    ],
  },
  {
    version: "0.21.0",
    date: "2026-06-05",
    title: "종합 점검 — 제품 전체 레드팀 확정 6건 수정(결제·해자·거버넌스)",
    items: [
      "결제 무결성: PG 웹훅도 결제 금액 서버검증(confirm과 대칭) + 주문 결정적 jti로 이중발급(quota 2배) 차단",
      "해자 보호: 실측 보정에 per-user 가중 캡 + /api/feedback quota 소진 — 단일 제출자의 보정 오염 차단",
      "정직성·거버넌스: featureMap·ARCHITECTURE 기후모델 문구 정정(여름최고·강수도 이동 — 거짓 '미지원' 제거) · 엔티틀먼트 cap 축출 가시화(활성토큰 리셋/실효토큰 부활 경고)",
      "전체 회귀(vitest 345·신규 회귀가드 3)·브라우저 스모크 그린 — known-good 확정",
    ],
  },
  {
    version: "0.20.0",
    date: "2026-06-05",
    title: "알림 opt-in 팝업 (핸드폰 동의 수집 · VAPID 대체)",
    items: [
      "자체 팝업으로 알림 신청(개인정보 동의 + 휴대폰 번호) → 동의·번호 저장 · 실제 SMS 발송은 제공자 키 seam(HUMAN GATE)",
      "정직성·PIPA: 동의 필수 · 원번호 마스킹(로그·응답) · 해지=즉시 파기 + 해지 UI · 발송 '준비 중' 정직 안내 · PII 파일 0600",
      "다중 전문 레드팀 확정 8건 전부 수정(해지 UI·해지 파기·10자리폰 차단·가입여부 열거·파일권한 등) · VAPID 웹푸시는 미사용 dormant로 대체",
    ],
  },
  {
    version: "0.19.0",
    date: "2026-06-05",
    title: "농사로 국내 재배정보 seam (국내=농사로 / 외래=Perenual)",
    items: [
      "국내 작물 재배정보(재배시기·관수·품종) = 농사로(농진청) seam 추가 — base·apiKey·XML/JSON을 HTTP 실측으로 검증",
      "재배정보 역할 분리: 국내=농사로 / 외래=Perenual(국내 소스는 외래작물 미커버) · 국립수목원·AI-Hub는 재배정보 seam 아님(종메타·벌크 다운로드)",
      "파서는 SHAPE_UNVERIFIED(serviceName·출력필드 발급 후 확정·추측 금지) · 키 비노출·비밀 URL 로깅 금지 주석 · 오프라인 테스트 22",
    ],
  },
  {
    version: "0.18.0",
    date: "2026-06-05",
    title: "외부연동 준비 — HUMAN GATE seam·발급 체크리스트",
    items: [
      "특보·예찰(NCPMS)·식물정보(Perenual/Trefle)·지원금(공공데이터)·푸시(VAPID)·크론 6종 연동 seam 준비 — 키 꽂으면 인식(listIntegrations)",
      "정직성: 실응답 파서는 SHAPE_UNVERIFIED로 막아 추측 차단 · 키 값 비노출(존재여부만) · 거짓 'live' 라벨 금지",
      "발급/신청 체크리스트(HUMAN_GATE.md) + .env 빈 템플릿 — 키 확보 후 한 슬라이스씩 live 승격 · 오프라인 테스트 18",
    ],
  },
  {
    version: "0.17.0",
    date: "2026-06-05",
    title: "작물 검색 → 추천 지역 (검색창 독립 진입)",
    items: [
      "상단 검색창에 주소/작물 모드 토글 — 작물 모드는 작물명 자동완성(무료/유료 배지)",
      "작물만 고르면 필지 없이 추천 지형조건 + 시도별 기후 적합(리스트) + 지도 마커를 바로 표시",
      "다중 전문 레드팀 검증 통과(확정 결함 0) · 작물 모드에선 '내 위치'를 숨겨 흐름 일관",
    ],
  },
  {
    version: "0.16.1",
    date: "2026-06-04",
    title: "작물→지역 적합 지도 마커",
    items: [
      "시도별 기후 적합을 지도에 색 마커로(초록 적합/노랑 주의) — '지도에 표시' 토글, 마커 클릭 시 사유 팝업",
    ],
  },
  {
    version: "0.16.0",
    date: "2026-06-04",
    title: "작물→지역 추천 (시도별 기후 적합)",
    items: [
      "작물 선택 → 추천 지형조건 + 시도별 기후 적합(적합/주의/부적합) 리스트 — 색으로 표기",
      "시도 평년기후(근사) × 작물 요구·서리위험 비교 · 시도 광역≠필지 적합(면책)",
      "지도 마커는 다음 단계(시도 중심좌표 포함) · 다중 전문 레드팀 검증",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-06-04",
    title: "외래작물 기후대 적합성 (GBIF 관측 위도대 × 필지 기후)",
    items: [
      "외래·임의 작물 조회에 기후대 적합성 — GBIF 관측 위도대 vs 이 필지 위도·겨울최저(KMA)",
      "재배 가능 단정이 아닌 소프트 신호(유사/주의) + 시설 검토·월동 확인 안내(면책)",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-06-04",
    title: "Phase B 착수 — 외래·임의 작물 조회(GBIF+위키, 키 불필요)",
    items: [
      "직접 작물 추가(외래종 포함, 유료): GBIF 생물분류 + 위키백과 설명 실연동(키 불필요)",
      "임의 작물은 소득 시뮬 비활성 — 해외/일반 참고 정보 + 기후 적합성 별도 검증(면책)",
      "다중 전문 레드팀 검증 통과(확정 결함 0)",
    ],
  },
  {
    version: "0.13.1",
    date: "2026-06-04",
    title: "전체 작물 보기 (무료 대표작물 선택)",
    items: [
      "추천 top-N 밖 작물(벼·보리 등)도 '전체 작물 보기'로 직접 선택 — 무료/유료 배지 표시",
      "작물 카탈로그 API(/api/crops)",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-06-04",
    title: "환경 점검 + 지원금·혜택 (영농 동반 비전 완성)",
    items: [
      "환경 점검: 지역 기후(강수·겨울최저·일조·서리) vs 작물 요구 적합 점검(양호/주의/위험)",
      "지원금·지자체·농협 혜택: 대표 제도 안내 + 공식 확인 경로(금액·자격은 공식 확인)",
      "영농 동반 6대 비전 완성 — 재배일지·출하·품종·병충해·환경·지원금 (실시간/외래작물/푸시는 Phase B)",
      "화면 정리: 동반 정보(출하·병충해·환경·지원·일지)를 탭 그룹으로 통합(세로 스택 → 한 칸)",
      "다중 전문 레드팀 검증 통과(확정 결함 0)",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-06-04",
    title: "병충해·재해 주의 (작물·이번 달 기준)",
    items: [
      "작물·월 기반 병해충 + 기상/재해(서리·장마·폭염·태풍·한파) 주의 — '지금 주의' 표시",
      "무료(안전 정보) · 실시간 발생 예찰(NCPMS)·기상특보(KMA)·푸시 알림은 연동 예정(Phase B)",
      "다중 전문 레드팀 검증 — 발생 시기 과대 산출 버그 수정",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-06-04",
    title: "품종·재배 가이드 (무료=대표작물 / 유료=전체)",
    items: [
      "작물별 품종 후보 + 재배 환경 요구조건(pH·배수·물·일조·내한·서리·경사) + 재배 적기 가이드",
      "무료=대표작물(벼·보리·사과·감자 등), 유료=전체 작물 — 외래종 직접 추가(국내+해외 정보 병합)는 준비 중(유료)",
      "데이터 정직성: 국내 룰북(데모) + 농사로 연동 seam · 재배 성공 보장 안 함(면책)",
      "다중 전문 레드팀 검증 통과(확정 결함 0)",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-06-04",
    title: "출하 판로 비교(KAMIS 실시세 앵커) + 운영 게이트 강화",
    items: [
      "출하 판로 비교: 작물 룰북 판로비율 × KAMIS 실도매가 앵커 → '어디 납품하면 몇 % 더 받나'(무료)",
      "재배일지 조회·시즌 리포트가 실제 브라우저에서 열리도록 인증 헤더 수정(프리뷰로 포착한 통합 버그)",
      "보안: 운영에서 유료 게이트 끄기 시 부팅 차단 · mock 가격을 '실시세'로 표기하지 않음(데이터 정직성)",
      "다중 전문 레드팀 적대검증 + 브라우저 프리뷰로 통합 결함 3건 포착·수정",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-04",
    title: "영농 동반 시작 — 재배 기록·시즌 리포트(수확→해자 환류) + 비전 로드맵",
    items: [
      "재배 일지: 시뮬 예측을 결속해 작기를 기록(작업·수확) → 시즌 리포트(투입·수확·수익·예측 대비 정확도)",
      "수확 실측이 보정 플라이휠(해자)로 자동 환류 — 예측을 '추정'에서 '검증'으로 끌어올리는 데이터 통로",
      "영농 동반 비전 6종을 기능 지도에 등록(재배운영 'operate' 단계 신설): 재배가이드·품종 / 지원금·혜택 / 일일 모니터링 / 병충해·재난 알람 / 출하 시세·납품처 / 재배기록·리포트",
      "보안: '✓검증' 배지를 서로 다른 제출자 수로 판정(혼자 다건 위조 차단) — 다중 전문 레드팀 적대검증 2건 반영",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-06-04",
    title: "영속성 — 재시작에도 데이터 보존 + 토큰 실효 API",
    items: [
      "상태 영속(실측 플라이휠·웹훅 멱등·유료권한 소진/실효)을 파일 스토어로 — 재시작에도 보존(무의존성)",
      "memory↔file 드롭인 전환 + 다중 인스턴스용 DB 어댑터 seam · 콘솔에 저장모드 표시",
      "유료권한 실효 API(관리자 전용) — 환불/분쟁 시 토큰 무력화",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-04",
    title: "레드팀 보안 강화 — 결제 무결성·우회 차단·fail-closed",
    items: [
      "레이트리밋 우회 차단(X-Forwarded-For 위조 방지 · 신뢰 프록시 경계)",
      "운영 배포 fail-closed — 약한 시크릿·전체 CORS·무인증 콘솔이면 부팅 차단",
      "결제 무결성 — 금액 서버검증 · 토큰 소진(quota)·실효 · 웹훅 식별자 서버유래",
      "실측 피드백 인증 게이트 + '검증' 배지를 서로 다른 제출자 수로 판정(위조 차단)",
      "외부 API 타임아웃·응답 가드 · 신뢰도 위조 차단 · 화면 경쟁조건·CDN 무결성(SRI)",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-03",
    title: "보안 강화 — CSP·보안헤더·레이트리밋·CORS",
    items: [
      "콘텐츠 보안 정책(CSP·nonce) + 보안 헤더(nosniff·클릭재킹 차단·Referrer·Permissions·HSTS) 적용",
      "요청 레이트리밋(과다요청·악용 차단) — 결제·시뮬·피드백은 더 엄격",
      "CORS 허용목록 + 프리플라이트 · 부팅 시 위조가능 기본 시크릿/오픈 콘솔 점검",
      "실측 피드백 변조·이상치 방지(0↑·상한 클램프) — 보정 플라이휠(해자) 무결성 보호",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-03",
    title: "시군 수면경고 · 재확인 입력 · 비교 보정상태 · 버전 알림",
    items: [
      "버전 관리 + 업데이트 변경점 팝업(이 알림) · 운영 콘솔에 버전 표시",
      "시·군/전국 줌에서도 강·바다(수면) 탭 시 경작 불가 차단",
      "기존 농경지 '재확인' 입력(현재 재배 현황) — 이미 재배 중이면 전작 정리비·공백기 안내",
      "다중 비교표에 보정상태(검증/추정) 컬럼 추가",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-06-03",
    title: "운영 콘솔 · 결제 · 드롭인 연동",
    items: [
      "운영자 콘솔(/ops) — 통합 준비도·결제·플라이휠·보정버킷·활동로그 + 관리자 인증",
      "결제(PG) 페이월 + 유료권한 — 무료 추천 → 결제 → 정밀 분석 잠금해제 (Toss seam · 데모결제)",
      "드롭인 provider(auto) — API 키만 꽂으면 통합별 자동 운영 전환",
      "생육·출하 타임라인(파종→수확·출하) + 판로·재배연차·실필지면적 소득 반영",
      "토지유형 구분(강·바다·도시·기존농경지) · 주소·지번 검색 · 내 위치",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-02",
    title: "보안 · 정밀 하드닝",
    items: [
      "반사형 XSS 차단 · 입력검증 · 요청바디 상한 등 보안 강화",
      "추천 점수 범례 · 비교/PDF 가드레일 · 음수소득(미검증 placeholder) 안내 개선",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-02",
    title: "지도 메인 실엔진 연동",
    items: [
      "지도 클릭 → 실엔진 정밀 소득 시뮬 (P10/50/90 · 근거 6축 · 손익분기 · 면책)",
      "실측 보정 플라이휠 · LIVE 이벤트 피드",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-05-30",
    title: "초기 스캐폴딩",
    items: ["작물·수확·소득 시뮬레이터 코어 · 지오스택 · 결제 모듈 (77 테스트)"],
  },
];

export const APP_VERSION = RELEASES[0].version;
