import { describe, it, expect } from "vitest";
import { classifyJimok, classifyLandMock } from "../geo/landClass";

describe("landClass.classifyJimok (지목 → 분류)", () => {
  it("전/답/과수원 → 농경지(reconfirm, 경작가능)", () => {
    for (const j of ["전", "답", "과수원"]) {
      const r = classifyJimok(j);
      expect(r.group).toBe("agri");
      expect(r.action).toBe("reconfirm");
      expect(r.cultivable).toBe(true);
    }
  });
  it("하천/구거/공유수면 → 수면(block, 경작불가)", () => {
    for (const j of ["하천", "구거", "공유수면"]) {
      const r = classifyJimok(j);
      expect(r.group).toBe("water");
      expect(r.action).toBe("block");
      expect(r.cultivable).toBe(false);
    }
  });
  it("대(대지) → 도시(warn), 임야 → 임야(warn), 미상 → 기타(warn)", () => {
    expect(classifyJimok("대").category).toBe("urban");
    expect(classifyJimok("대").action).toBe("warn");
    expect(classifyJimok("임야").category).toBe("forest");
    expect(classifyJimok("도로").category).toBe("other");
    expect(classifyJimok("도로").action).toBe("warn");
  });
});

describe("landClass.classifyLandMock (좌표 → 분류, 데모)", () => {
  it("먼바다/개방수면 → 바다(block)", () => {
    expect(classifyLandMock(35.0, 124.5).category).toBe("sea");   // 서해 먼바다
    expect(classifyLandMock(33.9, 126.5).category).toBe("sea");   // 제주해협
    expect(classifyLandMock(35.0, 124.5).action).toBe("block");
  });
  it("대도시 중심 → 도시(warn)", () => {
    const seoul = classifyLandMock(37.566, 126.978);
    expect(seoul.category).toBe("urban");
    expect(seoul.action).toBe("warn");
    expect(seoul.cultivable).toBe(false);
  });
  it("하천 샘플 → 하천(block)", () => {
    expect(classifyLandMock(35.45, 128.45).group).toBe("water");
  });
  it("일반 농촌 좌표 → 농경지(reconfirm, 경작가능)", () => {
    const rural = classifyLandMock(34.57, 126.6); // 해남 데모 필지
    expect(rural.group).toBe("agri");
    expect(rural.action).toBe("reconfirm");
    expect(rural.cultivable).toBe(true);
    expect(["field", "paddy", "orchard"]).toContain(rural.category);
  });
  it("비유한 좌표 → 기타", () => {
    expect(classifyLandMock(NaN, 1).category).toBe("other");
  });
  it("결정적(같은 좌표=같은 분류)", () => {
    expect(classifyLandMock(35.3, 127.0).category).toBe(classifyLandMock(35.3, 127.0).category);
  });
});
