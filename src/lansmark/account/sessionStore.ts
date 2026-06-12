/**
 * 세션 저장소 — 인터페이스 + 메모리 어댑터. 파일 어댑터는 db/stores.ts(FileSessionStore).
 *   세션 토큰=무작위 불투명값(추측 불가). get은 만료 검사(지연 정리). 세션 분실=재로그인이라 영속은 선택.
 *   G2 보강: 토큰을 at-rest '해시(SHA-256)'로 보관 — 스토어가 읽혀도(콘솔·백업·유출) 원토큰 미노출=세션 탈취 불가.
 *     쿠키엔 원토큰, 저장·조회 키는 해시(인터페이스 무변경 — get(token)이 내부에서 해시). 192bit 무작위라 평문 SHA-256로 충분(브루트포스 무의미).
 *     ⚠ 기존 평문 키 세션은 해시 조회에 안 맞아 1회 무효화(재로그인) — 베타 규모에서 수용.
 */
import { createHash } from "node:crypto";
import type { Session } from "./types";

export interface SessionStore {
  create(s: Session): void;
  get(token: string): Session | undefined; // 만료/부재 시 undefined(만료분은 지연 정리)
  delete(token: string): void;              // 로그아웃
  size(): number;
}

const CAP = 500_000;
/** 토큰 → at-rest 키(SHA-256 hex). 저장소엔 이 값만 — 원토큰은 클라이언트 쿠키에만 존재. */
const tokenHash = (t: string): string => createHash("sha256").update(t).digest("hex");

export class InMemorySessionStore implements SessionStore {
  protected map = new Map<string, Session>();
  constructor(protected readonly cap = CAP) {}
  create(s: Session): void { const h = tokenHash(s.token); this.map.set(h, { ...s, token: h }); this.evict(); this.persist(); } // 레코드의 token 필드도 해시(영속 스냅샷에 원토큰 0)
  get(token: string): Session | undefined {
    const h = tokenHash(token);
    const s = this.map.get(h);
    if (!s) return undefined;
    if (Date.parse(s.expiresAt) <= Date.now()) { this.map.delete(h); this.persist(); return undefined; } // 만료 → 정리
    return { ...s };
  }
  delete(token: string): void { if (this.map.delete(tokenHash(token))) this.persist(); }
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
