/**
 * /api/simulate 입력 하드닝: 검증·정규화·클램프 + 서버 신뢰경계.
 *  - 클라이언트가 보낸 calibration/climate는 신뢰하지 않는다(서버가 계산·주입).
 *  - 지형/위성 컨텍스트는 enum·유한수로 sanitize (NaN/Infinity/폭주값 차단).
 *  - cropId·면적·enum은 validateSimulationInput으로 검증(미존재 cropId면 throw).
 */
import type { ParcelInput } from "../core/parcelSimulator";
import type { FactorContext } from "../core/factors";
import type { TerrainInput, Aspect } from "../core/terrain";
import type { SatelliteObs } from "../core/satellite";
import type { WarmingScenario, EmissionPath } from "../types";
import { validateSimulationInput } from "../core/validate";

const ASPECTS: Aspect[] = ["S", "SE", "SW", "E", "W", "N", "NE", "NW", "flat"];
const EMISSION: EmissionPath[] = ["ssp245", "ssp585"];

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function clampFinite(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined; // NaN/Infinity 제거 + 폭주값 클램프
}

export function sanitizeTerrain(raw: unknown): TerrainInput | undefined {
  if (!isObject(raw)) return undefined;
  const t: TerrainInput = {};
  const slope = clampFinite(raw.slopeDegree, 0, 90);
  if (slope !== undefined) t.slopeDegree = slope;
  const alt = clampFinite(raw.altitudeM, -500, 9000);
  if (alt !== undefined) t.altitudeM = alt;
  if (typeof raw.aspect === "string" && ASPECTS.includes(raw.aspect as Aspect)) t.aspect = raw.aspect as Aspect;
  t.source = raw.source === "dem" ? "dem" : "manual";
  return t;
}

export function sanitizeSatellite(raw: unknown): SatelliteObs | undefined {
  if (!isObject(raw)) return undefined;
  const rel = raw.ndviRelative;
  return {
    observed: raw.observed === true,
    ndviRelative: rel === "low" || rel === "high" || rel === "similar" ? rel : undefined,
    frostPocket: raw.frostPocket === true,
    waterlogging: raw.waterlogging === true,
    source: "client", // 클라 입력은 항상 비신뢰 출처 — 신뢰도 상향(confidenceBoost) 불가(레드팀 M6). 실관측은 서버 파이프라인이 주입.
  };
}

/** 클라이언트 컨텍스트 정규화. climate는 서버 provider가 주입하므로 클라이언트 값은 무시한다. */
export function sanitizeContext(raw: unknown): FactorContext {
  if (!isObject(raw)) return {};
  const ctx: FactorContext = {};
  const t = sanitizeTerrain(raw.terrain);
  if (t) ctx.terrain = t;
  const s = sanitizeSatellite(raw.satellite);
  if (s) ctx.satellite = s;
  return ctx;
}

/** 온난화 시나리오 sanitize — 연도 2025~2100·경로 enum·ΔT override 0~6 클램프. 전부 무효면 undefined. */
function sanitizeScenario(raw: unknown): WarmingScenario | undefined {
  if (!isObject(raw)) return undefined;
  const s: WarmingScenario = {};
  const y = clampFinite(raw.year, 2025, 2100); if (y !== undefined) s.year = Math.round(y);
  if (typeof raw.path === "string" && EMISSION.includes(raw.path as EmissionPath)) s.path = raw.path as EmissionPath;
  const dt = clampFinite(raw.deltaTempCOverride, 0, 6); if (dt !== undefined) s.deltaTempCOverride = dt;
  return (s.year != null || s.path || s.deltaTempCOverride != null) ? s : undefined;
}

/** 원시 JSON → 검증·정규화된 ParcelInput. 잘못된 입력이면 ValidationError(또는 cropId Error) throw. */
export function buildParcelInput(raw: unknown): ParcelInput {
  const safe = validateSimulationInput(raw); // land/면적/cropId/enum 검증·클램프
  const region = isObject(raw) && typeof raw.region === "string" ? raw.region.slice(0, 120) : undefined;
  const context = sanitizeContext(isObject(raw) ? raw.context : undefined);
  const climateScenario = sanitizeScenario(isObject(raw) ? raw.climateScenario : undefined); // 지구온난화 가정(미지정=현재)
  return { ...safe, region, context, climateScenario }; // calibration/kamisPrice는 클라이언트에서 받지 않음(서버 계산)
}
