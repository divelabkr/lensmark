/**
 * 백업/복구 라우트 — 관리자 가드(401/403/415)·백업 생성·복구(confirm 필수·404)·status shape.
 *   route()를 직접 호출(가짜 req/res). vitest는 memory 모드라 ctx.backup을 시드 MemoryBlobBackend로 교체(실 blob 모사).
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type * as http from "node:http";
import { loadConfig, type Config } from "../../../server/config";
import { createContext, type Ctx } from "../../../server/context";
import { route } from "../../../server/router";
import { MemoryBlobBackend } from "../backup/blobBackend";
import { BackupManager } from "../backup/backupManager";

function mockRes() {
  const captured = { code: 0, headers: {} as Record<string, string>, body: "" };
  const res = {
    setHeader(k: string, v: string) { captured.headers[k.toLowerCase()] = String(v); },
    writeHead(code: number, h?: Record<string, string>) { captured.code = code; for (const k in h ?? {}) captured.headers[k.toLowerCase()] = String((h as any)[k]); return res; },
    end(s?: string) { captured.body = s ?? ""; },
    captured,
  };
  return res as unknown as http.ServerResponse & { captured: typeof captured };
}
function mockReq(method = "GET", headers: Record<string, string> = {}, body?: unknown) {
  const r: any = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  r.method = method; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r as http.IncomingMessage;
}
const U = (p: string) => new URL("http://localhost" + p);
const ADMIN = "admin-secret-xyz";
const adminH = { "x-lansmark-admin": ADMIN, "content-type": "application/json" };

function freshCtx(over: Partial<Config> = {}): Ctx {
  return createContext({ ...loadConfig(), adminToken: ADMIN, ...over });
}
/** 시드된 백업 백엔드를 ctx에 주입(vitest=memory라 실 blob이 없으므로) — live Map도 반환(복구 검증용). */
function seeded(over: Partial<Config> = {}): { ctx: Ctx; live: Map<string, string> } {
  const ctx = freshCtx(over);
  const live = new Map<string, string>([["feedback", "A"], ["journal", "B"]]);
  ctx.backup = new BackupManager(new MemoryBlobBackend(live), "test-0.0.0");
  return { ctx, live };
}

describe("백업 쓰기 가드(/api/ops/backup)", () => {
  it("관리자 인증 없으면 401", async () => {
    const res = mockRes();
    await route(freshCtx(), mockReq("POST", {}, {}), res, U("/api/ops/backup"));
    expect(res.captured.code).toBe(401);
  });
  it("content-type 없는 변이 POST는 415(CSRF 단순요청 차단)", async () => {
    const res = mockRes();
    await route(freshCtx(), mockReq("POST", { "x-lansmark-admin": ADMIN }, {}), res, U("/api/ops/backup"));
    expect(res.captured.code).toBe(415);
  });
  it("운영(prod)+토큰 미설정이면 403(콘솔 공개로 안 열림)", async () => {
    const res = mockRes();
    await route(freshCtx({ isProd: true, adminToken: "" }), mockReq("POST", { "content-type": "application/json" }, {}), res, U("/api/ops/backup"));
    expect(res.captured.code).toBe(403);
  });
});

describe("백업 생성·상태(/api/ops/backup, /status)", () => {
  it("관리자: 스냅샷 생성 200 + 키 포함", async () => {
    const { ctx } = seeded();
    const res = mockRes();
    await route(ctx, mockReq("POST", adminH, {}), res, U("/api/ops/backup"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.ok).toBe(true);
    expect(b.snapshot.keys.sort()).toEqual(["feedback", "journal"]);
  });
  it("status: 관리자 200 + shape(mode·applicable·layer2 정직라벨)", async () => {
    const { ctx } = seeded();
    await ctx.backup.createSnapshot("manual"); // 1건 만들고
    const res = mockRes();
    await route(ctx, mockReq("GET", { "x-lansmark-admin": ADMIN }), res, U("/api/ops/backup/status"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.applicable).toBe(true);
    expect(b.snapshots.length).toBe(1);
    expect(b.lastBackupAt).toBeTruthy();
    expect(b.layer2.note).toContain("재해"); // DR 한계 정직 라벨
  });
  it("status: 인증 없으면 401", async () => {
    const res = mockRes();
    await route(freshCtx(), mockReq("GET", {}), res, U("/api/ops/backup/status"));
    expect(res.captured.code).toBe(401);
  });
});

describe("복구(/api/ops/backup/restore)", () => {
  it("confirm 토큰 없으면 400(CONFIRM_REQUIRED) — 단순 클릭 금지", async () => {
    const { ctx } = seeded();
    const meta = await ctx.backup.createSnapshot();
    const res = mockRes();
    await route(ctx, mockReq("POST", adminH, { id: meta.id }), res, U("/api/ops/backup/restore"));
    expect(res.captured.code).toBe(400);
    expect(JSON.parse(res.captured.body).code).toBe("CONFIRM_REQUIRED");
  });
  it("없는 스냅샷 복구는 404", async () => {
    const { ctx } = seeded();
    const res = mockRes();
    await route(ctx, mockReq("POST", adminH, { id: "bk-nope", confirm: "RESTORE" }), res, U("/api/ops/backup/restore"));
    expect(res.captured.code).toBe(404);
  });
  it("확인 후 복구 성공 200 + reloadRequired + 라이브 원복", async () => {
    const { ctx, live } = seeded();
    const meta = await ctx.backup.createSnapshot();
    live.set("feedback", "TAMPERED");
    const res = mockRes();
    await route(ctx, mockReq("POST", adminH, { id: meta.id, confirm: "RESTORE" }), res, U("/api/ops/backup/restore"));
    expect(res.captured.code).toBe(200);
    const b = JSON.parse(res.captured.body);
    expect(b.ok).toBe(true);
    expect(b.reloadRequired).toBe(true);
    expect(b.preRestoreId).toBeTruthy();
    expect(live.get("feedback")).toBe("A"); // 원복
  });
  it("id 없으면 400(ID_REQUIRED)", async () => {
    const { ctx } = seeded();
    const res = mockRes();
    await route(ctx, mockReq("POST", adminH, { confirm: "RESTORE" }), res, U("/api/ops/backup/restore"));
    expect(res.captured.code).toBe(400);
    expect(JSON.parse(res.captured.body).code).toBe("ID_REQUIRED");
  });
});
