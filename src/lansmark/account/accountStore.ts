/**
 * 계정 저장소 — 인터페이스 + 메모리 어댑터(휘발). 파일(재시작 내구) 어댑터는 db/stores.ts(FileAccountStore).
 *   경계: 저장/조회만 — 인증·세션·소유권은 routes/account.ts. PII(원 전화/이메일)는 저장하지 않고 authRef.subjectHash만.
 */
import type { Account, AccountEntitlement } from "./types";

export interface AccountStore {
  create(a: Account): void;
  get(id: string): Account | undefined;
  findByAuthRef(method: string, subjectHash: string): Account | undefined; // 로그인 시 기존 계정 조회(해시 매칭)
  findByEntitlement(jti: string): Account | undefined; // jti가 연결된 계정(계정 간 중복 연결 차단)
  linkEntitlement(accountId: string, ent: AccountEntitlement): "ok" | "taken" | "notfound"; // 원자적 연결(배타성+추가를 await 없는 단일 블록 — lost-update·경합 차단)
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
  findByEntitlement(jti: string): Account | undefined {
    for (const a of this.map.values())
      if ((a.entitlements ?? []).some((e) => e.jti === jti)) return clone(a);
    return undefined;
  }
  /** 원자적(동기·await 없음): jti 배타성 검사 + 추가를 한 블록에서 → 동시 연결 lost-update·경합 차단(단일 인스턴스·레드팀 #2/#4). */
  linkEntitlement(accountId: string, ent: AccountEntitlement): "ok" | "taken" | "notfound" {
    for (const a of this.map.values())
      if (a.id !== accountId && (a.entitlements ?? []).some((e) => e.jti === ent.jti)) return "taken";
    const a = this.map.get(accountId); // 라이브 객체(클론 아님) — await 없는 단일 블록이라 원자적
    if (!a) return "notfound";
    const list = a.entitlements ?? (a.entitlements = []);
    if (!list.some((e) => e.jti === ent.jti)) { list.push(ent.exp != null ? { jti: ent.jti, exp: ent.exp } : { jti: ent.jti }); this.persist(); } // 멱등
    return "ok";
  }
  update(a: Account): void { if (!this.map.has(a.id)) return; this.map.set(a.id, clone(a)); this.persist(); }
  size(): number { return this.map.size; }
  protected evict(): void { while (this.map.size > this.cap) { const k = this.map.keys().next().value as string | undefined; if (!k) break; this.map.delete(k); } }
  protected persist(): void { /* 메모리: no-op. 파일 어댑터가 오버라이드. */ }
}
