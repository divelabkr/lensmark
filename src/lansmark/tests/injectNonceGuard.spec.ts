/**
 * injectNonce 회귀가드(단일 실패점 방어) — CSP script-src에 'unsafe-inline'이 없어(security.ts)
 * 인라인 <script>는 nonce가 정확히 주입돼야만 실행된다. dashboard/lansmark_app.html의 메인 인라인
 * 스크립트(앱 전체 로직 ~1400줄)에 nonce가 한 글자라도 빗나가면 → 그 스크립트가 통째 CSP 차단 →
 * 지도·시뮬·UI 전부 죽은 흰 화면(HTML은 뜨나 무동작). HTML 편집 회귀로 즉시 전면 먹통이 되는
 * 지점이라, 실제 파일에 injectNonce를 적용해 "인라인=정확히 nonce 1개·외부 src=0개"를 고정한다.
 *   스타일: disclaimerCoverage/serverRoutes.spec.ts 와 동일(소스 존재 검증 + 스모크 회귀가드).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { injectNonce, inlineScriptsMissingNonce, genNonce } from "../api/security";

// 테스트용 고정 nonce — genNonce의 base64는 +,/ 등 정규식 메타문자를 포함할 수 있어 매칭이 깨진다.
// 카운팅/포함검사는 영숫자 고정값으로 안전하게(실제 base64 값 주입은 별도 it에서 따로 검증).
const NONCE = "TESTNONCEabc123XYZ";

// 독립 스캐너 — injectNonce의 정규식과 분리된 방식으로 여는 <script> 태그를 센다(순환검증 방지).
const openScriptTags = (html: string): string[] => html.match(/<script\b[^>]*>/gi) ?? [];
const isExternal = (tag: string): boolean => /\bsrc\s*=/i.test(tag);            // 실제 src 속성 보유 = 외부
const nonceCount = (s: string, nonce: string): number => s.split(`nonce="${nonce}"`).length - 1; // 문자열 기반(메타문자 내성)

const DASHBOARD = join(process.cwd(), "dashboard");
const PAGES = ["lansmark_app.html", "lansmark_ops.html"] as const; // injectNonce가 실제 적용되는 서빙 페이지

describe("injectNonce — 실제 dashboard 파일 회귀가드", () => {
  for (const page of PAGES) {
    describe(page, () => {
      const html = readFileSync(join(DASHBOARD, page), "utf-8");
      const inlineTags = openScriptTags(html).filter((t) => !isExternal(t));
      const out = injectNonce(html, NONCE);

      it("인라인 <script>가 최소 1개 존재(메인 앱 스크립트 — 가드가 무의미하지 않음)", () => {
        expect(inlineTags.length).toBeGreaterThan(0);
      });

      it("주입된 nonce 총개수 = 인라인 스크립트 개수(과주입·소주입 없음)", () => {
        expect(nonceCount(out, NONCE)).toBe(inlineTags.length);
      });

      it("여는 <script> 태그별: 인라인=정확히 nonce 1개, 외부(src)=0개", () => {
        for (const tag of openScriptTags(out)) {
          if (isExternal(tag)) expect(nonceCount(tag, NONCE)).toBe(0); // 외부는 호스트 허용 → nonce 금지
          else expect(nonceCount(tag, NONCE)).toBe(1);                 // 인라인은 정확히 1개여야 실행됨
        }
      });

      it("사후검증: nonce 누락 인라인 스크립트 0개(흰 화면 위험 없음)", () => {
        expect(inlineScriptsMissingNonce(out, NONCE)).toEqual([]);
      });

      it("genNonce()의 실제 base64 값으로도 인라인 스크립트에 정확히 주입됨", () => {
        const n = genNonce();
        const o = injectNonce(html, n); // 사후검증 throw 없이 통과해야 함
        for (const tag of openScriptTags(o).filter((t) => !isExternal(t)))
          expect(tag.includes(`nonce="${n}"`)).toBe(true); // base64는 문자열 포함검사로(메타문자 회피)
      });
    });
  }

  it("lansmark_app.html: 외부 leaflet CDN 스크립트는 nonce 없이 그대로 보존", () => {
    const html = readFileSync(join(DASHBOARD, "lansmark_app.html"), "utf-8");
    const out = injectNonce(html, NONCE);
    const leaflet = openScriptTags(out).find((t) => /leaflet/i.test(t));
    expect(leaflet).toBeDefined();              // 외부 스크립트 존재 확인
    expect(isExternal(leaflet!)).toBe(true);    // src 보유(외부) 맞음
    expect(leaflet!.includes("nonce=")).toBe(false); // nonce 미주입(허용목록으로 충분)
  });
});

describe("injectNonce — 엣지 케이스 단위(정규식이 어긋나지 않는지)", () => {
  it("속성 없는 bare <script> → <script> 직후에 nonce 주입", () => {
    expect(injectNonce("<script>var a=1;</script>", NONCE))
      .toBe(`<script nonce="${NONCE}">var a=1;</script>`);
  });

  it("속성 보존(type=module 등) + nonce는 항상 <script> 직후", () => {
    expect(injectNonce(`<script type="module">x()</script>`, NONCE))
      .toBe(`<script nonce="${NONCE}" type="module">x()</script>`);
  });

  it("외부 <script src> → nonce 미주입(원문 그대로)", () => {
    const html = `<script src="https://cdnjs.cloudflare.com/x.js"></script>`;
    expect(injectNonce(html, NONCE)).toBe(html);
  });

  it("src 문자열이 우연히 든 속성(data-src-hint)은 외부로 오인하지 않고 nonce 주입", () => {
    // \bsrc= 앵커 덕분에 'src-hint'(뒤가 =가 아님)는 외부로 분류되지 않는다.
    expect(injectNonce(`<script data-src-hint="x">go()</script>`, NONCE))
      .toBe(`<script nonce="${NONCE}" data-src-hint="x">go()</script>`);
  });

  it("따옴표 안에 > 가 있어도 nonce는 <script> 직후에 정확히 1개(삽입 위치 불변)", () => {
    // nonce는 항상 <script> 바로 뒤에 삽입되므로, 속성값 안의 >는 삽입 위치/개수에 영향이 없다.
    const out = injectNonce(`<script data-x="a>b">var z=1;</script>`, NONCE);
    expect(out).toBe(`<script nonce="${NONCE}" data-x="a>b">var z=1;</script>`);
    expect(nonceCount(out, NONCE)).toBe(1);
  });

  it("인라인 여러 개 → 각각 정확히 nonce 1개", () => {
    const out = injectNonce(`<script>a()</script>\n<script>b()</script>`, NONCE);
    expect(nonceCount(out, NONCE)).toBe(2);
    expect(out).toBe(`<script nonce="${NONCE}">a()</script>\n<script nonce="${NONCE}">b()</script>`);
  });

  it("대문자 <SCRIPT>도 대소문자 무시로 주입됨(i 플래그)", () => {
    expect(nonceCount(injectNonce(`<SCRIPT>x()</SCRIPT>`, NONCE), NONCE)).toBe(1);
  });

  it("인라인+외부 혼합 → 인라인만 주입, 외부는 보존", () => {
    const html = `<script src="https://cdnjs.cloudflare.com/leaflet.js"></script>\n<script>app()</script>`;
    const out = injectNonce(html, NONCE);
    expect(nonceCount(out, NONCE)).toBe(1);                                  // 인라인 1개만
    expect(out).toContain(`<script src="https://cdnjs.cloudflare.com/leaflet.js">`); // 외부 그대로
    expect(out).toContain(`<script nonce="${NONCE}">app()</script>`);
    expect(out).not.toContain(`nonce="${NONCE}" src=`);                      // 외부에 nonce 안 붙음
  });

  it("스크립트 없는 HTML(privacy/terms류) → 변경 없음·throw 없음", () => {
    const html = `<!doctype html><html><body><h1>약관</h1></body></html>`;
    expect(injectNonce(html, NONCE)).toBe(html);
  });
});

describe("inlineScriptsMissingNonce — 사후검증 헬퍼(safety net)", () => {
  it("정상 주입 결과는 누락 0(false positive 없음)", () => {
    const out = injectNonce(`<script>a()</script><script src="x.js"></script>`, NONCE);
    expect(inlineScriptsMissingNonce(out, NONCE)).toEqual([]);
  });

  it("nonce 없는 인라인 태그를 잡아낸다(정규식이 놓친 회귀 모사)", () => {
    // 주입이 빗나가 인라인 <script>에 nonce가 없는 상태를 모사 → 1건 검출돼야 함.
    expect(inlineScriptsMissingNonce(`<script>a()</script>`, NONCE)).toHaveLength(1);
  });

  it("외부 src 스크립트는 nonce 없어도 무시(검사 제외)", () => {
    expect(inlineScriptsMissingNonce(`<script src="https://cdnjs.cloudflare.com/x.js"></script>`, NONCE)).toEqual([]);
  });

  it("injectNonce는 실제 서빙 페이지 전부에서 throw하지 않는다(현재 그린 보장)", () => {
    for (const page of PAGES)
      expect(() => injectNonce(readFileSync(join(DASHBOARD, page), "utf-8"), NONCE)).not.toThrow();
  });
});
