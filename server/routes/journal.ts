/**
 * 재배일지(영농 동반) 라우트 — 작기 생애주기 기록 + 수확→플라이휠 승격(해자).
 *   POST /api/journal            : 재배 시작(시뮬 예측 baseline 결속)
 *   GET  /api/journal[?id=]      : 내 일지 목록 / 단건
 *   POST /api/journal/event      : 작업 1건 추가(파종·시비·방제·관수…)
 *   POST /api/journal/harvest    : 수확 기록 → (최초 1회) 예측↔실측 OutcomeRecord를 플라이휠에 적재
 *   GET  /api/journal/report?id= : 시즌 리포트(순수 함수 buildJournalReport)
 *
 *   보안 경계:
 *    - 권한은 서버 권위(엔티틀먼트). 단, quota는 소진하지 않는다(quota=정밀시뮬 전용 미터, 일지는 생애주기 기능).
 *    - 소유권: 본인(userId) 외 접근은 404로 응답(존재 여부 누설 방지).
 *    - 입력은 전부 sanitize/clamp(문자열 절단·0↑·상한) — 변조/이상치/DoS 차단.
 */
import * as crypto from "node:crypto";
import { json, readBody } from "../respond";
import { isObject, sanitizeTerrain } from "../../src/lansmark/api/parcelRequest";
import { clampNonNeg } from "../../src/lansmark/api/security";
import { anonSubmitterId, type SimulationEntitlement } from "../../src/lansmark/policy/entitlement";
import { assertPaidAccess } from "../paidAccess";
import { sessionAccountUserId } from "../../src/lansmark/account/sessionStore";
import { sessionTokenFrom } from "../cookies";
import { toOutcomeRecord } from "../../src/lansmark/core/feedbackStore";
import { buildJournalReport } from "../../src/lansmark/journal/report";
import type { JournalEntry, JournalEvent, JournalEventKind, HarvestRecord, JournalPredicted } from "../../src/lansmark/journal/types";
import type { Ctx, RouteFn } from "../context";

/* ── 상한·허용값(이상치/변조/DoS 차단) ── */
const YIELD_MAX = 1e9;       // kg
const MONEY_MAX = 1e12;      // 원
const AREA_MAX = 1e9;        // m²
const LABOR_MAX = 1e6;       // 시간
const MAX_EVENTS = 1000;     // 일지당 작업 수
const MAX_PER_USER = 500;    // 사용자당 일지 수
const KINDS: JournalEventKind[] = ["sow", "transplant", "fertilize", "spray", "irrigate", "weed", "observe", "other"];

/* ── 작은 정규화 헬퍼 ── */
const STR = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.slice(0, max) : undefined);
const DATE_OK = (v: unknown): v is string => typeof v === "string" && v.length <= 40 && Number.isFinite(Date.parse(v));
const finiteIn = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};

/** 예측 baseline 정규화 — 셋 다 비면 결속하지 않음(예측 없는 일지). */
function sanitizePredicted(raw: unknown): JournalPredicted | undefined {
  if (!isObject(raw)) return undefined;
  const y = clampNonNeg(raw.yieldKg, YIELD_MAX);
  const c = clampNonNeg(raw.costKrw, MONEY_MAX);
  const r = clampNonNeg(raw.revenueKrw, MONEY_MAX);
  if (y == null && c == null && r == null) return undefined;
  return { yieldKg: y ?? 0, costKrw: c ?? 0, revenueKrw: r ?? 0, terrain: sanitizeTerrain(raw.terrain), source: STR(raw.source, 80) };
}

/** 작업 1건 정규화 — 날짜 유효성 필수, kind는 화이트리스트(아니면 other). */
function sanitizeEvent(raw: unknown): JournalEvent | null {
  if (!isObject(raw) || !DATE_OK(raw.at)) return null;
  const kind = (typeof raw.kind === "string" && KINDS.includes(raw.kind as JournalEventKind)) ? (raw.kind as JournalEventKind) : "other";
  const ev: JournalEvent = { at: raw.at, kind };
  const note = STR(raw.note, 500); if (note) ev.note = note;
  const cost = clampNonNeg(raw.costKrw, MONEY_MAX); if (cost != null) ev.costKrw = cost;
  const labor = clampNonNeg(raw.laborHours, LABOR_MAX); if (labor != null) ev.laborHours = labor;
  return ev;
}

/** 수확 1건 정규화 — 날짜·수확량 필수. */
function sanitizeHarvest(raw: unknown): HarvestRecord | null {
  if (!isObject(raw) || !DATE_OK(raw.at)) return null;
  const yieldKg = clampNonNeg(raw.yieldKg, YIELD_MAX);
  if (yieldKg == null) return null;
  const h: HarvestRecord = { at: raw.at, yieldKg };
  const rev = clampNonNeg(raw.revenueKrw, MONEY_MAX); if (rev != null) h.revenueKrw = rev;
  const sc = STR(raw.salesChannel, 60); if (sc) h.salesChannel = sc;
  const gn = STR(raw.gradeNote, 200); if (gn) h.gradeNote = gn;
  return h;
}

/**
 * 서버 권위 엔티틀먼트 — 실패 시 402 응답 후 null 반환(라우트는 즉시 종료).
 *   게이트 비활성(무료 베타)이면 '브라우저별 익명ID'(x-lansmark-anon)로 일지를 사용자별 격리한다.
 *   ⚠ 과거의 고정 userId("dev")는 다중 사용자 운영에서 전 사용자를 한 신원으로 합쳐 위치·매출 PII를
 *      교차 노출시켰다(IDOR·레드팀 H1). 익명ID는 추측 불가 무작위라 타인 일지 열람·변조를 차단한다.
 */
async function requireEnt(ctx: Ctx, req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse): Promise<SimulationEntitlement | null> {
  if (!ctx.config.requireEntitlement) {
    // 무료 베타: 로그인 세션이 있으면 계정 신원 우선(익명 → 가입 → 계정 흐름), 없으면 브라우저 익명ID로 격리.
    const acctUid = sessionAccountUserId(ctx.sessions, sessionTokenFrom(req));
    return { userId: acctUid ?? anonSubmitterId(req.headers["x-lansmark-anon"]), source: "order" };
  }
  try {
    const ent = await assertPaidAccess(ctx, req);
    if (ctx.entitlement.isRevoked(ent.jti)) { json(res, 402, { error: "이 권한은 실효되었습니다.", code: "ENTITLEMENT_REVOKED" }); return null; } // 일지는 quota 미소진(L10)이라 consume이 실효를 막지 못함 → 명시 검사(레드팀 P1)
    return ent;
  }
  catch { json(res, 402, { error: "재배일지에는 유료 권한이 필요합니다.", code: "ENTITLEMENT_REQUIRED" }); return null; }
}

/** 소유자 본인의 일지를 로드(없거나 타인 소유면 404 응답 후 null). */
function loadOwned(ctx: Ctx, res: import("node:http").ServerResponse, id: unknown, userId: string): JournalEntry | null {
  if (typeof id !== "string" || !id) { json(res, 400, { error: "id가 필요합니다." }); return null; }
  const e = ctx.journal.get(id);
  if (!e || e.userId !== userId) { json(res, 404, { error: "일지를 찾을 수 없습니다.", code: "NOT_FOUND" }); return null; }
  return e;
}

export const journalRoutes: RouteFn = async (ctx, req, res, url) => {
  const p = url.pathname;
  if (!p.startsWith("/api/journal")) return false; // 빠른 탈출(다른 라우트로)

  // ── 생성(POST) / 목록·단건(GET) ──
  if (p === "/api/journal") {
    const ent = await requireEnt(ctx, req, res); if (!ent) return true;

    if (req.method === "GET") {
      const id = url.searchParams.get("id");
      if (id) { const e = loadOwned(ctx, res, id, ent.userId); if (!e) return true; json(res, 200, { ok: true, entry: e }); return true; }
      json(res, 200, { ok: true, entries: ctx.journal.listByUser(ent.userId) }); return true;
    }
    if (req.method === "POST") {
      let b: unknown;
      try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
      if (!isObject(b) || typeof b.cropId !== "string" || !b.cropId.trim()) { json(res, 400, { error: "cropId가 필요합니다." }); return true; }
      if (ctx.journal.countByUser(ent.userId) >= MAX_PER_USER) { json(res, 429, { error: "재배일지 보관 한도를 초과했습니다.", code: "JOURNAL_LIMIT" }); return true; }
      const now = new Date().toISOString();
      const entry: JournalEntry = {
        id: crypto.randomUUID(), userId: ent.userId, createdAt: now, updatedAt: now,
        parcelId: STR(b.parcelId, 120), region: STR(b.region, 120),
        lat: finiteIn(b.lat, -90, 90), lng: finiteIn(b.lng, -180, 180),
        cropId: b.cropId.slice(0, 60), variety: STR(b.variety, 80),
        areaM2: clampNonNeg(b.areaM2, AREA_MAX),
        plantedAt: DATE_OK(b.plantedAt) ? b.plantedAt : undefined,
        predicted: sanitizePredicted(b.predicted),
        events: [], status: "growing",
      };
      ctx.journal.create(entry);
      ctx.analytics.funnel("journal"); // 퍼널 최심부: 재배일지 시작(높은 관여·전환 신호)
      ctx.logOps("journal", `재배 시작 ${entry.cropId}${entry.region ? "·" + entry.region : ""}`);
      json(res, 200, { ok: true, id: entry.id, entry }); return true;
    }
    json(res, 405, { error: "허용되지 않은 메서드" }); return true;
  }

  // ── 작업 1건 추가 ──
  if (p === "/api/journal/event" && req.method === "POST") {
    const ent = await requireEnt(ctx, req, res); if (!ent) return true;
    let b: unknown;
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    if (!isObject(b)) { json(res, 400, { error: "본문이 필요합니다." }); return true; }
    const e = loadOwned(ctx, res, b.id, ent.userId); if (!e) return true;
    const ev = sanitizeEvent(b.event);
    if (!ev) { json(res, 400, { error: "작업 형식이 올바르지 않습니다(event.at 유효 날짜 필요)." }); return true; }
    if (e.events.length >= MAX_EVENTS) { json(res, 429, { error: "작업 기록 한도를 초과했습니다.", code: "EVENT_LIMIT" }); return true; }
    e.events.push(ev);
    e.updatedAt = new Date().toISOString();
    ctx.journal.update(e);
    json(res, 200, { ok: true, entry: e }); return true;
  }

  // ── 수확 기록 + 플라이휠 승격(해자) ──
  if (p === "/api/journal/harvest" && req.method === "POST") {
    const ent = await requireEnt(ctx, req, res); if (!ent) return true;
    let b: unknown;
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    if (!isObject(b)) { json(res, 400, { error: "본문이 필요합니다." }); return true; }
    const e = loadOwned(ctx, res, b.id, ent.userId); if (!e) return true;
    const h = sanitizeHarvest(b.harvest);
    if (!h) { json(res, 400, { error: "수확 형식이 올바르지 않습니다(harvest.at 유효 날짜·yieldKg 필요)." }); return true; }

    const firstHarvest = !e.harvest; // 최초 수확일 때만 플라이휠 승격 — 반복 POST로 인한 해자(보정) 오염 방지
    e.harvest = h;
    e.status = "harvested";
    e.updatedAt = new Date().toISOString();
    ctx.journal.update(e);

    // 🌱 해자 연결: 예측 baseline이 있으면 예측↔실측을 OutcomeRecord로 승격 → 같은 작물·지형버킷 보정에 기여.
    //   · actualCostKrw는 전송하지 않는다 — 일지 투입비는 '기록된 작업비'만이라 전체 원가가 아님(비용 보정 왜곡 방지).
    //   · userId를 실어 'validated=서로 다른 제출자 수' 판정에 정상 반영(자기검증 위조는 엔티틀먼트 게이트로 차단).
    let flywheel = false;
    if (firstHarvest && e.predicted) {
      ctx.feedbackStore.add(toOutcomeRecord(
        { cropId: e.cropId, region: e.region, userId: ent.userId, terrain: e.predicted.terrain, yieldKg: e.predicted.yieldKg, costKrw: e.predicted.costKrw, revenueKrw: e.predicted.revenueKrw },
        { actualYieldKg: h.yieldKg, actualRevenueKrw: h.revenueKrw },
      ));
      flywheel = true;
    }
    ctx.logOps("journal", `수확 ${e.cropId} ${h.yieldKg}kg${flywheel ? " → 플라이휠 반영" : ""}`);
    json(res, 200, { ok: true, entry: e, flywheel }); return true;
  }

  // ── 시즌 리포트 ──
  if (p === "/api/journal/report" && req.method === "GET") {
    const ent = await requireEnt(ctx, req, res); if (!ent) return true;
    const e = loadOwned(ctx, res, url.searchParams.get("id"), ent.userId); if (!e) return true;
    json(res, 200, { ok: true, report: buildJournalReport(e) }); return true;
  }

  // ── 삭제(정보주체 삭제권·PIPA) — 소유자 본인 일지 1건 즉시 파기(위치·수확 PII) ──
  if (p === "/api/journal/delete" && req.method === "POST") {
    const ent = await requireEnt(ctx, req, res); if (!ent) return true;
    let b: unknown;
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const e = loadOwned(ctx, res, isObject(b) ? b.id : undefined, ent.userId); if (!e) return true; // 소유권 검사(타인 일지 404)
    ctx.journal.delete(e.id);
    ctx.logOps("journal", `일지 삭제 ${e.cropId}`);
    json(res, 200, { ok: true, deleted: e.id }); return true;
  }

  return false; // /api/journal* 이지만 매칭 메서드 없음 → 라우터가 404
};
