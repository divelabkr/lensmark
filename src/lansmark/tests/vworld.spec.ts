import { describe, it, expect } from "vitest";
import { tileUrlTemplate, mockParcel } from "../geo/vworld";

describe("geo/vworld (Stage1 타일·필지)", () => {
  it("WMTS 타일 템플릿 형식", () => {
    expect(tileUrlTemplate("Satellite", "KEY123"))
      .toBe("https://api.vworld.kr/req/wmts/1.0.0/KEY123/Satellite/{z}/{y}/{x}.jpeg");
    expect(tileUrlTemplate("Base", "KEY123")).toMatch(/\/Base\/\{z\}\/\{y\}\/\{x\}\.png$/);
  });
  it("mockParcel: 중심 포함 4각형", () => {
    const p = mockParcel(36.5, 127.8);
    expect(p.polygon).toHaveLength(4);
    expect(p.center).toEqual({ lat: 36.5, lng: 127.8 });
    const lats = p.polygon.map(v => v.lat);
    expect(Math.min(...lats)).toBeLessThan(36.5);
    expect(Math.max(...lats)).toBeGreaterThan(36.5);
  });
});
