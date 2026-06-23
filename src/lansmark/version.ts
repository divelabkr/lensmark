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
    version: "0.77.12",
    date: "2026-06-23",
    title: "운영 가시성 보강 — 데이터 신선도(마지막 live)·응답 p95·업타임",
    items: [
      "4축 점검의 공통 빈틈(신선도·지연 가시성) 해소: ① provider 런타임 건강에 '마지막 live 성공 시각(lastLiveAt·결정성 위해 at 주입식)' 추가 → integrationReadiness·/api/health·ops 통합목록에 '↳N시간 전' 노출(키 있고 live지만 며칠째 폴백 중인 소스를 시각으로 드러냄). ② API 응답시간 측정(미들웨어 res.finish·최근 200건 링버퍼) → ops 시스템건전성에 응답 p95(800/2000ms=주의/시급)·업타임(min=0 재시작 빈도) 노출 — 이전엔 5xx만 보여 '느려짐'이 사각이었음.",
      "데이터 패스 묶임(featureMap 39기능+provider seam+arch 대조)·품질 게이트(A~D 신뢰 피쉬본)·ops 콘솔(7탭)은 이미 탄탄했고, 빠졌던 '신선도 시각·인프라 지연'만 채움. runtimeHealth 타임스탬프는 at 주입식이라 결정성 유지. tsc·vitest 654·arch·size 그린.",
    ],
  },
  {
    version: "0.77.11",
    date: "2026-06-23",
    title: "4축 빈틈 5종 보강 — 데이터 기준일·mock기후 정직성·Dream 배선·explain dedup",
    items: [
      "정직성(1원칙): ① 가격·기후에 '기준일(asOf)' 추가 — KAMIS 도매가는 '최근 30일 분포'·KMA 기후는 실관측 기간(rows 날짜 min~max)을 명시(캐시된 값이 '오늘 실시세'로 오인되던 갭). 농가 도매가 옆에 '↳ …분포의 중앙값(오늘 단일 시세 아님)' 노출. ② mock 기후가 '실측 관측소'로 위장하던 것 차단 — source:'mock-kma' 표식 → climateEvidence가 '데모 예시값(실측 아님)' 라벨(가격 mock과 대칭·KMA 미연동 구간 오인 방지).",
      "해자·효율: ③ Dream(consolidate) 정리층을 프로덕션 simulate에 배선 — 코드만 있고 미호출이던 이상치격리·recency·버킷승격을 store별 TTL 스냅샷 캐시(WeakMap·lazy·자기치유·피드백 시 무효화)로 연결. 동일입력 재계산도 회피(재활용). ④ explain LLM 캐시에 in-flight dedup — 동시 동일버킷 LLM 호출 1회로 합쳐 stampede·실과금 N배 차단. 콜드/신규는 raw 폴백(회귀 0). tsc·vitest 654(+4)·arch·size 그린. (비용축은 진단상 이미 최적이라 무변경.)",
    ],
  },
  {
    version: "0.77.10",
    date: "2026-06-23",
    title: "SW install 견고화 — c.add→fetch+put 우회 + CDN best-effort (PWA 정상화)",
    items: [
      "실브라우저 진단(Chrome MCP): 사용자가 옛 v4 SW의 빈 캐시(/app 없음)에 갇혀 '연결 실패'. 서버·DNS·CF는 200 정상(/api/는 SW 우회라 200, /app navigation만 빈 캐시로 503). SW 해제+v5 로드로 즉시 복구. 추가 발견: v5 install의 c.add('/app')이 SW 컨텍스트에서 실패(redundant)해 SW 미설치 — 단 앱은 서버 직접 로드로 정상·먹통 0(fail-safe).",
      "수정: install의 /app 캐시를 c.add→fetch+put로 교체(zstd 인코딩/Vary 응답에서 c.add가 install을 redundant로 만들던 것 우회) + CDN leaflet은 개별 .catch best-effort(CSP connect-src 'self'에 막혀 실패해도 install 안 깨짐·런타임 <script>로 로드되므로 캐시는 보너스). CACHE v5→v6. 빈캐시 fail-safe·updateViaCache:'none'·no-store 유지. min=0(무료) 유지.",
    ],
  },
  {
    version: "0.77.9",
    date: "2026-06-23",
    title: "먹통 근본 수정 — '렌즈마크만 유독' 원인 2개 제거(SW 갇힘·빈 캐시)",
    items: [
      "원인①(메타장애): Cloudflare가 sw.js를 4시간 엣지캐시(max-age=14400 덮어씀·오리진은 no-cache 확인)해 옛 서비스워커에 갇히던 것 — '고쳐서 배포해도 또 먹통'의 정체. → 앱 SW 등록에 updateViaCache:'none'(브라우저가 sw.js를 HTTP캐시 우회·항상 네트워크에서 받아 업데이트 체크) + 오리진 Cache-Control no-store. (CF 대시보드 sw.js 캐시 Bypass는 운영 작업으로 별도.)",
      "원인②(빈 캐시 버그): SW install이 /app 캐시에 실패해도(콜드스타트) allSettled라 성공 처리 → activate가 옛 캐시를 무조건 삭제 → 빈 새 캐시 + 옛 캐시 소멸로 navigation 폴백을 잃고 503. → install에서 /app 필수화(실패 시 install 거부=옛 SW 유지가 빈 캐시보다 안전) + activate는 새 캐시에 /app 실재 검증 후에만 옛 캐시 삭제(이중 안전). CACHE v4→v5. min=0(무료) 유지하면서 코드만으로 먹통 근본 제거.",
    ],
  },
  {
    version: "0.77.8",
    date: "2026-06-23",
    title: "먹통 해결 — 콜드스타트 시 캐시 쉘 즉시(SW v4·stale-while-revalidate)",
    items: [
      "근본 수정: min=0 콜드스타트가 SW 재시도(3.6s)보다 길면 navigation이 '연결 실패'에 갇히던 먹통(사파리·크롬 공통) → SW v4가 짧은 재시도 후 콜드스타트 지속 시 캐시된 앱 쉘을 즉시 보여주고(먹통 0) 백그라운드로 서버를 깨워 다음 로드를 최신화(SWR). 서버·DNS·Cloudflare는 정상이었고 SW만 갇혔던 것.",
      "null 금지 원칙 유지(모든 분기 유효 Response — WebKit 하드실패 방지). CACHE v3→v4(옛 SW 교체). tsc·vitest 626·arch·size 그린.",
    ],
  },
  {
    version: "0.77.7",
    date: "2026-06-23",
    title: "작물 전환 로드맵 엔진·API(G-2) — 온난화 시점별 작물 변화('지금 사과 → 2060엔 ○○')",
    items: [
      "G-2 차별점(경쟁앱 부재): climateScenario(applyWarming)×cropSuitability(rankCropCandidates) 합성으로 현재·2040·2060 시점별 적합 작물 + 새로 유망(newcomers)/이탈(fadeouts) 산출. GET/POST /api/crop-transition(무인증·무료). 새 도메인 수치 없이 기존 엔진 합성이라 결정적이고, ΔT는 climateScenario가 외삽·미검증 면책(KMA/IPCC 근사 demo·SSP2-4.5)을 내장.",
      "엔진·라우트·featureMap(seam→live) 완료. UI 노출(필지 카드)은 dashboard 큰 작업이라 다음 슬라이스로 분리. tsc·vitest 626(+4 엔진)·arch·size 그린.",
    ],
  },
  {
    version: "0.77.6",
    date: "2026-06-23",
    title: "재계산 디바운스 + 재해복구 런북(중기)",
    items: [
      "UX-6 '내 값으로 조정' 재시뮬 디바운스(420ms) — 여러 입력을 빠르게 바꿔도 마지막 한 번만 서버 호출(느린 시골 회선의 스피너 폭주 방지). 항상 최신 st 기준이라 race-safe. OP-5 docs/DR_RUNBOOK.md 신설 — 배포롤백·Layer1 blob스냅샷·Layer2 GCP PITR·키만료 복구 절차 1장(재해 시 우왕좌왕 방지).",
      "tsc·vitest 622·arch·size 그린. 종합분석 중기 일부 — EL-2(비율 발견성)·EL-5(온난화 전역)는 가치 대비 위험으로 보류, OP-4는 deploy-run 권한(HUMAN GATE) 후, G-2(작물전환)는 별도 신중 진행.",
    ],
  },
  {
    version: "0.77.5",
    date: "2026-06-23",
    title: "운영 관측성 — ops-watch 주기↑·유료게이트 오작동 방지·에러 폭증 경보",
    items: [
      "OP-1 ops-watch cron 1일1회→6시간(00·06·12·18 UTC) — 서버다운·키만료·스토어 sealed를 반나절 늦게 인지하던 사각 축소(저트래픽이라 비용 무관). OP-2 ops 콘솔 유료게이트 켤 때 'PAID' 타이핑 확인 — 무료베타 중 운영 실수로 페이월 켜는 사고 차단. OP-3 클라이언트 에러 — 새 distinct뿐 아니라 같은 에러 50회 배수 '볼륨 폭증'도 경보(조용한 장애 폭증 가시화·스팸 없이).",
      "tsc·vitest 622(+1: 폭증 재트리거)·arch·size 그린. 종합 UX/운영 분석 즉시구간(운영) 반영.",
    ],
  },
  {
    version: "0.77.4",
    date: "2026-06-23",
    title: "사용자 흐름 개선(즉시구간) — 클릭 피드백·내위치 유도·시트 힌트·입력 점진공개",
    items: [
      "UX-1 작물 클릭 → 소득카드로 스크롤+펄스 하이라이트('눌렀는데 뭐 바뀌었지?' 마찰 제거·모달 대신). UX-2 빈 상태에 '📍 내 위치로 바로(실데이터)' CTA — 첫 클릭이 전국 예시 시드에 머무는 최대 이탈점 차단. UX-5 모바일 시트 핸들 펄스 힌트(끌어올리기 암시). 모두 prefers-reduced-motion 존중.",
      "EL-1 '내 값으로 조정' 점진적 공개 — 비율·면적·판로만 기본 노출, 나머지 8개(경사·향·표고·배수·재배유형·연차·pH·위성·기후시점)는 ⚙고급 <details>로 접음(인지부하↓·자동값으로 충분). bindSim 동작 유지(접혀도 DOM 존재).",
      "15년차 프로덕트/UX 종합분석의 즉시구간 반영. 작물 '팝업 모달화'는 map-first 정체성·모바일 바텀시트 충돌로 의도적 보류(클릭 피드백은 UX-1로 해결). tsc·vitest 621·arch·size + preview 검증(렌더·구문 에러 0).",
    ],
  },
  {
    version: "0.77.3",
    date: "2026-06-22",
    title: "작물 재배 비율 슬라이더 — 일부만 농사지을 때 소득 비례",
    items: [
      "작물 시뮬 입력에 '재배 비율' 슬라이더 추가 — 전체 필지 면적 중 X%만 재배할 때 면적 스케일로 소득이 비례(땅 전부에 농사짓지 못하는 현실 반영). 면적칸과 동기화, 필지 면적(fullArea) 기준. 작기 타임라인(생육·출하)·소득 P10/50/90·병충해·시뮬입력은 기존 패널에 이미 제공 중.",
      "tsc·vitest 621·arch·size 그린 + 로컬 preview 검증(비율 렌더·구문 에러 0·값 60%/600㎡ 정확).",
    ],
  },
  {
    version: "0.77.2",
    date: "2026-06-22",
    title: "콜드스타트 완화(SW 재시도) + LIVE 데모 피드 제거",
    items: [
      "min=0 scale-to-zero 콜드스타트 503('연결 실패') 완화 — 서비스워커가 navigation 연결실패/5xx 시 즉시 오프라인폴백 대신 짧게 재시도(0.6/1.2/1.8s 백오프, 서버 깨는 동안)해 사용자가 '연결 실패'를 덜 보게. CACHE v2→v3(옛 SW 교체).",
      "LIVE 이벤트 피드 제거 — 데모 트리거(가짜 예시 시세·서리, 4.2초 setInterval)라 가치 없고 리소스만 소모. 실데이터 이벤트는 KAMIS/KMA 실연동 후 별도 도입. openAt(핀/주소검색/에러재시도 공용)은 유지.",
      "tsc·vitest 621·arch·size 그린. (지도 타일 VWorld 도메인 등록은 별개 HUMAN GATE)",
    ],
  },
  {
    version: "0.77.1",
    date: "2026-06-22",
    title: "성능·비용 — 외부조회 TTL 캐시 + AI설명 캐시 버킷(반복분석 재사용·LLM 재호출 절감)",
    items: [
      "provider 외부조회(KAMIS·KMA·VWorld·Open-Meteo) 격자/작물 버킷 TTL 캐시 — 같은 땅·작물 반복분석 시 외부호출 1회로(무료 API라 비용보다 7초 타임아웃·쿼터·체감 개선). in-flight 병합으로 동시 동일요청을 1회로(stampede 차단). 무의존 Map — 단일 인스턴스(min=max=1)라 Redis 불필요.",
      "AI 근거설명 캐시 키를 P50 정확수치→규모 버킷(100만/500만/2천만)으로 — ±소액 차이로 인한 캐시 미스 제거로 LLM 재호출 절감. 버킷 hit 시 현재 입력 금액과 정합을 재확인(옛 설명의 P10/90 숫자 노출 차단·1원칙 보존).",
      "측정 가능한 절감(LLM·외부호출)만 반영 — feedback 인덱싱/클라 캐시는 query가 이미 cropId 필터+2만 행 캡이라 조기최적화로 보류. 진짜 최대 비용(Cloud Run 상주)은 트래픽 분석 후. tsc·vitest 621·arch·size 그린.",
    ],
  },
  {
    version: "0.77.0",
    date: "2026-06-22",
    title: "유료 베타 채비 — 데이터 시각화·UX 강화(라이브) + AI설명 검증승격·아이디/비번 인증(코드·활성화 게이트) + CI 자동화",
    items: [
      "데이터 시각화·아이덴티티(라이브 반영): 결과카드를 '숫자표→읽는 그래프'로 — 소득 확률밴드(위험~기대 색계조 주황→초록(P50)→청록 + P10·P90 분위눈금)·6축 근거 토네이도(중앙0 발산막대, 수율↑·비용↓=소득+ 정직매핑, 가짜 income% 날조 X)·누적 현금흐름 곡선(손익분기점)·신뢰도 배지(A~D). 전환은 View Transitions(prefers-reduced-motion 존중·무의존 브라우저 네이티브).",
      "AI 근거설명 '검증' 승격(코드): 실응답 1건으로 출력가드 보정 — 금액 단위 정규화(억/만/천→원)로 '엔진이 안 준 금액'이 새면 폐기(fail-closed) 강화 + 프롬프트 주입 레드팀 통과 후 verified. ⚠ 라이브 활성화는 ANTHROPIC_API_KEY를 Secret Manager에 주입해야(현재 deploy SECRETS 미포함 — 무키라 라이브선 설명만 무중단 비활성).",
      "아이디/비밀번호 인증(코드·가벼운 가입): 아이디·비번·비번확인 + scrypt 해시·timingSafeEqual·계정열거 타이밍 평탄화(DUMMY_CRED로 미존재 아이디도 동일 비용)·무한생성 억제(중복차단+rate limit)·임의ID·복구없음(베타). ⚠ 라이브 활성화는 개인정보처리방침 확정 후 LANSMARK_ANON_ONLY 해제(법무 HUMAN GATE) — 현재 라이브는 익명 PII-0(account 404) 유지.",
      "운영 자동화·약관·검증: CodeQL(보안 정적분석)·Lighthouse(접근성/성능 추세)·Dependabot(의존성)·size 게이트(CI) + 이용약관 6~11조(계정·해지·서비스중단·지재권·만14세·약관개정) 보강. tsc·vitest 612·arch·size 그린.",
    ],
  },
  {
    version: "0.76.8",
    date: "2026-06-18",
    title: "AI 근거 설명(Claude) seam — 엔진 숫자를 평이하게 '설명'만 (키-게이트·날조 금지)",
    items: [
      "Anthropic 스택 접목 1차(백엔드 seam): integrations/explain.ts — 엔진이 계산한 소득 P10/50/90·기후 근거를 Claude가 농민 친화 한국어로 풀어줌. 핵심 가드: Claude는 '설명'만, 숫자·작물·출처는 엔진이 준 것만(프롬프트 경성 지시 + 출력 후처리 hasUnprovidedMoney로 안 준 금액 새면 폐기·fail-closed). 외래작물 Perplexity seam과 동일 패턴(키-게이트·실패 null·verified=false).",
      "HUMAN GATE: ANTHROPIC_API_KEY(console.anthropic.com) — 없으면 설명 기능만 비활성(무중단). listIntegrations 8종 추적. UI(결과카드 '쉽게 풀어보기/물어보기' 칩)·라이브 호출은 키+배포+실데이터 뒤(합의한 순서). 승격 전 실응답 1건으로 출력가드 보정.",
      "tsc·vitest 588(+3: 프롬프트 빌더·금액 날조가드)·arch 0. 숫자 생성은 끝까지 결정적 엔진 — Claude는 언어층만(우리 1원칙 유지).",
    ],
  },
  {
    version: "0.76.7",
    date: "2026-06-17",
    title: "리팩토링 정리 — 죽은 레거시 소득엔진·고아 파일 제거(~800줄)",
    items: [
      "리팩토링 점검 후속: 레거시 소득엔진 island(core/simulator·yield·cost·revenue·income) 완전 제거 — 테스트/예제만 쓰던 죽은 코드. canonical 유료엔진은 core/parcelSimulator.ts 하나로 단일화.",
      "고아 dashboard/lansmark_dashboard.html(서빙 안 됨) + 미사용 *.route.example.ts 2종 제거. featureMap legacy 목록 비움 + 삭제 테스트 참조 정리. mockRun(npm run demo)은 캐노니컬/추천 데모로 정리.",
      "무료 추천 기본 동작은 cropSuitability 테스트로 보존. tsc·vitest 585·arch 0. (의도적 단일파일 lansmark_app.html·version.ts 비대는 별도 결정 대기)",
    ],
  },
  {
    version: "0.76.6",
    date: "2026-06-17",
    title: "지도 오버레이(정직 1차) — 핀에 '이 땅 기후' 팝업(실측·출처·면책)",
    items: [
      "필지 핀을 누르면 지도 위 팝업으로 '🌤 이 땅 기후'(연평균기온·적산온도·강수·겨울최저 등 실측 + 출처 '평년값 아님'·면책). nullschool풍 '지도에 기후' 요청의 정직한 1차 — 측정값을 지도에서 바로.",
      "전국 매끄러운 색지도(choropleth)는 14지점 보간=날조라 미구현 → KMA 격자 평년값 확보 후(HUMAN_GATE.md). 추가형 Leaflet 팝업이라 레이아웃 무영향.",
      "프런트 단일파일 — tsc·vitest 590·arch 0. 시각 확인은 배포 후.",
    ],
  },
  {
    version: "0.76.5",
    date: "2026-06-17",
    title: "설계 감사 즉시조치 ① — 무료 추천↔유료 시뮬 근거 일치(모순 제거) + 배포 철자 가드",
    items: [
      "핵심 모순 봉합: 무료 추천(cropSuitability)이 기후를 안 써서 유료 시뮬(factors)과 추천이 어긋나고, 그 위에 '🌤 기후 근거'가 붙어 거짓처럼 보이던 것 → 무료 추천도 유료와 '동일 데이터 기준'(내한·내서성·물요구·서리민감)으로 기후 반영. /api/recommend가 기후를 먼저 가져와 랭킹+근거+시뮬이 한 기준으로. 기후 위험 근거를 우선 노출(slice 보존).",
      "배포 철자 footgun 가드: scripts/deploy.sh가 firebase.json serviceId == SERVICE 일치 확인 후 배포 — lensmark/lansmark 오타로 인한 사이트 전체 장애를 사전 차단.",
      "tsc·vitest 590(+2: 기후반영 회귀가드)·arch 0. 설계 감사 7축 중 ②흐름·⑦운영 부분 개선(전 축 85는 데이터 실자료·HA 대공사 등 단계적).",
    ],
  },
  {
    version: "0.76.4",
    date: "2026-06-17",
    title: "기후 근거가 추천에 자연스럽게 — 필지 고르면 '🌤 이 땅 기후(추천 근거)'가 추천 작물 바로 아래에",
    items: [
      "UX 우선: 별도 위젯·추가 호출이 아니라, /api/recommend 한 응답에 climateEvidence를 함께 실어(fail-soft) 추천 작물 바로 아래에 '🌤 이 땅 기후 · 추천 근거'(연평균기온·적산온도·강수·겨울최저 등 실측 + 출처 '평년값 아님'·면책)를 자연스럽게 노출. 땅→추천→'왜'가 한 흐름으로 읽힘.",
      "좌표 없으면(상위 줌) 생략, 기후 조회 실패해도 추천은 그대로(기후 블록만 생략). 작물별 적합/위험 판정은 기존 데이터기반 엔진 유지(임계값 날조 금지).",
      "tsc·vitest·arch 그린. ⚠ 시각 확인은 배포 후(이 환경 렌더 불가). 전국 색지도·작물별 GDD 판정은 KMA 격자·농진청 base 확보 후(HUMAN_GATE.md).",
    ],
  },
  {
    version: "0.76.3",
    date: "2026-06-17",
    title: "기후 근거(필지 기후 프로필) 엔진 — 실측 적산온도(GDD)·연평균기온 + 평이한 근거 (전국 색지도는 데이터 대기)",
    items: [
      "nullschool풍 '기후 지도+근거' 요청의 정직한 1차: KMA 실측 일자료에서 연평균기온·적산온도(GDD, 생육기 4~10월·기준 10℃)를 직접 계산(climateFromAsos) + climateEvidence가 농민이 읽을 평이한 '기후 근거' 문장으로 변환(출처 '평년값 아님'·면책 표기). 작물별 적합/위험 판정은 기존 데이터기반 factors.climateFactors에 위임 — 임계값 날조 금지(추측 금지).",
      "사용자 관점 재정의: 화려한 바람 애니메이션·기후 위젯이 아니라 '이 땅에서 왜 이 작물인가'의 근거가 진짜 필요 → 측정 사실을 근거로 surfac(다음 슬라이스: 필지 카드 UI·/api 노출, 사용자 배포 후 검증).",
      "전국 매끄러운 색지도·작물별 'GDD 충분/부족' 판정은 14개 지점 보간·임계값 날조가 되어 미구현 → KMA 격자 평년값 + 농진청 작물 base 확보 후(HUMAN_GATE.md에 신청서 정리). tsc·vitest 588(+5)·arch(climate-evidence 기능 등록).",
    ],
  },
  {
    version: "0.76.2",
    date: "2026-06-16",
    title: "첫 화면 의도 묻기(온보딩) + 지도 타일 폴백(빈 지도 방지) + 웰컴 모달 중앙정렬",
    items: [
      "웰컴 온보딩에 '무엇이 궁금하세요?' 의도 칩 추가(🌱귀농 준비·🌾작물 추천·💰소득 분석·👀둘러보기) — 건너뛰기 가능(가치-먼저, 막는 가입폼 아님). 고르면 그 흐름으로 안내(귀농=자가진단 · 작물/소득=내 위치로 땅 고르기)하고 localStorage('lansmark_intent')에 저장해 개인화 토대로. 진행 단계(1 땅선택→2 추천→3 소득)는 '이렇게 진행돼요' 로드맵으로 명시.",
      "지도 타일 폴백: VWorld 타일이 막히거나(키 도메인 불일치·통신사 IP 차단) 응답을 못 줘 지도가 빈 배경만 남던 것(특히 확대 시) → tileerror 누적(>3) 시 OSM로 1회 자동 교체해 '지도가 아예 안 뜨는' 상황 방지. 근본 해결은 VWorld 키에 lensmark.kr 도메인 등록(HUMAN GATE).",
      "웰컴 모달 제목 중앙정렬. 프런트 단일파일(dashboard/lansmark_app.html) — tsc·vitest 583·arch 무관. 시각 확인은 배포 후 권장.",
    ],
  },
  {
    version: "0.76.1",
    date: "2026-06-15",
    title: "서비스워커 치명 버그 수정 — 네트워크 실패 시 'Returned response is null'로 페이지가 안 열리던 것",
    items: [
      "사장님 Safari 화면으로 확인된 실버그: 서비스워커(sw.js) fetch 폴백이 네트워크 실패 + 캐시 비어있을 때 undefined를 반환 → respondWith(null) → WebKit 'FetchEvent.respondWith received an error: Returned response is null' → 페이지 하드 실패. 통신사가 Firebase 공용 IP를 막아 fetch가 실패하면 서비스워커가 그걸 '복구 불가 에러'로 키웠다(차단=방아쇠, SW=증폭).",
      "수정 ① 폴백이 절대 null 반환 안 함: 캐시(요청→/app) 있으면 오프라인 제공, 내비게이션은 최소 오프라인 페이지(새로고침 버튼), 서브리소스는 Response.error()(유효 Response). ② install을 addAll(전체-실패시 빈 캐시)에서 개별 캐시(allSettled)로 — CDN 1개 실패해도 로컬 쉘(/app)은 캐시돼 오프라인 폴백 가능. ③ 캐시 버전 v1→v2: activate가 깨진 v1을 삭제하고 재구성.",
      "효과: 캐시가 있으면 차단망에서도 앱 쉘이 오프라인으로 뜸(이전엔 흰 화면+에러). 근본 접속(라이브 도달)은 여전히 Firebase 차단 IP 우회(Cloudflare/DNS 또는 통신사 유해차단 해제)가 필요 — SW 수정은 '깨진 페이지'를 없애고 우아하게 만든다. 프런트 단일파일·SW 구문검사 OK·tsc/vitest/arch 무관.",
    ],
  },
  {
    version: "0.76.0",
    date: "2026-06-15",
    title: "감사용 카테고리 선택 zip 내보내기 + ops에 CI 테스트 파이프라인 상태(GitHub Actions)",
    items: [
      "감사 내보내기(ops 🛟 백업/복구 탭): 카테고리 체크박스로 원하는 자료만 골라 복호된 평문을 zip(의존성0 ZIP 작성기)으로 다운로드 — 감사(監査) 제출용. 세션(인증 토큰)·암호화 키·서명 시크릿은 항상 제외(스토어 미보관), PII 카테고리는 [PII] 라벨 + 내보내기 전 경고. 관리자 가드(403/401/415 CSRF)·화이트리스트(세션·미지키 차단)·manifest/README 동봉. /api/ops/export.",
      "CI 상태 표시(ops 서버 탭): GitHub Actions ci.yml(main)의 최신 실행을 통과/실패/진행중으로 표시 + 로그 링크. /actions/runs(전체) 대신 ci.yml 워크플로만 조회(ops-watch cron 실패를 CI 실패로 오인 방지). 서버 120s 캐시·fail-soft(조회 실패는 라벨만)·공개 repo 무인증 또는 LANSMARK_GITHUB_TOKEN. /api/ops/ci.",
      "검증: tsc·vitest 581(+10: 내보내기·zip 라운드트립·CI 파싱/캐시/fail-soft)·arch 38기능·62엔드포인트. 로컬 E2E: 내보내기 zip을 OS unzip으로 유효 확인(manifest·README·카테고리 json) + 세션 화이트리스트 차단 + CI 게이팅. ci.yml(기존)은 push/PR마다 tsc·vitest·arch·가드레일 그린 게이트.",
    ],
  },
  {
    version: "0.75.0",
    date: "2026-06-15",
    title: "백업·복구 시스템 + ops '🛟 백업/복구' 탭(복구버튼) — blob 스냅샷(같은-DB) · Layer2(PITR)는 별도",
    items: [
      "백업/복구 추가(blob 계층 스냅샷): 각 스토어의 영속 blob(lm_state 문서/.data 파일, 키 있으면 ENC1 암호문)을 불투명 바이트로 그대로 복사 → 별도 위치(같은 DB lm_backups / .data/backups) 보관·목록·복구. 복호·재암호 0(키 불필요·PII 비노출·라운드트립 자명). 같은 모드만 복구(meta.storeMode).",
      "복구 안전(비가역): 관리자 가드(blockedOpsMutation: prod토큰403·adminOk401·JSON415=CSRF) + 클라 'RESTORE' 타이핑 + 서버 confirm 이중 + 복구 전 현재 상태 자동 스냅샷(pre-restore=2단 되돌리기) + snapshot id 경로주입 방어. 복구 후 in-memory 스테일은 인스턴스 재시작으로 반영(in-process 리로드 race 회피).",
      "ops 콘솔 '🛟 백업/복구' 탭 — 상태(마지막·스냅샷 수·대상 키)·'지금 백업'·스냅샷별 '복구'(타이핑 확인) + 정직 라벨('같은-DB는 재해복구 아님 — 진짜 DR=Layer2 PITR+스케줄'). /api/ops/backup·/status·/restore.",
      "정직성: 같은-DB 스냅샷은 운영 실수·논리 손상 복구용(프로젝트/DB 전체 손실은 보호 안 함). 진짜 DR(GCP 관리형 PITR 7일+일일 스케줄 백업·gcloud)은 Layer2로 분리(HUMAN GATE·승인 후 실행). 검증: tsc·vitest(+18 backup)·arch(기능 38·엔드포인트 60).",
    ],
  },
  {
    version: "0.74.6",
    date: "2026-06-15",
    title: "모바일 바텀시트 손가락 드래그 — 끌어서 작게/중간/전체 + 손 뗀 위치 가까운 단 스냅",
    items: [
      "바텀시트 핸들을 손가락으로 끌면 시트가 따라오고(translateY 추적), 손을 떼면 가장 가까운 단(작게/중간/전체)으로 스냅. 기존 탭=순환 유지(거의 안 움직이면 탭으로 간주). 드래그 중 페이지 스크롤 차단(touchmove preventDefault), 전환 끄고 추적→손 떼면 전환 켜고 애니메이션.",
      "터치↔클릭 중복 방지: touchend가 처리하면 뒤따르는 합성 click 1회 무시. 데스크톱 무영향(핸들은 ≤600px에서만 표시).",
      "프런트 단일파일 — 인라인 JS 구문 OK·tsc/vitest 무관·arch 0. 0.74.5의 '드래그 제스처는 후속(②)' 이행.",
    ],
  },
  {
    version: "0.74.5",
    date: "2026-06-14",
    title: "모바일 바텀시트 3단 스냅(작게/중간/전체) + 지도 증발 방지 + 값넣기 토글",
    items: [
      "모바일 라이브 피드백: 바텀시트가 2단(작게 134px↔전체 86vh)뿐이라 ① 땅 탭 시 자동 전체펼침→지도 완전 증발 ② 중간 단계 없음. → 3단 스냅(작게/중간/전체): 핸들 탭=순환, 땅 탭=중간(전체 아님)→지도 유지, 전체에서도 지도 14vh 슬리버 남김(완전 증발 방지).",
      "값넣기 가시성: 소득 아래 편집 패널(면적·토양·판로 직접 입력)에 '📝 내 값으로 조정 — 직접 입력하면 더 정확' 헤더 추가(묻혀 안 띄던 것 승격).",
      "데스크톱 무영향(≤600px 모바일만). 프런트 단일파일 — 인라인 JS 구문 OK·서빙 검증·arch 0. 드래그 제스처는 후속(②).",
    ],
  },
  {
    version: "0.74.4",
    date: "2026-06-14",
    title: "ops 추가기능 로드맵(스펙·프롬프트 보관) + 생육단계 가이드 스펙(미구현)",
    items: [
      "ops 콘솔에 '🗺 로드맵' 탭 — 미구현 기능 스펙을 '프롬프트' 형태로 보관. 제목 클릭 시 팝업으로 전체 스펙 표시(복사 가능). 나중에 그 프롬프트만 주면 바로 구현. 첫 항목='작물 생육단계 타임라인 + 병해 비교 가이드'.",
      "생육단계 가이드 준비(기능 미구현·스펙만): 일회성→매일 동반자 전환(리텐션+해자). 형식=바차트 아닌 타임라인/스테퍼(현재단계 강조+단계별 실사진)+수확 진행바+병해 정상/초기/진행 사진 스트립. 정직성 크럭스=실사진(농진청·농사로·NCPMS)만, AI생성/스톡 금지·AI진단 금지. 데이터 출처·라이선스=HUMAN GATE.",
      "프런트 단일파일(ops) — 인라인 JS 구문 OK·서빙 검증. tsc·vitest 무관·arch 0.",
    ],
  },
];

export const APP_VERSION = RELEASES[0].version;
