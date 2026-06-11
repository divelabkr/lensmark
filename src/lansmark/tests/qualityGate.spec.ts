/**
 * 데이터 품질 게이트 — 차원 게이트·fail-closed·dataTrust verdict 검증.
 *   핵심: 'base 데모면 unverified/D + 제품 보수(✓검증 차단)' / 전부 live+보정이면 verified.
 */
import { describe, it, expect } from "vitest";
import { assessQuality, type QualityInputs } from "../quality/qualityGate";

const allLive = {
  vworldGeocode: { keyed: true, live: true }, vworldParcel: { keyed: true, live: true },
  kamisPrice: { keyed: true, live: true }, kmaClimate: { keyed: true, live: true },
};
const base = (over: Partial<QualityInputs> = {}): QualityInputs => ({
  integrations: allLive, rdaMeta: null, flywheel: { records: 0, withActuals: 0, validatedBuckets: 0 }, ...over,
});

describe("qualityGate — 데이터 품질 차원 게이트", () => {
  it("fail-closed: RDA base 데모면 소득 base=fail · dataTrust=unverified · 등급 D(운영 녹색이어도)", () => {
    const q = assessQuality(base({ rdaMeta: null }));
    const baseSrc = q.sources.find((s) => s.key === "rdaIncome")!;
    expect(baseSrc.status).toBe("fail");
    expect(q.baseVerified).toBe(false);
    expect(q.dataTrust).toBe("unverified"); // 제품이 '✓검증' 차단·'추정' 강제하는 신호
    expect(q.grade).toBe("D");              // 핵심 소스 fail → 최하 등급
  });

  it("base 실자료 + 보정 충분 → verified · base 검증 ok", () => {
    const q = assessQuality(base({ rdaMeta: { rows: 120, baseYears: [2023] }, flywheel: { records: 50, withActuals: 30, validatedBuckets: 4 } }));
    expect(q.sources.find((s) => s.key === "rdaIncome")!.status).toBe("ok");
    expect(q.baseVerified).toBe(true);
    expect(q.dataTrust).toBe("verified");
  });

  it("base 실자료지만 보정 표본 부족 → estimated(검증은 아님)", () => {
    const q = assessQuality(base({ rdaMeta: { rows: 120, baseYears: [2023] }, flywheel: { records: 3, withActuals: 1, validatedBuckets: 0 } }));
    expect(q.dataTrust).toBe("estimated");
    expect(q.sources.find((s) => s.key === "calibration")!.status).toBe("warn");
  });

  it("mock 소스(키 없음)는 녹색 아님 — '에러 없음'이 아니라 '양성 신호'로 채점", () => {
    const q = assessQuality(base({ integrations: {}, rdaMeta: { rows: 1, baseYears: [2023] } }));
    expect(q.sources.find((s) => s.key === "kamisPrice")!.status).toBe("warn"); // live 아님 → warn(녹색 X)
    expect(q.sources.find((s) => s.key === "kmaClimate")!.status).toBe("warn");
    expect(q.sources.find((s) => s.key === "vworld")!.status).toBe("warn");
  });

  it("DEM은 구조적 mock → 항상 warn · 가드레일은 구조적 ok", () => {
    const q = assessQuality(base());
    expect(q.sources.find((s) => s.key === "vworldDem")!.status).toBe("warn");
    expect(q.sources.find((s) => s.key === "guardrail")!.status).toBe("ok");
  });
});
