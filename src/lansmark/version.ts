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
