/**
 * 웹 푸시 알림 라우트 — 구독 등록/해지 + VAPID 공개키 노출(다리).
 *   GET  /api/push/vapid       : VAPID 공개키 + configured(프론트 subscribe 가능 여부). 미설정이면 '준비 중'.
 *   POST /api/push/subscribe   : 브라우저 PushSubscription 저장(opt-in)
 *   POST /api/push/unsubscribe : 구독 해지(즉시 파기)
 *   ⚠ 실제 발송(LiveWebPushSender·VAPID JWT+aes128gcm)·VAPID 키 생성은 HUMAN GATE(push.ts). 그 전까지 구독만 저장.
 *   PII: 구독 endpoint/키는 응답·로그에 노출하지 않음(엔드포인트 host만 — push.ts).
 */
import { json, readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { anonSubmitterId } from "../../src/lansmark/policy/entitlement";
import { sessionAccountUserId } from "../../src/lansmark/account/sessionStore";
import { sessionTokenFrom } from "../cookies";
import type { RouteFn } from "../context";

export const pushRoutes: RouteFn = async (ctx, req, res, url) => {
  const p = url.pathname;
  if (!p.startsWith("/api/push")) return false; // 빠른 탈출

  // VAPID 공개키 — 프론트가 PushManager.subscribe에 사용. 미설정이면 configured:false → 프론트 '준비 중'.
  if (p === "/api/push/vapid" && req.method === "GET") {
    const publicKey = process.env.LANSMARK_VAPID_PUBLIC_KEY || "";
    json(res, 200, { configured: !!publicKey, publicKey: publicKey || null });
    return true;
  }

  // 구독 등록(opt-in) — 로그인 세션 우선, 없으면 익명ID로 소유 태깅.
  if (p === "/api/push/subscribe" && req.method === "POST") {
    let b: any = {};
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const sub = isObject(b) ? b.subscription : null;
    if (!isObject(sub) || typeof sub.endpoint !== "string" || !isObject(sub.keys)) { json(res, 400, { error: "구독 형식이 올바르지 않습니다.", code: "BAD_SUB" }); return true; }
    // endpoint 위생 — https URL만 저장. ⚠ 이건 입력 검증일 뿐, 실제 SSRF 방어(사설/메타데이터 IP 차단)는
    //   발송 시점(LiveWebPushSender가 endpoint로 POST할 때) DNS 재바인딩까지 고려해 수행해야 함(HUMAN GATE seam).
    let epUrl: URL;
    try { epUrl = new URL(sub.endpoint); } catch { json(res, 400, { error: "구독 endpoint 형식 오류", code: "BAD_SUB" }); return true; }
    if (epUrl.protocol !== "https:" || sub.endpoint.length > 2048) { json(res, 400, { error: "구독 endpoint는 https URL만 허용합니다.", code: "BAD_SUB" }); return true; }
    const subscriberId = sessionAccountUserId(ctx.sessions, sessionTokenFrom(req)) ?? anonSubmitterId(req.headers["x-lansmark-anon"]);
    const cropId = typeof b.cropId === "string" && b.cropId.length <= 64 ? b.cropId : undefined; // 길이 상한(메모리 그리핑 차단)
    ctx.pushSubs.upsert(
      { endpoint: sub.endpoint, keys: { p256dh: String((sub.keys as any).p256dh || "").slice(0, 256), auth: String((sub.keys as any).auth || "").slice(0, 256) } },
      { subscriberId, cropId },
    );
    ctx.logOps("푸시", `구독 등록 ${subscriberId.slice(0, 16)}…`); // endpoint/키는 로깅 안 함(PII)
    json(res, 200, { ok: true });
    return true;
  }

  // 해지(파기)
  if (p === "/api/push/unsubscribe" && req.method === "POST") {
    let b: any = {};
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const ep = isObject(b) && typeof b.endpoint === "string" ? b.endpoint : "";
    ctx.pushSubs.remove(ep);
    json(res, 200, { ok: true });
    return true;
  }

  return false;
};
