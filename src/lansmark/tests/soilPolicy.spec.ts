import { describe, it, expect } from "vitest";
import { assertRestrictedSoilApiAllowed, getSoilConfidence } from "../policy/soilPolicy";

describe("soilPolicy fail-closed", () => {
  it("blocks restricted API by default (permission false)", () => {
    expect(() => assertRestrictedSoilApiAllowed()).toThrow();
  });
  it("maps confidence grades", () => {
    expect(getSoilConfidence({ source: "official_soil_test" })).toBe("A");
    expect(getSoilConfidence({ source: "old_soil_test" })).toBe("B");
    expect(getSoilConfidence({ source: "manual_input" })).toBe("C");
    expect(getSoilConfidence({ source: "none" })).toBe("D");
    expect(getSoilConfidence(undefined)).toBe("D");
  });
});
