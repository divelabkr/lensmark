/**
 * 백업/복구 타입 + 상수(SSOT).
 *   설계 핵심: **blob 계층 백업** — 각 스토어의 영속 blob(lm_state 문서/파일, 키 있으면 ENC1 암호문)을
 *     불투명 바이트로 그대로 복사. 복호·재암호 0 → 키 불필요·PII 비노출·라운드트립 자명·키 회전 안전.
 *   같은 모드 복구만 지원: file/firestore 문서 레이아웃이 다름(file=entitlement 합본·runtimeFlags.json,
 *     firestore=use/revoked 분리·flags) → 스냅샷 meta에 storeMode를 박고 동일 모드만 복구(cross-mode 금지).
 */
export type StoreMode = "memory" | "file" | "firestore";

/** 복구 확인 토큰 — 단순 클릭 금지(타이핑 확인). 클라+서버 이중. */
export const CONFIRM_TOKEN = "RESTORE";

/** 스냅샷 id 형식(경로주입·Firestore doc id 안전) — 생성도 이 형식만, 복구 입력도 이 형식만 허용. */
export const SNAP_ID_RE = /^bk-[0-9A-Za-z-]+$/;

/** 스냅샷 1건의 메타(목록·복구 판단용). */
export interface SnapshotMeta {
  id: string;            // 정렬 가능 id(예: "bk-2026-06-15T05-30-00-000Z-a1b2")
  createdAt: string;     // ISO8601
  reason: string;        // "manual" | "pre-restore" | ...
  storeMode: StoreMode;  // 생성 당시 모드(동일 모드만 복구)
  appVersion: string;    // 생성 당시 앱 버전(참고)
  keys: string[];        // 포함된 스토어 키
  totalBytes: number;    // blob 바이트 합(참고)
}

/** 스토어 1개의 blob(암호문 또는 평문 — 불투명 바이트). */
export interface BlobEntry { key: string; blob: string; bytes: number; }

/** 스냅샷 = 메타 + blob 목록. */
export interface Snapshot { meta: SnapshotMeta; entries: BlobEntry[]; }

/** 코드 있는 백업 오류 — 라우트가 HTTP 상태로 매핑(CONFIRM_REQUIRED→400·SNAPSHOT_NOT_FOUND→404·MODE_MISMATCH/BAD_ID→409·400). */
export class BackupError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "BackupError"; }
}
