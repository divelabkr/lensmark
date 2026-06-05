const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): { ok: boolean; remaining: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) { buckets.set(key, { count: 1, reset: now + windowMs }); return { ok: true, remaining: limit - 1 }; }
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count) };
}

/**
 * ⚠ 미사용 — Next.js 라우트 예시(*.route.example.ts) 전용. 실제 dev 서버는 이 모듈을 쓰지 않는다.
 *   이 함수는 X-Forwarded-For를 신뢰하므로 직노출 배포에 그대로 쓰면 레이트리밋 우회 가능(레드팀 H1).
 *   운영 경로는 server/middleware.ts + api/security.ts clientIp(req, trustProxyHops)를 사용한다.
 *   이 예시를 실제 라우트로 승격할 때는 신뢰 프록시 경계를 반드시 적용할 것.
 */
export function clientKey(headers: { get(name: string): string | null }): string {
  const fwd = headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || headers.get("x-real-ip") || "unknown";
}
