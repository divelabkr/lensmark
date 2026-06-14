/**
 * BackupManager — blob 계층 스냅샷/복구 오케스트레이션(BlobBackend 위에서 모드 무관).
 *   생성: 모든 라이브 blob을 불투명 바이트로 스냅샷(별도 위치) + 오래된 것 prune.
 *   복구(비가역): ① 확인 토큰 ② 스냅샷 존재 ③ 같은 모드 ④ **복구 전 현재 상태 자동 스냅샷(pre-restore=2단 되돌리기)**
 *     → 대상 blob을 라이브에 기록 → reloadRequired(인스턴스 재시작 후 메모리 반영. in-process 리로드는
 *       lost-update·보안상태 일관성창 위험이라 채택 안 함).
 */
import { BackupError, CONFIRM_TOKEN, SNAP_ID_RE, type BlobEntry, type SnapshotMeta, type StoreMode } from "./types";
import type { BlobBackend } from "./blobBackend";

/** 보존 스냅샷 개수(초과분 prune). */
const KEEP_SNAPSHOTS = 10;

/** ops가 표시할 백업 상태. */
export interface BackupStatus {
  mode: StoreMode;
  applicable: boolean;          // memory(휘발) 모드면 false
  note?: string;
  snapshots: SnapshotMeta[];    // 최신순
  lastBackupAt: string | null;
  storeKeys: string[];          // 백업 대상 키
  keepLimit: number;            // 보존 개수
  layer2: { kind: string; note: string }; // 진짜 DR 안내(정직 라벨)
}

/** 복구 결과(부분 실패도 정직하게 노출). */
export interface RestoreResult {
  ok: boolean;
  restored: string;             // 복구한 스냅샷 id
  preRestoreId: string | null;  // 복구 전 자동 스냅샷(되돌리기용)
  appliedKeys: string[];
  failedKeys: string[];
  reloadRequired: true;
  note: string;
}

const LAYER2_NOTE =
  "같은 Firestore 내 스냅샷은 운영 실수·논리 손상 복구용입니다. 프로젝트/DB 전체 손실(재해)은 보호하지 않습니다 — 진짜 DR은 Layer2: GCP 관리형 PITR(7일) + 일일 스케줄 백업.";

export class BackupManager {
  constructor(private readonly be: BlobBackend, private readonly appVersion: string) {}

  /** memory(휘발)이고 라이브 키가 없으면 백업 비대상. */
  private applicable(): boolean { return !(this.be.mode === "memory" && this.be.listStoreKeys().length === 0); }

  /** 정렬 가능·경로안전 id 생성(bk-<ISO치환>-<랜덤4>). */
  private newId(): string {
    const ts = new Date().toISOString().replace(/[:.]/g, "-"); // 2026-06-15T05-30-00-000Z
    const rnd = Math.random().toString(36).slice(2, 6);        // 동일 ms 충돌 방지
    return `bk-${ts}-${rnd}`;
  }

  /** 스냅샷 생성 — 모든 라이브 blob(원문)을 복사. reason: "manual" | "pre-restore" 등. */
  async createSnapshot(reason = "manual"): Promise<SnapshotMeta> {
    if (!this.applicable()) throw new BackupError("NOT_APPLICABLE", "memory(휘발) 모드 — 백업 대상이 없습니다(file/firestore에서만).");
    const id = this.newId();
    const createdAt = new Date().toISOString();
    const entries: BlobEntry[] = [];
    for (const key of this.be.listStoreKeys()) {
      const blob = await this.be.readStoreBlob(key);
      if (blob == null) continue; // 아직 영속 안 된 스토어는 건너뜀
      entries.push({ key, blob, bytes: Buffer.byteLength(blob, "utf8") });
    }
    const meta: SnapshotMeta = {
      id, createdAt, reason, storeMode: this.be.mode, appVersion: this.appVersion,
      keys: entries.map((e) => e.key), totalBytes: entries.reduce((s, e) => s + e.bytes, 0),
    };
    await this.be.putSnapshot(meta, entries);
    try { await this.be.pruneSnapshots(KEEP_SNAPSHOTS); } catch { /* prune 실패는 무시(다음 백업서 정리) */ }
    return meta;
  }

  /** 스냅샷 목록(최신순). */
  async listSnapshots(): Promise<SnapshotMeta[]> {
    return (await this.be.listSnapshots()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  /** ops 상태 패널용. */
  async status(): Promise<BackupStatus> {
    const applicable = this.applicable();
    let snapshots: SnapshotMeta[] = [];
    try { snapshots = await this.listSnapshots(); } catch { /* 조회 실패 → 빈 목록(상태는 여전히 노출) */ }
    return {
      mode: this.be.mode,
      applicable,
      note: applicable ? undefined : "휘발(memory 모드) — 백업은 file/firestore에서만 동작합니다.",
      snapshots,
      lastBackupAt: snapshots[0]?.createdAt ?? null,
      storeKeys: this.be.listStoreKeys(),
      keepLimit: KEEP_SNAPSHOTS,
      layer2: { kind: "GCP 관리형 PITR + 일일 스케줄 백업", note: LAYER2_NOTE },
    };
  }

  /**
   * 복구(비가역) — 가드 통과 시 pre-restore 자동 스냅샷 후 대상 blob을 라이브에 기록.
   *   확인 토큰·존재·모드 일치는 BackupError로 throw(라우트가 상태코드 매핑).
   */
  async restore(id: string, confirm: string): Promise<RestoreResult> {
    if (confirm !== CONFIRM_TOKEN) throw new BackupError("CONFIRM_REQUIRED", `복구 확인이 필요합니다(confirm="${CONFIRM_TOKEN}").`);
    if (!SNAP_ID_RE.test(id)) throw new BackupError("BAD_ID", "스냅샷 id 형식이 올바르지 않습니다.");
    const target = await this.be.readSnapshot(id);
    if (!target) throw new BackupError("SNAPSHOT_NOT_FOUND", `스냅샷을 찾을 수 없습니다: ${id}`);
    if (target.meta.storeMode !== this.be.mode) throw new BackupError("MODE_MISMATCH", `스냅샷 모드(${target.meta.storeMode}) ≠ 현재(${this.be.mode}) — 같은 모드에서만 복구할 수 있습니다.`);
    // ① 복구 전 현재 상태 자동 스냅샷(2단 되돌리기) — 실패해도 복구는 진행하되 preRestoreId=null로 정직 노출.
    let preRestoreId: string | null = null;
    try { preRestoreId = (await this.createSnapshot("pre-restore")).id; } catch { preRestoreId = null; }
    // ② 대상 blob을 라이브에 기록(원문 그대로). 부분 실패는 appliedKeys/failedKeys로 노출(운영자가 pre-restore 복귀 판단).
    const appliedKeys: string[] = [], failedKeys: string[] = [];
    for (const e of target.entries) {
      try { await this.be.writeStoreBlob(e.key, e.blob); appliedKeys.push(e.key); }
      catch { failedKeys.push(e.key); }
    }
    return {
      ok: failedKeys.length === 0,
      restored: id,
      preRestoreId,
      appliedKeys,
      failedKeys,
      reloadRequired: true,
      note: "복구가 영속 계층에 적용됐습니다 — 인스턴스 재시작 후 메모리에 반영됩니다(재시작 전엔 옛 상태가 다시 쓰일 수 있음).",
    };
  }
}
