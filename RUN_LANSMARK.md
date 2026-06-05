# RUN_LANSMARK.md — 완성 실행 프롬프트 (Claude Code · 최신 배선)

## ▶ 붙여넣기 (기동 한 줄)
```
CLAUDE.md 읽고 8에이전트(.claude/agents) 활성화 후 RUN_LANSMARK.md 읽고 Phase A→B→C→D 자동 실행한다.
작업마다 적합 서브에이전트로 위임하고, 커밋 전 /guardrail + /verify, 끝낼 때 Stop 훅으로 그린을 강제한다.
가드레일·HUMAN GATE 엄수, 외부 API는 docs 확인(추측 금지). 작업마다 보고 형식으로 보고 후 다음으로.
```

## 미션 / 현황
LANSMARK를 **출시 가능 상태로 완성**. 엔진(6축)·토지이음식 맵·통합 여정·플라이휠·Dream(정리층)은 **완료(51 테스트)**. → 남은 **seam 연결 + 출시 게이트**.

## 작업 방식 (배선 활용 — 이게 "최신")
- 구현 전 배치 검토 → **lansmark-architect**
- 데이터 연동 → **lansmark-data-integration** / 앱·맵 → **lansmark-frontend-ux** / 결제·키 → **lansmark-security-payments** / 수치·플라이휠 → **lansmark-engine-quant**
- 커밋 전 **/guardrail**(lansmark-guardrail) + **/verify**(lansmark-qa) — 미그린/위반이면 진행 금지
- 해자(플라이휠/Dream)·특허 훅 → **lansmark-growth-moat**, 정리 실행은 **/dream**
- 결정적 안전장치: PreToolUse(위험명령 차단)·PostToolUse(가드레일 스캔)·Stop(그린 게이트)은 자동 작동

## Phase 계획 (상세 Task·완료기준은 CODEX_PROMPT.md)
| Phase | 목표 | 핵심 | 담당 에이전트 |
|---|---|---|---|
| **A** 실데이터+결제 | 유료 시뮬 실동작 | `/provider vworld·kma·kamis`, RDA 실데이터(verified:true), 결제 webhook, 앱 live | data-integration, security-payments, frontend-ux |
| **B** 플라이휠/Dream 운영 | 해자 가동 | feedbackStore→Firestore, `consolidate` 스케줄러+스냅샷 영속화, 실측 수집 UI | growth-moat, engine-quant |
| **C** 정밀화 | 진짜 지형/필지 | VWorld/토지이음 WFS 경계, 실 DEM, Sentinel 파이프라인 | data-integration, frontend-ux |
| **D** 출시 게이트 | 릴리스 | `/ship` 체크리스트(약관/환불, 출처·연도, validated, 라이선스) | guardrail, qa |

## ⛔ HUMAN GATE (위조 금지 → 요청 후 대기)
API 키(VWorld/KMA/KAMIS) · VWorld 운영키/공공누리 유형/위성 배포권 · PG 키 · 실 RDA 데이터. 없으면 코드는 작성하되 key-pending + 요청하고 다음 Task로.

## 보고 형식
```
[Phase x · Task] 제목
- 위임 에이전트: …
- 변경 파일: …
- /guardrail: pass | /verify: green N passed
- HUMAN GATE: (대기 항목 or 없음)
- 다음: …
```

## ✅ 완성 정의 (DONE)
1. live 모드 end-to-end: 주소→추천→유료 시뮬→다중 비교→저장/PDF/공유
2. 플라이휠+Dream 운영(실측 저장→스냅샷 정리→보정 반영), 일부 작물 validated
3. `/ship` 전부 ✅, tsc+vitest 그린(≥51)
4. 앱(dashboard/lansmark_app.html) live 연결

## 시작
```
/verify 로 베이스라인(51) 확인 → Phase A: /provider vworld 부터.
.env.example 먼저 만들고 키 필요 지점은 HUMAN GATE로 요청. 그린 유지하며 진행.
```
