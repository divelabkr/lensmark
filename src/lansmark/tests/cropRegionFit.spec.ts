/**
 * 작물→지역 추천(buildCropRegionFit) + /api/region-fit — 지형조건·시도 기후적합·정렬·면책.
 */
import { describe, it, expect } from "vitest";
import type * as http from "node:http";
import { buildCropRegionFit } from "../region/cropRegionFit";
import { loadConfig } from "../../../server/config";
import { createContext } from "../../../server/context";
import { route } from "../../../server/router";

describe("buildCropRegionFit", () => {
  it("지형조건 + 시도 17개 + 적합 먼저 정렬 + 면책", () => {
    const r = buildCropRegionFit("blueberry");
    expect(r.cropNameKo).toBeTruthy();
    expect(r.terrainConditions.length).toBeGreaterThan(0);           // ① 지형 조건
    expect(r.regions.length).toBe(17);                               // ② 17개 시도
    for (let i = 1; i < r.regions.length; i++) {                     // 적합 먼저(정렬 단조)
      const rank = { ok: 0, watch: 1, risk: 2, unknown: 3 } as const;
      expect(rank[r.regions[i - 1].fit]).toBeLessThanOrEqual(rank[r.regions[i].fit]);
    }
    expect(r.regions[0].lat).toBeTypeOf("number");                   // 마커용 중심좌표
    expect(r.disclaimer).toMatch(/필지|보장하지 않습니다/);
  });

  it("기후 패턴 반영: 서리민감·내한 약 작물은 제주/남부가 강원보다 적합", () => {
    const r = buildCropRegionFit("blueberry"); // coldTolerance medium·frostSensitivity high
    const rank = { ok: 0, watch: 1, risk: 2, unknown: 3 } as const;
    const jeju = r.regions.find((x) => x.sido === "제주")!;
    const gw = r.regions.find((x) => x.sido === "강원")!;
    expect(rank[jeju.fit]).toBeLessThanOrEqual(rank[gw.fit]); // 제주가 강원보다 같거나 더 적합
  });

  it("레드팀 F1 반영: 서리축 평가(겨울최저 근사) — 서리민감 작물은 한랭 시도에서 강등·사유 노출", () => {
    const gw = buildCropRegionFit("blueberry").regions.find((x) => x.sido === "강원")!; // 겨울최저 -12 → frost high
    expect(gw.fit).not.toBe("ok");                              // 서리 미평가로 '적합' 숨기지 않음
    expect(gw.reasons.some((s) => s.includes("서리"))).toBe(true); // 서리 사유 실제 노출
  });

  it("온난화 시나리오: 미래 적합(fitFuture)·shift 산출 — 서리민감 작물은 한랭 시도 완화(개선)", () => {
    const now = buildCropRegionFit("blueberry");
    expect(now.deltaC).toBe(0);
    expect(now.regions.every((r) => r.fitFuture === undefined)).toBe(true); // 현재만(미래 없음)

    const fut = buildCropRegionFit("blueberry", { deltaTempCOverride: 2.5 }); // 중간 온난화: 서리 완화 > 고온
    expect(fut.deltaC).toBe(2.5);
    const rank = { ok: 0, watch: 1, risk: 2, unknown: 3 } as const;
    const gw = fut.regions.find((r) => r.sido === "강원")!;
    expect(gw.fitFuture).toBeTruthy();
    expect(rank[gw.fitFuture!]).toBeLessThanOrEqual(rank[gw.fit]); // 한랭지는 서리 완화로 같거나 개선
    expect(fut.regions.some((r) => r.shift === "개선")).toBe(true); // 어딘가 적합 개선
    expect(fut.disclaimer).toMatch(/온난화|외삽/);
  });

  it("온난화 양방향(생육 적합 이동): 냉량성 작물(사과)은 더운 시도에서 고온으로 악화 — 재배지 북상", () => {
    const fut = buildCropRegionFit("apple", { deltaTempCOverride: 4 }); // 강한 온난화
    expect(fut.deltaC).toBe(4);
    expect(fut.regions.some((r) => r.shift === "악화")).toBe(true); // 더운 남부 시도 고온해 → 악화(범위 축소)
  });

  it("unknown cropId → throw(호출측 400)", () => {
    expect(() => buildCropRegionFit("zzz_unknown")).toThrow();
  });
});

describe("region-fit route", () => {
  function mockRes() {
    const c = { code: 0, body: "" };
    const res = { setHeader() {}, writeHead(x: number) { c.code = x; return res; }, end(s?: string) { c.body = s ?? ""; }, captured: c };
    return res as unknown as http.ServerResponse & { captured: typeof c };
  }
  const ctx = createContext(loadConfig());
  const req = { method: "GET", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as unknown as http.IncomingMessage;
  it("무료 200 + 시도 적합", async () => {
    const res = mockRes();
    await route(ctx, req, res, new URL("http://localhost/api/region-fit?cropId=rice"));
    expect(res.captured.code).toBe(200);
    expect(JSON.parse(res.captured.body).regionFit.regions.length).toBe(17);
  });
  it("형식 위반 cropId → 400", async () => {
    const res = mockRes();
    await route(ctx, req, res, new URL("http://localhost/api/region-fit?cropId=DROP"));
    expect(res.captured.code).toBe(400);
  });
  it("온난화 쿼리(year·path) → deltaC>0 + 시도별 fitFuture 포함", async () => {
    const res = mockRes();
    await route(ctx, req, res, new URL("http://localhost/api/region-fit?cropId=blueberry&year=2090&path=ssp585"));
    const rf = JSON.parse(res.captured.body).regionFit;
    expect(rf.deltaC).toBeGreaterThan(0);
    expect(rf.regions.some((r: any) => r.fitFuture)).toBe(true);
  });
});
