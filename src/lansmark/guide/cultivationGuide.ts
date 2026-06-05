/**
 * 재배 가이드(품종 선택 + 재배 환경·기술) — Phase A: 국내 룰북 데이터 조립.
 *   책임: 작물 1종의 품종 후보·재배환경 요구조건·재배 적기·리스크를 한 객체로 조립한다(순수·결정적).
 *   데이터 정직성(CLAUDE.md #4 추측 금지):
 *     - 현재 출처 = crops.seed 룰북(데모·미검증) + core/calendar(캘린더). 라벨로 명시.
 *     - ★ live-upgrade seam: 농사로(농촌진흥청 농업기술포털) OpenAPI(품종·표준재배법·생리장해)로
 *       이 조립을 교체/보강(키 = HUMAN GATE). 외래·임의 작물(GBIF/Wikidata/Trefle/OpenFarm)은 Phase B.
 *   티어: 무료 = 대표작물(STAPLE_FREE) · 유료 = 전체 작물(라우트가 엔티틀먼트로 게이트).
 *   가드레일: 재배 성공 보장 금지 · 출처·면책 · 외래종/기후 적합성은 별도 검증(Phase B).
 */
import { getCropProfile } from "../data/crops.seed";
import { buildGrowthCalendar, type GrowthCalendar } from "../core/calendar";

/**
 * 무료(대표작물) 화이트리스트 — 누구나 품종·재배가이드 열람.
 *   벼(rice)·보리(barley)는 한국 대표 식량작물 → 무료 포함(crops.seed에 데모 프로필 추가됨, 실데이터 검증 필요).
 *   그 외(베리·포도·딸기·도라지·참깨·들깨 등 특용·고소득)는 유료.
 */
export const STAPLE_FREE = new Set<string>([
  "rice", "barley", "apple", "potato", "sweet_potato", "napa_cabbage", "soybean", "corn", "onion", "garlic", "chili_pepper",
]);
export function isStapleFree(cropId: string): boolean { return STAPLE_FREE.has(cropId); }

/** 품종 후보 1건. */
export interface VarietyInfo { groupId: string; nameKo: string; description: string; tags: string[]; }
/** 재배 환경 요구조건 1행(라벨·값) — 프론트가 그대로 표시. */
export interface RequirementItem { key: string; label: string; value: string; }

export interface CultivationGuide {
  cropId: string;
  cropNameKo: string;
  cropNameEn: string;
  category: string;
  tier: "free" | "paid";          // 무료(대표작물)/유료(전체)
  varieties: VarietyInfo[];        // 품종 후보(cultivarGroups)
  requirements: RequirementItem[]; // 재배 환경 요구조건(라벨링)
  calendar: GrowthCalendar;        // 재배 적기 월력(core/calendar 재사용)
  riskNotes: string[];             // 작물 단위 리스크
  additionalChecks: string[];      // 추가 점검 항목
  sources: string[];               // 출처(룰북 데모 + 농사로 seam)
  disclaimer: string;
}

/* 열거값 → 한국어 라벨(요구조건 표시용). */
const NEED = { low: "적음", medium: "보통", high: "많음" } as const;
const DRAIN = { low: "불량", medium: "보통", high: "양호" } as const;
const COLD = { low: "약함", medium: "보통", high: "강함" } as const;
const FROST = { low: "둔감", medium: "보통", high: "민감" } as const;

/** CropRequirements → 라벨링된 행 목록(값 없는 항목은 생략). */
function requirementRows(r: ReturnType<typeof getCropProfile>["requirements"]): RequirementItem[] {
  const rows: RequirementItem[] = [];
  if (r.phMin != null && r.phMax != null) rows.push({ key: "ph", label: "토양 pH", value: `${r.phMin}–${r.phMax}` });
  rows.push({ key: "drainage", label: "배수", value: DRAIN[r.drainage] });
  rows.push({ key: "water", label: "물 요구", value: NEED[r.waterNeed] });
  rows.push({ key: "sunlight", label: "일조 요구", value: NEED[r.sunlightNeed] });
  rows.push({ key: "cold", label: "내한성", value: COLD[r.coldTolerance] });
  rows.push({ key: "frost", label: "서리 민감도", value: FROST[r.frostSensitivity] });
  rows.push({ key: "labor", label: "노동 강도", value: NEED[r.laborNeed] });
  if (r.suitableSlopeMaxDegree != null) rows.push({ key: "slope", label: "적정 경사", value: `≤ ${r.suitableSlopeMaxDegree}°` });
  if (r.facilityRecommended) rows.push({ key: "facility", label: "시설재배", value: "권장" });
  return rows;
}

const DISCLAIMER =
  "품종·재배 정보는 작물 룰북(데모·미검증)과 표준 월력을 조립한 참고 자료입니다. 지역 시험성적·실제 재배환경에 따라 다르며 재배 성공을 보장하지 않습니다. 정밀 품종·표준재배법은 농사로(농촌진흥청) 연동 시 갱신됩니다.";

/**
 * 작물 → 재배 가이드. 순수 함수(동일 입력 → 동일 출력). unknown cropId면 getCropProfile이 throw(호출측 400).
 */
export function buildCultivationGuide(cropId: string): CultivationGuide {
  const c = getCropProfile(cropId);
  return {
    cropId,
    cropNameKo: c.cropNameKo,
    cropNameEn: c.cropNameEn,
    category: c.category,
    tier: isStapleFree(cropId) ? "free" : "paid",
    varieties: c.cultivarGroups.map((g) => ({ groupId: g.groupId, nameKo: g.nameKo, description: g.description, tags: g.tags.slice() })),
    requirements: requirementRows(c.requirements),
    calendar: buildGrowthCalendar(cropId),
    riskNotes: c.riskNotes.slice(),
    additionalChecks: c.additionalChecks.slice(),
    sources: ["작물 룰북(데모·미검증)", "표준 재배 월력", "농사로 연동(예정·seam)"],
    disclaimer: DISCLAIMER,
  };
}
