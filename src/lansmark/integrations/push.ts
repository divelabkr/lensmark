/**
 * 웹 푸시 알림 seam(HUMAN GATE) — VAPID 키쌍은 '외부 발급'이 아니라 '자체 생성'(로컬)이다.
 *   책임: 알림 발송 인터페이스 + 미설정/콘솔 폴백(거짓 'live' 라벨 금지).
 *   ⚠ 실제 web-push 페이로드 암호화(aes128gcm + VAPID JWT ES256)는 무의존성 직접구현 난도가 높다 →
 *      슬라이스 승격 시 결정(web-push 라이브러리 도입 vs 직접구현 = HUMAN GATE). 그 전까지 ConsolePushSender.
 *   보안: VAPID 개인키는 비밀 — 사용자가 생성·.env 주입(코드가 생성·로깅하지 않는다).
 *         구독(endpoint·키)·페이로드는 로깅하지 않는다(엔드포인트 '호스트'만 — 개인정보·비밀 유출 방지).
 */
import { hasEnv } from "./types";

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
  send(sub: PushSubscription, msg: PushMessage): Promise<{ ok: boolean; reason?: string }>;
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
 * auto 발신자 — VAPID 있어도 아직 LiveWebPushSender 미구현이라 ConsolePushSender로 폴백.
 *   (조용한 거짓 'live' 금지: 승격 전엔 mode가 'console'로 정직하게 노출된다.)
 *   슬라이스 승격 시: vapidConfigured() → new LiveWebPushSender(...) 반환으로 교체.
 */
export function createPushSender(): PushSender {
  // TODO(승격): vapidConfigured()이면 LiveWebPushSender(VAPID JWT ES256 + aes128gcm) 반환.
  return new ConsolePushSender();
}
