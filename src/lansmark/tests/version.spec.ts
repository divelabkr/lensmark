import { describe, it, expect } from "vitest";
import { APP_VERSION, RELEASES } from "../version";

const n = (v: string) => { const [a, b, c] = v.split(".").map(Number); return a * 1e6 + b * 1e3 + c; };

describe("version / 릴리스 노트", () => {
  it("APP_VERSION = 최신 릴리스", () => {
    expect(RELEASES.length).toBeGreaterThan(0);
    expect(APP_VERSION).toBe(RELEASES[0].version);
  });
  it("각 릴리스는 semver·날짜·내용 형식", () => {
    for (const r of RELEASES) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.items.length).toBeGreaterThan(0);
    }
  });
  it("버전은 내림차순(최신 우선)·중복 없음", () => {
    for (let i = 1; i < RELEASES.length; i++) expect(n(RELEASES[i - 1].version)).toBeGreaterThan(n(RELEASES[i].version));
    expect(new Set(RELEASES.map((r) => r.version)).size).toBe(RELEASES.length);
  });
});
