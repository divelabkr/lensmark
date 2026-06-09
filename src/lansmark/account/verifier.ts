/**
 * 인증 검증기 — "이 사람이 맞다"를 증명(로그인 코어와 분리).
 *   현재: 휴대폰 OTP(PhoneOtpVerifier) + 이메일 매직링크(EmailMagicLinkVerifier), CompositeVerifier로 병행. 카카오는 같은 인터페이스로 추가(드롭인).
 *   발송 자체는 제공자 키=HUMAN GATE: 키 있으면 실발송 / dev(키 없음)는 코드·링크 노출(테스트) / 운영+키없음은 fail-closed.
 *   challengeId는 "method:..." 프리픽스로 자기 소유를 표식 → CompositeVerifier.verify가 프리픽스로 라우팅(단일 출처).
 */
import * as crypto from "node:crypto";
import { normalizePhone } from "../notify/alertSubscription";
import type { SmsSender } from "../notify/smsSender";
import type { EmailSender } from "../notify/emailSender";

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
    const challengeId = "phone:" + crypto.randomBytes(16).toString("hex"); // 프리픽스=라우팅 표식(CompositeVerifier)
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

const MAGIC_TTL_MS = 15 * 60_000; // 매직링크 유효 15분(메일 도착 지연 고려 — OTP보다 길게)

/** 이메일 형식 검사(보수적) — 라우트 BAD_EMAIL 매핑. 실제 도달성은 발송으로 검증. */
export function isEmail(s: string): boolean {
  return /^[^@\s]{1,128}@[^@\s]{1,128}\.[^@\s]{2,}$/.test(s);
}

/**
 * 이메일 매직링크 검증기 — 1회용 토큰 링크를 메일로 보내고, 링크 클릭(토큰)으로 검증.
 *   start: 이메일 검증 → 256bit 토큰 생성 → 링크(/app?lm_login=challengeId~token) 메일 발송.
 *     발송 성공=운영(힌트 비노출) / 미발송+dev=devHint로 '상대경로' 노출(어느 호스트서든 클릭) / 미발송+운영=AUTH_NOT_CONFIGURED(fail-closed).
 *   verify: 토큰 타이밍-세이프 일치 + 미만료 + 시도 상한 → {method:"email", subject:email}. 1회용 소비.
 *   보안: 이메일 평문 미저장(라우트가 subjectHash) · 토큰 로깅 금지 · 토큰 256bit(추측 불가).
 */
export class EmailMagicLinkVerifier implements AuthVerifier {
  private pending = new Map<string, { subject: string; token: string; exp: number; attempts: number }>();
  constructor(private readonly opts: { isProd: boolean; email: EmailSender; appOrigin: string }) {}

  async start(method: string, contact: string): Promise<{ challengeId: string; devHint?: string }> {
    if (method !== "email") throw new Error("AUTH_NOT_CONFIGURED");
    const email = contact.trim().toLowerCase();
    if (!isEmail(email)) throw new Error("BAD_EMAIL");                  // 라우트가 400으로 매핑
    const token = crypto.randomBytes(32).toString("hex");              // 256bit 1회용
    const challengeId = "email:" + crypto.randomBytes(16).toString("hex");
    this.pending.set(challengeId, { subject: email, token, exp: Date.now() + MAGIC_TTL_MS, attempts: 0 });
    if (this.pending.size > 50_000) { const k = this.pending.keys().next().value as string | undefined; if (k) this.pending.delete(k); } // 백스톱
    const path = `/app?lm_login=${challengeId}~${token}`;              // 상대경로(dev: 어느 호스트서든 클릭 가능)
    const link = this.opts.appOrigin + path;                          // 메일 본문엔 절대링크
    const sent = await this.opts.email.send(email, "[LENSMARK] 로그인 링크", `아래 링크로 로그인하세요(15분 이내·1회용):\n${link}\n\n요청하지 않으셨다면 이 메일을 무시하세요.`);
    if (sent.ok) return { challengeId };                              // 운영 실발송 — 힌트 비노출
    if (!this.opts.isProd) return { challengeId, devHint: path };     // dev: 미발송 → 링크 경로 노출(테스트)
    throw new Error("AUTH_NOT_CONFIGURED");                           // 운영+키없음 → 로그인 차단(링크 비노출)
  }

  async verify(challengeId: string, proof: string): Promise<VerifierResult | null> {
    const c = this.pending.get(challengeId);
    if (!c || c.exp <= Date.now()) return null;
    if (++c.attempts > MAX_ATTEMPTS) { this.pending.delete(challengeId); return null; } // 시도 초과 → 폐기
    // 길이 가드 후 타이밍-세이프 비교(랜덤 256bit라 타이밍공격 비현실적이나 위생).
    if (proof.length !== c.token.length || !crypto.timingSafeEqual(Buffer.from(proof), Buffer.from(c.token))) return null;
    this.pending.delete(challengeId); // 1회용 소비(재사용 차단)
    return { method: "email", subject: c.subject };
  }
}

/**
 * 복합 검증기 — method별 하위 검증기로 라우팅(휴대폰 OTP + 이메일 매직링크 병행).
 *   start: byMethod[method]에 위임. verify: challengeId의 "method:" 프리픽스로 소유 검증기 라우팅.
 *   (각 하위 검증기가 challengeId에 프리픽스를 직접 부여 → 라우팅 표식의 단일 출처.)
 */
export class CompositeVerifier implements AuthVerifier {
  constructor(private readonly byMethod: Record<string, AuthVerifier>) {}
  async start(method: string, contact: string): Promise<{ challengeId: string; devHint?: string }> {
    const v = this.byMethod[method];
    if (!v) throw new Error("AUTH_NOT_CONFIGURED"); // 미지원 method
    return v.start(method, contact);
  }
  async verify(challengeId: string, proof: string): Promise<VerifierResult | null> {
    const i = challengeId.indexOf(":");
    const method = i >= 0 ? challengeId.slice(0, i) : "";
    const v = this.byMethod[method];
    return v ? v.verify(challengeId, proof) : null;
  }
}
