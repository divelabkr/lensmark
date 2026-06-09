/**
 * 이메일 매직링크 검증기 + CompositeVerifier(휴대폰/이메일 라우팅) 단위 검증.
 *   dev(미발송): devHint=링크 경로 노출 → 토큰 추출 → verify 성공. 운영+키없음: fail-closed(AUTH_NOT_CONFIGURED).
 */
import { describe, it, expect } from "vitest";
import { EmailMagicLinkVerifier, CompositeVerifier, PhoneOtpVerifier, isEmail } from "../account/verifier";
import { ConsoleEmailSender, type EmailSender } from "../notify/emailSender";
import { ConsoleSmsSender } from "../notify/smsSender";

const ORIGIN = "http://localhost:8787";
/** devHint 경로(/app?lm_login=challengeId~token)에서 challengeId·token 추출. */
function parseHint(path: string): { challengeId: string; token: string } {
  const v = new URL(ORIGIN + path).searchParams.get("lm_login") || "";
  const t = v.indexOf("~");
  return { challengeId: v.slice(0, t), token: v.slice(t + 1) };
}

describe("isEmail — 보수적 형식 검사", () => {
  it("정상/비정상 구분", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("user.name@sub.example.kr")).toBe(true);
    expect(isEmail("nope")).toBe(false);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a b@c.com")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});

describe("EmailMagicLinkVerifier — dev 링크 발급·검증", () => {
  it("start(dev) → devHint 링크 경로 · verify(token) → {method:email, subject}", async () => {
    const v = new EmailMagicLinkVerifier({ isProd: false, email: new ConsoleEmailSender(), appOrigin: ORIGIN });
    const r = await v.start("email", "Test@Example.COM");
    expect(r.challengeId.startsWith("email:")).toBe(true);
    expect(r.devHint).toMatch(/^\/app\?lm_login=email:[0-9a-f]+~[0-9a-f]{64}$/); // 256bit 토큰
    const { challengeId, token } = parseHint(r.devHint!);
    expect(challengeId).toBe(r.challengeId);
    const ok = await v.verify(challengeId, token);
    expect(ok).toEqual({ method: "email", subject: "test@example.com" }); // 소문자 정규화
  });

  it("틀린 토큰 → null · 1회용 소비(재사용 차단)", async () => {
    const v = new EmailMagicLinkVerifier({ isProd: false, email: new ConsoleEmailSender(), appOrigin: ORIGIN });
    const r = await v.start("email", "x@y.com");
    const { challengeId, token } = parseHint(r.devHint!);
    expect(await v.verify(challengeId, "deadbeef")).toBeNull();       // 불일치
    expect(await v.verify(challengeId, token)).not.toBeNull();        // 정답 1회
    expect(await v.verify(challengeId, token)).toBeNull();            // 재사용 차단(소비됨)
  });

  it("잘못된 이메일 → BAD_EMAIL throw", async () => {
    const v = new EmailMagicLinkVerifier({ isProd: false, email: new ConsoleEmailSender(), appOrigin: ORIGIN });
    await expect(v.start("email", "not-an-email")).rejects.toThrow("BAD_EMAIL");
  });

  it("운영 + 발송 실패(키 없음) → AUTH_NOT_CONFIGURED(fail-closed·링크 비노출)", async () => {
    const v = new EmailMagicLinkVerifier({ isProd: true, email: new ConsoleEmailSender(), appOrigin: ORIGIN });
    await expect(v.start("email", "a@b.com")).rejects.toThrow("AUTH_NOT_CONFIGURED");
  });

  it("발송 성공(실sender) → challengeId만(힌트 비노출)", async () => {
    const liveStub: EmailSender = { mode: "live", async send() { return { ok: true }; } };
    const v = new EmailMagicLinkVerifier({ isProd: true, email: liveStub, appOrigin: ORIGIN });
    const r = await v.start("email", "a@b.com");
    expect(r.challengeId.startsWith("email:")).toBe(true);
    expect(r.devHint).toBeUndefined(); // 운영 실발송 — 링크 노출 안 함
  });
});

describe("CompositeVerifier — method 프리픽스 라우팅(휴대폰/이메일 병행)", () => {
  const comp = new CompositeVerifier({
    phone: new PhoneOtpVerifier({ isProd: false, sms: new ConsoleSmsSender() }),
    email: new EmailMagicLinkVerifier({ isProd: false, email: new ConsoleEmailSender(), appOrigin: ORIGIN }),
  });

  it("email start → email: 프리픽스 · verify가 이메일 검증기로 라우팅", async () => {
    const r = await comp.start("email", "a@b.com");
    expect(r.challengeId.startsWith("email:")).toBe(true);
    const { challengeId, token } = parseHint(r.devHint!);
    expect(await comp.verify(challengeId, token)).toEqual({ method: "email", subject: "a@b.com" });
  });

  it("phone start → phone: 프리픽스 · verify가 OTP 검증기로 라우팅", async () => {
    const r = await comp.start("phone", "010-1234-5678");
    expect(r.challengeId.startsWith("phone:")).toBe(true);
    expect(await comp.verify(r.challengeId, r.devHint!)).toEqual({ method: "phone", subject: "01012345678" });
  });

  it("미지원 method → AUTH_NOT_CONFIGURED · 알 수 없는 challengeId → null", async () => {
    await expect(comp.start("kakao", "x")).rejects.toThrow("AUTH_NOT_CONFIGURED");
    expect(await comp.verify("bogus:zzz", "x")).toBeNull();
    expect(await comp.verify("noprefix", "x")).toBeNull();
  });
});
