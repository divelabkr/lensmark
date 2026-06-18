/**
 * Tier 1 ops watcher CLI — 읽기 전용. /api/ops/stats를 읽어 평문 진단 출력 + exit code(0 ok · 1 findings · 2 오류).
 *   사용:  LANSMARK_BASE=https://lensmark.kr LANSMARK_ADMIN_TOKEN=… npx tsx scripts/opsWatch.ts [--line]
 *         (또는 npm run ops:watch · 아침 요약은 `npm run ops:watch -- --line`로 한 줄만)
 *   채널 무관: cron·GitHub Action·Claude Code 루틴이 stdout/exit code를 얇게 래핑(슬랙·이메일·푸시).
 *   --line: 제목/메일/슬랙용 한 줄 요약만 출력(예: "[LENSMARK] 2026-06-12 ⚠ 주의 · 0 crit · 3 warn · 품질→…").
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
    if (process.argv.includes("--line")) {
      // 아침 요약 1줄(메일 제목·슬랙·푸시용) — 종합판정 + 최상위 권고 1개. 콘솔 watch 띠와 같은 문장(SSOT).
      const top = report.findings[0];
      const date = new Date().toISOString().slice(0, 10);
      console.log(`[LENSMARK] ${date} ${report.summary}${top ? ` · ${top.area}→${top.recommend}` : ""}`);
    } else {
      console.log(`[opsWatch ${new Date().toISOString()}] ${BASE}`);
      console.log(formatReport(report));
    }
    // crit(실제 조치 필요)일 때만 잡 실패=알림(GitHub가 소유자에 메일). warn은 알려진/구조적이라 로그만 남기고 0으로
    // 통과 → 매일 '경고만' 실패 메일이 쌓이는 스팸 방지. (criticals는 그대로 메일로 알림 유지.)
    process.exit(report.level === "crit" ? 1 : 0); // 0=정상/경고(로그만) · 1=critical(알림) · 2=접근 오류
  } catch (e) {
    console.error("⛔ opsWatch 실패(서버 접근 불가?):", (e as Error)?.message ?? e);
    process.exit(2);
  }
})();
