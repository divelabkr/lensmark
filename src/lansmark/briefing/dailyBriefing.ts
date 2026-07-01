/**
 * 데일리 브리핑(오늘 내 농장) — 예보 × 작물 요구 × 생육 캘린더 × 병해충 × 기상특보 × 시세를
 * "오늘 무슨 일이 있고, 뭘 해야 하나" 한 장으로 조립한다(순수·결정적 — 외부조회는 라우트가 주입).
 *   왜: 시뮬(1회성 의사결정)과 달리 브리핑은 '매일 여는 이유'다. 재배중 일지(=내 농장)가 있어야 생성된다.
 *   데이터 정직성(CLAUDE.md #4): 위험 매칭 임계값은 일반 농학 룰북(참고값)이며 '예보 기반 주의'로만 말한다.
 *     예보가 mock(데모)이면 demo=true로 노출해 클라이언트가 데모 라벨을 강제한다.
 *   가드레일: 재배 성공/수확/방제효과 보장 ❌ · 항상 출처·면책 동반 ✅.
 */
import { getCropProfile } from "../data/crops.seed";
import { heatToleranceOf } from "../data/cropClimateTraits";
import { buildGrowthCalendar, type MonthStage } from "../core/calendar";
import { buildAgriAlerts } from "../alerts/agriAlerts";
import type { DailyForecast, DailyForecastDay } from "../data/providers/forecast";
import type { KmaWarning } from "../integrations/kmaWarning";
import type { PriceResult } from "../data/providers/types";

/** 내 농장 1곳(= 재배중 일지 1건)의 브리핑 입력 축약형 — 라우트가 JournalEntry에서 떠온다. */
export interface BriefingFarm {
  journalId: string;
  cropId: string;
  region?: string;
  plantedAt?: string;   // 정식·파종일(ISO) — 경과일 계산
  areaM2?: number;
  lat?: number;         // 필지 좌표 — 클라이언트 '지도에서 보기'(flyTo)용 패스스루
  lng?: number;
}
/** 외부조회 주입분 — 라우트가 병렬 수집(각자 실패 시 null/[]) 후 전달. */
export interface BriefingInputs {
  todayIso: string;              // "yyyy-mm-dd"(서버 기준일 주입 — 순수성·테스트 결정성)
  forecast: DailyForecast | null;
  weatherWarnings?: KmaWarning[]; // 지역 매칭된 KMA 실시간 특보(live·없으면 [])
  price?: PriceResult | null;     // 도매 시세 — 라우트가 'live 검증분만' 전달(mock 앵커 호도 금지)
}

export type RiskAxis = "frost" | "heat" | "rain" | "wind" | "dry";
export interface BriefingRisk {
  axis: RiskAxis;
  date: string;                  // 해당 예보일
  title: string;
  detail: string;                // 수치 + 대응(할 일로도 재사용)
  severity: "watch" | "warn";    // 주의 / 경계
}
export interface BriefingStage {
  month: number;                 // 기준 월(1~12)
  stage: MonthStage;             // idle|sow|growth|bloom|harvest
  stageKo: string;
  careLabel?: string;            // 이달 관리 포인트(캘린더 룰북)
  harvestMonths: number[];       // 수확월(출하 준비 신호)
  daysSincePlanting?: number;    // 정식·파종 후 경과일(plantedAt 있을 때)
}
export interface DailyBriefing {
  journalId: string;
  cropId: string;
  cropNameKo: string;
  region?: string;
  lat?: number;                     // '지도에서 보기' 좌표(있을 때만)
  lng?: number;
  today: DailyForecastDay | null;   // 오늘 예보(예보 실패 시 null — 섹션 숨김)
  week: DailyForecastDay[];         // 7일 예보(주간 스트립)
  demo: boolean;                    // 예보가 mock(데모)인가 — 클라 데모 라벨 강제
  risks: BriefingRisk[];            // 오늘~모레 위험(축별 최악 1건)
  stage: BriefingStage;
  alerts: { title: string; detail: string; severity: string }[]; // 이달 병해충·재해 active 상위
  warnings: string[];               // KMA 특보 요약문(live)
  market: { p50KrwPerKg: number; source: string; asOf?: string } | null; // live 검증 시세만
  checklist: string[];              // 오늘 할 일(위험 대응 + 이달 관리 + 단계 액션)
  sources: string[];
  disclaimer: string;
}

const STAGE_KO: Record<MonthStage, string> = { idle: "휴면·준비", sow: "파종·정식", growth: "생육", bloom: "개화", harvest: "수확" };
const DISCLAIMER =
  "브리핑은 일별 예보·작물 룰북·시기 정보 기반 참고입니다. 실제 미기상·발생은 필지·연도에 따라 다르며, 재배 성공·방제 효과·수익을 보장하지 않습니다.";

/** 내서성별 고온 임계(℃) — fieldMonitor.summerHeatCheck와 동일 척도(일관성). */
const HEAT_THR: Record<"low" | "medium" | "high", { watch: number; warn: number }> = {
  low: { watch: 30, warn: 33 }, medium: { watch: 33, warn: 36 }, high: { watch: 36, warn: 39 },
};

/** 예보 1일 × 작물 요구 → 위험 목록(일반 농학 임계·참고값). */
function risksOfDay(d: DailyForecastDay, req: ReturnType<typeof getCropProfile>["requirements"], heat: "low" | "medium" | "high"): BriefingRisk[] {
  const out: BriefingRisk[] = [];
  // 서리·저온 — 민감 작물일수록 경계 상향. 0℃ 이하는 결빙 실위험.
  if (d.minC <= 2) {
    const sev: BriefingRisk["severity"] = d.minC <= 0 && req.frostSensitivity !== "low" ? "warn" : "watch";
    out.push({ axis: "frost", date: d.date, severity: sev, title: "서리·저온 주의", detail: `최저 ${d.minC}℃ 예보 — 부직포·보온·방상(살수) 대비` });
  }
  // 폭염·고온해 — 내서성별 임계(fieldMonitor와 동일).
  const ht = HEAT_THR[heat];
  if (d.maxC >= ht.watch) {
    out.push({ axis: "heat", date: d.date, severity: d.maxC >= ht.warn ? "warn" : "watch", title: "고온 스트레스 주의", detail: `최고 ${d.maxC}℃ 예보 — 차광·관수·한낮 작업 회피` });
  }
  // 호우 — 30mm 주의 · 80mm 경계(습해·유실).
  if (d.rainMm >= 30) {
    out.push({ axis: "rain", date: d.date, severity: d.rainMm >= 80 ? "warn" : "watch", title: "많은 비 주의", detail: `일 강수 ${d.rainMm}mm 예보 — 배수로 점검·습해 예방` });
  }
  // 강풍 — 10m/s 주의 · 14m/s 경계(도복·낙과·시설).
  if (d.windMaxMs != null && d.windMaxMs >= 10) {
    out.push({ axis: "wind", date: d.date, severity: d.windMaxMs >= 14 ? "warn" : "watch", title: "강풍 주의", detail: `최대풍속 ${d.windMaxMs}m/s 예보 — 지주 보강·시설 고정` });
  }
  return out;
}

const SEV_RANK = { warn: 0, watch: 1 } as const;

/**
 * 내 농장 1곳 → 데일리 브리핑. 순수 함수(같은 입력=같은 출력).
 *   unknown cropId면 getCropProfile throw — 호출측(라우트)이 해당 농장만 건너뛴다.
 */
export function buildDailyBriefing(farm: BriefingFarm, inputs: BriefingInputs): DailyBriefing {
  const crop = getCropProfile(farm.cropId);
  const req = crop.requirements;
  const month = Math.min(12, Math.max(1, Number(inputs.todayIso.slice(5, 7)) || 1));
  const days = inputs.forecast?.days ?? [];
  const demo = !!inputs.forecast && /mock/i.test(inputs.forecast.source);

  // ── 위험 매칭: 오늘~모레(3일)만 — '오늘 할 일'의 시계. 축별로 가장 심한(같으면 이른) 1건으로 압축.
  const heat = heatToleranceOf(farm.cropId);
  const raw = days.slice(0, 3).flatMap((d) => risksOfDay(d, req, heat));
  // 건조 — 주간 강수합 기준(물 요구 높은 작물의 관수 신호). 일 단위 축과 달리 7일 창.
  if (req.waterNeed === "high" && days.length >= 5 && days.reduce((s, d) => s + d.rainMm, 0) < 5) {
    raw.push({ axis: "dry", date: days[0].date, severity: "watch", title: "건조 주의", detail: "주간 강수 5mm 미만 예보 — 관수 계획·토양 수분 점검" });
  }
  const byAxis = new Map<RiskAxis, BriefingRisk>();
  for (const r of raw) {
    const cur = byAxis.get(r.axis);
    if (!cur || SEV_RANK[r.severity] < SEV_RANK[cur.severity]) byAxis.set(r.axis, r);
  }
  const risks = [...byAxis.values()].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  // ── 생육 단계(캘린더 룰북) + 정식 후 경과일.
  const cal = buildGrowthCalendar(farm.cropId);
  const mrec = cal.months[month - 1];
  const harvestMonths = cal.months.filter((m) => m.stage === "harvest").map((m) => m.month);
  let daysSincePlanting: number | undefined;
  if (farm.plantedAt) {
    const dt = (Date.parse(inputs.todayIso) - Date.parse(farm.plantedAt.slice(0, 10))) / 86400000;
    if (Number.isFinite(dt) && dt >= 0 && dt < 3660) daysSincePlanting = Math.floor(dt); // 미래·10년↑ 이상치는 미표기
  }
  const stage: BriefingStage = { month, stage: mrec.stage, stageKo: STAGE_KO[mrec.stage], careLabel: mrec.label, harvestMonths, daysSincePlanting };

  // ── 이달 병해충·재해(룰북 active만 상위 4) — 상세는 /api/alerts가 담당(브리핑은 요약).
  const agri = buildAgriAlerts(farm.cropId, month);
  const alerts = agri.alerts.filter((a) => a.active).slice(0, 4).map((a) => ({ title: a.title, detail: a.detail, severity: a.severity }));

  // ── KMA 특보 요약문(live) — "전주 폭염 경보" 식 한 줄.
  const warnings = (inputs.weatherWarnings ?? []).slice(0, 4).map((w) => `${w.regKo} ${w.kind} ${w.level}`.trim());

  // ── 시세(라우트가 live 검증분만 주입 — mock 앵커로 호도하지 않음).
  const p50 = inputs.price?.priceKrwPerKg?.p50;
  const market = typeof p50 === "number" && Number.isFinite(p50) && p50 > 0
    ? { p50KrwPerKg: Math.round(p50), source: inputs.price!.source, asOf: inputs.price!.asOf }
    : null;

  // ── 오늘 할 일 — 위험 대응 → 이달 관리 → 단계 액션 → 기본(관찰·기록) 순으로 최대 5개.
  const checklist: string[] = [];
  for (const r of risks.slice(0, 3)) checklist.push(`${r.title}: ${r.detail.split(" — ")[1] ?? r.detail}`);
  if (mrec.label) checklist.push(`이달 관리: ${mrec.label}`);
  if (mrec.stage === "sow") checklist.push("파종·정식 적기 — 종자·모종·토양 준비 점검");
  if (mrec.stage === "harvest") checklist.push("수확기 — 출하 시세·납품처 확인 후 수확 일정 잡기");
  if (alerts.length && checklist.length < 5) checklist.push(`예방방제 점검: ${alerts[0].title}`);
  if (!checklist.length) checklist.push("특이 위험 없음 — 생육 관찰·재배일지 기록");

  const sources = [
    inputs.forecast ? inputs.forecast.source : "예보 조회 실패",
    "작물 요구·캘린더·병해충(룰북)",
    ...(warnings.length ? ["KMA 기상특보(실시간)"] : []),
    ...(market ? [market.source] : []),
  ];

  return {
    journalId: farm.journalId, cropId: farm.cropId, cropNameKo: crop.cropNameKo, region: farm.region, lat: farm.lat, lng: farm.lng,
    today: days[0] ?? null, week: days, demo, risks, stage, alerts, warnings, market,
    checklist: checklist.slice(0, 5), sources, disclaimer: DISCLAIMER,
  };
}
