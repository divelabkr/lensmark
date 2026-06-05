# LANSMARK — 남은 연결부(SEAMS)만 정리

> 원칙: **기능은 전부 구현 완료. 집에서는 아래 3개 seam만 연결하면 실서비스 데모.**

## ✅ 구현 완료 (코드 + 29 테스트 + typecheck 통과)
| 영역 | 모듈 |
|---|---|
| 후보 추천 | core/cropSuitability, simulator, rankCandidates |
| 시뮬레이션 | core/yield, cost, revenue, income, planting, uncertainty(독립분산), validate |
| 권한 검증 | policy/entitlement (HMAC, fail-closed, timing-safe) |
| 소일 정책 | policy/soilPolicy (제한 API fail-closed) |
| 생육 캘린더 | core/calendar + data/cropCalendar.seed (15작물) |
| 병해충 | core/growthRisk + data/cropPests.seed (15작물) |
| 폴리곤 면적 | core/geo.polygonAreaM2 |
| 리포트 | core/report.buildReportModel |
| 공유 링크 | share.encode/decodeShareState |
| 피드백 수집 | api/feedback.route + db/repository.saveFeedback |
| DB 리포지토리 | db/repository (prisma 주입형) |
| 하드닝 | api/_rateLimit (인메모리) |
| 대시보드 | lansmark_dashboard_v5.html (지도+그리기+캘린더+병해충+PDF+공유) |

## 🔌 SEAM 1 — 데이터 API (VWorld / KMA / KAMIS)
- 위치: `src/lansmark/data/providers/live.ts` (mock↔live 스위치는 `index.ts` + 환경변수 `LANSMARK_DATA_MODE`)
- 할 일: 3개 fetch 바디 작성 + KAMIS 품목코드 검증 (`data/kamisItemCodes.ts`)
- 참고: `CODEX_LIVE_PROVIDERS.md`
- 대시보드: `LANSMARK_API.mode="live"` + `baseUrl` (응답→화면 매핑 `mapApiResult` 완비)

## 🔌 SEAM 2 — 권한 / 결제
- 위치: `policy/entitlement.ts` (검증 로직 완성) → 결제 성공 webhook에서 `mintEntitlementToken(...)` 호출만 연결
- 유료 라우트: `api/paid-simulation.route.example.ts` (이미 `assertPaidEntitlement` 적용)
- 할 일: PG(토스/아임포트 등) webhook → 토큰 발급 → 클라이언트 헤더 `x-lansmark-entitlement`

## 🔌 SEAM 3 — DB 연결
- 위치: `db/repository.ts` (`createRepository(prisma)` 주입형)
- 할 일: prisma 스키마 마이그레이션 + `prisma` 인스턴스 주입 (라우트 TODO 주석 해제)

## 집에서 할 일 (체크리스트)
- [ ] live.ts: VWorld geocode fetch
- [ ] live.ts: KMA climate fetch
- [ ] live.ts: KAMIS price fetch + 품목코드 검증
- [ ] `LANSMARK_DATA_MODE=live` / 대시보드 `mode="live"`+`baseUrl`
- [ ] 결제 webhook → mintEntitlementToken
- [ ] prisma 마이그레이션 + repository 주입
- [ ] (KR 프로덕션) 지도 OSM → Kakao/Naver/VWorld 교체
- [ ] 작물 15종 수치 전문가 보정
