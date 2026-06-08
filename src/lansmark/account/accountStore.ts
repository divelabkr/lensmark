/**
 * 계정 저장소 — 인터페이스 + 메모리 어댑터(휘발). 파일(재시작 내구) 어댑터는 db/stores.ts(FileAccountStore).
 *   경계: 저장/조회만 — 인증·세션·소유권은 routes/account.ts. PII(원 전화/이메일)는 저장하지 않고 authRef.subjectHash만.
 */
import type { Account } from "./types";

export interface AccountStore {
  create(a: Account): void;
  get(id: string): Account | undefined;
  findByAuthRef(method: string, subjectHash: string): Account | undefined; // 로그인 시 기존 계정 조회(해시 매칭)
  update(a: Account): void;          // 기존 1건 교체(예: authRef 추가)
  size(): number;
}

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }
const CAP = 200_000; // 메모리/파일 상한(DoS 백스톱)

export class InMemoryAccountStore implements AccountStore {
  protected map = new Map<string, Account>();
  constructor(protected readonly cap = CAP) {}
  create(a: Account): void { this.map.set(a.id, clone(a)); this.evict(); this.persist(); }
  get(id: string): Account | undefined { const a = this.map.get(id); return a ? clone(a) : undefined; }
  findByAuthRef(method: string, subjectHash: string): Account | undefined {
    for (const a of this.map.values())
      if (a.authRefs.some((r) => r.method === method && r.subjectHash === subjectHash)) return clone(a);
    return undefined;
  }
  update(a: Account): void { if (!this.map.has(a.id)) return; this.map.set(a.id, clone(a)); this.persist(); }
  size(): number { return this.map.size; }
  protected evict(): void { while (this.map.size > this.cap) { const k = this.map.keys().next().value as string | undefined; if (!k) break; this.map.delete(k); } }
  protected persist(): void { /* 메모리: no-op. 파일 어댑터가 오버라이드. */ }
}
