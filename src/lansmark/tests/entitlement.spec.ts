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
});
