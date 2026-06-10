/**
 * RDA 실 소득자료 빌더 — CSV 한 장으로 데모→실데이터 전환(자료 받는 날 명령 한 줄).
 *   사용: npm run rda:build -- <자료.csv>     (양식: scripts/rdaReal.example.csv)
 *   동작: parseRdaCsv(검증·폭 유도) → src/lansmark/data/rdaIncome.real.ts 재생성 → 요약 출력.
 *   이후: npm test && npm run arch 그린 확인 → 커밋 → 재배포(시뮬 카드에 '실자료·기준연도'가 표기됨).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseRdaCsv } from "../src/lansmark/data/rdaRealLoader";

const csvPath = process.argv[2];
if (!csvPath) { console.error("사용법: npm run rda:build -- <자료.csv>  (양식: scripts/rdaReal.example.csv)"); process.exit(1); }

const rows = parseRdaCsv(readFileSync(csvPath, "utf8")); // 오류는 줄번호와 함께 throw
const table = Object.fromEntries(rows.map((r) => [r.cropId, r]));
const years = [...new Set(rows.map((r) => r.baseYear))].sort();

const out = `/**
 * RDA 실 소득자료 테이블 — ⚠ 이 파일은 \`npm run rda:build <csv>\`가 재생성한다(수동 편집 금지).
 *   생성: ${new Date().toISOString()} · ${rows.length}작물 · 기준연도 ${years.join(",")}
 */
import type { RdaRealRow } from "./rdaRealLoader";

export const RDA_REAL: Record<string, RdaRealRow> = ${JSON.stringify(table, null, 2)};

/** 실자료 메타(빌드 시 기록) — ops/health 노출용. null=실자료 미적재(데모). */
export const RDA_REAL_META: { builtAt: string; rows: number; baseYears: number[] } | null = ${JSON.stringify({ builtAt: new Date().toISOString(), rows: rows.length, baseYears: years })};
`;
writeFileSync(join(__dirname, "..", "src/lansmark/data/rdaIncome.real.ts"), out);

console.log(`\n  ✓ 실자료 적재 완료 — ${rows.length}작물 · 기준연도 ${years.join(",")}`);
for (const r of rows) console.log(`    - ${r.cropId}: 수량 ${r.yieldKgPer10a.p50}kg/10a · 경영비 ${r.operatingCostPer10aKrw.p50.toLocaleString()}원 · 단가 ${r.refPriceKrwPerKg.p50.toLocaleString()}원/kg · ${r.source}`);
console.log(`\n  다음: npm test && npm run arch → 커밋 → 재배포(시뮬 카드에 실자료 출처·연도 표기)\n`);
