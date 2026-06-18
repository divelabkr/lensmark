import { describe, it, expect } from "vitest";
import { buildExplainMessages, hasUnprovidedMoney, explainConfigured, type ExplainInput } from "../integrations/explain";

const input: ExplainInput = {
  cropNameKo: "사과",
  region: "경상북도",
  income: { p10: 5_000_000, p50: 12_000_000, p90: 19_000_000 },
  reasons: ["토양 pH 적정", "겨울 최저 −8℃ — 내한 경계"],
  climateFacts: ["연평균기온 12.3℃", "적산온도 2840℃·일"],
  sources: ["농진청 농산물소득조사 2024", "KAMIS 시세"],
};

describe("explain seam — 결정적 프롬프트 + 날조 가드", () => {
  it("프롬프트는 제공값만 담고 '새 숫자 만들지 말라'를 경성 지시한다", () => {
    const { system, user } = buildExplainMessages(input);
    expect(system).toContain("제공된 숫자");
    expect(system).toMatch(/만들지 마라|만들지 않/);
    expect(user).toContain("사과");
    expect(user).toContain("경상북도");
    expect(user).toContain("12,000,000"); // 엔진 P50이 그대로 들어감
    expect(user).toContain("연평균기온 12.3℃");
  });

  it("제공된 금액(부분일치)은 허용, 안 준 금액은 폐기 신호", () => {
    const allowed = ["5,000,000", "12,000,000", "19,000,000"];
    expect(hasUnprovidedMoney("연 소득은 약 12,000,000원으로 추정됩니다.", allowed)).toBe(false);
    // 엔진이 준 적 없는 금액(날조) → true
    expect(hasUnprovidedMoney("실제로는 50,000,000원까지 벌 수 있습니다.", allowed)).toBe(true);
    // 소액/일반 숫자(자릿수 적음)는 무시
    expect(hasUnprovidedMoney("3년차부터 안정적입니다.", allowed)).toBe(false);
  });

  it("키 없으면 미구성", () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(explainConfigured()).toBe(false);
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  });
});
