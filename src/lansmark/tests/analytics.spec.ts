/**
 * 익명 수요·퍼널 계측 검증 — 집계 정확성·화이트리스트·노이즈 차단·신규키 상한(DoS)·파일 영속.
 *   원칙: 집계만(개별 여정 X)·PII 0·익명 신호는 '검증된 사실' 아님.
 */
import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";
import { InMemoryAnalyticsStore } from "../analytics/eventStore";
import { FileAnalyticsStore } from "../db/stores";

describe("analytics — 익명 수요·퍼널 집계", () => {
  it("퍼널: 단계 카운트 + 화이트리스트(임의 키 무시) + 6단계 항상 노출", () => {
    const a = new InMemoryAnalyticsStore();
    a.funnel("recommend"); a.funnel("recommend"); a.funnel("simulate");
    (a as any).funnel("hack"); // 화이트리스트 밖 → 무시(임의 키 주입 차단)
    const s = a.snapshot();
    expect(s.funnel.recommend).toBe(2);
    expect(s.funnel.simulate).toBe(1);
    expect(s.funnel.guide).toBe(0); // 미발생 단계도 0으로 노출(고정 키)
    expect(Object.keys(s.funnel).sort()).toEqual(["foreign", "guide", "journal", "recommend", "simulate", "subscribe"]);
    expect((s.funnel as any).hack).toBeUndefined();
  });

  it("수요: 작물×지역 집계 + top-N 내림차순 + region 없음은 '-'", () => {
    const a = new InMemoryAnalyticsStore();
    for (let i = 0; i < 5; i++) a.demand("apple", "전남");
    for (let i = 0; i < 2; i++) a.demand("grape", "경북");
    a.demand("apple"); // region 미지정 → '-'
    const s = a.snapshot();
    expect(s.demand[0]).toEqual({ cropId: "apple", region: "전남", sims: 5 }); // 최다 우선
    expect(s.demand.find((d) => d.cropId === "apple" && d.region === "-")?.sims).toBe(1);
    expect(s.demandKeys).toBe(3); // apple|전남 · grape|경북 · apple|-
  });

  it("PII 차단(M-1): region이 행정구역명 형태가 아니면(숫자·라틴 free-text) '기타'로 버킷 — 'PII 0' 강제", () => {
    const a = new InMemoryAnalyticsStore();
    a.demand("apple", "전북");                  // 정상 행정구역 → 그대로
    a.demand("apple", "전주시 (전북)");          // 한글+공백+괄호 → 그대로
    a.demand("apple", "010-1234-5678");        // 전화번호(숫자) → 기타
    a.demand("apple", "Seoul Gangnam 123");    // 라틴+숫자 free-text → 기타
    const s = a.snapshot();
    const reg = (r: string) => s.demand.find((d) => d.cropId === "apple" && d.region === r)?.sims;
    expect(reg("전북")).toBe(1);
    expect(reg("전주시 (전북)")).toBe(1);
    expect(reg("기타")).toBe(2); // 전화 + 라틴 free-text 합산
    expect(s.demand.some((d) => /\d/.test(d.region))).toBe(false); // 숫자(PII) 영속 안 됨
  });

  it("데이터갭: 카운트 + top-N 내림차순", () => {
    const a = new InMemoryAnalyticsStore();
    a.dataGap("crop:durian"); a.dataGap("crop:durian"); a.dataGap("foreign:망고");
    const s = a.snapshot();
    expect(s.dataGaps[0]).toEqual({ key: "crop:durian", hits: 2 });
    expect(s.dataGaps.length).toBe(2);
  });

  it("노이즈 차단: 빈 cropId/키는 미집계", () => {
    const a = new InMemoryAnalyticsStore();
    a.demand(""); a.dataGap("");
    const s = a.snapshot();
    expect(s.demand.length).toBe(0);
    expect(s.dataGaps.length).toBe(0);
  });

  it("신규 키 상한(DoS·메모리 가드): 상한 초과 신규 키는 무시, 기존 키는 계속 증가", () => {
    const a = new InMemoryAnalyticsStore();
    for (let i = 0; i < 10_001; i++) a.demand("c" + i, "r"); // 10001 distinct → 10000까지만 수용
    expect(a.snapshot(1).demandKeys).toBe(10_000);
    a.demand("c0", "r"); a.demand("c0", "r"); // 기존 키는 계속 증가
    expect(a.snapshot(20_000).demand.find((d) => d.cropId === "c0")?.sims).toBe(3);
  });

  it("FileAnalyticsStore: flushNow 후 재로드 시 집계 보존(재시작 내구)", () => {
    const path = join(tmpdir(), "lensmark-analytics-test.json");
    if (existsSync(path)) rmSync(path);
    const a = new FileAnalyticsStore(path);
    a.funnel("simulate"); a.demand("rice", "전북"); a.dataGap("crop:x");
    a.flush(); // throttle(25건) 무시하고 즉시 저장
    const b = new FileAnalyticsStore(path); // 새 인스턴스 = 재시작 모사
    const s = b.snapshot();
    expect(s.funnel.simulate).toBe(1);
    expect(s.demand[0]).toEqual({ cropId: "rice", region: "전북", sims: 1 });
    expect(s.dataGaps[0]).toEqual({ key: "crop:x", hits: 1 });
    rmSync(path);
  });
});
