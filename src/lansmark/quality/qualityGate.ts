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
  action?: string; // warn/fail일 때 '무엇을 하면 되는지'(SSOT) — OPS 피쉬본·Tier1 감시자가 같은 문장을 소비(권고 이중관리 제거).
}

export interface QualityAssessment {
  grade: "A" | "B" | "C" | "D";                         // 머리글 등급(차원 게이트 롤업)
  dataTrust: "verified" | "estimated" | "unverified";   // 제품 자동 보수의 핵심 verdict
  baseVerified: boolean;                                 // 소득 base(RDA)가 실자료인가 — 앱 '✓검증' 게이트
  sources: QualitySource[];                              // 차원별 게이트(피쉬본 뼈)
}

interface IntegrationLive { keyed: boolean; live: boolean; note?: string; runtime?: { state: string; live: number; fallback: number } } // runtime: 실제 호출 결과(off/pending/live/degraded) — '키=live' 거짓 녹색 차단
export interface QualityInputs {
  integrations: Record<string, IntegrationLive>;                       // integrationReadiness().integrations
  rdaMeta: { rows: number; baseYears: number[] } | null;               // RDA_REAL_META — null=데모(미검증)
  flywheel: { records: number; withActuals: number; validatedBuckets: number };
}

/** 기존 신호를 차원 게이트로 집계 — 순수 함수(테스트 용이). */
export function assessQuality(inp: QualityInputs): QualityAssessment {
  const ig = inp.integrations || {};
  const live = (k: string): IntegrationLive => ig[k] || { keyed: false, live: false };
  // 런타임 상태 한 단어 — '키 있으나 폴백 중(degraded·실 API 다운)'을 '키 없음(off)'과 구분해 정직한 note/action 제공.
  const st = (k: string): string => live(k).runtime?.state || (live(k).keyed ? "pending" : "off");
  const rnote = (k: string, liveNote: string): string => { const s = st(k); return s === "live" ? liveNote : s === "degraded" ? "키 있으나 폴백 중 — 실 API 다운 추정" : s === "pending" ? "키 있음(실호출 검증 전)" : "mock(키 없음)"; };
  const raction = (k: string, base: string): string => st(k) === "degraded" ? "실 API가 폴백 중 — 키 유효성·쿼터·네트워크 확인(거짓 녹색 아님)" : base;
  const baseVerified = !!(inp.rdaMeta && inp.rdaMeta.rows > 0);
  const fw = inp.flywheel || { records: 0, withActuals: 0, validatedBuckets: 0 };
  const calibOk = fw.validatedBuckets > 0;

  const sources: QualitySource[] = [
    // 데이터 소스 — 소득 base가 핵심(제품 가치 직결). 데모면 fail.
    { key: "rdaIncome", label: "소득 base(RDA)", category: "source", status: baseVerified ? "ok" : "fail",
      note: baseVerified ? `실 RDA · ${inp.rdaMeta!.rows}행` : "데모·미검증(실 RDA 미적재)",
      action: baseVerified ? undefined : "실 RDA 소득자료 적재(npm run rda:build) — 그 전엔 앱이 '추정' 강제(정상)" },
    { key: "kamisPrice", label: "시세(KAMIS)", category: "source", status: live("kamisPrice").live ? "ok" : "warn",
      note: rnote("kamisPrice", "live(검증 품목)"),
      action: live("kamisPrice").live ? undefined : raction("kamisPrice", "KAMIS 품목코드 연결로 live 품목 확장(미검증 작물은 실 RDA 단가 사용)") },
    { key: "kmaClimate", label: "기후(KMA)", category: "source", status: live("kmaClimate").live ? "ok" : "warn",
      note: rnote("kmaClimate", "live"),
      action: live("kmaClimate").live ? undefined : raction("kmaClimate", "KMA_API_KEY 설정 → 기후 live 전환") },
    { key: "vworld", label: "지도·필지(VWorld)", category: "source",
      status: live("vworldGeocode").live && live("vworldParcel").live ? "ok" : "warn",
      note: rnote("vworldParcel", "live"),
      action: (live("vworldGeocode").live && live("vworldParcel").live) ? undefined : raction("vworldParcel", "VWORLD_API_KEY 설정 → 지도·필지 live 전환") },
    // 입력 품질 — DEM은 REST 미제공(구조적)으로 항상 mock 경사 → warn.
    { key: "vworldDem", label: "표고·경사(DEM)", category: "input", status: "warn", note: "REST 미제공 → mock 경사(구조적)",
      action: "구조적 한계(REST 미제공) — 대안 DEM 소스 검토(즉시 조치 불필요)" },
    // 보정·해자 — 검증 버킷이 있어야 ok.
    { key: "calibration", label: "실측 보정(해자)", category: "calibration", status: calibOk ? "ok" : "warn",
      note: calibOk ? `검증 버킷 ${fw.validatedBuckets} · 실측 ${fw.withActuals}` : "검증 표본 부족(<5건)",
      action: calibOk ? undefined : "제품에서 서로 다른 농가 실측 5건↑ 모이면 검증(사용 유도 — 코드 조치 아님)" },
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
