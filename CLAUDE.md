# CLAUDE.md — LANSMARK (Claude Code 프로젝트 메모리)

> 이 파일은 매 세션 자동 로드된다. 영구 지시·기동 명령·가드레일은 **여기**에 둔다(MEMORY.md ❌, §메모리 정책 참고).

## 정체성
**LANSMARK** = 현실 기반 작물·수확·소득 시뮬레이터. 땅 선택 → 무료 작물 추천 → 유료 정밀 소득 시뮬(P10/50/90·근거). 토지 매입 추천기가 **아니다**. 해자 = 실측 보정 플라이휠 + Dream(정리층).

## 이 저장소의 배선 (최신 Claude Code)
| 구성 | 위치 | 역할 |
|---|---|---|
| **서브에이전트 8종** | `.claude/agents/` | Smart Swarm — 작업 성격에 맞춰 위임(자동/명시) |
| **슬래시 커맨드** | `.claude/commands/` | `/verify` `/guardrail` `/dream` `/ship` `/provider` |
| **훅(결정적 게이트)** | `.claude/settings.json` | PreToolUse=위험명령 차단 · PostToolUse=가드레일 스캔 · **Stop=tsc+vitest 그린 강제** |
| **게이트 스크립트** | `scripts/` | `guard.sh` `guardrail-scan.sh` `verify.sh` `stop-gate.sh` |

8에이전트: architect · engine-quant · data-integration · frontend-ux · guardrail · qa · security-payments · growth-moat. (CLAUDE.md의 규칙은 '권고', 훅은 '강제'.)

## 시작 의식
```
CLAUDE.md 읽고 8에이전트(.claude/agents) 활성화 → ARCHITECTURE.md(기능 지도) 읽고 → RUN_LANSMARK.md 읽고 자동 실행.
```
→ **먼저 기능 지도로 "이 작업이 어느 흐름·어느 파일에 속하는지" 파악**한 뒤, 작업마다 적합 서브에이전트로 위임하고, 끝낼 때 `/verify`(또는 Stop 훅)로 그린(tsc·vitest·**arch 대조**)을 확인한다.

## 🧭 기능 흐름 지도 (가장 먼저 볼 것)
> **단일 출처(SSOT): `scripts/featureMap.ts` → 시각본 `ARCHITECTURE.md`(`npm run arch:render`).**
> **지시·코딩을 시작하기 전, 반드시 이 지도를 먼저 본다** — 어떤 기능이 어느 흐름·파일·엔드포인트·테스트에 있는지 확인하고, 새 기능/엔드포인트/파일은 **featureMap에 등록**한다(거대 기능에 욱여넣지 않기).
> `npm run arch`(verify·Stop 훅에 포함)가 지도 ↔ 실제 코드를 **자동 대조** — 어긋나면 빌드 실패(기능 흩어짐·잘못된 위치 차단).

## 아키텍처 (canonical vs legacy)
- **유료 정밀(canonical)**: `core/parcelSimulator.ts` (+`factors`/`terrain`/`satellite`, `data/rdaIncome.ts`)
- **플라이휠/Dream**: `core/{feedbackStore,calibrate,calibration,consolidate}.ts`
- **무료 후보**: `core/cropSuitability.ts` · **가드레일**: `policy/{soilPolicy,disclaimer,entitlement}.ts`
- **provider seam**: `data/providers/{types,mock,live,index}.ts` (`LANSMARK_DATA_MODE`)
- **앱/콘솔**: `dashboard/lansmark_app.html`(고객), `dashboard/lansmark_ops.html`(운영) — 단일파일
- **dev 서버(기능별 분리)**: `server/devServer.ts`(조립만) → `config`(설정·부팅점검)·`context`(공유상태 Ctx)·`respond`(응답)·`middleware`(보안·레이트리밋)·`router` + `routes/{meta,geo,analysis,payment,ops,pages}.ts`. 보안 원시함수 = `src/lansmark/api/security.ts`(CSP·헤더·레이트리미터·CORS).
- ⚠️ **레거시(새 로직 금지)**: `core/simulator.ts`, `core/{yield,cost,revenue,income}.ts`

## 절대 가드레일 (fail-closed · guardrail 에이전트+훅이 강제)
보장(수익/재배성공)·매입추천·단일값 ❌ / 항상 P10·P50·P90 + 근거 ✅ / 토양검정 게이팅 ✅ / **흙토람 미사용** / base 출처·연도 / 면책.

## 개발 불변식
1. **그린 유지** — 변경 후 `/verify`(tsc·vitest·**arch 지도 대조**). Stop 훅이 미그린 완료를 차단.
2. **mock↔live drop-in** — live는 `data/providers/types.ts` 타입 동일.
3. **레거시 수정 금지** · 유료 로직은 parcelSimulator에만.
4. **추측 금지** — 외부 API 스펙은 공식 docs 확인 후. 모르면 TODO+seam 유지.
5. 수치·수식 변경 시 `tests/*.spec.ts` 동반.
6. **기능별 단일책임 분리** — 한 파일 = 한 책임. 섞지·흩뜨리지 않는다. 서버는 `server/{config,context,respond,middleware,router}.ts` + `server/routes/<기능>.ts`, 도메인 로직은 `src/lansmark/<도메인>/`. 새 기능은 새/적합 모듈에 — 거대 파일에 욱여넣지 않는다.
7. **모든 코드에 주석** — 파일 머리(책임 1줄)·섹션·비자명 로직에 한국어 주석("무엇"보다 "왜"). 새로 쓰거나 만지는 코드는 이 기준을 만족시킨다.
8. **기능 지도 우선·동기화** — 코딩 전 `ARCHITECTURE.md`/`featureMap.ts`로 위치 확인. 기능·엔드포인트·파일 추가 시 **featureMap에 즉시 등록**(아니면 `npm run arch` 실패).
9. **프런트 반영 확인(제도화·2026-06-13)** — `dashboard/*.html` 편집 후 사용자에게 "반영됨" 보고 **전**, preview 서버가 *실제로 현재 파일을 서빙*하는지 확인한다. PostToolUse 훅 `scripts/preview-check.sh`가 자동 점검(무응답/0바이트=좀비 ⛔, 정상=✓). **무응답이면 보고 금지 → 좀비 정리(`lsof -ti tcp:<port>|xargs kill -9`) 후 `preview_start` 재호출.** 배경: 죽은/좀비 서버가 캐시된 옛 페이지를 보여 "뭐가 다르니" 혼선난 사건 재발 방지. (서버는 요청마다 파일 fresh read라 살아만 있으면 즉시 반영 — 죽음/멈춤만 위험.)

## 🤖 로컬 qwen 무료 근육 (1차 리뷰 · 잡일 오프로드)
> 도구: `/Users/yongj/Documents/Playground/qwen`(로컬 `qwen3-coder:30b`·Ollama, 토큰 0·오프라인·프라이빗). 규칙·역할은 그곳 `AGENTS.md`/`CLAUDE.md`. ※ qwen은 **명시 스크립트 호출 시에만** 동작 — Claude·기본 codex 모델은 안 바뀜.
- **언제**: 슬라이스 그린(tsc·vitest·arch) 후, 내 멀티에이전트 red-team **전에** 무료 1차 거름망으로.
- **방법**: 리뷰 = `~/Documents/Playground/qwen/scripts/local-review.sh`(git diff 기반·큰 파일 포함, LENSMARK은 이제 git repo) 또는 `review-files <파일…>`(파일 기반). 잡일 오프로드 = `ask-qwen "프롬프트" [파일…]`. **구현+테스트+관련 파일을 함께·짧은 출력으로** 요청해야 정확(부분입력·긴출력은 오탐/불안정 — 실증).
- **삼각검증(필수)**: qwen=1차 보조, **최종 판단 아님**. 결과를 확정/불확실로 나눠 **확정만 채택**, 불확실은 Claude/사람. 자동 커밋·푸시·배포·삭제·시크릿 변경 금지.
- **✅ 붙이는 곳**(스트레스 검증): 1차 버그/스펙위반 검출(planted bug 정확 탐지됨)·테스트 스텁 드래프트·주석/요약/기계적 대량변환 — 짧은 출력·검증가능·**도메인 사실 무관**.
- **❌ 절대 안 붙이는 곳**: ① **도메인 사실·수치**(작물 기준표·기후/서리 통계·소득/RDA·시세 — qwen이 거짓 확신으로 **날조**, '추측 금지'·면책 위반 / 실증: 전주 서리일수 환각) ② 보안·정확성 **최종 승인**(1차 검출까지만) ③ 대규모 코드생성·교차파일 리팩터(느림·불안정) ④ 사용자 노출 콘텐츠 직접 생성.
- **비용 분담**: 저위험 슬라이스 = qwen 1차로 끝 / **고위험(보안·결제·해자) = qwen 1차 + Claude 멀티에이전트 red-team**.

## 코드 구성·주석 규칙 (유지보수 기준 — 사용자 요청)
- **분리**: 설정·상태·응답·보안·라우팅·기능라우트를 각각의 모듈로. 상태는 모듈 전역변수 대신 `Ctx` 주입(흩어짐 방지). 비밀값은 사용처에서 `process.env` 직접 읽기(설정객체·로그 유출 방지).
- **주석**: 파일 상단 책임 1줄 + 함수/분기/매직넘버에 의도 주석(한국어). 배선이 빠지지 않게 회귀가드 테스트(소스 존재 검증 + 라우터 스모크)로 고정.
- 프론트(`dashboard/*.html`)는 **의도적 단일파일**(드롭인) — 분리 대신 `/* ===== 섹션 ===== */` 구획 + 주석으로 가독성 확보.

## 메모리 정책 (최신 — 중요)
- 영구 지시·기동 명령·가드레일은 **CLAUDE.md**에만. ❌ MEMORY.md 금지(Auto Dream이 최신 세션을 권위로 보고 덮어쓸 수 있음).
- **Auto Memory**(교정·선호 자동 노트)는 켜도 됨: `/memory` 토글, 끄려면 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. 누적 후 `"consolidate my memory files"`로 정리.
- **8서브에이전트는 컨텍스트 격리** → 에이전트별 메모리가 섞이지 않게, 공유가 필요한 결정만 CLAUDE.md/HANDOFF로 승격.
- 제품 LANSMARK의 **"Dream"은 별개**: `core/consolidate.ts`가 실측 보정을 정리(해자). 수동 `/dream`.

## ⛔ HUMAN GATE (위조 금지 · 요청 후 대기)
API 키(VWorld/KMA/KAMIS) · 라이선스 승인 · PG 키 · 실 RDA 소득자료. 없으면 코드는 작성하되 key-pending + 요청.

## 빠른 참조
`/verify` 그린게이트 · `/guardrail` 원칙스캔 · `/dream [halfLife]` 보정정리 · `/ship` 출시게이트 · `/provider [vworld|kma|kamis]` provider 구현.
