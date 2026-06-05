import { describe, it, expect } from "vitest";
import { buildParcelInput, sanitizeContext, sanitizeTerrain, sanitizeSatellite } from "../api/parcelRequest";
import { ValidationError } from "../core/validate";

describe("parcelRequest hardening", () => {
  const base = {
    cropId: "blueberry", cultivationType: "open_field", salesChannel: "mixed",
    land: { lat: 34.57, lng: 126.6, areaM2: 3300 },
    context: { terrain: { slopeDegree: 7.6, aspect: "S", altitudeM: 305 } },
    region: "전라남도",
  };

  it("accepts a valid request and preserves crop/land/region/terrain", () => {
    const out = buildParcelInput(base);
    expect(out.cropId).toBe("blueberry");
    expect(out.land.areaM2).toBe(3300);
    expect(out.region).toBe("전라남도");
    expect(out.context?.terrain?.slopeDegree).toBe(7.6);
    expect(out.context?.terrain?.aspect).toBe("S");
  });

  it("rejects an XSS payload as cropId (does not reach engine)", () => {
    const bad = { ...base, cropId: '<img src=x onerror=alert(document.domain)>' };
    expect(() => buildParcelInput(bad)).toThrow(); // getCropProfile throws on unknown cropId
  });

  it("rejects missing land / non-object input", () => {
    expect(() => buildParcelInput({ ...base, land: undefined })).toThrow(ValidationError);
    expect(() => buildParcelInput("nope" as unknown)).toThrow(ValidationError);
  });

  it("rejects absurd areaM2 (DoS guard)", () => {
    expect(() => buildParcelInput({ ...base, land: { areaM2: 1e12 } })).toThrow(ValidationError);
    expect(() => buildParcelInput({ ...base, land: { areaM2: 0 } })).toThrow(ValidationError);
  });

  it("does NOT trust client-sent calibration or climate (server computes/injects)", () => {
    const out = buildParcelInput({ ...base, calibration: { n: 999, yieldCorrection: 9 }, context: { ...base.context, climate: { minWinterTempC: -99 } } });
    expect((out as Record<string, unknown>).calibration).toBeUndefined();
    expect(out.context?.climate).toBeUndefined();
  });

  it("sanitizeTerrain clamps and drops junk", () => {
    expect(sanitizeTerrain({ slopeDegree: 9999, altitudeM: 305 })?.slopeDegree).toBe(90); // clamp 0..90
    expect(sanitizeTerrain({ slopeDegree: "abc" })?.slopeDegree).toBeUndefined();          // NaN dropped
    expect(sanitizeTerrain({ slopeDegree: Infinity })?.slopeDegree).toBeUndefined();        // Infinity dropped
    expect(sanitizeTerrain({ aspect: "<script>" })?.aspect).toBeUndefined();                // enum-only
    expect(sanitizeTerrain({ aspect: "SE" })?.aspect).toBe("SE");
  });

  it("sanitizeSatellite coerces to strict booleans/enums", () => {
    const s = sanitizeSatellite({ observed: "yes", ndviRelative: "evil", frostPocket: 1, waterlogging: true });
    expect(s?.observed).toBe(false);            // only === true
    expect(s?.ndviRelative).toBeUndefined();    // enum-only
    expect(s?.frostPocket).toBe(false);
    expect(s?.waterlogging).toBe(true);
  });

  it("sanitizeContext ignores non-objects", () => {
    expect(sanitizeContext(undefined)).toEqual({});
    expect(sanitizeContext("x" as unknown)).toEqual({});
  });
});
