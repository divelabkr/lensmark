/**
 * 전 작물 가드레일 회귀 스윕 — 품질 하네스 Phase 1 최소 코어(docs/QUALITY_REDTEAM.md S3·로드맵).
 *   왜: parcelEngine.spec은 단조성·손실하한을 5작물만 루프 검사 → CROP_PROFILES 17작물 중 다수가 미검사
 *       (새 작물 추가 시 가드레일이 깨져도 회귀로 안 잡히는 드리프트 갭).
 *   해법: CROP_PROFILES 전 작물을 결정적 엔진(oracle) 대비 핵심 가드레일로 스윕 — 작물 추가 시 자동 포함.
 *   원칙(QUALITY_REDTEAM §2): oracle = 결정적 엔진(runParcelSimulation), LLM 판정 없음. 오프라인·라이브 0.
 *   검사는 '수치 정확성'이 아니라 '가드레일 준수'(crops.seed 경제성은 목업·런칭 전 보정=별도 HUMAN GATE).
 */
import { describe, it, expect } from "vitest";
import { CROP_PROFILES } from "../data/crops.seed";
import { getDefaultDisclaimers } from "../policy/disclaimer";
import { runParcelSimulation, type ParcelInput } from "../core/parcelSimulator";

const base = (cropId: string): ParcelInput => ({
  land: { areaM2: 3300, soilEvidence: { source: "none" } },
  cropId, cultivationType: "open_field", salesChannel: "mixed",
});
// 모든 SigmaRange 출력(단일값 금지·P10≤P50≤P90 가드레일 대상)
const RANGES = ["yieldKg", "costKrw", "priceKrwPerKg", "revenueKrw", "incomeKrw"] as const;

describe("전 작물 가드레일 회귀 스윕(품질 하네스 P1 · oracle=엔진)", () => {
  const ids = CROP_PROFILES.map((p) => p.cropId);

  it(`cold-start 전 작물(${ids.length}종): 단조성·손실하한·면책·출처·라벨 가드레일 위반 0`, () => {
    expect(ids.length).toBeGreaterThanOrEqual(17); // 회귀: 작물 수 축소(시드 손상) 감지
    for (const cropId of ids) {
      const r = runParcelSimulation(base(cropId));
      // ① 범위 단조성(단일값 금지) — 모든 SigmaRange에서 P10≤P50≤P90
      for (const k of RANGES) {
        expect(r[k].p10, `${cropId}.${k}: p10≤p50 위반`).toBeLessThanOrEqual(r[k].p50);
        expect(r[k].p50, `${cropId}.${k}: p50≤p90 위반`).toBeLessThanOrEqual(r[k].p90);
      }
      // ② 불가능 손실 하한 — 매출 0 − 최악 경영비보다 더 음수일 수 없음
      expect(r.incomeKrw.p10, `${cropId}: 손실하한 위반`).toBeGreaterThanOrEqual(-r.costKrw.p90);
      // ③ 면책 동반(1원칙) — 공유 프리미티브 전부 포함
      for (const d of getDefaultDisclaimers()) expect(r.disclaimers, `${cropId}: 면책 누락`).toContain(d);
      // ④ 근거=출처(baseSource) 동반 — 출처 없는 소득 차단(cold-start의 '근거'는 base 출처. 보정 근거 factors는 context 의존 → 아래 it)
      expect(!!(r.baseSource && r.baseSource.length), `${cropId}: 출처(근거) 누락`).toBe(true);
      // ⑤ 데이터 라벨 정직(validated|estimated만 — 임의 라벨 차단)
      expect(["validated", "estimated"], `${cropId}: dataLabel`).toContain(r.dataLabel);
    }
  });

  it(`전 작물 + 지형 context → 보정 근거(factors)가 reason과 함께 생성된다`, () => {
    const context = { terrain: { slopeDegree: 5, aspect: "S" as const, altitudeM: 100 } };
    for (const cropId of ids) {
      const r = runParcelSimulation({ ...base(cropId), context });
      expect(r.factors.length, `${cropId}: 보정 근거 없음`).toBeGreaterThan(0);
      expect(r.factors.every((f) => f.reason.length > 0), `${cropId}: 빈 reason`).toBe(true);
    }
  });
});
