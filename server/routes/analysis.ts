/**
 * 분석 라우트 — 제품 핵심 흐름: 추천(무료) → 정밀 시뮬(유료) → 실측 피드백(플라이휠).
 *   GET|POST /api/recommend : 무료 작물 후보(적합도 상대점수만 · 매입추천 아님)
 *   POST /api/simulate      : 유료 정밀 소득 시뮬(P10/50/90 · 근거 6축 · 생육·출하). 엔티틀먼트 게이트(fail-closed).
 *   POST /api/feedback       : 예측↔실측 기록 → 같은 작물·지형버킷 보정(해자). 입력은 0↑·상한 클램프(변조 방지).
 */
import { json, badInput, readBody } from "../respond";
import { finiteParam } from "../../src/lansmark/api/httpUtil";
import { validateLandInput, clampCandidateLimit } from "../../src/lansmark/core/validate";
import { rankCropCandidates } from "../../src/lansmark/core/cropSuitability";
import { buildCropTransition } from "../../src/lansmark/core/cropTransition";
import { climateEvidence } from "../../src/lansmark/core/climateEvidence";
import { buildParcelInput, sanitizeTerrain, isObject } from "../../src/lansmark/api/parcelRequest";
import { runParcelSimulationWithProviders, type ParcelInput } from "../../src/lansmark/core/parcelSimulator";
import { terrainBucketOf, toOutcomeRecord } from "../../src/lansmark/core/feedbackStore";
import { getValidationLevel, VALIDATED_THRESHOLD } from "../../src/lansmark/core/calibration";
import { getConsolidatedCalibration, markCalibrationDirty } from "../../src/lansmark/core/consolidateCache";
import { buildGrowthCalendar } from "../../src/lansmark/core/calendar";
import { buildGrowthRiskInfo } from "../../src/lansmark/core/growthRisk";
import { incomeDataStatus } from "../../src/lansmark/data/rdaIncome";
import { anonSubmitterId, type SimulationEntitlement } from "../../src/lansmark/policy/entitlement";
import { assertPaidAccess } from "../paidAccess";
import { clampNonNeg } from "../../src/lansmark/api/security";
import type { LandInput } from "../../src/lansmark/types";
import type { RouteFn } from "../context";

const num = finiteParam;
const FEEDBACK_YIELD_MAX = 1e9;   // kg 상한(변조/이상치 차단)
const FEEDBACK_MONEY_MAX = 1e12;  // 원 상한

export const analysisRoutes: RouteFn = async (ctx, req, res, url) => {
  const p = url.pathname, q = url.searchParams;

  // ── 무료 작물추천(자유 후보) — 가드레일: 매입추천 아님, 적합도 상대점수만 ──
  if (p === "/api/recommend") {
    let land: LandInput, limit: number;
    try {
      if (req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}");
        land = validateLandInput({ areaM2: 3300, ...(isObject(body.land) ? body.land : {}) });
        limit = clampCandidateLimit(body.limit, 6);
      } else {
        land = validateLandInput({ areaM2: num(q.get("area")) ?? 3300, lat: num(q.get("lat")), lng: num(q.get("lng")) });
        limit = clampCandidateLimit(q.get("limit"), 6);
      }
    } catch (e) { badInput(res, e); return true; }
    ctx.analytics.funnel("recommend", req.headers["x-lansmark-anon"] as string | undefined); // 퍼널 1단계(유입) + 익명 기기로 신규/재방문 판정
    // 기후·지형을 '먼저' 가져와 추천 랭킹에도·근거에도 같이 씀 → 무료 추천 ↔ 유료 시뮬 근거 일치(모순 제거).
    //   지형=Open-Meteo DEM(무키 live·30일 캐시 — 앱의 병렬 /api/terrain 호출과 같은 캐시를 공유해 이중조회 저렴).
    //   실패/좌표없으면 해당 축 생략(fail-soft, 추천은 유지) — '전국 동일 순위'(가짜 정밀) 해소 축.
    let climate; let terrain; let climateEv: ReturnType<typeof climateEvidence> | undefined;
    if (land.lat != null && land.lng != null) {
      const loc = { lat: land.lat, lng: land.lng };
      const [cR, tR] = await Promise.allSettled([ctx.providers.land.climate(loc), ctx.providers.land.terrain(loc)]);
      if (cR.status === "fulfilled" && cR.value) { climate = cR.value; climateEv = climateEvidence(climate); }
      if (tR.status === "fulfilled" && tR.value) terrain = tR.value;
    }
    // 소득 실데이터 배지 — 후보별 농진청 실측 여부(incomeDataStatus)를 얹어 '숫자를 믿을 수 있는 작물'을 정직하게 구분.
    const candidates = rankCropCandidates(land, limit, climate, terrain ?? undefined)
      .map((c) => ({ ...c, incomeData: incomeDataStatus(c.cropId) }));
    json(res, 200, { ok: true, mode: "free", paywallAfter: "crop_candidate_top", candidates, climateEvidence: climateEv, terrainUsed: !!terrain });
    return true;
  }

  // ── 작물 전환 로드맵(G-2) — 온난화 시점별 적합 작물 변화. 좌표 기후 조회(recommend와 동일·fail-soft) → buildCropTransition(외삽 면책 내장). 무인증·무료. ──
  if (p === "/api/crop-transition") {
    let land: LandInput, limit: number;
    try {
      if (req.method === "POST") { const body = JSON.parse((await readBody(req)) || "{}"); land = validateLandInput({ areaM2: 3300, ...(isObject(body.land) ? body.land : {}) }); limit = clampCandidateLimit(body.limit, 5); }
      else { land = validateLandInput({ areaM2: num(q.get("area")) ?? 3300, lat: num(q.get("lat")), lng: num(q.get("lng")) }); limit = clampCandidateLimit(q.get("limit"), 5); }
    } catch (e) { badInput(res, e); return true; }
    let climate;
    if (land.lat != null && land.lng != null) { try { climate = await ctx.providers.land.climate({ lat: land.lat, lng: land.lng }); } catch { /* 폴백: 기후 미반영 → transition null(프론트 생략) */ } }
    json(res, 200, { ok: true, transition: buildCropTransition(land, climate, limit) });
    return true;
  }

  // ── 마트 소매가(소비자 물가) 주간 min~평균~max — 무료 정보. 도매가(농가 수취)와 구분되는 '소비자 체감 시세'. ──
  //   미지원 작물(KAMIS 코드 미검증)·오류는 retail:null로 응답(프론트가 표시 생략). 무인증.
  if (p === "/api/retail-price") {
    const cropId = (q.get("cropId") ?? "").trim();
    if (!cropId) { json(res, 400, { error: "cropId가 필요합니다." }); return true; }
    const retail = await ctx.providers.price.retailWeekly(cropId);
    json(res, 200, { ok: true, cropId, retail });
    return true;
  }

  // ── 유료 정밀 분석 ──
  if (p === "/api/simulate" && req.method === "POST") {
    // 1) 서버 권위 엔티틀먼트 검증(fail-closed) — 권한은 클라이언트가 주장할 수 없다.
    let ent: SimulationEntitlement | null = null;
    if (ctx.config.requireEntitlement) {
      try { ent = await assertPaidAccess(ctx, req); }
      catch (e: any) { json(res, e?.status ?? 402, { error: "유료 정밀 분석 권한이 필요합니다(결제).", code: "ENTITLEMENT_REQUIRED" }); return true; }
    }
    // 2) 입력 검증·정규화(cropId/면적/지형 sanitize) — quota 소진 前에(깨진 본문에 quota 낭비 방지·레드팀 P2)
    let input: ParcelInput;
    try { input = buildParcelInput(JSON.parse((await readBody(req)) || "{}")); }
    catch (e) { badInput(res, e); return true; }
    // 3) 검증 통과 후 소진형 quota + 실효 검증 — 1회 결제 무한사용·환불 후 사용 차단(레드팀 H4)
    if (ent && !ctx.entitlement.consume(ent.jti, ctx.config.entitlementQuota, ent.exp)) {
      json(res, 402, { error: "이 권한의 사용 한도를 초과했거나 실효되었습니다. 다시 결제해 주세요.", code: "ENTITLEMENT_EXHAUSTED" }); return true;
    }
    // 3) 지형 컨텍스트 확보(버킷 산정용) → 플라이휠 보정 조회 → 엔진 주입(실측 누적 시 예측이 현실로 이동)
    //   소진 후 다운스트림(provider·엔진) 실패는 결과 미제공 → quota 환불(과금 공정성·감사 Low). 환불 후 최상위로 재throw(500).
    try {
      const simCtx = { ...(input.context ?? {}) };
      const lat = input.land?.lat, lng = input.land?.lng;
      if (lat != null && lng != null && !simCtx.terrain) {
        try { const t = await ctx.providers.land.terrain({ lat, lng }); if (t) simCtx.terrain = t; } catch { /* 폴백: 보정 없이 */ }
      }
      const bucket = simCtx.terrain ? terrainBucketOf(simCtx.terrain) : undefined;
      // Dream 스냅샷(이상치격리·recency·버킷승격)으로 정밀 보정 + 재계산 회피. 스냅샷에 없는 콜드/신규는 raw로 폴백(기존 동작 보존).
      const calibration = await getConsolidatedCalibration(input.cropId, input.region, ctx.feedbackStore, bucket);
      const result = await runParcelSimulationWithProviders({ ...input, context: simCtx, calibration }, ctx.providers);
      // 4) 생육·출하 배선: 검증된 코어를 canonical 결과에 합쳐 노출(농지→작물→생육→출하 연결)
      const growth = { calendar: buildGrowthCalendar(input.cropId), risk: buildGrowthRiskInfo(input) };
      ctx.metrics.simRuns++;
      ctx.analytics.funnel("simulate"); ctx.analytics.demand(input.cropId, input.region); // 퍼널 2단계 + '진지한 수요'(작물×지역) 히트맵
      json(res, 200, { ...result, growth });
      return true;
    } catch (e) {
      if (ent) ctx.entitlement.refund?.(ent.jti); // 서비스 미제공 → 소진 1회 복원
      throw e;
    }
  }

  // ── 실측 피드백(플라이휠/해자) ──
  if (p === "/api/feedback" && req.method === "POST") {
    // 실측 제출은 유료 권한 필요 — 익명 대량 변조·자기검증('✓검증') 위조 차단(레드팀 H6).
    let ent: SimulationEntitlement | null = null;
    if (ctx.config.requireEntitlement) {
      try { ent = await assertPaidAccess(ctx, req); }
      catch { json(res, 402, { error: "실측 제출에는 유료 권한이 필요합니다.", code: "ENTITLEMENT_REQUIRED" }); return true; }
    }
    let b: unknown;
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    if (!isObject(b) || typeof b.cropId !== "string" || !b.cropId) { json(res, 400, { error: "cropId가 필요합니다." }); return true; }
    // 검증 통과 후 quota 소진 + 실효 — 깨진/cropId없는 본문에 quota 낭비 방지(레드팀 P2) · 단일토큰 대량제출 유한화(FLYWHEEL-POISON)
    if (ent && !ctx.entitlement.consume(ent.jti, ctx.config.entitlementQuota, ent.exp)) {
      json(res, 402, { error: "이 권한의 사용 한도를 초과했거나 실효되었습니다.", code: "ENTITLEMENT_EXHAUSTED" }); return true;
    }
    const cropId = b.cropId;
    const region = typeof b.region === "string" ? b.region.slice(0, 120) : undefined;
    const pred = isObject(b.predicted) ? b.predicted : {};
    const act = isObject(b.actual) ? b.actual : {};
    const yC = (v: unknown) => clampNonNeg(v, FEEDBACK_YIELD_MAX); // 변조/이상치 차단: 0↑·상한
    const mC = (v: unknown) => clampNonNeg(v, FEEDBACK_MONEY_MAX);
    // 제출자 신원: 인증(유료)=ent.userId / 무료 베타=브라우저별 익명ID(anon-*).
    //   익명ID는 per-user 가중 캡(calibrate)에는 반영돼 보정 품질을 올리되, '✓검증' 배지(distinctSubmitters)에서는
    //   anon-* 접두사로 제외된다 → 무료 익명 제출이 검증을 부풀리지 못함(하이브리드·레드팀 H1 결정).
    const submitterId = ent?.userId ?? anonSubmitterId(req.headers["x-lansmark-anon"]);
    const rec = toOutcomeRecord(
      { cropId, region, userId: submitterId, terrain: sanitizeTerrain(b.terrain), yieldKg: yC(pred.yieldKg) ?? 0, costKrw: mC(pred.costKrw) ?? 0, revenueKrw: mC(pred.revenueKrw) ?? 0 },
      { actualYieldKg: yC(act.actualYieldKg), actualCostKrw: mC(act.actualCostKrw), actualRevenueKrw: mC(act.actualRevenueKrw) },
    );
    ctx.feedbackStore.add(rec);
    markCalibrationDirty(ctx.feedbackStore); // 새 실측 → Dream 스냅샷 무효화(다음 조회가 재정리·정밀화 즉시 반영)
    const level = await getValidationLevel(cropId, region, ctx.feedbackStore); // = 서로 다른 제출자 수
    json(res, 200, { ok: true, validationLevel: level, validated: level >= VALIDATED_THRESHOLD, bucket: rec.terrainBucket });
    return true;
  }

  return false;
};
