# GEOSTACK_PLAN.md — LANSMARK 지오스택 계획서 (Phase C)

> 범위: 엔진(6축)·플라이휠·Dream·통합앱은 **완료(51 테스트)**. 이 계획은 **실측 지형/영상/필지를 좌표 위에 얹고 줌**하는 지오스택만 다룬다.
> 원칙: 절차적 3D를 만들지 않는다 — **정부 API의 실측 데이터 + 정확한 좌표 + 맵엔진 줌**으로 구현한다.
> 짝 문서: `CLAUDE.md`(규칙·8에이전트), `RUN_GEOSTACK.md`(실행 프롬프트), `LANSMARK_HANDOFF.md`(전체 현황).

## 0. 핵심 원칙 (왜 이 순서인가)
좌표(C)가 안 서면 영상(A)·지형(B) 위치가 통째로 틀어진다. → **C(좌표표준) 먼저, 그 위에 A·B.**
```
[Stage0 좌표표준/골격] ──┬──▶ [Stage1 실타일+필지(A)]
                         └──▶ [Stage2 DEM→경사/향(B)] ──▶ terrain 엔진(6축) ──▶ 시뮬
                                          └──────────────▶ [Stage3 표현 통합]
```

## 1. 좌표 표준 (backbone · 제일 먼저 고정)
| 용도 | 좌표계 | 비고 |
|---|---|---|
| **앱 기준 좌표** | WGS84 **EPSG:4326** (lat/lng) | 진실의 기준. geocode 결과가 이것 |
| **지도 타일** | Web Mercator **EPSG:3857** | XYZ z/y/x. 맵엔진이 4326↔3857 자동 변환 |
| VWorld 내부 | UTM-K **EPSG:5179** | 인지만. 필요 시 proj4로 변환(선택 의존성) |
| **필지 식별** | **PNU**(필지고유번호) | "이 땅"의 ID |
**규칙 한 줄**: 앱 내부 좌표는 전부 WGS84로 통일, 타일만 메르카토르, 변환은 맵엔진(Leaflet/MapLibre/OpenLayers)에 위임. **CRS 혼용 금지(=1번 버그원).**

## 2. 레이어 → 정부 API 매핑
| 레이어 | API · 레이어명 | 방식 | 줌/주의 |
|---|---|---|---|
| 위성·항공영상(줌 본체) | VWorld WMTS `Satellite`(jpeg)/`Hybrid`(png) | XYZ | z5~19 |
| 배경/라벨 | VWorld WMTS `Base`/`gray` | XYZ | z5~19 |
| 필지경계 | VWorld WMS/WFS `LP_PA_CBND_BUBUN`(부번)/`BONBUN`(본번) | WMS/WFS | 폴리곤 |
| DEM(경사/향/표고) | VWorld **3D Data API(DEM)** | OPEN API | 레벨≤15(~1.5m), **영역 부분요청만** |
| 등고선/지형지물 | 공공데이터 "등고선" / VWorld 수치지형도 | WMS/파일 | 보조 |
| 식생(NDVI) | Sentinel | 래스터 | 보조 |

## 3. 단계 계획 (Stage)
### Stage 0 — 좌표표준 + 골격 ✅ 완료 (geo/crs.ts·types.ts·geoCrs.spec.ts · 58 테스트)
| 작업 | 파일 | 내용 | 검증 |
|---|---|---|---|
| CRS 상수·헬퍼 | `src/lansmark/geo/crs.ts` | 4326/3857/5179 상수, `lonLatToTile(lng,lat,z)`/`tileToLonLat`, slippy 공식 | 타일 왕복 테스트 |
| 지오 타입 | `src/lansmark/geo/types.ts` | `LatLng`, `Pnu`, `ParcelGeo{pnu,center:LatLng,polygon:LatLng[]}`, `DemGrid` | 타입체크 |
| 테스트 | `tests/geoCrs.spec.ts` | 알려진 좌표→타일 인덱스 일치, 왕복 | vitest |
- **DONE**: `tsc+vitest` 그린, 좌표 변환이 한 곳(crs.ts)에서만.

### Stage 1 — 실타일 + 필지 (A) · 🟡 코드+mock 완료, live=⛔VWORLD_KEY
| 작업 | 파일 | 내용 | 검증 |
|---|---|---|---|
| VWorld 클라 | `src/lansmark/geo/vworld.ts` | WMTS 타일 URL 빌더(layer 선택), WFS 필지조회(point/bbox→`ParcelGeo`), 키=env, **mock 폴백** | URL 빌더·파싱 테스트 |
| 지오코딩 | `data/providers/live.ts` geocode | 주소→WGS84 (CODEX A1과 동일) · **결과 DB 저장 금지** | mock 타입 일치 |
| 앱 타일 | `dashboard/lansmark_app.html` | 배경 → VWorld `Satellite`/`Hybrid`, `LANSMARK_API.tileKey` | 시각 확인 |
| 앱 필지 | 〃 | 격자 → WFS 필지폴리곤 선택 | 실제 필지 클릭 |
- ⛔ HUMAN GATE: VWorld 운영키. 키 전이면 **mock 타일/필지로 구조까지** + 보고.
- **DONE**: 키 있으면 실위성+실필지, 없으면 mock, 그린.

### Stage 2 — DEM→경사/향/표고 (B) · 🟡 코드+mock 완료, live=⛔VWORLD_KEY
| 작업 | 파일 | 내용 | 검증 |
|---|---|---|---|
| DEM 취득 | `src/lansmark/geo/dem.ts` | 선택 필지 bbox만 VWorld 3D Data API(레벨≤15) 부분 요청 → `DemGrid` | mock grid |
| 지형 산출 | `src/lansmark/geo/terrainFromDem.ts` | DEM 경사도→`slopeDegree`, 향→`aspect`, 평균→`altitudeM` (= `core/terrain.ts` 입력형) | 합성 grid로 기지값 검증 |
| 주입 | `LAND_API.terrain`(앱) + provider terrain seam | 키 있으면 DEM 지형, 없으면 mock hash | 엔진 6축 반영 |
| 테스트 | `tests/terrainFromDem.spec.ts` | 경사면 grid → 경사·향 정확 | vitest |
- **DONE**: mock 지형 → **실측 지형 보정**으로 전환, 그린.

### Stage 3 — 표현 통합 (선택 2.5D)
- 실타일+실필지+실지형 → 추천→정밀시뮬(P10/50/90) end-to-end.
- 선택: MapLibre GL + DEM(raster-dem)로 2.5D 기복/hillshade.
- `/guardrail` + `/verify` 통과 후 마감.

## 4. 새 모듈 (전부 `src/lansmark/geo/`)
`crs.ts` · `types.ts` · `vworld.ts` · `dem.ts` · `terrainFromDem.ts` (+ 테스트 2개).
기존과의 연결: `core/terrain.ts`(6축 계수)는 그대로, **입력 지형을 mock→DEM 산출로 교체**할 뿐.

## 5. ⛔ HUMAN GATE / 라이선스 (위조 금지 · 요청 후 대기)
- **VWORLD_KEY(운영키)** — 활용 API에 WMTS/TMS·WMS/WFS·2D데이터·(DEM용)3D Data 체크.
- 위성·항공영상 **타일 사용량/캐싱 약관** 확인(무단 캐싱 주의).
- DEM **부분요청만**(전체 다운로드 불가).
- geocoder **결과 비저장(실시간)**.

## 6. 리스크
| 리스크 | 대응 |
|---|---|
| CRS 혼용 → 위치 오차 | Stage0에서 crs.ts 단일화 |
| 운영키 심사 지연 | mock 타일/필지로 선개발 |
| 영상 사용량 초과 | on-demand·캐싱 정책 준수 |
| DEM 부분요청 한계 | 필지 주변만 요청 |
| 본진(JUPA 8.28) 분산 | Stage0만 지금, 1·2는 키+여유 시 |

## 7. 완성 정의 (DONE)
1. 좌표 한 곳 고정(crs.ts), 타일/필지/지형이 동일 좌표 위 정합.
2. (키) 실위성 위 줌 → 실필지 선택 → 실DEM 경사/향/표고 → 6축 보정 → P10/50/90.
3. `tsc+vitest` 그린(신규 테스트 포함), `/guardrail` pass.

## 7.5 현재 구현 상태 (선제 완료)
- `geo/{crs,types,vworld,dem,terrainFromDem}.ts` 구현 · provider에 `parcel`/`terrain` 추가 · 엔진 자동 주입
- **mock 폴백으로 키 없이 동작** · `server/devServer.ts`(의존성0) → `npm run dev`로 즉시 기동
- live 전환 = `.env`에 `VWORLD_API_KEY` + `LANSMARK_DATA_MODE=live` (geocode/parcel/terrain 즉시 실연동; DEM 실 fetch와 climate/price는 잔여 seam)
- 테스트 65개 그린

## 7.6 backend seam 선제 구현 (키 없이 구조+테스트 완료)
- **KMA** `geo/kma.ts`: LCC 격자변환(서울→60,127 검증)·ASOS 최근접 지점·일자료 URL빌더 / 응답파싱=live seam
- **KAMIS** `geo/kamis.ts`: P10/50/90 백분위·도매 URL빌더·fetchWholesale(코드 미검증시 null→base 폴백) / 품목코드=seam
- **결제** `payment/pgWebhook.ts`: Toss 서명검증(HMAC-SHA256 base64)·신선도·멱등·DONE판정→엔티틀먼트 발급 · `payment/confirm.ts`: 금액검증(서버권위)→Toss confirm→발급
- 서버 엔드포인트: `POST /api/pg/webhook`·`POST /api/pay/confirm` 추가(서명 스모크테스트 통과)
- live 배선: `live.climate→fetchClimate`, `live.price→fetchWholesale`
- 테스트 77개 그린

## 8. 가드레일 리마인더
좌표 정확성=신뢰의 핵심. 소득은 **항상 P10/50/90**(단일값·보장 금지). geocode 비저장. base 출처·연도. 흙토람 미사용.
