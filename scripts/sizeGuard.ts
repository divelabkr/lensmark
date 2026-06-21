/**
 * sizeGuard — 저장소 용량 폭증 방지 게이트(fail-closed).
 *   책임: git에 "되돌리기 힘든 비대화"가 들어오는 걸 커밋 전에 막고, 소스 비대를 경고한다.
 *   왜: git history는 append-only — 큰 바이너리(PDF·zip·db)가 한번 커밋되면 .git에서 영구히 안 빠진다
 *       (filter-repo로 history 재작성해야만 제거 = 위험·협업깨짐). 그래서 '들어오기 전'이 유일한 싼 시점.
 *   대상: git이 추적 중인 파일만(.gitignore된 node_modules/.data/samples는 무관 — 재설치·런타임데이터).
 *   결과: 추적 바이너리 블롭 or 하드캡 초과 = exit 1(차단) / 소프트 초과 = 경고만(exit 0).
 */
import { execSync } from "node:child_process";
import { statSync } from "node:fs";

// ── 예산(budget) — 임계값은 여기 한 곳에서만 조정 ──────────────────────────────
const KB = 1024;
const SOFT_WARN_KB = 250;   // 이 이상 단일 파일 = 경고(app.html·CHANGELOG·version.archive 성장 추적)
const HARD_FAIL_KB = 1024;  // 이 이상 단일 텍스트/소스 = 차단(1MB — 단일파일 대시보드도 이 밑이어야)
const TOTAL_WARN_MB = 12;   // 추적 소스 총합 경고선(현재 ~6MB — 2배 여유)

// git에 절대 들어오면 안 되는 바이너리/데이터 블롭(크기 불문 차단). 실데이터·원본은 .data/samples(ignore)로.
const BLOB_EXT = [
  ".pdf", ".zip", ".tar", ".gz", ".tgz", ".7z", ".rar",
  ".sqlite", ".db", ".parquet", ".xlsx", ".xls",
  ".mp4", ".mov", ".avi", ".psd", ".ai",
];
// 예외: 작은 소스 CSV(예: RDA 추출 입력 표본)는 허용하되 크기캡은 적용. PDF 등은 무조건 차단.

function trackedFiles(): string[] {
  // -z 안 쓰고 줄단위 — 파일명에 개행은 없다고 가정(있으면 별도 처리)
  return execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
}

function kb(path: string): number {
  try { return Math.round(statSync(path).size / KB); } catch { return 0; }
}

const files = trackedFiles();
const fails: string[] = [];
const warns: string[] = [];
let totalKb = 0;

for (const f of files) {
  const size = kb(f);
  totalKb += size;
  const lower = f.toLowerCase();

  // 1) 바이너리 블롭 추적 = 즉시 차단(되돌리기 비쌈)
  if (BLOB_EXT.some((ext) => lower.endsWith(ext))) {
    fails.push(`🚫 바이너리 블롭 추적됨: ${f} (${size}KB) — .gitignore로 빼고 .data/samples 또는 외부 보관`);
    continue;
  }
  // 2) 단일 파일 하드캡 초과 = 차단
  if (size > HARD_FAIL_KB) {
    fails.push(`🚫 단일 파일 ${size}KB > ${HARD_FAIL_KB}KB 하드캡: ${f} — 분할/아카이브 필요`);
    continue;
  }
  // 3) 소프트 경고(성장 추적용 — 차단 아님)
  if (size > SOFT_WARN_KB) {
    warns.push(`⚠️  ${size}KB: ${f}`);
  }
}

const totalMb = (totalKb / KB).toFixed(1);
if (totalKb / KB > TOTAL_WARN_MB) {
  warns.push(`⚠️  추적 소스 총합 ${totalMb}MB > ${TOTAL_WARN_MB}MB 경고선 — docs/CAPACITY.md 압축 시나리오 검토`);
}

// ── 리포트 ────────────────────────────────────────────────────────────────
console.log(`\n  용량 가드 — 추적 파일 ${files.length}개 · 소스 총합 ${totalMb}MB`);
if (warns.length) {
  console.log("\n  [경고] (차단 아님, 성장 추적용)");
  for (const w of warns) console.log("   " + w);
}
if (fails.length) {
  console.error("\n  [차단] git 비대화 위험 — 커밋 전 해결:");
  for (const f of fails) console.error("   " + f);
  console.error("\n  ⛔ 용량 가드 실패. docs/CAPACITY.md 참조.\n");
  process.exit(1);
}
console.log("\n  ✓ 용량 가드 통과 (바이너리 블롭 0 · 하드캡 초과 0).\n");
