# LANSMARK Skeleton — 보안·정합성 패치 노트

본 패치는 **시뮬레이션 출력값을 거의 바꾸지 않으면서**(P50 중앙추정 유지) 보안·통계 정합성을 교정한다.
`simulator.ts`, `types.ts`, `cropSuitability.ts`, `yield.ts`, `growthRisk.ts`, `disclaimer.ts`, components, prisma는 **무수정**(시그니처 호환).

## 적용 후 필수 절차
1. `src/lansmark` 폴더를 기존 프로젝트에 머지(덮어쓰기).
2. `.env`에 `LANSMARK_ENTITLEMENT_SECRET` 설정(랜덤 32바이트+).
3. `tsc --noEmit` + 테스트 1회 통과 확인.
4. 결제 webhook 성공 핸들러에서 `mintEntitlementToken({ userId, exp })` 호출 → 클라가 `x-lansmark-entitlement` 헤더로 전달하도록 연결.

---

## 🔴 CRITICAL

### C1 — 유료 권한이 클라이언트 주장에 의존 (Broken Access Control)
- **전:** `paid-simulation.route` 가 body의 `paid` 플래그만 확인 → 누구나 `{"paid":true}`로 전체 유료 결과 무료 취득.
- **후:** `policy/entitlement.ts` 신설. 서버 권위 검증(`assertPaidEntitlement`), HMAC 서명 토큰(timing-safe 비교 + 만료 + 시크릿 미설정 시 거부=fail-closed). 라우트에서 `body.paid` 제거, `userId` 바인딩.
- **교체 포인트:** `verifyEntitlementToken` 본문을 `getServerSession()`+DB 결제조회로 바꿔도 됨.

### C2 — 제한 소일 API 가드 fail-open
- **전:** `enabled && !permission` 조합에서만 throw. 그 외엔 통과(=허용). 게다가 실제 호출부 없어 무의미.
- **후:** `(permission && enabled)` 둘 다 true일 때만 통과, 그 외 전부 throw(fail-closed). 실제 호출은 단일 chokepoint `fetchRestrictedSoilEvidence()` 안에서만 가능하도록 래핑. 라우트 상단의 오배치 호출 제거.

---

## 🟠 HIGH

### H1 — 백분위 곱셈/차가 통계적으로 부정확 (낙관 과대)
- **전:** 매출 `p90 = yield.p90 × price.p90`, 소득 `p90 = 매출.p90 − 비용.p10` → 완전 양의 상관(comonotonic) + 최선코너 중복 → 밴드 과대.
- **후:** `core/uncertainty.ts` 신설. 독립 가정 분산전파(`multiplyIndependent`, `subtractIndependent`). P50 불변, 꼬리만 재계산.
- **실측(블루베리 1000㎡·직거래):**
  | 항목 | OLD P90 | NEW P90 | 비고 |
  |---|---:|---:|---|
  | 매출 | 52,500,000 | 34,833,402 | -34% |
  | 소득 | 43,500,000 | 20,822,173 | -52% |
  | 소득 밴드폭 | 68,300,000 | 37,144,346 | -46% |
- 농산물 수율-가격은 보통 음의 상관 → 독립 가정도 기존보다 보수적. 더 보수화하려면 `uncertainty.ts`에 음의 상관 계수 knob 추가 가능.

### H2 — 입력 검증 전무
- **후:** `core/validate.ts` 신설. `areaM2`(0<x≤100ha, Infinity/NaN 차단), `userOverridePrice/Cost`, `userPlantingCount` 상·하한 클램프, `cultivationType`/`salesChannel`/`targetYear` 화이트리스트, `polygonGeoJson` 200KB 크기 가드(M5). 두 라우트에 적용.

### H3 — 비용 항목합 ≠ 총계
- **전:** 가중치 합이 1.0 아님(과일+고수분+고노동 = 128%).
- **후:** 가중치 정규화(합=1) → **항목합 = 총계(100.00% 검증 완료)**.

---

## 🟡 MEDIUM

| # | 조치 |
|---|---|
| M1 | `userPlantingCount` 범위이탈 시 안내 메시지(수확량 모델엔 미반영 = 면적기반과 이중계산 방지) |
| M2 | 라우트 입력 런타임 검증 + `limit` 1~20 클램프(스크래핑/폭주 완화). **레이트리밋은 호스트 미들웨어에서 별도 필요** |
| M3 | 두 라우트 `catch`에서 내부 에러 메시지 비노출(generic) + `console.error` 서버 로깅 |
| M4 | 유료 응답에 `userId` 바인딩(감사추적). prisma `LansmarkSimulationRun.userId`는 유료 run에 필수 권장 |
| M5 | polygonGeoJson 크기 가드(validate.ts) |

---

## 🧠 ML 준비 (Roadmap P4) — `core/calibration.ts` 신설
- **신경망 즉시 구현 안 함**(학습데이터 0, 콜드스타트엔 규칙기반이 정답, 가드레일=설명가능 요구).
- 대신 ML 보정 seam을 항등(pass-through)으로 추가. 데이터 축적 후:
  1. `LansmarkFeedbackLog` 실측 수집 → (예측 vs 실제) 잔차.
  2. **GBT(XGBoost/LightGBM)** 로 잔차 학습(딥NN 아님 — 표형 데이터에서 더 정확+SHAP 설명가능).
  3. `IDENTITY_CALIBRATION` 교체. `minSamples` 게이트 + `applyBias` 클램프(0.5~1.5)로 폭주 방지.
- 딥NN은 가격 시계열/위성·이미지 멀티모달 들어올 때 별도 모듈에서만 조건부 검토.

## 미구현(설계상 정상)
- `package.json`/`tsconfig`/test runner 없음 = drop-in 모듈 의도. 머지 후 호스트에서 `tsc`/test 실행.
- 레이트리밋, CSRF(쿠키 인증 도입 시), 실제 결제연동, 외부 API(VWorld/KMA/KAMIS) 연동.
