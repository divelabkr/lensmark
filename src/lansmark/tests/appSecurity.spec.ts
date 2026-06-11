import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// vitest는 프로젝트 루트(skeleton)에서 실행되므로 cwd 기준 경로가 안정적이다.
const html = readFileSync(join(process.cwd(), "dashboard/lansmark_app.html"), "utf8");

// 페이지의 esc / SAFE_CROP와 동일한 알고리즘(회귀 의도 문서화 + 동작 검증)
const ESC_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: unknown): string => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
const SAFE_CROP = /^[a-z_]{1,40}$/;

describe("frontend XSS hardening (lansmark_app.html)", () => {
  it("esc() neutralizes HTML metacharacters", () => {
    expect(esc("<img src=x onerror=alert(1)>")).toBe("&lt;img src=x onerror=alert(1)&gt;");
    expect(esc(`"'&<>`)).toBe("&quot;&#39;&amp;&lt;&gt;");
    expect(esc(null)).toBe("");
  });

  it("SAFE_CROP whitelist accepts real cropIds, rejects payloads", () => {
    expect(SAFE_CROP.test("blueberry")).toBe(true);
    expect(SAFE_CROP.test("sweet_potato")).toBe(true);
    expect(SAFE_CROP.test("<img src=x>")).toBe(false);
    expect(SAFE_CROP.test("DROP TABLE")).toBe(false);
    expect(SAFE_CROP.test("")).toBe(false);
  });

  it("page defines the exact esc + SAFE_CROP and wires them at the sinks", () => {
    expect(html).toContain('String(s==null?"":s).replace(/[&<>"\']/g'); // esc algorithm present
    expect(html).toContain("const SAFE_CROP=/^[a-z_]{1,40}$/");        // cropId whitelist present
    expect(html).toContain("${esc(m)}");                                // error messages escaped
    expect(html).toContain('data-crop="${esc(cid)}"');                  // chip attrs escaped
    expect(html).toContain("PNU ${esc(parcel.pnu)}");                   // external PNU escaped
    expect(html).toContain("SAFE_CROP.test(cropId)");                   // cropId guarded before fetch
  });

  it("escapes all server-derived strings rendered into innerHTML (defense-in-depth)", () => {
    expect(html).toContain("${esc(f.reason)}");       // engine factor reasons
    expect(html).toContain("${esc(f.axis)}");         // factor axis labels
    expect(html).toContain("${esc(sim.cropNameKo)}"); // crop name
    expect(html).toContain("${esc(sim.baseSource)}"); // base source
    expect(html).toContain("${esc(d)}");              // disclaimers
    expect(html).toContain("${esc(rec.regionText)}"); // region label
    expect(html).toContain("${esc(calF.reason)}");    // calibration reason
  });
});

// 결과 카드 시각화 — 소득 확률 밴드 + 6축 토네이도(회귀가드: 업그레이드 배선 + '정직성' 매핑 고정)
describe("result card visualization (probability band + factor tornado)", () => {
  it("소득 확률 밴드: P50 농도 피크 그라디언트 + 분위 눈금", () => {
    expect(html).toContain("linear-gradient(90deg,${edge} 0%,${peak}"); // P50에서 가장 진한 농도(밴드)
    expect(html).toContain('class="qtick"');                            // P10·P90 분위 눈금
  });
  it("6축 토네이도: 발산 막대 배선 + 소득방향(수율↑·비용↓=+) 정직 매핑", () => {
    expect(html).toContain('class="trow"');                  // 토네이도 행
    expect(html).toContain('class="tbar"');                  // 중앙 0 기준 막대 트랙
    expect(html).toContain('class="tfill ${cls}"');          // 방향·색 채움
    expect(html).toContain('f.target==="cost"?raw<0:raw>0'); // 비용 증가=소득↓로 정직 매핑(가짜 income% 날조 X)
  });
});

// 자동 보수(품질 게이트) — base 데모/미검증이면 '✓검증' 차단·'추정' 강제(정직성 행위 고정)
describe("auto-conservative data gate (base 미검증 → ✓검증 차단)", () => {
  it("결과 카드 ✓검증은 보정+base 검증 둘 다일 때만(데모면 추정 강제)", () => {
    expect(html).toContain("(validated&&!baseDemo)?'✓ 검증':'추정'");
  });
  it("비교표 ✓검증도 base 검증 동반 필수", () => {
    expect(html).toContain('r.sim.dataLabel==="validated"&&!/데모|미검증/.test(r.sim.baseSource');
  });
});
