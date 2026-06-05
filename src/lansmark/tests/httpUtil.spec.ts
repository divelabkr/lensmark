import { describe, it, expect } from "vitest";
import { finiteParam, MAX_BODY_BYTES } from "../api/httpUtil";

describe("httpUtil.finiteParam", () => {
  it("parses finite numbers", () => {
    expect(finiteParam("34.57")).toBe(34.57);
    expect(finiteParam("-3")).toBe(-3);
    expect(finiteParam("0")).toBe(0);
  });
  it("rejects NaN / Infinity / junk → undefined (NaN-coord guard)", () => {
    expect(finiteParam("abc")).toBeUndefined();
    expect(finiteParam("NaNxx")).toBeUndefined();
    expect(finiteParam("Infinity")).toBeUndefined();
    expect(finiteParam("1e999")).toBeUndefined(); // overflow → Infinity
  });
  it("treats null/empty as absent", () => {
    expect(finiteParam(null)).toBeUndefined();
    expect(finiteParam("")).toBeUndefined();
  });
  it("enforces a request body cap", () => {
    expect(MAX_BODY_BYTES).toBeGreaterThan(0);
    expect(MAX_BODY_BYTES).toBeLessThanOrEqual(2 * 1024 * 1024);
  });
});
