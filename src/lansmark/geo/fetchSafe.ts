/**
 * 외부 API fetch 안전 래퍼 — 타임아웃(AbortSignal) + 상태/파싱 가드.
 *   목적(레드팀 M4·L3): 업스트림이 느리거나(행) HTML 오류페이지/빈응답을 줘도
 *   요청이 무한 대기하거나 res.json()이 throw해 500이 누수되지 않게 한다 → 실패는 null로 정상 폴백.
 */
export const FETCH_TIMEOUT_MS = Math.max(1000, Number(process.env.LANSMARK_FETCH_TIMEOUT_MS || 7000));

/** JSON 응답을 안전하게 — 타임아웃·비2xx·비JSON·중단 → null. */
export async function fetchJsonSafe(url: string, opts: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<any | null> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return null; } // HTML 오류페이지 등 → null
  } catch { return null; } // 타임아웃·네트워크·중단
}

/** 텍스트(고정폭 등) 응답을 안전하게 — 타임아웃·비2xx·중단 → null. */
export async function fetchTextSafe(url: string, opts: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<string | null> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

/** 지정 인코딩(예: euc-kr) 텍스트를 안전하게 — KMA typ01 고정폭은 EUC-KR이라 res.text()(UTF-8)면 한글이 깨진다. 실패→null. */
export async function fetchTextSafeEnc(url: string, encoding: string, opts: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<string | null> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new TextDecoder(encoding).decode(buf);
  } catch { return null; } // 타임아웃·네트워크·미지원 인코딩 모두 null
}
