# Codex Task — LANSMARK live providers 구현

너는 LANSMARK 데이터 연동을 맡는 시니어 엔지니어다.
목표: `src/lansmark/data/providers/live.ts` 의 **3개 메서드**에 실제 fetch+parse를 구현한다.
나머지 앱 코드는 `ProviderBundle` 인터페이스에만 의존하므로 **인터페이스 시그니처를 절대 바꾸지 마라.**

## 절대 규칙
- `LandContextProvider`/`PriceProvider`/`ProviderBundle` 타입 변경 금지.
- 실패 시 fail-loud(throw) — 조용한 빈 결과 금지. 단 `recentWholesale`는 데이터 없으면 `null` 반환 허용.
- 환경변수 미설정 시 명확히 throw(`reqEnv` 사용).
- TORAM/흙토람 등 제한 API 호출 금지. (토양은 별도 정책 모듈 소관)
- 수익/재배 성공 보장 같은 문구 생성 금지(이 모듈은 데이터만 다룬다).

## 구현 대상

### 1) `land.geocode(query)` → GeocodeResult  (VWorld)
- 입력: `{ address?, lat?, lng? }`
- VWorld 주소 검색 API로 주소→좌표(lat/lng), 가능하면 PNU 획득.
  - 예: `https://api.vworld.kr/req/address?service=address&request=getcoord&type=road&format=json&key=${VWORLD_API_KEY}&address=${encodeURIComponent(address)}`
  - 도로명 실패 시 `type=parcel` 재시도.
- 반환: `{ address, lat, lng, pnu? }`. lat/lng는 number.

### 2) `land.climate({lat,lng})` → ClimateResult  (KMA)
- 위경도 → 기상청 격자(nx,ny) 변환(LCC) 후 평년값/예보 조회.
- 매핑: `annualRainfallMm`, `minWinterTempC`, `frostRisk`(저온일수 기반 low/medium/high), `sunlightLevel`, `altitudeM`(가능 시).
- 값이 부분적이면 가능한 필드만 채우고 나머지는 생략(undefined).

### 3) `price.recentWholesale(cropId)` → PriceResult | null  (KAMIS/aT)
- `src/lansmark/data/providers/kamisItemCodes.ts`의 `getKamisCode(cropId)`로 부류/품목/품종 코드 매핑.
  - **주의: itemCode/kindCode는 verified=false 상태. KAMIS 코드표로 검증 후 채워라.**
- KAMIS 최근일자 도·소매가격 API 호출:
  - `http://www.kamis.or.kr/service/price/xml.do?action=dailySalesList&p_cert_key=${KAMIS_API_KEY}&p_cert_id=${KAMIS_API_ID}&p_returntype=json&p_itemcategorycode=...&p_itemcode=...&p_kindcode=...&p_convert_kg_yn=Y`
- 최근 N일(예: 30일) 가격 분포 → P10/P50/P90 산출(원/kg). 단위 환산 주의(근/관 → kg).
- 코드 미검증/데이터 없음 → `null` 반환.

## 완료 기준
- `LANSMARK_DATA_MODE=live`로 `getProviders()`가 liveProviders 반환.
- `scripts/mockRun.ts`를 live로 돌렸을 때 좌표/기후/가격이 실제로 채워짐.
- `npm run typecheck` 통과, 기존 20 테스트 깨지지 않음.
- 각 메서드에 단위 환산·에러 처리 주석.
- 변경 로그를 `docs/codex-log/`에 남길 것.

## 시작 명령
"CLAUDE.md 읽고 8에이전트 활성화 후 CODEX_LIVE_PROVIDERS.md 읽고 자동 실행."
