import { LANSMARK_CONFIG } from "../config";
import type { ConfidenceGrade, SoilEvidenceInput } from "../types";

/**
 * 제한 소일 API(흙토람/토양도/토양검정 등) fail-closed 게이트.
 * (상업적 이용 허가 AND 호출 활성화) 둘 다 true일 때만 허용. 그 외 전부 차단.
 * 반드시 실제 제한 API 호출 직전 단 한 곳(fetchRestrictedSoilEvidence)에서만 거친다.
 */
export function assertRestrictedSoilApiAllowed(): void {
  const { toramCommercialPermission, toramApiCallEnabled } = LANSMARK_CONFIG.soil;
  if (!toramCommercialPermission || !toramApiCallEnabled) {
    throw new Error(
      "Restricted soil API blocked (fail-closed): requires TORAM_COMMERCIAL_PERMISSION=true AND TORAM_API_CALL_ENABLED=true."
    );
  }
}

/**
 * 제한 소일 API 호출의 유일한 통로(chokepoint).
 * 실제 흙토람/토양 API fetch는 반드시 이 함수 안에서만 구현한다.
 * 지금은 미구현 — 호출 시 fail-closed로 차단된다.
 */
export async function fetchRestrictedSoilEvidence(_pnu: string): Promise<SoilEvidenceInput> {
  assertRestrictedSoilApiAllowed();
  // TODO: 상업적 이용 허가 확보 후 실제 API 연동 구현
  throw new Error("fetchRestrictedSoilEvidence not implemented.");
}

export function getSoilConfidence(soil?: SoilEvidenceInput): ConfidenceGrade {
  if (!soil || soil.source === "none") return "D";
  if (soil.source === "official_soil_test") return "A";
  if (soil.source === "old_soil_test") return "B";
  if (soil.source === "manual_input") return "C";
  if (soil.source === "global_estimate") return "D";
  return "D";
}

export function getSoilMissingFields(soil?: SoilEvidenceInput): string[] {
  const missing: string[] = [];
  if (!soil || soil.source === "none") {
    return ["토양검정서", "pH", "유기물", "EC", "유효인산", "칼륨", "칼슘", "마그네슘"];
  }
  if (soil.ph === undefined) missing.push("pH");
  if (soil.organicMatterGkg === undefined) missing.push("유기물");
  if (soil.ecDsM === undefined) missing.push("EC");
  if (soil.p2o5MgKg === undefined) missing.push("유효인산");
  if (soil.potassiumCmolKg === undefined) missing.push("칼륨");
  if (soil.calciumCmolKg === undefined) missing.push("칼슘");
  if (soil.magnesiumCmolKg === undefined) missing.push("마그네슘");
  return missing;
}
