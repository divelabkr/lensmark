/**
 * 병충해·재해 주의(agri-alerts) — Phase A: 작물·시기 기반 주의 정보(로컬 데이터 조립).
 *   책임: 작물 1종 + 기준 월(month) → 병해충 + 기상/재해 주의 항목을 조립하고, '지금 주의'(active)를 매칭한다(순수·결정적).
 *   데이터 정직성(CLAUDE.md #4 추측 금지):
 *     - 병해충 = cropPests.seed 룰북(illustrative) · 기상/재해 = 작물 특성 + 일반 계절 농학(서리·장마·폭염·태풍·한파).
 *     - ★ live-upgrade seam: 실시간 발생 예찰 = NCPMS(국가농작물병해충관리시스템) · 기상특보 = KMA 특보 API(키=HUMAN GATE).
 *       인앱/푸시 알림 전달, 지역(lat/lng)별 특보도 Phase B(인프라).
 *   가드레일: '예보/예찰'을 단정하지 않음(참고·시기 기반) · 면책 · 수익/방제효과 보장 아님.
 */
import { getCropProfile } from "../data/crops.seed";
import { getCropPests } from "../data/cropPests.seed";

export type AlertKind = "pest" | "weather" | "disaster";
export type AlertSeverity = "info" | "watch" | "warn"; // 정보 / 주의 / 경계

export interface AlertItem {
  kind: AlertKind;
  title: string;
  detail: string;       // 발생 시기/조건 + 대응
  severity: AlertSeverity;
  active: boolean;      // 기준 월이 발생 시기에 해당(소프트 매칭)
  source: string;       // 출처(룰북/시기 + 실시간 연동 예정 표기)
}

export interface AgriAlerts {
  cropId: string;
  cropNameKo: string;
  month: number;        // 기준 월(1~12)
  alerts: AlertItem[];  // active 먼저, severity(경계>주의>정보) 순
  activeCount: number;
  sources: string[];
  disclaimer: string;
}

/* 계절 키워드 → 월 집합(발생 시기 텍스트 매칭용 휴리스틱 · 참고값). */
const SEASON_KW: Record<string, number[]> = {
  "봄": [3, 4, 5], "여름": [6, 7, 8], "가을": [9, 10, 11], "겨울": [12, 1, 2],
  "장마": [6, 7], "초여름": [6], "한여름": [7, 8], "늦여름": [8, 9], "연중": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

/** 발생 시기 텍스트 → 월 집합. "6~8월"·"7월" 등 명시 월 우선, 없으면 계절 키워드. */
export function monthsOfSeason(season: string): Set<number> {
  const out = new Set<number>();
  const range = season.match(/(\d{1,2})\s*~\s*(\d{1,2})\s*월/); // "6~8월"
  if (range) {
    const a = +range[1], b = +range[2];
    if (a <= b) { for (let m = a; m <= b; m++) out.add(m); }
    else { for (let m = a; m <= 12; m++) out.add(m); for (let m = 1; m <= b; m++) out.add(m); } // 연말 넘김
  }
  for (const m of season.matchAll(/(\d{1,2})\s*월/g)) out.add(+m[1]); // 단일 "7월"
  // 키워드 매칭: 긴 키 우선 + 매칭분 소거 → '초/한/늦여름'이 광역 '여름'에 이중매칭되지 않음(과대 active 방지 · 레드팀 F1).
  let text = season;
  for (const k of Object.keys(SEASON_KW).sort((a, b) => b.length - a.length)) {
    if (text.includes(k)) { for (const m of SEASON_KW[k]) out.add(m); text = text.split(k).join(""); }
  }
  return out;
}
/** 기준 월이 발생 시기에 해당하는가(매칭 불가 텍스트는 false=상시 정보). */
function seasonActive(season: string, month: number): boolean {
  const s = monthsOfSeason(season);
  return s.size > 0 && s.has(month);
}

/** 작물 특성 + 일반 계절 농학 → 기상/재해 주의(기준 월 해당분만). */
function weatherDisasterAlerts(req: ReturnType<typeof getCropProfile>["requirements"], month: number): AlertItem[] {
  const out: AlertItem[] = [];
  const inM = (arr: number[]) => arr.includes(month);
  // 서리·저온: 서리 민감 작물 + 봄(개화·정식)/가을
  if (req.frostSensitivity !== "low" && inM([3, 4, 10, 11]))
    out.push({ kind: "weather", title: "서리·저온 주의", detail: "개화·정식기 저온/서리 — 보온·관수·연소법 대비", severity: req.frostSensitivity === "high" ? "warn" : "watch", active: true, source: "작물 특성·시기 (KMA 특보 연동 예정)" });
  // 가뭄·관수: 물 요구 높은 작물 + 한여름
  if (req.waterNeed === "high" && inM([6, 7, 8]))
    out.push({ kind: "weather", title: "가뭄·관수 주의", detail: "고온건조기 수분 부족 — 관수 설비 점검", severity: "watch", active: true, source: "작물 특성·시기" });
  // 장마·집중호우: 6~7월
  if (inM([6, 7]))
    out.push({ kind: "disaster", title: "장마·집중호우 주의", detail: "물고임·습해·병 확산 — 배수로 점검·예방방제", severity: "watch", active: true, source: "일반 시기 (KMA 특보 연동 예정)" });
  // 폭염: 7~8월
  if (inM([7, 8]))
    out.push({ kind: "weather", title: "폭염 주의", detail: "고온 스트레스·일소 피해 — 차광·관수·작업시간 조정", severity: "watch", active: true, source: "일반 시기 (KMA 특보 연동 예정)" });
  // 태풍: 8~9월
  if (inM([8, 9]))
    out.push({ kind: "disaster", title: "태풍 주의", detail: "강풍·도복·낙과 — 지주 보강·배수·조기수확 검토", severity: "warn", active: true, source: "일반 시기 (KMA 특보 연동 예정)" });
  // 한파·대설: 12~2월(내한성 낮은 작물)
  if (req.coldTolerance !== "high" && inM([12, 1, 2]))
    out.push({ kind: "weather", title: "한파·대설 주의", detail: "동해·시설 적설 붕괴 — 보온·제설·시설 점검", severity: "watch", active: true, source: "작물 특성·시기 (KMA 특보 연동 예정)" });
  return out;
}

const SEV_ORDER: Record<AlertSeverity, number> = { warn: 0, watch: 1, info: 2 };
const DISCLAIMER =
  "병해충·기상 주의는 작물 특성·발생 시기(룰북·일반 농학) 기반 참고 정보입니다. 실시간 발생 예찰(NCPMS)·기상특보(KMA)·푸시 알림은 연동 예정이며, 실제 발생·기상은 지역·연도에 따라 다릅니다. 방제 효과를 보장하지 않습니다.";

/**
 * 작물 + 기준 월 → 병충해·재해 주의. 순수 함수. unknown cropId면 getCropProfile throw(호출측 400).
 *   active(지금 주의)를 먼저, 그 다음 severity(경계>주의>정보) 순으로 정렬.
 */
export function buildAgriAlerts(cropId: string, month: number): AgriAlerts {
  const crop = getCropProfile(cropId);
  const m = Math.min(12, Math.max(1, Math.floor(month) || 1)); // 1~12 클램프

  // 병해충(seed) → 알림
  const pestAlerts: AlertItem[] = getCropPests(cropId).map((p) => {
    const active = seasonActive(p.season, m);
    return {
      kind: "pest" as const,
      title: `${p.name} (${p.type === "disease" ? "병" : "해충"})`,
      detail: `발생 ${p.season} · 대응: ${p.action}`,
      severity: active ? "watch" : "info",
      active,
      source: "작물 병해충(룰북) · NCPMS 예찰 연동 예정",
    };
  });

  const alerts = [...pestAlerts, ...weatherDisasterAlerts(crop.requirements, m)];
  // active 먼저 → severity → 종류 안정정렬
  alerts.sort((a, b) => (Number(b.active) - Number(a.active)) || (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]));

  return {
    cropId,
    cropNameKo: crop.cropNameKo,
    month: m,
    alerts,
    activeCount: alerts.filter((a) => a.active).length,
    sources: ["작물 병해충 룰북", "일반 계절 농학", "NCPMS 예찰(예정·seam)", "KMA 기상특보(예정·seam)"],
    disclaimer: DISCLAIMER,
  };
}
