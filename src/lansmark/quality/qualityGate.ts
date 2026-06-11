/**
 * 데이터 품질 게이트(§신뢰) — '운영 녹색'과 별개로, 넘기는 데이터가 검증/정직한지 차원별로 평가한다.
 *   철학(레드팀 합의):
 *     · '에러 없음'이 아니라 '맞다는 양성 신호'로 채점 — 조용한 mock/데모/미구현은 녹색 아님.
 *     · fail-closed — 모르면 ok 아님(warn). base 미검증이면 dataTrust=unverified(제품이 '✓검증' 차단·'추정' 강제).
 *     · 차원별 범주 게이트(ok/warn/fail)가 본질 · 점수는 머리글 등급(A~D)일 뿐(평균에 디테일 숨기지 않음).
 *     · 탐지형(통합 live 여부) vs 구조형(RDA 데모·DEM REST 미제공)을 구분해 노출.
 *   소비처: OPS 신뢰 피쉬본(가시화) + 제품 자동 보수(앱 결과 배지 게이트).
 *   입력은 기존 신호 집계일 뿐(새 계측 X): integrationReadiness · RDA_REAL_META · flywheel.
 */
export type GateStatus = "ok" | "warn" | "fail";
export type QualityCategory = "source" | "input" | "calibration" | "guardrail";

export interface QualitySource {
  key: string;
  label: string;
  category: QualityCategory;
  status: GateStatus;
  note: string;
}

export interface QualityAssessment {
  grade: "A" | "B" | "C" | "D";                         // 머리글 등급(차원 게이트 롤업)
  dataTrust: "verified" | "estimated" | "unverified";   // 제품 자동 보수의 핵심 verdict
  baseVerified: boolean;                                 // 소득 base(RDA)가 실자료인가 — 앱 '✓검증' 게이트
  sources: QualitySource[];                              // 차원별 게이트(피쉬본 뼈)
}

interface IntegrationLive { keyed: boolean; live: boolean; note?: string }
export interface QualityInputs {
  integrations: Record<string, IntegrationLive>;                       // integrationReadiness().integrations
  rdaMeta: { rows: number; baseYears: number[] } | null;               // RDA_REAL_META — null=데모(미검증)
  flywheel: { records: number; withActuals: number; validatedBuckets: number };
}

/** 기존 신호를 차원 게이트로 집계 — 순수 함수(테스트 용이). */
export function assessQuality(inp: QualityInputs): QualityAssessment {
  const ig = inp.integrations || {};
  const live = (k: string): IntegrationLive => ig[k] || { keyed: false, live: false };
  const baseVerified = !!(inp.rdaMeta && inp.rdaMeta.rows > 0);
  const fw = inp.flywheel || { records: 0, withActuals: 0, validatedBuckets: 0 };
  const calibOk = fw.validatedBuckets > 0;

  const sources: QualitySource[] = [
    // 데이터 소스 — 소득 base가 핵심(제품 가치 직결). 데모면 fail.
    { key: "rdaIncome", label: "소득 base(RDA)", category: "source", status: baseVerified ? "ok" : "fail",
      note: baseVerified ? `실 RDA · ${inp.rdaMeta!.rows}행` : "데모·미검증(실 RDA 미적재)" },
    { key: "kamisPrice", label: "시세(KAMIS)", category: "source", status: live("kamisPrice").live ? "ok" : "warn",
      note: live("kamisPrice").live ? "live(검증 품목)" : "mock/일부 폴백" },
    { key: "kmaClimate", label: "기후(KMA)", category: "source", status: live("kmaClimate").live ? "ok" : "warn",
      note: live("kmaClimate").live ? "live" : "mock(키 없음)" },
    { key: "vworld", label: "지도·필지(VWorld)", category: "source",
      status: live("vworldGeocode").live && live("vworldParcel").live ? "ok" : "warn",
      note: live("vworldGeocode").live && live("vworldParcel").live ? "live" : "mock 폴백" },
    // 입력 품질 — DEM은 REST 미제공(구조적)으로 항상 mock 경사 → warn.
    { key: "vworldDem", label: "표고·경사(DEM)", category: "input", status: "warn", note: "REST 미제공 → mock 경사(구조적)" },
    // 보정·해자 — 검증 버킷이 있어야 ok.
    { key: "calibration", label: "실측 보정(해자)", category: "calibration", status: calibOk ? "ok" : "warn",
      note: calibOk ? `검증 버킷 ${fw.validatedBuckets} · 실측 ${fw.withActuals}` : "검증 표본 부족(<5건)" },
    // 가드레일 — 범위·면책·단일값금지는 코드·훅으로 강제(구조적 ok).
    { key: "guardrail", label: "가드레일(범위·면책·단일값금지)", category: "guardrail", status: "ok", note: "코드·훅으로 강제" },
  ];

  const fails = sources.filter((s) => s.status === "fail").length;
  const warns = sources.filter((s) => s.status === "warn").length;
  // 제품 자동 보수의 핵심 — base 미검증=unverified(✓검증 차단·추정 강제). base 검증+보정충분=verified. 그 외 estimated.
  const dataTrust: QualityAssessment["dataTrust"] = !baseVerified ? "unverified" : calibOk ? "verified" : "estimated";
  // 머리글 등급 — fail 있으면 D, 아니면 warn 수로(A 무결·B 1~2·C 3+).
  const grade: QualityAssessment["grade"] = fails > 0 ? "D" : warns >= 3 ? "C" : warns >= 1 ? "B" : "A";
  return { grade, dataTrust, baseVerified, sources };
}
