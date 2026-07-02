/**
 * 계정·세션 라우트 — 가입(로그인) 코어 + 익명→계정 이관.
 *   POST /api/account/auth/start  : 인증 시작(검증기 seam — OTP 발송/리다이렉트). {challengeId}
 *   POST /api/account/auth/verify : 코드 검증 → 계정 find-or-create → 세션 발급. {session, accountId}
 *   GET  /api/account/me          : 세션→내 계정(미로그인 401)
 *   POST /api/account/logout      : 세션 파기
 *   POST /api/account/link-anon   : 로그인 세션 + 브라우저 anonId → 익명 일지를 계정으로 재귀속(이관)
 *
 *   보안: 원 식별자(전화/이메일/소셜ID)는 저장 안 함 — authRef.subjectHash(keyed-hash)만. 세션 토큰=무작위 불투명값.
 *   ⚠ 실제 인증 검증은 verifier seam(현재 MockVerifier·dev). 실제(SMS/OAuth/이메일) live는 HUMAN GATE.
 */
import * as crypto from "node:crypto";
import { json, readBody } from "../respond";
import { anonSubmitterId, assertPaidEntitlement } from "../../src/lansmark/policy/entitlement";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { sessionAccountUserId } from "../../src/lansmark/account/sessionStore";
import { sessionTokenFrom, sessionCookie, clearSessionCookie } from "../cookies";
import { hashPassword, verifyPassword, isValidUserId, isValidPassword, DUMMY_CRED } from "../../src/lansmark/account/password";
import type { RouteFn } from "../context";

const SESSION_TTL_MS = 30 * 24 * 3_600_000; // 30일
const METHODS = new Set(["phone", "kakao", "email"]); // 허용 검증기(화이트리스트) — 현재 phone만 동작, 카카오/이메일은 추후 드롭인

/**
 * 세션 토큰의 응답 바디 포함 여부(§3-1 하드닝 — 유료 과금 전 필수) — 브라우저에는 httpOnly Set-Cookie만.
 *   판별: 브라우저 fetch/XHR의 cross-site·same-origin POST는 Origin 헤더를 동봉한다(비브라우저 curl/서버/테스트는 없음).
 *   효과: 로그인 순간 XSS가 응답 바디에서 세션을 읽던 경로(S5 상쇄) 차단. 프론트는 바디 토큰을 안 읽음(쿠키 자동전송) — 무영향.
 *   비브라우저 API/테스트는 기존대로 {session} 수신(x-lansmark-session 헤더 폴백 흐름 유지).
 */
function sessionBody(req: import("node:http").IncomingMessage, token: string): { session?: string } {
  return req.headers.origin ? {} : { session: token };
}

/** 외부 식별자 → keyed-hash(평문 PII 미저장·오프라인 열거 차단). 시크릿은 사용처에서 직접 읽음(설정객체 비노출). */
function subjectHash(method: string, subject: string): string {
  // 계정 식별자 해시 전용 시크릿(있으면) — 엔티틀먼트 시크릿 회전이 계정 조회를 깨뜨리지 않게 분리(레드팀: 결합 완화).
  //   미설정 시 엔티틀먼트 시크릿로 폴백(새 HUMAN GATE 불필요). 빈 키는 bootSafety(운영 강제)+dev ephemeral로 도달 불가.
  const secret = process.env.LANSMARK_ACCOUNT_SECRET || process.env.LANSMARK_ENTITLEMENT_SECRET || "";
  return crypto.createHmac("sha256", secret).update(method + ":" + subject).digest("hex");
}

export const accountRoutes: RouteFn = async (ctx, req, res, url) => {
  const p = url.pathname;
  if (!p.startsWith("/api/account")) return false; // 빠른 탈출
  if (ctx.config.anonOnly) { json(res, 404, { error: "not found", path: p }); return true; } // 익명 모드: 계정/로그인 비활성(이메일·전화 미수집)

  // ── 인증 시작(검증기 seam) ──
  if (p === "/api/account/auth/start" && req.method === "POST") {
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; } // 원시 JSON(null/숫자 등)도 {}로 정규화 → 하위 검증서 400(500 방지)
    const method = typeof b.method === "string" ? b.method : "";
    const contact = typeof b.contact === "string" ? b.contact.trim().slice(0, 200) : "";
    if (!METHODS.has(method) || !contact) { json(res, 400, { error: "method·contact가 필요합니다.", code: "BAD_INPUT" }); return true; }
    let started;
    try { started = await ctx.verifier.start(method, contact); }
    catch (e) {
      const msg = (e as Error)?.message;
      if (msg === "BAD_PHONE") { json(res, 400, { error: "휴대폰 번호 형식이 올바르지 않습니다(예: 010-1234-5678).", code: "BAD_PHONE" }); return true; }
      if (msg === "BAD_EMAIL") { json(res, 400, { error: "이메일 형식이 올바르지 않습니다.", code: "BAD_EMAIL" }); return true; }
      json(res, 503, { error: "이 로그인 방식은 아직 구성되지 않았습니다.", code: "AUTH_NOT_CONFIGURED" }); return true; // 운영+발송키 없음 / 미지원 method
    }
    json(res, 200, { ok: true, challengeId: started.challengeId, devHint: started.devHint }); // devHint=dev 미발송 시 코드/링크(테스트용)
    return true;
  }

  // ── 인증 완료 → 계정 find-or-create → 세션 발급 ──
  if (p === "/api/account/auth/verify" && req.method === "POST") {
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; } // 원시 JSON(null/숫자 등)도 {}로 정규화 → 하위 검증서 400(500 방지)
    const challengeId = typeof b.challengeId === "string" ? b.challengeId : "";
    const code = typeof b.code === "string" ? b.code : "";
    if (!challengeId || !code) { json(res, 400, { error: "challengeId·code가 필요합니다.", code: "BAD_INPUT" }); return true; }
    const result = await ctx.verifier.verify(challengeId, code);
    if (!result) { json(res, 401, { error: "인증 실패(코드 불일치 또는 만료).", code: "AUTH_FAILED" }); return true; }
    const h = subjectHash(result.method, result.subject);
    let acct = ctx.accounts.findByAuthRef(result.method, h);
    let isNew = false;
    if (!acct) { // 신규 가입
      acct = { id: "acct_" + crypto.randomBytes(12).toString("hex"), createdAt: new Date().toISOString(), authRefs: [{ method: result.method, subjectHash: h }] };
      ctx.accounts.create(acct);
      ctx.analytics.signup(result.method); // 가입 추적(방법별·일별 — OPS 회원 섹션 · 이메일/휴대폰 구분)
      isNew = true;
    }
    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    ctx.sessions.create({ token, accountId: acct.id, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SESSION_TTL_MS).toISOString() });
    // S5: 세션을 httpOnly 쿠키로 발급(XSS가 토큰을 읽지 못함). 바디 토큰은 비브라우저 전용(§3-1 하드닝 — sessionBody).
    res.setHeader("Set-Cookie", sessionCookie(token, SESSION_TTL_MS / 1000, ctx.config.isProd)); // writeHead(json)와 병합 보존(다른 헤더명)
    ctx.logOps("계정", `로그인 ${isNew ? "신규" : "기존"} ${acct.id.slice(0, 12)}…`);
    json(res, 200, { ok: true, ...sessionBody(req, token), accountId: acct.id, isNew });
    return true;
  }

  // ── 아이디/비밀번호 가입 — 발송 인프라 0(가벼움) · 무한생성 금지(rate limit[sensitive]+중복차단+scrypt 비용) ──
  if (p === "/api/account/register" && req.method === "POST") {
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const userId = typeof b.userId === "string" ? b.userId.trim() : "";
    const password = typeof b.password === "string" ? b.password : "";
    const passwordConfirm = typeof b.passwordConfirm === "string" ? b.passwordConfirm : "";
    if (!isValidUserId(userId)) { json(res, 400, { error: "아이디는 영문·숫자·밑줄 4~20자입니다.", code: "BAD_USERID" }); return true; }
    if (!isValidPassword(password)) { json(res, 400, { error: "비밀번호는 8자 이상입니다.", code: "BAD_PASSWORD" }); return true; }
    if (password !== passwordConfirm) { json(res, 400, { error: "비밀번호 확인이 일치하지 않습니다.", code: "PASSWORD_MISMATCH" }); return true; }
    const h = subjectHash("password", userId.toLowerCase()); // 대소문자 무시(중복·로그인 일관) · 아이디 원문 미저장(해시만)
    if (ctx.accounts.findByAuthRef("password", h)) { json(res, 409, { error: "이미 사용 중인 아이디입니다.", code: "USERID_TAKEN" }); return true; } // 중복·무한생성 차단
    const { hash, salt } = hashPassword(password); // scrypt — 평문 비밀번호 미저장
    const acct = { id: "acct_" + crypto.randomBytes(12).toString("hex"), createdAt: new Date().toISOString(), authRefs: [{ method: "password", subjectHash: h, passwordHash: hash, salt }] };
    ctx.accounts.create(acct);
    ctx.analytics.signup("password");
    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    ctx.sessions.create({ token, accountId: acct.id, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SESSION_TTL_MS).toISOString() });
    res.setHeader("Set-Cookie", sessionCookie(token, SESSION_TTL_MS / 1000, ctx.config.isProd));
    ctx.logOps("계정", `가입(ID/PW) ${acct.id.slice(0, 12)}…`);
    json(res, 200, { ok: true, ...sessionBody(req, token), accountId: acct.id, isNew: true });
    return true;
  }

  // ── 아이디/비밀번호 로그인 — 아이디 없음·비번 불일치 모두 동일 401(계정 열거 방지) ──
  if (p === "/api/account/login" && req.method === "POST") {
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const userId = typeof b.userId === "string" ? b.userId.trim() : "";
    const password = typeof b.password === "string" ? b.password : "";
    if (!userId || !password) { json(res, 400, { error: "아이디·비밀번호가 필요합니다.", code: "BAD_INPUT" }); return true; }
    const h = subjectHash("password", userId.toLowerCase());
    const acct = ctx.accounts.findByAuthRef("password", h);
    const ref = acct?.authRefs.find((r) => r.method === "password" && r.subjectHash === h);
    // 타이밍 평탄화(계정 열거 차단) — 계정/자격이 없어도 DUMMY_CRED로 '동일 비용' scrypt를 돌린 뒤 실패 처리.
    //   응답시간 차이로 아이디 존재 여부를 추론하는 사이드채널을 막는다. valid=true면 acct·ref 존재 보장.
    const valid = ref?.passwordHash && ref.salt
      ? verifyPassword(password, ref.passwordHash, ref.salt)
      : (verifyPassword(password, DUMMY_CRED.hash, DUMMY_CRED.salt), false);
    if (!valid || !acct) { json(res, 401, { error: "아이디 또는 비밀번호가 올바르지 않습니다.", code: "AUTH_FAILED" }); return true; }
    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    ctx.sessions.create({ token, accountId: acct.id, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SESSION_TTL_MS).toISOString() });
    res.setHeader("Set-Cookie", sessionCookie(token, SESSION_TTL_MS / 1000, ctx.config.isProd));
    ctx.logOps("계정", `로그인(ID/PW) ${acct.id.slice(0, 12)}…`);
    json(res, 200, { ok: true, ...sessionBody(req, token), accountId: acct.id, isNew: false });
    return true;
  }

  // ── 내 계정(세션 필요) ──
  if (p === "/api/account/me" && req.method === "GET") {
    const uid = sessionAccountUserId(ctx.sessions, sessionTokenFrom(req));
    const acct = uid ? ctx.accounts.get(uid.slice("acct:".length)) : undefined;
    if (!acct) { json(res, 401, { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" }); return true; }
    const entitlements = acct.entitlements ?? [];
    const now = Date.now();
    const pro = entitlements.some((e) => !ctx.entitlement.isRevoked(e.jti) && (e.exp == null || e.exp > now)); // 비실효 + 미만료(레드팀 #1: 만료 후 pro 유지 차단)
    json(res, 200, { ok: true, accountId: acct.id, displayName: acct.displayName, createdAt: acct.createdAt, methods: acct.authRefs.map((r) => r.method), pro, entitlementCount: entitlements.length });
    return true;
  }

  // ── 유료권한 → 계정 연결: 로그인 세션 + 유효 엔티틀먼트 jti를 계정에 귀속(결제가 계정을 따라감) ──
  if (p === "/api/account/link-entitlement" && req.method === "POST") {
    const uid = sessionAccountUserId(ctx.sessions, sessionTokenFrom(req));
    const acct = uid ? ctx.accounts.get(uid.slice("acct:".length)) : undefined;
    if (!acct) { json(res, 401, { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" }); return true; }
    // 세션 계정을 함께 넘긴다(M8) — 결속 토큰은 '본인 계정으로 로그인'해야 검증 통과. 불일치는 403(타 계정 결속)으로 surface.
    let ent;
    try {
      ent = await assertPaidEntitlement({ get: (n) => { const v = req.headers[n.toLowerCase()]; return Array.isArray(v) ? (v[0] ?? null) : (v ?? null); } }, { sessionAccountId: acct.id });
    } catch (e: any) {
      if (e?.status === 403) { json(res, 403, { error: "이 유료권한은 다른 계정에 결속되어 있습니다.", code: "ENTITLEMENT_BOUND_OTHER" }); return true; } // 타 계정 결속 토큰 선점 차단(레드팀 #3·M8)
      json(res, 402, { error: "유료권한이 필요합니다.", code: "ENTITLEMENT_REQUIRED" }); return true;
    }
    const jti = ent.jti;
    if (!jti) { json(res, 402, { error: "유료권한이 필요합니다.", code: "ENTITLEMENT_REQUIRED" }); return true; }
    if (ctx.entitlement.isRevoked(jti)) { json(res, 402, { error: "실효된 유료권한입니다.", code: "ENTITLEMENT_REVOKED" }); return true; } // 죽은 토큰 연결 차단(레드팀 ③)
    if (ent.boundAccount && ent.boundAccount !== acct.id) { json(res, 403, { error: "이 유료권한은 다른 계정에 결속되어 있습니다.", code: "ENTITLEMENT_BOUND_OTHER" }); return true; } // 구매자 결속 위반 — bearer 토큰 선점 차단(레드팀 #3)
    // 원자적 연결(배타성+추가를 await 없는 단일 블록) — acct 스테일 클론 덮어쓰기 lost-update 회피(레드팀 #2/#4)
    const r = ctx.accounts.linkEntitlement(acct.id, { jti, exp: ent.exp });
    if (r === "taken") { json(res, 409, { error: "이미 다른 계정에 연결된 유료권한입니다.", code: "ENTITLEMENT_TAKEN" }); return true; } // 1 jti = 1 계정(결제 증식 차단·레드팀 ③)
    if (r === "notfound") { json(res, 401, { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" }); return true; }
    ctx.logOps("계정", `유료권한 연결 ${acct.id.slice(0, 12)}… jti=${jti.slice(0, 16)}…`); // 감사로그(레드팀 ②)
    json(res, 200, { ok: true, linked: jti });
    return true;
  }

  // ── 로그아웃(세션 파기) ──
  if (p === "/api/account/logout" && req.method === "POST") {
    const tok = sessionTokenFrom(req);
    if (tok) ctx.sessions.delete(tok);
    res.setHeader("Set-Cookie", clearSessionCookie(ctx.config.isProd)); // S5: httpOnly 세션 쿠키 파기
    json(res, 200, { ok: true });
    return true;
  }

  // ── 익명 → 계정 이관: 로그인 세션 + 브라우저 anonId → 익명 일지를 계정으로 재귀속 ──
  if (p === "/api/account/link-anon" && req.method === "POST") {
    const uid = sessionAccountUserId(ctx.sessions, sessionTokenFrom(req));
    if (!uid) { json(res, 401, { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" }); return true; }
    const anonId = anonSubmitterId(req.headers["x-lansmark-anon"]); // 헤더 없으면 요청별 임시신원 → 이관 0(안전)
    const entries = ctx.journal.listByUser(anonId);
    let linked = 0;
    for (const e of entries) { e.userId = uid; ctx.journal.update(e); linked++; } // anon-Y → acct:Z 재귀속
    if (linked) ctx.logOps("계정", `익명→계정 일지 ${linked}건 이관 ${uid.slice(0, 16)}…`);
    json(res, 200, { ok: true, linked });
    return true;
  }

  return false; // /api/account* 이지만 매칭 메서드 없음 → 라우터가 404
};
