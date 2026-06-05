/**
 * 귀농 자가진단(returnfarm-assess) — 의사결정 '더 앞' 무료 깔때기. 순수·결정적(동일 입력 → 동일 출력).
 *   책임: 자가응답(자금·생활비버퍼·동기·경험·가족동의·농지) → 준비도 점수·축별 상태·보완 액션을 룰로 조립.
 *   ⚠ 가드레일(CLAUDE.md): 귀농 가부 단정·성공 보장 금지 — '준비도 참고 + 보완 항목'만 제시('caution'=신중·보완 권고, 금지 아님).
 *   ⚠ 데이터 정직성(#4): 가중치·임계는 데모 참고치(verified 아님). 근거: 귀농 실패 1위=자금(KREI·귀농 체크리스트) → 자금·생활비 버퍼 최대 가중.
 *   입력은 전부 사용자 자가응답(외부 데이터 아님) → 추측 이슈 없음. live-upgrade: 귀농귀촌종합센터 통계로 임계 보정(seam).
 */
export type AssessStatus = "ok" | "watch" | "risk" | "unknown";
export type AssessBand = "ready" | "prepare" | "caution"; // 준비됨 / 보완 필요 / 신중 검토

/** 자가진단 입력(모두 선택 — 미입력은 '정보부족'으로 보수 처리). */
export interface ReturnFarmAssessInput {
  equityKrw?: number;            // 자기자본(초기)
  livingBufferMonths?: number;   // 농외수입·저축으로 버틸 개월(생활비)
  motivation?: "clear" | "vague";
  experience?: "none" | "education" | "experienced"; // 영농 경험/교육
  familyConsent?: boolean;       // 가족 동의
  landSecured?: boolean;         // 농지 확보 여부
}

export interface AssessAxis { key: string; label: string; weight: number; status: AssessStatus; note: string; }
export interface ReturnFarmAssessment {
  score: number;        // 0~100 준비도(참고)
  band: AssessBand;
  axes: AssessAxis[];
  topRisks: string[];   // status=risk 축 라벨
  nextActions: string[];// 보완 액션(축별)
  disclaimer: string;
}

/* 상태별 가중 환산 — 정보부족(unknown)은 중간(보수). */
const FRAC: Record<AssessStatus, number> = { ok: 1, watch: 0.5, risk: 0, unknown: 0.5 };

const DISCLAIMER =
  "자가진단은 입력값 기반의 준비도 '참고'이며 귀농 가부·성공을 판단·보장하지 않습니다. 가중치는 데모 기준이며, 실제 준비는 관할 농업기술센터·귀농귀촌종합센터 상담으로 확인하세요.";

/** 축별 보완 액션(risk/watch일 때 노출). */
const ACTION: Record<string, string> = {
  capital: "초기 자기자본 계획 점검 — 정책자금(청년후계농·농협 시설자금)·보조 자격을 함께 확인하세요.",
  living: "최소 6개월치 생활비 비상자금과 농외 소득원을 확보하세요(자금이 귀농 실패 1위 요인).",
  motivation: "막연한 동기 대신 목표·작목·판로를 구체화하세요(수익/정착/건강 등).",
  experience: "영농 교육·실습(농업기술센터)·선도농가 인턴으로 기술 거래비용을 낮추세요.",
  family: "배우자·가족 동의와 역할(참여/교육/주거)을 사전에 합의하세요.",
  land: "농지 확보 전 농업진흥구역·용수·진입로·경작 가능 상태를 실사하세요.",
};

/** 자가진단 조립. 순수 함수. */
export function buildReturnFarmAssessment(input: ReturnFarmAssessInput): ReturnFarmAssessment {
  const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
  const eq = num(input.equityKrw);
  const buf = num(input.livingBufferMonths);

  const axes: AssessAxis[] = [
    // 자금·생활비 버퍼를 최대 가중(실패 1위 요인).
    { key: "capital", label: "초기 자기자본", weight: 25,
      status: eq == null ? "unknown" : eq < 20_000_000 ? "risk" : eq < 50_000_000 ? "watch" : "ok",
      note: eq == null ? "미입력" : eq < 20_000_000 ? "자기자본이 얇음 — 융자·보조 의존도↑" : eq < 50_000_000 ? "보통 — 여유자금 점검" : "여유 있음" },
    { key: "living", label: "생활비 버퍼(개월)", weight: 25,
      status: buf == null ? "unknown" : buf < 6 ? "risk" : buf < 12 ? "watch" : "ok",
      note: buf == null ? "미입력" : buf < 6 ? "6개월 미만 — 정착기 현금흐름 위험" : buf < 12 ? "6~12개월 — 보강 권장" : "12개월↑ 안정" },
    { key: "motivation", label: "동기·계획 구체성", weight: 10,
      status: input.motivation == null ? "unknown" : input.motivation === "vague" ? "risk" : "ok",
      note: input.motivation === "vague" ? "동기가 막연 — 구체화 필요" : input.motivation === "clear" ? "목표 명확" : "미입력" },
    { key: "experience", label: "영농 경험·교육", weight: 15,
      status: input.experience == null ? "unknown" : input.experience === "none" ? "risk" : input.experience === "education" ? "watch" : "ok",
      note: input.experience === "none" ? "경험 없음 — 교육·실습 필요" : input.experience === "education" ? "교육 이수 — 실습 보강" : input.experience === "experienced" ? "현장 경험 보유" : "미입력" },
    { key: "family", label: "가족 동의", weight: 15,
      status: input.familyConsent == null ? "unknown" : input.familyConsent ? "ok" : "risk",
      note: input.familyConsent === false ? "미합의 — 사전 합의 필요" : input.familyConsent ? "동의 확보" : "미입력" },
    { key: "land", label: "농지 확보", weight: 10,
      status: input.landSecured == null ? "unknown" : input.landSecured ? "ok" : "watch",
      note: input.landSecured === false ? "미확보 — 실사 후 결정" : input.landSecured ? "확보" : "미입력" },
  ];

  const score = Math.round(axes.reduce((s, a) => s + a.weight * FRAC[a.status], 0)); // 가중합(weight 합=100)
  const band: AssessBand = score >= 70 ? "ready" : score >= 40 ? "prepare" : "caution";
  const topRisks = axes.filter((a) => a.status === "risk").map((a) => a.label);
  const nextActions = axes.filter((a) => a.status === "risk" || a.status === "watch").map((a) => ACTION[a.key]).filter(Boolean);

  return { score, band, axes, topRisks, nextActions, disclaimer: DISCLAIMER };
}
