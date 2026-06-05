import { describe, it, expect } from "vitest";
import { validateSimulationInput, validateLandInput, ValidationError } from "../core/validate";

describe("validate", () => {
  it("rejects non-finite / non-positive area", () => {
    expect(() => validateLandInput({ areaM2: Infinity })).toThrow(ValidationError);
    expect(() => validateLandInput({ areaM2: -5 })).toThrow(ValidationError);
    expect(() => validateLandInput({ areaM2: "abc" })).toThrow(ValidationError);
    expect(() => validateLandInput({})).toThrow(ValidationError);
  });
  it("clamps negative override price/cost to 0", () => {
    const input = validateSimulationInput({
      land: { areaM2: 1000 }, cropId: "sweet_potato",
      userOverridePriceKrwPerKg: -999, userOverrideCostKrw: -1,
    });
    expect(input.userOverridePriceKrwPerKg).toBe(0);
    expect(input.userOverrideCostKrw).toBe(0);
  });
  it("throws on unknown crop", () => {
    expect(() => validateSimulationInput({ land: { areaM2: 1000 }, cropId: "dragon_x" })).toThrow();
  });
  it("applies safe defaults for channel/cultivation", () => {
    const input = validateSimulationInput({ land: { areaM2: 1000 }, cropId: "sweet_potato" });
    expect(input.salesChannel).toBe("mixed");
    expect(input.cultivationType).toBe("open_field");
  });
  it("rejects oversized polygon", () => {
    const big = { type: "Polygon", coordinates: Array(50000).fill([127, 37]) };
    expect(() => validateLandInput({ areaM2: 1000, polygonGeoJson: big })).toThrow(ValidationError);
  });
});
