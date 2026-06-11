/**
 * Tier 1 ops watcher 평가기 — crit/warn/ok 롤업 + 진단/권고. 읽기 전용·행동 0.
 */
import { describe, it, expect } from "vitest";
import { evaluateOps, formatReport, type StatsLite } from "../ops/opsWatch";

const green: StatsLite = {
  storeDegraded: false,
  usage: { errors: 0 },
  quality: { grade: "A", dataTrust: "verified", sources: [{ label: "소득 base(RDA)", status: "ok", note: "실 RDA" }] },
  optimization: { payload: { gzipKB: 40 }, headroom: { feedback: { n: 10, cap: 20000 }, demandKeys: { n: 5, cap: 10000 } } },
};

describe("opsWatch — Tier 1 진단(읽기 전용)", () => {
  it("전부 정상이면 ok · findings 0", () => {
    const r = evaluateOps({ stats: green });
    expect(r.level).toBe("ok");
    expect(r.findings.length).toBe(0);
    expect(r.summary).toContain("정상");
  });

  it("스토어 저하 → crit(최우선)", () => {
    const r = evaluateOps({ stats: { ...green, storeDegraded: true } });
    expect(r.level).toBe("crit");
    expect(r.findings[0].area).toBe("스토어");
  });

  it("품질 미검증 + base fail → crit · 권고에 rda:build", () => {
    const r = evaluateOps({ stats: { ...green, quality: { grade: "D", dataTrust: "unverified", sources: [{ label: "소득 base(RDA)", status: "fail", note: "데모·미검증" }] } } });
    expect(r.level).toBe("crit");
    expect(r.findings.some((f) => f.area === "신뢰" && /rda:build/.test(f.recommend))).toBe(true);
    expect(r.findings.some((f) => f.area === "품질" && f.severity === "crit")).toBe(true);
  });

  it("경고만 있으면 warn (mock 소스·payload 55~75)", () => {
    const r = evaluateOps({ stats: { ...green,
      quality: { grade: "B", dataTrust: "verified", sources: [{ label: "시세(KAMIS)", status: "warn", note: "mock" }] },
      optimization: { payload: { gzipKB: 60 }, headroom: {} } } });
    expect(r.level).toBe("warn");
    expect(r.findings.some((f) => f.area === "성능")).toBe(true);
    expect(r.findings.some((f) => f.area === "품질" && f.severity === "warn")).toBe(true);
  });

  it("임계 초과 → crit (payload≥75·헤드룸≥80%·5xx≥10)", () => {
    const r = evaluateOps({ stats: { ...green,
      usage: { errors: 12 },
      optimization: { payload: { gzipKB: 80 }, headroom: { feedback: { n: 18000, cap: 20000 } } } } });
    expect(r.level).toBe("crit");
    expect(r.findings.some((f) => f.area === "에러" && f.severity === "crit")).toBe(true);
    expect(r.findings.some((f) => f.area === "성능" && f.severity === "crit")).toBe(true);
    expect(r.findings.some((f) => f.area === "저장소" && f.severity === "crit")).toBe(true);
  });

  it("formatReport: 요약 + 항목별 진단·권고 텍스트", () => {
    const r = evaluateOps({ stats: { ...green, storeDegraded: true } });
    const txt = formatReport(r);
    expect(txt).toContain("⛔");
    expect(txt).toContain("스토어");
    expect(txt).toContain("→"); // 권고 줄
  });
});
