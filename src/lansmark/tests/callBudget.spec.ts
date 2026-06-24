/** callBudget — 외부 유료 API 일일 호출 상한(폭주 비용 차단)의 회귀 가드. 결정적(now 주입). */
import { describe, it, expect, beforeEach } from "vitest";
import { tryConsume, callBudgetSnapshot, __resetCallBudget } from "../integrations/callBudget";

describe("callBudget — 외부 유료 API 일일 호출 상한", () => {
  beforeEach(() => {
    __resetCallBudget();
    delete process.env.LANSMARK_TESTKEY_DAILY_MAX;
    delete process.env.LANSMARK_ANTHROPIC_DAILY_MAX;
  });

  const T0 = Date.UTC(2026, 5, 24, 3, 0, 0); // KST 12:00 (UTC 03:00) — 고정 시각

  it("상한 내에서는 소비하며 true, 초과하면 false(degrade)", () => {
    process.env.LANSMARK_TESTKEY_DAILY_MAX = "3";
    expect(tryConsume("testkey", T0)).toBe(true);  // 1
    expect(tryConsume("testkey", T0)).toBe(true);  // 2
    expect(tryConsume("testkey", T0)).toBe(true);  // 3
    expect(tryConsume("testkey", T0)).toBe(false); // 4 → 초과(호출 측은 null degrade)
    expect(tryConsume("testkey", T0)).toBe(false); // 계속 거부
  });

  it("KST 날짜가 바뀌면 카운터 리셋(누적 burst 가드)", () => {
    process.env.LANSMARK_TESTKEY_DAILY_MAX = "1";
    expect(tryConsume("testkey", T0)).toBe(true);
    expect(tryConsume("testkey", T0)).toBe(false);            // 같은 날 초과
    const nextDay = T0 + 24 * 3600 * 1000;
    expect(tryConsume("testkey", nextDay)).toBe(true);        // 다음 날 → 리셋
  });

  it("KST 자정 경계 — UTC 15:00(=KST 익일 00:00)에 새 날로 리셋", () => {
    process.env.LANSMARK_TESTKEY_DAILY_MAX = "1";
    const utcMorning = Date.UTC(2026, 5, 24, 3, 0, 0);  // KST 6/24 12:00
    expect(tryConsume("testkey", utcMorning)).toBe(true);
    expect(tryConsume("testkey", utcMorning)).toBe(false);
    const utc15 = Date.UTC(2026, 5, 24, 15, 0, 0);      // KST 6/25 00:00 → 새 날
    expect(tryConsume("testkey", utc15)).toBe(true);
  });

  it("snapshot은 키별 used/max를 노출", () => {
    process.env.LANSMARK_ANTHROPIC_DAILY_MAX = "10";
    tryConsume("anthropic", T0);
    tryConsume("anthropic", T0);
    const s = callBudgetSnapshot(T0);
    expect(s.anthropic.used).toBe(2);
    expect(s.anthropic.max).toBe(10);
  });

  it("환경변수 없으면 보수적 기본값(anthropic 500·perplexity 300)", () => {
    const s = callBudgetSnapshot(T0);
    expect(s.anthropic.max).toBe(500);
    expect(s.perplexity.max).toBe(300);
  });
});
