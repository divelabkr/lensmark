# AGENTS.md — LANSMARK (Codex CLI · AGENTS 규약 도구용 진입점)

> Codex CLI(및 AGENTS.md를 읽는 도구)가 매 세션 읽는 파일. **단일 출처(SSOT)는 `CLAUDE.md`** — 시작 시 `CLAUDE.md` + `ARCHITECTURE.md`를 먼저 읽어라. 여기엔 **절대 놓치면 안 되는 가드레일**만 인라인으로 둔다(중복·드리프트 방지).

## 시작 의식
1. `CLAUDE.md`(프로젝트 메모리·8에이전트·배선) → `ARCHITECTURE.md`(기능 지도) → `RUN_LANSMARK.md` 순으로 읽는다.
2. 코딩 전 `ARCHITECTURE.md`/`scripts/featureMap.ts`로 **이 작업이 어느 흐름·파일인지** 확인. 새 기능·엔드포인트·파일은 **featureMap에 즉시 등록**(아니면 `npm run arch` 실패).

## ⛔ 절대 가드레일 (fail-closed — 어기면 제품이 죽는다)
- **도메인 수치 날조 금지(1원칙)**: 소득·기후·시세·작물 기준표 같은 **숫자/사실은 실데이터·결정적 엔진에서만**. LLM(너 포함)이 지어내지 말 것. 모르면 비우고 `TODO`/seam 유지·출처 표기.
- **보장·매입추천·단일값 ❌** → 항상 **P10·P50·P90 + 근거 + 면책**. 토양검정 게이팅. **흙토람 미사용**. base는 **출처·연도** 표기.
- **레거시 금지**: 유료 소득 엔진은 **`core/parcelSimulator.ts`(canonical)** 하나. (옛 `core/simulator.ts·yield·cost·revenue·income`은 v0.76.7에서 제거됨 — 부활 금지.)
- **mock↔live drop-in**: `data/providers/*` 타입 동일. provider seam 유지.
- **철자 footgun**: 도메인/프로젝트 = `lensmark`(LEN) ↔ 코드/Cloud Run 서비스 = `lansmark`(LAN). **혼동 금지**(과거 serviceId 오타로 사이트 전체 장애). `firebase.json` serviceId == `scripts/deploy.sh` SERVICE == `lansmark-api`.

## 개발 불변식
1. **그린 유지** — 변경 후 반드시: `npm run typecheck && npm test && npm run arch` (tsc·vitest·아키텍처 지도 대조). 미그린이면 완료 아님.
2. **기능별 단일책임** — 한 파일 = 한 책임. 서버는 `server/{config,context,respond,middleware,router}.ts` + `server/routes/<기능>.ts`. 도메인 로직은 `src/lansmark/<도메인>/`. 거대 파일에 욱여넣지 말 것.
3. **모든 코드에 한국어 주석** — 파일 머리(책임 1줄)·비자명 로직에 "왜". 프런트는 의도적 단일파일(`dashboard/lansmark_app.html`) — `/* ===== 섹션 ===== */` 구획.
4. **추측 금지** — 외부 API 스펙은 공식 docs 확인 후. 키 없으면 코드는 작성하되 key-pending + `HUMAN_GATE.md`에 요청.
5. 수치·수식 변경 시 `src/lansmark/tests/*.spec.ts` 동반.

## 배포 (참고)
- SSOT = `scripts/deploy.sh`(Cloud Run env·시크릿·메모리 명시). Hosting은 `firebase deploy --only hosting`(또는 `deploy.sh hosting`). CI: `.github/workflows/{ci,deploy-run,deploy-hosting,ops-watch}.yml`.
- 키·실데이터·결제·DNS = **HUMAN GATE**(`HUMAN_GATE.md`). 코드는 seam까지만.

## 빠른 명령
```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run arch        # featureMap ↔ 코드 대조
npm run dev         # 로컬 dev 서버(있으면)
```

> 요약: **CLAUDE.md가 본체. 여기선 "숫자 날조 금지·P10/50/90·그린 유지·레거시 금지·lensmark/lansmark 철자"만 절대 기억.**
