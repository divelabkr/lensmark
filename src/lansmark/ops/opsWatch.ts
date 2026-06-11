/**
 * Tier 1 ops watcher(읽기 전용·행동 0) — /api/ops/stats를 읽고 평문 진단 + 권고를 만든다.
 *   철학(레드팀 합의): AI/스크립트는 '조언'만 · 행동은 결정적·사람. fail-closed로 알림(모르면 묻어두지 않음).
 *   채널 무관: 순수 함수(evaluateOps) + 텍스트 리포트(formatReport) — cron·GitHub Action·Claude Code 루틴이
 *   stdout/exit code만 얇게 래핑(슬랙·이메일·푸시). **행동권 없음**(재시작·토글·삭제 X) — Tier 2는 신뢰를 번 뒤·별도.
 *   소비: 품질 게이트(신뢰 피쉬본)·최적화 트리거·스토어 저하·5xx를 한 곳에서 'crit/warn/ok'로 롤업.
 */
export type WatchLevel = "ok" | "warn" | "crit";
export interface WatchFinding { severity: "warn" | "crit"; area: string; msg: string; recommend: string; }
export interface WatchReport { level: WatchLevel; findings: WatchFinding[]; summary: string; }

// OPS 트리거 임계(콘솔 프론트와 동일 — 단일 출처 의도).
const PAYLOAD_WARN = 55, PAYLOAD_CRIT = 75, HEADROOM_WARN = 60, HEADROOM_CRIT = 80, ERRORS_CRIT = 10;

export interface StatsLite {
  storeDegraded?: boolean;
  usage?: { errors?: number };
  quality?: { grade: string; dataTrust: string; sources: { label: string; status: string; note: string; action?: string }[] };
  optimization?: { payload?: { gzipKB: number }; headroom?: Record<string, { n: number; cap: number }> };
}

/** /api/ops/stats를 읽어 진단 — 순수(테스트 용이). 읽기만, 어떤 행동도 제안하지 않는 '조언'. */
export function evaluateOps(inp: { stats: StatsLite }): WatchReport {
  const s = inp.stats || {};
  const F: WatchFinding[] = [];
  // 스토어 저하 — 영속 실패(최우선·보안 직결)
  if (s.storeDegraded) F.push({ severity: "crit", area: "스토어", msg: "저하(sealed) — 원격 영속 실패", recommend: "firestore 워밍/IAM 점검 후 재배포. 복구 전 유료 게이트 ON 금지" });
  // 5xx
  const errs = s.usage?.errors ?? 0;
  if (errs > 0) F.push({ severity: errs >= ERRORS_CRIT ? "crit" : "warn", area: "에러", msg: `5xx ${errs}건`, recommend: "최근 활동·로그에서 원인 엔드포인트 확인" });
  // 데이터 품질(신뢰 피쉬본) — '운영 녹색 ≠ 데이터 정확'
  const q = s.quality;
  if (q) {
    if (q.dataTrust === "unverified") F.push({ severity: "crit", area: "신뢰", msg: `등급 ${q.grade} · 미검증(운영 녹색이어도 데이터 정확 아님)`, recommend: "소득 base 실 RDA 적재(npm run rda:build) — 그 전엔 앱이 '추정' 강제(정상)" });
    for (const src of q.sources || []) {
      // 권고는 qualityGate.action(SSOT) — 콘솔 피쉬본과 같은 문장(이중관리 제거). 없으면 폴백.
      if (src.status === "fail") F.push({ severity: "crit", area: "품질", msg: `${src.label}: ${src.note}`, recommend: src.action || "데이터 소스 실연동/적재 필요" });
      else if (src.status === "warn") F.push({ severity: "warn", area: "품질", msg: `${src.label}: ${src.note}`, recommend: src.action || "키 연결 또는 구조적 한계 — 정직 라벨 유지" });
    }
  }
  // 최적화 트리거 — '언제 손댈지'
  const o = s.optimization;
  if (o) {
    const g = o.payload?.gzipKB ?? 0;
    if (g >= PAYLOAD_CRIT) F.push({ severity: "crit", area: "성능", msg: `앱 첫로드 ${g}KB(gzip)`, recommend: "페이로드 분할/지연로드" });
    else if (g >= PAYLOAD_WARN) F.push({ severity: "warn", area: "성능", msg: `앱 첫로드 ${g}KB(gzip)`, recommend: "모바일 전송비용 주시" });
    for (const [k, h] of Object.entries(o.headroom || {})) {
      const pct = h.cap ? Math.round((h.n / h.cap) * 100) : 0;
      if (pct >= HEADROOM_CRIT) F.push({ severity: "crit", area: "저장소", msg: `${k} ${pct}%(${h.n}/${h.cap})`, recommend: "per-record/DB 어댑터 승격(§3-1)" });
      else if (pct >= HEADROOM_WARN) F.push({ severity: "warn", area: "저장소", msg: `${k} ${pct}%`, recommend: "승격 준비" });
    }
  }
  const crit = F.filter((f) => f.severity === "crit").length, warn = F.length - crit;
  const level: WatchLevel = crit ? "crit" : warn ? "warn" : "ok";
  const summary = level === "ok" ? "✓ 모두 정상 — 조치 불필요" : `${level === "crit" ? "⛔ 조치 필요" : "⚠ 주의"} · ${crit} crit · ${warn} warn`;
  return { level, findings: F, summary };
}

/** 사람이 읽을 텍스트 리포트(채널 무관 — stdout·슬랙·이메일 공통). */
export function formatReport(r: WatchReport): string {
  const lines = [r.summary];
  for (const f of r.findings) lines.push(`  ${f.severity === "crit" ? "⛔" : "⚠"} [${f.area}] ${f.msg}\n     → ${f.recommend}`);
  return lines.join("\n");
}
