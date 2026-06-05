import type {
  CropCandidateResult,
  LandInput,
  LansmarkSimulationResult,
  SimulationInput,
} from "./types";

export interface FreeCandidatesResponse {
  ok: true;
  mode: "free";
  paywallAfter: string;
  candidates: CropCandidateResult[];
}
export interface PaidSimulationResponse {
  ok: true;
  mode: "paid_simulation";
  userId: string;
  result: LansmarkSimulationResult;
}
export interface ApiErrorResponse {
  ok: false;
  error: string;
}

export class LansmarkApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "LansmarkApiError";
    this.status = status;
  }
}

/** 무료: 작물 후보 TOP-N */
export async function callFreeCandidates(
  land: LandInput,
  limit?: number,
  baseUrl = ""
): Promise<FreeCandidatesResponse> {
  const res = await fetch(`${baseUrl}/api/lansmark/free-candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ land, limit }),
  });
  const json = (await res.json()) as FreeCandidatesResponse | ApiErrorResponse;
  if (!json.ok) throw new LansmarkApiError(res.status, json.error);
  return json;
}

/** 유료: 전체 시뮬레이션 (entitlement 토큰 필수) */
export async function callPaidSimulation(
  input: SimulationInput,
  entitlementToken: string,
  baseUrl = ""
): Promise<PaidSimulationResponse> {
  const res = await fetch(`${baseUrl}/api/lansmark/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lansmark-entitlement": entitlementToken,
    },
    body: JSON.stringify({ input }),
  });
  const json = (await res.json()) as PaidSimulationResponse | ApiErrorResponse;
  if (!json.ok) throw new LansmarkApiError(res.status, json.error);
  return json;
}
