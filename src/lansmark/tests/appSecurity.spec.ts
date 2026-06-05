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
