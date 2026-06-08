/**
 * 세션 저장소 — 인터페이스 + 메모리 어댑터. 파일 어댑터는 db/stores.ts(FileSessionStore).
 *   세션 토큰=무작위 불투명값(추측 불가). get은 만료 검사(지연 정리). 세션 분실=재로그인이라 영속은 선택.
 */
import type { Session } from "./types";

export interface SessionStore {
  create(s: Session): void;
  get(token: string): Session | undefined; // 만료/부재 시 undefined(만료분은 지연 정리)
  delete(token: string): void;              // 로그아웃
  size(): number;
}

const CAP = 500_000;

export class InMemorySessionStore implements SessionStore {
  protected map = new Map<string, Session>();
  constructor(protected readonly cap = CAP) {}
  create(s: Session): void { this.map.set(s.token, { ...s }); this.evict(); this.persist(); }
  get(token: string): Session | undefined {
    const s = this.map.get(token);
    if (!s) return undefined;
    if (Date.parse(s.expiresAt) <= Date.now()) { this.map.delete(token); this.persist(); return undefined; } // 만료 → 정리
    return { ...s };
  }
  delete(token: string): void { if (this.map.delete(token)) this.persist(); }
  size(): number { return this.map.size; }
  protected evict(): void { while (this.map.size > this.cap) { const k = this.map.keys().next().value as string | undefined; if (!k) break; this.map.delete(k); } }
  protected persist(): void { /* 메모리: no-op */ }
}

/** 세션 토큰 → 계정 userId("acct:Z")로 해석(만료/부재 시 null). 라우트 신원 해석 공통 헬퍼(journal 등에서 사용). */
export function sessionAccountUserId(sessions: SessionStore, token: unknown): string | null {
  if (typeof token !== "string" || !token) return null;
  const s = sessions.get(token);
  return s ? "acct:" + s.accountId : null;
}
