/**
 * 백업/복구 라우트 — 관리자 전용. blob 계층 스냅샷(BackupManager)을 ops에 노출.
 *   GET  /api/ops/backup/status  : 상태(스냅샷 목록·마지막·키·Layer2 정직 라벨) — 읽기(adminOk)
 *   POST /api/ops/backup         : 지금 백업(스냅샷 생성) — 쓰기
 *   POST /api/ops/backup/restore : 복구(비가역 — confirm 타이핑·pre-restore 자동·재시작 유도) — 쓰기
 *   쓰기 가드는 ops와 동일 SSOT(blockedOpsMutation): prod 토큰 403 · adminOk 401 · JSON content-type 415(CSRF).
 */
import { json, readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { adminOk, blockedOpsMutation } from "../middleware";
import { BackupError } from "../../src/lansmark/backup/types";
import type { RouteFn } from "../context";

/** BackupError code → HTTP 상태 매핑. */
function errStatus(code: string): number {
  switch (code) {
    case "CONFIRM_REQUIRED": return 400;
    case "BAD_ID": return 400;
    case "SNAPSHOT_NOT_FOUND": return 404;
    case "MODE_MISMATCH": return 409;
    case "NOT_APPLICABLE": return 409;
    default: return 400;
  }
}

export const backupRoutes: RouteFn = async (ctx, req, res, url) => {
  // 상태(읽기) — 관리자 인증만. 스냅샷 목록·마지막 백업·대상 키·Layer2 안내.
  if (url.pathname === "/api/ops/backup/status" && req.method === "GET") {
    if (!adminOk(req, ctx)) { json(res, 401, { error: "관리자 인증 필요", code: "ADMIN_REQUIRED" }); return true; }
    try { json(res, 200, await ctx.backup.status()); }
    catch (e) { json(res, 500, { error: "백업 상태 조회 실패", detail: (e as Error)?.message }); }
    return true;
  }

  // 지금 백업(스냅샷 생성) — 관리자 쓰기.
  if (url.pathname === "/api/ops/backup" && req.method === "POST") {
    if (blockedOpsMutation(req, res, ctx)) return true;
    try {
      const meta = await ctx.backup.createSnapshot("manual");
      ctx.logOps("백업", `스냅샷 생성 ${meta.id}(${meta.keys.length}키·${meta.totalBytes}B)`);
      json(res, 200, { ok: true, snapshot: meta });
    } catch (e) {
      const code = e instanceof BackupError ? e.code : "BACKUP_FAILED";
      json(res, e instanceof BackupError ? errStatus(code) : 500, { error: (e as Error)?.message ?? "백업 실패", code });
    }
    return true;
  }

  // 복구(비가역) — 관리자 쓰기 + confirm 타이핑. body: { id, confirm:"RESTORE" }.
  if (url.pathname === "/api/ops/backup/restore" && req.method === "POST") {
    if (blockedOpsMutation(req, res, ctx)) return true;
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const id = typeof b.id === "string" ? b.id.trim() : "";
    const confirm = typeof b.confirm === "string" ? b.confirm : "";
    if (!id) { json(res, 400, { error: "id가 필요합니다.", code: "ID_REQUIRED" }); return true; }
    try {
      const r = await ctx.backup.restore(id, confirm);
      ctx.logOps("복구", `스냅샷 복구 ${id} → ${r.appliedKeys.length}키(pre-restore=${r.preRestoreId ?? "없음"})`);
      json(res, 200, r);
    } catch (e) {
      const code = e instanceof BackupError ? e.code : "RESTORE_FAILED";
      json(res, e instanceof BackupError ? errStatus(code) : 500, { error: (e as Error)?.message ?? "복구 실패", code });
    }
    return true;
  }

  return false;
};
