# RUN_GEOSTACK.md — 지오스택 실행 프롬프트 (Claude Code · Phase C)

## ▶ 붙여넣기 (기동 한 줄)
```
CLAUDE.md 읽고 8에이전트(.claude/agents) 활성화 후 GEOSTACK_PLAN.md·RUN_GEOSTACK.md 읽고
Stage 0→1→2→3 순서로 실행한다. Stage0은 키 없이 지금 바로, 1·2는 VWORLD_KEY HUMAN GATE.
매 변경 후 /verify(tsc+vitest 그린), 커밋 전 /guardrail, 좌표계 혼용·추측 금지. 작업마다 보고 후 다음.
```

## 미션
LANSMARK 지오스택 완성: **정부 API 실측 영상·필지·DEM을 정확한 좌표 위에 얹고 줌**으로 구현.
엔진(6축)·플라이휠·Dream·통합앱은 이미 완료(51 테스트) — **표현/데이터 연결만** 한다. 절차적 3D 생성 금지.

## 작업 방식 (에이전트 위임)
- 좌표/구조 검토 → **lansmark-architect** (CRS 단일화, mock↔live 타입 동일)
- 데이터 연동 주도 → **lansmark-data-integration** (VWorld 타일/WFS/DEM, 키=env, 출처표기)
- 앱/지도 표현 → **lansmark-frontend-ux** (줌·필지선택 UX, 좌표 정합)
- 지형 수치 → **lansmark-engine-quant** (DEM→경사/향/표고 산출 정확성)
- 커밋 전 게이트 → **/guardrail**(lansmark-guardrail) + **/verify**(lansmark-qa)
- 외부 API 스펙은 공식 docs 확인 후 구현. 모르면 TODO+seam 유지하고 보고(추측 금지).

## 실행 순서 (상세는 GEOSTACK_PLAN.md)
### Stage 0 — 좌표표준 + 골격 ✅ 완료
- `geo/crs.ts`(4326/3857/5179 + 타일 변환), `geo/types.ts`(LatLng/Pnu/ParcelGeo/DemGrid), `tests/geoCrs.spec.ts`
- **DONE**: 좌표 변환이 crs.ts 한 곳, tsc+vitest 그린.

### Stage 1 — 실타일 + 필지 (A) · ⛔ VWORLD_KEY
- `geo/vworld.ts`(WMTS URL 빌더 + WFS 필지조회→ParcelGeo, 키=env, mock 폴백)
- `data/providers/live.ts` geocode(주소→WGS84, **DB 저장 금지**)
- 앱: 배경→VWorld `Satellite`/`Hybrid`(z5~19), 격자→WFS `LP_PA_CBND_*` 필지 선택
- **DONE**: 키 있으면 실위성+실필지, 없으면 mock, 그린.

### Stage 2 — DEM→경사/향/표고 (B) · ⛔ VWORLD_KEY · C·A 위에서
- `geo/dem.ts`(필지 bbox만 3D Data API 레벨≤15 부분요청→DemGrid)
- `geo/terrainFromDem.ts`(DEM→`{slopeDegree,aspect,altitudeM}` = core/terrain 입력형)
- `LAND_API.terrain` + provider terrain seam에 주입, `tests/terrainFromDem.spec.ts`
- **DONE**: mock 지형→실측 지형 보정 전환, 엔진 6축 반영, 그린.

### Stage 3 — 표현 통합 (선택 2.5D)
- 실타일+실필지+실지형 → 추천→시뮬(P10/50/90) end-to-end. 선택: MapLibre+DEM 2.5D.
- `/guardrail`+`/verify` 통과 후 마감.

## ⛔ HUMAN GATE (위조 금지 → 요청 후 대기)
- **VWORLD_KEY(운영키)** — 활용 API에 WMTS/TMS·WMS/WFS·2D데이터·3D Data 체크 필요. `.env.example`에 추가.
- 영상 타일 사용량/캐싱 약관 · DEM 부분요청만 · geocode 비저장.
키 전이면 **mock 타일/필지/지형으로 구조까지** 만들고 보고 → 다음 Stage.

## 보고 형식
```
[Stage x] 제목
- 위임 에이전트: …
- 변경/생성 파일: …
- /guardrail: pass | /verify: green N passed
- HUMAN GATE: (대기 항목 or 없음)
- 다음: …
```

## ✅ 완성 정의 (DONE)
1. 좌표 단일화(crs.ts) — 타일·필지·지형이 같은 좌표 위 정합
2. (키) 실위성 줌 → 실필지 선택 → 실DEM 경사/향/표고 → 6축 보정 → P10/50/90
3. 신규 테스트 포함 tsc+vitest 그린, /guardrail pass

## 시작
```
Stage 0은 완료됨(58 테스트). Stage 1부터: VWORLD_KEY 확인 → geo/vworld.ts(타일·WFS) + 앱 타일/필지.
그다음 VWORLD_KEY 필요한 Stage 1로 진입(키 없으면 mock으로 구조까지 + 요청).
```
