/**
 * 서버 설정(단일 출처) + 부팅 안전점검.
 *   책임: 환경변수(.env) → 타입이 있는 Config 객체로 1회 파싱. 라우트/미들웨어는 이 객체만 본다(env 직접 접근 금지).
 *   비밀값(TOSS_SECRET_KEY·PG_WEBHOOK_SECRET·ENTITLEMENT_SECRET)은 Config에 담지 않고 사용처에서 process.env로 직접 읽는다(로그 유출 방지).
 */
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import * as crypto from "node:crypto";
import { parseOrigins, type OriginPolicy } from "../src/lansmark/api/security";
import { pgRegistry, pgPresenceFromEnv, type PgKind } from "../src/lansmark/payment/pgRegistry";
import { dataKey } from "../src/lansmark/db/atRest"; // at-rest 키 형식검증 SSOT(hex64) — 부팅서 형식까지 강제

/**
 * `.env` 로더(의존성 0) — `KEY=VALUE` 줄만 파싱. **이미 설정된 env는 보존**(12-factor: 플랫폼 주입 우선).
 *   운영은 보통 플랫폼 env를 쓰므로 .env 없으면 무동작. dev는 .env로 "키 꽂으면 운영"이 그대로 작동.
 */
export function loadDotenv(file = join(process.cwd(), ".env")): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export interface Config {
  port: number;
  dataMode: string;              // auto | mock | live
  vworldKey: string | undefined; // 있으면 위성/하이브리드 타일 URL 제공
  tossClientKey: string | undefined; // 있으면 결제 live, 없으면 mock 결제(데모)
  paypalClientId: string | undefined; // PayPal client id(있으면 PayPal 결제 노출 — 비밀키는 사용처서 env 직접)
  simPriceKrw: number;           // 정밀분석 단가
  requireEntitlement: boolean;   // 유료 게이트(기본 on)
  anonOnly: boolean;             // 익명 모드: 회원가입·전화/푸시 구독 비활성(PII 미수집 — 무료 쓰임검증 배포)
  adminToken: string | undefined; // 운영 콘솔 관리자 토큰(미설정=개발 오픈)
  corsAllow: OriginPolicy;       // '*' 또는 허용 도메인 목록
  rateGlobal: number;            // /api/* 분당 요청 상한
  rateSensitive: number;         // 결제·시뮬·피드백·웹훅 분당 상한
  rateWindowMs: number;          // 레이트리밋 창 크기
  trustProxyHops: number;        // 신뢰 프록시 홉 수(0=XFF 무시·소켓IP만). 운영 nginx/CF 뒤면 1+
  allowOpenCors: boolean;        // 운영에서 CORS '*' 명시 허용(부팅차단 우회)
  allowOpenConsole: boolean;     // 운영에서 무인증 콘솔 명시 허용(부팅차단 우회)
  entitlementTtlMs: number;      // 유료권한 토큰 수명(기본 30일)
  entitlementQuota: number;      // 토큰당 정밀시뮬 허용 횟수(소진형 — 무한사용 차단)
  secretEphemeral: boolean;      // 시크릿 미설정으로 부팅마다 임시 랜덤 사용중(비운영)
  storeMode: "memory" | "file" | "firestore"; // 상태 영속: memory(휘발) | file(재시작 내구·단일인스턴스) | firestore(재배포 내구·Cloud Run)
  dataDir: string;               // file 모드 데이터 디렉터리(절대경로)
  dashboardDir: string;          // 정적 HTML(앱/콘솔) 디렉터리(절대경로)
  appOrigin: string;             // 앱 외부 절대 URL(이메일 매직링크 등) — LANSMARK_APP_ORIGIN, dev는 http://localhost:port
  isProd: boolean;               // NODE_ENV==='production'
}

/** 환경변수를 읽어 Config를 구성한다. */
export function loadConfig(): Config {
  loadDotenv(join(__dirname, "..", ".env")); // 프로젝트 루트 .env (실행 cwd와 무관 — 프리뷰/런치 환경서도 동일)
  const isProd = process.env.NODE_ENV === "production";
  // 유료권한 서명 시크릿: 운영은 명시적 강한 시크릿 필수(미설정→bootSafety가 부팅차단).
  //  비운영 미설정 시엔 "부팅마다 임시 랜덤"을 주입한다 — 소스에 공개된 고정 기본값을 없애 토큰 위조(레드팀 H2)를 차단.
  let secretEphemeral = false;
  if (!process.env.LANSMARK_ENTITLEMENT_SECRET) {
    if (!isProd) { process.env.LANSMARK_ENTITLEMENT_SECRET = crypto.randomBytes(32).toString("hex"); secretEphemeral = true; }
    // isProd면 미설정 그대로 → bootSafety가 차단(임시 랜덤은 다중인스턴스·재시작에서 토큰 불일치라 운영 부적합).
  }
  return {
    port: Number(process.env.PORT ?? 8787),
    dataMode: (process.env.LANSMARK_DATA_MODE ?? "auto").toLowerCase(),
    vworldKey: process.env.VWORLD_API_KEY,
    tossClientKey: process.env.TOSS_CLIENT_KEY,
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
    simPriceKrw: Number(process.env.LANSMARK_SIM_PRICE_KRW || 4900),
    requireEntitlement: (process.env.LANSMARK_REQUIRE_ENTITLEMENT ?? "true") !== "false",
    anonOnly: process.env.LANSMARK_ANON_ONLY === "1", // 익명 PII-0 모드(회원가입·구독 비활성)

    adminToken: process.env.LANSMARK_ADMIN_TOKEN,
    corsAllow: parseOrigins(process.env.LANSMARK_CORS_ORIGIN),
    rateGlobal: Number(process.env.LANSMARK_RATE_GLOBAL || 240),
    rateSensitive: Number(process.env.LANSMARK_RATE_SENSITIVE || 30),
    rateWindowMs: 60_000,
    trustProxyHops: Math.max(0, Math.floor(Number(process.env.LANSMARK_TRUST_PROXY_HOPS || 0)) || 0),
    allowOpenCors: process.env.LANSMARK_ALLOW_OPEN_CORS === "1",
    allowOpenConsole: process.env.LANSMARK_ALLOW_OPEN_CONSOLE === "1",
    entitlementTtlMs: Math.max(1, Number(process.env.LANSMARK_ENTITLEMENT_TTL_HOURS || 720)) * 3_600_000, // 기본 30일
    entitlementQuota: Math.max(1, Math.floor(Number(process.env.LANSMARK_ENTITLEMENT_QUOTA || 50))),
    secretEphemeral,
    // 영속: 명시(LANSMARK_STORE) > 테스트(vitest)는 memory(결정성) > 그 외 기본 file(재시작 내구)
    storeMode: (process.env.LANSMARK_STORE === "memory" || process.env.LANSMARK_STORE === "file" || process.env.LANSMARK_STORE === "firestore")
      ? process.env.LANSMARK_STORE
      : (process.env.VITEST ? "memory" : "file"),
    dataDir: process.env.LANSMARK_DATA_DIR || join(__dirname, "..", ".data"), // 프로젝트 루트 .data (cwd 무관)
    dashboardDir: join(__dirname, "..", "dashboard"), // server/ 기준 → 저장소 루트의 dashboard/
    // 매직링크 절대 URL의 출처. 운영은 LANSMARK_APP_ORIGIN(예: https://lensmark.kr) 필수(미설정 시 localhost라 외부메일 링크 깨짐 → 발송 승격은 HUMAN GATE라 그 전 무해).
    appOrigin: (process.env.LANSMARK_APP_ORIGIN || `http://localhost:${Number(process.env.PORT ?? 8787)}`).replace(/\/$/, ""),
    isProd,
  };
}

/**
 * 결제 요약(health·ops 공통 형태) + PG 스위칭 상태.
 *   mode(live/mock)는 기존 호환(Toss 중심 표시). pg = Toss·PayPal 레지스트리(활성·선호·provider별 상태).
 *   pgPreference = 운영자 런타임 선호(ops 토글). 미지정이면 자동(live 중 toss>paypal).
 */
export function paymentSummary(config: Config, pgPreference: PgKind | null = null) {
  const reg = pgRegistry(pgPresenceFromEnv(), pgPreference);
  return {
    mode: config.tossClientKey ? "live" : "mock",
    requireEntitlement: config.requireEntitlement,
    priceKrw: config.simPriceKrw,
    pg: { active: reg.active, preference: reg.preference, providers: reg.providers, enabled: reg.enabledKinds },
  };
}

/**
 * 부팅 안전점검 — 운영(NODE_ENV=production)은 fail-closed: 위험 기본설정이면 부팅을 차단(process.exit).
 *   차단 대상(각각 명시적 우회 플래그 있음): ① 강한 시크릿 미설정 ② CORS 전체허용(*) ③ 무인증 콘솔.
 *   비운영은 경고만(개발 편의). — 레드팀 H2/H5/M1 대응.
 */
export function bootSafety(config: Config): void {
  const secret = process.env.LANSMARK_ENTITLEMENT_SECRET || "";
  if (config.secretEphemeral) {
    console.warn("[lansmark][SECURITY] ENTITLEMENT_SECRET 미설정 — 이번 부팅용 임시 랜덤 시크릿 사용(재시작 시 기존 토큰 무효). 운영은 .env에 고정 시크릿 필수.");
  }
  if (config.isProd) {
    const fails: string[] = [];
    if ((!secret || secret.length < 16) && process.env.LANSMARK_ALLOW_DEFAULT_SECRET !== "1")
      fails.push("LANSMARK_ENTITLEMENT_SECRET(≥16자 강한 랜덤) 미설정 — 토큰 위조 위험");
    if (config.corsAllow === "*" && !config.allowOpenCors)
      fails.push("CORS 전체허용(*) — LANSMARK_CORS_ORIGIN 지정 또는 LANSMARK_ALLOW_OPEN_CORS=1");
    if (!config.adminToken && !config.allowOpenConsole)
      fails.push("LANSMARK_ADMIN_TOKEN 미설정(운영 콘솔/통계 공개) — 설정 또는 LANSMARK_ALLOW_OPEN_CONSOLE=1");
    // 유료 게이트를 끄면(무료 베타) 정밀시뮬·가이드·외래·피드백·재배일지가 무인증 개방된다.
    //   완화: 재배일지·실측은 '브라우저 익명ID(anon-*)'로 사용자별 격리(IDOR 차단·레드팀 H1), '✓검증' 배지는 인증 제출만 인정(위조 차단).
    //   그래도 비인증 단계(추측불가 격리 ≠ 암호학적 인증)이므로 운영 노출은 명시 동의(ALLOW_OPEN_PAID=1)를 요구 → 실수 차단.
    if (!config.requireEntitlement && process.env.LANSMARK_ALLOW_OPEN_PAID !== "1")
      fails.push("LANSMARK_REQUIRE_ENTITLEMENT=false (유료 게이트 우회·무료 베타) — 의도면 LANSMARK_ALLOW_OPEN_PAID=1, 아니면 제거");
    // 라이브 결제 키 정합(P2 C#6) — 클라 키만 있고 서버 비밀/웹훅 시크릿이 없으면 결제·웹훅 검증이 런타임에야 깨진다(부팅서 차단).
    // PG 키 정합(P2 C#6 + 감사 config-boot-1) — 레지스트리 SSOT 기준 일관 차단(어느 키가 빠졌든·향후 PG 추가도 자동 포함).
    //   pending(반쪽설정=결제 불가)은 전수 차단 + live인데 웹훅 미설정(비동기 결제확인 위조검증 불가)도 운영 차단.
    for (const pr of pgRegistry(pgPresenceFromEnv()).providers) {
      if (pr.state === "pending") fails.push(`${pr.label} 결제 키 일부만 설정(${pr.missing.join("·")}) — 결제 불가(fail-closed). 키 완비 또는 전부 제거`);
      else if (pr.state === "live" && !pr.webhookReady) fails.push(`${pr.label} 웹훅 키 미설정 — 비동기 결제확인 위조검증 불가(라이브 결제면 필수)`);
    }
    // at-rest 키(P2 C#5/#6) — 미설정 시 전화번호·일지좌표 등 PII가 평문 저장된다. 명시 동의 없으면 차단(deploy.sh는 DATA_KEY 주입).
    // PII at-rest 키(P2 C#5/#6 + 배포 테스트 발견) — 미설정이면 평문 저장 차단. ★형식(hex64)도 검증:
    //   형식 틀린 키는 dataKey()가 null 반환 → '조용히 평문'(at-rest 무력화)이라 배포 footgun. 부팅서 차단(fail-closed).
    const _dk = process.env.LANSMARK_DATA_KEY;
    if (!_dk && process.env.LANSMARK_ALLOW_PLAINTEXT_PII !== "1")
      fails.push("LANSMARK_DATA_KEY 미설정 — PII 평문 저장(at-rest 미암호화). 키 주입 또는 의도면 LANSMARK_ALLOW_PLAINTEXT_PII=1");
    else if (_dk && !dataKey())
      fails.push("LANSMARK_DATA_KEY 형식 오류 — hex 64자(32B)여야 at-rest 암호화가 적용된다. 현재 키는 무시되어 PII가 평문 저장됨(조용한 실패 차단).");
    if (fails.length) {
      console.error("[lansmark][SECURITY] 운영 부팅 차단:\n - " + fails.join("\n - "));
      process.exit(1);
    }
  } else {
    if (config.corsAllow === "*") console.warn("[lansmark][SECURITY] CORS 전체 허용(*) — 운영은 LANSMARK_CORS_ORIGIN 로 도메인 제한 권장.");
    if (!config.adminToken) console.warn("[lansmark][SECURITY] LANSMARK_ADMIN_TOKEN 미설정 — 운영 콘솔(/ops·/api/ops/stats) 공개(개발 오픈).");
    if (!config.requireEntitlement) console.warn("[lansmark][SECURITY] LANSMARK_REQUIRE_ENTITLEMENT=false — 유료 게이트 비활성(무료 베타). 일지·실측은 익명ID 격리·검증은 인증한정. 운영은 ALLOW_OPEN_PAID=1 명시.");
  }
}
