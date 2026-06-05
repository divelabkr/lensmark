/**
 * SMS 발송 seam(HUMAN GATE) — '지정된 방식: 번호·동의 저장 먼저, 발송은 제공자 키 확보 후'.
 *   책임: 발송 인터페이스 + 미설정 콘솔 폴백(거짓 성공 위장 금지·번호 마스킹).
 *   ⚠ 실제 발송은 한국 SMS 게이트웨이(알리고/네이버 SENS/CoolSMS 등) 제공자 키 필요 → 슬라이스 승격 시 LiveSmsSender 구현.
 *   보안: 번호·본문 로깅 금지(마스킹 번호만).
 */
import { maskPhone } from "./alertSubscription";

export interface SmsSender {
  readonly mode: "console" | "live" | "disabled";
  send(phone: string, message: string): Promise<{ ok: boolean; reason?: string }>;
}

/** 미설정·개발용 — 실제 전송 없이 '미전송'을 분명히(ok:false). 번호는 마스킹, 본문은 로깅 안 함. */
export class ConsoleSmsSender implements SmsSender {
  readonly mode = "console" as const;
  async send(phone: string, _message: string): Promise<{ ok: boolean; reason?: string }> {
    console.log(`[sms:console] → ${maskPhone(phone)} (미전송)`);
    return { ok: false, reason: "console-sender(미전송): 실제 발송은 SMS 제공자 키 확보 후" };
  }
}

/** auto: 제공자 키 있어도 아직 LiveSmsSender 미구현 → 콘솔 폴백(거짓 'live' 라벨 금지). */
export function createSmsSender(): SmsSender {
  // TODO(승격): SMS_PROVIDER/SMS_API_KEY 있으면 new LiveSmsSender(...) 반환.
  //   ⚠ PIPA(레드팀 PIPA-4): 발송 승격 = 번호가 외부 SMS 사업자(알리고/SENS/CoolSMS)로 '처리위탁/제3자 제공'.
  //      발송 활성화 전, 동의 화면(openAlarmModal)에 '위탁·제3자 제공' 고지 항목을 반드시 추가할 것.
  return new ConsoleSmsSender();
}
