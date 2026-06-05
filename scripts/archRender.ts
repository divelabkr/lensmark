/**
 * 아키텍처 시각 지도 렌더 — featureMap.ts(SSOT) → ARCHITECTURE.md(Mermaid 흐름도 + 단계별 표).
 *   ARCHITECTURE.md 는 자동 생성물(직접 편집 금지). 지도 변경은 featureMap.ts 에서.
 *   실행: npm run arch:render
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURES, PRODUCT_FLOW, type Stage } from "./featureMap";

const STAGE_LABEL: Record<Stage, string> = { assess: "귀농 자가진단", land: "땅·토지유형", recommend: "무료추천", pay: "결제·권한", simulate: "정밀시뮬", growth: "생육·출하", operate: "재배운영·동반", act: "행동 연결", feedback: "실측보정(해자)", ops: "운영콘솔", platform: "플랫폼" };
const ICON: Record<Stage, string> = { assess: "🧭", land: "🗺", recommend: "🌱", pay: "💳", simulate: "📊", growth: "🌿", operate: "🌾", act: "🤝", feedback: "🔁", ops: "🛠", platform: "⚙" };
const STATUS: Record<string, string> = { live: "🟢 live", mock: "🟡 mock", seam: "🟠 seam", platform: "⚙ platform" };
const byStage = (s: Stage) => FEATURES.filter((f) => f.stage === s);

// ── Mermaid 흐름도: 제품 체인(각 단계의 기능 표기) + 플랫폼 서브그래프 ──
let mer = "flowchart LR\n";
for (let i = 0; i < PRODUCT_FLOW.length; i++) {
  const s = PRODUCT_FLOW[i];
  const feats = byStage(s.stage).map((f) => f.name).join("<br/>");
  mer += `  ${s.stage}["${ICON[s.stage]} ${s.label}<br/>${feats}"]\n`;
  if (i > 0) mer += `  ${PRODUCT_FLOW[i - 1].stage} --> ${s.stage}\n`;
}
const nid = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_"); // Mermaid 노드 ID 안전화(하이픈 등 제거)
mer += `  subgraph PLATFORM["⚙ 플랫폼·운영 (cross-cutting)"]\n`;
for (const f of [...byStage("ops"), ...byStage("platform")]) mer += `    ${nid(f.id)}["${f.name}"]\n`;
mer += `  end\n`;
mer += `  PLATFORM -. 뒷받침 .-> simulate\n`;

// ── 단계별 표 ──
function table(s: Stage): string {
  const fs = byStage(s);
  if (!fs.length) return "";
  let t = `\n### ${ICON[s]} ${STAGE_LABEL[s]}\n\n| 기능 | 흐름 | 엔드포인트 | 파일 | 테스트 | 상태 | 비고/seam |\n|---|---|---|--:|--:|---|---|\n`;
  for (const f of fs) {
    t += `| **${f.name}** | ${f.flow} | ${f.endpoints.map((e) => `\`${e}\``).join(" ") || "—"} | ${f.files.length} | ${f.tests.length} | ${STATUS[f.status]} | ${f.notes || "—"} |\n`;
  }
  return t;
}

let md = "<!-- ⚠ 자동 생성: scripts/featureMap.ts(SSOT) → `npm run arch:render`. 직접 편집 금지. -->\n";
md += "# LANSMARK 기능 흐름 아키텍처 (지도)\n\n";
md += "> **단일 출처: `scripts/featureMap.ts`.** `npm run arch` 가 이 지도를 실제 코드와 자동 대조한다(어긋나면 빌드 실패).\n";
md += "> **🧭 지시·코딩을 시작하기 전, 반드시 이 지도를 먼저 본다.** 새 기능/엔드포인트/파일은 featureMap에 등록할 것.\n\n";
md += "```mermaid\n" + mer + "```\n";
md += "\n## 기능 상세 (단계별)\n";
for (const s of ["land", "recommend", "pay", "simulate", "growth", "operate", "feedback", "ops", "platform"] as Stage[]) md += table(s);
md += `\n---\n범례: 🟢 live · 🟡 mock · 🟠 seam(키/스펙 대기) · ⚙ platform. 총 **${FEATURES.length}** 기능 · 단계 ${PRODUCT_FLOW.length}.\n`;

writeFileSync(join(process.cwd(), "ARCHITECTURE.md"), md);
console.log(`ARCHITECTURE.md 생성 완료 — 기능 ${FEATURES.length}.`);
