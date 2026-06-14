/**
 * BlobBackend — 백업이 동작하는 저장 추상화(라이브 blob 읽기/쓰기 + 스냅샷 보관/열거/삭제).
 *   3 구현으로 memory/file/firestore를 통일: BackupManager는 이 인터페이스만 안다(모드 무관).
 *   라이브 blob은 '불투명 바이트'(ENC1 암호문 또는 평문) — 복호 안 함. 스냅샷은 별도 위치(같은-DB lm_backups / .data/backups).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, chmodSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { FirestoreLite } from "../db/firestoreLite";
import { BACKUP_STORE_KEYS } from "../db/firestoreStores";
import { FILE_STORE_FILES } from "../db/stores";
import type { BlobEntry, Snapshot, SnapshotMeta, StoreMode } from "./types";

export interface BlobBackend {
  readonly mode: StoreMode;
  /** 이 모드의 라이브 스토어 키(백업 대상). file=논리키 9, firestore=lm_state 문서 10. */
  listStoreKeys(): string[];
  /** 라이브 blob(원문) 또는 null(아직 영속 안 됨). */
  readStoreBlob(key: string): Promise<string | null>;
  /** 라이브 blob 기록(복구) — 원문 그대로. */
  writeStoreBlob(key: string, blob: string): Promise<void>;
  /** 스냅샷 저장(메타 + blob들). */
  putSnapshot(meta: SnapshotMeta, entries: BlobEntry[]): Promise<void>;
  /** 스냅샷 메타 전체(정렬 무관). */
  listSnapshots(): Promise<SnapshotMeta[]>;
  /** 단일 스냅샷 로드(메타+blob) 또는 null. */
  readSnapshot(id: string): Promise<Snapshot | null>;
  /** 최신 keep개만 남기고 삭제 — 삭제된 id 반환(best-effort). */
  pruneSnapshots(keep: number): Promise<string[]>;
}

const SEP = "__";        // 스냅샷 doc id 구분자(snapId엔 '__' 없음 — SNAP_ID_RE가 보장)
const META = "meta";     // 메타 문서/파일 접미

const byNewest = (a: SnapshotMeta, b: SnapshotMeta) => (a.createdAt < b.createdAt ? 1 : -1);

/* ───────────────── Firestore: 라이브=lm_state, 백업=lm_backups(같은 DB) ───────────────── */
export class FirestoreBlobBackend implements BlobBackend {
  readonly mode = "firestore" as const;
  private static readonly LIVE = "lm_state";
  private static readonly BACKUP = "lm_backups";
  constructor(private readonly fs: FirestoreLite) {}
  listStoreKeys(): string[] { return [...BACKUP_STORE_KEYS]; }
  readStoreBlob(key: string): Promise<string | null> { return this.fs.getJson(FirestoreBlobBackend.LIVE, key); }
  async writeStoreBlob(key: string, blob: string): Promise<void> { await this.fs.setJson(FirestoreBlobBackend.LIVE, key, blob); }
  async putSnapshot(meta: SnapshotMeta, entries: BlobEntry[]): Promise<void> {
    for (const e of entries) await this.fs.setJson(FirestoreBlobBackend.BACKUP, meta.id + SEP + e.key, e.blob);
    await this.fs.setJson(FirestoreBlobBackend.BACKUP, meta.id + SEP + META, JSON.stringify(meta)); // 메타는 마지막(부분 스냅샷이 목록에 안 뜨게)
  }
  async listSnapshots(): Promise<SnapshotMeta[]> {
    const ids = await this.fs.listDocIds(FirestoreBlobBackend.BACKUP);
    const metas: SnapshotMeta[] = [];
    for (const docId of ids) {
      if (!docId.endsWith(SEP + META)) continue; // 메타 문서만(blob 문서 제외)
      const j = await this.fs.getJson(FirestoreBlobBackend.BACKUP, docId);
      if (j) { try { metas.push(JSON.parse(j) as SnapshotMeta); } catch { /* 손상 메타 스킵 */ } }
    }
    return metas;
  }
  async readSnapshot(id: string): Promise<Snapshot | null> {
    const mj = await this.fs.getJson(FirestoreBlobBackend.BACKUP, id + SEP + META);
    if (!mj) return null;
    let meta: SnapshotMeta; try { meta = JSON.parse(mj) as SnapshotMeta; } catch { return null; }
    const entries: BlobEntry[] = [];
    for (const key of meta.keys) {
      const blob = await this.fs.getJson(FirestoreBlobBackend.BACKUP, id + SEP + key);
      if (blob != null) entries.push({ key, blob, bytes: Buffer.byteLength(blob, "utf8") });
    }
    return { meta, entries };
  }
  async pruneSnapshots(keep: number): Promise<string[]> {
    const drop = (await this.listSnapshots()).sort(byNewest).slice(keep);
    const dropped: string[] = [];
    for (const m of drop) {
      for (const key of m.keys) await this.fs.deleteDoc(FirestoreBlobBackend.BACKUP, m.id + SEP + key).catch(() => {});
      await this.fs.deleteDoc(FirestoreBlobBackend.BACKUP, m.id + SEP + META).catch(() => {});
      dropped.push(m.id);
    }
    return dropped;
  }
}

/* ───────────────── File: 라이브=.data/*.json, 백업=.data/backups/<id>/ ───────────────── */
export class FileBlobBackend implements BlobBackend {
  readonly mode = "file" as const;
  private readonly backupsDir: string;
  constructor(private readonly dir: string) { this.backupsDir = join(dir, "backups"); }
  listStoreKeys(): string[] { return Object.keys(FILE_STORE_FILES); }
  private livePath(key: string): string {
    const f = (FILE_STORE_FILES as Record<string, string>)[key];
    if (!f) throw new Error(`알 수 없는 스토어 키: ${key}`);
    return join(this.dir, f);
  }
  private atomicWrite(path: string, data: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = path + ".tmp";
    writeFileSync(tmp, data, { mode: 0o600 }); // 0600 — 타 로컬 사용자 차단(jsonFile과 동일)
    renameSync(tmp, path);
    try { chmodSync(path, 0o600); } catch { /* 권한 변경 불가 환경 무시 */ }
  }
  async readStoreBlob(key: string): Promise<string | null> {
    const p = this.livePath(key);
    try { return existsSync(p) ? readFileSync(p, "utf8") : null; } catch { return null; }
  }
  async writeStoreBlob(key: string, blob: string): Promise<void> { this.atomicWrite(this.livePath(key), blob); }
  async putSnapshot(meta: SnapshotMeta, entries: BlobEntry[]): Promise<void> {
    const dir = join(this.backupsDir, meta.id);
    for (const e of entries) this.atomicWrite(join(dir, e.key + ".blob"), e.blob);
    this.atomicWrite(join(dir, META + ".json"), JSON.stringify(meta)); // 메타는 마지막
  }
  async listSnapshots(): Promise<SnapshotMeta[]> {
    let names: string[] = [];
    try { names = readdirSync(this.backupsDir); } catch { return []; } // 디렉터리 없음=스냅샷 0
    const metas: SnapshotMeta[] = [];
    for (const n of names) {
      try { metas.push(JSON.parse(readFileSync(join(this.backupsDir, n, META + ".json"), "utf8")) as SnapshotMeta); }
      catch { /* 메타 없음/손상 스킵 */ }
    }
    return metas;
  }
  async readSnapshot(id: string): Promise<Snapshot | null> {
    const dir = join(this.backupsDir, id);
    let meta: SnapshotMeta;
    try { meta = JSON.parse(readFileSync(join(dir, META + ".json"), "utf8")) as SnapshotMeta; } catch { return null; }
    const entries: BlobEntry[] = [];
    for (const key of meta.keys) {
      try { const blob = readFileSync(join(dir, key + ".blob"), "utf8"); entries.push({ key, blob, bytes: Buffer.byteLength(blob, "utf8") }); }
      catch { /* 누락 blob 스킵 */ }
    }
    return { meta, entries };
  }
  async pruneSnapshots(keep: number): Promise<string[]> {
    const drop = (await this.listSnapshots()).sort(byNewest).slice(keep);
    const dropped: string[] = [];
    for (const m of drop) { try { rmSync(join(this.backupsDir, m.id), { recursive: true, force: true }); dropped.push(m.id); } catch { /* */ } }
    return dropped;
  }
}

/* ───────────────── Memory: 휘발(테스트용 — 라이브 Map 주입) ───────────────── */
export class MemoryBlobBackend implements BlobBackend {
  readonly mode = "memory" as const;
  private snaps = new Map<string, Snapshot>();
  /** live: 테스트가 스토어 상태를 모사하려 주입(실 memory 모드 컨텍스트는 빈 Map → status 비대상). */
  constructor(private readonly live = new Map<string, string>()) {}
  listStoreKeys(): string[] { return [...this.live.keys()]; }
  async readStoreBlob(key: string): Promise<string | null> { return this.live.has(key) ? this.live.get(key)! : null; }
  async writeStoreBlob(key: string, blob: string): Promise<void> { this.live.set(key, blob); }
  async putSnapshot(meta: SnapshotMeta, entries: BlobEntry[]): Promise<void> { this.snaps.set(meta.id, { meta, entries: entries.map((e) => ({ ...e })) }); }
  async listSnapshots(): Promise<SnapshotMeta[]> { return [...this.snaps.values()].map((s) => s.meta); }
  async readSnapshot(id: string): Promise<Snapshot | null> { const s = this.snaps.get(id); return s ? { meta: s.meta, entries: s.entries.map((e) => ({ ...e })) } : null; }
  async pruneSnapshots(keep: number): Promise<string[]> {
    const drop = [...this.snaps.values()].map((s) => s.meta).sort(byNewest).slice(keep);
    const dropped: string[] = [];
    for (const m of drop) { this.snaps.delete(m.id); dropped.push(m.id); }
    return dropped;
  }
}
