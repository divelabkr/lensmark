/**
 * 운영 라우트 — 콘솔용 통계(읽기 전용 · 시크릿 미노출) + 토큰 실효.
 *   GET  /api/ops/stats  : 플라이휠·사용량·결제·최근활동·설정. 관리자 인증(adminOk) 게이트.
 *   POST /api/ops/revoke : 유료권한 토큰 실효(환불/분쟁 시 무력화) — jti 기반(레드팀 H4 revoke 배선).
 */
import { json, readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { adminOk, blockedOpsMutation } from "../middleware"; // blockedOpsMutation=ops 쓰기 가드 SSOT(middleware로 승격 — backup 라우트와 공용)
import { VALIDATED_THRESHOLD } from "../../src/lansmark/core/calibration"; // 검증 판정 SSOT(임계) — ops도 동일 기준
import type { RouteFn } from "../context";
import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { assessQuality } from "../../src/lansmark/quality/qualityGate";
import { evaluateOps } from "../../src/lansmark/ops/opsWatch"; // 콘솔 종합판정 — Tier1 감시자와 같은 문장(SSOT · UX 감사 O6)
import { getCiStatus } from "../../src/lansmark/ops/ciStatus"; // CI 상태(GitHub Actions) — '서버' 탭 표시
import { integrationReadiness } from "../../src/lansmark/data/providers";
import { pgRegistry, pgPresenceFromEnv } from "../../src/lansmark/payment/pgRegistry";
import { RDA_REAL_META } from "../../src/lansmark/data/rdaIncome.real";

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

export const opsRoutes: RouteFn = async (ctx, req, res, url) => {
  // 토큰 실효(환불/분쟁) — 관리자 전용 쓰기. revoke 능력을 실제 운영 경로에 연결.
  if (url.pathname === "/api/ops/revoke" && req.method === "POST") {
    if (blockedOpsMutation(req, res, ctx)) return true;
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; } // 원시 JSON도 {}로 정규화(500 방지)
    const jti = typeof b.jti === "string" ? b.jti.trim() : "";
    if (!jti) { json(res, 400, { error: "jti가 필요합니다.", code: "JTI_REQUIRED" }); return true; }
    // 오타 무음 차단(O4) — revoke 전에 사용/실효 이력 조회(Set add는 아무 문자열이든 '성공'하므로, 이력 없으면 콘솔이 황색 경고).
    const known = ctx.entitlement.hasUsage?.(jti) ?? true; // 미구현 어댑터는 판단 불가 → true(오경보 방지)
    ctx.entitlement.revoke(jti);
    ctx.logOps("실효", `엔티틀먼트 실효 jti=${jti.slice(0, 12)}…`);
    // firestore: 실효를 '원격 반영 후' 응답(H3) — durable:false면 운영자가 재시도/인지. file/memory는 flush 동기라 항상 durable.
    let durable = true;
    try { await ctx.entitlement.persistRevokedNow?.(); } catch { durable = false; }
    json(res, 200, { ok: true, revoked: jti, durable, known, revokedTotal: ctx.entitlement.revokedSize() });
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

  // PG 선호(활성 결제수단) 런타임 토글(영속) — Toss↔PayPal 스위칭. 관리자 전용 쓰기.
  if (url.pathname === "/api/ops/pg-preference" && req.method === "POST") {
    if (blockedOpsMutation(req, res, ctx)) return true;
    let b: any = {};
    try { const _p = JSON.parse((await readBody(req)) || "{}"); b = isObject(_p) ? _p : {}; } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const v = b.pg;
    // 'auto'/null = 오버라이드 해제(자동 선택). 'toss'|'paypal'만 명시 허용.
    if (v !== "toss" && v !== "paypal" && v !== "auto" && v !== null) { json(res, 400, { error: "pg는 'toss'|'paypal'|'auto'여야 합니다.", code: "BAD_VALUE" }); return true; }
    const pref = (v === "toss" || v === "paypal") ? v : null;
    // 키 미완비 PG로의 전환은 거부(자동 폴백되어 무의미·운영자 오인) — live가 아닌 선호는 막는다(fail-closed).
    if (pref) {
      const target = pgRegistry(pgPresenceFromEnv(), pref).providers.find((x) => x.kind === pref);
      if (!target || target.state !== "live") { json(res, 409, { error: `${pref} 결제 키 미완비(state=${target?.state ?? "off"}) — 활성 전환 불가. 키 설정 후 가능.`, code: "PG_NOT_LIVE" }); return true; }
    }
    ctx.runtimeFlags.setPgPreference(pref);
    ctx.logOps("결제", `PG 선호 ${pref ?? "자동"}`);
    json(res, 200, { ok: true, preference: pref });
    return true;
  }

  // CI 상태(GitHub Actions) — 관리자 읽기. 서버 캐시(120s)·fail-soft(조회 실패는 라벨만).
  if (url.pathname === "/api/ops/ci" && req.method === "GET") {
    if (!adminOk(req, ctx)) { json(res, 401, { error: "관리자 인증 필요", code: "ADMIN_REQUIRED" }); return true; }
    json(res, 200, await getCiStatus());
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
  // 데이터 품질 게이트 — '운영 녹색'과 별개로 넘기는 데이터가 검증/정직한지(신뢰 피쉬본 + 제품 자동보수의 근거)
  const quality = assessQuality({
    integrations: integrationReadiness().integrations,
    rdaMeta: RDA_REAL_META,
    flywheel: { records: rows.length, withActuals, validatedBuckets: validatedBuckets.filter((b) => b.validated).length },
  });

  // 종합판정(watch) — Tier1 감시자(evaluateOps)와 동일 로직·임계·문장(SSOT): 콘솔 첫 화면 '지금 괜찮나' 한 줄(O6).
  const usage = {
    simRuns: ctx.metrics.simRuns,
    entitlementsMinted: ctx.metrics.entitlementsMinted,
    mockPaysIssued: ctx.metrics.mockPaysIssued,
    requests: ctx.metrics.reqCount,
    errors: ctx.metrics.errCount,
  };
  const storeDegraded = ctx.entitlement.isDegraded?.() ?? false;
  const clientErrors = { total: ctx.clientErrors.total(), distinct: ctx.clientErrors.distinct(), recent: ctx.clientErrors.recent(8) }; // 브라우저 에러 가시화(이전엔 안 보임)
  const watch = evaluateOps({ stats: { storeDegraded, usage, quality, optimization, clientErrors: { total: clientErrors.total, distinct: clientErrors.distinct } } });

  json(res, 200, {
    authConfigured: !!ctx.config.adminToken,
    watch: { level: watch.level, summary: watch.summary, findings: watch.findings.slice(0, 3) }, // findings는 warn/crit만 생성됨 — 상위 3건(콘솔 띠)
    clientErrors, // 클라이언트(브라우저) 에러 — 총·distinct·최근(서버탭 노출 + watch 판정)
    flywheel: { records: rows.length, withActuals, byCrop, validatedBuckets },
    analytics: an, // 익명 수요·퍼널·시계열·신규/재방문·가입(PII 0) — 무료 베타에서 '무엇을 얻는가'
    members: { accounts: ctx.accounts.size(), sessions: ctx.sessions.size() }, // 회원 — 가입 총원·활성 세션(방법별 가입은 analytics.signups)
    optimization, // 최적화 '언제' 트리거(페이로드·저장소 헤드룸)
    quality,      // 데이터 품질 게이트(신뢰 피쉬본) — 운영 녹색 ≠ 데이터 정확
    usage,
    payment: (() => { const r = pgRegistry(pgPresenceFromEnv(), ctx.runtimeFlags.pgPreference()); return { mode: ctx.config.tossClientKey ? "live" : "mock", requireEntitlement: ctx.config.requireEntitlement, overridden: ctx.runtimeFlags.requireEntitlement() !== null, priceKrw: ctx.config.simPriceKrw, pg: { active: r.active, preference: r.preference, providers: r.providers, enabled: r.enabledKinds } }; })(),
    recent: ctx.opsLog.slice(0, 20),
    config: { dataMode: ctx.config.dataMode, port: ctx.config.port, store: ctx.storeMode },
    // 스토어 건전성 — firestore 워밍 실패(sealed)면 true. 운영자가 실효 부활 위험을 인지하고 게이트 ON 자제(H2).
    storeDegraded,
  });
  return true;
};
