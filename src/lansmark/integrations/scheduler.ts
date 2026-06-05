/**
 * 모니터링 크론 seam(HUMAN GATE 인프라) — 등록된 점검 작업을 주기 실행한다.
 *   책임: 작업 등록/시작/중지(무의존성 setInterval). 실제 점검 로직(특보·예찰 폴링)은
 *         데이터 seam(kma-warning·ncpms) 승격 시 register로 붙인다 — 여기선 '실행기'만 제공.
 *   ⚠ 기본 비활성 — LANSMARK_MONITOR_CRON=1 일 때만 start()가 타이머를 가동한다(운영 의도 명시).
 *   안전: 최소 주기 1분(과다폴링 방지) · 작업 throw는 삼켜서 스케줄러가 죽지 않게 · timer.unref로 프로세스 종료를 막지 않음.
 */

/** 주기 점검 작업 — id(중복 방지)·everyMs(주기)·run(점검 1회). */
export interface MonitorJob {
  id: string;
  everyMs: number;
  run: () => Promise<void>;
}

export class MonitorScheduler {
  private jobs = new Map<string, MonitorJob>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  /** 작업 등록(같은 id는 덮어씀). 데이터 seam 승격 시 호출. */
  register(job: MonitorJob): void {
    this.jobs.set(job.id, job);
  }

  get size(): number {
    return this.jobs.size;
  }

  get running(): boolean {
    return this.timers.size > 0;
  }

  /**
   * env 게이트 — 기본 off. 켜졌고 작업이 있을 때만 타이머 가동.
   * @returns started=이번 호출에서 '신규' 가동한 타이머 수(누적 총수 아님), enabled=크론 활성 여부
   */
  start(): { started: number; enabled: boolean } {
    const enabled = (process.env.LANSMARK_MONITOR_CRON || "") === "1";
    if (!enabled) return { started: 0, enabled: false }; // 미활성 — 아무 것도 가동하지 않음
    let started = 0; // 이번 호출 신규 가동 수(F2: timers.size 누적과 구분 — JSDoc 계약 일치)
    for (const job of this.jobs.values()) {
      if (this.timers.has(job.id)) continue; // 이미 가동 중
      // F1: NaN/Infinity 같은 비유한 everyMs는 Math.max로도 안 걸러져 setInterval이 0(즉시폭발)이 됨 → 먼저 유한 정규화.
      const ms = Number.isFinite(job.everyMs) ? job.everyMs : 60_000;
      const everyMs = Math.max(60_000, ms); // 최소 1분(과다폴링·레이트리밋 보호)
      const t = setInterval(() => { job.run().catch(() => { /* 점검 실패는 삼킴 — 스케줄러 생존 */ }); }, everyMs);
      if (typeof (t as { unref?: () => void }).unref === "function") (t as { unref: () => void }).unref();
      this.timers.set(job.id, t);
      started++;
    }
    return { started, enabled: true };
  }

  /** 모든 타이머 중지(재시작·테스트용). */
  stop(): void {
    for (const t of this.timers.values()) clearInterval(t);
    this.timers.clear();
  }
}
