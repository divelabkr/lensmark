/**
 * 알림 구독 저장소 — 인터페이스 + 메모리 어댑터(휘발). 파일(재시작 내구) 어댑터는 db/stores.ts(기존 영속 패턴과 동일 위치).
 *   경계: 저장/조회/해지만 담당(검증·동의=alertSubscription, 발송=smsSender seam).
 *   ⚠ PII(휴대폰): dedupe 키=phone(중복 누적 방지). 운영은 at-rest 암호화·접근통제 필요(hardening seam).
 */
import type { AlertSubscription } from "./alertSubscription";

export interface SubscriptionStore {
  upsert(sub: AlertSubscription): void;             // 신규/재동의(같은 phone 갱신)
  getByPhone(phone: string): AlertSubscription | undefined;
  unsubscribe(phone: string): boolean;              // 해지 = 레코드 '실제 삭제(파기)' (대상 있었으면 true)
  countActive(): number;                            // 활성 구독 수(ops) = 저장 건수(해지=삭제이므로)
  size(): number;                                   // 전체(ops/상한)
}

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }
const CAP = 200_000; // 전역 상한(메모리 고갈 DoS 방지)

export class InMemorySubscriptionStore implements SubscriptionStore {
  protected map = new Map<string, AlertSubscription>(); // key=phone(dedupe)
  constructor(protected readonly cap = CAP) {}

  upsert(sub: AlertSubscription): void {
    const prev = this.map.get(sub.phone);
    // 같은 번호 재신청 = 갱신(중복 누적 방지). 최초 createdAt은 보존.
    this.map.set(sub.phone, clone(prev ? { ...sub, createdAt: prev.createdAt } : sub));
    // CAP 초과 시 가장 오래된 항목 축출(메모리 DoS 백스톱). ⚠ 동의 레코드 유실 가능 → '조용히' 버리지 않고 경고(레드팀 NOTIFY-3).
    while (this.map.size > this.cap) {
      const k = this.map.keys().next().value as string | undefined; if (!k) break;
      this.map.delete(k);
      console.warn(`[subscription] CAP(${this.cap}) 초과 — 가장 오래된 동의 구독 축출(운영 시 파일/DB 백킹·상한 상향 권장)`);
    }
    this.persist();
  }
  getByPhone(phone: string): AlertSubscription | undefined { const e = this.map.get(phone); return e ? clone(e) : undefined; }
  /** 해지 = 레코드 실제 삭제(파기) — '보유: 해지 시까지' 안내와 일치(PIPA). 대상 있었으면 true. */
  unsubscribe(phone: string): boolean {
    const had = this.map.delete(phone);
    if (had) this.persist();
    return had;
  }
  countActive(): number { return this.map.size; } // 해지=삭제이므로 저장 건수=활성 구독 수
  size(): number { return this.map.size; }

  protected persist(): void { /* 메모리: no-op. 파일 어댑터가 오버라이드. */ }
}
