import type { CropProfile } from "../types";
import { getCropProfile } from "../data/crops.seed";

export type Aspect = "S" | "SE" | "SW" | "E" | "W" | "N" | "NE" | "NW" | "flat";
export interface TerrainInput {
  slopeDegree?: number;
  aspect?: Aspect;
  altitudeM?: number;
  source?: "dem" | "manual";
}
export interface Factor { axis: string; target: "yield" | "cost"; value: number; reason: string; }

const isFruit = (c: CropProfile) => c.category === "fruit";
const r2 = (n: number) => Math.round(n * 100) / 100;

export function terrainFactors(cropId: string, t?: TerrainInput): Factor[] {
  if (!t) return [];
  const c = getCropProfile(cropId);
  const out: Factor[] = [];

  if (t.slopeDegree != null) {
    const max = c.requirements.suitableSlopeMaxDegree ?? 12;
    const s = t.slopeDegree;
    let yf = 1.0, cf = 1.0, reason = "";
    if (s <= max * 0.5) { yf = 1.0; reason = `경사 ${s}° — 평탄(허용 ${max}° 내)`; }
    else if (s <= max) { yf = isFruit(c) ? 1.0 : 0.95; cf = 1.05; reason = `경사 ${s}° — 완경사`; }
    else if (s <= max * 2) { yf = isFruit(c) ? 0.92 : 0.85; cf = 1.15; reason = `경사 ${s}° — 허용(${max}°) 초과, 작업·유실 리스크`; }
    else { yf = 0.7; cf = 1.3; reason = `경사 ${s}° — 급경사, 부적합 우려`; }
    out.push({ axis: "지형·경사", target: "yield", value: yf, reason });
    if (cf !== 1.0) out.push({ axis: "지형·경사", target: "cost", value: cf, reason: `${reason} → 작업비 보정` });
  }

  if (t.aspect && t.aspect !== "flat") {
    const a = t.aspect;
    let yf = 1.0, reason = "";
    if (a === "S" || a === "SE" || a === "SW") { yf = 1.0; reason = `${a} 향 — 일조 양호`; }
    else if (a === "E" || a === "W") { yf = 0.97; reason = `${a} 향 — 일조 보통`; }
    else { yf = 0.92; reason = `${a} 향 — 일조 부족(북사면)`; }
    out.push({ axis: "지형·향", target: "yield", value: yf, reason });
  }

  if (t.altitudeM != null) {
    const delta = (t.altitudeM - 200) / 100; // 기준 200m, 100m 단위
    if (delta > 0) {
      const yf = Math.max(0.8, 1 - delta * 0.025);
      if (yf < 0.999) out.push({ axis: "지형·표고", target: "yield", value: r2(yf), reason: `표고 ${t.altitudeM}m — 기온감률 약 ${(delta * 0.55).toFixed(1)}℃↓, 생육기간 단축` });
    }
  }
  return out;
}
