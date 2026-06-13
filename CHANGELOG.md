# 변경 이력 (CHANGELOG)

> 단일 출처: `src/lansmark/version.ts`(`RELEASES`). 이 문서·`package.json` version·`version.ts`를 **함께** 올린다.
> 사용자에겐 버전업 시 앱에서 "변경점" 팝업으로 노출(`/api/version` ↔ localStorage 마지막 본 버전).

## 0.73.1 — 2026-06-13 · 토지선택 복원 버그 수정
- **회귀 수정** — 저장/공유 선택 복원(resume·#s= 링크)이 옛 격자(cellOf)로 뜨던 버그. restore가 apiParcel 재호출로 실폴리곤·PNU·실면적 재구성(onClick과 동일). 판로·연차 옵션 보존

## 0.73.0 — 2026-06-13 · 토지선택 UI — 격자→실제 필지 경계 + 평/㎡ 합산
> 고객 앱 토지선택을 실데이터 필지 경계로. (프런트 단일파일 — tsc·vitest 무관, arch 0 유지.)
- **실필지 선택** — 격자(줌단계 셀)→VWorld 실필지 폴리곤. PNU 키잉으로 줌 안정(확대/축소 중복선택 버그 해소). 기본 모드='필지 선택'. 원 표기 제거(점선 사각형 폴백)
- **평/㎡ 합산** — '구역: N평·M㎡', 다필지 합산. 라이브 이벤트 숨김 토글(👁)
- **피드백** — 위성+일반 오버랩 차단·일반맵 기본 · 다중선택 스크롤 보존 · 대지(warn)도 작물 표시(경고 배너) · AI href 스킴가드
- ⚠ 적합도 그라데이션 시각화(작물 아이콘·빨강~파랑)는 후속

## 0.72.0 — 2026-06-13 · ops 정직성 — provider 런타임 건강(거짓 녹색 차단)
> 'live/녹색'을 '키 존재'→'실제 호출 성공'으로. tsc·vitest **531**(+7)·arch 0·guardrail STRICT 0.
- **거짓 녹색 차단** — ops 연동 live가 '키 꽂힘'일 뿐이라, 키 있는데 API 다운→조용한 mock 폴백이면 거짓 녹색이었음. `runtimeHealth`가 `auto.pick()`의 실제 결과(live/폴백) 집계 → live를 런타임-인지로(degraded면 false). 4상태: off·pending(미검증)·live·degraded(실 다운). 라이브: parcel·DEM·KAMIS=🟢, 미트리거=⚪
- **ops 노출** — degraded='⚠폴백중'·pending='검증전' + 요약 '🟢실데이터 N·⚪검증전·🔴폴백·⚫키없음' · 피쉬본도 'mock(키없음)'≠'폴백 중(다운)' 구분. ※ 서버다운 연결배너·'녹색≠정확'·사용자 ✓검증(실 RDA 기반) 보호는 유지
- **프런트 반영 안전장치** — `preview-check.sh`(좀비 서버 무응답 감지) PostToolUse 훅 + CLAUDE.md #9 — '죽은 서버를 반영됨으로 보고' 재발 방지

## 0.71.0 — 2026-06-13 · 설계감사 P2 일괄 — 방어·정합·부팅 하드닝
> 저위험 P2 12건 수정. tsc·vitest **524**(+5)·arch 0·guardrail STRICT 0.
- **입력·방어** — fetchSafe 본문 바이트 상한(스트림) · AI href 프론트 스킴가드 · injectNonce 속성 스크립트까지 · geocode 길이캡 · Perplexity 음성TTL/CAP 경계
- **수치·가드레일** — floorIncomeLoss 단조성 가드(분포역전 차단) · 면책 횡단 회귀가드
- **영속** — FsDoc 영구실패 스냅샷 보존+종료 재시도 · auditSink flushAll 대기 · firestoreLite getJson 재시도 · entitlement warm allSettled(모든 문서 sealed 보장)
- **보안 부팅·전송** — NCPMS https(apiKey 평문전송 제거·33건 실증) · TOSS 키 정합 + DATA_KEY(PII 평문) 부팅 강제
- **보류**(근거) — 토큰 httpOnly 이관(§3-1①②③·결제흐름)·revoked per-record·widen/year1 — 유료 정식 전/별 슬라이스

## 0.70.0 — 2026-06-13 · 설계감사 후속 — 가드레일 P0 + 영속·훅 P1
> 6영역 병렬 감사(아키텍처+코드)에서 검출한 P0 1·P1 5 종결. tsc·vitest **519**(+12)·arch 0·guardrail STRICT 0.
- **P0(가드레일·라이브)** — 외래 AI 요약(Perplexity)이 코어 한국작물(실 RDA/KAMIS)에도 새던 1원칙 위반을 코드 게이트로 차단(`isCoreCropName`). 라이브: 사과·마늘→null, 망고→유지(5출처)
- **P1(LLM 이중화)** — 출처 0개 요약 폐기 + 정량수치(수확량·소득·단가) 경성 후처리 필터(온도·pH 등 정성맥락 허용)
- **P1(영속)** — FsDoc.saveNow를 단일 drain 큐로 합류(실효 부활 lost-update 제거) · entitlement use 축출 FIFO→만료 우선(활성 토큰 quota 재부여 차단)
- **P1(훅)** — guardrail-scan 범위에 server·concept 추가 + STRICT 차단모드(exit 2)를 Stop·CI 편입(위험어 신규 유입 자동 차단망)

## 0.69.0 — 2026-06-12 · 농사로 재배 e-book 링크아웃
> cropEbook=전자책 파일이라 심층연동 대신 정직한 외부 링크. tsc·vitest 507·arch 0.
- **농사로 링크** — 재배 가이드 패널에 '📚 농사로 재배 e-book(농진청 ↗)' 외부 링크. cropEbook OpenAPI 라이브 실증(resultCode 00) 결과 구조화 데이터가 아닌 전자책 파일 반환 확인 → 매칭 모호·http 혼합콘텐츠 회피 위해 링크아웃(추측 금지 준수·URL 도달성 200 검증)

## 0.68.0 — 2026-06-12 · 외래작물 AI 재배요약(Perplexity Sonar) live
> 외래작물 한정 AI 보강. tsc·vitest **507**(+6)·arch 0.
- **AI 재배요약** — `/api/foreign`에 Perplexity Sonar 요약(관수·일조·내한성·토양 3~4문장 + citations). foreignCrop(GBIF·위키)과 병렬·키 없으면 null 무중단. 라이브: 망고→시설재배·생육적온 24~27℃ + 한국어 출처 5종(RDA·한경 등)
- **가드레일**(LLM 날조 금지) — ① 외래 한정(코어 한국작물 RDA/KAMIS 엔진엔 미적용) ② 정량(수확량·소득·단가) 프롬프트 차단 ③ citations 상시 노출 ④ 하드라벨 '🤖 AI 요약·출처 확인 필요·보장 아님' + 24h 캐시·상한 500
- **검증** — 회귀 +6(perplexity.spec: 파서·https citations·정량금지 프롬프트·캐시·null 폴백) · arch 0(perplexity→cultivation-guide). ⚠ 운영 PERPLEXITY_API_KEY Secret Manager 주입(없으면 AI만 생략·나머지 정상)

## 0.67.0 — 2026-06-12 · 실DEM(Open-Meteo 무키) + NCPMS 병해충 live — mock 2종 제거
> 표고·경사·병해충 mock→실데이터. tsc·vitest **501**(+4)·arch 0.
- **DEM** — `fetchDem` = Open-Meteo Elevation(무료·무키·~90m). bbox 격자 batch→terrainFromDem(Horn). 라이브: 평창 28.4°(669m)·김제평야 5.4°(23m). auto가 키 없이 live(실패만 mock). ⚠ 무료=비상업→유료 전환 시 Google Elevation
- **NCPMS 병해충** — SVC01 작물명 검색 파서 + `/api/alerts` 합류 → 앱 병충해 패널 '🐛 주요 병해충(농진청)' 칩. 라이브: 사과 5종. 미매칭 [] 무중단·http 이미지 제외
- **검증** — 회귀 +4 · health vworldDem=live · ⚠ 운영 NCPMS_API_KEY Secret Manager 주입 필요(DEM 무키)

## 0.66.1 — 2026-06-12 · health rdaIncome 정직 표시(실 RDA 동기) + 운영 점검 실증
> 실 RDA 적재 후에도 '데모'로 보이던 낡은 하드코딩 교정. tsc·vitest **497**·arch 0.
- `integrationReadiness().rdaIncome`을 `RDA_REAL_META` 동적 표시로 — "실 농산물소득조사 2024 · 10작물 · 지역행 66"
- 점검 실증 — 서버: verify 통과·/ops 200·5xx 0·클라 에러 0 / 피쉬본: 라이브 데이터 헤드리스 렌더 6/6(행동 권고 3건 표시)

## 0.66.0 — 2026-06-12 · at-rest 보안 보강 — firestore PII 암호화(G1) + 세션 토큰 해시(G2)
> 보안 점검 갭 2종 보강 + 운영 경보 가동. tsc·vitest **497**(+5)·arch 0.
- **G1 firestore at-rest 암호화** — file 전용이던 AES-256-GCM을 공용 모듈 [`db/atRest.ts`](src/lansmark/db/atRest.ts)로 추출, `FsDoc`(save/saveNow/load)에 적용 → 운영의 전화번호·일지 좌표/매출이 **앱레벨 암호문**(이미 주입된 `LANSMARK_DATA_KEY` 즉시 활성). legacy 평문 로드 허용+업그레이드-온-라이트 · 복호 불가=**sealed**(원본 덮어쓰기 금지)
- **G2 세션 토큰 해시(SHA-256)** — 저장소 유출 시 세션 탈취 불가(쿠키엔 원토큰·at-rest엔 해시만). 인터페이스 무변경·기존 세션 1회 무효화(재로그인)
- **운영 경보 가동** — `setupMonitoring.sh` 실행(divelab.kr@gmail.com): 업타임 1분 + 다운 3분/5xx 10건 경보 생성(P0 #3)
- **검증** — 회귀 +5(암호문에 평문 PII 0·왕복·legacy·sealed 덮어쓰기 0·세션 파일 원토큰 0) · 497·arch 0

## 0.65.0 — 2026-06-12 · 배포가능 수준 — 배포 IaC·부하 실측·경보 설정·P0 체크리스트
> 운영/인프라 갭(오늘 배포 실패 포함) 박제 해소. tsc·vitest **492**·arch 0.
- **배포 IaC** — `npm run deploy`(scripts/deploy.sh): env·시크릿·플래그 SSOT(웹훅 시크릿 자동감지) + 배포 후 **자동 검증**(버전=레포·store=firestore·시뮬 200) + `rollback`(직전 정상 리비전 즉시) + `verify`. bare 배포 설정 누락 실패 재발 방지
- **부하 실측** — `npm run load`(무의존 하니스·라이브 거부 안전핀): mock·동시50에서 엔진 **~17,800 RPS**(p50 1–3ms·5xx 0)·`/app` ~423 RPS(gzip 병목). 베타 대비 수천 배 여유
- **경보 설정** — `scripts/setupMonitoring.sh`(1회·멱등): 업타임 1분 체크 + 다운 3분/5xx 10건 이메일 경보
- **P0 체크리스트**(RUN_GOLIVE.md §6) — DNS 연결 단계·웹훅 시크릿 절차·모니터링·배포 규율·HUMAN GATE 현황

## 0.64.0 — 2026-06-12 · 클라이언트 에러 텔레메트리 + 실시간 경보
> 사용자 화면 JS 에러가 사장님께 전혀 안 보이던 갭 해소. tsc·vitest **492**(+5)·arch 0.
- **수집** — 브라우저 uncaught 에러·promise 거부 → `POST /api/client-error`. 프론트 리포터(window.onerror): 세션 상한 8·디듀프·keepalive·경로만(PII 0)
- **실시간 경보** — '새 distinct'만 활동로그 + `LANSMARK_ALERT_WEBHOOK`(Slack/Discord 호환) 즉시 푸시. 반복은 카운트만(스팸 0)·미설정이면 기록만
- **가시화** — `ClientErrorStore`(디듀프·링버퍼·상한 100 FIFO) · `stats.clientErrors` → OPS '서버' 탭 🐞 + watch 판정(distinct≥1 warn·≥5 crit)
- **보안** — sensitive 레이트리밋·바디 상한·204 반사 0·절단 · featureMap 등록 · 회귀 +5

## 0.63.0 — 2026-06-12 · 디테일 5종 — 이어보기·실측 변화 체감·오프라인·운영 추세/예측·권고 SSOT
> 감사에서 나온 '추가 디테일 추천' 5건 구현. tsc·vitest **487**(+1)·arch 0.
- **이어보기** — 새로고침·뒤로가기 분석 소실(최대 갭) → 시뮬 완료 시 자동저장 + 시작화면 '↩ 지난 분석 이어보기 · 상주시 사과' 칩(opts 포함·같은 숫자 재현·✕ 삭제). 자동 강제복원은 안 함
- **실측 변화 한 줄** — 기록 후 보정 전후 P50 비교 '✓ 보통값 +3% 조정' 토스트(플라이휠 체감) · **만원 병기**(소득·매출) · **수확 D-day** 배지(기존 데이터만)
- **오프라인 배너** — `navigator.onLine` 상단 띠(시골 회선)
- **운영 추세/예측** — 오늘 KPI **전일 델타**('유입 12 +5') · 저장소 **도달 예측**('이 속도면 약 N개월'·근사·추가 계측 0)
- **권고 SSOT** — qualityGate.sources에 `action` → 피쉬본·감시자·아침 요약 같은 문장(이중관리 제거) · `ops:watch --line`(메일/슬랙 한 줄) · 회귀 +1

## 0.62.0 — 2026-06-12 · UX 디테일 일제 정비 — 농부 친화·무음 실패 금지·운영 30초 판단
> 고객앱·운영콘솔 2-에이전트 감사(27건) → P1 8건 포함 40여 디테일 수정. tsc·vitest **486**(+2)·arch 0.
- **고객앱 P1** — 실측 기록 무음 성공/실패 금지(토스트·버튼 복구) · 권한 만료 사유 명시 후 페이월 · 원시 에러(`… 500`·영문) 금지: 15s 타임아웃+친화 문구+**다시 시도** · LIVE 데모 피드 항목별 '예시·연동 예정'(가짜 시세 오도 차단)
- **농부 친화** — 면적 **㎡↔평 병기**(카드+입력 실시간) · 향 'S'→'남향(S)' · 예산 회수/ROI '나쁠 때/보통/좋을 때' · 업셀/플라이휠/해자/validated 등 내부 용어 제거 · **서버 검증 문구 한국어화**(validate.ts 영문 400 종결) · 페이월 '무제한'→'재계산 50회'(정직) · 공유 링크 opts 포함 · 데모 실측 버튼 localhost 한정
- **운영콘솔 P1** — 10초 갱신의 revoke 입력/경고 파괴 종결(1회 렌더) · 로그인 4중 결함(리셋·Enter·무피드백·로그아웃) · 서버 다운 전역 배너+갱신시각 적색 · **revoke 오타 무음 차단**(`hasUsage`→known:false 황색 경고)
- **운영 30초 판단** — 종합판정 띠 `stats.watch`(**evaluateOps SSOT** — 감시자와 같은 문장) · KST 통일·'오늘(09시 기준)' · 색 일관(5xx 1~9 주의/10+ 시급=감시자 임계) · 피쉬본 폰 1열 · 숫자 콤마·운영자 어휘
- **모바일·접근성** — 입력 16px(iOS 줌 방지)·Enter 제출·ESC 닫기·빈 추천/빈 탭 안내+재시도 · 검증: 인라인 구문 node --check + 라이브 실증 + 회귀 +2

## 0.61.0 — 2026-06-12 · 지역(도)별 실 RDA 소득 + 외래식물 seam 정직 교정
> 지역별 소득조사 2024(도별) → 66개 도 실값. 같은 작물도 지역따라 다른 소득. tsc·vitest **484**·arch 0.
- **지역 오버라이드**(`getRdaBase(cropId, region)`) — 지역별 농산물소득조사 2024 도별 상세표 → 10작물 **66개 도** 실값 적재(`rda:build`에 `<전국>.regional.csv` 자동탐지). 해당 도 실자료가 있으면 절대수준을 그 도 값으로, 없으면 전국 폴백. 프론트 전체 시도명(전라남도)→2자 코드(전남) 정규화. **블루베리 전남 수량 630·경영비 860만 → 소득 2,533만 vs 전국 2,131만**
- **스키마**: `RdaRegionalTable`·`parseRdaRegionalCsv`(검증·폭 유도·인용/컬럼 시프트 가드)·`RDA_REAL_REGION`·`normalizeRegion`(17시도). 연차/판로 상대구조 보강은 지역값에도 동일. **데이터 검증**: 체크섬(총수입−경영비=소득) **100%** · 전국값이 지역 min~max 내(9/10·barley만 단일도)
- **외래식물 Perenual seam 정직 교정** — 라이브 실측(2026-06-12): **무료 티어는 species-list(분류)만**, 재배상세(관수·일조·내한성)는 **유료 전용**(429). care-guide는 v1 경로(v2엔 없음). `parsePlantDetail`는 ShapeUnverifiedError 유지(추측 금지)·재배상세=**새 HUMAN GATE(유료 Perenual)** 문서화·URL 교정
- **검증** — 회귀 +2(지역 오버라이드·시도명 정규화·미수록 폴백) · tsc·vitest **484**·arch 0

## 0.60.0 — 2026-06-11 · 실 RDA 단가 우선 — mock 시세가 실데이터를 덮어쓰던 소득 음수 오류 수정
> 라이브 배포 검증에서 발견. v0.59가 비용을·v0.60이 단가를 바로잡아 실 소득 현실화. tsc·vitest **482**·arch 0.
- **단가 소스 우선순위 수정**(`parcelSimulator.runParcelSimulationWithProviders`) — 미검증 작물(apple 외 9종)은 KAMIS가 null→**mock 단가**(블루베리 8,200원/kg)로 폴백하는데, 이 mock이 **실 RDA 농가수취가(23,706원/kg)를 덮어써** 매출 1/3·소득 음수(블루베리 전남 P50 −381만). provider 단가를 무조건 주입하던 것을 **source가 'mock-…'이 아닌 실 시세만 주입**하도록 수정 → 실 refPrice 사용
- **우선순위** — 실 KAMIS 시세(apple) > 실 RDA refPrice(verified) > mock. '실데이터가 mock을 이긴다'. **블루베리 데모 −5,694만 → 실 +599~+2,131~+3,663만**(전 9작물 단가 교정)
- **검증** — 회귀 +2(mock 단가 미주입→실 refPrice·소득 양수 / 명시 실단가 정상 주입) · tsc·vitest **482**·arch 0 · 라이브 재배포 반영

## 0.59.0 — 2026-06-11 · 실 RDA 소득자료 적재(2024) — 10작물 데모→검증
> 농진청 농산물소득조사 2024 전국 총괄표 → 10작물 실 base. 데모 비용 과대(현실 3~5배) 종결. tsc·vitest **480**·arch 0.
- **실데이터 적재**(`rda:build` ← `scripts/rdaReal.2024.csv`) — 사과·블루베리·포도·고구마·감자·딸기·배추(가을)·참깨·들깨·보리 10작물. `getRdaBase`가 `RDA_REAL` 우선(verified·baseYear 2024·출처). **블루베리 1,000평 '나쁠 때 −5,694만'(데모) → +509만~+2,046만~+3,582만(실)**. v0.58 하한캡은 실 비용이 현실적이라 여전히 휴면
- **판로·연차 구조 보존**(`getRdaBase`) — 실데이터 path가 작물 단위 전국 평균만 줘 다년생 과일의 정착연차 손실·판로 단가차가 사라지던 회귀를, **절대수준=실 RDA + 연차/판로 상대구조만 룰북 보강**(성숙기=1·혼합=1 기준)으로 보존. 출처에 '연차/판로 구조 룰북 보강' 정직 표기
- **정직 매핑** — barley←쌀보리·potato←봄감자·napa_cabbage←노지가을배추·strawberry←시설딸기(토경). **chili_pepper 제외**(소득조사는 시설고추뿐 — 경영비 976만/10a로 노지 건고추 4-6배 과대표현). 미수록 데모 유지: rice·마늘·양파·콩·도라지·옥수수
- **검증** — rdaReal 회귀 갱신(적재=verified·rice 데모 폴백)·기존 계약 무변경(engineInputs 판로>도매·정착연차) · tsc·vitest **480**·arch 0. NCPMS·Perenual 키 라이브 검증·농사로 승인 대기(resultCode=12)

## 0.58.0 — 2026-06-11 · 소득 P10 현실 손실 하한 가드레일(휴면·미래 활성)
> 마케팅 실증에서 발견된 '비현실적 음수 P10' 조사 → 진단 정정 + 미래 가드레일 채택. tsc·vitest **479**(+4)·arch 0.
- **`floorIncomeLoss`**(`core/uncertainty.ts`·`parcelSimulator` 최종단계) — 소득 P10에 현실 손실 하한: 한 해 최대 손실 = 매출 0 − 최악 경영비(cost.p90). 그보다 더 음수인 '물리적 불가능 손실'만 차단(p10만 올림·단조성 유지·**인위적 축소 아님**)
- **⚠ 정직 고지** — 현재 데모 base는 비용이 비현실적으로 커서 **전 작물 휴면**(17작물×3시나리오 **binding 0/51**). 즉 사용자가 본 '블루베리 −5,694만'을 **지금 고치지 않음** — 그 magnitude의 원인은 데모 비용(median 6,237만·p90 1.1억 = 현실 3~5배), **실 RDA 적재로 해결**. 이 하한은 실데이터 적재 시 자동 활성·**재작업 0**의 미래 가드레일
- **진단 정정** — 제보된 "income.p10 < -cost(매출 0클램프)"는 *현재 숫자엔 거짓*(매출.p10이 0 아님·income.p10 > -cost.p90). 51건 재현으로 '단순 floor는 no-op·원인은 데이터' 확인 후 **가드레일로만** 채택
- **검증** — 회귀 +4(binding/비활성/단조성 + 5작물 계약 `p10≥−cost.p90`) · 휴면이라 **기존 숫자 0 변경**

## 0.57.0 — 2026-06-11 · Tier 1 ops watcher — 읽기·진단(행동 0)
> 서버를 '책임지는 자율 AI'가 아니라 '깨우는 감시자'로 — /api/ops/stats를 읽어 평문 진단·권고. 행동권 0. tsc·vitest **475**(+6)·arch 0.
- **읽기 전용 감시자**(`ops/opsWatch.ts`) — 신뢰 피쉬본·최적화 트리거·스토어 저하·5xx를 **crit/warn/ok 롤업** + 항목별 진단·권고. ⚠ **행동권 0**(재시작·토글·삭제 X) — Tier 1=조언만(레드팀 합의: AI는 조언, 행동은 결정적·사람). fail-closed로 알림
- **채널 무관** — 순수 `evaluateOps` + `formatReport` + CLI(`scripts/opsWatch.ts` · `npm run ops:watch` · exit 0/1/2). cron·GitHub Action·Claude Code 루틴이 stdout/exit code를 얇게 래핑(슬랙·이메일·푸시). 임계는 콘솔 트리거와 단일 출처
- **실증** — 로컬 서버 `ops:watch`가 실제 상태 정확 진단: 소득 base 데모→crit(미검증·`rda:build` 권고)·DEM 구조적 warn·보정 표본 warn·payload 55KB warn. live 소스(VWorld/KMA/KAMIS)는 무경고(정직)
- **검증** — 회귀 +6(opsWatch) · featureMap `ops-watcher` 등록(arch 0). **Tier 2**(좁은 가역 자동행동·킬스위치)는 신뢰 검증 후 별 슬라이스

## 0.56.0 — 2026-06-11 · 데이터 품질 게이트 v1 — 신뢰 피쉬본 + 제품 자동 보수
> '운영 녹색 ≠ 데이터 정확'을 못 박음 — 넘기는 데이터가 검증/정직한지 차원 게이트로 평가하고, base 미검증이면 앱이 자동으로 '✓검증' 차단·'추정' 강제. tsc·vitest **469**(+7)·arch 0.
- **품질 모듈**(`quality/qualityGate.ts`·순수·fail-closed) — 기존 신호(`integrationReadiness`·`RDA_REAL_META`·flywheel)를 차원 게이트(ok/warn/fail): 소득 base(데모=**fail**)·시세·기후·지도·DEM·보정·가드레일 → `dataTrust`(unverified/estimated/verified)+등급 A~D. **'에러 없음'이 아니라 '양성 신호'로 채점**(조용한 mock/데모=녹색 아님)·모르면 warn
- **OPS 신뢰 피쉬본**(종합 최상단) — 머리(등급·verdict)+카테고리 뼈(원인별 색)로 '어디가 문제인지' 한눈에. `/api/ops/stats.quality`(admin 게이트)
- **제품 자동 보수** — base 데모/미검증이면 앱 결과·비교표 **'✓검증' 차단·'추정' 강제**(보정이 validated여도). 품질 게이트가 정직성 가드레일을 운영화. 현재 RDA=데모라 즉시 효력
- **검증** — 회귀 +7(qualityGate 5: fail-closed·verified·estimated·mock=녹색아님·구조형 / 앱 게이트 2) + 헤드리스 피쉬본 6/6. `featureMap` data-quality-gate 등록(arch 0). v1=린 · 후속: 값-범위 sanity·신선도, **Tier 1 ops watcher**가 이 quality 소비

## 0.55.0 — 2026-06-11 · OPS 최적화 트리거 — '언제'를 데이터로
> 최적화를 느낌이 아니라 측정으로 — OPS 종합에 페이로드·저장소 헤드룸 트리거를 못 박아 '검토/시급'일 때만 손대도록. tsc·vitest **462**(+1)·arch 0.
- **⚡ 최적화 트리거 패널**(OPS 종합) — ① 앱 첫로드(gzip/raw KB) ② 저장소 헤드룸(실측 n/20k·수요키 n/10k) ③ 참여(이탈)는 동향 퍼널 연결. 각 항목 임계로 **여유/검토/시급** 색 판정
- **백엔드**(`/api/ops/stats`) — `optimization{payload, headroom}`. payload는 앱 HTML **gzip(over-the-wire)**·mtime 캐시(파일 변경 시에만 재계산). headroom 분모 = blob 1MiB·차원폭증 한계 → per-record/DB 승격 신호
- **정직성** — 없는 '페이지뷰 이탈'은 안 만듦. 측정 가능한 지렛대(페이로드)·스케일 벽(저장소)만 노출, 참여는 기존 퍼널로. "검토/시급일 때만 최적화 — 그 전엔 학습 우선" 명시
- **검증** — 회귀 +1(opsRoutes: 트리거 노출·gzip<raw·캡) + 헤드리스 스모크 6/6(임계 판정: gzip 58→검토·실측 71%→검토·수요키 88%→시급). qwen 생략(소규모·admin 읽기)

## 0.54.0 — 2026-06-11 · Red-team 잔여 처리 — 처리방침 고지 + OPS XSS 가드 + 스팸 한계
> 고객흐름(v0.52~53)의 적대 점검 잔여 4건을 닫음. tsc·vitest **461**(+3)·arch 0.
- **#1 프라이버시** — 개인정보처리방침(`dashboard/lansmark_privacy.html`)에 '익명 접속 집계(신규/재방문)' 항목 명시: 브라우저 익명ID는 비식별 해시로 중복제거에만·집계 수치만·여정 미저장. ⚠ 법무 검토 HUMAN GATE
- **#2 OPS XSS 회귀가드**(`opsSecurity.spec.ts`) — 운영 콘솔도 esc 배선(감사로그·데이터갭·수요 서버유래 싱크)·CSP-safe(inline `onclick` 0)·관리자 게이트를 회귀 고정. v0.53 5섹션 재편 후 미escape 싱크 차단
- **#3 스팸 한계 명시** — 신규/재방문은 조작 anon-id 스팸으로 부풀리기 가능 → `/api/*` 글로벌 레이트리밋(IP당) 바운드 + '참고용' 라벨. eventStore 주석 + `SECURITY.md §5`
- **#4 실브라우저 렌더** — 프리뷰가 환경 루프백 격리로 불가 → **헤드리스 실행 스모크**(DOM 스텁으로 ops `load()`를 실 stats 형상에 실행)로 런타임 무오류·5섹션 패널 렌더·활동로그 esc 페이로드 무력화 **10/10** 실증. 실픽셀·CSP는 사용자 `/ops` 확인
- 적대 점검은 솔로 red-team(주입·PII·스팸·동시성) — 결제·인증·해자 변경 아니라 멀티에이전트 풀 red-team은 결제 라이브/실 RDA 시로 보류

## 0.53.0 — 2026-06-11 · OPS 콘솔 5섹션 재편 + 고객 흐름 시각화 (Slice 2/2)
> v0.52 데이터(시계열·신규/재방문·가입)를 **눈에 보이게** — 운영 콘솔을 5섹션 탭(종합·회원·동향·매출·서버)으로 재편하고 퍼널 드롭오프·추세 스파크라인·신규vs재방문을 시각화. 기존 동작 무변경. tsc·vitest **458**·arch 0.
- **5섹션 탭**(`dashboard/lansmark_ops.html`) — 종합(KPI·유입추세·상태) / 회원(가입·세션·신규vs재방문·가입추세) / 동향(퍼널 드롭오프·유입·전환 추세·수요·플라이휠) / 매출(결제·게이트·실효·**매출추정**) / 서버(통합·건전성·활동로그). **기존 패널·동작(게이트 토글·revoke·게이지·자동갱신) 무변경** — 컨테이너만 재배치(id 보존)
- **신규 viz(무의존 SVG)** — ① **퍼널 드롭오프**: 단계 전환%·이탈%·최대 누수 구간 적색 ② **스파크라인**: 일별 유입/전환/가입 추세(14일) ③ **신규 vs 재방문** split. v0.52 `analytics.days·signups·members`에 결선
- **유지** — CSP-safe(`addEventListener`)·동적 텍스트 `esc()`·시크릿 0·PII 0 표기('신규/재방문=익명 기기 집계·여정 미저장')
- **검증** — ⚠ 브라우저 프리뷰는 이 환경 루프백 격리로 픽셀 불가(서버 200) → **node 결정적 검증**: 인라인 스크립트 17.8KB **구문 무손상** + 새 viz 함수 실제 렌더(드롭오프 6행·최대이탈 적색·전환%·스파크라인·split). **qwen 생략**(순수 프론트 — 자체 적대검토+node로 갈음). 사용자 확인: `http://127.0.0.1:8801/ops`

## 0.52.0 — 2026-06-11 · OPS 고객 흐름 데이터(백엔드) — 시계열 + 신규/재방문 + 가입
> "고객이 이탈·유입·체류"를 OPS에 올리기 위한 **데이터 계층**(Slice 1/2). 누적 카운트만 있던 analytics에 일별 시계열·신규/재방문·가입(방법별)을 추가. 전부 집계(수)만·바운드·PII 0 유지. tsc·vitest **458**(+4)·arch 0 · qwen 1차(치명 0).
- **일별 시계열**(`analytics/eventStore.ts`·롤링 30일) — 퍼널 6단계·신규/재방문·가입을 날짜별 버킷(`snapshot.days`)으로. '유입/전환/가입 추세'(시계열 0 갭)의 토대. 메모리/blob<1MiB 바운드
- **신규 vs 재방문(체류)** — 익명 기기ID(`x-lansmark-anon`)를 FNV 해시 토큰으로 '중복제거 집합'(`seenAnon`)에만 보관 → 일별 신규/재방문 '수'만, **개별 여정 미저장**(PII 0·사용자 승인 방식). 유입(`recommend`)에서 당일 1회 판정(중복 클릭·헤더없음·위조 제외). 상한 20k·FIFO·**재배포 영속**(firestore)
- **가입 추적(방법별)** — 계정 신규 생성 시 `analytics.signup(method)`로 email/phone 구분 누적+일별. `/api/ops/stats`에 `members`(가입·세션)+`analytics`(days·signups). **이메일 로그인 가입이 OPS에 집계 반영**(로그인 기능은 v0.43 기존)
- **검증** — 회귀 +4(일별·신규/재방문·가입 화이트리스트·File/firestore 영속+재배포 재방문) · 디바운스 영속(v0.48)·함수 호환(`funnel` anonId 선택적) 유지. **다음(Slice 2)**: OPS 5섹션(회원·동향·매출·서버·종합) 재편 + 퍼널 드롭오프·시계열·신규vs재방문 시각화

## 0.51.0 — 2026-06-11 · 결과 카드 시각화 — 소득 확률 밴드 + 6축 근거 토네이도
> 제품 1번 출력(P10–P50–P90 소득)·근거 6축을 텍스트/평밴드 → 널리 쓰는 표준 시각화로. 정직성 가드레일 유지(3분위만 쓰는 밴드·엔진 value 그대로의 토네이도·esc). tsc·vitest **454**(+2)·arch 0 · qwen 1차(치명 0).
- **소득 확률 밴드**(`dashboard/lansmark_app.html`·`bar()`) — 평평한 밴드 → **P50에서 가장 진한 농도 그라디언트 + P10·P50·P90 분위 눈금**. 범위뿐 아니라 '가운데(보통)일수록 흔함'을 분위 그대로(엔진은 3분위만 → 가짜 정규곡선 X·일기예보/핀테크식 표준). 단일 결과 + **다중 비교뷰 공용** bar() 동시 개선
- **6축 근거 토네이도**(`factorList()`) — ±% 텍스트 행 → **중앙 0 발산 막대**(기여 크기순 정렬). 정직성: 막대 방향·색을 **소득 방향**으로 매핑(수율↑·비용↓=소득↑ 초록·오른쪽 / 소득↓ 주황·왼쪽) — 기존엔 비용 증가도 초록(+)이던 모호함 교정. 라벨=요인 자체 ±%(엔진 value 그대로), `axis`·`reason`은 `esc()`. 범용 `.frow` 불변(신규 `.trow/.tbar/.tfill`)
- **검증** — ⚠ 브라우저 프리뷰는 이 환경에서 루프백 격리로 픽셀 확인 불가(서버는 127.0.0.1·[::1] 둘 다 200·HTML 정상 서빙) → **node 결정적 검증**: 인라인 스크립트 130KB **구문 무손상** + HTML에서 추출한 실제 `bar()`/`factorList()` 호출로 그라디언트 P50 피크·토네이도 방향/색·**정직성 매핑(비용+10%→소득↓)** 실측. 회귀가드 +2(`appSecurity.spec`: 배선 + `f.target==="cost"?raw<0:raw>0` 고정). 사용자 확인: `http://127.0.0.1:8801/app`(또는 8787) → 필지→작물→소득 카드

## 0.50.0 — 2026-06-10 · 마트 소매가(소비자 물가) 주간 min~평균~max — KAMIS 소매(01)
> 도매가(농가 수취)와 별개로 '마트 소비자가'를 추가 — KAMIS 소매(p_productclscode=01) 최근 7일 1kg당 min~평균~max. 도매·소비자가를 함께 보여 시세를 입체적으로. 무의존·mock↔live drop-in. tsc·vitest **452**(+5)·arch 0.
- **소매가 조회**(`GET /api/retail-price?cropId` · 무료·무인증) — `kamis.fetchRetailWeekly`(cls=01·최근 7일·전국평균 일별) → `{min, avg, max, samples}`(원/kg). `kamisDailyUrl`에 도·소매 `cls` 파라미터(기본 02). 주간 통계는 percentile 아닌 **실최저~최고**(소비자 체감 직관)
- **provider seam** — `types.RetailWeekly` · `live`(fetchRetailWeekly) · `mock`(도매×1.6 마진·라벨 구분) · `auto`(okRetail 폴백). 미검증 작물은 live가 null → mock 폴백
- **한계 정직** — 현재 KAMIS 코드는 **apple만 verified** → apple은 live 소매가, 미검증 16작물은 mock. KAMIS 품목코드 채우면 작물 확장. 소매 `rankCode`는 라이브 실증으로 확정 예정
- **프론트(고객앱)** — 정밀 시뮬 결과에 '시세 비교' 카드: 농가 도매가(받는 값) vs 마트 소비자가(주간 평균·최저~최고) + 도매 대비 배율. 출처 라벨(KAMIS 실데이터 / 추정 데모) 정직 구분. 시뮬 후 `/api/retail-price` 부가 호출(실패해도 시뮬 표시·CSP-safe·esc)
- **라이브 실증**: apple 마트 소매가 **27,214원**(min 27,140~max 27,358) vs 도매 **9,086원** = 약 **3배**(소비자가≫농가가) · 미검증 작물(onion)은 mock-retail 폴백 · 검증: 소매 URL·retailStats·라우트 테스트 +5

## 0.49.0 — 2026-06-10 · 운영 콘솔 시각화 리디자인 — 라이트 위젯 + SVG 게이지/도넛/바
> ops 콘솔을 OpsNow360 풍 밝은 위젯 대시보드로 전면 리디자인 — 무의존 inline SVG(게이지·도넛·가로바)로 한눈 파악. 기능·데이터 계약·보안 제약 전부 보존. arch 0.
- **시각화 위젯**(`dashboard/lansmark_ops.html`) — 다크→라이트. 상단 3열: 통합 준비도(도넛 LIVE N/총)·플라이휠/해자(실측 포함률 게이지)·시스템 건전성(연동 가동률 게이지). 반응형(좁으면 1열)
- **무의존 SVG** — 반원 게이지·도넛 링·가로 막대(작물·퍼널 6단계·수요 히트맵)를 외부 차트 라이브러리 없이 직접. CSP-safe(addEventListener)·`esc()` XSS·외부 리소스 0·클라이언트 시크릿 0
- **기능 보존** — 관리자 로그인·게이트 토글·revoke·degraded(배너+게이지 적색+게이트 차단)·10초 자동갱신. `/api/health`·`/api/ops/stats` 무변경
- 검증: 브라우저 스모크(위젯 렌더·3열 반응형·degraded 적색 전환·콘솔 에러 0)

## 0.48.0 — 2026-06-10 · Firestore 익명 계측 재배포 유실 수정 — 디바운스 write-through
> 저트래픽 베타에서 익명 수요·퍼널 계측이 재배포마다 통째 유실되던 문제 종결. 인프로세스 종료(flushAll) 경로는 정상임을 실증하고, 근본 원인인 '평시 미영속'을 디바운스 write-through로 해소(SIGTERM 의존 제거). tsc·vitest **447**(+6)·arch 0 · qwen 1차(치명 0).
- **저트래픽 유실 종결**(`db/firestoreStores.ts`·`FirestoreAnalyticsStore`) — 계측이 throttle(25건)을 평시 못 채우는 저트래픽에선 firestore 평시 쓰기가 0 → 유일 영속 통로가 종료 flush(SIGTERM)뿐이라, SIGTERM 미수신(idle scale-down)/`race 1800ms` 부족 시 재배포에 통째 유실(`lm_state/analytics` 미생성 실증). **디바운스 write-through** 추가: '마지막 flush 후 첫 변경에서 **5s** 뒤' 또는 '**25건**' 중 빠른 쪽으로 영속 → 유실 폭 **≤5s**·종료 flush 의존 제거
- **진단(인프로세스 경로는 정상)** — `flushAll→analytics.flush→FsDoc.save→drain→whenDrained`가 in-flight save를 끝까지 `await`함을 테스트로 실증(**가설 ③ 레이스 반증**). 원인은 '평시 미영속'. `1800ms` race는 backstop으로 충분(워밍 토큰 기준 단일 PATCH<500ms)하고 디바운스가 의존도 자체를 제거 → **devServer 종료 경로 무변경**(blast radius 최소)
- **타이머 수명** — 디바운스 타이머 `unref`(analytics 단독으로 종료를 막지 않음·서버 핸들이 이벤트루프 유지) · 종료(flushAll) 시 대기 타이머 해제 후 즉시 flush(늦은 중복 쓰기 없음) · `debounceMs` 생성자/팩토리 주입(테스트·튜닝 seam, 기본 5s·`0`=비활성) · 익명 집계(PII 0)라 **저장 데이터 형태 무변경**(언제 쓰는지만)
- **검증**: 회귀 +6(디바운스 자동영속=SIGTERM 없이 재배포 생존·버스트 25건 즉시·비활성·종료 backstop·대기 타이머 해제 1회 영속) · `npm run arch` 0(파일/엔드포인트 무추가)
- **라이브 운영 의존성(추가 실증)** — 디바운스 `setTimeout`은 Cloud Run 기본(요청당 CPU)에선 idle 중 발화하지 못한다: `--no-cpu-throttling` 미설정 시 6건 중 3건 유실 실증 → 설정(CPU always while alive · scale-to-zero 유지 → idle 과금 ~0) 후 idle 8s에도 6/6 영속 실증. **코드(디바운스)+인프라(CPU always) 조합 필요** — DEPLOY A-7 명령에 반영

## 0.47.0 — 2026-06-10 · 운영 콘솔: 스토어 저하 경고 + 엔티틀먼트 실효(revoke) 컨트롤
> 0.46.0 감사로 백엔드엔 생겼으나 콘솔이 못 따라간 공백을 메움 — 운영자가 환불·오용에 즉시 대응(revoke)하고, 스토어 저하 위험을 한눈에 인지. 단일 HTML·외부 리소스 0·시크릿 0 유지.
- **엔티틀먼트 실효(revoke) UI**(`dashboard/lansmark_ops.html`·결제 섹션) — 지금까지 curl로만 가능하던 환불·분쟁·오용 대응을 콘솔에서: jti 입력→confirm(파괴적)→`POST /api/ops/revoke`. `durable===false`(원격 영속 실패)면 "재배포 시 부활 가능" 경고로 재시도 인지(H3 정합). 403/409/415는 사람이 읽을 메시지로
- **스토어 저하(sealed) 경고** — firestore 워밍 실패 시 상단 배너 + 결제 섹션 정상/저하 pill + 저하면 '유료로 전환(켜기)' 버튼 비활성(서버 409 STORE_DEGRADED와 UI 일치 — 켰다 실패하는 경험 제거, H2 정합). 시스템 패널에 STORE(file/firestore) 노출
- 제약 준수: 모든 동적 텍스트 `esc()`(XSS)·`addEventListener`만(CSP-safe)·디자인 토큰 재사용. tsc·vitest 441·arch 0 · 브라우저 스모크

## 0.46.0 — 2026-06-10 · Firestore 영속 + CI + 3-에이전트 보안감사 수정
> Cloud Run '재배포=데이터 소실' 종결 + push마다 GitHub 그린 게이트 + 3-에이전트 화이트박스 감사 확정결함(High 4·Med 5·Low 다수) 수정. 무의존성 유지. tsc·vitest **441**(+19)·arch 0.
- **Firestore 영속**(`db/firestoreLite.ts`·`db/firestoreStores.ts`·`LANSMARK_STORE=firestore`) — 계정·세션·재배일지·실측·**유료권한 소진/실효**·웹훅 멱등·구독·계측·감사로그(lm_audit)·런타임 토글이 재배포 후 유지. SDK 없이 **메타데이터 토큰+REST**. write-through·부팅 워밍(listen 前)
- **CI**(`.github/workflows/ci.yml`) push/PR마다 tsc·vitest·arch + **RDA 실데이터 파이프라인 사전구축**(`npm run rda:build`·인용/컬럼 검증·폭 유도 정직표기)
- **보안 감사 수정** — **H1** firestore 토글 비영속/tsc 에러→flags firestore 백엔드+워밍 후 적용 · **H2** sealed×게이트ON 실효부활→409 STORE_DEGRADED 거부+stats 노출 · **H3** revoke 내구확인(durable 플래그)+SIGTERM drain · **M1** 워밍 allSettled · **M2** use/revoked 2문서 분리 · **M3** 평문손상 sealed · **M4** ops 변이 토큰필수+JSON content-type(CSRF) · **M5** CSV 인용/컬럼 거부 · **M8** 결속토큰 본인 로그인 필수(익명 도용 봉쇄) · **H4** 캡처 샘플 본문 키 마스킹 · Low(quota 환불·만료 챌린지 정리·OTP 타이밍세이프·웹훅 mint→mark·firestore 컬렉션 검증)
- 한계(정직): blob-per-store(1MiB)·단일 인스턴스 — **다중 인스턴스 정합은 per-record 승격 시**(§3-1 잔여). 잔여 HUMAN GATE: KAMIS 키 회전·`git log --all -- .env samples/` 이력 확인. DEPLOY A-7·ROADMAP §3-1 갱신

## 0.45.0 — 2026-06-09 · 출시 전 종합 테스트 — 보안 감사 확정결함 수정
> 4분류 테스트 체계(단위·통합·시스템·인수 × 기능·성능·보안·사용성 × 화이트/블랙 × 회귀·스모크) 실행. 3-에이전트 병렬 화이트박스 감사 + 블랙박스/부하/기기. 확정결함(P1 1 + P2 4) 수정. tsc·vitest **422**(+4)·arch 0.
- **[P1] 유료권한 계정 결속 미강제 수정** — `boundAccount` 토큰이 유료 기능 엔드포인트에서 순수 bearer로 동작(유출 시 누구나 사용)하던 갭. `server/paidAccess.ts`(세션-인지 게이트)로 `simulate·feedback·guide·foreign·budget·journal`을 통일 적용: 결속 토큰 + 로그인 세션 불일치 → **403**(타인 도용 차단), 세션 없으면 bearer 유지(익명 결제 흐름). `assertPaidEntitlement(headers, {sessionAccountId})` + 4 회귀 테스트
- **[P2] 원시 JSON 바디 → 500 차단** — `account/auth/{start,verify}`·`ops/{revoke,paid-gate}`에서 `null`/숫자/배열 바디가 `b.field` 역참조로 500을 내던 것을 `isObject` 정규화로 **400** 처리
- **[P2] 프론트 esc() 일관성** — 서버 enum 필드(`sim.confidence`·`sim.dataLabel`·`terr.source`) `esc()` 적용(라이브 provider 대비 XSS 방어심도)
- **[P2] 서비스워커 캐시 가드** — `ok && (basic|cors)` 응답만 캐시(opaque/에러 응답 캐시 오염·stale 영속 방지)
- **[P2] 서버 타임아웃 하드닝**(`devServer.ts`) — `requestTimeout 20s`·`headersTimeout 10s`·`keepAliveTimeout 5s`(slow-loris 완화)
- **감사 결과**: P0 0 · P1 1(수정완료) · 다수 카테고리 CLEAN(입력검증·IDOR·스토어 상한·결제 무결성·ReDoS·오버플로·레이트리밋·CSP/헤더·가드레일 준수). 잔여 P2(멀티인스턴스 DB 어댑터·세션 토큰 바디 노출·ops 토큰 httpOnly·익명 결속토큰)는 ROADMAP에 기록(유료 정식 전 처리)

## 0.44.0 — 2026-06-09 · 출시 전 하드닝 — 세션 httpOnly 쿠키(S5) + 핀 분석 병렬화(U2)
> XSS 세션탈취 방어 + 핀 분석 지연 단축. tsc·vitest **418**(+7 cookies)·arch 0 · end-to-end curl + qwen/레드팀 검증.
- **S5 세션 httpOnly 쿠키**(`server/cookies.ts`) — 로그인 시 `Set-Cookie: lm_session; HttpOnly; SameSite=Strict; Path=/`(Secure는 운영만). **XSS가 세션 토큰을 읽지 못함**. CSRF는 SameSite=Strict + CORS 잠금으로 차단. **듀얼모드**: 쿠키 우선 → `x-lansmark-session` 헤더 폴백(비브라우저 API·테스트 하위호환)
- 모든 세션 읽기(`account`·`payment`·`push`·`journal`)를 `sessionTokenFrom(req)` 헬퍼로 통일. 로그아웃은 쿠키 파기(Max-Age=0) + 세션 서버측 삭제
- **프론트**(`dashboard/lansmark_app.html`) — 토큰을 localStorage에 보관하지 않음. 로그인 상태는 `/api/account/me`(`ACCT`)로 판정·`syncAcct()`. fetch는 `credentials:"same-origin"`로 쿠키 자동전송
- **U2 핀 분석 병렬화** — 필지 분석에서 `recommend`·`terrain`·`parcel`을 **`Promise.allSettled` 병렬**(독립 호출, 지연 합→최댓값). parcel 실패는 분석 지속, 세대(경쟁조건) 가드 유지. SEL 분기도 `recommend`·`terrain` 병렬(`Promise.all`)
- **검증**: end-to-end curl(httpOnly 발급·쿠키 전용 인증·무쿠키 401·로그아웃 파기 후 401) · `cookies.spec.ts`(7) · qwen 1차 + Claude 레드팀(CSRF/세션고정/매직링크 무영향)

## 0.43.0 — 2026-06-09 · 이메일 매직링크 로그인(M2) — 휴대폰 OTP와 병행
> 휴대폰 OTP에 이메일 매직링크 로그인을 병행 추가(사용자 선택). 새 엔드포인트 0(auth/start·verify 재사용). 실발송=HUMAN GATE. tsc·vitest **411**(+11)·arch 0 · end-to-end curl 검증.
- **로그인 수단 추가**(`dashboard/lansmark_app.html` 계정 모달) — **'📱 휴대폰 / ✉️ 이메일' 탭**. 이메일 입력 → 1회용 로그인 링크 → 링크 클릭 시 자동 로그인(`/app?lm_login=challengeId~token` 착지 → `consumeMagicLink` → verify → 세션 + 익명 일지 이관). 휴대폰 OTP는 그대로 병행
- **CompositeVerifier**(`src/lansmark/account/verifier.ts`) — `challengeId`의 `method:` 프리픽스로 하위 검증기 라우팅(`PhoneOtpVerifier`/`EmailMagicLinkVerifier`). `EmailMagicLinkVerifier`=256bit 1회용 토큰·15분 TTL·타이밍세이프 비교·시도상한
- **이메일 발송 seam**(`src/lansmark/notify/emailSender.ts`·HUMAN GATE) — `ConsoleEmailSender`(미전송 정직·주소 마스킹). 승격 시 `LiveEmailSender`(SMTP/SES/Postmark/Resend 키)
- **보안**(qwen 1차 + Claude 레드팀) — 이메일/번호 평문 미저장(`subjectHash`) · 매직링크 토큰 **URL 즉시 제거**(`history.replaceState` — 히스토리·공유·재로딩 잔류 방지) · 토큰 유출 차단 확인(**Referrer-Policy strict-origin** + CDN `no-referrer` + 서버 URL 미로깅) · 이메일 **열거 불가**(항상 링크 발송) · auth는 sensitive 레이트리밋
- **config**(`server/config.ts`) — `appOrigin`(매직링크 절대 URL · `LANSMARK_APP_ORIGIN`, dev는 `http://localhost:port`)
- ⚠ **HUMAN GATE**: 이메일 제공자 키 + `LANSMARK_APP_ORIGIN` 미설정 → dev는 화면에 링크 표시·운영은 **fail-closed**(`AUTH_NOT_CONFIGURED`, 링크 비노출). featureMap `user-account` 갱신(이메일 병행·emailSender)

## 0.42.0 — 2026-06-09 · 웹푸시 알림 다리(M1) — 무과금 앱 푸시(SMS 대체) opt-in
> 사용자 선택대로 SMS 과금을 피하고 무료 브라우저/PWA 푸시로 전환(ROADMAP M1). 구독+표시 다리 live, 실발송=HUMAN GATE. tsc·vitest **400**(+7 push)·arch 0(34기능·51엔드포인트).
- **웹푸시 opt-in**(`dashboard/lansmark_app.html` 알림 모달) — **'🔔 이 브라우저로 알림 받기(무료·문자 불필요)'**: 권한 요청 → `serviceWorker.pushManager.subscribe` → `/api/push/subscribe` 저장. VAPID 미설정이면 **'준비 중'** 정직 안내(거짓 '켜짐' 금지)
- **서비스워커 핸들러**(`dashboard/sw.js`) — `push`(서버 페이로드→알림 표시)·`notificationclick`(열린 앱 탭 포커스/없으면 새 창). 안전 기본값·중복 탭 방지
- **엔드포인트 3종**(`server/routes/push.ts`) — `GET /api/push/vapid`(공개키+configured)·`POST /api/push/subscribe`·`POST /api/push/unsubscribe`. 구독 스토어=`integrations/push.ts` `InMemoryPushSubscriptionStore`(endpoint dedupe·DoS cap)
- **보안**(qwen 1차 + Claude 레드팀) — endpoint **https URL만 허용**(발송기 SSRF 입력 위생; 실 사설IP 차단은 발송 시점 seam TODO) · cropId/키 **길이 상한**(메모리 그리핑) · subscribe/unsubscribe **민감 RL 버킷**(`SENSITIVE_RE`) · 구독 endpoint/키 **로그·응답 비노출**(PII)
- ⚠ **HUMAN GATE**: 실제 발송(`LiveWebPushSender`: VAPID JWT ES256 + aes128gcm)·VAPID 키 생성 미완 → 그 전까지 `ConsolePushSender`(ok:false 정직 폴백). 구독 영속(File store)=follow-up
- **featureMap** `web-push` 기능 등록 · 알림 채널을 SMS(`alert-subscribe`)에서 무과금 앱 푸시로 승격

## 0.41.0 — 2026-06-09 · 모바일 헤더 정리 — 보조 액션 '⋯ 더보기' 메뉴
> 모바일 헤더 5줄 줄바꿈 클러터 제거(ROADMAP U1). tsc·vitest 393·arch 0.
- **헤더 정리**(`dashboard/lansmark_app.html`) — 모바일(≤600px)에서 보조 액션(저장·불러오기·PDF·공유·초기화)을 **'⋯ 더보기' 드롭다운**으로 묶음. 데스크탑(>600px)은 인라인 유지. 항목선택·외부클릭 시 닫힘. 버튼 ID/리스너 그대로(래핑만)·CSP-safe

## 0.40.0 — 2026-06-09 · 첫 방문 웰컴 온보딩 — 빈 지도 이탈 방지
> "처음에 지도만 덩그러니 보이면 이탈" 우려 해소. 첫 사용자 활성화↑. 에뮬 검증 · tsc·vitest 393·arch 0.
- **첫 방문 웰컴 코치**(`dashboard/lansmark_app.html`·1회) — 환영 + **3단계 흐름**(① 지도에서 땅 탭 ② 무료 작물 추천 ③ 작물 눌러 예상 소득 P10/50/90 + 근거) + **능동 CTA**(📍 내 위치에서 시작 · 🧭 귀농 자가진단 30초 · 지도 둘러보기) + 무료베타·면책 고지
- 기존엔 **첫 방문자에게 기술 릴리스노트 팝업**이 떠 농부 온보딩에 부적합 → `checkVersion`에서 첫 방문(seen=null)은 `showWelcome()`로 분기, **재방문+신버전은 변경점 팝업 유지**(역할 분리)
- 내 위치 CTA=기존 검색 geo 버튼 재사용 · 자가진단=`openAssess` 재사용(중복 0) · vmodal 패턴·CSP-safe·esc
- 기존 수동 안내(지도 힌트 pill ①②③·빈상태 자가진단)는 보조로 유지 · 프론트 전용

## 0.39.0 — 2026-06-09 · PWA 쉘 — 설치형 모바일 앱 (manifest·서비스워커·아이콘)
> 모바일 로드맵 키스톤(웹푸시의 토대). 에뮬레이터(API35) 검증 후 실기기. tsc·vitest **393**·arch 0.
- **PWA 쉘** — `manifest.webmanifest`(standalone·테마 #2e7d32·`/icon.svg`) + `sw.js`(앱 쉘 **네트워크-우선 캐시**·오프라인 폴백·`/api` 캐시 제외) + `icon.svg`(placeholder). `dashboard/lansmark_app.html` head에 manifest/theme/apple-touch-icon + SW 등록 스크립트. 모바일 전환 SMS→웹푸시의 토대
- **서빙**(`pages.ts`) — `/manifest.webmanifest`(application/manifest+json)·`/sw.js`(text/javascript + `Service-Worker-Allowed: /`)·`/icon.svg`(image/svg+xml). featureMap `pwa-shell` 기능 등록
- **검증** — 에셋 content-type curl ✓ · 에뮬레이터(jupa_api35·411px CSS)·실기기 앱 로드 ✓. ⚠ **SW 등록/설치는 보안컨텍스트(localhost·HTTPS) 필요** — 에뮬 `adb reverse` 불안정으로 SW-active/오프라인/설치 검증은 실기기 localhost 또는 배포 HTTPS에서(10.0.2.2는 reachable하나 보안컨텍스트 아님)
- 아이콘=placeholder(실디자인 HUMAN GATE) · 모바일 로드맵: PWA(완료)→웹푸시 알람→이메일 매직링크 로그인

## 0.38.0 — 2026-06-09 · 운영 보안 — 감사 로그 영속화 + SECURITY 런북 + 실기기 검증
> 보안 포스처 감사 후속. 코드 보호는 견고 — 갭은 운영 HUMAN GATE(TLS·키). tsc·vitest **393**·arch 0.
- **감사 로그 영속화(#4)** — `ctx.logOps`가 보안 이벤트(로그인·실효·결제·게이트 토글·일지 삭제)를 `audit.jsonl`에 **append-only(0600·재시작 보존)** 기록. 기존 메모리 링버퍼(40)는 콘솔 표시용 유지. 사고대응·PIPA 추적 durable화. file 모드만(memory는 휘발)
- **SECURITY.md** 운영 보안 런북 — ① 배포 직전 HUMAN GATE(TLS·`ENTITLEMENT/ACCOUNT/DATA_KEY/ADMIN`·`PG_WEBHOOK`·`TOSS` 키·CORS) ② 코드 내장 보호 목록 ③ 키 관리(DATA_KEY 백업·회전) ④ 사고 대응(revoke·세션파기) ⑤ 강화 로드맵
- **실기기 모바일 검증** — Galaxy Note 20(SM-N981N·CSS 384px)에서 adb reverse 터널로 바텀시트 확인: 접힘=지도 풀스크린+시트 peek / 펼침=86vh 분석결과 / 버전 팝업 렌더 OK
- 회귀 +2(감사로그 file/memory) · #5 세션 httpOnly 쿠키·PWA 쉘은 후속 슬라이스

## 0.37.0 — 2026-06-09 · 결제-구매자 바인딩 — bearer 토큰 선점 차단 (레드팀 #3 해소)
> ②(추천 순서 2번). 결제 시 엔티틀먼트를 구매자 계정에 결속 → 토큰을 훔쳐도 타 계정 연결 불가. tsc·vitest **391**·arch 0.
- **구매자 결속**(`boundAccount`) — `/api/pay/confirm`이 로그인 세션→계정을 엔티틀먼트에 결속. `link-entitlement`는 `boundAccount`가 본인 계정과 다르면 **403 ENTITLEMENT_BOUND_OTHER** → 유효 토큰 선점(bearer) 차단. 배선: `SimulationEntitlement.boundAccount` + `confirm.ts` 전달 + payment 라우트 세션 해석 + account 라우트 검증
- **범위**: confirm 경로(사용자 브라우저·세션)만 결속. 웹훅(서버-서버·세션 없음)·mock은 미결속 → 기존 1-jti-1계정 배타성으로 보호(완전 결속은 주문생성 시 order→account 매핑 필요·후속)
- **멀티모델 검증 + 폴백 실증**: `panel-review --diff`로 Gemini·Codex·qwen 병렬 적대리뷰 → **Codex가 usage limit(토큰 소진)에 걸리자 자동 폴백(gemini+qwen+Claude)으로 무중단**(사장님 폴백 규칙 실전 작동). gemini 3건은 전부 **기존 문서화 항목**(subjectHash 폴백·멀티인스턴스 race·anonId 이관) — boundAccount 코드엔 신규 결함 0
- 회귀 +1(결속 위반 403)

## 0.36.0 — 2026-06-09 · 모바일 바텀시트 — 지도 풀스크린 + 하단 시트 패널 (모바일 1단계)
> 모바일 전환 착수. 사장님 결정: SMS 폐기(비용) → 모바일=**PWA**·알람=**웹푸시**·로그인=**이메일 매직링크**. 이번은 ③ 바텀시트(추천 순서 1번). tsc·vitest **390**·arch 0.
- **모바일 바텀시트**(`dashboard/lansmark_app.html`) — 폰(≤600px)에서 패널을 하단 시트로 오버레이(네이버/카카오 지도 패턴). 지도 풀스크린 + 핸들 탭 펼침/접힘(peek 134px→expand 86vh) + 지도 탭 시 자동 펼침(결과 노출). 데스크탑·태블릿(>600px) 무변경
- **z-index 정합**: 시트 1200(지도·컨트롤 1000 위) / 모달·자동완성 3000(시트 위) → 충돌 없음. CSP-safe
- **모바일 로드맵**: ③(완료) → ② 결제-구매자 바인딩 → PWA 쉘(manifest+SW) → 웹푸시 알람(① SMS 대체·VAPID) → 이메일 매직링크 로그인(verifier+콜백+이메일 seam·HUMAN GATE)
- ⚠ 라이브 모바일 스크린샷은 Chrome 익스텐션 복구 후 검증 예정(현재 CSS·z-index·핸들 로직 코드 검증 완료)

## 0.35.0 — 2026-06-09 · 성능 최적화 — 응답 gzip + /api/version 다이어트 (실측 기반)
> "서버 딜레이·최적화" 질문 → 실측 후 조치. **서버 연산은 <1.1ms(병목 아님)**, 비용은 페이로드 전송. tsc·vitest **390**·arch 0 · curl 실증.
- **실측**: `/api/health` 0.99ms·`/api/config` 0.64ms·`/api/version` 0.56ms·`/api/simulate` 0.60ms·`/app` 1.09ms(로컬). 진짜 비용 = 크기: 앱 HTML **159KB**(비압축)·`/api/version` **27KB**(전체 릴리스)
- **gzip 응답 압축**(`respond.sendHtml`) — `Accept-Encoding: gzip` 협상 시 압축. 앱 HTML **159KB→50KB(~69%↓)**(curl 검증·`Content-Encoding: gzip`). `Vary: Accept-Encoding`. nonce 주입 후 압축(요청별 동적이라 캐시는 불가하나 대역폭 이득 큼). 모바일 4G 첫로드 체감 대폭↓
- **/api/version 다이어트** — 전체 릴리스 → `RELEASES.slice(0,8)`(27KB→**10KB**). 변경점 팝업 델타엔 최신 8개로 충분
- **후속 최적화 후보(문서화·미실행)**: 핀 분석 워터폴(`landClass→recommend→terrain→parcel` 순차 await → 독립 3개 `Promise.all` 병렬) · 외부 API(geocode/KAMIS) 단기 캐시(KMA처럼) · 비핵심 스토어 flush throttle · 배포층 nginx 리버스프록시(gzip+TLS+정적캐시)/CDN

## 0.34.0 — 2026-06-09 · 보안 하드닝(멀티모델 패널 P2) — 계정 해시 시크릿 분리·토큰 길이 cap
> `panel-review`(Gemini·Codex·qwen **병렬** 적대리뷰 도구·신규)가 짚은 P2 2건을 Claude 트리아지 후 수정. 패널 자체도 이번에 `--diff`·병렬·dedup으로 개선(도구는 qwen 워크스페이스). tsc·vitest **390**·arch 0.
- **subjectHash 전용 시크릿 분리** — 계정 식별자 해시에 `LANSMARK_ACCOUNT_SECRET`(있으면) 사용 → 엔티틀먼트 시크릿을 회전해도 계정 조회(해시)가 안 깨짐. 미설정 시 엔티틀먼트 시크릿로 폴백(새 HUMAN GATE 불필요). 빈 키는 bootSafety(운영 강제)+dev ephemeral로 도달 불가
- **엔티틀먼트 토큰 길이 cap** — `verifyEntitlementToken`이 4096자 초과 토큰을 HMAC/base64/JSON 처리 *前* 즉시 거부 → 비정상 큰 헤더의 요청당 CPU/메모리 증폭(저비용 DoS) 차단
- **트리아지 기록**: 패널 findings 중 devHint 노출=**오탐**(verifier.ts `isProd` 게이트가 diff 밖이라 컨텍스트-갭) · link-anon anonId IDOR=**기존 문서화**(비암호학적 격리·LEGAL_CHECKLIST) · 토큰 payload 스키마검증=HMAC가 위조 차단(비악용)으로 기각
- 회귀 +1(oversized token 거부)

## 0.33.0 — 2026-06-08 · 유료-계정 연계 + 4모델 파이프라인 실증
> 사장님 결정 슬라이스. **첫 4모델 7단계 파이프라인을 실제로 가동** — codex(gpt-5.5)·gemini(flash) CLI를 Bash로 호출. 인증 최고위험 → 다모델 적대검증. tsc·vitest **389**·arch 0.
- **유료-계정 연계** — 로그인 계정(acct:Z)에 엔티틀먼트 `jti`를 귀속 → 결제가 기기 보유 토큰이 아니라 **계정**을 따라감(타기기 pro 유지). `POST /api/account/link-entitlement`(세션 필수·`assertPaidEntitlement` 검증·**1 jti=1 계정 409**·멱등·감사로그·`account/link` sensitive 레이트리밋) + `/api/account/me`에 `pro`·`entitlementCount`
- **4모델 파이프라인 실증(7단계)** — ①감독(Claude) ②사전리뷰(**Gemini Flash**·설계 4건) ③사전레드팀(Claude) ④코딩(**Codex gpt-5.5** 초안→Claude 적용·검토) ⑤사후레드팀(**Codex·Gemini·qwen**+Claude) ⑥사후리뷰(**qwen** 전수=`[]`) ⑦감독승인(Claude)
- **fix(레드팀 확정 2건 — Codex·Gemini가 독립적으로 동일 지목, Claude 선행 패스·qwen은 미검출)**:
  - **#1 만료 토큰이 pro로 유지** — `/me`가 `isRevoked`만 보고 `exp` 미검사 → 토큰 만료 후에도 pro=true 영구. `SimulationEntitlement.exp` 노출 + 계정에 `{jti,exp}` 저장 + `/me`에서 `exp>now` 검사
  - **#2 동시 연결 lost-update** — `acct` 클론을 `await assertPaidEntitlement` *前* 읽고 *後* 덮어쓰는 read-modify-write라 병렬 요청이 서로의 jti를 지움(내 ⑤ "동기라 안전" 판단을 codex가 정정) → `accountStore.linkEntitlement`(배타성+추가를 **await 없는 단일 동기 블록**)로 원자화
- **flag(후속·미수정)**: #3 bearer 토큰 선점(유효 토큰 첫 제출 계정에 귀속 — 구매자 바인딩은 결제연동 후속) · #4 멀티인스턴스 중복 귀속(파일락 없음 — DB 유니크 인덱스=DB 어댑터 seam). 둘 다 단일인스턴스/현 모델에선 비현실화, 문서화
- **멀티모델 폴백 체인** 규약화(토큰/크레딧 소진 시 주→2순위→qwen/Claude로 자동 강등, 무중단) · 회귀 +3(연결·me.pro·409·만료)

## 0.32.0 — 2026-06-08 · 휴대폰 OTP 로그인 + 로그인/내 계정 UI (가입 흐름 완성)
> 사장님 '1번 추천' — 코어 위에 휴대폰 OTP verifier를 올리고 로그인/마이페이지 UI를 붙임. 인증 최고위험 → qwen vote3=**0** + 적대검토 + 런타임 스모크. tsc·vitest **386**·arch 0.
- **휴대폰 OTP**(`PhoneOtpVerifier`) — 기존 `smsSender` seam 재사용. start: 전화 정규화→6자리 난수 코드→SMS 발송. **키 있으면 실발송(코드 비노출)** / **dev는 미발송이라 devHint로 코드 노출(테스트)** / **운영+키없음은 `503 AUTH_NOT_CONFIGURED`(코드 비노출·fail-closed)**. verify: 코드 검증 + 챌린지당 시도 상한(brute-force)
- **로그인/내 계정 UI**(`dashboard/lansmark_app.html`) — 헤더 '로그인' 버튼 → 2단계 모달(번호→인증번호 6자리) → `auth/start`→`auth/verify`→세션을 `localStorage`에 저장 → **`link-anon`으로 기존 익명 일지 자동 이관**(\"기존 일지 N건 연결됨\"). 로그인 시 '👤 계정'(가입정보·로그아웃). 세션 헤더(`x-lansmark-session`)를 jget/jpost 전체에 동봉
- **보안** — 잘못된 번호 `400 BAD_PHONE` · 미지원 method(kakao/email) `503` · OTP 시도 상한 · 운영 fail-closed. 로그인=휴대폰 동의 고지 + 처리방침 링크. 모달은 검증된 알림모달 패턴(CSP-safe `addEventListener`·`esc`·전화 자동하이픈) 재사용
- **SMS 실발송 = HUMAN GATE** — 알리고/네이버 SENS/CoolSMS 키 + 동의화면 '위탁·제3자 제공' 고지(`smsSender.ts` 주석) 추가 후 `LiveSmsSender` 드롭인. 카카오/이메일은 같은 `AuthVerifier`로 추가
- 검증: qwen vote3=0 + 적대검토 + 런타임 스모크(start→devHint 318057→verify→세션·isNew) · 회귀 +1(BAD_PHONE) · 유료 모드의 결제-계정 연계는 후속

## 0.31.0 — 2026-06-08 · 계정·세션 코어 + 익명→계정 이관 (가입 기반 서비스 토대)
> 사장님 결정('코어만 먼저' + 네이버/카카오맵·농사로 BM). 익명→가입→계정 신원 + 익명 일지 이관을 MockVerifier로 end-to-end 완성. 인증 최고위험 → qwen vote3=**0** + Claude 적대검토(**계정탈취 1건 확정·수정**) + 런타임 스모크. tsc·vitest **385**·arch 0.
- **계정·세션 코어** — 신원 3종: `anon-Y`(기기)·`order:X`(결제)·**`acct:Z`(계정)**. `accountStore`/`sessionStore`(memory|file·영속) + 세션(무작위 192bit 토큰·30일 만료). 무료 베타 일지 신원 해석에 **세션 우선**(로그인 시 계정 귀속, 없으면 익명ID)
- **익명→계정 이관**(`POST /api/account/link-anon`) — 로그인 세션 + 브라우저 anonId → 기존 익명 일지를 `acct:Z`로 재귀속. (BM: 네이버/카카오 '로그인하면 내 장소·기록이 따라온다' = LENSMARK 최대 갭이었던 '저장→로그인 동기화'를 메움)
- **인증 검증기 seam**(`verifier.ts`) — dev=`MockVerifier`(코드 000000·devHint), 실제(휴대폰 OTP·카카오·이메일)는 키 확보 시 드롭인(HUMAN GATE). 원 식별자(전화/이메일) **미저장** — `authRef.subjectHash`(HMAC keyed-hash)만(오프라인 열거 차단·PII 최소화)
- **fix(보안·적대검토 확정)** — `ctx.verifier`가 운영에서도 mock이면 **'아무 번호나 000000으로 로그인=계정 탈취'**. → `DisabledVerifier`로 운영(prod) fail-closed(실제 검증기 전까지 `503 AUTH_NOT_CONFIGURED`) + 챌린지당 시도 상한(brute-force 차단) + `/api/account/auth`를 sensitive 레이트리밋
- **BM 점검 결과** — 네이버/카카오맵·농사로 사용자흐름 대조: 지도 표준(검색 토글·내 위치·3종 레이어)은 **이미 동급** / 농사로 영농일지는 우리의 *소득예측 결속+플라이휠*로 차별화 / 카카오 즐겨찾기 공개사고→비공개 교훈은 **익명격리·삭제권·암호화로 선반영**. 잔여 UX 여지(이번 작업 아님): 모바일 바텀시트·작물군 카테고리칩
- 회귀 +6(`accountRoutes.spec`) · `user-account` featureMap 등록(32기능·44엔드포인트) · 유료 모드의 결제-계정 연계는 후속

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
