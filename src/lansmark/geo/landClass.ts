/**
 * 토지 유형 분류 — 강/바다/도시/임야/기존 농경지 구분.
 *  - mock: 좌표 기반 데모 분류기(실데이터 아님).
 *  - live: VWorld 필지 지목(地目: 전/답/과수원/대/하천/임야…) 매핑.
 *    ※ 지목 28종 명칭→분류는 공개 표준이라 매핑(아래). VWorld WFS에서 지목을 '추출하는 속성 키'는
 *      공식 docs 확인 후 fetchParcel을 확장해야 함(추측 금지 — 현재는 seam, mock 경로 사용).
 * 가드레일: 토지 매입·임대 추천이 아니라, 현재 토지 '상태' 구분과 경작 가능 여부 안내만 제공.
 */
export type LandCategory = "field" | "paddy" | "orchard" | "river" | "sea" | "urban" | "forest" | "other";
export type LandGroup = "agri" | "water" | "urban" | "forest" | "other";
export type LandAction = "reconfirm" | "warn" | "block"; // 농경지=reconfirm · 도시/임야/기타=warn · 수면=block

export interface LandClassResult {
  category: LandCategory;
  group: LandGroup;
  label: string;
  cultivable: boolean; // 현 상태 기준 경작 가능 여부
  action: LandAction;
  reason: string;
  jimok?: string;
  source: "mock" | "cadastre";
}

const META: Record<LandCategory, Omit<LandClassResult, "category" | "jimok" | "source">> = {
  field:   { group: "agri",   label: "전(밭)",        cultivable: true,  action: "reconfirm", reason: "기존 농경지(밭) — 현재 재배 현황을 재확인한 뒤 진행하세요." },
  paddy:   { group: "agri",   label: "답(논)",        cultivable: true,  action: "reconfirm", reason: "기존 농경지(논) — 현재 재배 현황을 재확인한 뒤 진행하세요." },
  orchard: { group: "agri",   label: "과수원",         cultivable: true,  action: "reconfirm", reason: "기존 농경지(과수원) — 현재 재배 현황을 재확인한 뒤 진행하세요." },
  river:   { group: "water",  label: "하천·구거",      cultivable: false, action: "block",     reason: "하천/수로(수면) — 작물 재배가 불가능합니다." },
  sea:     { group: "water",  label: "바다·공유수면",   cultivable: false, action: "block",     reason: "바다/공유수면 — 작물 재배가 불가능합니다." },
  urban:   { group: "urban",  label: "도시·대지",      cultivable: false, action: "warn",      reason: "도시지역(대지) — 농경지가 아닙니다. 소득 분석은 참고용입니다." },
  forest:  { group: "forest", label: "임야",          cultivable: false, action: "warn",      reason: "임야 — 현재 농경지가 아닙니다(개간 전 참고용)." },
  other:   { group: "other",  label: "기타·지목미상",   cultivable: false, action: "warn",      reason: "비농지/지목 미상 — 현장 확인이 필요합니다." },
};

function make(category: LandCategory, source: "mock" | "cadastre", jimok?: string): LandClassResult {
  return { category, ...META[category], jimok, source };
}

/** 한국 지목(地目) 명칭 → 분류. (지목 28종은 공개 표준; live 추출 키만 docs-gated.) */
export function classifyJimok(jimok: string): LandClassResult {
  const j = (jimok || "").trim();
  const MAP: Record<string, LandCategory> = {
    전: "field", 답: "paddy", 과수원: "orchard", 목장용지: "field",
    임야: "forest",
    대: "urban", 공장용지: "urban", 학교용지: "urban", 주차장: "urban", 주유소용지: "urban", 창고용지: "urban", 종교용지: "urban",
    하천: "river", 구거: "river", 유지: "river", 양어장: "river", 수도용지: "river",
    공유수면: "sea", 바다: "sea",
  };
  return make(MAP[j] ?? "other", "cadastre", j || undefined);
}

// ───────────────── mock 분류기(데모용 · 실데이터 아님) ─────────────────
const URBAN_CENTERS: Array<[number, number]> = [
  [37.566, 126.978], [35.18, 129.075], [35.87, 128.6], [37.456, 126.705],
  [35.16, 126.85], [36.35, 127.385], [35.54, 129.31], [37.41, 127.1],
];
const RIVER_POINTS: Array<[number, number]> = [
  [35.45, 128.45], [36.45, 127.12], [35.0, 126.78], [37.55, 127.62], [36.58, 127.3],
];
const near = (lat: number, lng: number, pts: Array<[number, number]>, r: number) =>
  pts.some(([a, b]) => Math.abs(a - lat) <= r && Math.abs(b - lng) <= r);

/** 대략적 한반도 육지 밖(데모): 서해 먼바다·동해·제주해협 개방수면·남단/북단 밖. */
function isSeaMock(lat: number, lng: number): boolean {
  if (lng < 125.9 || lng > 129.7) return true;
  if (lat < 33.0 || lat > 38.7) return true;
  if (lat > 33.65 && lat < 34.25) return true; // 제주해협(남해 개방수면)
  return false;
}
function hashCategory(lat: number, lng: number): LandCategory {
  const h = Math.abs((Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453) % 1);
  return h < 0.5 ? "field" : h < 0.8 ? "paddy" : "orchard";
}

/** 데모 좌표 분류: 도시중심→대지 · 하천샘플→하천 · 먼바다→바다 · 그 외→농경지(전/답/과수원). */
export function classifyLandMock(lat: number, lng: number): LandClassResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return make("other", "mock");
  if (isSeaMock(lat, lng)) return make("sea", "mock");
  if (near(lat, lng, URBAN_CENTERS, 0.05)) return make("urban", "mock");
  if (near(lat, lng, RIVER_POINTS, 0.03)) return make("river", "mock");
  return make(hashCategory(lat, lng), "mock");
}
