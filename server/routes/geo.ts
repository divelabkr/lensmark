/**
 * 지오 라우트 — 좌표/주소/필지/지형/토지유형 조회(provider 경유).
 *   GET /api/geocode   : 주소·지번 ↔ 좌표(provider.land.geocode)
 *   GET /api/parcel    : 필지 경계(provider.land.parcel)
 *   GET /api/terrain   : 지형(경사·표고·향 등, provider.land.terrain)
 *   GET /api/landclass : 토지유형 분류(강/바다/도시/임야/기존농경지) — mock=좌표 분류기, live=VWorld 지목 seam
 * 모든 좌표는 finiteParam으로 유한수만 허용(NaN/Infinity 거부).
 */
import { json } from "../respond";
import { finiteParam } from "../../src/lansmark/api/httpUtil";
import { classifyLandMock } from "../../src/lansmark/geo/landClass";
import type { RouteFn } from "../context";

const num = finiteParam;

export const geoRoutes: RouteFn = async (ctx, _req, res, url) => {
  const p = url.pathname, q = url.searchParams;

  if (p === "/api/geocode") {
    json(res, 200, await ctx.providers.land.geocode({
      address: q.get("address")?.slice(0, 200) ?? undefined, // 길이캡(P2: live 지오코더 승격 대비 비신뢰 입력 상한)
      lat: num(q.get("lat")),
      lng: num(q.get("lng")),
    }));
    return true;
  }

  if (p === "/api/parcel") {
    const lat = num(q.get("lat")), lng = num(q.get("lng"));
    if (lat == null || lng == null) { json(res, 400, { error: "lat,lng 필요" }); return true; }
    json(res, 200, await ctx.providers.land.parcel({ lat, lng }));
    return true;
  }

  if (p === "/api/terrain") {
    const lat = num(q.get("lat")), lng = num(q.get("lng"));
    if (lat == null || lng == null) { json(res, 400, { error: "lat,lng 필요" }); return true; }
    json(res, 200, await ctx.providers.land.terrain({ lat, lng }));
    return true;
  }

  if (p === "/api/landclass") {
    const lat = num(q.get("lat")), lng = num(q.get("lng"));
    if (lat == null || lng == null) { json(res, 400, { error: "lat,lng 필요" }); return true; }
    json(res, 200, classifyLandMock(lat, lng));
    return true;
  }

  return false;
};
