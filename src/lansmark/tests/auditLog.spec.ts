/**
 * 감사 로그 영속화 검증 — logOps가 보안 이벤트를 audit.jsonl에 append-only로 기록(file 모드).
 *   메모리 모드(테스트 기본)는 휘발 — 파일 미생성. PIPA/사고대응 추적용 durable 기록.
 */
import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";

const dir = join(tmpdir(), "lensmark-audit-test");
afterEach(() => { if (existsSync(dir)) rmSync(dir, { recursive: true, force: true }); });

describe("감사 로그 영속화(audit.jsonl)", () => {
  it("file 모드: 보안 이벤트가 append-only로 누적 기록", () => {
    const ctx = createContext({ ...loadConfig(), storeMode: "file", dataDir: dir });
    ctx.logOps("실효", "엔티틀먼트 실효 jti=test");
    ctx.logOps("계정", "로그인 신규 acct_x");
    const lines = readFileSync(join(dir, "audit.jsonl"), "utf8").trim().split("\n");
    expect(lines.length).toBe(2);                       // append-only(덮어쓰기 X)
    expect(JSON.parse(lines[0]).type).toBe("실효");
    expect(JSON.parse(lines[1]).detail).toContain("로그인");
    expect(JSON.parse(lines[1]).at).toBeTruthy();       // 타임스탬프
  });

  it("memory 모드: 휘발 — audit.jsonl 미생성", () => {
    const ctx = createContext({ ...loadConfig(), storeMode: "memory", dataDir: dir });
    ctx.logOps("test", "x");
    expect(existsSync(join(dir, "audit.jsonl"))).toBe(false);
  });
});
