/**
 * Tier 1 ops watcher CLI — 읽기 전용. /api/ops/stats를 읽어 평문 진단 출력 + exit code(0 ok · 1 findings · 2 오류).
 *   사용:  LANSMARK_BASE=https://lensmark.kr LANSMARK_ADMIN_TOKEN=… npx tsx scripts/opsWatch.ts
 *         (또는 npm run ops:watch)
 *   채널 무관: cron·GitHub Action·Claude Code 루틴이 stdout/exit code를 얇게 래핑(슬랙·이메일·푸시).
 *   ⚠ 행동권 없음 — 재시작·토글·삭제 등 어떤 변이도 하지 않는다(Tier 1=조언만). Tier 2는 신뢰를 번 뒤 별도.
 */
import { evaluateOps, formatReport, type StatsLite } from "../src/lansmark/ops/opsWatch";

const BASE = (process.env.LANSMARK_BASE || "http://127.0.0.1:8787").replace(/\/$/, "");
const TOKEN = process.env.LANSMARK_ADMIN_TOKEN || "";

(async () => {
  try {
    const r = await fetch(`${BASE}/api/ops/stats`, { headers: TOKEN ? { "x-lansmark-admin": TOKEN } : {} });
    if (r.status === 401) { console.error("⛔ 관리자 토큰 필요 — LANSMARK_ADMIN_TOKEN 설정"); process.exit(2); }
    if (!r.ok) { console.error(`⛔ /api/ops/stats HTTP ${r.status}`); process.exit(2); }
    const stats = (await r.json()) as StatsLite;
    const report = evaluateOps({ stats });
    console.log(`[opsWatch ${new Date().toISOString()}] ${BASE}`);
    console.log(formatReport(report));
    process.exit(report.level === "ok" ? 0 : 1); // 0=정상 / 1=findings(스케줄러가 알림 트리거) / 2=접근 오류
  } catch (e) {
    console.error("⛔ opsWatch 실패(서버 접근 불가?):", (e as Error)?.message ?? e);
    process.exit(2);
  }
})();
