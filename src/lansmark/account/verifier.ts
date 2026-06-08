/**
 * 인증 검증기 — "이 사람이 맞다"를 증명(로그인 코어와 분리).
 *   현재: 휴대폰 OTP(PhoneOtpVerifier) — SMS seam 재사용. 카카오/이메일은 같은 인터페이스로 추가(드롭인).
 *   발송 자체는 SMS 게이트웨이 키=HUMAN GATE: 키 있으면 실발송 / dev(키 없음)는 코드 노출(테스트) / 운영+키없음은 fail-closed.
 */
import * as crypto from "node:crypto";
import { normalizePhone } from "../notify/alertSubscription";
import type { SmsSender } from "../notify/smsSender";

export interface VerifierResult { method: string; subject: string; } // subject=원 식별자(해시 전·전화번호)
export interface AuthVerifier {
  /** 인증 시작(OTP 발송). 반환 challengeId는 verify에 사용. devHint는 비운영·미발송 시 코드(테스트용). */
  start(method: string, contact: string): Promise<{ challengeId: string; devHint?: string }>;
  /** 인증 완료(코드 검증). 성공 시 {method, subject}, 실패 시 null. */
  verify(challengeId: string, proof: string): Promise<VerifierResult | null>;
  /** 라우트 에러 매핑용 — start가 던지는 사유 코드. */
}

const TTL_MS = 5 * 60_000;      // OTP 유효 5분
const MAX_ATTEMPTS = 5;         // 챌린지당 시도 상한(brute-force 차단)

/**
 * 휴대폰 OTP 검증기 — 6자리 코드를 SMS로 발송하고 검증.
 *   start: 전화 정규화 → 코드 생성 → SMS 발송. 발송 성공=운영(코드 비노출) / 미발송+dev=devHint로 코드 노출(테스트) / 미발송+운영=AUTH_NOT_CONFIGURED(fail-closed).
 *   ⚠ 실발송 승격 = 번호가 외부 SMS 사업자로 처리위탁/제3자 제공(PIPA) → 동의 화면에 위탁 고지 필요(smsSender.ts 주석 참조).
 */
export class PhoneOtpVerifier implements AuthVerifier {
  private pending = new Map<string, { subject: string; code: string; exp: number; attempts: number }>();
  constructor(private readonly opts: { isProd: boolean; sms: SmsSender }) {}

  async start(method: string, contact: string): Promise<{ challengeId: string; devHint?: string }> {
    if (method !== "phone") throw new Error("AUTH_NOT_CONFIGURED"); // 현재 휴대폰 OTP만(카카오/이메일은 추후 드롭인)
    const phone = normalizePhone(contact);
    if (!phone) throw new Error("BAD_PHONE");                       // 라우트가 400으로 매핑
    const code = String(crypto.randomInt(1_000_000)).padStart(6, "0"); // 6자리(난수)
    const challengeId = crypto.randomBytes(16).toString("hex");
    this.pending.set(challengeId, { subject: phone, code, exp: Date.now() + TTL_MS, attempts: 0 });
    if (this.pending.size > 50_000) { const k = this.pending.keys().next().value as string | undefined; if (k) this.pending.delete(k); } // 백스톱
    const sent = await this.opts.sms.send(phone, `[LENSMARK] 인증번호 ${code} (5분 이내 입력)`);
    if (sent.ok) return { challengeId };                            // 운영 실발송 — 코드 비노출
    if (!this.opts.isProd) return { challengeId, devHint: code };   // dev: 미발송이라 코드 노출(테스트)
    throw new Error("AUTH_NOT_CONFIGURED");                         // 운영인데 발송 실패(키 없음) → 로그인 차단(코드 노출 금지)
  }

  async verify(challengeId: string, proof: string): Promise<VerifierResult | null> {
    const c = this.pending.get(challengeId);
    if (!c || c.exp <= Date.now()) return null;
    if (++c.attempts > MAX_ATTEMPTS) { this.pending.delete(challengeId); return null; } // 시도 초과 → 챌린지 폐기
    if (proof !== c.code) return null;
    this.pending.delete(challengeId); // 성공 시 1회용 소비(재사용 차단)
    return { method: "phone", subject: c.subject };
  }
}
