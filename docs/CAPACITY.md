# CAPACITY.md — 용량 폭증 방지 + 압축·최적화 시나리오

> 책임: LANSMARK 작업공간이 "미친듯이 비대해지는" 걸 막는 표준 정책 + 이미 커진 걸 줄이는 실행 시나리오.
> 강제 수단: `scripts/sizeGuard.ts`(`npm run size`) — verify/Stop 게이트에 포함. 정책은 여기, 강제는 가드.

## 1. 실측 — 용량은 어디서 오나 (2026-06 기준)

| 구분 | 크기 | git 추적? | 성격 | 위험도 |
|---|---|---|---|---|
| `node_modules/` | ~153MB | ❌(ignore) | 재설치 가능(`npm ci`) | 낮음 — 언제든 삭제·재생성 |
| `.data/rda_pdfs/` | ~41MB | ❌(ignore) | 업로드 원본(+중복) | 중 — 로컬 디스크 누적 |
| 추적 소스(git) | ~1.9MB | ✅ | 코드·문서 | **낮음(건강)** |
| `.git/` | ~4MB | — | history | 낮음 — 단, 바이너리 커밋 시 **영구 비대** |

**핵심 진단**: git 저장소는 건강하다(소스 1.9MB·.git 4MB). 용량 체감은 **node_modules(재설치 가능) + 업로드 데이터**이지 소스 비대가 아니다.
**진짜 되돌리기 힘든 위험**은 단 하나 — **큰 바이너리가 git에 커밋되면 history에서 영구히 안 빠진다**(filter-repo로 history 재작성해야만 제거 = 협업 깨짐). → "들어오기 전"에 막는 게 유일하게 싼 시점.

## 2. 방지 계획 (prevention — 이미 배선됨)

1. **`.gitignore` 규율**: `node_modules/ .env* samples/ .data/ dist/ *.log` 제외. 실데이터·키흔적·런타임·빌드는 git 밖. (현행 유지)
2. **용량 가드(fail-closed)** — `scripts/sizeGuard.ts`, `npm run size`, verify·Stop 훅 포함:
   - 추적 **바이너리 블롭**(`.pdf .zip .sqlite .xlsx .mp4 …`) = **즉시 차단**(크기 불문).
   - 단일 파일 **1MB 하드캡 초과** = 차단(분할/아카이브 유도).
   - 단일 파일 250KB↑ / 소스총합 12MB↑ = **경고**(성장 추적 — 차단 아님).
3. **append-only 텍스트 비대 정책**(느린 누적):
   - `version.ts` RELEASES → 최근 12개만 본체, 나머지 `version.archive.ts`(이미 분리). 12개 초과 누적 시 archive로 이관.
   - `CHANGELOG.md` 비대 시 연도별 `docs/changelog/<year>.md`로 분할.
4. **`.data` 런타임 스토어 보존정책**: file 모드 영속 스토어(feedback·snapshot)는 무한 누적 금지 — Dream(`core/consolidate.ts`)이 recency·이상치격리로 정리. 스냅샷은 최신 N개만 유지(초과분 삭제). 운영은 Firestore 어댑터 사용(로컬 .data는 dev 전용).

## 3. 압축·최적화 시나리오 (이미 커졌을 때 — 실행 순서)

> 안전 순서: **싸고 무해한 것부터**(node_modules·중복·gc) → 데이터 압축 → 최후수단(history 재작성).

### S1. node_modules 정리 (가장 큰 153MB·무손실)
```bash
rm -rf node_modules && npm ci      # lockfile 기준 깨끗이 재설치(필요할 때만)
npm prune                          # 안 쓰는 의존성 제거
npm dedupe                         # 중복 의존성 평탄화
```
→ 작업 안 할 땐 `node_modules`를 지워두면 즉시 153MB 회수(작업 재개 시 `npm ci`).

### S2. 업로드 데이터 중복 제거 + 압축 (~19MB 즉시 회수)
현재 `.data/rda_pdfs`에 **한글원본 + ASCII사본**이 중복(완전 동일). `scripts/dataPrune.sh`로 정리:
```bash
bash scripts/dataPrune.sh          # 중복 PDF 탐지·제거(해시 동일만) + 옵션 gzip
```
- PDF는 **추출 후엔 소스가 아니다** — `npm run rda:build`로 `rdaIncome.real.ts` 생성하면 원본 PDF는 외부 보관(드라이브)로 빼도 됨. 로컬엔 압축본만.
- 압축: `gzip -9 .data/rda_pdfs/*.pdf`(필요시 `gunzip`) — PDF는 추가압축 여지 적으나 보관용엔 충분.

### S3. git 정리 (history 비대 시 진단·압축)
```bash
git gc --aggressive --prune=now    # 로컬 .git 압축(무손실·안전)
git count-objects -vH              # .git 실제 크기 진단
# history에서 큰 객체 찾기:
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' \
  | sort -k2 -n | tail -20
```

### S4. 최후수단 — history에서 큰 바이너리 영구 제거 (위험·협업 합의 필수)
> ⚠️ history 재작성 = 모든 클론 무효화·force-push 필요. **사람 승인 + 협업자 합의 후에만.**
```bash
# git-filter-repo 권장(BFG도 가능). 예: 실수로 커밋된 PDF 전부 제거
git filter-repo --path-glob '*.pdf' --invert-paths
# 이후 강제 푸시 + 전원 재클론. (sizeGuard가 애초에 이 상황을 예방)
```

### S5. 대용량을 꼭 git에 둬야 하면 — Git LFS
바이너리를 반드시 버전관리해야 할 때만(예: 디자인 원본). 평소엔 불필요.
```bash
git lfs install && git lfs track "*.psd"   # 포인터만 history에, 실체는 LFS 스토어
```

## 4. 빠른 점검 명령
```bash
npm run size                       # 용량 가드(추적 바이너리·하드캡·총합)
du -sh .git node_modules .data     # 3대 용량원 즉시 확인
git ls-files | xargs du -k | sort -rn | head   # 추적 파일 큰 순
```

> 요약: **git엔 소스만(가드가 바이너리 차단) · 데이터는 .data/외부보관 · node_modules는 언제든 재설치.**
> 비대 체감 시 순서대로 S1(node_modules)→S2(데이터 중복·압축)→S3(git gc). history 재작성(S4)은 합의 후 최후수단.
