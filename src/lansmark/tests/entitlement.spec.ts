import { describe, it, expect, beforeAll } from "vitest";
import { mintEntitlementToken, assertPaidEntitlement, EntitlementError } from "../policy/entitlement";

const hdr = (token?: string) => ({ get: (n: string) => (n === "x-lansmark-entitlement" && token ? token : null) });

describe("entitlement", () => {
  beforeAll(() => { process.env.LANSMARK_ENTITLEMENT_SECRET = "test-secret"; });

  it("mint -> verify roundtrip", async () => {
    const t = mintEntitlementToken({ userId: "u1", exp: Date.now() + 10000 });
    const ent = await assertPaidEntitlement(hdr(t));
    expect(ent.userId).toBe("u1");
  });
  it("rejects missing token (402)", async () => {
    await expect(assertPaidEntitlement(hdr())).rejects.toMatchObject({ status: 402 });
  });
  it("rejects tampered token (403)", async () => {
    const t = mintEntitlementToken({ userId: "u1" }) + "x";
    await expect(assertPaidEntitlement(hdr(t))).rejects.toMatchObject({ status: 403 });
  });
  it("rejects expired token", async () => {
    const t = mintEntitlementToken({ userId: "u1", exp: Date.now() - 1 });
    await expect(assertPaidEntitlement(hdr(t))).rejects.toBeInstanceOf(EntitlementError);
  });
  it("rejects oversized token (길이 cap·비용증폭 차단)", async () => {
    const huge = "a".repeat(5000) + "." + "b".repeat(64); // >4096 → HMAC/parse 前 거부
    await expect(assertPaidEntitlement(hdr(huge))).rejects.toMatchObject({ status: 403 });
  });

  // 세션-인지 결속 강제(보안 감사 P1) — 결속 토큰은 로그인 세션 계정과 일치해야 사용 가능.
  describe("boundAccount 세션 결속 강제", () => {
    it("결속 토큰 + 일치 세션 → 허용", async () => {
      const t = mintEntitlementToken({ userId: "order:o1", boundAccount: "acctZ" });
      const ent = await assertPaidEntitlement(hdr(t), { sessionAccountId: "acctZ" });
      expect(ent.boundAccount).toBe("acctZ");
    });
    it("결속 토큰 + 불일치 세션(타인 도용) → 403", async () => {
      const t = mintEntitlementToken({ userId: "order:o1", boundAccount: "acctZ" });
      await expect(assertPaidEntitlement(hdr(t), { sessionAccountId: "attacker" })).rejects.toMatchObject({ status: 403 });
    });
    it("결속 토큰 + 세션 없음 → 허용(bearer 유지·익명 결제 흐름)", async () => {
      const t = mintEntitlementToken({ userId: "order:o1", boundAccount: "acctZ" });
      const ent = await assertPaidEntitlement(hdr(t)); // opts 없음
      expect(ent.boundAccount).toBe("acctZ");
    });
    it("비결속 토큰 + 임의 세션 → 허용(영향 없음)", async () => {
      const t = mintEntitlementToken({ userId: "order:o1" }); // boundAccount 없음
      const ent = await assertPaidEntitlement(hdr(t), { sessionAccountId: "anyone" });
      expect(ent.userId).toBe("order:o1");
    });
  });
});
