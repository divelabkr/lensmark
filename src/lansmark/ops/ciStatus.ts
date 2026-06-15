/**
 * CI 상태(GitHub Actions) — ops 콘솔 '서버' 탭에 최신 워크플로 실행 결과를 표시.
 *   GitHub REST(actions/runs) 최신 1건을 캐시(기본 120초)로 조회. 공개 repo는 무인증(레이트리밋 60/h라 캐시 필수),
 *   비공개면 LANSMARK_GITHUB_TOKEN(또는 GITHUB_TOKEN)으로 5000/h. **fail-soft** — 조회 실패는 라벨만, ops 본 기능 영향 0.
 *   repo는 LANSMARK_GITHUB_REMOTE/LANSMARK_GITHUB_REPO 우선, 미설정 시 기본 divelabkr/lensmark(origin).
 */
export interface CiRun {
  status: string;             // queued | in_progress | completed
  conclusion: string | null;  // success | failure | cancelled | null(진행 중)
  branch: string;
  sha: string;                // 7자
  runNumber: number;
  event: string;              // push | pull_request | ...
  name: string;
  url: string;
  at: string;                 // updated_at(ISO)
}
export interface CiResult {
  repo: string;
  authed: boolean;            // 토큰 사용 여부(레이트리밋 표시용)
  run: CiRun | null;
  error: string | null;       // fail-soft 사유
  fetchedAt: string;
}

const TTL_MS = 120_000;
let cache: { at: number; result: CiResult } | null = null;

/** 테스트용 캐시 리셋. */
export function _resetCiCache(): void { cache = null; }

/** 최신 CI 실행 상태(캐시). fetchFn/now 주입으로 오프라인 테스트. */
export async function getCiStatus(opts: { fetchFn?: typeof fetch; now?: number } = {}): Promise<CiResult> {
  const now = opts.now ?? Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.result;
  const repo = process.env.LANSMARK_GITHUB_REPO || "divelabkr/lensmark";
  const workflow = process.env.LANSMARK_GITHUB_WORKFLOW || "ci.yml"; // 테스트 파이프라인만(ops-watch 등 타 워크플로 제외)
  const branch = process.env.LANSMARK_GITHUB_BRANCH || "main";       // main의 그린 여부가 ops 신호
  const token = process.env.LANSMARK_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
  const f = opts.fetchFn ?? fetch;
  const result: CiResult = { repo, authed: !!token, run: null, error: null, fetchedAt: new Date(now).toISOString() };
  try {
    const headers: Record<string, string> = { "User-Agent": "lansmark-ops", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    // 특정 워크플로(ci.yml)의 최신 실행만 — /actions/runs(전체)는 ops-watch cron 실패를 CI 실패로 오인.
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=1&branch=${encodeURIComponent(branch)}`;
    let r: Response;
    try { r = await f(url, { headers, signal: ac.signal }); }
    finally { clearTimeout(t); }
    if (r.status === 404) result.error = "repo/워크플로 없음 또는 비공개(토큰 필요)";
    else if (r.status === 403) result.error = "레이트리밋/권한(토큰 설정 권장)";
    else if (!r.ok) result.error = `GitHub API HTTP ${r.status}`;
    else {
      const d = (await r.json()) as { workflow_runs?: Array<Record<string, unknown>> };
      const run = d.workflow_runs?.[0];
      if (run) {
        result.run = {
          status: String(run.status ?? ""),
          conclusion: (run.conclusion as string | null) ?? null,
          branch: String(run.head_branch ?? ""),
          sha: String(run.head_sha ?? "").slice(0, 7),
          runNumber: Number(run.run_number ?? 0),
          event: String(run.event ?? ""),
          name: String(run.name ?? run.display_title ?? "ci"),
          url: String(run.html_url ?? ""),
          at: String(run.updated_at ?? run.created_at ?? ""),
        };
      } else result.error = "실행 이력 없음";
    }
  } catch (e) {
    result.error = (e as Error)?.name === "AbortError" ? "시간초과" : ((e as Error)?.message ?? "조회 실패");
  }
  cache = { at: now, result };
  return result;
}
