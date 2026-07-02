/**
 * 웹 푸시 알림 — 인터페이스·구독 저장·발신자 선택. VAPID 키쌍은 '외부 발급'이 아니라 자체 생성(npm run vapid:gen).
 *   책임: 발송 인터페이스 + 콘솔 폴백(거짓 'live' 라벨 금지) + 구독 저장. 실제 암호화·전송은 webPushSender.ts.
 *   승격(2026-07): 무의존성 직접구현(RFC 8291 aes128gcm + RFC 8292 VAPID ES256) — 공식 테스트 벡터로 검증.
 *      VAPID env 있으면 live, 없으면 ConsolePushSender(미전송 정직). 키 생성·주입만 HUMAN GATE로 남음.
 *   보안: VAPID 개인키는 비밀 — 사용자가 생성·.env 주입(코드가 생성·로깅하지 않는다).
 *         구독(endpoint·키)·페이로드는 로깅하지 않는다(엔드포인트 '호스트'만 — 개인정보·비밀 유출 방지).
 */
import { hasEnv } from "./types";
import { LiveWebPushSender } from "./webPushSender"; // 실발송(RFC 8291/8292) — webPushSender는 여기서 type만 역수입(런타임 순환 없음)

/** 브라우저 PushSubscription(클라이언트가 service worker로 발급 → 서버 저장). */
export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** 발송 메시지(작물 특보·예찰 알림 등). */
export interface PushMessage {
  title: string;
  body: string;
  url?: string; // 클릭 시 이동(인앱 경로)
}

export interface PushSender {
  readonly mode: "console" | "live" | "disabled";
  /** gone=만료 구독(404/410) — 호출측이 저장소에서 파기해 죽은 endpoint 재발송을 막는다. */
  send(sub: PushSubscription, msg: PushMessage): Promise<{ ok: boolean; reason?: string; gone?: boolean }>;
}

/** VAPID 설정 여부(공개키+개인키 env 존재) — 값 노출 없이 boolean만. */
export function vapidConfigured(): boolean {
  return hasEnv("LANSMARK_VAPID_PUBLIC_KEY", "LANSMARK_VAPID_PRIVATE_KEY");
}

/** endpoint에서 host만 안전 추출(로깅용 — 전체 URL/토큰 노출 금지). */
function safeHost(url?: string): string {
  try { return url ? new URL(url).host : "(no-endpoint)"; } catch { return "(invalid)"; }
}

/**
 * 미설정·개발용 발신자 — 실제 전송 없이 '의도'만 기록.
 *   ok:false + reason으로 '미전송'을 분명히 한다(성공으로 위장하지 않음).
 */
export class ConsolePushSender implements PushSender {
  readonly mode = "console" as const;
  async send(sub: PushSubscription, msg: PushMessage): Promise<{ ok: boolean; reason?: string }> {
    // 구독 키·본문은 로깅하지 않는다 — 엔드포인트 호스트 + 제목만(디버그 최소 정보).
    console.log(`[push:console] → ${safeHost(sub?.endpoint)} · "${msg?.title ?? ""}"`);
    return { ok: false, reason: "console-sender(미전송): 실제 발송은 VAPID 설정 + web-push 구현 승격 후" };
  }
}

/**
 * auto 발신자 — VAPID 키(env) 있으면 LiveWebPushSender(실발송·2026-07 승격), 없으면 ConsolePushSender(미전송 정직).
 *   승격 근거: RFC 8291 공식 테스트 벡터로 암호화 검증(webPushSender.spec) + endpoint allowlist(SSRF 차단).
 */
export function createPushSender(): PushSender {
  if (vapidConfigured()) return new LiveWebPushSender();
  return new ConsolePushSender();
}

/** 푸시 구독 저장 — 브라우저 PushSubscription 보관(endpoint로 dedupe). memory; 영속은 file 어댑터 seam. */
export interface PushSubscriptionEntry { sub: PushSubscription; subscriberId?: string; cropId?: string; at: string }
export interface PushSubscriptionStore {
  upsert(sub: PushSubscription, meta?: { subscriberId?: string; cropId?: string }): void;
  remove(endpoint: string): boolean;            // 해지(파기)
  all(): PushSubscription[];                     // 발송 대상(추후 cropId/subscriber로 타깃팅)
  entries(): PushSubscriptionEntry[];            // 구독자ID 포함 — 브리핑 등 '구독자별 맞춤' 발송용
  size(): number;
}
export class InMemoryPushSubscriptionStore implements PushSubscriptionStore {
  protected map = new Map<string, PushSubscriptionEntry>();
  constructor(protected readonly cap = 100_000) {}
  upsert(sub: PushSubscription, meta?: { subscriberId?: string; cropId?: string }): void {
    if (!sub?.endpoint) return;
    this.map.set(sub.endpoint, { sub, subscriberId: meta?.subscriberId, cropId: meta?.cropId, at: new Date().toISOString() });
    while (this.map.size > this.cap) { const k = this.map.keys().next().value as string | undefined; if (!k) break; this.map.delete(k); } // DoS 백스톱
    this.persist();
  }
  remove(endpoint: string): boolean { const r = this.map.delete(endpoint); if (r) this.persist(); return r; }
  all(): PushSubscription[] { return [...this.map.values()].map((e) => e.sub); }
  entries(): PushSubscriptionEntry[] { return [...this.map.values()]; }
  size(): number { return this.map.size; }
  /** 영속 훅 — File/Firestore 어댑터가 오버라이드(다른 File* 스토어와 동일 패턴). 메모리는 no-op. */
  protected persist(): void { /* memory: 휘발 */ }
}
