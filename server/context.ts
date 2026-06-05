/**
 * 서버 공유 상태(Ctx) — 스토어·카운터·레이트리미터를 한 곳에 모아 라우트로 주입한다.
 *   책임: 모듈 전역 가변변수(흩어짐)를 없애고, 모든 핸들러가 동일한 ctx 하나를 통해 상태를 읽고 쓴다.
 *   라우트 시그니처(RouteFn)도 여기서 정의한다(라우트=순수 함수, 상태는 ctx 경유).
 */
import type * as http from "node:http";
import { getProviders } from "../src/lansmark/data/providers";
import type { IdempotencyStore } from "../src/lansmark/payment/pgWebhook";
import { createStores, type FeedbackStoreEx, type EntitlementStore } from "../src/lansmark/db/stores";
import type { JournalStore } from "../src/lansmark/journal/journalStore";
import type { SubscriptionStore } from "../src/lansmark/notify/subscriptionStore";
import type { AnalyticsStore } from "../src/lansmark/analytics/types";
import { RateLimiter } from "../src/lansmark/api/security";
import type { Config } from "./config";

/** 운영 대시보드 카운터(가변). */
export interface Metrics {
  simRuns: number;          // 정밀 시뮬 실행 수
  entitlementsMinted: number; // 발급된 유료권한 토큰 수
  mockPaysIssued: number;   // 데모 결제 수
  reqCount: number;         // /api/* 요청 수(레이트리밋 통과분)
  errCount: number;         // 미처리 예외 수(500)
}

/** 최근 활동 로그 1건. */
export interface OpsEntry { at: string; type: string; detail: string; }

/** 모든 라우트/미들웨어가 공유하는 컨텍스트. */
export interface Ctx {
  config: Config;
  providers: ReturnType<typeof getProviders>;
  feedbackStore: FeedbackStoreEx;            // 플라이휠 실측(memory|file)
  idem: IdempotencyStore;                    // 웹훅 멱등성 저장소(memory|file)
  storeMode: "memory" | "file";              // 영속 모드(health/ops 노출)
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
}

/** 라우트 핸들러 시그니처. 반환 true = 이 핸들러가 응답을 종료함(라우터가 중단). false = 다음 핸들러로. */
export type RouteFn = (
  ctx: Ctx,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
) => Promise<boolean> | boolean;

/** config로부터 런타임 컨텍스트를 1회 생성한다(서버 부팅 시). */
export function createContext(config: Config): Ctx {
  const opsLog: OpsEntry[] = [];
  // 영속 스토어 3종(memory|file) — file 모드면 디스크 로드(재시작 보존). 쓰기 불가 시 메모리 자동 폴백.
  const stores = createStores({ mode: config.storeMode, dir: config.dataDir });
  return {
    config,
    providers: getProviders(),                 // auto: 키 있는 통합만 live, 나머지 mock 폴백
    feedbackStore: stores.feedback,
    idem: stores.idem,
    storeMode: stores.mode,
    metrics: { simRuns: 0, entitlementsMinted: 0, mockPaysIssued: 0, reqCount: 0, errCount: 0 },
    opsLog,
    logOps(type, detail) {
      opsLog.unshift({ at: new Date().toISOString(), type, detail });
      if (opsLog.length > 40) opsLog.pop(); // 링버퍼: 최신 40건만 유지
    },
    limiters: {
      global: new RateLimiter(config.rateGlobal, config.rateWindowMs),
      sensitive: new RateLimiter(config.rateSensitive, config.rateWindowMs),
    },
    entitlement: stores.entitlement,
    journal: stores.journal,
    subscriptions: stores.subscriptions,
    analytics: stores.analytics,
  };
}
