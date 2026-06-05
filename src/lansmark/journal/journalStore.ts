/**
 * 재배일지 저장소 — 인터페이스 + 메모리 어댑터(휘발).
 *   파일(재시작 내구) 어댑터는 db/stores.ts(FileJournalStore)에 둔다 — 기존 영속 패턴과 동일 위치.
 *   ⚠ 다중 인스턴스/고throughput은 같은 인터페이스로 DB(Postgres) 어댑터 추가(seam).
 *   경계: 저장/조회만 담당(소유권 검사·입력검증·플라이휠 승격은 routes/journal.ts).
 */
import type { JournalEntry } from "./types";

/** 재배일지 영속 인터페이스 — 라우트/엔진은 이 타입만 본다(memory↔file↔DB 드롭인). */
export interface JournalStore {
  create(entry: JournalEntry): void;          // 신규 1건 저장
  get(id: string): JournalEntry | undefined;  // id로 1건(소유권 검사는 호출측)
  listByUser(userId: string): JournalEntry[]; // 소유자의 일지(최신순)
  countByUser(userId: string): number;        // 소유자 건수만(복제·정렬 없이) — 상한 체크 핫패스용
  update(entry: JournalEntry): void;          // 기존 1건 전체 교체(없으면 무시)
  size(): number;                             // 전체 건수(ops/상한 점검)
}

/** JSON 안전 깊은 복제 — get/저장 시 참조 공유로 인한 우발적 변조를 막아 memory↔file 의미를 동일하게 유지. */
function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }

const CAP_ENTRIES = 50_000; // 전역 상한(메모리 고갈 DoS 방지). 초과 시 가장 오래된 것부터 제거(백스톱).

/* ───────────────── 메모리 어댑터(휘발) ───────────────── */
export class InMemoryJournalStore implements JournalStore {
  // Map은 삽입 순서를 보존 → 상한 초과 시 가장 오래된 키를 제거.
  protected map = new Map<string, JournalEntry>();
  constructor(protected readonly cap = CAP_ENTRIES) {}

  create(entry: JournalEntry): void {
    this.map.set(entry.id, clone(entry));
    this.evict();
    this.persist();
  }
  get(id: string): JournalEntry | undefined {
    const e = this.map.get(id);
    return e ? clone(e) : undefined; // 복제본 반환(호출측 변조가 저장본에 새지 않게)
  }
  listByUser(userId: string): JournalEntry[] {
    const out: JournalEntry[] = [];
    for (const e of this.map.values()) if (e.userId === userId) out.push(clone(e));
    // 최신순(createdAt 내림차순) — 동일 시각은 안정적 유지.
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }
  countByUser(userId: string): number {
    // 상한 체크 전용: 복제·정렬 없이 카운트만(create 핫패스 비용 절감 · 레드팀 DOS-2).
    let n = 0;
    for (const e of this.map.values()) if (e.userId === userId) n++;
    return n;
  }
  update(entry: JournalEntry): void {
    if (!this.map.has(entry.id)) return; // 존재하는 것만 갱신(생성은 create로)
    this.map.set(entry.id, clone(entry));
    this.persist();
  }
  size(): number { return this.map.size; }

  /** 전역 상한 초과분 제거(가장 오래된 삽입부터). */
  protected evict(): void {
    while (this.map.size > this.cap) {
      const k = this.map.keys().next().value as string | undefined;
      if (!k) break;
      this.map.delete(k);
    }
  }
  /** 메모리: no-op. 파일 어댑터가 오버라이드해 디스크로 flush. */
  protected persist(): void { /* no-op */ }
}
