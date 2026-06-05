# LANSMARK — 턴키 인수인계 (QUICKSTART)

이 패키지는 **API 없이도 전체 무료→유료 흐름이 동작**하는 상태다.
집에서는 **실연동 함수 3개 + 결제 webhook 1곳**만 채우면 된다.

## 0. 검증 완료 (이 패키지 기준)
- `tsc --noEmit` ✅ 통과
- `vitest run` ✅ **20/20 통과** (validate / uncertainty / soilPolicy / entitlement / cost / simulator)
- `npm run demo` ✅ mock E2E 완주

## 1. 바로 실행
```bash
npm install
npm run typecheck     # 타입 검사
npm test              # 테스트 20개
npm run demo          # 주소→후보→유료시뮬→결제토큰 mock 데모
```

## 2. 집에서 채울 것 (이것만 하면 런칭 경로 열림)

### (A) 실데이터 연동 — `src/lansmark/data/providers/live.ts` 함수 3개
| 함수 | API | 할 일 |
|---|---|---|
| `land.geocode` | VWorld | 주소→좌표/PNU fetch+parse |
| `land.climate` | KMA | 좌표→기후(강수/최저기온/서리) fetch+parse |
| `price.recentWholesale` | KAMIS/aT | cropId→품목코드 + 최근가→P10/P50/P90 |

→ 엔드포인트 URL·env 키 사용법은 파일 안 TODO 주석에 명시됨.
→ 전환: `.env`에 `LANSMARK_DATA_MODE=live`. 나머지 앱 코드는 **인터페이스에만 의존**하므로 무변경.
→ 한 개씩 구현 가능(나머지는 mock 유지하며 점진 전환).

### (B) 결제 → 권한 토큰 — 결제 webhook 성공 핸들러
```ts
import { mintEntitlementToken } from "@/src/lansmark/policy/entitlement";
// 결제 검증 성공 후:
const token = mintEntitlementToken({ userId, exp: Date.now() + 24*3600*1000 });
// 이 token을 프론트에 전달 → 유료 호출 시 헤더 x-lansmark-entitlement 로 전송
```
- `.env`에 `LANSMARK_ENTITLEMENT_SECRET` (랜덤 32바이트+) 필수.
- 유료 라우트는 이미 `assertPaidEntitlement(req.headers)`로 fail-closed 검증함.
- ⚠️ 이 라우트는 node 런타임 필요(edge X — node:crypto 사용).

### (C) DB 영속화 (선택)
`prisma/schema-addon.prisma`를 머지 → 유료 run을 `LansmarkSimulationRun`(userId 필수 권장)에 저장.
실측 피드백은 `LansmarkFeedbackLog`에 누적(→ 추후 ML 보정 Phase 1).

## 3. 포함된 것
```txt
src/lansmark/
  core/        validate, uncertainty, calibration(ML seam), simulator, enrich, yield/cost/revenue/income/planting, cropSuitability
  policy/      entitlement(HMAC/fail-closed), soilPolicy(fail-closed), disclaimer
  data/
    crops.seed.ts          작물 15종 (illustrative — 전문가 보정 전)
    providers/             types / mock / live(스캐폴드) / index(스위치)
  api/         free / paid 라우트 예시 (Next.js App Router)
  components/  후보카드 / 결과표 (예시)
  tests/       6개 spec (20 테스트)
scripts/mockRun.ts         mock E2E 데모
package.json tsconfig.json vitest.config.ts
```

## 4. 다음 단계(권장 순서)
1. (A) provider 3개 + (B) 결제 webhook → 유료 경로 E2E
2. UI 연결(입력폼/후보카드/결과표) — components 예시 확장
3. 작물 시드 수치 전문가 보정
4. PDF/공유 + 피드백 로깅 → ML 보정(calibration.ts 교체, GBT)
