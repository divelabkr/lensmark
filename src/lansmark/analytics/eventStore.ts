/**
 * 익명 수요·퍼널 집계 스토어(메모리) — 차원별 카운트만 보관(PII 0·개별 여정 X).
 *   파일 영속은 db/stores.ts의 FileAnalyticsStore가 이 클래스를 상속해 throttle flush로 구현(잦은 쓰기 부담↓).
 *   상한(CAP)으로 신규 키 폭증(메모리/DoS)을 차단 — 작물×지역은 본래 유계(카탈로그×행정구역)지만 방어심화.
 */
import type { AnalyticsStore, AnalyticsSnapshot, FunnelStage } from "./types";

const STAGES: FunnelStage[] = ["recommend", "simulate", "guide", "foreign", "journal", "subscribe"];
const DEMAND_CAP = 10_000; // 작물×지역 키 상한(현실 최대 ~수천)
const GAP_CAP = 2_000;     // 데이터갭 키 상한

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
  private warnedCap = new Set<string>(); // 상한 경고 1회만(로그 스팸 방지·재시작 시 리셋)

  funnel(stage: FunnelStage): void {
    if (!STAGES.includes(stage)) return;              // 화이트리스트(임의 키 주입 차단)
    this.funnelC[stage] = (this.funnelC[stage] ?? 0) + 1;
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
    return { funnel, demand, dataGaps, demandKeys: this.demandC.size, since: this.since };
  }

  protected persist(): void { /* 메모리: no-op */ }
}
