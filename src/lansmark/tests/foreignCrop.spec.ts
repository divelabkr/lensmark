/**
 * 외래·임의 작물 조립(assembleForeignCrop) 검증 — 실제 GBIF/위키 응답 형태 기반.
 *   ※ 형태는 실연동 캡처값(2026-06): GBIF species/match, 위키백과(ko) REST summary.
 */
import { describe, it, expect } from "vitest";
import { assembleForeignCrop, assessForeignClimate } from "../foreign/foreignCrop";

// 실제 캡처 형태(망고)
const GBIF_MANGO = { usageKey: 3190638, scientificName: "Mangifera indica L.", canonicalName: "Mangifera indica", rank: "SPECIES", status: "ACCEPTED", confidence: 97, matchType: "EXACT", family: "Anacardiaceae", genus: "Mangifera", species: "Mangifera indica" };
const WIKI_MANGO = { type: "standard", title: "망고", extract: "망고는 망고 열대 나무에서 생산되는 식용 핵과이다. 미얀마 북서부, 방글라데시, 인도 북동부 사이의 지역에서 유래했다.", thumbnail: { source: "https://upload.wikimedia.org/x.jpg" } };

describe("assembleForeignCrop", () => {
  it("GBIF 매칭 + 위키 설명 → resolved·분류·설명·면책, 소득시뮬 비활성", () => {
    const r = assembleForeignCrop("Mangifera indica", GBIF_MANGO, WIKI_MANGO);
    expect(r.resolved).toBe(true);
    expect(r.taxon?.family).toBe("Anacardiaceae");
    expect(r.taxon?.scientificName).toMatch(/Mangifera/);
    expect(r.description?.extract).toMatch(/유래/);
    expect(r.description?.source).toMatch(/위키백과/);
    expect(r.incomeSimAvailable).toBe(false);          // 핵심 경계
    expect(r.disclaimer).toMatch(/소득 시뮬레이션은 제공되지 않습니다/);
    expect(r.sources.join(" ")).toMatch(/GBIF/);
  });

  it("GBIF matchType=NONE → resolved=false, taxon 없음", () => {
    const r = assembleForeignCrop("zzqq", { matchType: "NONE", confidence: 0 }, null);
    expect(r.resolved).toBe(false);
    expect(r.taxon).toBeUndefined();
    expect(r.incomeSimAvailable).toBe(false);
  });

  it("위키 모호페이지/누락 → 설명 생략(크래시 없음)", () => {
    const r = assembleForeignCrop("apple", GBIF_MANGO, { type: "disambiguation", title: "사과" });
    expect(r.description).toBeUndefined();
    expect(r.resolved).toBe(true); // GBIF는 매칭
  });

  it("둘 다 null이어도 안전(미해결·설명없음)", () => {
    const r = assembleForeignCrop("???", null, null);
    expect(r.resolved).toBe(false);
    expect(r.description).toBeUndefined();
    expect(r.incomeSimAvailable).toBe(false);
  });
});

describe("assessForeignClimate (관측 위도대 × 필지)", () => {
  const tropical = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 19, 20, 21]; // |lat| 저위도
  const temperate = [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 35, 36, 37, 38];

  it("저위도(열대/아열대) 작물 + 한국(36°) → caution(노지 어려움·시설 검토)", () => {
    const f = assessForeignClimate(tropical, { lat: 36, minWinterTempC: -10 })!;
    expect(f.signal).toBe("caution");
    expect(f.note).toMatch(/시설/);
    expect(f.note).toMatch(/겨울 최저 -10℃/);   // 월동 경고 포함
    expect(f.parcelLat).toBe(36);
  });

  it("온대 작물(관측대가 한국 포함) → similar(기후대 유사·별도 검증)", () => {
    const f = assessForeignClimate(temperate, { lat: 36 })!;
    expect(f.signal).toBe("similar");
    expect(f.overlap).toBe(true);
    expect(f.note).toMatch(/별도 검증/);
  });

  it("표본 10 미만 → 신호 미제공(정직)", () => {
    expect(assessForeignClimate([20, 21, 22], { lat: 36 })).toBeUndefined();
  });

  it("필지 위도 없으면 미제공", () => {
    expect(assessForeignClimate(tropical, { lat: NaN })).toBeUndefined();
  });
});
