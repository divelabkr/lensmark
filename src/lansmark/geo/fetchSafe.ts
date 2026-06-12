/**
 * 외부 API fetch 안전 래퍼 — 타임아웃(AbortSignal) + 상태/파싱 가드 + 본문 바이트 상한.
 *   목적(레드팀 M4·L3 + 설계감사 P2): 업스트림이 느리거나(행) HTML 오류페이지/빈응답/거대응답을 줘도
 *   무한 대기·메모리 고갈하거나 res.json()이 throw해 500이 누수되지 않게 한다 → 실패는 null로 정상 폴백.
 */
export const FETCH_TIMEOUT_MS = Math.max(1000, Number(process.env.LANSMARK_FETCH_TIMEOUT_MS || 7000));
// 업스트림 본문 상한 — 거대/무한 응답(악성·오동작·MITM)으로부터 메모리 보호. 사용 API(GBIF·위키·KAMIS·NCPMS)는 모두 ≪2MB.
export const FETCH_MAX_BYTES = Math.max(64_000, Number(process.env.LANSMARK_FETCH_MAX_BYTES || 2_000_000));

/** 응답 본문을 바이트 상한까지만 스트림으로 읽는다(P2) — 초과·실패 시 null(메모리 고갈 차단). Content-Length 선언이 상한 초과면 즉시 거부. */
async function readCappedBytes(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const cl = Number(res.headers.get("content-length"));
  if (Number.isFinite(cl) && cl > maxBytes) return null;          // 선언 길이부터 초과 → 즉시 거부
  const reader = res.body?.getReader();
  if (!reader) { const b = new TextEncoder().encode(await res.text()); return b.byteLength > maxBytes ? null : b; } // 스트림 없으면(폴리필/모킹) 폴백
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel().catch(() => {}); return null; } // 상한 초과 → 중단(누적 버퍼링 차단)
    chunks.push(value);
  }
  const out = new Uint8Array(total); let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

/** JSON 응답을 안전하게 — 타임아웃·비2xx·비JSON·상한초과·중단 → null. */
export async function fetchJsonSafe(url: string, opts: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<any | null> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = await readCappedBytes(res, FETCH_MAX_BYTES);
    if (!buf) return null;
    try { return JSON.parse(new TextDecoder().decode(buf)); } catch { return null; } // HTML 오류페이지 등 → null
  } catch { return null; } // 타임아웃·네트워크·중단
}

/** 텍스트(고정폭 등) 응답을 안전하게 — 타임아웃·비2xx·상한초과·중단 → null. */
export async function fetchTextSafe(url: string, opts: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<string | null> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = await readCappedBytes(res, FETCH_MAX_BYTES);
    return buf ? new TextDecoder().decode(buf) : null;
  } catch { return null; }
}

/** 지정 인코딩(예: euc-kr) 텍스트를 안전하게 — KMA typ01 고정폭은 EUC-KR이라 res.text()(UTF-8)면 한글이 깨진다. 상한초과·실패→null. */
export async function fetchTextSafeEnc(url: string, encoding: string, opts: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<string | null> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = await readCappedBytes(res, FETCH_MAX_BYTES);
    return buf ? new TextDecoder(encoding).decode(buf) : null;
  } catch { return null; } // 타임아웃·네트워크·미지원 인코딩 모두 null
}
