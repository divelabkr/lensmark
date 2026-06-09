/**
 * 이메일 발송 seam(HUMAN GATE) — 매직링크 로그인 메일(추후 알림 메일). '주소 검증 먼저, 발송은 제공자 키 확보 후'.
 *   책임: 발송 인터페이스 + 미설정 콘솔 폴백(거짓 성공 위장 금지·주소 마스킹).
 *   ⚠ 실제 발송은 이메일 제공자(SMTP/SES/Postmark/Resend 등) 키 필요 → 승격 시 LiveEmailSender 구현.
 *   보안: 주소·본문 로깅 금지(마스킹 주소만). 매직링크 토큰은 절대 로깅하지 않는다.
 */

export interface EmailSender {
  readonly mode: "console" | "live" | "disabled";
  send(to: string, subject: string, body: string): Promise<{ ok: boolean; reason?: string }>;
}

/** 이메일 마스킹(로그 PII 최소화) — 로컬파트 앞 1~2자 + 도메인 첫 글자만. */
export function maskEmail(email: string): string {
  const [lp, dom] = String(email).split("@");
  if (!dom || !lp) return "(invalid)";
  const head = lp.slice(0, Math.min(2, lp.length));
  return `${head}${"*".repeat(Math.max(1, lp.length - head.length))}@${dom[0]}***`;
}

/** 미설정·개발용 — 실제 전송 없이 '미전송'을 분명히(ok:false). 주소 마스킹, 본문/토큰 로깅 안 함. */
export class ConsoleEmailSender implements EmailSender {
  readonly mode = "console" as const;
  async send(to: string, _subject: string, _body: string): Promise<{ ok: boolean; reason?: string }> {
    console.log(`[email:console] → ${maskEmail(to)} (미전송)`);
    return { ok: false, reason: "console-sender(미전송): 실제 발송은 이메일 제공자 키 확보 후" };
  }
}

/** auto: 제공자 키 있어도 아직 LiveEmailSender 미구현 → 콘솔 폴백(거짓 'live' 라벨 금지). */
export function createEmailSender(): EmailSender {
  // TODO(승격): EMAIL_PROVIDER/EMAIL_API_KEY(또는 SMTP_*) 있으면 new LiveEmailSender(...) 반환.
  return new ConsoleEmailSender();
}
