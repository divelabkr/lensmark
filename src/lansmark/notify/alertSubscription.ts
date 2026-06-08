/**
 * 알림 구독(opt-in) 도메인 — 핸드폰 번호 + 동의 수집(PII). 순수 검증·정규화만(저장=store, 발송=smsSender seam).
 *   원칙(PIPA·개인정보 최소수집): 동의(consent) 없으면 생성 거부 · 번호는 한국 휴대폰 형식만 · 로그/응답엔 마스킹 번호만.
 *   ⚠ 발송 미구현(SMS 제공자 키 = HUMAN GATE) — 지금은 '동의·번호 저장'만(저장 후 안내). 운영 시 번호 at-rest 암호화는 hardening seam.
 *   해지(unsubscribe) = 레코드 '실제 삭제(파기)' — 안내 '보유: 해지 시까지'와 일치(PIPA 파기의무·레드팀 PIPA-2).
 */
export interface AlertSubscription {
  id: string;
  phone: string;        // 정규화된 휴대폰 숫자(예: 01012345678)
  consent: true;        // 수집·이용 동의(필수 · true만 저장)
  consentAt: string;    // 동의 시각(ISO)
  createdAt: string;
  region?: string;      // 선택: 관심 지역(시도)
  cropId?: string;      // 선택: 수확기 리마인드 대상 작물(give/get 다리 — 어느 작물 수확기를 알릴지 의도). PII 아님.
  channels: ["sms"];    // 현재 SMS만(발송은 seam)
}

export interface SubInput { phone?: unknown; consent?: unknown; region?: unknown; cropId?: unknown; }

/** 한국 휴대폰 정규화: 하이픈·공백 제거 후 01[016789] + 7~8자리만 허용. 실패 시 null. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.replace(/[\s-]/g, "");
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

/** 표시·로그용 마스킹: 010****5678 (원번호 노출 금지). */
export function maskPhone(phone: string): string {
  return phone.length < 7 ? "***" : phone.slice(0, 3) + "****" + phone.slice(-4);
}

/** 구독 1건 생성(검증). consent!==true면 거부(거짓 동의 차단) · 번호 형식 위반 거부. */
export function buildSubscription(
  input: SubInput,
  ids: { id: string; now: string },
): { ok: true; sub: AlertSubscription } | { ok: false; code: string; error: string } {
  if (input.consent !== true) return { ok: false, code: "CONSENT_REQUIRED", error: "개인정보 수집·이용 동의가 필요합니다." };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, code: "BAD_PHONE", error: "휴대폰 번호 형식이 올바르지 않습니다(예: 010-1234-5678)." };
  const region = typeof input.region === "string" && input.region.trim() ? input.region.slice(0, 20) : undefined;
  // cropId는 화이트리스트(소문자·밑줄, ≤40)만 — 비신뢰 입력/주입 차단. 작물ID는 PII 아님(리마인드 대상 의도).
  const cropId = typeof input.cropId === "string" && /^[a-z_]{1,40}$/.test(input.cropId) ? input.cropId : undefined;
  return {
    ok: true,
    sub: { id: ids.id, phone, consent: true, consentAt: ids.now, createdAt: ids.now, channels: ["sms"], ...(region ? { region } : {}), ...(cropId ? { cropId } : {}) },
  };
}
