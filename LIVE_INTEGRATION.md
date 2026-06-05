# 실연동 가이드 (LIVE_INTEGRATION)

> 원칙: **추측 금지**(CLAUDE.md #4). 외부 API 파서는 실제 응답/공식 코드표를 확인하고 작성한다.
> 미구현 통합은 `auto` provider가 **mock으로 자동 폴백**(크래시·조용한 오염 없음) → 키를 하나씩 붙이며 점진 전환.

## 현재 상태 (`/api/health`·`/ops`의 `integrationReadiness`와 일치)

| 통합 | 키만 꽂으면? | 상태 | 끝내려면 필요한 것 |
|---|---|---|---|
| VWorld **지오코딩**(주소→좌표/PNU) | ✅ | 구현 완료 | `VWORLD_API_KEY` (live 응답 1회 검증 권장) |
| VWorld **필지경계**(WFS) | ✅ | 구현 완료 | `VWORLD_API_KEY` (동) |
| VWorld **위성/하이브리드 타일** | ✅ | 구현 완료(URL) | `VWORLD_API_KEY` |
| Toss **결제 승인 + 웹훅** | ✅ | 구현 완료 | `TOSS_CLIENT_KEY`·`TOSS_SECRET_KEY`·`PG_WEBHOOK_SECRET` (+ 운영은 주문레코드 저장소) |
| KMA **기후**(ASOS 일자료) | ✅ | **구현·실검증 완료** | `KMA_API_KEY` — 최근 1년 집계(겨울최저·연강수·일조). 실측: 전주 1,617mm·−10.4℃ |
| KAMIS **도매가** | ⚠️ apple만 | **파서 완료·apple 검증** | 나머지 작물 품목코드 — 공식 코드표 또는 `npm run capture`로 1건씩 검증(apple=400/411 9,102원/kg) |
| VWorld **DEM/지형** | ❌ | seam(throw→mock) | **3D Data API DEM 요청 URL 스펙 + 응답 샘플**(격자/높이 포맷) |
| RDA **소득 base**(수량·경영비) | ❌ | 구조 데모(verified:false) | **농진청 농산물소득조사 원본 수치**(공공데이터포털 'AMIS' 등) |

> **2026-06-03 실키 검증 결과**(키 4종 반영): VWorld 필지=실폴리곤 OK · KMA 기후=전주 1,617mm/−10.4℃ · KAMIS apple=8,988/9,102/9,366원/kg(P10/50/90). simulate(apple)에 실가격 반영 확인. **KAMIS 단위버그 발견·수정**: `convert_kg_yn` 미설정 시 원/박스(91,180) → `Y`로 원/kg(9,102).

## 끝내는 방법 — 둘 중 하나면 됩니다

### A. 키를 주시면(권장) — 제가 실제 응답을 보고 마무리
1. `.env.example` → `.env` 복사 후 보유 키 입력.
2. `npm run capture` 실행 → `samples/*`에 **원본 응답 저장**(키는 자동 마스킹).
3. `samples/*` 공유 → 그 실제 포맷대로 파서 작성 + 픽스처 테스트로 고정.
   - 캡처 대상: `vworld-geocode/parcel`, `kma-asos.txt`, `kamis-sample.json`.
   - DEM·RDA는 URL 스펙/데이터셋이 필요(아래 B).

### B. 샘플/문서를 직접 주시면
- KMA: `kma_sfcdd3.php` 응답 1건(또는 컬럼 정의) → 겨울최저/연강수/서리 매핑.
- KAMIS: 공식 **품목·품종 코드표** + 품목별 **가격단위**(원/kg 환산) → `kamisItemCodes.ts` verified 채움.
- VWorld DEM: 3D Data API(또는 대체 DEM 소스) 요청·응답 스펙 → `geo/dem.ts` 구현.
- RDA: 농산물소득조사 수치(작물별 10a 수량·경영비) → `rdaIncome.ts` verified:true 교체.

## 안전장치(이미 적용)
- `auto` provider 형태가드: live가 깨진/이상 응답을 주면 **mock 폴백**(`okClimate`/`okTerrain`/`okPrice`).
- 키 없으면 전부 mock, 키 있어도 미구현이면 mock — **언제나 무중단**.
- 운영 콘솔(`/ops`)에 통합별 "키 필요/미구현" 정직 표기.
