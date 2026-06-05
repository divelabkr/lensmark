/**
 * 영속 스토어 회귀가드 — 파일 어댑터가 재시작(=새 인스턴스)에도 데이터를 보존하는지.
 *   임시 디렉터리에 쓰고, 같은 경로로 새 스토어를 만들어 로드 확인.
 */
import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStores, FileEntitlementStore, FileFeedbackStore, FileIdempotency, FileJournalStore, MemoryEntitlementStore,
} from "../db/stores";
import { toOutcomeRecord } from "../core/feedbackStore";
import type { JournalEntry } from "../journal/types";

const DIR = mkdtempSync(join(tmpdir(), "lansmark-db-"));
afterAll(() => { try { rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ } });

/** 테스트용 일지 생성기. */
function jent(over: Partial<JournalEntry> = {}): JournalEntry {
  return { id: "j1", userId: "order:1", createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z", cropId: "apple", events: [], status: "growing", ...over };
}

describe("영속 스토어 (file 어댑터 재시작 보존)", () => {
  it("FileFeedbackStore: add → 새 인스턴스가 로드", () => {
    const p = join(DIR, "fb.json");
    const a = new FileFeedbackStore(p);
    a.add(toOutcomeRecord({ cropId: "apple", userId: "u1", yieldKg: 1, costKrw: 1, revenueKrw: 1 }, { actualYieldKg: 1 }));
    a.add(toOutcomeRecord({ cropId: "grape", userId: "u2", yieldKg: 1, costKrw: 1, revenueKrw: 1 }, {}));
    const b = new FileFeedbackStore(p);                 // "재시작"
    expect(b.all().length).toBe(2);
    expect(b.query("apple").length).toBe(1);
  });

  it("FileEntitlementStore: quota 소진·실효가 재시작 후에도 유지", () => {
    const p = join(DIR, "ent.json");
    const a = new FileEntitlementStore(p);
    expect(a.consume("jti-x", 2)).toBe(true);  // 1
    expect(a.consume("jti-x", 2)).toBe(true);  // 2
    a.revoke("jti-y");
    const b = new FileEntitlementStore(p);                 // "재시작"
    expect(b.consume("jti-x", 2)).toBe(false); // 이미 2회 소진 → 초과(보존됨)
    expect(b.consume("jti-y", 5)).toBe(false); // 실효 유지
    expect(b.consume("jti-z", 1)).toBe(true);  // 새 토큰은 정상
  });

  it("FileIdempotency: mark 가 재시작 후에도 seen", () => {
    const p = join(DIR, "idem.json");
    const a = new FileIdempotency(p);
    a.mark("order-1");
    const b = new FileIdempotency(p);                     // "재시작"
    expect(b.seen("order-1")).toBe(true);
    expect(b.seen("order-2")).toBe(false);
  });

  it("FileJournalStore: create/update/listByUser 가 재시작 후에도 보존(최신순)", () => {
    const p = join(DIR, "journal.json");
    const a = new FileJournalStore(p);
    a.create(jent({ id: "j1", userId: "order:1", cropId: "apple", createdAt: "2026-03-01T00:00:00Z" }));
    a.create(jent({ id: "j2", userId: "order:1", cropId: "grape", createdAt: "2026-03-02T00:00:00Z" }));
    a.create(jent({ id: "j3", userId: "order:2", cropId: "onion" }));
    const e = a.get("j1")!; e.events.push({ at: "2026-03-05", kind: "sow" }); a.update(e); // 작업 추가 후 갱신
    const b = new FileJournalStore(p);                       // "재시작"
    expect(b.size()).toBe(3);
    expect(b.get("j1")!.events.length).toBe(1);              // update 보존
    expect(b.listByUser("order:1").map((x) => x.id)).toEqual(["j2", "j1"]); // createdAt 내림차순
    expect(b.listByUser("order:2").length).toBe(1);          // 소유자 격리
    expect(b.countByUser("order:1")).toBe(2);                // 카운트 전용(복제·정렬 없이 · DOS-2)
  });

  it("JournalStore.get 은 복제본 — 호출측 변조가 저장본에 새지 않음", () => {
    const a = new FileJournalStore(join(DIR, "journal2.json"));
    a.create(jent({ id: "k1", events: [] }));
    const got = a.get("k1")!; got.events.push({ at: "x", kind: "sow" }); // update 미호출
    expect(a.get("k1")!.events.length).toBe(0);              // 저장본 불변
  });

  it("createStores: memory 모드는 휘발(파일 미생성)", () => {
    const s = createStores({ mode: "memory", dir: DIR });
    expect(s.mode).toBe("memory");
    expect(s.entitlement instanceof MemoryEntitlementStore).toBe(true);
  });

  it("createStores: file 모드 3종 + 모드 플래그", () => {
    const s = createStores({ mode: "file", dir: join(DIR, "sub") });
    expect(s.mode).toBe("file");
    s.feedback.add(toOutcomeRecord({ cropId: "apple", yieldKg: 1, costKrw: 1, revenueKrw: 1 }, {}));
    expect(createStores({ mode: "file", dir: join(DIR, "sub") }).feedback.all().length).toBe(1); // 새 인스턴스가 로드
  });
});
