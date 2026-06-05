/**
 * 알림 구독(opt-in) 라우트 — 핸드폰 번호 동의 수집(PII) + 해지. 실제 SMS 발송은 seam(smsSender·키 대기).
 *   POST /api/alerts/subscribe   : {phone, consent:true, region?} → 동의·번호 저장(발송 안 함·정직 안내)
 *   POST /api/alerts/unsubscribe : {phone} → 해지(동의 철회·PIPA)
 *   보안 경계: 무료(엔티틀먼트 불필요) · 민감 RL(번호 수확/남용 차단·middleware) · 동의 필수 · 번호 형식검증 · 로그엔 마스킹 번호만.
 */
import * as crypto from "node:crypto";
import { json, readBody } from "../respond";
import { isObject } from "../../src/lansmark/api/parcelRequest";
import { buildSubscription, normalizePhone, maskPhone } from "../../src/lansmark/notify/alertSubscription";
import type { RouteFn } from "../context";

export const notifyRoutes: RouteFn = async (ctx, req, res, url) => {
  const p = url.pathname;

  // ── 구독 신청(동의+번호 저장) ──
  if (p === "/api/alerts/subscribe") {
    if (req.method !== "POST") { json(res, 405, { error: "허용되지 않은 메서드" }); return true; }
    let b: unknown;
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    if (!isObject(b)) { json(res, 400, { error: "본문이 필요합니다." }); return true; }
    const r = buildSubscription(
      { phone: b.phone, consent: b.consent, region: b.region },
      { id: crypto.randomUUID(), now: new Date().toISOString() },
    );
    if (!r.ok) { json(res, 400, { error: r.error, code: r.code }); return true; } // 동의 없음/번호 형식 → 400
    ctx.subscriptions.upsert(r.sub);
    ctx.analytics.funnel("subscribe"); // 퍼널: 연락 옵트인(익명→재방문 가능 '다리')
    ctx.logOps("alert-subscribe", maskPhone(r.sub.phone)); // 원번호 로깅 금지 — 마스킹만
    // 발송 seam: 아직 미전송. 사용자에게 '준비 중'을 정직하게 안내(거짓 발송 위장 금지).
    json(res, 200, {
      ok: true, status: "registered", phone: maskPhone(r.sub.phone),
      note: "신청 완료 — 알림 서비스 준비되면 문자로 안내드립니다(현재 발송 준비 중).",
    });
    return true;
  }

  // ── 해지(동의 철회) ──
  if (p === "/api/alerts/unsubscribe") {
    if (req.method !== "POST") { json(res, 405, { error: "허용되지 않은 메서드" }); return true; }
    let b: unknown;
    try { b = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { error: "잘못된 JSON" }); return true; }
    const phone = normalizePhone(isObject(b) ? b.phone : undefined);
    if (!phone) { json(res, 400, { error: "휴대폰 번호 형식이 올바르지 않습니다." }); return true; }
    ctx.subscriptions.unsubscribe(phone); // 해지=레코드 삭제(파기). 반환값(존재여부)은 응답에 노출하지 않음.
    ctx.logOps("alert-unsubscribe", maskPhone(phone)); // 마스킹만 로깅
    // 가입 여부 누설(열거) 방지: store 반환값과 무관하게 고정 응답(레드팀 NOTIFY-1/PIPA-3).
    json(res, 200, { ok: true });
    return true;
  }

  return false; // 다음 핸들러로
};
