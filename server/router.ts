/**
 * 라우터 — 등록된 라우트 그룹을 순서대로 시도하고, 아무도 처리하지 않으면 404.
 *   각 그룹은 RouteFn: 자신이 처리하면 true(종료), 아니면 false(다음 그룹).
 *   순서는 비용이 싼/구체적인 것부터(meta→geo→analysis→payment→ops→pages).
 */
import type * as http from "node:http";
import { json } from "./respond";
import type { Ctx, RouteFn } from "./context";
import { metaRoutes } from "./routes/meta";
import { geoRoutes } from "./routes/geo";
import { analysisRoutes } from "./routes/analysis";
import { assessRoutes } from "./routes/assess";
import { cropsRoutes } from "./routes/crops";
import { regionFitRoutes } from "./routes/regionFit";
import { journalRoutes } from "./routes/journal";
import { accountRoutes } from "./routes/account";
import { marketRoutes } from "./routes/market";
import { budgetRoutes } from "./routes/budget";
import { guideRoutes } from "./routes/guide";
import { foreignRoutes } from "./routes/foreign";
import { alertsRoutes } from "./routes/alerts";
import { notifyRoutes } from "./routes/notify";
import { pushRoutes } from "./routes/push";
import { monitorRoutes } from "./routes/monitor";
import { supportRoutes } from "./routes/support";
import { paymentRoutes } from "./routes/payment";
import { opsRoutes } from "./routes/ops";
import { pageRoutes } from "./routes/pages";

const ROUTES: RouteFn[] = [metaRoutes, geoRoutes, assessRoutes, analysisRoutes, cropsRoutes, regionFitRoutes, journalRoutes, accountRoutes, marketRoutes, budgetRoutes, guideRoutes, foreignRoutes, notifyRoutes, pushRoutes, alertsRoutes, monitorRoutes, supportRoutes, paymentRoutes, opsRoutes, pageRoutes];

export async function route(ctx: Ctx, req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  for (const handler of ROUTES) {
    if (await handler(ctx, req, res, url)) return; // 처리됨 → 종료
  }
  json(res, 404, { error: "not found", path: url.pathname });
}
