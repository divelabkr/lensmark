import { describe, it, expect } from "vitest";
import { encodeShareState, decodeShareState } from "../share";
describe("share state", () => {
  it("roundtrip preserves input", () => {
    const input = { land: { areaM2: 3300 }, cropId: "sweet_potato", cultivationType: "open_field" as const, salesChannel: "mixed" as const, targetYear: "mature" as const };
    const d = decodeShareState(encodeShareState(input));
    expect(d?.cropId).toBe("sweet_potato");
    expect(d?.land?.areaM2).toBe(3300);
  });
  it("invalid token returns null", () => { expect(decodeShareState("@@not-valid@@")).toBeNull(); });
});
