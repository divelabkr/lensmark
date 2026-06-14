/**
 * 클라이언트(브라우저) 에러 텔레메트리 — 사용자 화면에서 난 JS 에러를 사장님께 가시화(이전엔 0=보이지 않음).
 *   집계(디듀프 카운트) + 최근 링버퍼 · PII 0(메시지/소스만·절단) · distinct 상한(FIFO) · '새 distinct'만 웹훅 트리거(스팸 방지).
 *   ⚠ 메모리 보관(재시작 휘발) — 텔레메트리 성격상 충분. 영속이 필요해지면 firestore 승격(seam).
 */
export interface ClientErrorRow {
  key: string;        // msg|src 디듀프 키(내부)
  msg: string;        // 절단된 에러 메시지
  src?: string;       // 파일:라인 등(절단)
  n: number;          // 누적 발생 수(디듀프)
  firstAt: string;
  lastAt: string;
  uaSample?: string;  // 대표 User-Agent(절단)
  urlSample?: string; // 발생 경로(쿼리 제외·절단)
}

const CAP = 100;          // distinct 에러 상한(메모리 바운드·DoS 방지)
const MSG_MAX = 300, FIELD_MAX = 180;
const trunc = (s: string | undefined, m: number): string | undefined => (s == null ? undefined : String(s).slice(0, m));

export class ClientErrorStore {
  private map = new Map<string, ClientErrorRow>();
  /** 기록 → '새 distinct'면 그 row 반환(웹훅 트리거용), 기존이면 카운트만 증가하고 null. */
  record(e: { message: string; source?: string; url?: string; ua?: string }, now: string = new Date().toISOString()): ClientErrorRow | null {
    const msg = trunc(e.message, MSG_MAX) || "(빈 메시지)";
    const src = trunc(e.source, FIELD_MAX);
    const key = msg + "|" + (src || "");
    const ex = this.map.get(key);
    if (ex) { ex.n++; ex.lastAt = now; return null; } // 디듀프 — 같은 에러는 카운트만(경보 스팸 방지)
    const row: ClientErrorRow = { key, msg, src, n: 1, firstAt: now, lastAt: now, uaSample: trunc(e.ua, FIELD_MAX), urlSample: trunc(e.url, FIELD_MAX) };
    this.map.set(key, row);
    if (this.map.size > CAP) { const k = this.map.keys().next().value as string | undefined; if (k) this.map.delete(k); } // FIFO 축출
    return row; // 새 distinct → 로그·웹훅
  }
  recent(n = 10): ClientErrorRow[] { return [...this.map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)).slice(0, n); }
  total(): number { let t = 0; for (const r of this.map.values()) t += r.n; return t; }
  distinct(): number { return this.map.size; }
}

/**
 * 실시간 경보 웹훅(Slack/Discord 호환) — `LANSMARK_ALERT_WEBHOOK` 설정 시에만 발사(미설정이면 조용히·기록은 됨).
 *   URL은 사장님이 설정(SSRF 무관) · fire-and-forget · 타임아웃 4s · 실패는 무시(제품 흐름 무영향).
 *   본문 {text, content}: Slack은 text·Discord는 content를 읽어 둘 다 호환.
 */
export async function notifyAlertWebhook(text: string): Promise<void> {
  const url = process.env.LANSMARK_ALERT_WEBHOOK || "";
  if (!url) return;
  // 사용자 유래 텍스트(무인증 client-error 등)가 운영자 채널을 핑(@everyone)하거나 피싱 링크를 렌더하지 못하게 무력화(레드팀 L — webhook 인젝션).
  const safe = String(text).replace(/[@<>]/g, (c) => (c === "@" ? "＠" : c === "<" ? "‹" : "›")).slice(0, 1500);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: safe, content: safe, allowed_mentions: { parse: [] } }), signal: ctrl.signal }).catch(() => {}); // allowed_mentions: Discord 멘션 핑 차단
    clearTimeout(t);
  } catch { /* 경보 실패 무시 */ }
}
