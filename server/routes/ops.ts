/**
 * 운영 라우트 — 콘솔용 통계(읽기 전용 · 시크릿 미노출) + 토큰 실효.
 *   GET  /api/ops/stats  : 플라이휠·사용량·결제·최근활동·설정. 관리자 인증(adminOk) 게이트.
 *   POST /api/ops/revoke : 유료권한 토큰 실효(환불/분쟁 시 무력화) — jti 기반(레드팀 H4 revoke 배선).
 */
import { json, readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { adminOk } from "../middleware";
import { VALIDATED_THRESHOLD } from "../../src/lansmark/core/calibration"; // 검증 판정 SSOT(임계) — ops도 동일 기준
import type { Ctx, RouteFn } from "../context";
import type * as http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

// 앱 첫로드 페이로드(최적화 트리거) — over-the-wire 비용. 파일 변경(mtime) 시에만 재계산(gzip 비쌈) → 운영선 1회.
let _payloadCache: { mtimeMs: number; rawKB: number; gzipKB: number } | null = null;
function appPayloadKB(dir: string): { rawKB: number; gzipKB: number } {
  try {
    const p = join(dir, "lansmark_app.html");
    const st = statSync(p);
    if (!_payloadCache || _payloadCache.mtimeMs !== st.mtimeMs) {
      const buf = readFileSync(p);
      _payloadCache = { mtimeMs: st.mtimeMs, rawKB: Math.round(buf.length / 1024), gzipKB: Math.round(gzipSync(buf).length / 1024) };
    }
    return { rawKB: _payloadCache.rawKB, gzipKB: _payloadCache.gzipKB };
  } catch { return { rawKB: 0, gzipKB: 0 }; }
}

/**
 * ops '쓰기'(revoke·paid-gate) 공통 가드(감사 M4) — 읽기(stats)와 분리.
 *   ① 운영+토큰미설정이면 거부(ALLOW_OPEN_CONSOLE은 통계 공개일 뿐, 쓰기까지 열지 않는다)
 *   ② 관리자 토큰 검증(adminOk) ③ Content-Type: application/json 요구(단순요청 cross-origin POST=CSRF 차단)
 *   반환 true = 차단됨(응답 종료). false = 통과.
 */
function blockedOpsMutation(req: http.IncomingMessage, res: any, ctx: Ctx): boolean {
  if (ctx.config.isProd && !ctx.config.adminToken) { json(res, 403, { error: "운영 쓰기는 관리자 토큰이 필요합니다(콘솔 공개로 열리지 않음).", code: "ADMIN_TOKEN_REQUIRED" }); return true; }
  if (!adminOk(req, ctx)) { json(res, 401, { error: "관리자 인증 필요", code: "ADMIN_REQUIRED" }); return true; }
  const ct = String(req.headers["content-type"] || "");
  if (!ct.includes("application/json")) { json(res, 415, { error: "Content-Type: application/json 이 필요합니다.", code: "BAD_CONTENT_TYPE" }); return true; } // CSRF(단순요청) 차단
  return false;
}

export const opsRoutes: RouteFn = async (ctx, req, res, url) => {
  // 토큰 실효(환불/분쟁) — 관리자 전용 쓰기. revoke 능력을 실제 운영 경로에 연결.
  if (url.pathname === "/api/ops/revoke" && req.method === "POST") {
    if (blockedOpsMutation(req, res, ctx)) return true;
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; } // 원시 JSON도 {}로 정규화(500 방지)
    const jti = typeof b.jti === "string" ? b.jti.trim() : "";
    if (!jti) { json(res, 400, { error: "jti가 필요합니다.", code: "JTI_REQUIRED" }); return true; }
    ctx.entitlement.revoke(jti);
    ctx.logOps("실효", `엔티틀먼트 실효 jti=${jti.slice(0, 12)}…`);
    // firestore: 실효를 '원격 반영 후' 응답(H3) — durable:false면 운영자가 재시도/인지. file/memory는 flush 동기라 항상 durable.
    let durable = true;
    try { await ctx.entitlement.persistRevokedNow?.(); } catch { durable = false; }
    json(res, 200, { ok: true, revoked: jti, durable, revokedTotal: ctx.entitlement.revokedSize() });
    return true;
  }

  // 유료 게이트 런타임 토글(영속) — 무료 베타 ON↔OFF. 관리자 전용 쓰기. 재시작 없이 전환.
  if (url.pathname === "/api/ops/paid-gate" && req.method === "POST") {
    if (blockedOpsMutation(req, res, ctx)) return true;
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; } // 원시 JSON도 {}로 정규화(500 방지)
    if (typeof b.requireEntitlement !== "boolean") { json(res, 400, { error: "requireEntitlement(boolean)이 필요합니다.", code: "BAD_VALUE" }); return true; }
    // 운영에서 유료 게이트 끄기(무료 개방)는 명시 env 동의 필요 — bootSafety와 동일 가드로 런타임 우회·실수 차단.
    if (b.requireEntitlement === false && ctx.config.isProd && process.env.LANSMARK_ALLOW_OPEN_PAID !== "1") {
      json(res, 400, { error: "운영에서 유료 게이트 비활성(무료 개방)은 LANSMARK_ALLOW_OPEN_PAID=1 설정이 필요합니다.", code: "OPEN_PAID_NOT_ACKED" }); return true;
    }
    // H2: 엔티틀먼트 스토어가 비정상(firestore 워밍 실패=sealed·빈 상태)일 때 유료 게이트 ON 거부 —
    //   빈 revoked로 실효 토큰이 통과하고 revoke가 무음 실패하는 상태에서 과금을 켜지 않는다(fail-closed).
    if (b.requireEntitlement === true && ctx.entitlement.isDegraded?.()) {
      json(res, 409, { error: "엔티틀먼트 영속이 비정상(워밍 실패) 상태 — 유료 게이트를 켤 수 없습니다. 복구 후 재시도하세요.", code: "STORE_DEGRADED" }); return true;
    }
    ctx.config.requireEntitlement = b.requireEntitlement;          // 즉시 반영(요청 readers가 ctx.config 경유)
    ctx.runtimeFlags.setRequireEntitlement(b.requireEntitlement);  // 영속(재시작 보존 — firestore/file)
    ctx.logOps("게이트", `유료 게이트 ${b.requireEntitlement ? "ON(유료)" : "OFF(무료 베타)"}`);
    json(res, 200, { ok: true, requireEntitlement: ctx.config.requireEntitlement });
    return true;
  }

  if (url.pathname !== "/api/ops/stats") return false;
  if (!adminOk(req, ctx)) { json(res, 401, { error: "관리자 인증 필요", code: "ADMIN_REQUIRED" }); return true; }

  const rows = ctx.feedbackStore.all();
  const byCrop: Record<string, number> = {};
  let withActuals = 0;
  // 작물·지형버킷별 집계(검증=실측 5건↑)
  const bk: Record<string, { cropId: string; bucket: string; n: number; actuals: number; submitters: Set<string> }> = {};
  for (const r of rows) {
    byCrop[r.cropId] = (byCrop[r.cropId] ?? 0) + 1;
    if (r.actualYieldKg != null) withActuals++;
    const key = r.cropId + "|" + (r.terrainBucket ?? "-");
    const e = bk[key] ?? (bk[key] = { cropId: r.cropId, bucket: r.terrainBucket ?? "-", n: 0, actuals: 0, submitters: new Set() });
    e.n++;
    // 검증(validated)은 '서로 다른 인증 제출자' 기준 — 익명(anon-*)·무userId 제외(고객측 distinctSubmitters SSOT와 정합·레드팀 P2)
    if (r.actualYieldKg != null) { e.actuals++; const u = r.userId; if (u && !u.startsWith("anon")) e.submitters.add(u); }
  }
  const validatedBuckets = Object.values(bk)
    .map((b) => ({ cropId: b.cropId, bucket: b.bucket, n: b.n, actuals: b.actuals, validated: b.submitters.size >= VALIDATED_THRESHOLD }))
    .sort((a, b) => b.actuals - a.actuals)
    .slice(0, 20);

  const an = ctx.analytics.snapshot(20); // 한 번만 — analytics 노출 + 헤드룸 트리거에 공용
  // 최적화 '언제' 트리거 — 측정된 지렛대(앱 첫로드 페이로드) + 스케일 벽(저장소 헤드룸). 임계 판정(색)은 콘솔이.
  const optimization = {
    payload: appPayloadKB(ctx.config.dashboardDir),                        // 앱 첫로드(gzip=실전송) — 페이로드 분할/지연로드 트리거
    headroom: { feedback: { n: rows.length, cap: 20000 }, demandKeys: { n: an.demandKeys, cap: 10000 } }, // blob 1MiB·차원폭증 — per-record/DB 승격 트리거
  };

  json(res, 200, {
    authConfigured: !!ctx.config.adminToken,
    flywheel: { records: rows.length, withActuals, byCrop, validatedBuckets },
    analytics: an, // 익명 수요·퍼널·시계열·신규/재방문·가입(PII 0) — 무료 베타에서 '무엇을 얻는가'
    members: { accounts: ctx.accounts.size(), sessions: ctx.sessions.size() }, // 회원 — 가입 총원·활성 세션(방법별 가입은 analytics.signups)
    optimization, // 최적화 '언제' 트리거(페이로드·저장소 헤드룸)
    usage: {
      simRuns: ctx.metrics.simRuns,
      entitlementsMinted: ctx.metrics.entitlementsMinted,
      mockPaysIssued: ctx.metrics.mockPaysIssued,
      requests: ctx.metrics.reqCount,
      errors: ctx.metrics.errCount,
    },
    payment: { mode: ctx.config.tossClientKey ? "live" : "mock", requireEntitlement: ctx.config.requireEntitlement, overridden: ctx.runtimeFlags.requireEntitlement() !== null, priceKrw: ctx.config.simPriceKrw },
    recent: ctx.opsLog.slice(0, 20),
    config: { dataMode: ctx.config.dataMode, port: ctx.config.port, store: ctx.storeMode },
    // 스토어 건전성 — firestore 워밍 실패(sealed)면 true. 운영자가 실효 부활 위험을 인지하고 게이트 ON 자제(H2).
    storeDegraded: ctx.entitlement.isDegraded?.() ?? false,
  });
  return true;
};
