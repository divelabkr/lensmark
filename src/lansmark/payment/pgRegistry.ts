/**
 * PG(결제대행) 레지스트리 — Toss·PayPal '스위칭'의 단일 출처(SSOT).
 *   책임: 각 PG의 키 존재(presence)만으로 상태(live/pending/off)와 '활성(기본) 결제수단'을 결정한다.
 *         체크아웃 노출 목록·ops 표시·부팅 점검이 전부 이 한 곳을 본다(정직 라벨: 키 없으면 live 아님).
 *   왜 순수함수인가: 부팅·런타임·테스트가 같은 입력→같은 판정(검증가능)이도록. Date/env 직접접근 금지.
 *   ⚠ 비밀키 '값'은 여기서 읽지 않는다(presence boolean만 입력) — 로그·객체 유출 방지(config 규칙과 동일).
 */

export type PgKind = "toss" | "paypal";
//  off     = 결제 키 전무(이 PG 비활성). Toss가 off면 mock 데모결제로 폴백.
//  pending = 일부 키만 설정(예: client만) — 운영 부팅차단 대상. 결제 불가(fail-closed).
//  live    = client+secret(+webhook) 완비 → 실결제 가능.
export type PgState = "live" | "pending" | "off";

export interface PgProviderInfo {
  kind: PgKind;
  label: string;        // 사용자/운영 표시명
  state: PgState;
  enabled: boolean;     // 체크아웃 노출(= live·결제 가능)
  missing: string[];    // pending 사유(부족 키 env명)
  webhookReady: boolean; // 웹훅 서명검증 가능(별도 readiness) — live여도 false 가능(동기결제는 webhook 불요·운영은 부팅차단). 정직 라벨용.
  note: string;         // 정직 라벨
}

/** 각 PG의 키 존재 플래그(비밀값 아님 — boolean만). config/auto가 process.env에서 채워 넘긴다. */
export interface PgPresence {
  tossClient: boolean; tossSecret: boolean; tossWebhook: boolean;
  paypalClient: boolean; paypalSecret: boolean; paypalWebhook: boolean;
}

export interface PgRegistry {
  providers: PgProviderInfo[];
  active: PgKind | null;     // 기본(활성) 결제수단 — live 중 preference 우선, 없으면 우선순위(toss>paypal). 둘 다 off면 null(=mock 데모).
  preference: PgKind | null; // 운영자 선호(런타임 토글). live가 아니면 무시되고 active는 자동 선택.
  enabledKinds: PgKind[];    // 체크아웃 노출 목록(live인 것)
}

/**
 * 한 PG의 상태 판정 — '결제 가능 여부'(client+secret)를 SSOT로, webhook은 별도 readiness(감사 pg-switch-statemachine-1·정직성).
 *   off    : client·secret 둘 다 없음(결제 불가·미설정). webhook만 있는 orphan도 off.
 *   pending: client·secret 중 한쪽만(반쪽설정 — 결제 불가·운영 부팅차단).
 *   live   : client+secret(결제 가능). webhookReady=webhook 유무(live여도 false 가능 — 라벨에 정직 노출, 운영은 부팅차단).
 *   ⚠ '결제 가능 = client+secret'은 런타임 게이트(paypalConfigured·confirm secretKey)와 동일 기준 —
 *     라벨(state)과 실제 발급 능력이 어긋나지 않게 일치(레지스트리=거짓라벨 금지). webhook 요구는 운영 부팅정책으로 별도 강제.
 */
function evalProvider(
  kind: PgKind, label: string,
  client: boolean, secret: boolean, webhook: boolean,
  keyNames: { client: string; secret: string; webhook: string },
  offNote: string,
): PgProviderInfo {
  const canPay = client && secret; // create/capture/confirm가 실제로 요구하는 키. webhook은 비동기 확인용(별도).
  if (!client && !secret) // 결제 키 전무 = off. webhook만 설정된 orphan은 무의미(역시 결제 불가).
    return { kind, label, state: "off", enabled: false, missing: [], webhookReady: webhook, note: webhook ? offNote + " (웹훅키만 설정·무의미)" : offNote };
  if (!canPay) { // client·secret 한쪽만 = 결제 불가(반쪽) = pending. 운영 부팅차단 대상.
    const missing: string[] = [];
    if (!client) missing.push(keyNames.client);
    if (!secret) missing.push(keyNames.secret);
    return { kind, label, state: "pending", enabled: false, missing, webhookReady: webhook, note: `결제 키 일부만 설정(${missing.join("·")}) — 결제 불가(fail-closed)` };
  }
  // client+secret = 결제 가능(live). webhook 유무는 라벨·readiness로 정직 노출(state는 live — 동기결제는 webhook 불요).
  return webhook
    ? { kind, label, state: "live", enabled: true, missing: [], webhookReady: true, note: "실결제 가능(키 완비)" }
    : { kind, label, state: "live", enabled: true, missing: [], webhookReady: false, note: "결제 가능 · ⚠ 웹훅 미설정(비동기 확인 위조검증 불가 — 운영은 부팅 차단)" };
}

/**
 * 스위칭 판정(순수). preference가 live면 그것이 active, 아니면 live 중 우선순위(toss>paypal), 둘 다 off면 null.
 *   preference가 'pending/off'면 무시 → 운영자가 키 없는 PG로 잘못 전환하는 사고를 차단(자동 폴백).
 */
export function pgRegistry(p: PgPresence, preference: PgKind | null = null): PgRegistry {
  const toss = evalProvider("toss", "토스페이먼츠", p.tossClient, p.tossSecret, p.tossWebhook,
    { client: "TOSS_CLIENT_KEY", secret: "TOSS_SECRET_KEY", webhook: "PG_WEBHOOK_SECRET" },
    "키 전무 — 데모(mock) 결제로 폴백");
  const paypal = evalProvider("paypal", "PayPal", p.paypalClient, p.paypalSecret, p.paypalWebhook,
    { client: "PAYPAL_CLIENT_ID", secret: "PAYPAL_SECRET", webhook: "PAYPAL_WEBHOOK_ID" },
    "키 전무 — 비활성");
  const providers = [toss, paypal];
  const liveKinds = providers.filter((x) => x.state === "live").map((x) => x.kind);
  // active: preference(live 한정) > toss(live) > paypal(live) > null
  let active: PgKind | null = null;
  if (preference && liveKinds.includes(preference)) active = preference;
  else if (liveKinds.includes("toss")) active = "toss";
  else if (liveKinds.length) active = liveKinds[0];
  return { providers, active, preference: preference ?? null, enabledKinds: liveKinds };
}

/** 비순수 어댑터 — process.env에서 presence(boolean만) 추출. core(pgRegistry)와 분리(테스트는 순수함수 직접 호출). */
export function pgPresenceFromEnv(): PgPresence {
  const k = (n: string) => !!process.env[n];
  return {
    tossClient: k("TOSS_CLIENT_KEY"), tossSecret: k("TOSS_SECRET_KEY"), tossWebhook: k("PG_WEBHOOK_SECRET"),
    paypalClient: k("PAYPAL_CLIENT_ID"), paypalSecret: k("PAYPAL_SECRET"), paypalWebhook: k("PAYPAL_WEBHOOK_ID"),
  };
}
