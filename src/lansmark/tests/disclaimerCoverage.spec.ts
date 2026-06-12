/**
 * 면책 횡단 회귀가드(설계감사 D-P2#1) — 소득류 결과는 면책을 반드시 동반해야 한다(1원칙).
 *   개별 모듈 spec이 각자 검증하지만, 공유 프리미티브(getDefaultDisclaimers)가 비거나 paid 결과에서
 *   면책이 빠지는 회귀를 한 곳에서 잡는다(신규 결과경로가 면책 없이 추가되는 드리프트 방어).
 */
import { describe, it, expect } from "vitest";
import { getDefaultDisclaimers } from "../policy/disclaimer";
import { runParcelSimulation, type ParcelInput } from "../core/parcelSimulator";

const base = (over: Partial<ParcelInput> = {}): ParcelInput => ({
  land: { areaM2: 3300, soilEvidence: { source: "none" } },
  cropId: "apple", cultivationType: "open_field", salesChannel: "mixed", ...over,
});

describe("면책 횡단 커버리지(D-P2#1)", () => {
  it("getDefaultDisclaimers — 비지 않은 문자열 배열(공유 프리미티브 붕괴 차단)", () => {
    const d = getDefaultDisclaimers();
    expect(Array.isArray(d)).toBe(true);
    expect(d.length).toBeGreaterThan(0);
    expect(d.every((s) => typeof s === "string" && s.trim().length > 0)).toBe(true);
  });
  it("paid 소득 결과(parcelSimulator)는 면책을 동반하고 공유 프리미티브를 포함한다", () => {
    const r = runParcelSimulation(base());
    expect(Array.isArray(r.disclaimers)).toBe(true);
    expect(r.disclaimers.length).toBeGreaterThan(0);
    for (const d of getDefaultDisclaimers()) expect(r.disclaimers).toContain(d); // 하드와이어 회귀 차단
  });
});
