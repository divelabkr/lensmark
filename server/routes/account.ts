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
import { anonSubmitterId } from "../../src/lansmark/policy/entitlement";
import { sessionAccountUserId } from "../../src/lansmark/account/sessionStore";
import type { RouteFn } from "../context";

const SESSION_TTL_MS = 30 * 24 * 3_600_000; // 30일
const METHODS = new Set(["mock", "phone", "kakao", "email"]); // 허용 검증기(화이트리스트)

/** 외부 식별자 → keyed-hash(평문 PII 미저장·오프라인 열거 차단). 시크릿은 사용처에서 직접 읽음(설정객체 비노출). */
function subjectHash(method: string, subject: string): string {
  const secret = process.env.LANSMARK_ENTITLEMENT_SECRET || "";
  return crypto.createHmac("sha256", secret).update(method + ":" + subject).digest("hex");
}

export const accountRoutes: RouteFn = async (ctx, req, res, url) => {
  const p = url.pathname;
  if (!p.startsWith("/api/account")) return false; // 빠른 탈출

  // ── 인증 시작(검증기 seam) ──
  if (p === "/api/account/auth/start" && req.method === "POST") {
    let b: any = {};
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const method = typeof b.method === "string" ? b.method : "";
    const contact = typeof b.contact === "string" ? b.contact.trim().slice(0, 200) : "";
    if (!METHODS.has(method) || !contact) { json(res, 400, { error: "method·contact가 필요합니다.", code: "BAD_INPUT" }); return true; }
    let started;
    try { started = await ctx.verifier.start(method, contact); }
    catch { json(res, 503, { error: "로그인이 아직 구성되지 않았습니다.", code: "AUTH_NOT_CONFIGURED" }); return true; } // 운영 DisabledVerifier(실제 검증기 HUMAN GATE 전)
    json(res, 200, { ok: true, challengeId: started.challengeId, devHint: started.devHint }); // devHint는 dev에서만 의미
    return true;
  }

  // ── 인증 완료 → 계정 find-or-create → 세션 발급 ──
  if (p === "/api/account/auth/verify" && req.method === "POST") {
    let b: any = {};
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
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
      isNew = true;
    }
    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    ctx.sessions.create({ token, accountId: acct.id, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SESSION_TTL_MS).toISOString() });
    ctx.logOps("계정", `로그인 ${isNew ? "신규" : "기존"} ${acct.id.slice(0, 12)}…`);
    json(res, 200, { ok: true, session: token, accountId: acct.id, isNew });
    return true;
  }

  // ── 내 계정(세션 필요) ──
  if (p === "/api/account/me" && req.method === "GET") {
    const uid = sessionAccountUserId(ctx.sessions, req.headers["x-lansmark-session"]);
    const acct = uid ? ctx.accounts.get(uid.slice("acct:".length)) : undefined;
    if (!acct) { json(res, 401, { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" }); return true; }
    json(res, 200, { ok: true, accountId: acct.id, displayName: acct.displayName, createdAt: acct.createdAt, methods: acct.authRefs.map((r) => r.method) });
    return true;
  }

  // ── 로그아웃(세션 파기) ──
  if (p === "/api/account/logout" && req.method === "POST") {
    const tok = req.headers["x-lansmark-session"];
    if (typeof tok === "string" && tok) ctx.sessions.delete(tok);
    json(res, 200, { ok: true });
    return true;
  }

  // ── 익명 → 계정 이관: 로그인 세션 + 브라우저 anonId → 익명 일지를 계정으로 재귀속 ──
  if (p === "/api/account/link-anon" && req.method === "POST") {
    const uid = sessionAccountUserId(ctx.sessions, req.headers["x-lansmark-session"]);
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
