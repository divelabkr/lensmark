/**
 * 레드팀 발견 수정 회귀가드 — 각 확정 항목이 다시 열리지 않게 동작으로 고정.
 */
import { describe, it, expect } from "vitest";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { InMemoryFeedbackStore, toOutcomeRecord } from "../core/feedbackStore";
import { InMemoryIdempotency } from "../payment/pgWebhook";
import { getValidationLevel } from "../core/calibration";
import { okClimate } from "../data/providers/auto";
import { satelliteFactors } from "../core/satellite";
import { confirmPayment } from "../payment/confirm";
import { validateLandInput } from "../core/validate";
import { getSoilConfidence } from "../policy/soilPolicy";
import { flywheelSubmitterId } from "../../../server/routes/journal";

describe("레드팀 수정 회귀가드", () => {
  it("H4 entitlement.consume — quota 초과·실효·레거시 처리", () => {
    const ctx = createContext(loadConfig());
    expect(ctx.entitlement.consume("jti-a", 2)).toBe(true);  // 1회
    expect(ctx.entitlement.consume("jti-a", 2)).toBe(true);  // 2회(=quota)
    expect(ctx.entitlement.consume("jti-a", 2)).toBe(false); // 3회 → 초과 거부
    expect(ctx.entitlement.consume("jti-b", 2)).toBe(true);  // 다른 토큰 독립
    ctx.entitlement.revoke("jti-b");
    expect(ctx.entitlement.consume("jti-b", 2)).toBe(false); // 실효 거부
    expect(ctx.entitlement.consume(undefined, 2)).toBe(false); // jti 없으면 fail-closed(우회 차단)
  });

  it("H6 getValidationLevel — 서로 다른 제출자 수(자기검증 위조 차단)", async () => {
    const single = new InMemoryFeedbackStore();
    for (let i = 0; i < 8; i++) single.add(toOutcomeRecord({ cropId: "apple", userId: "u1", yieldKg: 1, costKrw: 1, revenueKrw: 1 }, { actualYieldKg: 1 }));
    expect(await getValidationLevel("apple", undefined, single)).toBe(1); // 한 사람 8건 → 1
    const many = new InMemoryFeedbackStore();
    for (let i = 0; i < 5; i++) many.add(toOutcomeRecord({ cropId: "apple", userId: "u" + i, yieldKg: 1, costKrw: 1, revenueKrw: 1 }, { actualYieldKg: 1 }));
    expect(await getValidationLevel("apple", undefined, many)).toBe(5); // 5인 → 5(validated)
  });

  it("M9 InMemory 저장소 상한(메모리 고갈 차단)", () => {
    const fs = new InMemoryFeedbackStore(10);
    for (let i = 0; i < 25; i++) fs.add(toOutcomeRecord({ cropId: "apple", yieldKg: i, costKrw: 1, revenueKrw: 1 }, {}));
    expect(fs.all().length).toBe(10);
    const idem = new InMemoryIdempotency(5);
    for (let i = 0; i < 20; i++) idem.mark("k" + i);
    expect(idem.seen("k19")).toBe(true);   // 최신은 유지
    expect(idem.seen("k0")).toBe(false);   // 오래된 건 축출(상한)
  });

  it("M5 okClimate — 비현실적 미세 연강수(단독) 거부", () => {
    expect(okClimate({ annualRainfallMm: 5 })).toBe(false);    // 단기 응답 오염 차단
    expect(okClimate({ annualRainfallMm: 1200 })).toBe(true);
    expect(okClimate({ minWinterTempC: -10 })).toBe(true);
  });

  it("M6 satelliteFactors — 신뢰 출처만 confidenceBoost", () => {
    expect(satelliteFactors("apple", { observed: true, ndviRelative: "high", source: "client" }).confidenceBoost).toBe(false); // 클라 토글 위조 차단
    expect(satelliteFactors("apple", { observed: true, ndviRelative: "high", source: "sentinel" }).confidenceBoost).toBe(true);
    expect(satelliteFactors("apple", { observed: true, ndviRelative: "similar", source: "sentinel" }).confidenceBoost).toBe(false); // 신호 없으면 부스트 없음
  });

  it("H3 confirmPayment — 금액 불일치 차단(서버 expectedAmount)", async () => {
    await expect(confirmPayment({ paymentKey: "p", orderId: "o", amount: 1, expectedAmount: 4900, userId: "order:o", secretKey: "sk" }))
      .rejects.toThrow(/금액 불일치/);
  });

  it("H1(soil) validateLandInput — 클라 soilEvidence.source 위조 차단(신뢰등급 'A' 날조 불가)", () => {
    const land: any = validateLandInput({ areaM2: 3300, soilEvidence: { source: "official_soil_test", ph: 6.5 } });
    expect(land.soilEvidence.source).toBe("manual_input");        // 클라 자가신고 = 최대 C로 강등
    expect(getSoilConfidence(land.soilEvidence)).not.toBe("A");   // 'A'(공식 검정) 날조 불가
    const empty: any = validateLandInput({ areaM2: 3300, soilEvidence: { source: "official_soil_test" } });
    expect(empty.soilEvidence.source).toBe("none");               // 수치 전무 → none(D), 빈 검정서 위조 차단
  });

  it("H2(flywheel) flywheelSubmitterId — 무료베타 계정ID '✓검증' 배지 위조 차단", () => {
    expect(flywheelSubmitterId("acct:Z", false)).toMatch(/^anon-/);      // 무료 계정ID → anon 강등(배지 제외)
    expect(flywheelSubmitterId("anon-x", false)).toBe("anon-x");         // 이미 anon
    expect(flywheelSubmitterId("order:abc", true)).toBe("order:abc");    // 유료 인증 → 그대로(배지 카운트)
    expect(flywheelSubmitterId("acct:Z", false)).toBe(flywheelSubmitterId("acct:Z", false)); // 안정(같은 사용자=같은 키)
  });
});
