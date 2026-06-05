/**
 * 아키텍처 자동 대조 — featureMap.ts(지도)를 실제 코드와 맞춰본다. 어긋나면 exit 1.
 *   검사: ① 지도가 가리키는 파일/테스트 존재 ② 지도 엔드포인트가 코드에 있음(stale 차단)
 *        ③ 코드 엔드포인트가 지도에 등록됨(드리프트 차단) ④ 어느 기능에도 안 묶인 파일(흩어짐 경고)
 *   실행: npm run arch    (verify·Stop 훅에 연결)
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FEATURES, EXCLUDED } from "./featureMap";

const ROOT = process.cwd();
const errors: string[] = [];
const warns: string[] = [];
const exists = (rel: string) => existsSync(join(ROOT, rel));

// ① 참조 파일·테스트 존재
for (const f of FEATURES) {
  for (const file of [...f.files, ...f.tests]) {
    if (!exists(file)) errors.push(`[${f.id}] 참조 파일 없음: ${file}`);
  }
}

// ② 실제 엔드포인트 수집 — server/routes/*.ts 의 `=== "/..."` 비교문 스캔
const routeDir = join(ROOT, "server/routes");
const actual = new Set<string>();
for (const n of readdirSync(routeDir)) {
  if (!n.endsWith(".ts")) continue;
  const src = readFileSync(join(routeDir, n), "utf8");
  for (const m of src.matchAll(/(?:===|!==)\s*"(\/[^"]*)"/g)) actual.add(m[1]); // ===(매칭)·!==(가드) 둘 다
}
const mapped = new Set<string>(FEATURES.flatMap((f) => f.endpoints));

// ③ 지도 → 코드 (stale: 지도엔 있는데 코드에 없음)
for (const f of FEATURES) for (const e of f.endpoints) if (!actual.has(e)) errors.push(`[${f.id}] 지도 엔드포인트가 코드에 없음(stale): ${e}`);
// ④ 코드 → 지도 (drift: 코드엔 있는데 지도 미등록)
for (const e of actual) if (!mapped.has(e)) errors.push(`코드에 있으나 지도 미등록 엔드포인트(드리프트): ${e} → featureMap에 등록`);

// ⑤ orphan 파일(어느 기능에도 안 묶임) — 경고
const referenced = new Set<string>(FEATURES.flatMap((f) => [...f.files, ...f.tests]));
const excluded = new Set<string>([...EXCLUDED.legacy, ...EXCLUDED.shared]);
function walk(rel: string, acc: string[] = []): string[] {
  for (const n of readdirSync(join(ROOT, rel))) {
    const child = `${rel}/${n}`;
    if (statSync(join(ROOT, child)).isDirectory()) walk(child, acc);
    else if (/\.ts$/.test(n) && !/\.spec\.ts$|\.example\.ts$/.test(n)) acc.push(child);
  }
  return acc;
}
for (const file of [...walk("src/lansmark"), ...walk("server")]) {
  if (referenced.has(file) || excluded.has(file)) continue;
  warns.push(`어느 기능에도 안 묶임(흩어짐 후보 → featureMap.FEATURES 또는 EXCLUDED 등록): ${file}`);
}

// 출력
console.log(`\n  LANSMARK 아키텍처 대조 — 기능 ${FEATURES.length} · 코드 엔드포인트 ${actual.size}`);
if (warns.length) { console.log(`\n  ⚠ 경고 ${warns.length}`); for (const w of warns) console.log("   - " + w); }
if (errors.length) {
  console.log(`\n  ✖ 오류 ${errors.length}`); for (const e of errors) console.log("   - " + e);
  console.log("\n  → 지도(scripts/featureMap.ts)와 코드가 어긋남. 둘을 정렬하세요.\n");
  process.exit(1);
}
console.log(`\n  ✓ 지도 ↔ 코드 일치 (오류 0${warns.length ? `, 경고 ${warns.length}` : ""}).\n`);
