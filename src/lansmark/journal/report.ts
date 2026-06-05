/**
 * 재배 일지 → 시즌 리포트(순수 함수) — "얼마나·어떻게 이용했고, 어떻게 수익을 냈나"의 집계.
 *   책임: 저장된 JournalEntry 1건을 받아 요약 지표만 계산한다(부수효과 없음 · 결정적 · 테스트 용이).
 *   가드레일: 수익 "보장"이 아니라 사용자 입력 기록의 요약 · 투입비는 기록된 작업비만(감가·고정비 제외) · 면책 동봉.
 */
import type { JournalEntry, JournalEventKind, JournalStatus } from "./types";

/** 예측 대비 실측 오차(%) — 해자 신뢰도 신호. 예측이 0/누락이면 항목 생략. */
export interface JournalAccuracy {
  yieldErrPct?: number;   // (실측-예측)/예측 × 100 (양수=예측보다 많이 남)
  revenueErrPct?: number;
  costErrPct?: number;    // ※ 기록된 작업 투입비 기준(전체 원가 아님)
}

/** 시즌 리포트(프론트 표시·PDF용). */
export interface JournalReport {
  entryId: string;
  cropId: string;
  variety?: string;
  region?: string;
  status: JournalStatus;
  // 기간
  startedAt?: string;        // plantedAt ?? createdAt
  endedAt?: string;          // harvest.at (수확 전이면 미정)
  durationDays?: number;     // startedAt→endedAt (둘 다 유효 날짜일 때만)
  // 투입 집계
  eventCount: number;
  eventsByKind: Record<string, number>;  // 작업 종류별 횟수
  totalInputCostKrw: number;              // events.costKrw 합(기록분)
  totalLaborHours: number;                // events.laborHours 합(기록분)
  // 수확 · 수익
  harvested: boolean;
  yieldKg?: number;
  revenueKrw?: number;
  netProfitKrw?: number;     // revenueKrw - totalInputCostKrw (기록된 투입비 기준 · 면책 참조)
  yieldPerAreaKgM2?: number; // 단위면적 수확량(areaM2 있을 때)
  salesChannel?: string;
  // 예측 대비(예측 baseline이 있을 때만)
  accuracy?: JournalAccuracy;
  disclaimer: string;
}

/** 소수 1자리 반올림(퍼센트 표시 노이즈 제거). */
function round1(n: number): number { return Math.round(n * 10) / 10; }

/** 두 ISO 날짜 사이 일수(둘 다 파싱 가능할 때만, 음수 방지). 파싱 실패 시 undefined. */
function daysBetween(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined;
  const ta = Date.parse(a), tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return undefined;
  return Math.max(0, Math.round((tb - ta) / 86_400_000)); // ms/day
}

/** 예측 대비 오차(%). 예측치가 0 이하/비유한이면 생략(0으로 나누기·무의미 비교 차단). */
function errPct(actual: number | undefined, predicted: number | undefined): number | undefined {
  if (actual == null || predicted == null) return undefined;
  if (!Number.isFinite(actual) || !Number.isFinite(predicted) || predicted <= 0) return undefined;
  return round1(((actual - predicted) / predicted) * 100);
}

const DISCLAIMER =
  "이 리포트는 사용자가 입력한 기록을 요약한 것입니다. 투입비는 기록된 작업 비용만 반영하며(감가상각·토지·고정비 제외), " +
  "수익은 보장이 아닙니다. 예측 대비 오차는 참고용 신뢰도 신호입니다.";

/**
 * JournalEntry → JournalReport. 순수 함수: 동일 입력 → 동일 출력(테스트/PDF 결정성).
 *   ⚠ "now"를 쓰지 않는다 — 기간은 기록된 날짜(plantedAt·harvest.at)로만 계산해 결정성을 보장.
 */
export function buildJournalReport(entry: JournalEntry): JournalReport {
  const events = Array.isArray(entry.events) ? entry.events : [];

  // 작업 종류별 횟수 + 투입(비용·노동) 합계 — 한 번 순회로 집계.
  const eventsByKind: Record<string, number> = {};
  let totalInputCostKrw = 0, totalLaborHours = 0;
  for (const e of events) {
    const kind = (e?.kind ?? "other") as JournalEventKind;
    eventsByKind[kind] = (eventsByKind[kind] ?? 0) + 1;
    if (Number.isFinite(e?.costKrw)) totalInputCostKrw += Math.max(0, e!.costKrw as number);
    if (Number.isFinite(e?.laborHours)) totalLaborHours += Math.max(0, e!.laborHours as number);
  }
  totalInputCostKrw = Math.round(totalInputCostKrw);
  totalLaborHours = round1(totalLaborHours);

  const startedAt = entry.plantedAt ?? entry.createdAt;
  const endedAt = entry.harvest?.at;
  const durationDays = daysBetween(startedAt, endedAt);

  const harvested = !!entry.harvest;
  const yieldKg = entry.harvest?.yieldKg;
  const revenueKrw = entry.harvest?.revenueKrw;

  // 순수익 = 실매출 - 기록된 투입비(작업비 기준 · 면책에 명시). 매출 미기록이면 미정.
  const netProfitKrw = revenueKrw != null && Number.isFinite(revenueKrw)
    ? Math.round(revenueKrw - totalInputCostKrw)
    : undefined;

  // 단위면적 수확량(kg/m²) — 면적이 양수일 때만.
  const yieldPerAreaKgM2 = (yieldKg != null && entry.areaM2 && entry.areaM2 > 0)
    ? round1(yieldKg / entry.areaM2)
    : undefined;

  // 예측 대비 정확도(예측 baseline이 있을 때만) — 해자 신뢰도 신호.
  let accuracy: JournalAccuracy | undefined;
  if (entry.predicted) {
    const a: JournalAccuracy = {
      yieldErrPct: errPct(yieldKg, entry.predicted.yieldKg),
      revenueErrPct: errPct(revenueKrw, entry.predicted.revenueKrw),
      costErrPct: errPct(totalInputCostKrw, entry.predicted.costKrw),
    };
    // 셋 다 생략되면 accuracy 자체를 비워 화면 잡음 제거.
    if (a.yieldErrPct != null || a.revenueErrPct != null || a.costErrPct != null) accuracy = a;
  }

  return {
    entryId: entry.id,
    cropId: entry.cropId,
    variety: entry.variety,
    region: entry.region,
    status: entry.status,
    startedAt, endedAt, durationDays,
    eventCount: events.length,
    eventsByKind,
    totalInputCostKrw, totalLaborHours,
    harvested, yieldKg, revenueKrw, netProfitKrw, yieldPerAreaKgM2,
    salesChannel: entry.harvest?.salesChannel,
    accuracy,
    disclaimer: DISCLAIMER,
  };
}
