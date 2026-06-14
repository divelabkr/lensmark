/**
 * ════════════════════════════════════════════════════════════════════
 *  LANSMARK 기능 흐름 아키텍처 — 단일 출처(SSOT)
 * ════════════════════════════════════════════════════════════════════
 *  ⚠ 지시·코딩 시작 전 이 지도를 먼저 본다. 새 기능/엔드포인트/파일은 여기 등록.
 *  `npm run arch` 가 이 지도를 실제 코드와 대조해 어긋나면 실패한다(드리프트 방지).
 *  `npm run arch:render` 가 ARCHITECTURE.md(Mermaid 흐름도)를 이 지도에서 자동 생성한다.
 *
 *  규칙:
 *   - 새 /api 엔드포인트를 추가하면 → 해당 feature.endpoints 에 등록(아니면 arch 실패).
 *   - 새 구현 파일을 추가하면 → 해당 feature.files 에 등록(아니면 orphan 경고).
 *   - 새 기능은 새 Feature 로(거대 기능에 욱여넣지 않기 · CLAUDE.md #6).
 */

// assess = 의사결정 '더 앞'(귀농 자가진단 깔때기). act = 결정 '다음 1마일'(판로·자금 신청 연결). operate = 심은 뒤 영농 동반.
export type Stage = "assess" | "land" | "recommend" | "pay" | "simulate" | "growth" | "operate" | "act" | "feedback" | "ops" | "platform";

export interface Feature {
  id: string;
  name: string;
  stage: Stage;
  flow: string;                 // 한 줄 흐름
  endpoints: string[];          // "/api/..." (라우트에 박힌 경로와 일치해야 함)
  files: string[];              // 구현 파일(repo 상대경로)
  tests: string[];              // 커버 테스트
  guardrails: string[];         // 적용 가드레일(CLAUDE.md)
  status: "live" | "mock" | "seam" | "platform";
  notes?: string;
}

/** 제품 흐름 백본(Mermaid 메인 체인). */
export const PRODUCT_FLOW: { stage: Stage; label: string }[] = [
  { stage: "assess", label: "귀농 자가진단(앞단 깔때기)" },
  { stage: "land", label: "땅 선택·토지유형" },
  { stage: "recommend", label: "무료 작물추천·전환" },
  { stage: "pay", label: "결제·유료권한" },
  { stage: "simulate", label: "정밀 소득·예산·온난화" },
  { stage: "growth", label: "생육·출하" },
  { stage: "operate", label: "재배 운영·동반(기록·모니터링·알람·출하)" },
  { stage: "act", label: "행동 연결(판로·자금·종자)" },
  { stage: "feedback", label: "실측 보정(해자)" },
];

/** 레거시/공유 — 어느 기능에도 안 묶여도 orphan 경고에서 제외. */
export const EXCLUDED = {
  legacy: [ // ⚠ 새 로직 금지(CLAUDE.md)
    "src/lansmark/core/simulator.ts", "src/lansmark/core/yield.ts", "src/lansmark/core/cost.ts",
    "src/lansmark/core/revenue.ts", "src/lansmark/core/income.ts",
  ],
  shared: [ // 타입·공유 유틸(특정 기능 소속 아님)
    "src/lansmark/types.ts", "src/lansmark/geo/types.ts", "src/lansmark/data/providers/types.ts",
    "src/lansmark/config.ts", "src/lansmark/client.ts", "src/lansmark/core/geo.ts",
    "src/lansmark/core/enrich.ts", "src/lansmark/core/planting.ts", "src/lansmark/core/report.ts",
    "src/lansmark/policy/disclaimer.ts", "src/lansmark/policy/soilPolicy.ts",
    "src/lansmark/data/cropPests.seed.ts", "server/context.ts",
    "src/lansmark/api/_rateLimit.ts", // ⚠ 미사용(Next.js 예시 전용) · 실서버는 security.ts 사용
  ],
};

export const FEATURES: Feature[] = [
  {
    id: "map-atlas", name: "지도·필지 선택", stage: "land",
    flow: "지도 탭/주소검색 → 줌단계(전국/시군/필지) → 핀·필지 선택 → 실엔진 조회",
    endpoints: ["/api/config", "/api/geocode", "/api/parcel", "/api/terrain"],
    files: ["dashboard/lansmark_app.html", "server/routes/geo.ts", "server/routes/meta.ts",
      "src/lansmark/geo/vworld.ts", "src/lansmark/geo/crs.ts", "src/lansmark/geo/dem.ts", "src/lansmark/geo/terrainFromDem.ts"],
    tests: ["src/lansmark/tests/geo.spec.ts", "src/lansmark/tests/geoCrs.spec.ts", "src/lansmark/tests/vworld.spec.ts", "src/lansmark/tests/terrainFromDem.spec.ts"],
    guardrails: [], status: "live", notes: "geocode/parcel/타일 live · DEM(terrain) seam",
  },
  {
    id: "land-class", name: "토지유형 분류(강·바다·도시·농경지)", stage: "land",
    flow: "좌표 → 분류(group/action) → 차단(수면)·경고(도시)·재확인(기존농경지)",
    endpoints: ["/api/landclass"],
    files: ["src/lansmark/geo/landClass.ts", "server/routes/geo.ts"],
    tests: ["src/lansmark/tests/landClass.spec.ts"],
    guardrails: ["수면 경작 차단"], status: "mock", notes: "live=VWorld 지목→classifyJimok seam",
  },
  {
    id: "region-discover", name: "작물→지역 추천(기후 적합)", stage: "recommend",
    flow: "작물 선택 → 추천 지형조건(요구조건) + 시도별 기후 적합(적합/주의/부적합) · 시도 중심좌표(지도 마커 다음)",
    endpoints: ["/api/region-fit"],
    files: ["src/lansmark/region/cropRegionFit.ts", "server/routes/regionFit.ts", "src/lansmark/data/sidoClimate.seed.ts"],
    tests: ["src/lansmark/tests/cropRegionFit.spec.ts"],
    guardrails: ["추측 금지(평년값 근사·검수필요)", "시도 광역≠필지 적합 명시", "수익보장 금지", "면책"], status: "live",
    notes: "역방향 탐색(작물→어디서). 시도 평년기후(근사·KMA 평년 seam) × field-monitor 로직 재사용 · 무료 · 시도 중심좌표 포함(지도 마커 다음 단계) · 온난화 시나리오(year/path/dt → ΔT)로 현재↔미래 적합 이동 제공(KMA SSP 근사·외삽·미검증) · ⚠ 전국 고해상 적합 히트맵은 비구현(전국 기후·지형 그리드 필요)",
  },
  {
    id: "recommend-free", name: "무료 작물추천", stage: "recommend",
    flow: "필지 → 적합도 상대점수 작물후보(무료·매입추천 아님) + 전체 작물 카탈로그(추천 밖 작물 직접 선택)",
    endpoints: ["/api/recommend", "/api/crops", "/api/retail-price"],
    files: ["src/lansmark/core/cropSuitability.ts", "src/lansmark/core/validate.ts", "src/lansmark/crops/catalog.ts", "server/routes/analysis.ts", "server/routes/crops.ts", "src/lansmark/data/crops.seed.ts"],
    tests: ["src/lansmark/tests/validate.spec.ts", "src/lansmark/tests/soilPolicy.spec.ts", "src/lansmark/tests/cropsCatalog.spec.ts", "src/lansmark/tests/retailRoutes.spec.ts"],
    guardrails: ["매입추천 금지", "적합도 상대점수만", "면책"], status: "live",
  },
  {
    id: "paywall-entitlement", name: "결제·유료권한", stage: "pay",
    flow: "결제(Toss/PayPal/데모) → 서버권위 금액검증 → HMAC 엔티틀먼트(jti·quota·exp) → 정밀분석 잠금해제",
    endpoints: ["/api/pay/mock", "/api/pay/confirm", "/api/pg/webhook", "/api/pay/paypal/create", "/api/pay/paypal/capture", "/api/pg/paypal/webhook"],
    files: ["src/lansmark/policy/entitlement.ts", "src/lansmark/payment/confirm.ts", "src/lansmark/payment/pgWebhook.ts", "src/lansmark/payment/paypal.ts", "src/lansmark/payment/pgRegistry.ts", "server/paidAccess.ts", "server/routes/payment.ts"],
    tests: ["src/lansmark/tests/entitlement.spec.ts", "src/lansmark/tests/pgPayment.spec.ts", "src/lansmark/tests/redteamFixes.spec.ts", "src/lansmark/tests/pgRegistry.spec.ts", "src/lansmark/tests/paypalPayment.spec.ts"],
    guardrails: ["서버권위 검증(fail-closed)", "금액 서버검증", "토큰 quota·실효", "PG 키 미완비=fail-closed"], status: "live", notes: "PG 2종 스위칭: Toss(confirm+webhook 실구현) · PayPal(REST v2 orders·fail-closed·키 HUMAN GATE) · 활성 전환은 ops PG 스위칭(키 완비 PG만). 데모(mock)는 키 전무·비운영 한정",
  },
  {
    id: "precise-sim", name: "정밀 소득 시뮬(P10/50/90)", stage: "simulate",
    flow: "유료게이트 → 입력검증 → 보정조회 → 엔진(P10/50/90·6축·손익분기·신뢰도·면책)",
    endpoints: ["/api/simulate"],
    files: ["src/lansmark/core/parcelSimulator.ts", "src/lansmark/core/factors.ts", "src/lansmark/core/terrain.ts",
      "src/lansmark/core/satellite.ts", "src/lansmark/core/uncertainty.ts", "src/lansmark/data/rdaIncome.ts", "src/lansmark/data/rdaRealLoader.ts", "src/lansmark/data/rdaIncome.real.ts", "src/lansmark/api/parcelRequest.ts"],
    tests: ["src/lansmark/tests/parcelEngine.spec.ts", "src/lansmark/tests/engineInputs.spec.ts", "src/lansmark/tests/uncertainty.spec.ts", "src/lansmark/tests/parcelRequest.spec.ts", "src/lansmark/tests/report.spec.ts", "src/lansmark/tests/rdaReal.spec.ts"],
    guardrails: ["P10·P50·P90 필수", "단일값 금지", "토양검정 게이팅", "base 출처·연도", "수익보장 금지", "면책", "온난화=KMA SSP 근사·외삽 면책", "실자료 폭 유도 시 '(폭 추정)' 정직 병기"], status: "live",
    notes: "⚠ 파이프라인 live · 소득 base=RDA 데모(verified:false) — **실자료 파이프라인 사전 구축 완료**: 농진청 소득조사 CSV → `npm run rda:build <csv>` → rdaIncome.real.ts 재생성 → getRdaBase 실값 우선(verified:true·연도·출처 표기). 자료 수령=HUMAN GATE · 가격=KAMIS(apple만 검증) · 지구온난화 ΔT(climateScenario): 시설 냉난방·냉량성 고온페널티 반영(데모·외삽) · heatTolerance 정밀화는 seam",
  },
  {
    id: "budget-cashflow", name: "예산·정착비용·현금흐름 계획기", stage: "simulate",
    flow: "초기투자(시설·관수 시드±override)+융자(원리금균등)+보조 → 다년 현금흐름(3시나리오 P10/50/90)·회수기간(payback)·ROI·손익분기 · 무료=단년 회수 미리보기/유료=다년 정밀",
    endpoints: ["/api/budget"],
    files: ["src/lansmark/budget/cashflowPlan.ts", "src/lansmark/budget/types.ts", "src/lansmark/data/facilityCost.seed.ts", "server/routes/budget.ts"],
    tests: ["src/lansmark/tests/cashflowPlan.spec.ts", "src/lansmark/tests/facilityCostSeed.spec.ts", "src/lansmark/tests/budgetRoutes.spec.ts"],
    guardrails: ["P10·P50·P90 필수", "단일값 금지", "수익·회수 보장 금지", "시설비·금리·보조금 실견적/금융기관/공식공고 확인 면책", "capex 기본값 verified:false", "추측 금지(IRR/NPV 미제공)", "무료 teaser/유료 full", "엔티틀먼트 게이트(유료 경로)", "입력 클램프"], status: "live",
    notes: "parcelSimulator 미수정(incomeKrw/costKrw 주입 wrap · 유료 로직은 정밀엔진에만) · 다년 percentile=일관 시나리오 경로(분포 합성 아님 — 비관=저소득+고비용) · 시설 capex 시드=2025 시장조사 참고치(verified:false·평당 환산) · 융자/보조 금액·금리 단정 안 함→support.seed(nh_fund/smartfarm/young_farmer) 링크 · ⚠ 시설 소득팩터·IoT 환경제어는 범위 밖(seam)",
  },
  {
    // 횡단 기후변화 가정 — region-fit(무료)·precise-sim(유료)이 공유하는 순수 프리미티브를 독립 기능으로 노출(흩어짐 방지·가시성).
    id: "climate-scenario", name: "지구온난화 시나리오(기후변화 가정)", stage: "simulate",
    flow: "연도·배출경로(SSP) 또는 직접 ΔT → 온난화 폭 ΔT(℃) 산출 → 평년 기후에 적용(겨울최저↑·서리 완화) → 추천(무료: 현재↔미래 적합 이동)·정밀시뮬(유료: 시설 냉난방·고온 페널티) 공통 구동",
    endpoints: [],
    files: ["src/lansmark/core/climateScenario.ts"],
    tests: ["src/lansmark/tests/climateScenario.spec.ts"],
    guardrails: ["추측 금지(KMA SSP 근사·verified:false)", "외삽·선형 단순화 면책(실제 비선형·지역차 큼)", "ΔT 상한 클램프[0,6℃](과신 차단)", "겨울최저·여름최고 +ΔT·연강수 평균 소폭↑(verified:false) — 강수 변동성·일조만 미반영", "수익·재배성공 보장 금지", "면책"], status: "live",
    notes: "순수·결정적 프리미티브(warmingDeltaC/applyWarming) — region-discover(무료 현재↔미래 적합)·precise-sim(유료 미래 소득·시설비) 공유 횡단 가정. 온난화율=기상청 「한반도 기후변화 전망보고서」 SSP 근사(demo·verified:false·외삽·선형) · 적용: 겨울최저·여름최고 +ΔT(고온 스트레스)·연강수 평균 소폭↑(℃당~+1.5%·상한+12%)·서리 완화 — 강수 '변동성'(집중호우·가뭄)·일조는 결정적 미반영(리스크노트) · ⚠ KMA 격자 연동 시 비선형·지역차 정밀화(seam)",
  },
  {
    id: "growth-harvest", name: "생육·출하 타임라인", stage: "growth",
    flow: "작물 → 파종·생육·개화·수확(12개월) + 출하 적기 + 생육 리스크(기상·병해충)",
    endpoints: ["/api/simulate"],
    files: ["src/lansmark/core/calendar.ts", "src/lansmark/core/growthRisk.ts", "src/lansmark/data/cropCalendar.seed.ts"],
    tests: ["src/lansmark/tests/calendar.spec.ts", "src/lansmark/tests/pests.spec.ts", "src/lansmark/tests/growthWiring.spec.ts"],
    guardrails: [], status: "live", notes: "canonical /api/simulate 응답에 growth로 합쳐 노출",
  },

  /* ───────────────────────────────────────────────────────────────────
   *  🌱 영농 동반 비전(v0.9 로드맵) — "한 번 쓰는 계산기 → 심고~수확까지 매일 쓰는 비서"
   *  심은 뒤 단계(operate)를 신설: 재배기록·모니터링·알람·출하. status=seam(아직 미구현,
   *  endpoints/files 비움 → arch 그린 유지). 각 notes = 데이터 소스·필요 인프라·HUMAN GATE.
   *  ⚠ 흩어짐 방지: 한 번에 다 만들지 않고 한 슬라이스씩(우선 cultivation-journal부터) 승격한다.
   * ─────────────────────────────────────────────────────────────────── */
  {
    id: "cultivation-journal", name: "재배 기록·시즌 리포트", stage: "operate",
    flow: "재배 시작(시뮬 예측 결속) → 작업·수확 기록 → 시즌 리포트(투입·수확·수익·예측대비) · 수확→플라이휠 승격(해자)",
    endpoints: ["/api/journal", "/api/journal/event", "/api/journal/harvest", "/api/journal/report", "/api/journal/delete"],
    files: ["src/lansmark/journal/types.ts", "src/lansmark/journal/report.ts", "src/lansmark/journal/journalStore.ts", "server/routes/journal.ts"],
    tests: ["src/lansmark/tests/journalReport.spec.ts", "src/lansmark/tests/journalRoutes.spec.ts"],
    guardrails: ["엔티틀먼트 게이트", "소유권 격리(404)", "입력 클램프(변조/DoS)", "수확 1회만 플라이휠(중복방지)", "삭제권(본인 일지 즉시 파기·PIPA)", "수익보장 금지", "면책"], status: "live",
    notes: "영농 동반 1번 슬라이스(buildable-now) · FileJournalStore(재시작 보존) · 수확 실측이 해자 데이터로 자동 환류(actualCost는 부분원가라 미전송) · FileJournalStore는 persistence(db/stores.ts) 소속",
  },
  {
    id: "cultivation-guide", name: "재배 가이드·품종 선택", stage: "growth",
    flow: "작물 → 품종 후보 + 재배 환경 요구조건(pH·배수·물·일조·내한·서리·경사) + 재배 적기·리스크 · 무료=대표작물/유료=전체",
    endpoints: ["/api/guide", "/api/foreign"],
    files: ["src/lansmark/guide/cultivationGuide.ts", "server/routes/guide.ts", "src/lansmark/foreign/foreignCrop.ts", "server/routes/foreign.ts", "src/lansmark/integrations/perplexity.ts"],
    tests: ["src/lansmark/tests/cultivationGuide.spec.ts", "src/lansmark/tests/guideRoutes.spec.ts", "src/lansmark/tests/foreignCrop.spec.ts", "src/lansmark/tests/foreignRoutes.spec.ts", "src/lansmark/tests/perplexity.spec.ts", "src/lansmark/tests/coreCropGate.spec.ts"],
    guardrails: ["추측 금지(실응답 검증·룰북·seam)", "수익보장 금지", "면책", "무료=대표작물/유료=전체·외래는 유료", "AI 요약=외래 한정·정량 금지·출처 동반·보장 아님"], status: "live",
    notes: "Phase A(국내): 룰북 품종·요구조건·캘린더 + **농사로 e-book 링크아웃**(cropEbook 라이브 실증 결과 구조화 데이터가 아닌 전자책 파일 반환 → 심층연동 대신 농진청 공개 포털로 외부 링크가 정직·저비용) · 무료 STAPLE_FREE/유료 전체. Phase B(외래·임의 착수): /api/foreign = GBIF 분류 + 위키백과(ko) 설명 실연동(키 불필요·유료·⚠소득시뮬 비활성) · 기후적합성 매칭 · **Perplexity Sonar AI 재배요약 live**(perplexity.ts: 외래작물 한정·정량수치 프롬프트 차단·citations 동반·하드라벨 '검증필요/보장아님'·24h 캐시·키없으면 null 무중단) · Trefle/Perenual·OpenFarm은 추가 seam · 벼·보리 시드 미수록(후속)",
  },
  {
    id: "support-programs", name: "지원금·지자체·농협 혜택", stage: "recommend",
    flow: "지역·작물 → 대표 지원 제도(정부/지자체/농협) 안내 + 공식 확인 경로 + 작물 관련도",
    endpoints: ["/api/support"],
    files: ["src/lansmark/support/supportPrograms.ts", "server/routes/support.ts", "src/lansmark/data/support.seed.ts"],
    tests: ["src/lansmark/tests/supportPrograms.spec.ts", "src/lansmark/tests/supportRoutes.spec.ts"],
    guardrails: ["추측 금지(금액·자격 단정 금지)", "최신성 보장 안 함·공식확인 안내", "면책"], status: "live",
    notes: "Phase A: 대표 제도 큐레이션(공개 사실)+공식 확인 경로 · 무료 · ⚠ 공공데이터포털 농림사업·지자체 보조·농협 혜택 실시간 큐레이션은 Phase B seam(데이터 운영=HUMAN GATE)",
  },
  {
    id: "field-monitor", name: "일일 환경 모니터링·시각화", stage: "operate",
    flow: "필지 좌표·작물 → 기후(강수·겨울최저·일조·서리) vs 작물 요구 적합 점검(ok/주의/위험)",
    endpoints: ["/api/monitor"],
    files: ["src/lansmark/monitor/fieldMonitor.ts", "server/routes/monitor.ts", "src/lansmark/data/cropClimateTraits.ts"],
    tests: ["src/lansmark/tests/fieldMonitor.spec.ts", "src/lansmark/tests/monitorRoutes.spec.ts"],
    guardrails: ["live↔mock 동일 타입", "연/계절 요약 명시(일일 아님)", "면책"], status: "live",
    notes: "Phase A: KMA 기후 요약 vs 작물 요구조건 적합 점검 · 무료·sensitive RL · ⚠ 일일 실측·필지별 시계열·자동 알림(인앱/푸시)은 Phase B seam(수집 cron+인프라)",
  },
  {
    id: "agri-alerts", name: "병충해·재난 알람", stage: "operate",
    flow: "작물·월 → 병해충(룰북)+기상/재해(계절 농학) 주의 + 현재월 매칭 · region 주면 KMA 실시간 기상특보 합류(live)",
    endpoints: ["/api/alerts"],
    files: ["src/lansmark/alerts/agriAlerts.ts", "server/routes/alerts.ts", "src/lansmark/integrations/kmaWarning.ts", "src/lansmark/integrations/ncpms.ts"],
    tests: ["src/lansmark/tests/agriAlerts.spec.ts", "src/lansmark/tests/alertsRoutes.spec.ts", "src/lansmark/tests/kmaWarning.spec.ts"],
    guardrails: ["추측 금지(룰북·특보 값 패스스루)", "예보 단정 금지(참고)", "면책", "무료(안전정보)"], status: "live",
    notes: "작물·월 병해충(cropPests.seed)+기상/재해(룰북) · **KMA 기상특보 live**(kmaWarning: EUC-KR·typ01·60초 캐시·키없으면 []) · **NCPMS 주요 병해충 live**(ncpms SVC01 작물명 검색→JSON 이름 칩·중복제거·작물명 미매칭 시 [] 무중단·이미지는 http라 제외) · 푸시는 Phase B",
  },
  {
    id: "alert-subscribe", name: "알림 구독(opt-in 핸드폰)", stage: "operate",
    flow: "자체 팝업(동의+휴대폰 번호) → 동의·번호 저장(PII) → (발송은 SMS 제공자 seam). VAPID 웹푸시 대체.",
    endpoints: ["/api/alerts/subscribe", "/api/alerts/unsubscribe"],
    files: ["src/lansmark/notify/alertSubscription.ts", "src/lansmark/notify/subscriptionStore.ts", "src/lansmark/notify/smsSender.ts", "server/routes/notify.ts"],
    tests: ["src/lansmark/tests/notifySubscription.spec.ts"],
    guardrails: ["동의 필수(consent=true만 저장)", "번호 형식검증", "PII 로그·응답 마스킹(원번호 비노출)", "민감 RL(번호 수확 차단)", "발송 미전송→정직 안내", "해지(동의철회) 제공"],
    status: "live",
    notes: "저장만 live · 실제 SMS 발송은 smsSender seam(한국 SMS 게이트웨이 키=HUMAN GATE) · FileSubscriptionStore=persistence(db/stores) 소속 · ⚠ PII at-rest 암호화는 운영 hardening seam · 무과금 채널은 web-push로 승격(사용자 선택: SMS 과금 회피)",
  },
  {
    id: "web-push", name: "웹푸시 알림(앱 푸시·SMS 대체)", stage: "operate",
    flow: "알림 모달 '브라우저 알림 받기' → /api/push/vapid(configured?) → 권한 요청 → SW pushManager.subscribe → /api/push/subscribe(구독 저장). 발송 시 SW push 이벤트가 알림 표시·클릭 시 앱 포커스.",
    endpoints: ["/api/push/vapid", "/api/push/subscribe", "/api/push/unsubscribe"],
    files: ["server/routes/push.ts"], // 발신자·구독 스토어 seam은 integrations/push.ts(통합층 소속), SW는 dashboard/sw.js(단일파일)
    tests: ["src/lansmark/tests/pushRoutes.spec.ts"],
    guardrails: ["opt-in(브라우저 권한 명시 동의)", "VAPID 미설정→구독 시도 안 함·'준비 중' 정직 안내", "구독 endpoint/키 로그·응답 비노출(PII)", "구독 DoS 상한(cap)", "발송 미구현→ConsolePushSender ok:false(거짓 성공 금지)"],
    status: "live",
    notes: "구독 저장 + SW 표시/클릭 다리 live · 실제 발송(LiveWebPushSender: VAPID JWT ES256 + aes128gcm)·VAPID 키 생성=HUMAN GATE(integrations/push.ts) · 구독 영속(File store)=follow-up · SMS(alert-subscribe) 대신 무과금 앱 푸시 채널(사용자 선택)",
  },
  {
    id: "harvest-market", name: "출하 시세·납품처 최적화", stage: "operate",
    flow: "작물 → KAMIS 실도매가 앵커 + 판로별(도매/직거래/혼합/가공/체험) 기대 단가·도매 대비% 비교 → 최적 납품처",
    endpoints: ["/api/market"],
    files: ["src/lansmark/market/salesChannels.ts", "server/routes/market.ts"],
    tests: ["src/lansmark/tests/salesChannels.spec.ts", "src/lansmark/tests/marketRoutes.spec.ts"],
    guardrails: ["추측 금지(KAMIS 공식)", "수익보장 금지", "면책", "무료 훅·sensitive RL"], status: "live",
    notes: "판로 '비율'=룰북(데모) + 도매 '실시세'=KAMIS live 앵커로 레벨링 · 무료(가입훅) · KAMIS 미검증 품목은 seed 폴백 · ⚠ 시장별·등급별 세분화는 seam(KAMIS kind/rank 파라미터 검증 후)",
  },

  {
    id: "flywheel", name: "실측 보정 플라이휠(해자)", stage: "feedback",
    flow: "실측 제출(유료게이트) → 작물·지형버킷 보정 → 다음 예측 현실화 → validated(서로 다른 제출자 5↑)",
    endpoints: ["/api/feedback"],
    files: ["src/lansmark/core/feedbackStore.ts", "src/lansmark/core/calibrate.ts", "src/lansmark/core/calibration.ts", "src/lansmark/core/consolidate.ts"],
    tests: ["src/lansmark/tests/calibration.spec.ts", "src/lansmark/tests/consolidate.spec.ts", "src/lansmark/tests/terrainBucket.spec.ts", "src/lansmark/tests/cost.spec.ts"],
    guardrails: ["엔티틀먼트 게이트", "validated=서로 다른 제출자 수", "입력 클램프(변조 방지)"], status: "live",
    notes: "★ B2C→B2B 다리: B2C 사용(일지 수확·실측 제출)이 작물·지역버킷 보정을 쌓아 demo를 실측으로 대체 → validated 누적이 곧 B2B(객관 근거 판매)의 전환 게이트. B2C 단계의 '실측 제출 인센티브'가 해자·B2B의 연료.",
  },

  /* ───────────────────────────────────────────────────────────────────
   *  🧭 확장 흐름(로드맵 seam) — 의사결정 '앞단(자가진단)·재결정(전환)·뒷단(행동 연결)·B2B'.
   *    "결정에서 끝나지 않고 행동·재방문·반복수익으로" — 가치 휘발/저빈도 약점 보완.
   *    status=seam(미구현) · endpoints/files 비움 → arch 그린 유지. 각 notes=데이터·제휴=HUMAN GATE.
   * ─────────────────────────────────────────────────────────────────── */
  {
    id: "returnfarm-assess", name: "귀농 자가진단(자금·동기·경험·가족·농지)", stage: "assess",
    flow: "자가응답(자금·생활비버퍼·동기·경험·가족동의·농지) → 준비도 점수·축별 상태·보완 액션(룰) → 무료 작물추천으로 연결(가장 앞단 무료 깔때기)",
    endpoints: ["/api/assess"],
    files: ["src/lansmark/assess/returnFarmAssess.ts", "server/routes/assess.ts"],
    tests: ["src/lansmark/tests/returnFarmAssess.spec.ts"],
    guardrails: ["자가진단=참고(가부·성공 단정·보장 금지)", "보완 항목 제시('금지' 아님)", "가중치 데모", "면책"], status: "live",
    notes: "B2C Phase1 무료 깔때기(유입 시작점). 자금·생활비 버퍼 최대 가중(귀농 실패 1위=자금·KREI). 입력=자가응답(추측 이슈 없음). live-upgrade=귀농귀촌종합센터 통계로 임계 보정(seam).",
  },
  {
    id: "crop-transition", name: "작물 전환 로드맵(온난화 재결정)", stage: "recommend",
    flow: "현재 작목 + 온난화 시나리오 → '지금 사과 → 2050엔 ○○' 전환 후보·시기 → 재방문/재결정 트리거(저빈도 보완)",
    endpoints: [], files: [], tests: [],
    guardrails: ["외삽·미검증 면책", "수익보장 금지"], status: "seam",
    notes: "climate-scenario(온난화) 재사용 확장 — 차별점(경쟁앱 부재)·B2B/지자체 정책·PR 무기. 미래 유망작물=region-fit 역탐색 × 온난화 격자(seam).",
  },
  {
    id: "sales-connect", name: "판로·계약 연결(직거래·수매·계약재배)", stage: "act",
    flow: "출하 시세 비교(harvest-market) 다음 1마일 → 실제 판로(공공 온라인도매·로컬푸드·계약재배·직거래) 연결·중개",
    endpoints: [], files: [], tests: [],
    guardrails: ["거래 보장 금지", "수수료·중개 투명", "면책"], status: "seam",
    notes: "⚠ 결정→행동 가치 휘발 보완 + 중개 수익 기회. live=aT 온라인도매·로컬푸드·계약재배 제휴(데이터 운영·제휴=HUMAN GATE).",
  },
  {
    id: "finance-connect", name: "자금·정책자금 연결(매칭·자격판정·신청)", stage: "act",
    flow: "예산·회수(budget) 다음 1마일 → 정책자금·농협 대출 매칭 + 보조 자격 자동판정 + 신청 경로(귀농 실패 1위=자금)",
    endpoints: [], files: [], tests: [],
    guardrails: ["지원 보장·자격 단정 금지(공식확인)", "금리·한도 단정 금지", "면책"], status: "seam",
    notes: "support-programs·budget 다음 단계 — 리드/제휴 수익. live=Agrix 농림사업·농협·공공데이터 매칭(데이터 운영=HUMAN GATE).",
  },
  {
    id: "b2b-consulting", name: "B2B 컨설팅 패키지(기관·라이선스)", stage: "ops",
    flow: "농업기술센터·귀농지원센터·컨설턴트가 상담 도구로 사용(객관 근거 P10/50/90·면책) → 기관 라이선스(저빈도·계절성·접근성 우회)",
    endpoints: [], files: [], tests: [],
    guardrails: ["기관 인증·다중계정 관리", "데이터 검증 전제", "면책"], status: "seam",
    notes: "⏱ Phase 2(전략: B2C 먼저 → 데이터 축적 후). 전환 게이트 = 플라이휠 validated(서로 다른 제출자 5↑) 작물·지역버킷이 일정 수 누적 → demo가 실측으로 대체돼 '객관 근거'가 설 때 기관 판매. 개인 저빈도·디지털약자·계절편중을 '기관 반복 사용'으로 우회 — 반복(구독)수익 축. 권위 협력(농진청·지자체) 결합 시 강력.",
  },
  {
    id: "provider-dropin", name: "실연동 provider(드롭인)", stage: "platform",
    flow: "키 있으면 통합별 live, 없으면 mock 폴백(무중단) · 형태가드로 조용한 오염 차단",
    endpoints: [],
    files: ["src/lansmark/data/providers/auto.ts", "src/lansmark/data/providers/live.ts", "src/lansmark/data/providers/mock.ts", "src/lansmark/data/providers/index.ts",
      "src/lansmark/data/providers/runtimeHealth.ts",
      "src/lansmark/geo/kma.ts", "src/lansmark/geo/kamis.ts", "src/lansmark/geo/fetchSafe.ts", "src/lansmark/data/providers/kamisItemCodes.ts"],
    tests: ["src/lansmark/tests/autoProviders.spec.ts", "src/lansmark/tests/runtimeHealth.spec.ts", "src/lansmark/tests/kamis.spec.ts", "src/lansmark/tests/kmaClimate.spec.ts", "src/lansmark/tests/kmaGrid.spec.ts"],
    guardrails: ["추측 금지(공식 docs)", "live↔mock 동일 타입", "런타임 폴백 기록 — 거짓 녹색 차단(키=live 아님)"], status: "live", notes: "geocode/parcel/KMA/KAMIS live · DEM/RDA seam · pick()이 연동별 live/폴백 집계(runtimeHealth) → ops 정직 표시",
  },
  {
    id: "integrations-seam", name: "외부연동 준비(HUMAN GATE)", stage: "platform",
    flow: "키 꽂으면 live·없으면 unconfigured — 특보·예찰·식물정보·지원금·푸시·크론의 URL·키게이트·파서가드(SHAPE_UNVERIFIED) 준비층 · 발급절차=HUMAN_GATE.md",
    endpoints: [],
    files: ["src/lansmark/integrations/types.ts", "src/lansmark/integrations/index.ts",
      "src/lansmark/integrations/ncpms.ts",
      "src/lansmark/integrations/nongsaro.ts",
      "src/lansmark/integrations/plantDetail.ts", "src/lansmark/integrations/publicSupport.ts",
      "src/lansmark/integrations/push.ts", "src/lansmark/integrations/scheduler.ts"],
    tests: ["src/lansmark/tests/integrations.spec.ts"],
    guardrails: ["추측 금지(파서는 실샘플 검증 후)", "키 값 비노출(존재여부만)", "거짓 live 라벨 금지", "미설정→unconfigured 폴백"], status: "seam",
    notes: "준비층(listIntegrations 7종 추적) — 미승격 seam: NCPMS(키)·농사로 국내(키·HTTP실측)·Perenual/Trefle 외래(키·무료=분류뿐)·data.go.kr 지원금(serviceKey)·VAPID 푸시·크론. **KMA 특보는 live 승격(agri-alerts)으로 졸업**(kmaWarning.ts는 agri-alerts 소속). 국립수목원·AI-Hub는 seam 미생성. 실응답 파서는 키 확보 후 한 슬라이스씩 승격(SHAPE_UNVERIFIED 해제) · 발급=HUMAN_GATE.md",
  },
  {
    id: "security", name: "보안 미들웨어", stage: "platform",
    flow: "요청 진입 → 보안헤더·CSP·CORS·레이트리밋(IP 신뢰경계) · 부팅 fail-closed",
    endpoints: [],
    files: ["src/lansmark/api/security.ts", "server/middleware.ts", "server/config.ts", "src/lansmark/api/httpUtil.ts"],
    tests: ["src/lansmark/tests/security.spec.ts", "src/lansmark/tests/httpUtil.spec.ts", "src/lansmark/tests/appSecurity.spec.ts"],
    guardrails: ["CSP·nonce", "레이트리밋", "CORS 허용목록", "fail-closed 부팅", "XFF 신뢰경계"], status: "platform",
  },
  {
    id: "ops-console", name: "운영자 콘솔", stage: "ops",
    flow: "통합 준비도·결제·플라이휠·활동로그 + 관리자 인증 + 토큰 실효(revoke) + 유료 게이트 런타임 토글(무료베타↔유료) + PG 스위칭(Toss↔PayPal)",
    endpoints: ["/api/ops/stats", "/api/ops/revoke", "/api/ops/paid-gate", "/api/ops/pg-preference"],
    files: ["dashboard/lansmark_ops.html", "server/routes/ops.ts", "server/runtimeFlags.ts"],
    tests: ["src/lansmark/tests/serverRoutes.spec.ts", "src/lansmark/tests/opsRoutes.spec.ts"],
    guardrails: ["관리자 인증(timing-safe)", "시크릿 미노출", "운영 무료개방은 ALLOW_OPEN_PAID=1 동의(런타임 우회 차단)"], status: "live",
  },
  {
    id: "demand-analytics", name: "익명 수요·퍼널 계측", stage: "ops",
    flow: "무료 베타 익명 사용자의 수요(시뮬 작물×지역)·퍼널(추천→시뮬→가이드/외래→일지→옵트인)·데이터갭을 서버측 집계(PII 0)로 잡아 /api/ops/stats·운영콘솔에 노출 — '무엇을 얻는가' 가시화(Phase A)",
    endpoints: [],
    files: ["src/lansmark/analytics/types.ts", "src/lansmark/analytics/eventStore.ts"],
    tests: ["src/lansmark/tests/analytics.spec.ts"],
    guardrails: ["집계만(개별 여정 추적 X)", "PII 0", "단계 화이트리스트", "신규키 상한(DoS·메모리)", "익명 신호=위조 가능 → '검증된 사실' 주장 금지"], status: "live",
    notes: "Phase A. 기존 라우트(recommend/simulate/guide/foreign/journal/subscribe) 성공 시점에 집계 호출 — 새 공개 엔드포인트 0(스팸·poison 표면 최소). 지도 탐색·이탈(클라 비콘)은 공개 ingress라 A.2로 분리. 발송 리마인드(slow loop)는 SMS seam·HUMAN GATE.",
  },
  {
    id: "data-quality-gate", name: "데이터 품질 게이트(신뢰 피쉬본)", stage: "ops",
    flow: "운영 녹색과 별개로 '넘기는 데이터가 검증/정직한가'를 차원별 게이트(ok/warn/fail)로 평가 — 기존 신호 집계(integrationReadiness·RDA_REAL_META·flywheel). OPS 종합에 신뢰 피쉬본(머리=등급/verdict·뼈=원인별 색) + 제품 자동 보수(base 미검증이면 앱 '✓검증' 차단·'추정' 강제). /api/ops/stats.quality 노출",
    endpoints: [],
    files: ["src/lansmark/quality/qualityGate.ts"],
    tests: ["src/lansmark/tests/qualityGate.spec.ts"],
    guardrails: ["'에러 없음'이 아니라 '양성 신호'로 채점(조용한 mock/데모=녹색 아님)", "fail-closed(모르면 warn·base 미검증=unverified)", "차원 게이트가 본질·점수는 머리글 등급", "제품 자동 보수=base 미검증이면 ✓검증 차단·추정 강제"], status: "live",
    notes: "v1=린(소스 live↔mock·base 검증·DEM·보정 게이트). 탐지형(통합 live) vs 구조형(RDA 데모·DEM REST 미제공) 구분. 후속: 값-범위 sanity·신선도/스키마 게이트, Tier 1 ops watcher(읽기·진단·호출)가 이 quality를 소비.",
  },
  {
    id: "ops-watcher", name: "Tier 1 ops watcher(읽기·진단)", stage: "ops",
    flow: "읽기 전용 감시자 — /api/ops/stats(품질 게이트·최적화 트리거·스토어 저하·5xx)를 읽어 crit/warn/ok로 롤업 + 평문 진단·권고. 채널 무관(stdout+exit code) → cron·GitHub Action·Claude Code 루틴이 얇게 래핑(슬랙·이메일·푸시). 행동권 0(Tier 2는 신뢰 번 뒤 별도).",
    endpoints: [],
    files: ["src/lansmark/ops/opsWatch.ts"],
    tests: ["src/lansmark/tests/opsWatch.spec.ts"],
    guardrails: ["읽기 전용·행동 0(재시작·토글·삭제 X)", "fail-closed로 알림(모르면 묻어두지 않음)", "임계는 콘솔 트리거와 단일 출처", "조언만 — 행동은 결정적·사람"], status: "live",
    notes: "CLI=scripts/opsWatch.ts(npm run ops:watch · env LANSMARK_BASE·LANSMARK_ADMIN_TOKEN). exit 0=ok/1=findings/2=접근오류. Tier 2(좁은 가역 자동행동·킬스위치)는 신뢰 검증 후·별 슬라이스.",
  },
  {
    id: "client-error-telemetry", name: "클라이언트 에러 텔레메트리 + 실시간 경보", stage: "ops",
    flow: "사용자 브라우저의 uncaught JS 에러/거부를 POST /api/client-error로 수집(이전엔 0=사장님이 못 봄). 집계·디듀프·최근 링버퍼·PII 0·distinct 상한. '새 distinct' 에러만 활동로그 + 웹훅(LANSMARK_ALERT_WEBHOOK · Slack/Discord) 실시간 경보. /api/ops/stats.clientErrors로 콘솔 '서버' 탭 + watch 종합판정에 노출. opsWatch가 distinct≥1 warn·≥5 crit.",
    endpoints: ["/api/client-error"],
    files: ["src/lansmark/ops/clientErrors.ts", "server/routes/telemetry.ts"],
    tests: ["src/lansmark/tests/clientErrors.spec.ts"],
    guardrails: ["PII 0(메시지/소스만·절단)", "sensitive 레이트리밋·바디 상한", "204 반사 0", "새 distinct만 경보(스팸 차단)", "웹훅 URL은 사장님 설정(SSRF 무관)"], status: "live",
    notes: "웹훅 미설정이면 조용히(기록은 됨). 메모리 보관(재시작 휘발 — 텔레메트리엔 충분). 프론트 리포터=dashboard/lansmark_app.html(세션 상한 8·디듀프·keepalive).",
  },
  {
    id: "user-account", name: "계정·세션(가입 + 익명→계정 이관)", stage: "platform",
    flow: "익명(기기)→가입(휴대폰 OTP 또는 이메일 매직링크 병행)→계정(acct:Z)·세션. CompositeVerifier가 method로 라우팅. 로그인 시 일지를 계정 신원으로 귀속, link-anon이 기존 익명 일지를 계정으로 이관(재시작 보존). 이메일 매직링크는 /app?lm_login=challengeId~token 착지→자동 verify. 실발송(SMS/이메일)은 제공자 키=HUMAN GATE(키 있으면 발송·dev는 코드/링크 노출·운영+키없음 fail-closed). 카카오는 같은 인터페이스로 추후 드롭인",
    endpoints: ["/api/account/auth/start", "/api/account/auth/verify", "/api/account/me", "/api/account/logout", "/api/account/link-anon", "/api/account/link-entitlement"],
    files: ["src/lansmark/account/types.ts", "src/lansmark/account/accountStore.ts", "src/lansmark/account/sessionStore.ts", "src/lansmark/account/verifier.ts", "src/lansmark/notify/emailSender.ts", "server/cookies.ts", "server/routes/account.ts"],
    tests: ["src/lansmark/tests/accountRoutes.spec.ts", "src/lansmark/tests/emailMagicLink.spec.ts", "src/lansmark/tests/cookies.spec.ts"],
    guardrails: ["원 식별자(전화/이메일) 미저장(authRef.subjectHash=keyed-hash)", "세션=httpOnly 쿠키(S5·XSS 토큰탈취 방어)+SameSite=Strict(CSRF)+Secure(운영)", "세션 토큰=무작위 192bit·만료", "OTP/이메일·운영+발송키없음 fail-closed(코드/링크 비노출)", "챌린지당 시도 상한(brute-force)·매직링크 256bit 1회용·타이밍세이프 비교", "매직링크 토큰 URL 즉시 제거(잔류 금지)", "auth는 sensitive 레이트리밋", "이관은 로그인 세션 필수"], status: "platform",
    notes: "휴대폰 OTP + 이메일 매직링크 병행(M2) — CompositeVerifier(challengeId 'method:' 프리픽스 라우팅). 세션=httpOnly 쿠키(S5·듀얼모드: 쿠키 우선·x-lansmark-session 헤더 폴백). 실발송은 LiveSmsSender/LiveEmailSender 드롭인(HUMAN GATE: SMS 게이트웨이 키 + 동의화면 위탁 고지 / 이메일 제공자 키 + LANSMARK_APP_ORIGIN). 카카오는 같은 AuthVerifier 인터페이스로 추가. 유료 모드의 결제-계정 연계는 후속.",
  },
  {
    id: "persistence", name: "영속성(memory↔file↔firestore)", stage: "platform",
    flow: "상태(플라이휠·멱등·토큰소진/실효·일지·계정·세션·구독·계측) memory|file|firestore 드롭인. firestore=Cloud Run 재배포 내구(§3-1): 무의존성 REST(메타데이터 토큰)·스토어당 문서 1개(lm_state)·write-through·부팅 warm·로드실패 sealed(덮어쓰기 방지)·감사로그 lm_audit",
    endpoints: [],
    files: ["src/lansmark/db/jsonFile.ts", "src/lansmark/db/atRest.ts", "src/lansmark/db/stores.ts", "src/lansmark/db/repository.ts", "src/lansmark/db/firestoreLite.ts", "src/lansmark/db/firestoreStores.ts"],
    tests: ["src/lansmark/tests/db.spec.ts", "src/lansmark/tests/firestoreStores.spec.ts", "src/lansmark/tests/atRestSecurity.spec.ts"],
    guardrails: ["저장소 상한(DoS 방지)", "firestore 로드실패=sealed(빈 상태로 원격 덮어쓰기 금지)", "유료 게이트 ON + 워밍 실패 = 부팅 중단(fail-closed)", "revoked 영속(부활 방지)", "at-rest AES-256-GCM(file·firestore 동일 키 — DATA_KEY 설정 시) · 세션 토큰 at-rest 해시"], status: "platform",
    notes: "firestore 어댑터=단일 인스턴스 '내구성'용(blob-per-store·1MiB 한도) — 다중 인스턴스 정합(유니크 제약·락)은 per-record 승격 시(§3-1 잔여). 키 파일 불필요(Cloud Run 메타데이터 토큰).",
  },
  {
    id: "versioning", name: "버전·변경점 팝업", stage: "platform",
    flow: "version.ts(SSOT) → /api/version ↔ localStorage 비교 → 신버전 델타 팝업",
    endpoints: ["/api/version", "/api/health"],
    files: ["src/lansmark/version.ts", "server/routes/meta.ts"],
    tests: ["src/lansmark/tests/version.spec.ts"],
    guardrails: ["SSOT(version.ts·package.json·CHANGELOG 동반)"], status: "platform",
  },
  {
    id: "session-io", name: "저장·불러오기·공유·PDF", stage: "platform",
    flow: "스냅샷 JSON 저장/불러오기 · 공유링크(해시) · 인쇄(PDF)",
    endpoints: [],
    files: ["src/lansmark/share.ts", "dashboard/lansmark_app.html"],
    tests: ["src/lansmark/tests/share.spec.ts"],
    guardrails: ["복원 입력 검증(신뢰 안 함)"], status: "platform",
  },
  {
    id: "server-core", name: "서버 오케스트레이션", stage: "platform",
    flow: "설정→부팅점검→컨텍스트→미들웨어→라우터→정적페이지(앱·콘솔·법무) · 의존성 0",
    endpoints: ["/", "/app", "/ops", "/admin", "/terms", "/privacy", "/api/health"],
    files: ["server/devServer.ts", "server/router.ts", "server/respond.ts", "server/routes/pages.ts",
      "dashboard/lansmark_terms.html", "dashboard/lansmark_privacy.html"],
    tests: ["src/lansmark/tests/serverRoutes.spec.ts"],
    guardrails: ["일반화 에러(정보유출 방지)", "법무 페이지는 초안(법무검토 전 적용 금지)"], status: "platform",
    notes: "정적 페이지 서빙(nonce 주입). /terms·/privacy=무료 베타 공개·PII 수집 게이트(초안·법무검토 필요·실수집 관행 반영)",
  },
  {
    id: "pwa-shell", name: "PWA(설치형 모바일 앱)", stage: "platform",
    flow: "manifest·서비스워커·아이콘으로 LENSMARK를 설치형 앱화(홈화면 설치·오프라인 쉘). 웹푸시 알람의 토대. 서빙은 pages.ts",
    endpoints: ["/manifest.webmanifest", "/sw.js", "/icon.svg"],
    files: ["dashboard/manifest.webmanifest", "dashboard/sw.js", "dashboard/icon.svg"],
    tests: [],
    guardrails: ["SW는 /api 캐시 금지(동적)", "SW 루트 스코프(Service-Worker-Allowed)", "아이콘=placeholder(실디자인 HUMAN GATE)"], status: "platform",
    notes: "모바일 로드맵: PWA 쉘(완료) → 웹푸시 알람(VAPID·SMS 대체) → 이메일 매직링크 로그인. 네트워크-우선 쉘 캐시(오프라인 폴백).",
  },
];
