/**
 * 클라이언트 환경 진단 텔레메트리(관측·추적·가이드 — 복구 권한 없음).
 *   왜: 먹통·연결실패·SW 갇힘·OFFLINE_HTML·콜드스타트는 window.onerror(JS 에러)로 안 잡힌다 →
 *       이전엔 사용자가 '먹통'이라 말해야 알았다. 앱이 부팅 때 자기 환경을 익명으로 보고 → 운영자가 ops에서 추적.
 *   ⚠ 관측 전용(설계 불변식): 이 store는 기록/집계만 한다. SW unregister·캐시삭제·재시작 같은 '복구'는 절대 하지 않는다
 *      (read/append only). 복구 행동은 운영자/사용자가 가이드를 보고 수행한다 — 자동 복구 권한 없음.
 *   PII 0: 환경 신호(SW 상태·online·뷰포트·부팅 ms·캐시 버전)만. 메모리 보관(재시작 휘발 — 텔레메트리 성격상 충분).
 *   형제: clientErrors.ts(JS 에러) — 이쪽은 '안 뜨는/이상한 상태'(에러 아님)를 관측한다.
 */
export interface ClientDiagInput {
  sw?: string;            // "controlled" | "none" | "redundant" | "installing" — 부팅 시 서비스워커 상태
  offlinePrev?: boolean;  // 직전 세션에 OFFLINE_HTML(연결 실패 화면)을 겪음(클라 localStorage 플래그) — 먹통 자동 관측의 핵심
  bootMs?: number;        // 부팅 소요(navigation timing) — 콜드스타트 체감
  online?: boolean;       // navigator.onLine
  cacheVer?: string;      // 앱셸 캐시 버전(옛 SW에 갇힘 추적 — 옛 버전이 계속 보이면 갱신 막힘)
  viewport?: string;      // "mobile" | "desktop"
}

export interface ClientDiagSnapshot {
  total: number;                        // 누적 부팅 비콘 수(= 정상 부팅한 클라이언트 — 비콘조차 못 보내면 더 심각)
  offlinePrev: number;                  // 직전 오프라인(연결 실패) 겪은 보고 수 — 먹통 자동 관측
  slowBoot: number;                     // 부팅 느림(>3s) 보고 수 — 콜드스타트 체감
  sw: Record<string, number>;           // SW 상태 분포(controlled/none/redundant…)
  byCacheVer: Record<string, number>;   // 캐시 버전 분포(옛 버전 잔존 = 갱신 막힘)
  byViewport: Record<string, number>;   // 모바일/데스크톱 분포
  lastAt: string | null;
}

const SLOW_BOOT_MS = 3000;  // 콜드스타트 체감 임계
const VER_CAP = 12, VP_CAP = 6, SW_CAP = 8;

export class ClientDiagStore {
  private t = 0; private offline = 0; private slow = 0;
  private swMap = new Map<string, number>();
  private verMap = new Map<string, number>();
  private vpMap = new Map<string, number>();
  private last: string | null = null;

  private inc(m: Map<string, number>, k: string | undefined, cap: number): void {
    if (!k) return;
    m.set(k, (m.get(k) ?? 0) + 1);
    if (m.size > cap) { const f = m.keys().next().value as string | undefined; if (f !== undefined && f !== k) m.delete(f); } // FIFO 바운드(메모리 가드)
  }

  /**
   * 부팅 비콘 1건 기록(관측 전용). 가이드가 필요한 신호(오프라인 다발·SW redundant 다발)면 가이드 문자열 반환.
   *   ⚠ 반환은 '운영자에게 무엇을 점검하라'는 안내 텍스트일 뿐 — 어떤 복구도 트리거하지 않는다.
   */
  record(d: ClientDiagInput, now: string = new Date().toISOString()): { guide: string } | null {
    this.t++; this.last = now;
    this.inc(this.swMap, d.sw, SW_CAP);
    this.inc(this.verMap, d.cacheVer, VER_CAP);
    this.inc(this.vpMap, d.viewport, VP_CAP);
    if (d.bootMs != null && d.bootMs > SLOW_BOOT_MS) this.slow++;
    if (d.offlinePrev) {
      this.offline++;
      // 가이드(복구 아님): 직전 오프라인 보고가 10건 배수마다 운영자에게 '무엇을 점검하라'. 자동 조치는 없음.
      if (this.offline % 10 === 0) return { guide: `연결 실패(OFFLINE) 보고 ${this.offline}건 — Cloudflare sw.js 캐시·콜드스타트(min=0) 점검 권장(앱은 자동 복구하지 않음).` };
    }
    const red = this.swMap.get("redundant") ?? 0;
    if (d.sw === "redundant" && red % 10 === 0) {
      return { guide: `SW install 실패(redundant) ${red}건 — PWA 비활성(앱은 서버직통으로 정상). zstd/Vary 인코딩 점검 권장.` };
    }
    return null;
  }

  snapshot(): ClientDiagSnapshot {
    const obj = (m: Map<string, number>) => Object.fromEntries(m);
    return {
      total: this.t, offlinePrev: this.offline, slowBoot: this.slow,
      sw: obj(this.swMap), byCacheVer: obj(this.verMap), byViewport: obj(this.vpMap), lastAt: this.last,
    };
  }
}
