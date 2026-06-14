/**
 * 백업/복구 — blob 계층 스냅샷·복구 라운드트립 + 가드 + Firestore 백엔드(오프라인 목).
 *   핵심 검증: ① 암호문 그대로 복사(키 불필요·바이트 동일) ② pre-restore 2단 되돌리기
 *   ③ 확인 토큰/모드/존재 가드 ④ prune ⑤ Firestore REST 경로(listDocIds·doc id 스킴).
 */
import { describe, it, expect } from "vitest";
import { MemoryBlobBackend, FirestoreBlobBackend } from "../backup/blobBackend";
import { BackupManager } from "../backup/backupManager";
import { BackupError, type SnapshotMeta } from "../backup/types";
import { FirestoreLite } from "../db/firestoreLite";

const VER = "test-0.0.0";

describe("BackupManager — 라운드트립·가드(memory 백엔드)", () => {
  it("스냅샷→라이브 변형→복구 시 원상복구 + pre-restore 자동 스냅샷", async () => {
    const live = new Map<string, string>([["feedback", "A"], ["journal", "B"]]);
    const be = new MemoryBlobBackend(live);
    const mgr = new BackupManager(be, VER);

    const snap = await mgr.createSnapshot("manual");
    expect(snap.keys.sort()).toEqual(["feedback", "journal"]);
    expect(snap.storeMode).toBe("memory");

    live.set("feedback", "A-CHANGED"); // 라이브 변형
    const r = await mgr.restore(snap.id, "RESTORE");
    expect(r.ok).toBe(true);
    expect(r.reloadRequired).toBe(true);
    expect(r.appliedKeys.sort()).toEqual(["feedback", "journal"]);
    expect(r.preRestoreId).toBeTruthy(); // 복구 전 자동 스냅샷 존재
    expect(live.get("feedback")).toBe("A"); // 원복
  });

  it("pre-restore 스냅샷으로 2단 되돌리기(복구 자체를 되돌림)", async () => {
    const live = new Map<string, string>([["feedback", "v1"]]);
    const mgr = new BackupManager(new MemoryBlobBackend(live), VER);
    const s1 = await mgr.createSnapshot();      // v1 보존
    live.set("feedback", "v2");                  // 변형
    const r = await mgr.restore(s1.id, "RESTORE"); // v1 복구(현재 v2를 pre-restore에 보존)
    expect(live.get("feedback")).toBe("v1");
    await mgr.restore(r.preRestoreId!, "RESTORE"); // 복구 되돌리기 → v2
    expect(live.get("feedback")).toBe("v2");
  });

  it("암호문 fidelity — ENC1 blob을 키 없이 바이트 동일하게 복사·복구", async () => {
    const cipher = "ENC1:Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA=="; // 불투명 암호문(복호 안 함)
    const live = new Map<string, string>([["subscriptions", cipher]]);
    const mgr = new BackupManager(new MemoryBlobBackend(live), VER);
    const snap = await mgr.createSnapshot();
    live.set("subscriptions", "tampered");
    await mgr.restore(snap.id, "RESTORE");
    expect(live.get("subscriptions")).toBe(cipher); // 바이트 동일 복원
  });

  it("복구 가드 — 확인 토큰 누락·잘못된 id·없는 스냅샷·모드 불일치", async () => {
    const be = new MemoryBlobBackend(new Map([["feedback", "x"]]));
    const mgr = new BackupManager(be, VER);
    const snap = await mgr.createSnapshot();

    await expect(mgr.restore(snap.id, "")).rejects.toMatchObject({ code: "CONFIRM_REQUIRED" });
    await expect(mgr.restore(snap.id, "restore")).rejects.toMatchObject({ code: "CONFIRM_REQUIRED" }); // 대소문자 엄격
    await expect(mgr.restore("../../etc/passwd", "RESTORE")).rejects.toMatchObject({ code: "BAD_ID" });
    await expect(mgr.restore("bk-does-not-exist", "RESTORE")).rejects.toMatchObject({ code: "SNAPSHOT_NOT_FOUND" });

    // 모드 불일치 — file 모드 스냅샷을 memory 백엔드로 복구 시도
    const crafted: SnapshotMeta = { ...snap, storeMode: "file" };
    await be.putSnapshot(crafted, [{ key: "feedback", blob: "x", bytes: 1 }]);
    await expect(mgr.restore(crafted.id, "RESTORE")).rejects.toMatchObject({ code: "MODE_MISMATCH" });
  });

  it("status — 적용 가능 여부·마지막 백업·키", async () => {
    const empty = new BackupManager(new MemoryBlobBackend(), VER);
    const s0 = await empty.status();
    expect(s0.applicable).toBe(false); // 빈 휘발 → 비대상
    expect(s0.note).toContain("휘발");

    const mgr = new BackupManager(new MemoryBlobBackend(new Map([["feedback", "x"]])), VER);
    expect((await mgr.status()).lastBackupAt).toBeNull();
    await mgr.createSnapshot();
    const s = await mgr.status();
    expect(s.applicable).toBe(true);
    expect(s.lastBackupAt).toBeTruthy();
    expect(s.snapshots.length).toBe(1);
    expect(s.layer2.note).toContain("재해"); // 정직 라벨(DR 한계)
  });

  it("prune — 보존 개수 초과분 삭제(최신 유지)", async () => {
    const be = new MemoryBlobBackend();
    for (let i = 0; i < 12; i++) { // createdAt 구분 위해 직접 put
      const id = `bk-2026-06-15T00-00-${String(i).padStart(2, "0")}-000Z-x`;
      await be.putSnapshot({ id, createdAt: `2026-06-15T00:00:${String(i).padStart(2, "0")}.000Z`, reason: "m", storeMode: "memory", appVersion: VER, keys: [], totalBytes: 0 }, []);
    }
    const dropped = await be.pruneSnapshots(10);
    expect(dropped.length).toBe(2);
    const left = await be.listSnapshots();
    expect(left.length).toBe(10);
    // 가장 오래된 2개(00,01)가 삭제됐는지
    expect(left.find((m) => m.id.includes("00-000Z"))).toBeUndefined();
    expect(left.find((m) => m.id.includes("11-000Z"))).toBeTruthy();
  });
});

/* ───────────────── Firestore 백엔드 — 오프라인 REST 목(네트워크 불요) ───────────────── */
function fakeFirestore() {
  const docs = new Map<string, string>(); // "collection/id" → j(stringValue)
  const J = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { "content-type": "application/json" } });
  const f = (async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const u = String(url);
    const method = (init?.method || "GET").toUpperCase();
    if (u.includes("/instance/service-accounts/default/token")) return J({ access_token: "tok", expires_in: 3600 });
    if (u.includes("/project/project-id")) return new Response("test-proj", { status: 200 });
    const m = u.match(/\/documents\/([A-Za-z0-9_]+)(?:\/([^?]+))?/);
    const collection = m ? m[1] : "";
    const id = m && m[2] ? decodeURIComponent(m[2]) : undefined;
    if (id === undefined) { // 컬렉션 레벨
      if (method === "GET") {
        const prefix = collection + "/";
        const documents = [...docs.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ name: `projects/test-proj/databases/(default)/documents/${collection}/${encodeURIComponent(k.slice(prefix.length))}` }));
        return J({ documents }); // nextPageToken 없음(단일 페이지)
      }
    } else {
      const key = collection + "/" + id;
      if (method === "GET") return docs.has(key) ? J({ fields: { j: { stringValue: docs.get(key) } } }) : new Response("", { status: 404 });
      if (method === "PATCH") { const b = JSON.parse(String(init?.body)) as { fields: { j: { stringValue: string } } }; docs.set(key, b.fields.j.stringValue); return J({}); }
      if (method === "DELETE") { docs.delete(key); return J({}); }
    }
    return new Response("", { status: 500 });
  }) as unknown as typeof fetch;
  return { f, docs };
}

describe("FirestoreBlobBackend — REST 경로(목)", () => {
  it("백업→복구 라운드트립 + 스냅샷 목록(메타만) + doc id 스킴", async () => {
    const { f, docs } = fakeFirestore();
    const fs = new FirestoreLite({ fetchFn: f, project: "test-proj" });
    const be = new FirestoreBlobBackend(fs);
    const mgr = new BackupManager(be, VER);

    // 라이브 lm_state 시드(암호문 모사)
    await fs.setJson("lm_state", "feedback", "ENC1:AAAA");
    await fs.setJson("lm_state", "journal", "[]");

    const snap = await mgr.createSnapshot("manual");
    expect(snap.keys.sort()).toEqual(["feedback", "journal"]);
    // 백업 컬렉션에 blob+meta 문서 생성됐는지
    expect(docs.has(`lm_backups/${snap.id}__feedback`)).toBe(true);
    expect(docs.has(`lm_backups/${snap.id}__meta`)).toBe(true);

    // 목록은 메타 문서만(blob 문서 제외)
    const list = await mgr.listSnapshots();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(snap.id);

    // 라이브 변형 후 복구
    await fs.setJson("lm_state", "feedback", "TAMPERED");
    const r = await mgr.restore(snap.id, "RESTORE");
    expect(r.ok).toBe(true);
    expect(await fs.getJson("lm_state", "feedback")).toBe("ENC1:AAAA"); // 암호문 원복
  });

  it("listDocIds — 컬렉션 문서 id 나열, 없으면 빈 배열", async () => {
    const { f } = fakeFirestore();
    const fs = new FirestoreLite({ fetchFn: f, project: "test-proj" });
    expect(await fs.listDocIds("lm_backups")).toEqual([]); // 비어있음
    await fs.setJson("lm_backups", "a", "1");
    await fs.setJson("lm_backups", "b", "2");
    expect((await fs.listDocIds("lm_backups")).sort()).toEqual(["a", "b"]);
    await fs.deleteDoc("lm_backups", "a");
    expect(await fs.listDocIds("lm_backups")).toEqual(["b"]);
  });
});
