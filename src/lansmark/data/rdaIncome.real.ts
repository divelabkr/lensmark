/**
 * RDA 실 소득자료 테이블 — ⚠ 이 파일은 `npm run rda:build <csv>`가 재생성한다(수동 편집 금지).
 *   비어 있으면 getRdaBase가 데모값(verified=false)으로 폴백 — 실자료 수령 전 상태.
 *   채워지면 verified=true·baseYear·출처가 시뮬 결과에 표기된다(가드레일 '출처·연도').
 */
import type { RdaRealRow } from "./rdaRealLoader";

export const RDA_REAL: Record<string, RdaRealRow> = {};

/** 실자료 메타(빌드 시 기록) — ops/health 노출용. null=실자료 미적재(데모). */
export const RDA_REAL_META: { builtAt: string; rows: number; baseYears: number[] } | null = null;
