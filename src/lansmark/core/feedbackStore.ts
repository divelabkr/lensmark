/**
 * 플라이휠 데이터 저장소: 예측↔실측 outcome 기록.
 * ★ 운영: InMemory 대신 Firestore/Postgres 어댑터로 교체(FeedbackStore 구현).
 */
export interface OutcomeRecord {
  cropId: string;
  region?: string;
  terrainBucket?: string;        // 확장용: "slope:lo|aspect:S"
  userId?: string;               // 실측 제출 주체(엔티틀먼트 userId) — validated는 '서로 다른 주체 수'로 판정(자기검증 위조 차단)
  predictedYieldKg: number;
  predictedCostKrw: number;
  predictedRevenueKrw: number;
  actualYieldKg?: number;
  actualCostKrw?: number;
  actualRevenueKrw?: number;
  createdAt?: string;
}

export interface FeedbackStore {
  add(rec: OutcomeRecord): void | Promise<void>;
  query(cropId: string, region?: string): OutcomeRecord[] | Promise<OutcomeRecord[]>;
}

export class InMemoryFeedbackStore implements FeedbackStore {
  private rows: OutcomeRecord[] = [];
  constructor(private readonly maxRows = 20_000) {} // 메모리 고갈 DoS 방지(레드팀 M9). 운영은 repository.ts(DB)로 교체.
  add(rec: OutcomeRecord): void {
    this.rows.push({ ...rec, createdAt: rec.createdAt ?? new Date().toISOString() });
    if (this.rows.length > this.maxRows) this.rows.splice(0, this.rows.length - this.maxRows); // 오래된 행부터 제거
  }
  query(cropId: string, region?: string): OutcomeRecord[] {
    return this.rows.filter((r) => r.cropId === cropId && (region == null || r.region === region));
  }
  all(): OutcomeRecord[] { return this.rows.slice(); }
}

/** 지형 → 버킷 키 (경사/향/표고 구간) */
export function terrainBucketOf(t: { slopeDegree?: number; aspect?: string; altitudeM?: number }): string {
  const s = t.slopeDegree ?? 0, slope = s <= 5 ? "flat" : s <= 12 ? "gentle" : "steep";
  const a = t.aspect, aspect = (a === "S" || a === "SE" || a === "SW") ? "S" : (a === "E" || a === "W") ? "EW" : (a === "N" || a === "NE" || a === "NW") ? "N" : "flat";
  const h = t.altitudeM ?? 0, alt = h <= 200 ? "low" : h <= 450 ? "mid" : "high";
  return `s:${slope}|a:${aspect}|h:${alt}`;
}

/** 저장된 예측 + 사용자 실측(FeedbackInput) → OutcomeRecord */
export function toOutcomeRecord(
  pred: { cropId: string; region?: string; userId?: string; terrain?: { slopeDegree?: number; aspect?: string; altitudeM?: number }; yieldKg: number; costKrw: number; revenueKrw: number },
  actual: { actualYieldKg?: number; actualCostKrw?: number; actualRevenueKrw?: number }
): OutcomeRecord {
  return {
    cropId: pred.cropId, region: pred.region, userId: pred.userId,
    terrainBucket: pred.terrain ? terrainBucketOf(pred.terrain) : undefined,
    predictedYieldKg: pred.yieldKg, predictedCostKrw: pred.costKrw, predictedRevenueKrw: pred.revenueKrw,
    ...actual,
  };
}
