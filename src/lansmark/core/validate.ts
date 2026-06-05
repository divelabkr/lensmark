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

function requireArea(raw: unknown): number {
  const area = finiteNum(raw);
  if (area === undefined || area <= 0) {
    throw new ValidationError("areaM2 is required and must be a finite number greater than 0.");
  }
  if (area > MAX_AREA_M2) {
    throw new ValidationError(`areaM2 exceeds maximum (${MAX_AREA_M2}).`);
  }
  return area;
}

export function validateLandInput(raw: unknown): LandInput {
  if (!isObject(raw)) throw new ValidationError("land object is required.");
  const areaM2 = requireArea(raw.areaM2);

  if (raw.polygonGeoJson !== undefined) {
    try {
      if (JSON.stringify(raw.polygonGeoJson).length > MAX_GEOJSON_BYTES) {
        throw new ValidationError("polygonGeoJson is too large.");
      }
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError("polygonGeoJson is not serializable.");
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
  if (!isObject(raw)) throw new ValidationError("input object is required.");

  const land = validateLandInput(raw.land);

  const cropId = typeof raw.cropId === "string" ? raw.cropId : "";
  if (!cropId) throw new ValidationError("cropId is required.");
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
