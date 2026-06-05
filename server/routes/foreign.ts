/**
 * 외래·임의 작물 조회 라우트 — 유료(Phase B). 키 없는 공개 API(GBIF·위키백과)로 해외 참고 정보.
 *   GET /api/foreign?name= : fetchForeignCrop(GBIF 분류 + 위키 설명).
 *   경계: 유료 전용(엔티틀먼트 게이트) · 외부 쿼터 보호로 sensitive 레이트리밋 · 소득 시뮬 비활성(임의 작물은 엔진 데이터 없음).
 */
import { json } from "../respond";
import { fetchForeignCrop } from "../../src/lansmark/foreign/foreignCrop";
import { assertPaidEntitlement } from "../../src/lansmark/policy/entitlement";
import type { RouteFn } from "../context";

const NAME_RE = /^[가-힣a-zA-Z0-9 .\-]{1,80}$/; // 한글/라틴/숫자/공백/점/하이픈만(비신뢰 입력 차단)
const finiteIn = (v: string | null, lo: number, hi: number): number | undefined => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};

export const foreignRoutes: RouteFn = async (ctx, req, res, url) => {
  if (url.pathname !== "/api/foreign") return false;
  const name = (url.searchParams.get("name") || "").trim();
  if (!NAME_RE.test(name)) { json(res, 400, { error: "작물명(한글/영문, 1~80자)이 필요합니다." }); return true; }
  // 유료 전용 — 직접 작물 추가(외래종 포함)는 유료 기능. (네트워크 호출 前 차단)
  if (ctx.config.requireEntitlement) {
    try { await assertPaidEntitlement({ get: (n) => (req.headers[n.toLowerCase()] as string) ?? null }); }
    catch { json(res, 402, { error: "직접 작물 추가(외래종 포함)는 유료 기능입니다.", code: "FOREIGN_PAID" }); return true; }
  }
  // 필지 좌표가 있으면 기후대 적합성 평가(GBIF 관측 위도대 + KMA 겨울최저).
  const lat = finiteIn(url.searchParams.get("lat"), -90, 90), lng = finiteIn(url.searchParams.get("lng"), -180, 180);
  let parcel: { lat: number; lng?: number; minWinterTempC?: number } | undefined;
  if (lat != null) {
    let minWinterTempC: number | undefined;
    try { if (lng != null) { const c = await ctx.providers.land.climate({ lat, lng }); minWinterTempC = c?.minWinterTempC ?? undefined; } } catch { /* 폴백 */ }
    parcel = { lat, lng: lng ?? undefined, minWinterTempC };
  }
  const foreign = await fetchForeignCrop(name, parcel); // GBIF 분류+위키+(필지 시)관측분포·기후대 — 실패는 null 폴백
  ctx.analytics.funnel("foreign"); // 관여(외래 조회)
  // 데이터갭은 GBIF가 '실제 종'으로 해석한 정규명(canonicalName)만 기록 — 원입력 free-text는 미기록 → PII 0 보장(레드팀 M-2)
  if (foreign?.resolved && foreign.taxon?.canonicalName) ctx.analytics.dataGap("foreign:" + foreign.taxon.canonicalName);
  json(res, 200, { ok: true, foreign });
  return true;
};
