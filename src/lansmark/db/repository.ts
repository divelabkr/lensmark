import type { FeedbackInput, LansmarkSimulationResult, SimulationInput, SoilEvidenceInput } from "../types";

/**
 * Prisma 클라이언트(또는 호환 객체) 주입형 리포지토리.
 * DB 연결/마이그레이션은 호출측 책임(seam). prisma 의존성을 모듈에 박지 않는다.
 */
export interface LansmarkPrisma {
  lansmarkSimulationRun: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  lansmarkSoilEvidence: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  lansmarkFeedbackLog: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
}

export function createRepository(prisma: LansmarkPrisma) {
  return {
    saveSimulationRun(p: { userId?: string; cropId: string; cultivarGroupId?: string; input: SimulationInput; result: LansmarkSimulationResult; paid: boolean }) {
      return prisma.lansmarkSimulationRun.create({ data: {
        userId: p.userId ?? null, cropId: p.cropId, cultivarGroupId: p.cultivarGroupId ?? null,
        inputJson: p.input as unknown as Record<string, unknown>,
        resultJson: p.result as unknown as Record<string, unknown>,
        confidence: p.result.confidence, paid: p.paid,
      } });
    },
    saveSoilEvidence(userId: string | undefined, soil: SoilEvidenceInput, confidence: string) {
      return prisma.lansmarkSoilEvidence.create({ data: {
        userId: userId ?? null, source: soil.source, ph: soil.ph ?? null,
        organicMatterGkg: soil.organicMatterGkg ?? null, ecDsM: soil.ecDsM ?? null,
        p2o5MgKg: soil.p2o5MgKg ?? null, potassiumCmolKg: soil.potassiumCmolKg ?? null,
        calciumCmolKg: soil.calciumCmolKg ?? null, magnesiumCmolKg: soil.magnesiumCmolKg ?? null,
        texture: soil.texture ?? null, drainageClass: soil.drainageClass ?? null,
        fileUrl: soil.fileUrl ?? null, testedAt: soil.testedAt ? new Date(soil.testedAt) : null, confidence,
      } });
    },
    saveFeedback(f: FeedbackInput) {
      return prisma.lansmarkFeedbackLog.create({ data: {
        userId: f.userId ?? null, simulationRunId: f.simulationRunId ?? null, cropId: f.cropId ?? null,
        actualYieldKg: f.actualYieldKg ?? null, actualRevenueKrw: f.actualRevenueKrw ?? null,
        actualCostKrw: f.actualCostKrw ?? null, notes: f.notes ?? null,
      } });
    },
  };
}
