export type ConfidenceGrade = "A" | "B" | "C" | "D" | "X";

export type SuitabilityLevel =
  | "high"
  | "medium_high"
  | "medium"
  | "conditional"
  | "low"
  | "insufficient_data";

export type DrainageLevel = "good" | "normal" | "poor" | "unknown";
export type WaterAccess = "available" | "limited" | "none" | "unknown";
export type LaborLevel = "low" | "medium" | "high";
export type CultivationType = "open_field" | "greenhouse" | "semi_facility";
export type SalesChannel = "wholesale" | "direct" | "experience_farm" | "processed" | "mixed";

export type EmissionPath = "ssp245" | "ssp585";
/** 지구온난화 시나리오 입력 — ΔT(온난화 폭, ℃)로 재배 적합·소득·시설 냉난방비를 구동. */
export interface WarmingScenario {
  year?: number;                 // 미래 가정 연도(2025~2100). 미지정/기준연도면 ΔT=0(현재 평년)
  path?: EmissionPath;           // 배출 경로(중간 ssp245 / 고배출 ssp585)
  deltaTempCOverride?: number;   // 고급: ΔT 직접 지정(℃) — 있으면 연도·경로 무시
}

export interface LandInput {
  address?: string;
  pnu?: string;
  lat?: number;
  lng?: number;
  polygonGeoJson?: unknown;

  areaM2: number;
  currentLandState?: "field" | "paddy" | "orchard" | "forest" | "idle" | "greenhouse" | "unknown";

  altitudeM?: number;
  slopeDegree?: number;
  annualRainfallMm?: number;
  minWinterTempC?: number;
  frostRisk?: "low" | "medium" | "high" | "unknown";
  sunlightLevel?: "low" | "medium" | "high" | "unknown";

  drainage?: DrainageLevel;
  waterAccess?: WaterAccess;
  machineryAccess?: "good" | "limited" | "none" | "unknown";
  electricityAccess?: "available" | "limited" | "none" | "unknown";
  laborLevel?: LaborLevel;

  preferredDirection?: Array<
    | "easy_management"
    | "high_income"
    | "fruit"
    | "field_crop"
    | "medicinal"
    | "facility"
    | "unknown"
  >;

  soilEvidence?: SoilEvidenceInput;
}

export interface SoilEvidenceInput {
  source: "official_soil_test" | "old_soil_test" | "manual_input" | "global_estimate" | "none";
  testedAt?: string;
  ph?: number;
  organicMatterGkg?: number;
  ecDsM?: number;
  p2o5MgKg?: number;
  potassiumCmolKg?: number;
  calciumCmolKg?: number;
  magnesiumCmolKg?: number;
  texture?: string;
  drainageClass?: string;
  fileUrl?: string;
}

export interface CropProfile {
  cropId: string;
  cropNameKo: string;
  cropNameEn: string;
  category: "field_crop" | "fruit" | "medicinal" | "facility" | "oilseed" | "root" | "vegetable";

  cultivarGroups: CultivarGroup[];
  requirements: CropRequirements;
  economics: CropEconomics;

  riskNotes: string[];
  additionalChecks: string[];
}

export interface CultivarGroup {
  groupId: string;
  nameKo: string;
  description: string;
  tags: string[];
}

export interface CropRequirements {
  phMin?: number;
  phMax?: number;
  drainage: "low" | "medium" | "high";
  waterNeed: "low" | "medium" | "high";
  coldTolerance: "low" | "medium" | "high";
  frostSensitivity: "low" | "medium" | "high";
  sunlightNeed: "low" | "medium" | "high";
  laborNeed: "low" | "medium" | "high";
  facilityRecommended?: boolean;
  suitableSlopeMaxDegree?: number;
}

export interface SigmaRange {
  p10: number;
  p50: number;
  p90: number;
}

export interface CropEconomics {
  plantingDensityPerM2: SigmaRange;
  yieldKgPerM2ByYear: {
    year1: SigmaRange;
    year2?: SigmaRange;
    year3?: SigmaRange;
    mature: SigmaRange;
  };
  costKrwPerM2: SigmaRange;
  priceKrwPerKg: {
    wholesale: SigmaRange;
    direct: SigmaRange;
    experience_farm?: SigmaRange;
    processed?: SigmaRange;
    mixed: SigmaRange;
  };
}

export interface CropCandidateResult {
  cropId: string;
  cropNameKo: string;
  suitability: SuitabilityLevel;
  score: number;
  confidence: ConfidenceGrade;
  cultivarDirections: CultivarGroup[];
  reasons: string[];
  risks: string[];
  requiredChecks: string[];
  blockedBy?: string[];
}

export interface SimulationInput {
  land: LandInput;
  cropId: string;
  cultivarGroupId?: string;
  cultivationType: CultivationType;
  salesChannel: SalesChannel;
  targetYear?: "year1" | "year2" | "year3" | "mature";
  climateScenario?: WarmingScenario; // 지구온난화 가정(미지정=현재 평년)

  userPlantingCount?: number;
  userOverridePriceKrwPerKg?: number;
  userOverrideCostKrw?: number;
}

export interface PlantingCalculation {
  areaM2: number;
  estimatedPlantingCount: SigmaRange;
  selectedPlantingCount: number;
  assumptions: string[];
}

export interface YieldSimulation {
  yieldKg: SigmaRange;
  confidence: ConfidenceGrade;
  adjustmentFactors: SimulationAdjustmentFactor[];
  assumptions: string[];
}

export interface SimulationAdjustmentFactor {
  key: string;
  label: string;
  factor: number;
  reason: string;
}

export interface CostSimulation {
  costKrw: SigmaRange;
  lineItems: CostLineItem[];
  assumptions: string[];
}

export interface CostLineItem {
  key: string;
  label: string;
  value: SigmaRange;
}

export interface RevenueSimulation {
  revenueKrw: SigmaRange;
  priceKrwPerKg: SigmaRange;
  salesChannel: SalesChannel;
  assumptions: string[];
}

export interface IncomeSimulation {
  incomeKrw: SigmaRange;
  breakEvenPriceKrwPerKg: number;
  warnings: string[];
}

export interface GrowthRiskInfo {
  weatherRisks: string[];
  pestRisks: string[];
  disasterRisks: string[];
  nextActions: string[];
}

export interface LansmarkSimulationResult {
  candidate: CropCandidateResult;
  planting: PlantingCalculation;
  yield: YieldSimulation;
  cost: CostSimulation;
  revenue: RevenueSimulation;
  income: IncomeSimulation;
  growthRisk: GrowthRiskInfo;
  confidence: ConfidenceGrade;
  disclaimers: string[];
  nextActions: string[];
}

export interface FeedbackInput {
  userId?: string;
  simulationRunId?: string;
  cropId?: string;
  actualYieldKg?: number;
  actualRevenueKrw?: number;
  actualCostKrw?: number;
  notes?: string;
}
