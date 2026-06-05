/**
 * 병충해·재해 주의(buildAgriAlerts) 검증 — 시기 파싱·현재월 매칭·정렬·클램프·면책.
 */
import { describe, it, expect } from "vitest";
import { buildAgriAlerts, monthsOfSeason } from "../alerts/agriAlerts";

describe("monthsOfSeason (발생 시기 → 월)", () => {
  it("명시 범위 '6~8월' → {6,7,8}", () => {
    expect([...monthsOfSeason("6~8월")].sort((a, b) => a - b)).toEqual([6, 7, 8]);
  });
  it("계절 키워드 '봄' → {3,4,5}", () => {
    expect([...monthsOfSeason("봄")].sort((a, b) => a - b)).toEqual([3, 4, 5]);
  });
  it("'출수·장마기' → 장마(6,7) 포함", () => {
    const s = monthsOfSeason("출수·장마기");
    expect(s.has(6)).toBe(true); expect(s.has(7)).toBe(true);
  });
  it("매칭 불가 텍스트 → 빈 집합", () => {
    expect(monthsOfSeason("정식초기").size).toBe(0);
  });
  it("부분문자열 충돌 방지(레드팀 F1): '초여름'→6만(7·8 제외), '늦여름~가을'→6·7 제외", () => {
    const e = monthsOfSeason("초여름");
    expect(e.has(6)).toBe(true); expect(e.has(7)).toBe(false); expect(e.has(8)).toBe(false);
    const la = monthsOfSeason("늦여름~가을");
    expect(la.has(8) && la.has(9)).toBe(true); expect(la.has(6) || la.has(7)).toBe(false);
  });
});

describe("buildAgriAlerts", () => {
  it("벼 7월: 병해충·기상 주의 다수 active, active가 먼저 정렬", () => {
    const a = buildAgriAlerts("rice", 7);
    expect(a.cropNameKo).toBeTruthy();
    expect(a.alerts.length).toBeGreaterThan(0);
    expect(a.alerts.some((x) => x.title.includes("벼멸구") && x.active)).toBe(true); // 7~8월
    expect(a.activeCount).toBeGreaterThan(0);
    expect(a.alerts[0].active).toBe(true); // active 우선 정렬
  });

  it("기상/재해: 7월엔 폭염, 8~9월엔 태풍(경계)", () => {
    expect(buildAgriAlerts("potato", 7).alerts.some((x) => x.title.includes("폭염") && x.active)).toBe(true);
    const typhoon = buildAgriAlerts("potato", 9).alerts.find((x) => x.title.includes("태풍"));
    expect(typhoon?.active).toBe(true);
    expect(typhoon?.severity).toBe("warn");
  });

  it("월 클램프(0→1, 13→12)", () => {
    expect(buildAgriAlerts("apple", 0).month).toBe(1);
    expect(buildAgriAlerts("apple", 13).month).toBe(12);
  });

  it("면책·출처(NCPMS·KMA seam) 포함", () => {
    const a = buildAgriAlerts("apple", 6);
    expect(a.disclaimer).toMatch(/보장하지 않습니다/);
    expect(a.sources.join(" ")).toMatch(/NCPMS/);
    expect(a.sources.join(" ")).toMatch(/KMA/);
  });

  it("unknown cropId → throw(호출측 400)", () => {
    expect(() => buildAgriAlerts("zzz_unknown", 6)).toThrow();
  });
});
