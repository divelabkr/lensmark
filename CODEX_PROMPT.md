# CODEX_PROMPT.md — LANSMARK 작업 지시서

> 먼저 `CLAUDE.md`(규칙·8에이전트·가드레일) → `LANSMARK_HANDOFF.md`(현황) 숙지.
> **목표(현재): Phase A — 실데이터 연결 + 결제로 "유료 정밀 시뮬"을 실동작시킨다.**
> 불변 규칙: 모든 Task 후 `npx tsc --noEmit && npx vitest run` **그린(45+)** 유지. mock과 **동일 반환 타입** 유지. 가드레일(CLAUDE.md §3) 위반 금지.

## 전제(시작 체크)
```
cd lansmark_simulator_skeleton
npm i
npx tsc --noEmit && npx vitest run   # 45 tests 통과 확인 (실패하면 먼저 복구)
```

## Phase A 작업 순서

### A1. VWorld 지오코딩 — `data/providers/live.ts` `land.geocode`
- 입력 `{ address }` → 출력 **`GeocodeResult`**(`data/providers/types.ts`, mock 참고: `{lat,lng,address,pnu?}`)
- VWorld 주소→좌표(가능하면 PNU). 키=.env `VWORLD_KEY`. 실패 시 명확한 에러.
- **DONE**: live 모드에서 주소 입력 시 좌표 반환, 타입 일치, mock 폴백 흐름 유지.

### A2. 기상청 기후 — `live.ts` `land.climate`
- 입력 `{lat,lng}` → 출력 **`ClimateResult`**(mock 참고: `{minWinterTempC, frostRisk, annualRainfallMm}` 등)
- 위경도→격자 변환 후 평년값/예보 조회 → 매핑. 키=.env `KMA_KEY`.
- **DONE**: 좌표로 기후 반환, `climateFactors`가 정상 보정.

### A3. KAMIS 가격 — `live.ts` `price.recentWholesale` (+ `data/providers/kamisItemCodes.ts`)
- 입력 `cropId` → 출력 **`PriceResult`**(mock 참고: `{priceKrwPerKg:{p10,p50,p90}}`)
- `kamisItemCodes`에서 cropId→품목코드 매핑 **검증/확정** 후 최근 N일 도매가 → P10/P50/P90 산출. 키=.env `KAMIS_CERT_KEY/ID`.
- **DONE**: cropId로 실가격 범위 반환, `revenue`에 반영.

### A4. 실 RDA base — `data/rdaIncome.ts` `getRdaBase`
- 현재 crops.seed×1000 + `verified:false`. **농진청 소득자료(10a당 수량·경영비)** 로더로 교체.
- 작물×(가능시)지역별 실값 + `source:"농진청 ○○년 소득자료"` + `verified:true`.
- **DONE**: 실 base 반영, `verified:true`로 `validated` 라벨 정상 동작(플라이휠 N≥5와 결합).

### A5. 결제→엔티틀먼트 — `policy/entitlement.ts` + `api/paid-simulation.route.example.ts`
- HMAC 검증은 구현·테스트됨. **PG webhook 수신 → 엔티틀먼트 토큰 발급** 추가.
- 유료 라우트(정밀 시뮬/다중 비교/저장)는 토큰 검증 통과 시에만.
- **DONE**: 결제 성공→토큰→유료 기능 접근, 미결제→무료 추천만. 엔티틀먼트 spec 그린 유지.

### A6. 앱 live 전환 — `dashboard/lansmark_app.html`(=lansmark_app_v1.html)
- `LANSMARK_API.mode="live"` + `baseUrl` 설정. 백엔드 라우트가 A1~A3 provider 호출하도록 연결.
- **DONE**: 앱에서 실제 좌표·기후·가격으로 추천·시뮬, mock 라벨이 live로 전환 표기.

## 검증(매 Task 공통)
```
npx tsc --noEmit && npx vitest run      # 그린 유지
# 변경이 수치/로직이면 tests/*.spec.ts 추가·갱신
```

## 금지(재확인)
- 보장 문구·매입추천·단일값 / 흙토람 사용 / 레거시 simulator에 유료 로직 추가 / mock과 다른 반환 타입 / 그린 아닌 채 진행.

## 완료 보고 형식
```
[Task Ax 완료]
- 변경 파일: ...
- 검증: tsc ✅ / vitest N passed
- 가드레일: 위반 없음
- 남은 것/주의: ...
```

## 다음 Phase (예고)
- **B 플라이휠 운영**: `core/feedbackStore.ts` → Firestore/Postgres 어댑터, 실측 수집 UI/리마인더, `runParcelSimulationCalibrated` 운영 적용.
- **C 정밀화**: 실 필지경계(VWorld/토지이음 WFS GeoJSON)로 앱 격자 대체, DEM 자동 지형, Sentinel 위성 파이프라인.
- **D 해자 가속**: validated 트랙레코드 마케팅, 특허(보정엔진·교정이력 학습), 데이터 파트너십(농협/지자체/RDA).
