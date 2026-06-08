/**
 * 인증 검증기 seam — "이 사람이 맞다"를 증명(로그인 코어와 분리).
 *   실제 검증(SMS OTP·소셜 OAuth·이메일 매직링크)은 외부 키 필요(HUMAN GATE) → 그때 이 인터페이스로 드롭인.
 *   지금은 MockVerifier로 코어(계정·세션·이관) 전체를 실제 발송 없이 end-to-end 검증.
 */
import * as crypto from "node:crypto";

export interface VerifierResult { method: string; subject: string; } // subject=원 식별자(해시 전·전화/이메일/소셜ID)
export interface AuthVerifier {
  /** 인증 시작(OTP 발송/리다이렉트). 반환 challengeId는 verify에 사용. devHint는 비운영 노출용. */
  start(method: string, contact: string): Promise<{ challengeId: string; devHint?: string }>;
  /** 인증 완료(코드/토큰 검증). 성공 시 {method, subject}, 실패 시 null. */
  verify(challengeId: string, proof: string): Promise<VerifierResult | null>;
}

/** Mock 검증기(dev/테스트) — 실제 발송 없이 전 흐름 검증. 코드 '000000' 고정(devHint로만 노출). ⚠ 운영 사용 금지(context가 dev에서만 주입). */
export class MockVerifier implements AuthVerifier {
  private pending = new Map<string, { method: string; subject: string; code: string; exp: number; attempts: number }>();
  private static readonly CODE = "000000";
  private static readonly TTL_MS = 5 * 60_000;
  private static readonly MAX_ATTEMPTS = 5; // 챌린지당 시도 상한(brute-force 차단 — 실제 OTP 검증기도 동일 필요)

  async start(method: string, contact: string): Promise<{ challengeId: string; devHint?: string }> {
    const challengeId = crypto.randomBytes(16).toString("hex");
    this.pending.set(challengeId, { method, subject: contact, code: MockVerifier.CODE, exp: Date.now() + MockVerifier.TTL_MS, attempts: 0 });
    if (this.pending.size > 10_000) { const k = this.pending.keys().next().value as string | undefined; if (k) this.pending.delete(k); } // 백스톱
    return { challengeId, devHint: "dev mock 코드: " + MockVerifier.CODE };
  }
  async verify(challengeId: string, proof: string): Promise<VerifierResult | null> {
    const c = this.pending.get(challengeId);
    if (!c || c.exp <= Date.now()) return null;
    if (++c.attempts > MockVerifier.MAX_ATTEMPTS) { this.pending.delete(challengeId); return null; } // 시도 초과 → 챌린지 폐기
    if (proof !== c.code) return null;
    this.pending.delete(challengeId); // 성공 시 1회용 소비(재사용 차단)
    return { method: c.method, subject: c.subject };
  }
}

/** 운영 기본 검증기 — 실제 검증기(OTP/소셜/이메일) 미구성 시 로그인 fail-closed.
 *   ⚠ 이게 없으면 운영에 mock이 노출돼 '아무 번호나 000000으로 로그인'(계정 탈취)이 가능. 실제 검증기 live 시 교체(HUMAN GATE). */
export class DisabledVerifier implements AuthVerifier {
  async start(): Promise<{ challengeId: string; devHint?: string }> { throw new Error("AUTH_NOT_CONFIGURED"); }
  async verify(): Promise<VerifierResult | null> { return null; } // 항상 실패 → 운영 우회 불가
}
