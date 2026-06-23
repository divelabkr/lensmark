/**
 * 서버 공유 상태(Ctx) — 스토어·카운터·레이트리미터를 한 곳에 모아 라우트로 주입한다.
 *   책임: 모듈 전역 가변변수(흩어짐)를 없애고, 모든 핸들러가 동일한 ctx 하나를 통해 상태를 읽고 쓴다.
 *   라우트 시그니처(RouteFn)도 여기서 정의한다(라우트=순수 함수, 상태는 ctx 경유).
 */
import type * as http from "node:http";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { getProviders } from "../src/lansmark/data/providers";
import type { IdempotencyStore } from "../src/lansmark/payment/pgWebhook";
import { createStores, type FeedbackStoreEx, type EntitlementStore } from "../src/lansmark/db/stores";
import { createFirestoreStores } from "../src/lansmark/db/firestoreStores";
import { FirestoreLite } from "../src/lansmark/db/firestoreLite";
import { FirestoreBlobBackend, FileBlobBackend, MemoryBlobBackend } from "../src/lansmark/backup/blobBackend";
import { BackupManager } from "../src/lansmark/backup/backupManager";
import { APP_VERSION } from "../src/lansmark/version";
import type { JournalStore } from "../src/lansmark/journal/journalStore";
import type { SubscriptionStore } from "../src/lansmark/notify/subscriptionStore";
import type { AnalyticsStore } from "../src/lansmark/analytics/types";
import { RateLimiter } from "../src/lansmark/api/security";
import { RuntimeFlagsStore } from "./runtimeFlags";
import { PhoneOtpVerifier, EmailMagicLinkVerifier, CompositeVerifier, type AuthVerifier } from "../src/lansmark/account/verifier";
import { createSmsSender } from "../src/lansmark/notify/smsSender";
import { createEmailSender } from "../src/lansmark/notify/emailSender";
import type { AccountStore } from "../src/lansmark/account/accountStore";
import type { SessionStore } from "../src/lansmark/account/sessionStore";
import { createPushSender, InMemoryPushSubscriptionStore, type PushSender, type PushSubscriptionStore } from "../src/lansmark/integrations/push";
import { ClientErrorStore } from "../src/lansmark/ops/clientErrors";
import { ClientDiagStore } from "../src/lansmark/ops/clientDiag";
import type { Config } from "./config";

/** 운영 대시보드 카운터(가변). */
export interface Metrics {
  simRuns: number;          // 정밀 시뮬 실행 수
  entitlementsMinted: number; // 발급된 유료권한 토큰 수
  mockPaysIssued: number;   // 데모 결제 수
  reqCount: number;         // /api/* 요청 수(레이트리밋 통과분)
  errCount: number;         // 미처리 예외 수(500)
  startedAt: number;        // 부팅 시각(ms) — 업타임 = now - startedAt(운영자 가시성: "느려짐·재시작" 사각 해소)
  latencies: number[];      // 최근 API 응답시간(ms) 링버퍼(최대 200) — p50/p95 산출
}

/** 최근 활동 로그 1건. */
export interface OpsEntry { at: string; type: string; detail: string; }

/** 모든 라우트/미들웨어가 공유하는 컨텍스트. */
export interface Ctx {
  config: Config;
  providers: ReturnType<typeof getProviders>;
  feedbackStore: FeedbackStoreEx;            // 플라이휠 실측(memory|file|firestore)
  idem: IdempotencyStore;                    // 웹훅 멱등성 저장소(memory|file|firestore)
  storeMode: "memory" | "file" | "firestore"; // 영속 모드(health/ops 노출)
  /** firestore 모드: 부팅 워밍(원격 상태 로드) 완료 — devServer가 listen 前 대기. */
  storesReady?: Promise<void>;
  /** firestore 모드: 종료(SIGTERM) 시 진행 중 쓰기 완료 대기(유실 방지·H3). */
  flushStores?: () => Promise<void>;
  metrics: Metrics;
  opsLog: OpsEntry[];                         // 최근 활동 링버퍼(최대 40)
  logOps(type: string, detail: string): void; // opsLog 앞에 추가(+ 상한 유지)
  limiters: { global: RateLimiter; sensitive: RateLimiter };
  /** 유료권한 토큰 소진(quota)·실효(revocation) — 1회 결제 무한사용 차단(레드팀 H4). memory|file|(DB seam). */
  entitlement: EntitlementStore;
  /** 재배일지(영농 동반) — 작기 기록·수확. 수확 기록 시 OutcomeRecord로 플라이휠에 승격(해자). memory|file|(DB seam). */
  journal: JournalStore;
  /** 알림 구독(opt-in) — 핸드폰 번호·동의 저장(PII). 발송은 smsSender seam(키 대기). memory|file|(DB seam). */
  subscriptions: SubscriptionStore;
  /** 익명 수요·퍼널 계측 — 집계 카운트만(PII 0). 라우트 성공 시점에 기록, /api/ops/stats로 노출. memory|file. */
  analytics: AnalyticsStore;
  /** 런타임 토글(영속) — 유료 게이트 ON↔무료 베타 OFF를 ops에서 재시작 없이 전환(부팅 시 config에 적용). */
  runtimeFlags: RuntimeFlagsStore;
  /** 계정(가입 후 신원) — 익명ID·결제토큰과 별개의 영속 신원. memory|file. */
  accounts: AccountStore;
  /** 로그인 세션 — 토큰→계정 신원 해석. memory|file. */
  sessions: SessionStore;
  /** 인증 검증기 seam — 지금은 MockVerifier(dev), 실제(OTP/소셜/이메일)는 HUMAN GATE 드롭인. */
  verifier: AuthVerifier;
  /** 웹푸시 구독 저장(opt-in) — 브라우저 PushSubscription. 발송은 pushSender seam(VAPID 키 대기). memory|(file seam). */
  pushSubs: PushSubscriptionStore;
  /** 웹푸시 발신자 seam — 지금은 ConsolePushSender(미전송 정직 폴백). VAPID+LiveWebPushSender 승격=HUMAN GATE. */
  pushSender: PushSender;
  /** 클라이언트(브라우저) 에러 텔레메트리 — 사용자 화면 에러를 ops에 가시화 + 웹훅 실시간 경보(LANSMARK_ALERT_WEBHOOK). 메모리(휘발). */
  clientErrors: ClientErrorStore;
  /** 클라이언트 환경 진단(관측·추적·가이드 — 복구 권한 없음) — 먹통/SW갇힘/오프라인/콜드스타트를 앱이 자동 보고(window.onerror로 안 잡히는 '안 뜨는 상태'). 기록/집계 전용. */
  clientDiag: ClientDiagStore;
  /** 백업/복구(blob 계층 스냅샷) — ops에서 '지금 백업'·'복구'. file/firestore 실동작, memory는 휘발(비대상). */
  backup: BackupManager;
}

/** 라우트 핸들러 시그니처. 반환 true = 이 핸들러가 응답을 종료함(라우터가 중단). false = 다음 핸들러로. */
export type RouteFn = (
  ctx: Ctx,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
) => Promise<boolean> | boolean;

/** 런타임 플래그 오버라이드를 config에 적용(있으면 .env 기본값 덮어쓰기). file/memory는 createContext서, firestore는 워밍 후 devServer서 호출(H1). */
export function applyRuntimeFlagOverride(config: Config, runtimeFlags: RuntimeFlagsStore): void {
  const o = runtimeFlags.requireEntitlement();
  if (o !== null) config.requireEntitlement = o;
}

/** config로부터 런타임 컨텍스트를 1회 생성한다(서버 부팅 시). */
export function createContext(config: Config): Ctx {
  const opsLog: OpsEntry[] = [];
  // 영속 스토어(memory|file|firestore) — file은 디스크 로드(쓰기 불가 시 메모리 폴백),
  // firestore는 Cloud Run 재배포에도 내구(부팅 warm은 devServer가 storesReady로 대기 · §3-1).
  const stores = config.storeMode === "firestore"
    ? createFirestoreStores()
    : createStores({ mode: config.storeMode, dir: config.dataDir });
  // 런타임 오버라이드(영속)가 있으면 .env 기본값을 덮어쓴다 — 운영자가 ops에서 끈 유료 게이트가 재시작에도 유지.
  //   file/memory: 생성자서 동기 로드 → 지금 적용. firestore: 비동기 워밍이라 devServer가 storesReady 후 적용+bootSafety(H1).
  const runtimeFlags = new RuntimeFlagsStore(config.storeMode, config.dataDir);
  if (config.storeMode !== "firestore") applyRuntimeFlagOverride(config, runtimeFlags);
  // 부팅 워밍 신호 — firestore는 스토어 8종 + 런타임 플래그를 '모두' 로드(allSettled)한 뒤에만 listen(M1 레이스 차단).
  const storesReady = config.storeMode === "firestore"
    ? Promise.allSettled([stores.ready ?? Promise.resolve(), runtimeFlags.warm()])
        .then((rs) => { if (rs.some((r) => r.status === "rejected")) throw new Error("firestore 워밍 실패(stores 또는 flags)"); })
    : undefined;
  // 백업/복구 백엔드 — blob 계층(lm_state 문서/.data 파일을 불투명 바이트로 스냅샷). 모드별 주입(firestore=같은 DB lm_backups · file=.data/backups · memory=휘발 비대상).
  const backupBackend = config.storeMode === "firestore"
    ? new FirestoreBlobBackend(new FirestoreLite())
    : config.storeMode === "file"
      ? new FileBlobBackend(config.dataDir)
      : new MemoryBlobBackend();
  const backup = new BackupManager(backupBackend, APP_VERSION);
  return {
    config,
    providers: getProviders(),                 // auto: 키 있는 통합만 live, 나머지 mock 폴백
    feedbackStore: stores.feedback,
    idem: stores.idem,
    storeMode: stores.mode,
    storesReady,
    flushStores: stores.flushAll,
    metrics: { simRuns: 0, entitlementsMinted: 0, mockPaysIssued: 0, reqCount: 0, errCount: 0, startedAt: Date.now(), latencies: [] },
    opsLog,
    logOps(type, detail) {
      const entry = { at: new Date().toISOString(), type, detail };
      opsLog.unshift(entry);
      if (opsLog.length > 40) opsLog.pop(); // 콘솔 표시용 링버퍼(최신 40건)
      // 영속 감사 로그(append-only) — 보안 이벤트(로그인·실효·결제·게이트 토글·삭제) durable 기록.
      //   firestore 모드=lm_audit 컬렉션(재배포 내구) · file 모드=audit.jsonl(0600). 쓰기 실패는 무시(운영 연속성 우선).
      if (stores.auditSink) stores.auditSink(entry);
      else if (config.storeMode === "file") {
        try { appendFileSync(join(config.dataDir, "audit.jsonl"), JSON.stringify(entry) + "\n", { mode: 0o600 }); } catch { /* 쓰기 실패 무시 */ }
      }
    },
    limiters: {
      global: new RateLimiter(config.rateGlobal, config.rateWindowMs),
      sensitive: new RateLimiter(config.rateSensitive, config.rateWindowMs),
    },
    entitlement: stores.entitlement,
    journal: stores.journal,
    subscriptions: stores.subscriptions,
    analytics: stores.analytics,
    runtimeFlags,
    accounts: stores.accounts,
    sessions: stores.sessions,
    // 검증기: 휴대폰 OTP + 이메일 매직링크 병행(CompositeVerifier가 method로 라우팅). 둘 다 발송은 제공자 키=HUMAN GATE(dev는 코드/링크 노출·운영+키없음 fail-closed). 카카오는 추후 드롭인.
    verifier: new CompositeVerifier({
      phone: new PhoneOtpVerifier({ isProd: config.isProd, sms: createSmsSender() }),
      email: new EmailMagicLinkVerifier({ isProd: config.isProd, email: createEmailSender(), appOrigin: config.appOrigin }),
    }),
    // 웹푸시: 구독 저장(memory) + 발신자 seam. SMS 과금 회피 → 앱 푸시 채널(사용자 선택). 실발송은 VAPID 키 설정 후.
    pushSubs: new InMemoryPushSubscriptionStore(),
    pushSender: createPushSender(),
    clientErrors: new ClientErrorStore(), // 브라우저 에러 가시화(이전엔 안 보임) — 새 distinct만 경보
    clientDiag: new ClientDiagStore(),    // 환경 진단(SW상태·오프라인·콜드스타트) 자동 관측 — '먹통' 사용자 설명 의존 탈피(복구는 안 함)
    backup, // 백업/복구 매니저(blob 계층 스냅샷)
  };
}
