import type { CultivationType, LandInput, SalesChannel, SimulationInput } from "../types";
import { getCropProfile } from "../data/crops.seed";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const MAX_AREA_M2 = 1_000_000;          // 100ha 상한
const MAX_PRICE_KRW_PER_KG = 1_000_000;
const MAX_COST_KRW = 100_000_000_000;
const MAX_PLANTING_COUNT = 10_000_000;
const MAX_GEOJSON_BYTES = 200_000;      // polygon 폭탄 방지

const CULTIVATION_TYPES: CultivationType[] = ["open_field", "greenhouse", "semi_facility"];
const SALES_CHANNELS: SalesChannel[] = ["wholesale", "direct", "experience_farm", "processed", "mixed"];
const TARGET_YEARS = ["year1", "year2", "year3", "mature"] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function finiteNum(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined; // NaN/Infinity 제거
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// 검증 실패 문구는 사용자(귀농 농부)에게 400 응답으로 그대로 노출 — 영어 금지·복구 힌트 포함(한국어 일관성, UX 감사 2026-06-12).
function requireArea(raw: unknown): number {
  const area = finiteNum(raw);
  if (area === undefined || area <= 0) {
    throw new ValidationError("면적(㎡)을 0보다 크게 입력해 주세요. (예: 1,000평 ≈ 3,300㎡)");
  }
  if (area > MAX_AREA_M2) {
    throw new ValidationError(`면적이 너무 큽니다 — 최대 ${(MAX_AREA_M2 / 10000).toLocaleString()}ha(약 ${Math.round(MAX_AREA_M2 / 3.305785).toLocaleString()}평)까지 시뮬레이션할 수 있어요.`);
  }
  return area;
}

export function validateLandInput(raw: unknown): LandInput {
  if (!isObject(raw)) throw new ValidationError("땅 정보(land)가 필요합니다 — 지도에서 필지를 먼저 선택해 주세요.");
  const areaM2 = requireArea(raw.areaM2);

  if (raw.polygonGeoJson !== undefined) {
    try {
      if (JSON.stringify(raw.polygonGeoJson).length > MAX_GEOJSON_BYTES) {
        throw new ValidationError("필지 경계 데이터가 너무 큽니다 — 필지를 다시 선택해 주세요.");
      }
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError("필지 경계 데이터 형식이 올바르지 않습니다 — 필지를 다시 선택해 주세요.");
    }
  }
  // 나머지 필드는 enum/타입 기반 저위험 → 그대로 통과
  return { ...raw, areaM2 } as unknown as LandInput;
}

export function clampCandidateLimit(raw: unknown, fallback: number): number {
  const n = finiteNum(raw);
  if (n === undefined) return clamp(fallback, 1, 20);
  return clamp(Math.floor(n), 1, 20);
}

export function validateSimulationInput(raw: unknown): SimulationInput {
  if (!isObject(raw)) throw new ValidationError("요청 형식이 올바르지 않습니다 — 새로고침 후 다시 시도해 주세요.");

  const land = validateLandInput(raw.land);

  const cropId = typeof raw.cropId === "string" ? raw.cropId : "";
  if (!cropId) throw new ValidationError("작물을 먼저 선택해 주세요.");
  getCropProfile(cropId); // 미존재 cropId면 throw

  const cultivationType: CultivationType = CULTIVATION_TYPES.includes(raw.cultivationType as CultivationType)
    ? (raw.cultivationType as CultivationType)
    : "open_field";
  const salesChannel: SalesChannel = SALES_CHANNELS.includes(raw.salesChannel as SalesChannel)
    ? (raw.salesChannel as SalesChannel)
    : "mixed";
  const targetYear = TARGET_YEARS.includes(raw.targetYear as (typeof TARGET_YEARS)[number])
    ? (raw.targetYear as (typeof TARGET_YEARS)[number])
    : undefined;
  const cultivarGroupId = typeof raw.cultivarGroupId === "string" ? raw.cultivarGroupId : undefined;

  const upc = finiteNum(raw.userPlantingCount);
  const userPlantingCount = upc === undefined ? undefined : clamp(upc, 0, MAX_PLANTING_COUNT);
  const uop = finiteNum(raw.userOverridePriceKrwPerKg);
  const userOverridePriceKrwPerKg = uop === undefined ? undefined : clamp(uop, 0, MAX_PRICE_KRW_PER_KG);
  const uoc = finiteNum(raw.userOverrideCostKrw);
  const userOverrideCostKrw = uoc === undefined ? undefined : clamp(uoc, 0, MAX_COST_KRW);

  return {
    land, cropId, cultivarGroupId, cultivationType, salesChannel, targetYear,
    userPlantingCount, userOverridePriceKrwPerKg, userOverrideCostKrw,
  };
}
