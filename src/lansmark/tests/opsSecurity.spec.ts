/**
 * 운영 콘솔(lansmark_ops.html) 보안 회귀가드 — app html(appSecurity.spec)과 동일 철학.
 *   목적: ops가 서버유래 문자열(감사로그 detail·데이터갭 키·수요 지역 등)을 innerHTML에 넣을 때 esc 강제 +
 *        CSP-safe(inline onclick 0·addEventListener만) + 관리자 게이트 배선을 회귀로 고정.
 *   배경: 5섹션 재편(v0.53) 시 ops엔 이런 가드 테스트가 없어, 향후 편집이 미escape 싱크를 들일 위험을 차단(red-team #2).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const html = readFileSync(join(process.cwd(), "dashboard/lansmark_ops.html"), "utf8");

describe("operator console XSS hardening (lansmark_ops.html)", () => {
  it("esc() 정의 + 서버유래 싱크에 결선(defense-in-depth)", () => {
    expect(html).toContain('String(s==null?"":s).replace(/[&<>"\']/g'); // esc 알고리즘 present
    expect(html).toContain("${esc(e.detail)}");   // 활동로그 detail(감사 이벤트 — 사용자 영향 가능)
    expect(html).toContain("${esc(e.type)}");     // 활동로그 type
    expect(html).toContain("${esc(g.key)}");      // 데이터갭 키(작물/외래명 유래)
    expect(html).toContain("${esc(d.region)}");   // 수요 히트맵 지역
    expect(html).toContain("${esc(b.cropId)}");   // 지형버킷 작물
    expect(html).toContain("${esc(st.label)}");   // 퍼널 드롭오프 단계 라벨
  });
  it("CSP-safe: inline 이벤트 핸들러 없음 — addEventListener만", () => {
    expect(html).not.toContain("onclick=");
    expect(html).not.toContain("onerror=");
    expect(html).toContain("addEventListener");
  });
  it("관리자 게이트: stats·변이는 adminHdr 경유(토큰 없으면 빈 헤더)", () => {
    expect(html).toContain('sessionStorage.getItem("lansmark_admin")');
    expect(html).toContain("adminHdr()");
  });
});
