/**
 * 영속 스토어 어댑터 — 메모리(휘발) ↔ 파일(재시작 내구) 드롭인 교체.
 *   대상 상태: 플라이휠 실측(feedback) · 웹훅 멱등(idempotency) · 유료권한 소진/실효(entitlement).
 *   기존 인터페이스(FeedbackStore·IdempotencyStore)를 그대로 구현 — 라우트/엔진 코드 무변경.
 *   ⚠ 다중 인스턴스/고throughput 운영은 같은 인터페이스로 DB(Postgres/Redis) 어댑터를 추가(seam).
 */
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { JsonFile } from "./jsonFile";
import { InMemoryFeedbackStore, type FeedbackStore, type OutcomeRecord } from "../core/feedbackStore";
import { InMemoryIdempotency, type IdempotencyStore } from "../payment/pgWebhook";
import { InMemoryJournalStore, type JournalStore } from "../journal/journalStore";
import type { JournalEntry } from "../journal/types";
import { InMemorySubscriptionStore, type SubscriptionStore } from "../notify/subscriptionStore";
import type { AlertSubscription } from "../notify/alertSubscription";
import { InMemoryAnalyticsStore } from "../analytics/eventStore";
import type { AnalyticsStore } from "../analytics/types";
import { InMemoryAccountStore, type AccountStore } from "../account/accountStore";
import { InMemorySessionStore, type SessionStore } from "../account/sessionStore";
import type { Account, Session } from "../account/types";

/** 유료권한 토큰 소진(quota)·실효(revocation) 저장소. */
export interface EntitlementStore {
  consume(jti: string | undefined, quota: number): boolean; // true=허용(1회 소진) · false=초과/실효/무jti
  revoke(jti: string): void;
  revokedSize(): number;
  isRevoked(jti: string | undefined): boolean; // 토큰 검증과 별개로 실효 여부 조회 — consume 미호출 유료 surface의 킬스위치(레드팀 P1)
  /** 소진 환불(다운스트림 실패 시 1회 복원) — 서비스 미제공인데 quota만 차감되는 불공정 방지(감사 Low). */
  refund?(jti: string | undefined): void;
  /** firestore: 실효의 내구 확인(원격 반영 후 응답·H3). 미구현 어댑터는 undefined. */
  persistRevokedNow?(): Promise<void>;
  /** firestore: 스토어 비정상(워밍 실패=sealed) — 유료 게이트 ON 거부 판정용(H2). */
  isDegraded?(): boolean;
}
/** ops가 .all()을 쓰므로 확장 인터페이스로 노출. */
export interface FeedbackStoreEx extends FeedbackStore { all(): OutcomeRecord[]; }

const CAP_USE = 50_000, CAP_REVOKED = 50_000; // 메모리/파일 상한(DoS 방지)

/* ───────────────── Entitlement: 메모리 ───────────────── */
export class MemoryEntitlementStore implements EntitlementStore {
  protected use = new Map<string, number>();
  protected revoked = new Set<string>();
  consume(jti: string | undefined, quota: number): boolean {
    if (!jti) return false;                       // jti 없는 토큰 거부(fail-closed · 레드팀 H4)
    if (this.revoked.has(jti)) return false;      // 실효 토큰 거부
    const n = (this.use.get(jti) ?? 0) + 1;
    if (n > quota) return false;                  // 소진 초과(증가 안 함)
    this.use.set(jti, n);
    if (this.use.size > CAP_USE) {
      // ⚠ 백스톱 축출(FIFO) — 활성 토큰의 소진 카운터가 리셋돼 quota가 재부여될 소지(레드팀 ENT-CAP-RESET).
      //   '조용히' 버리지 않고 경고로 가시화: 이 규모(5만 토큰)는 영속(file/DB) + exp 만료청소가 필요한 신호다.
      const k = this.use.keys().next().value as string | undefined; if (k) this.use.delete(k);
      console.warn(`[entitlement] use CAP(${CAP_USE}) 초과 — 카운터 축출(quota 재부여 위험). 운영은 DB 어댑터 + exp 만료청소 필요.`);
    }
    this.persist();
    return true;
  }
  revoke(jti: string): void {
    this.revoked.add(jti);
    if (this.revoked.size > CAP_REVOKED) {
      // ⚠ 실효 토큰 축출 = '부활'(보안 회귀) 위험 — 경고로 가시화. 운영은 영속 DB(무축출)로 분리(레드팀 ENT-CAP-RESET).
      const k = this.revoked.keys().next().value as string | undefined; if (k) this.revoked.delete(k);
      console.warn(`[entitlement] revoked CAP(${CAP_REVOKED}) 초과 — 실효 토큰 부활 위험. 운영은 영속 DB로.`);
    }
    this.persist();
  }
  revokedSize(): number { return this.revoked.size; }
  isRevoked(jti: string | undefined): boolean { return jti != null && this.revoked.has(jti); } // consume 미호출 경로(guide/foreign/journal)도 실효 강제(레드팀 P1)
  /** 소진 1회 환불 — 소진 후 다운스트림(provider·엔진) 실패로 결과 미제공 시 quota 복원(과금 공정성·감사 Low). */
  refund(jti: string | undefined): void {
    if (!jti) return;
    const n = this.use.get(jti);
    if (n && n > 0) { this.use.set(jti, n - 1); this.persist(); }
  }
  protected persist(): void { /* 메모리: no-op */ }
}

/* ───────────────── Entitlement: 파일 ───────────────── */
export class FileEntitlementStore extends MemoryEntitlementStore {
  private file: JsonFile<{ use: [string, number][]; revoked: string[] }>;
  constructor(path: string) {
    super();
    this.file = new JsonFile(path, { use: [], revoked: [] });
    this.use = new Map(this.file.data.use ?? []);
    this.revoked = new Set(this.file.data.revoked ?? []);
  }
  protected persist(): void {
    this.file.data = { use: [...this.use], revoked: [...this.revoked] };
    this.file.flush();
  }
}

/* ───────────────── Feedback: 파일 ───────────────── */
export class FileFeedbackStore implements FeedbackStoreEx {
  private file: JsonFile<OutcomeRecord[]>;
  constructor(path: string, private readonly maxRows = 20_000) { this.file = new JsonFile(path, []); }
  add(rec: OutcomeRecord): void {
    this.file.data.push({ ...rec, createdAt: rec.createdAt ?? new Date().toISOString() });
    if (this.file.data.length > this.maxRows) this.file.data.splice(0, this.file.data.length - this.maxRows);
    this.file.flush();
  }
  query(cropId: string, region?: string): OutcomeRecord[] {
    return this.file.data.filter((r) => r.cropId === cropId && (region == null || r.region === region));
  }
  all(): OutcomeRecord[] { return this.file.data.slice(); }
}

/* ───────────────── Idempotency: 파일 ───────────────── */
export class FileIdempotency implements IdempotencyStore {
  private file: JsonFile<string[]>;
  private set: Set<string>;
  constructor(path: string, private readonly max = 50_000) { this.file = new JsonFile(path, []); this.set = new Set(this.file.data); }
  seen(k: string): boolean { return this.set.has(k); }
  mark(k: string): void {
    this.set.add(k);
    if (this.set.size > this.max) { const f = this.set.keys().next().value as string | undefined; if (f) this.set.delete(f); }
    this.file.data = [...this.set];
    this.file.flush();
  }
}

/* ───────────────── Journal(재배일지): 파일 ───────────────── */
/** 메모리 어댑터를 상속해 로드/flush만 디스크로 — 기존 File* 스토어들과 동일 패턴. */
export class FileJournalStore extends InMemoryJournalStore {
  private file: JsonFile<JournalEntry[]>;
  constructor(path: string, cap?: number) {
    super(cap);
    this.file = new JsonFile(path, []);
    for (const e of this.file.data ?? []) this.map.set(e.id, e); // 부팅 시 디스크 → 메모리 적재(재시작 보존)
  }
  protected persist(): void { this.file.data = [...this.map.values()]; this.file.flush(); }
}

/* ───────────────── 알림 구독(notify): 파일 ───────────────── */
/** 메모리 어댑터 상속 — 로드/flush만 디스크로(기존 File* 패턴 동일). PII(휴대폰) 평문 저장 → 운영은 at-rest 암호화 seam. */
export class FileSubscriptionStore extends InMemorySubscriptionStore {
  private file: JsonFile<AlertSubscription[]>;
  constructor(path: string, cap?: number) {
    super(cap);
    this.file = new JsonFile(path, []);
    for (const s of this.file.data ?? []) this.map.set(s.phone, s); // 부팅 시 디스크→메모리(재시작 보존)
  }
  protected persist(): void { this.file.data = [...this.map.values()]; this.file.flush(); }
}

/* ───────────────── 익명 수요·퍼널 계측(analytics): 파일 ───────────────── */
/** 메모리 어댑터 상속 — 로드 + throttle flush. 분석 이벤트는 빈번(매 추천·시뮬)하므로 매번 동기 fs 쓰기는 부담 →
 *   N건마다 1회만 디스크 반영(메모리는 항상 최신, 크래시 시 최근 <N건만 손실=집계엔 무해). PII 없음. */
export class FileAnalyticsStore extends InMemoryAnalyticsStore {
  private file: JsonFile<{ funnel: Record<string, number>; demand: [string, number][]; gaps: [string, number][]; since: string }>;
  private dirty = 0;
  private static readonly FLUSH_EVERY = 25; // 25 이벤트마다 1회 디스크 쓰기(동기 fs 부담 완화)
  constructor(path: string) {
    super();
    this.file = new JsonFile(path, { funnel: {}, demand: [], gaps: [], since: this.since });
    this.funnelC = this.file.data.funnel ?? {};
    this.demandC = new Map(this.file.data.demand ?? []);
    this.gapC = new Map(this.file.data.gaps ?? []);
    this.since = this.file.data.since ?? this.since; // 최초 집계 시작 시각 보존(재시작 누적)
  }
  protected persist(): void {
    if (++this.dirty < FileAnalyticsStore.FLUSH_EVERY) return; // throttle
    this.flush();
  }
  /** 즉시 디스크 반영(throttle 무시) — graceful 종료 훅(SIGTERM/SIGINT)에서 호출(레드팀 L-3, 버퍼 손실 방지). */
  flush(): void {
    this.dirty = 0;
    this.file.data = { funnel: this.funnelC, demand: [...this.demandC], gaps: [...this.gapC], since: this.since };
    this.file.flush();
  }
}

/* ───────────────── 계정·세션(account): 파일 ───────────────── */
/** 메모리 어댑터 상속 — 로드/flush만 디스크로(기존 File* 패턴). PII는 authRef.subjectHash만(원 식별자 미저장) + at-rest 암호화 seam 자동 적용. */
export class FileAccountStore extends InMemoryAccountStore {
  private file: JsonFile<Account[]>;
  constructor(path: string, cap?: number) { super(cap); this.file = new JsonFile(path, []); for (const a of this.file.data ?? []) this.map.set(a.id, a); }
  protected persist(): void { this.file.data = [...this.map.values()]; this.file.flush(); }
}
export class FileSessionStore extends InMemorySessionStore {
  private file: JsonFile<Session[]>;
  constructor(path: string, cap?: number) { super(cap); this.file = new JsonFile(path, []); for (const s of this.file.data ?? []) this.map.set(s.token, s); }
  protected persist(): void { this.file.data = [...this.map.values()]; this.file.flush(); }
}

/* ───────────────── 팩토리 ───────────────── */
export interface Stores {
  feedback: FeedbackStoreEx; idem: IdempotencyStore; entitlement: EntitlementStore; journal: JournalStore;
  subscriptions: SubscriptionStore; analytics: AnalyticsStore; accounts: AccountStore; sessions: SessionStore;
  mode: "memory" | "file" | "firestore";
  /** firestore 모드: 부팅 워밍(원격 상태 로드) 완료 신호 — devServer가 listen 前 대기. */
  ready?: Promise<void>;
  /** firestore 모드: 감사로그 내구 저장 싱크(lm_audit) — file 모드의 audit.jsonl 대체. */
  auditSink?: (entry: { at: string; type: string; detail: string }) => void;
  /** firestore 모드: 종료(SIGTERM) 시 진행 중 쓰기 완료 대기(유실 방지·H3). */
  flushAll?: () => Promise<void>;
}

/** 모드별 스토어 생성(memory|file). firestore는 순환 import 회피를 위해 db/firestoreStores.createFirestoreStores()를 context에서 직접 사용. file 모드인데 디렉터리 쓰기 불가면 메모리로 자동 폴백(무중단). */
export function createStores(opts: { mode: "memory" | "file"; dir: string; feedbackMax?: number }): Stores {
  if (opts.mode === "file") {
    try {
      mkdirSync(opts.dir, { recursive: true }); // 쓰기 가능 확인
      return {
        feedback: new FileFeedbackStore(join(opts.dir, "feedback.json"), opts.feedbackMax),
        idem: new FileIdempotency(join(opts.dir, "idempotency.json")),
        entitlement: new FileEntitlementStore(join(opts.dir, "entitlement.json")),
        journal: new FileJournalStore(join(opts.dir, "journal.json")),
        subscriptions: new FileSubscriptionStore(join(opts.dir, "subscriptions.json")),
        analytics: new FileAnalyticsStore(join(opts.dir, "analytics.json")),
        accounts: new FileAccountStore(join(opts.dir, "accounts.json")),
        sessions: new FileSessionStore(join(opts.dir, "sessions.json")),
        mode: "file",
      };
    } catch { /* 쓰기 불가 → 메모리 폴백 */ }
  }
  return {
    feedback: new InMemoryFeedbackStore(opts.feedbackMax),
    idem: new InMemoryIdempotency(),
    entitlement: new MemoryEntitlementStore(),
    journal: new InMemoryJournalStore(),
    subscriptions: new InMemorySubscriptionStore(),
    analytics: new InMemoryAnalyticsStore(),
    accounts: new InMemoryAccountStore(),
    sessions: new InMemorySessionStore(),
    mode: "memory",
  };
}
