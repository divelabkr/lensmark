/**
 * 브리핑 → 푸시 메시지 조립 — '아침 브리핑' 웹푸시의 제목·본문을 만든다(순수·결정적).
 *   원칙(가드레일): 푸시에는 소득·수익 수치를 싣지 않는다(보장 오인 소지) — 날씨 위험·할 일·특보만.
 *   제목 우선순위: KMA 특보 > warn 위험 > watch 위험 > 평온(오늘의 브리핑). 클릭하면 앱 브리핑 홈(/app).
 */
import type { DailyBriefing } from "./dailyBriefing";
import type { PushMessage } from "../integrations/push";

const TITLE_MAX = 60;  // 플랫폼별 잘림 고려(짧고 행동 유도)
const BODY_MAX = 160;  // 알림 본문 상한(초과분 말줄임)

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/**
 * 내 농장 1곳의 브리핑 → 푸시 1건. extraFarms=요약에 못 담은 나머지 농장 수(N곳 더).
 *   예: 제목 "🌾 사과 · 서리·저온 주의" / 본문 "-1~7℃ · 부직포·보온·방상 대비 · 할 일 3건 (+1곳 더)"
 */
export function briefingPushMessage(b: DailyBriefing, totalFarms = 1): PushMessage {
  // 제목 — 가장 급한 것 하나만(특보 > 경계 > 주의 > 평온).
  const warn = b.risks.find((r) => r.severity === "warn") ?? b.risks[0];
  let headline: string;
  if (b.warnings.length) headline = `📢 ${b.warnings[0]}`;
  else if (warn) headline = warn.title;
  else headline = "오늘의 브리핑";
  const title = cut(`🌾 ${b.cropNameKo} · ${headline}`, TITLE_MAX);

  // 본문 — 오늘 기온 요약 + 첫 할 일 + 나머지 건수(+다른 농장 수).
  const parts: string[] = [];
  if (b.today) parts.push(`${Math.round(b.today.minC)}~${Math.round(b.today.maxC)}℃${b.today.rainMm >= 1 ? ` · 비 ${Math.round(b.today.rainMm)}mm` : ""}`);
  if (b.checklist.length) parts.push(b.checklist[0]);
  if (b.checklist.length > 1) parts.push(`할 일 ${b.checklist.length}건`);
  const more = totalFarms - 1;
  const body = cut(parts.join(" · ") + (more > 0 ? ` (+${more}곳 더)` : ""), BODY_MAX) || "오늘 내 농장 브리핑을 확인하세요.";

  return { title, body, url: "/app" }; // 클릭 → 앱(브리핑 홈이 첫 화면)
}
