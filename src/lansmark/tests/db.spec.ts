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

describe("Entitlement use 축출 — 만료 우선(설계감사 P1#5)", () => {
  it("상한 초과 시 만료(exp<now) 토큰만 축출 — 활성 토큰 quota 재부여 안 됨", () => {
    const s = new MemoryEntitlementStore(2); // capUse=2(테스트 주입)
    const past = Date.now() - 1000, future = Date.now() + 3_600_000;
    expect(s.consume("expired", 5, past)).toBe(true);   // size 1(만료)
    expect(s.consume("active", 5, future)).toBe(true);  // size 2(활성, n=1)
    expect(s.consume("active", 5, future)).toBe(true);  // active n=2(같은 키 → size 유지)
    expect(s.consume("newone", 5, future)).toBe(true);  // size 3>2 → 만료분(expired) 우선 축출 → size 2
    expect(s.hasUsage!("expired")).toBe(false);         // 만료분 축출됨
    expect(s.hasUsage!("active")).toBe(true);           // 활성 보존
    expect(s.consume("active", 2, future)).toBe(false); // active n=2 유지 → quota 2 초과(재부여 없음)
  });
  it("만료분이 없으면 FIFO 백스톱(바운드 유지)", () => {
    const s = new MemoryEntitlementStore(2);
    const future = Date.now() + 3_600_000;
    for (const k of ["a", "b", "c"]) expect(s.consume(k, 5, future)).toBe(true); // 전부 활성
    expect(["a", "b", "c"].filter((k) => s.hasUsage!(k)).length).toBe(2);        // 상한 2로 바운드(FIFO 1개 축출)
  });
});

describe("FilePushSubscriptionStore — 웹푸시 구독 재시작 보존(아침 브리핑 약속)", () => {
  it("upsert → 새 인스턴스가 구독자ID까지 로드 · remove도 영속", async () => {
    const { FilePushSubscriptionStore } = await import("../db/stores");
    const p = join(DIR, "push.json");
    const a = new FilePushSubscriptionStore(p);
    a.upsert({ endpoint: "https://fcm.googleapis.com/send/x1", keys: { p256dh: "k1", auth: "a1" } }, { subscriberId: "anon-11", cropId: "apple" });
    a.upsert({ endpoint: "https://fcm.googleapis.com/send/x2", keys: { p256dh: "k2", auth: "a2" } }, { subscriberId: "anon-22" });
    const b = new FilePushSubscriptionStore(p); // 재시작 시뮬레이션
    expect(b.size()).toBe(2);
    const e1 = b.entries().find((e) => e.sub.endpoint.endsWith("x1"))!;
    expect(e1.subscriberId).toBe("anon-11"); // 구독자 귀속(맞춤 발송 키) 보존
    expect(e1.cropId).toBe("apple");
    b.remove("https://fcm.googleapis.com/send/x1"); // 만료 파기도 디스크 반영
    const c = new FilePushSubscriptionStore(p);
    expect(c.size()).toBe(1);
  });
});
