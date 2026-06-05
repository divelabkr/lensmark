import { describe, it, expect } from "vitest";
import {
  lonLatToTile, tileToLonLat, tileCenter, lonLatToMeters, metersToLonLat,
  distanceM, bboxAround, bboxOf, isValidPnu, parsePnu,
} from "../geo/crs";

describe("geo/crs (Stage0 좌표표준)", () => {
  it("lonLatToTile: (0,0) @z1 → (1,1)", () => {
    expect(lonLatToTile(0, 0, 1)).toEqual({ z: 1, x: 1, y: 1 });
  });

  it("타일 왕복: 중심 좌표 재계산 시 동일 타일 (서울시청 @z14)", () => {
    const z = 14, p = { lat: 37.5665, lng: 126.9780 };
    const t = lonLatToTile(p.lng, p.lat, z);
    const c = tileCenter(t);
    expect(lonLatToTile(c.lng, c.lat, z)).toEqual(t);
  });

  it("메르카토르 왕복 ≈ 원좌표 (부산)", () => {
    const p = { lat: 35.1796, lng: 129.0756 };
    const r = metersToLonLat(lonLatToMeters(p));
    expect(r.lat).toBeCloseTo(p.lat, 6);
    expect(r.lng).toBeCloseTo(p.lng, 6);
  });

  it("distanceM: 서울–부산 ≈ 325km (±15km)", () => {
    const d = distanceM({ lat: 37.5665, lng: 126.9780 }, { lat: 35.1796, lng: 129.0756 });
    expect(d).toBeGreaterThan(310000);
    expect(d).toBeLessThan(340000);
  });

  it("bboxAround: 중심 포함 + 남북 폭 ≈ 2R", () => {
    const c = { lat: 36.5, lng: 127.8 }, b = bboxAround(c, 500);
    expect(b.minLat).toBeLessThan(c.lat);
    expect(b.maxLat).toBeGreaterThan(c.lat);
    const span = distanceM({ lat: b.minLat, lng: c.lng }, { lat: b.maxLat, lng: c.lng });
    expect(span).toBeGreaterThan(900);
    expect(span).toBeLessThan(1100);
  });

  it("bboxOf: 폴리곤 경계", () => {
    expect(bboxOf([{ lat: 1, lng: 2 }, { lat: 3, lng: 1 }, { lat: 2, lng: 4 }]))
      .toEqual({ minLat: 1, maxLat: 3, minLng: 1, maxLng: 4 });
  });

  it("PNU 검증/파싱", () => {
    const pnu = "1111010100" + "1" + "0011" + "0000"; // 법정동·일반·본번11·부번0
    expect(isValidPnu(pnu)).toBe(true);
    expect(isValidPnu("123")).toBe(false);
    const p = parsePnu(pnu);
    expect(p.legalDongCode).toBe("1111010100");
    expect(p.mountain).toBe(false);
    expect(p.bonbun).toBe(11);
    expect(p.bubun).toBe(0);
  });
});
