/**
 * 클라이언트 환경 진단 회귀가드 — 자동 관측·추적·가이드 동작 + '복구 권한 없음' 불변식 고정.
 *   배경: 먹통/SW갇힘/연결실패는 window.onerror로 안 잡혀 사용자 설명에 의존했다. 이 store가 앱의 자기보고를 집계한다.
 *   ⚠ 핵심 불변식: 관측/집계만 — 어떤 복구(unregister·캐시삭제)도 트리거하지 않는다. 가이드는 텍스트 안내일 뿐.
 */
import { describe, it, expect } from "vitest";
import { ClientDiagStore } from "../ops/clientDiag";

describe("clientDiag (자동 관측·추적·가이드 — 복구 없음)", () => {
  it("부팅 비콘 집계 — total·SW상태·뷰포트 분포", () => {
    const s = new ClientDiagStore();
    s.record({ sw: "controlled", viewport: "desktop", online: true });
    s.record({ sw: "none", viewport: "mobile", online: true });
    const snap = s.snapshot();
    expect(snap.total).toBe(2);
    expect(snap.sw.controlled).toBe(1);
    expect(snap.byViewport.mobile).toBe(1);
  });

  it("직전 오프라인(먹통) 자동 관측 — offlinePrev 집계(window.onerror로 못 잡던 것)", () => {
    const s = new ClientDiagStore();
    s.record({ offlinePrev: true, sw: "none" });
    expect(s.snapshot().offlinePrev).toBe(1);
  });

  it("오프라인 10건마다 가이드 반환 — '점검 권장'이고 '자동 복구 안 함' 명시(복구 권한 없음 불변식)", () => {
    const s = new ClientDiagStore();
    let guide: { guide: string } | null = null;
    for (let i = 0; i < 10; i++) guide = s.record({ offlinePrev: true });
    expect(guide).not.toBeNull();
    expect(guide!.guide).toContain("점검");              // '무엇을 점검하라' 안내
    expect(guide!.guide).toContain("자동 복구하지 않");   // 복구 없음을 가이드가 스스로 명시
  });

  it("콜드스타트(느린 부팅 >3s) 집계", () => {
    const s = new ClientDiagStore();
    s.record({ bootMs: 5000 });
    s.record({ bootMs: 500 });
    expect(s.snapshot().slowBoot).toBe(1);
  });

  it("캐시 버전 분포 — 옛 SW에 갇힘(옛 버전 잔존) 추적", () => {
    const s = new ClientDiagStore();
    s.record({ cacheVer: "lensmark-shell-v7" });
    s.record({ cacheVer: "lensmark-shell-v6" }); // 옛 버전이 보이면 갱신 막힘 신호
    const snap = s.snapshot();
    expect(snap.byCacheVer["lensmark-shell-v7"]).toBe(1);
    expect(snap.byCacheVer["lensmark-shell-v6"]).toBe(1);
  });
});
