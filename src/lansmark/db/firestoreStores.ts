/**
 * Firestore 영속 스토어(§3-1) — Cloud Run '재배포=데이터 소실'을 끝내는 어댑터.
 *   패턴: File* 스토어와 동일하게 Memory* 를 상속, persist() 훅만 Firestore 문서 쓰기로 교체.
 *   문서 모델: 스토어당 문서 1개(lm_state/{이름}, {"j": JSON}) = JsonFile 1:1 미러 → 호출부·인터페이스 무변경(sync 유지).
 *   쓰기: write-through(즉시 비동기) + in-flight 병합(최신만) + 재시도 3회 — 단일 인스턴스(min=max=1) 전제의 '내구성'용.
 *     ⚠ 다중 인스턴스 정합(유니크 제약·락)은 아님 — 유료 확장 시 per-record 어댑터로 승격(ROADMAP §3-1).
 *   부팅: warm()이 모든 문서를 로드해 메모리 채움(devServer가 listen 前 대기).
 *     로드 실패 시 sealed=true → persist 무력화(빈 상태로 기존 데이터 덮어쓰기 방지 — jsonFile sealed와 동일 철학).
 *   감사로그: auditSink가 lm_audit 컬렉션에 문서 추가(append-only) — /tmp audit.jsonl 휘발 보완.
 */
import { FirestoreLite } from "./firestoreLite";
import { sealAtRest, openAtRest } from "./atRest"; // G1 보강 — firestore 문서도 file과 동일 키로 at-rest 암호화(PII: 전화·일지 좌표/매출)
import { MemoryEntitlementStore, loadUseEntries, type UseEntry, type FeedbackStoreEx, type Stores } from "./stores";
import { type OutcomeRecord } from "../core/feedbackStore";
import { type IdempotencyStore } from "../payment/pgWebhook";
import { InMemoryJournalStore } from "../journal/journalStore";
import type { JournalEntry } from "../journal/types";
import { InMemorySubscriptionStore } from "../notify/subscriptionStore";
import type { AlertSubscription } from "../notify/alertSubscription";
import { InMemoryAnalyticsStore, type DayCounts } from "../analytics/eventStore";
import { InMemoryAccountStore } from "../account/accountStore";
import { InMemorySessionStore } from "../account/sessionStore";
import type { Account, Session } from "../account/types";

const COLLECTION = "lm_state";      // 스토어 상태 문서 모음(문서 id = 스토어 이름)
const AUDIT_COLLECTION = "lm_audit"; // 감사로그(append-only · 자동 ID)
const MAX_BLOB = 900_000;            // Firestore 문서 1MiB 한도 여유분 — 초과 시 경고 후 쓰기 보류(메모리는 유지)

/**
 * lm_state 문서 id의 SSOT(백업/복구가 재사용) — 이 목록·아래 팩토리의 d(...)·runtimeFlags("flags")가 한 출처.
 *   ⚠ 새 스토어 문서를 추가하면 여기에도 반드시 등록(아니면 백업에서 조용히 누락). file 모드 파일명 매핑은 stores.ts FILE_STORE_FILES.
 */
export const STORE_DOC_IDS = {
  feedback: "feedback",
  idempotency: "idempotency",
  entitlementUse: "entitlement_use",
  entitlementRevoked: "entitlement_revoked",
  journal: "journal",
  subscriptions: "subscriptions",
  analytics: "analytics",
  accounts: "accounts",
  sessions: "sessions",
  flags: "flags", // runtimeFlags.ts가 생성(이 팩토리 밖) — 백업은 lm_state/flags로 직접 접근
} as const;

/** 백업 대상 lm_state 문서 id 전체(firestore 모드) — BlobBackend가 열거에 사용. */
export const BACKUP_STORE_KEYS: readonly string[] = Object.values(STORE_DOC_IDS);

/**
 * 문서 1개의 내구 저장 채널 — 즉시 쓰기 + in-flight 병합(최신 상태만) + 지수 재시도.
 *   sealed: 부팅 로드 실패 시 true → save 무력화(기존 원격 데이터를 빈 상태로 덮지 않음).
 */
export class FsDoc {
  private inflight = false;
  private pending: string | null = null;
  private draining: Promise<void> = Promise.resolve(); // 현재 드레인 완료 추적(종료 시 await — H3)
  private lastErr: unknown = null; // 직전 drain 사이클의 최종 실패 — saveNow 내구 확인(P1#4)
  sealed = false;
  constructor(private readonly fs: FirestoreLite, private readonly id: string) {}

  async load(): Promise<string | null> {
    let raw: string | null;
    try { raw = await this.fs.getJson(COLLECTION, this.id); }
    catch (e) {
      this.sealed = true; // 읽기 실패 = 원격 상태 미상 → 쓰기 봉인(데이터 보호 우선)
      console.error(`[firestore] ${this.id} 로드 실패 — 쓰기 봉인(sealed). 원인:`, (e as Error)?.message);
      throw e;
    }
    if (raw == null) return null;
    // at-rest 복호(G1) — ENC1: 문서는 키로 복호, legacy 평문은 그대로(다음 저장에서 암호화 이행). 복호 불가=sealed(잘못된 키로 원본 덮어쓰기 방지 — jsonFile과 동일 철학).
    const opened = openAtRest(raw);
    if (!opened.ok) {
      this.sealed = true;
      console.error(`[firestore] ${this.id} 암호화 문서 ${opened.reason === "no-key" ? "복호 키 없음(LANSMARK_DATA_KEY 미설정)" : "복호 실패(키 불일치/손상)"} — 쓰기 봉인(sealed)`);
      throw new Error(`${this.id} at-rest 복호 불가(${opened.reason})`);
    }
    return opened.plain;
  }

  /** 최신 상태 저장(논블로킹). 호출부는 sync — 실패는 재시도 후 경고(운영 연속성 우선). */
  save(json: string): void {
    if (this.sealed) return;
    const stored = sealAtRest(json); // 키 있으면 암호화(G1) — 크기 한도는 '실제 저장 페이로드' 기준(암호문이 ~1.37배)
    if (stored.length > MAX_BLOB) { console.warn(`[firestore] ${this.id} 상태 ${stored.length}B > ${MAX_BLOB}B — 쓰기 보류(per-record 어댑터 승격 필요·§3-1)`); return; }
    this.pending = stored;
    if (!this.inflight) this.draining = this.drain();
  }

  /** 진행 중인 쓰기 완료 대기 — 종료 훅(SIGTERM)이 in-flight 유실을 막으려 await(H3). 실패로 남은 잔여 pending은 종료 직전 1회 더 시도(P2). */
  async whenDrained(): Promise<void> {
    await this.draining.catch(() => {});
    if (this.pending != null && !this.inflight) { this.draining = this.drain(); await this.draining.catch(() => {}); } // 잔여 미반영분 종료 직전 재시도
  }

  /**
   * 동기 저장 + 내구 확인(await 가능) — 실효 등 보안 쓰기가 '원격 반영 후' 응답하기 위함(H3). 실패는 throw.
   *   P1#4: 별도 직접 PATCH 경로를 두지 않고 save()의 단일 drain 큐로 합류한다. 두 경로(save·saveNow)가
   *   같은 문서에 동시 PATCH해 옛 스냅샷이 새 스냅샷을 덮어쓰던 lost-update(실효 부활)를 제거. 최신 pending을
   *   적재하고 drain 완료까지 대기한 뒤, 그 사이클의 최종 실패면 throw(내구 확인 실패 → 호출부가 durable:false 전파).
   */
  async saveNow(json: string): Promise<void> {
    if (this.sealed) throw new Error(`${this.id} sealed — 저장 불가`);
    const stored = sealAtRest(json); // 암호화 경로 동일(G1)
    if (stored.length > MAX_BLOB) throw new Error(`${this.id} ${stored.length}B > ${MAX_BLOB}B(per-record 승격 필요)`);
    this.pending = stored;
    this.lastErr = null;
    if (!this.inflight) this.draining = this.drain();
    await this.draining;
    if (this.lastErr) throw this.lastErr; // 이 사이클이 최종 실패 → 내구 미확인
  }

  private async drain(): Promise<void> {
    this.inflight = true;
    try {
      while (this.pending != null) {
        const j = this.pending; this.pending = null; // 최신만 전송(중간 상태 스킵)
        let ok = false;
        for (let i = 0; i < 3 && !ok; i++) {
          try { await this.fs.setJson(COLLECTION, this.id, j); ok = true; this.lastErr = null; }
          catch (e) {
            this.lastErr = e; // saveNow 내구 확인용(P1#4) — 성공 시 위에서 null로 갱신
            if (i === 2) console.error(`[firestore] ${this.id} 저장 실패(3회) — 다음 변경 때 재시도. 원인:`, (e as Error)?.message);
            else await new Promise((r) => setTimeout(r, 300 * (i + 1)));
          }
        }
        if (!ok) { if (this.pending == null) this.pending = j; break; } // 영구 실패 — 스냅샷 보존(다음 save/whenDrained가 재시도, P2: 조용한 유실 차단)
      }
    } finally { this.inflight = false; }
  }
}

/* ───────── Entitlement(소진·실효) — revoked는 절대 잃지 않아야 하는 보안 상태 ─────────
   M2 수정: use와 revoked를 '별도 문서'로 분리 → use가 비대(900KB 한도)해져도 revoked(작은 보안 상태)는
   영속이 막히지 않는다. revoke는 saveNow로 내구 확인(H3). */
export class FirestoreEntitlementStore extends MemoryEntitlementStore {
  constructor(private readonly useDoc: FsDoc, private readonly revDoc: FsDoc) { super(); }
  async warm(): Promise<void> {
    // allSettled: 한 문서 로드가 실패해도 다른 문서가 끝까지 settle(=sealed)되도록 — Promise.all은 첫 실패에 반환해 일부 문서가 sealed 전일 수 있음(P2 race 차단).
    const [u, r] = await Promise.allSettled([this.useDoc.load(), this.revDoc.load()]);
    if (u.status === "fulfilled" && u.value) this.use = loadUseEntries(JSON.parse(u.value) as ([string, number] | [string, UseEntry])[]); // 레거시/신형 호환(P1#5)
    if (r.status === "fulfilled" && r.value) this.revoked = new Set(JSON.parse(r.value) as string[]);
    if (u.status === "rejected" || r.status === "rejected") throw (u.status === "rejected" ? u.reason : (r as PromiseRejectedResult).reason); // 하나라도 실패 → 둘 다 settle(sealed) 후 throw
  }
  protected persist(): void {
    this.revDoc.save(JSON.stringify([...this.revoked])); // 보안 상태 — 항상 작음, 한도 무관
    this.useDoc.save(JSON.stringify([...this.use]));       // 소진 카운터 — 커지면 경고(per-record 승격)
  }
  /** 실효의 내구 확인 — ops/revoke가 '원격 반영 후' 응답하기 위해 await(H3). 실패는 throw → durable:false. */
  async persistRevokedNow(): Promise<void> { await this.revDoc.saveNow(JSON.stringify([...this.revoked])); }
  /** 스토어 비정상(워밍 실패=sealed) — 이 상태에서 유료 게이트 ON을 거부하기 위함(H2). */
  isDegraded(): boolean { return this.useDoc.sealed || this.revDoc.sealed; }
}

/* ───────── Idempotency(웹훅 멱등) ───────── */
export class FirestoreIdempotency implements IdempotencyStore {
  private set = new Set<string>();
  constructor(private readonly doc: FsDoc, private readonly max = 50_000) {}
  async warm(): Promise<void> { const j = await this.doc.load(); if (j) this.set = new Set(JSON.parse(j) as string[]); }
  seen(k: string): boolean { return this.set.has(k); }
  mark(k: string): void {
    this.set.add(k);
    if (this.set.size > this.max) { const f = this.set.keys().next().value as string | undefined; if (f) this.set.delete(f); }
    this.doc.save(JSON.stringify([...this.set]));
  }
}

/* ───────── Feedback(플라이휠 실측 — 해자 데이터) ───────── */
export class FirestoreFeedbackStore implements FeedbackStoreEx {
  private rows: OutcomeRecord[] = [];
  constructor(private readonly doc: FsDoc, private readonly maxRows = 20_000) {}
  async warm(): Promise<void> { const j = await this.doc.load(); if (j) this.rows = JSON.parse(j) as OutcomeRecord[]; }
  add(rec: OutcomeRecord): void {
    this.rows.push({ ...rec, createdAt: rec.createdAt ?? new Date().toISOString() });
    if (this.rows.length > this.maxRows) this.rows.splice(0, this.rows.length - this.maxRows);
    this.doc.save(JSON.stringify(this.rows));
  }
  query(cropId: string, region?: string): OutcomeRecord[] { return this.rows.filter((r) => r.cropId === cropId && (region == null || r.region === region)); }
  all(): OutcomeRecord[] { return this.rows.slice(); }
}

/* ───────── Journal·구독·계정·세션 — Memory* 상속, 로드/persist만 교체(File*와 동일 모양) ───────── */
export class FirestoreJournalStore extends InMemoryJournalStore {
  constructor(private readonly doc: FsDoc, cap?: number) { super(cap); }
  async warm(): Promise<void> { const j = await this.doc.load(); if (j) for (const e of JSON.parse(j) as JournalEntry[]) this.map.set(e.id, e); }
  protected persist(): void { this.doc.save(JSON.stringify([...this.map.values()])); }
}
export class FirestoreSubscriptionStore extends InMemorySubscriptionStore {
  constructor(private readonly doc: FsDoc, cap?: number) { super(cap); }
  async warm(): Promise<void> { const j = await this.doc.load(); if (j) for (const s of JSON.parse(j) as AlertSubscription[]) this.map.set(s.phone, s); }
  protected persist(): void { this.doc.save(JSON.stringify([...this.map.values()])); }
}
export class FirestoreAccountStore extends InMemoryAccountStore {
  constructor(private readonly doc: FsDoc, cap?: number) { super(cap); }
  async warm(): Promise<void> { const j = await this.doc.load(); if (j) for (const a of JSON.parse(j) as Account[]) this.map.set(a.id, a); }
  protected persist(): void { this.doc.save(JSON.stringify([...this.map.values()])); }
}
export class FirestoreSessionStore extends InMemorySessionStore {
  constructor(private readonly doc: FsDoc, cap?: number) { super(cap); }
  async warm(): Promise<void> { const j = await this.doc.load(); if (j) for (const s of JSON.parse(j) as Session[]) this.map.set(s.token, s); }
  protected persist(): void { this.doc.save(JSON.stringify([...this.map.values()])); }
}

/* ───────── Analytics(집계 카운트 · throttle + 디바운스 write-through) ─────────
   유실 수정(§3-1): 저트래픽 베타에선 FLUSH_EVERY(25건) throttle을 평시 못 채워 원격 쓰기가 0이라,
   유일 영속 통로가 종료 flush(SIGTERM)뿐 → SIGTERM 미수신/race 1800ms 부족 시 재배포에 통째로 유실됐다.
   (인프로세스 flushAll→save→drain 경로 자체는 정상임을 테스트로 실증 — 유실은 '평시 미영속'이 원인.)
   → '25건마다 즉시 flush(버스트 흡수)'와 '마지막 flush 이후 첫 변경에서 debounceMs 뒤 flush(저트래픽 안착)'
     중 빠른 쪽으로 영속. 재배포 유실 폭을 최대 debounceMs(기본 5s)로 한정하고 SIGTERM 의존을 제거한다.
   타이머는 unref — analytics 단독으로 프로세스 종료를 막지 않는다(서버 핸들이 이벤트루프를 유지하므로
     평시엔 정상 발화, 종료 시엔 flushAll이 즉시 flush로 마무리). 익명 집계(PII 0)라 짧은 디바운스가 적정. */
export class FirestoreAnalyticsStore extends InMemoryAnalyticsStore {
  private dirty = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private static readonly FLUSH_EVERY = 25; // 파일 어댑터와 동일 throttle(빈번 이벤트 — 매번 원격 쓰기 회피)
  /** debounceMs: 마지막 flush 이후 첫 변경에서 이만큼 뒤 자동 영속(최대 지연 한정). 0이면 비활성(버스트 throttle만). */
  constructor(private readonly doc: FsDoc, private readonly debounceMs = 5_000) { super(); }
  async warm(): Promise<void> {
    const j = await this.doc.load();
    if (j) { const d = JSON.parse(j) as { funnel: Record<string, number>; demand: [string, number][]; gaps: [string, number][]; since: string; daily?: [string, DayCounts][]; seen?: string[]; signups?: Record<string, number> };
      this.funnelC = d.funnel ?? {}; this.demandC = new Map(d.demand ?? []); this.gapC = new Map(d.gaps ?? []); this.since = d.since ?? this.since;
      this.dailyC = new Map(d.daily ?? []); this.seenAnon = new Set(d.seen ?? []); this.signupC = d.signups ?? {}; } // 시계열·신규/재방문·가입 복원(재배포 생존)
  }
  protected persist(): void {
    if (++this.dirty >= FirestoreAnalyticsStore.FLUSH_EVERY) { this.flush(); return; } // 25건 도달 → 즉시(버스트 흡수)
    this.arm(); // 그 외 → 디바운스 타이머로 마지막 flush 이후 첫 변경에서 debounceMs 뒤 영속
  }
  /** 디바운스 타이머 가동(미가동·debounceMs>0일 때만) — unref로 종료를 막지 않음. */
  private arm(): void {
    if (this.timer || this.debounceMs <= 0) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.debounceMs);
    this.timer.unref();
  }
  /** 즉시 영속(throttle·디바운스 무시) — 종료 훅(flushAll)·25건 도달 시 호출. 대기 타이머는 해제. */
  flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.dirty = 0;
    this.doc.save(JSON.stringify({ funnel: this.funnelC, demand: [...this.demandC], gaps: [...this.gapC], since: this.since, daily: [...this.dailyC], seen: [...this.seenAnon], signups: this.signupC }));
  }
}

/* ───────── 팩토리 ───────── */
/**
 * Firestore 스토어 일괄 생성 — 동기 구성 + ready(warm 전부)로 부팅 대기.
 *   warm 실패 시: 해당 doc은 sealed(쓰기 봉인)·메모리 빈 상태로 서비스 지속(읽기 가능) + ready는 reject →
 *   devServer가 정책 결정(유료 게이트 ON이면 부팅 중단=fail-closed, 무료 베타면 경고 후 지속).
 */
export function createFirestoreStores(opts?: { fs?: FirestoreLite; feedbackMax?: number; analyticsDebounceMs?: number }): Stores & { ready: Promise<void> } {
  const fs = opts?.fs ?? new FirestoreLite();
  const docs: FsDoc[] = [];
  const d = (id: string) => { const x = new FsDoc(fs, id); docs.push(x); return x; };
  const feedback = new FirestoreFeedbackStore(d(STORE_DOC_IDS.feedback), opts?.feedbackMax);
  const idem = new FirestoreIdempotency(d(STORE_DOC_IDS.idempotency));
  const entitlement = new FirestoreEntitlementStore(d(STORE_DOC_IDS.entitlementUse), d(STORE_DOC_IDS.entitlementRevoked)); // M2: use/revoked 분리
  const journal = new FirestoreJournalStore(d(STORE_DOC_IDS.journal));
  const subscriptions = new FirestoreSubscriptionStore(d(STORE_DOC_IDS.subscriptions));
  const analytics = new FirestoreAnalyticsStore(d(STORE_DOC_IDS.analytics), opts?.analyticsDebounceMs); // undefined면 기본 5s 디바운스
  const accounts = new FirestoreAccountStore(d(STORE_DOC_IDS.accounts));
  const sessions = new FirestoreSessionStore(d(STORE_DOC_IDS.sessions));
  // M1: allSettled로 '모든' 워밍이 끝난 뒤에만 listen(늦은 warm이 초기 요청 쓰기를 덮어쓰는 레이스 차단).
  //   하나라도 실패하면 throw → devServer가 유료 게이트 시 fail-closed. 실패 문서는 sealed라 덮어쓰기 없음.
  const ready = Promise.allSettled([
    feedback.warm(), idem.warm(), entitlement.warm(), journal.warm(),
    subscriptions.warm(), analytics.warm(), accounts.warm(), sessions.warm(),
  ]).then((rs) => { const f = rs.filter((r) => r.status === "rejected").length; if (f) throw new Error(`firestore 스토어 워밍 ${f}/${rs.length} 실패(sealed)`); });
  // 감사로그 in-flight 추적 — 종료(flushAll) 시 대기해 보안 이벤트 유실 창을 축소(P2).
  const auditInflight = new Set<Promise<unknown>>();
  return {
    feedback, idem, entitlement, journal, subscriptions, analytics, accounts, sessions,
    mode: "firestore",
    ready,
    // 종료(SIGTERM) 시 모든 FsDoc in-flight 쓰기 + 감사로그 in-flight를 끝까지 대기(유실 방지·H3·P2).
    flushAll: async () => { try { analytics.flush(); } catch { /* */ } await Promise.allSettled([...docs.map((x) => x.whenDrained()), ...auditInflight]); },
    // 감사로그 — 보안 이벤트 내구 저장(자동 ID·append-only). 소규모 재시도(M6) 후 실패는 무시(콘솔 링버퍼는 항상 동작). 종료 시 flushAll이 대기.
    auditSink: (entry) => {
      const p = (async () => { for (let i = 0; i < 2; i++) { try { await fs.addDoc(AUDIT_COLLECTION, { at: entry.at, type: entry.type, detail: entry.detail }); return; } catch { await new Promise((r) => setTimeout(r, 200)); } } })();
      auditInflight.add(p); void p.finally(() => auditInflight.delete(p));
    },
  };
}
