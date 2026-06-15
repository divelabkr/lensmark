/**
 * CI 상태(GitHub Actions) — 파싱·캐시(TTL)·fail-soft(404/네트워크). fetchFn·now 주입으로 오프라인.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getCiStatus, _resetCiCache } from "../ops/ciStatus";

const res = (status: number, body: unknown): Response =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  _resetCiCache();
  delete process.env.LANSMARK_GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  delete process.env.LANSMARK_GITHUB_REPO;
});

describe("ciStatus — GitHub Actions 최신 실행", () => {
  it("성공 실행 파싱(sha 7자·건수) + ci.yml 워크플로/main 한정", async () => {
    let url = "";
    const fetchFn = (async (u: unknown) => { url = String(u); return res(200, { workflow_runs: [{ status: "completed", conclusion: "success", head_branch: "main", head_sha: "abcdef1234567", run_number: 42, event: "push", name: "ci", html_url: "https://x/run/42", updated_at: "2026-06-15T00:00:00Z" }] }); }) as unknown as typeof fetch;
    const c = await getCiStatus({ fetchFn, now: 1000 });
    expect(url).toContain("workflows/ci.yml/runs"); // 전체 runs가 아니라 ci.yml만(ops-watch 실패 오인 방지)
    expect(url).toContain("branch=main");
    expect(c.run?.conclusion).toBe("success");
    expect(c.run?.sha).toBe("abcdef1"); // 7자로 절단
    expect(c.run?.runNumber).toBe(42);
    expect(c.error).toBeNull();
  });

  it("캐시: TTL(120s) 내 재호출은 GitHub 미조회", async () => {
    let calls = 0;
    const fetchFn = (async () => { calls++; return res(200, { workflow_runs: [{ status: "completed", conclusion: "success", run_number: 1 }] }); }) as unknown as typeof fetch;
    await getCiStatus({ fetchFn, now: 0 });
    await getCiStatus({ fetchFn, now: 60_000 });  // TTL 내 → 캐시
    expect(calls).toBe(1);
    await getCiStatus({ fetchFn, now: 130_000 }); // TTL 초과 → 재조회
    expect(calls).toBe(2);
  });

  it("404 fail-soft(비공개/없음)", async () => {
    const fetchFn = (async () => res(404, {})) as unknown as typeof fetch;
    const c = await getCiStatus({ fetchFn, now: 1 });
    expect(c.run).toBeNull();
    expect(c.error).toContain("비공개");
  });

  it("네트워크 오류 fail-soft(라벨만·throw 안 함)", async () => {
    const fetchFn = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const c = await getCiStatus({ fetchFn, now: 1 });
    expect(c.run).toBeNull();
    expect(c.error).toBe("ECONNREFUSED");
  });

  it("토큰 설정 시 authed=true", async () => {
    process.env.LANSMARK_GITHUB_TOKEN = "tok";
    const fetchFn = (async () => res(200, { workflow_runs: [] })) as unknown as typeof fetch;
    const c = await getCiStatus({ fetchFn, now: 1 });
    expect(c.authed).toBe(true);
    expect(c.error).toBe("실행 이력 없음");
  });
});
