/**
 * provider 런타임 건강 — '키=live' 거짓 녹색을 막는 실제 호출 결과 집계(설계감사 정직성).
 *   pending(미검증)·live(마지막 성공)·degraded(마지막 폴백=실 API 다운 추정) 상태 전이를 고정.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { recordProvider, runtimeState, runtimeCounts, _resetProviderHealth } from "../data/providers/runtimeHealth";

describe("runtimeHealth (provider 런타임 건강)", () => {
  beforeEach(_resetProviderHealth);

  it("호출 전 = pending(미검증) · 카운트 0", () => {
    expect(runtimeState("vworldParcel")).toBe("pending");
    expect(runtimeCounts("vworldParcel")).toEqual({ live: 0, fallback: 0 });
  });
  it("마지막 결과로 state 결정 — live↔degraded 전이", () => {
    recordProvider("kmaClimate", "live");
    expect(runtimeState("kmaClimate")).toBe("live");
    recordProvider("kmaClimate", "fallback"); // 가장 최근이 폴백 = degraded(실 다운 추정)
    expect(runtimeState("kmaClimate")).toBe("degraded");
    recordProvider("kmaClimate", "live");     // 복구 → 다시 live
    expect(runtimeState("kmaClimate")).toBe("live");
  });
  it("누적 카운트 유지(맥락)", () => {
    recordProvider("kamisPrice", "live"); recordProvider("kamisPrice", "live"); recordProvider("kamisPrice", "fallback");
    expect(runtimeCounts("kamisPrice")).toEqual({ live: 2, fallback: 1 });
  });
  it("연동별 독립", () => {
    recordProvider("vworldParcel", "fallback"); recordProvider("kmaClimate", "live");
    expect(runtimeState("vworldParcel")).toBe("degraded");
    expect(runtimeState("kmaClimate")).toBe("live");
  });
  it("_reset로 격리", () => {
    recordProvider("x", "live"); _resetProviderHealth();
    expect(runtimeState("x")).toBe("pending");
  });
});
