# HANDOFF — LANSMARK 세션 인계 (2026-06-23 밤)

> 새 세션은 **이 문서 + CLAUDE.md + memory/MEMORY.md**를 먼저 읽고 시작한다. 아래 🔴 1순위부터.

---

## ✅ 현재 상태 — billing ON · 라이브 복구 (2026-06-25 재배포)
> **2026-06-25:** 사용자가 billing 재활성(Firebase Blaze) → `bash scripts/deploy.sh` 재배포로 **lensmark.kr 0.77.16 복구**(end-to-end 200·revision `00040-rtq`). Budget API 활성화 후 **예산 알림(월 5천원) 등록**·**ops-watch cron 재가동** 완료. `min=0+cpu-throttling`이라 무트래픽 거의 $0. **아래는 06-23 중단 이력 — 재발(다시 끌 때) 대비 참조.**

### 이력 — 2026-06-23 billing OFF·앱 중단 (사용자 결정)
사용자가 6월 청구(₩74,322·CPU Instance-based ₩67,712) 충격 → **GCP 결제(billing)를 비활성화**하고 "완전 중단·진짜 0원" 선택(AskUserQuestion).
- **현재: billing DISABLED** → `lensmark.kr`(Cloud Run)이 정지되며 곧/이미 접속 불가. `bash scripts/deploy.sh`는 `BILLING_DISABLED`로 실패함(Artifact Registry·Cloud Build가 billing 필요).
- **0원 코드는 준비·커밋 완료(`9114b61`):** deploy.sh `--no-cpu-throttling` → `--cpu-throttling`(request-based CPU·요청 처리 시간만 과금). billing만 켜면 `min=0 + cpu-throttling` = 무트래픽 $0.
- **🟢 복구 절차(앱 다시 살릴 때):** ① **GCP 콘솔에서 lensmark-dev billing 켜기**(사용자·HUMAN GATE) ② `cd /Users/yongj/Documents/Playground/lansmark/lansmark_simulator_skeleton && export PATH="$HOME/.local/node-current/bin:/Users/yongj/google-cloud-sdk/bin:$PATH" && bash scripts/deploy.sh`(기본 min=0+cpu-throttling이라 cost_guard 자동 통과) ③ **예산 알림 1회 등록: `bash scripts/setup-budget.sh`**(월 5,000원·50/90/100%·예측100% 이메일) ④ **ops-watch cron 복원**(`.github/workflows/ops-watch.yml`의 `schedule:` 주석 해제 — billing OFF 동안 오탐 이메일 막으려 꺼둠) ⑤ 검증 `gcloud run services describe lansmark-api --region asia-northeast3 --project lensmark-dev --format='value(spec.template.metadata.annotations["run.googleapis.com/cpu-throttling"])'` = **`true`**. → 0.77.16 + 0원 + 예산 가드로 **완전 복구**.
- ⚠ 정직 메모: billing OFF는 "앱을 죽여 0원"이라 과한 면이 있음 — **`min=0`(이미 라이브)만으로 무트래픽 거의 $0**였고, 6월 폭증은 `min=1`(24시간 상주) 탓이라 이미 06-22에 해결됨. 단 "확실한 $0·앱 중단 감수"는 사용자 명시 결정이므로 존중. 마케팅·검증 재개 시 위 복구 절차로.
- **🛡️ 예산 안전장치(2026-06-24·커밋 `80221e3`·사용자 "안전장치 만들자"):** 6월 재발 방지 2층. ① `deploy.sh` **cost_guard**(사전 차단): 비싼 설정(min≥1·`no-cpu-throttling`)을 `LANSMARK_ALLOW_COSTLY=1` 없이 배포하면 **거부** → 무심코 비싸지는 실수 원천 차단(4시나리오 검증 완료). ② `setup-budget.sh`(사후 알림): GCP 월 예산 5,000원+임계 이메일(⚠ **자동 차단 아님 → 앱 안 죽음**). **⚠ 먹통 회귀 등으로 상주(min=1)가 정말 필요하면** → `LANSMARK_ALLOW_COSTLY=1 LANSMARK_MIN_INSTANCES=1 bash scripts/deploy.sh`(명시 동의해야 통과).
- **🛡️ 안전장치 추가(2026-06-24·커밋 `66bbfc6` 및 직전·사용자 "다른 곳 안전장치"):** ③ **외부 유료 API 호출 상한**(`src/lansmark/integrations/callBudget.ts`): Anthropic·Perplexity 일일 상한(기본 500/300·`LANSMARK_<KEY>_DAILY_MAX`로 조정)·초과 시 degrade(설명/요약 생략·무중단) → 유료 API 켤 때 비용 폭주 차단. `explain.ts`·`perplexity.ts` 캐시·dedup 뒤 실호출 직전 게이트(캐시적중은 상한 미소비). ④ **배포 후 자동 롤백**(`deploy.sh`): verify(버전·store·시뮬 200) 실패 시 직전 정상 리비전 자동 복귀(`verify` exit→return + `if verify` 분기). ⑤ **ops-watch cron 중단**: billing OFF로 사이트 의도 중단 중 '다운' 오탐 이메일("ops-watch: All jobs have failed")을 막으려 `schedule` 주석(복구 절차 ④에서 복원). lighthouse는 로컬 서버(localhost:8801) 대상이라 무관·deploy-run은 이미 push 트리거 제거됨.

## 💰 비용 맥락 (사용자가 ₩74,322 청구서 보고 충격)
- 청구 핵심: **`Services CPU (Instance-based billing)` ₩67,712** (2026.6.1~6.21·전월比 13,525%↑).
- 원인: **6월 초~21일 Cloud Run을 `min=1`(24시간 상주) + `no-cpu-throttling`(CPU 항상 할당)** 으로 둬서 트래픽 0인데 24/7 풀CPU 과금. **"코딩"이 아니라 "서버를 계속 켜둔 상태"의 비용**(코딩·배포는 Cloud Build 무료한도라 거의 0).
- 해결: 06-22 `min=0` 전환(완료·라이브) → 상주 제거. 06-23 `cpu-throttling`(위 1순위) → idle 누수 제거 = 0원.

## ✅ 이번 세션 한 일 (0.77.11~16 · 전부 라이브·그린 659 tests)
| ver | 내용 |
|---|---|
| 0.77.11 | 4축 빈틈 5종 — 가격/기후 `asOf`(기준일)·mock기후 정직성 라벨·Dream(consolidate) 프로덕션 배선·explain LLM dedup |
| 0.77.12 | 운영 가시성 — 신선도 `lastLiveAt`·응답 p95·업타임(ops 서버탭) |
| 0.77.13 | **에러 자동 관측** — `clientDiag`(부팅 비콘: SW상태·오프라인·콜드스타트·캐시버전 → `/api/client-diag` → ops '사용자 환경 진단' 패널). ⚠ **복구 권한 없음**(관측/집계만·자동 unregister/캐시삭제 금지가 설계 불변식) |
| 0.77.14 | 부팅 비콘 콜드스타트 5xx 재시도(0.9s·1회·관측 누락 방지) |
| 0.77.15 | **버전 정합** — sendHtml이 `window.__BUILD_VER` 주입 → 클라가 `/api/version` 비교 stale 감지 → 배너+SW update+idle 1회 자동 새로고침. **fail-open**(버전 못 가져오면 정상·차단 없음). 사용자 제안 '옛버전 차단'은 의도적 먹통이라 제외 |
| 0.77.16 | 랜드라인 — 필지 경계선 `weight 2→3.5`·진하게·실선(사용자 '랜드 라인 잘 보이게') |

## ⏸ 보류/미완 (새 세션이 사용자와 결정)
- **A: 따로 추천 지목 반영 (사용자 핵심 불만·보류 중).** `rankCropCandidates(land,climate)`가 지목(논/밭/과수원)을 **안 봄** → 같은 동네 4구역이 동일 추천("논(답)에 사과·마늘"). 사용자가 AskUserQuestion을 dismiss(결정 보류). **작물 시드(`crops.seed.ts`)에 `drainage`·`waterNeed`·`category`(과수/채소/전작) 있음** → 지목 물리특성(논=담수·배수불량 / 과수원=과수)을 이 기존 데이터에 매핑하면 **날조 없이** 구역별 추천 차별화 가능. 사용자가 "지목 반영해줘" 하면 ①물리특성 반영(추천) ②정직 표시만 ③정밀 데이터 후(HUMAN GATE) 중 선택해 진행. cropSuitability·analysis·app.html 체인 수정 필요.
- **PWA 정상화(백로그·spawn task):** SW install이 SW 컨텍스트에서 `/app` 캐시 실패→redundant(미설치). zstd/Vary 인코딩 의심. **단 fail-safe**(SW 미설치=서버 직통=먹통0·앱 정상). 푸시(VAPID HUMAN GATE) 켤 때 근본조사.
- **injectNonce 회귀가드(spawn task·이미 머지됨):** security.ts 사후검증+fail-closed throw·injectNonceGuard.spec 24 tests.

## ⚙️ 환경·불변식 (반드시)
- **CWD/PATH 매 Bash 호출:** `cd /Users/yongj/Documents/Playground/lansmark/lansmark_simulator_skeleton && export PATH="$HOME/.local/node-current/bin:$PATH"` (gcloud=`/Users/yongj/google-cloud-sdk/bin`). **CWD는 매 턴 outer root로 리셋**되니 매번 cd.
- **그린 게이트:** 변경 후 `npm run typecheck && npm test && npm run arch && npm run size`. 프론트(`dashboard/*.html`)는 `node -e` vm 구문검사 + injectNonce throw 안전(app/ops/terms/privacy 4페이지).
- **app.html/sw.js 변경 시 `sw.js` CACHE 버전↑**(현 `lensmark-shell-v10`) — SW 캐시 무효화. 버전 범프는 `version.ts`·`package.json`·`CHANGELOG.md` 함께.
- **자동 배포(standing):** 커밋+그린 후 `bash scripts/deploy.sh`를 안 묻고 실행 + 라이브 검증. **단 `git add`는 명시적으로**(전체 `-A` 금지 — injectNonce 교훈: 다른 작업 파일이 섞였음). 비배포 위험행동(시크릿 읽기/삭제)은 확인.
- **`deploy-run.yml` push 트리거 제거됨**(매 push "All jobs failed" 이메일 중단). 정식 배포는 로컬 `deploy.sh`(SA Artifact Registry 권한=HUMAN GATE).
- **1원칙:** 도메인 수치 날조 금지(작물기준·기후·소득·시세). 키/시크릿 채팅/커밋/로그 출력 금지. HUMAN GATE = API키(VWorld/KMA/KAMIS)·PG키·실 RDA 소득자료·VAPID.
- **먹통 대응 순서:** ① ops '사용자 환경 진단'(자동 집계·오프라인율/SW분포/캐시버전) ② 옛 버전 갇힘은 자동갱신(0.77.15↑ 클라)이 해소 ③ `javascript_tool`(Chrome MCP·ToolSearch 로드) 수동 진단은 최후. **사파리는 캐시 갇힘 시 사이트데이터 삭제**(computer-use는 macOS 손쉬운사용/화면기록 권한 없어 작동 불가). `curl 200인데 브라우저 먹통`=SW 갇힘 1순위.
- **메모리:** `~/.claude/projects/-Users-yongj-Documents-Playground-lansmark/memory/` — `firebase-ip-block`(먹통 6패턴)·`auto-deploy`·`live-activation-gates`·`browser-verify-tools` 등.

## 🌐 라이브 상태
- `lensmark.kr` → Cloudflare(NS: brianna/cartman.ns.cloudflare.com·프록시) → Firebase Hosting → rewrite → Cloud Run `lansmark-api`(asia-northeast3·project `lensmark-dev`).
- 라이브 **0.77.16** · `min=0·max=1` · cpu-throttling **적용 대기(1순위)**.
- 데이터: KMA 기후 live(목포 등 ASOS)·KAMIS apple만 verified(그 외 RDA base 폴백)·RDA 소득 데모(실자료 HUMAN GATE)·VWorld 지오/필지(키).
- 무료 베타: `ANON_ONLY=1`(계정 404)·`REQUIRE_ENTITLEMENT=false`·ANTHROPIC 미주입(AI설명 휴면).
