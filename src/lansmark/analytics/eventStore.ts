/**
 * 익명 수요·퍼널 집계 스토어(메모리) — 차원별 카운트만 보관(PII 0·개별 여정 X).
 *   파일 영속은 db/stores.ts의 FileAnalyticsStore가 이 클래스를 상속해 throttle flush로 구현(잦은 쓰기 부담↓).
 *   상한(CAP)으로 신규 키 폭증(메모리/DoS)을 차단 — 작물×지역은 본래 유계(카탈로그×행정구역)지만 방어심화.
 */
import type { AnalyticsStore, AnalyticsSnapshot, FunnelStage } from "./types";

const STAGES: FunnelStage[] = ["recommend", "simulate", "guide", "foreign", "journal", "subscribe"];
const DEMAND_CAP = 10_000; // 작물×지역 키 상한(현실 최대 ~수천)
const GAP_CAP = 2_000;     // 데이터갭 키 상한
const DAYS_KEEP = 30;      // 일별 버킷 롤링 보관(시계열) — 메모리/blob 바운드
const SEEN_CAP = 20_000;   // 익명 기기 해시 토큰 상한(신규/재방문 — blob<900k·FIFO 축출)

/** 일별 카운트 — 퍼널 6단계 + 신규/재방문 + 가입. 앞 6키는 FunnelStage와 동일(직접 인덱싱). 영속 어댑터가 직렬화. */
export type DayCounts = { recommend: number; simulate: number; guide: number; foreign: number; journal: number; subscribe: number; newVisitors: number; returning: number; signups: number };
const zeroDay = (): DayCounts => ({ recommend: 0, simulate: 0, guide: 0, foreign: 0, journal: 0, subscribe: 0, newVisitors: 0, returning: 0, signups: 0 });

/** 행정구역명만 demand 키로 허용 — 숫자(전화)·라틴/긴 free-text(주소·이름)를 차단해 'PII 0'를 코드로 강제.
 *   region은 사용자 입력 free-text(검증 없음)이므로, 한글+공백+괄호+가운뎃점·20자 이하만 통과시키고 그 외는 '기타'로 버킷(레드팀 M-1). */
function safeRegionKey(region?: string): string {
  if (!region) return "-";
  const r = region.trim();
  return /^[가-힣\s()·]{1,20}$/.test(r) ? r : "기타";
}

export class InMemoryAnalyticsStore implements AnalyticsStore {
  protected funnelC: Record<string, number> = {};
  protected demandC = new Map<string, number>();
  protected gapC = new Map<string, number>();
  protected since = new Date().toISOString();
  protected dailyC = new Map<string, DayCounts>();   // 일별 버킷(시계열·롤링 DAYS_KEEP)
  protected seenAnon = new Set<string>();             // 익명 기기 해시(중복제거 → 신규/재방문). 여정 미저장·바운드(SEEN_CAP·FIFO)
  protected signupC: Record<string, number> = {};     // 가입 방법별 누적(email|phone|…)
  private todaySeen = new Set<string>();              // 당일 이미 집계한 기기(일 단위 중복제거·휘발·미영속)
  private dayActive = "";                              // 현재 일자(바뀌면 todaySeen 리셋)
  private warnedCap = new Set<string>();              // 상한 경고 1회만(로그 스팸 방지·재시작 시 리셋)

  funnel(stage: FunnelStage, anonId?: string): void {
    if (!STAGES.includes(stage)) return;              // 화이트리스트(임의 키 주입 차단)
    this.funnelC[stage] = (this.funnelC[stage] ?? 0) + 1;
    const b = this.day();
    b[stage] += 1;                                     // 일별 버킷(stage 키=DayCounts 필드)
    // 신규/재방문 — '유입'(recommend)에서만, 유효 익명 기기를 당일 1회 판정(세션 시작 신호·중복 클릭 무시).
    // ⚠ 위조 가능(red-team): 조작된 anon-id 스팸으로 신규 부풀리기/seenAnon FIFO 축출 가능 → /api/* 글로벌 레이트리밋(IP당)으로 바운드 + UI '참고용' 라벨. 정밀 집계는 DB 어댑터(§3-1).
    if (stage === "recommend") {
      const t = this.anonToken(anonId);
      if (t && !this.todaySeen.has(t)) {
        this.todaySeen.add(t);
        if (this.seenAnon.has(t)) b.returning += 1;                       // 이전에 본 기기 = 재방문
        else { this.seenAnon.add(t); b.newVisitors += 1; this.capSeen(); } // 처음 본 기기 = 신규
      }
    }
    this.persist();
  }

  demand(cropId: string, region?: string): void {
    if (!cropId) return;
    const key = cropId.slice(0, 60) + "|" + safeRegionKey(region); // region은 행정구역명만(숫자·free-text→'기타') → PII 0 강제
    if (!this.demandC.has(key) && this.demandC.size >= DEMAND_CAP) { this.warnCap("demand", DEMAND_CAP); return; } // 신규 키 상한 → 무시(기존은 계속 증가)
    this.demandC.set(key, (this.demandC.get(key) ?? 0) + 1);
    this.persist();
  }

  dataGap(key: string): void {
    if (!key) return;
    const k = key.slice(0, 120);
    if (!this.gapC.has(k) && this.gapC.size >= GAP_CAP) { this.warnCap("dataGap", GAP_CAP); return; }
    this.gapC.set(k, (this.gapC.get(k) ?? 0) + 1);
    this.persist();
  }

  /** 상한 도달 가시화(1회) — 조용한 누락 방지(레드팀 L-1, entitlement 스토어 패턴과 일관). */
  private warnCap(which: string, cap: number): void {
    if (this.warnedCap.has(which)) return;
    this.warnedCap.add(which);
    console.warn(`[analytics] ${which} 키 상한(${cap}) 도달 — 신규 키 누락(차원 폭증 신호). 운영은 DB 집계 권장.`);
  }

  /** 계정 생성(가입) 1건 — 방법별 누적 + 그날 가입 수. (account/auth/verify의 신규 분기에서 호출) */
  signup(method: string): void {
    const m = /^[a-z]{1,16}$/.test(method) ? method : "기타"; // 화이트리스트(임의 키 차단)
    this.signupC[m] = (this.signupC[m] ?? 0) + 1;
    this.day().signups += 1;
    this.persist();
  }

  /** 오늘 버킷(없으면 생성·롤링 정리). 일자가 바뀌면 당일 중복제거셋 리셋. */
  private day(): DayCounts {
    const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD(UTC)
    if (d !== this.dayActive) { this.dayActive = d; this.todaySeen = new Set(); }
    let b = this.dailyC.get(d);
    if (!b) { b = zeroDay(); this.dailyC.set(d, b); this.pruneDaily(); }
    return b;
  }
  /** 롤링 보관 — 가장 오래된 날부터 DAYS_KEEP 초과분 삭제(YYYY-MM-DD 사전순=시간순). */
  private pruneDaily(): void {
    if (this.dailyC.size <= DAYS_KEEP) return;
    const keys = [...this.dailyC.keys()].sort();
    for (const k of keys.slice(0, keys.length - DAYS_KEEP)) this.dailyC.delete(k);
  }
  /** 익명 기기ID(불투명 anon-… 헤더)를 짧은 토큰으로 — 저장 바운드 + 추가 비식별. 유효 포맷만(없음/위조/즉석생성 제외 → '신규' 오염 방지). */
  private anonToken(raw?: string): string | null {
    if (!raw || !/^anon-[a-f0-9]{8,64}$/.test(raw)) return null;
    let h = 0x811c9dc5; for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 0x01000193); } // FNV-1a 32-bit
    return (h >>> 0).toString(36);
  }
  /** 해시 집합 상한 — FIFO 축출. ⚠ 축출된 기기는 재방문해도 '신규'로(beta 규모 OK · per-record/bloom 승격 시 해소). */
  private capSeen(): void {
    if (this.seenAnon.size <= SEEN_CAP) return;
    const f = this.seenAnon.keys().next().value as string | undefined;
    if (f) this.seenAnon.delete(f);
  }

  snapshot(topN = 30): AnalyticsSnapshot {
    const funnel = {} as Record<FunnelStage, number>;
    for (const s of STAGES) funnel[s] = this.funnelC[s] ?? 0; // 고정 키 순서로 노출(누락 단계=0)
    const demand = [...this.demandC.entries()]
      .map(([k, sims]) => { const i = k.indexOf("|"); return { cropId: k.slice(0, i), region: k.slice(i + 1), sims }; })
      .sort((a, b) => b.sims - a.sims)
      .slice(0, topN);
    const dataGaps = [...this.gapC.entries()]
      .map(([key, hits]) => ({ key, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, topN);
    const days = [...this.dailyC.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, c]) => ({ date, ...c })); // 날짜 오름차순 시계열
    return { funnel, demand, dataGaps, demandKeys: this.demandC.size, since: this.since, days, signups: { ...this.signupC } };
  }

  protected persist(): void { /* 메모리: no-op */ }
}
