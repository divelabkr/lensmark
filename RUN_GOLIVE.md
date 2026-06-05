# RUN_GOLIVE.md — "API만 붙이면 운영" 체크리스트

LANSMARK는 provider seam(mock↔live)으로 설계돼 **키를 추가하면 그 통합만 점진적으로 운영 전환**된다 (`LANSMARK_DATA_MODE=auto` 기본). 미구현/미키 통합은 **mock 폴백**이라 크래시 없이 무중단.

## 1) 준비
`cp .env.example .env` → 아래 키 채우기. 통합별 준비도는 **`GET /api/health`**로 확인(`integrations.*.keyed/live`).

## 2) 키 → 무엇이 켜지나
| 키 | 켜지는 것 | 상태 |
|---|---|---|
| `VWORLD_API_KEY` | 위성/하이브리드 **타일**, 주소→좌표/PNU **geocode**, **필지경계** parcel | ✅ 실구현 |
| 〃 (DEM) | **지형**(경사/향/표고) | ⚠ 3D DEM 응답 파싱 미구현 → mock 폴백. `geo/dem.ts fetchDem` 완성 필요 |
| `KMA_API_KEY` | **기후**(최저기온/서리/강수) | ⚠ ASOS 응답 파싱 미구현 → mock 폴백. `geo/kma.ts fetchClimate`(격자변환·URL은 구현됨) |
| `KAMIS_API_KEY` + `KAMIS_API_ID` | **도매가** P10/50/90 | ✅ 실구현 — 단 `data/providers/kamisItemCodes.ts` 품목코드 `verified:true` 필요(아니면 base 폴백) |
| `TOSS_CLIENT_KEY` + `TOSS_SECRET_KEY` | **실결제**(카드/간편) | ✅ 실구현(confirm) |
| `PG_WEBHOOK_SECRET` | 웹훅 서명검증 | ✅ 실구현(HMAC) |
| `LANSMARK_ENTITLEMENT_SECRET` | 유료권한 토큰 서명 | ✅ 운영은 **강한 랜덤값 필수**(dev 기본값 금지) |
| (실 RDA 소득자료) | 소득 base 정상화(음수 placeholder 해소) | `data/rdaIncome.ts getRdaBase` 로더 교체 → `verified:true` |

## 3) 운영 스위치(.env)
- `LANSMARK_DATA_MODE=auto` (기본) — 키 있는 통합만 live. `live`로 강제도 가능(키 없으면 throw, 운영 강제용).
- `LANSMARK_REQUIRE_ENTITLEMENT=true` (기본) — 정밀 시뮬 결제 강제(서버 게이트).
- `LANSMARK_SIM_PRICE_KRW=4900` — 정밀분석 단가.

## 4) 남은 실구현 (공식 docs 확인 후 — 추측 금지)
1. **VWorld 3D Data API(DEM)** 부분요청·높이격자 파싱 → `geo/dem.ts fetchDem`
2. **KMA ASOS/평년값** 고정폭 텍스트 파싱 → `geo/kma.ts fetchClimate`
3. **KAMIS 품목코드** 검증 → `data/providers/kamisItemCodes.ts`(`verified:true`)
4. **RDA 농축산물 소득자료** 로더 → `data/rdaIncome.ts`

→ 이 4개를 채우면 전 기능 live. 그 전까지도 **auto 폴백으로 무중단 운영** 가능(타일·필지·주소검색·결제는 키만 꽂으면 즉시 live).

## 5) 검증
`npm run typecheck && npm test` (tsc + vitest 그린) → `GET /api/health`로 통합별 keyed/live 확인 → 결제 흐름(잠금→결제→해제) 점검.
