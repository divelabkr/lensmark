/**
 * Perplexity Sonar 통합 단위 검사 — 파서·가드레일·캐시·무중단 폴백.
 *   라이브 키 호출은 별도 실증(2026-06). 여기선 fetch를 모킹해 형태·계약만 고정한다.
 *   가드레일 회귀가드: ① 정량수치 금지 지시가 요청 프롬프트에 실제로 실리는가 ② citations만(https) 노출 ③ 키 없으면 null.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fetchPerplexityCultivation, perplexityConfigured } from "../integrations/perplexity";

// Perplexity 정상 응답 형태(라이브 실증): choices[0].message.content + citations[].
function okResponse(content: string, citations: unknown[]) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }], citations }), { status: 200 });
}

describe("integrations/perplexity (Sonar 재배요약)", () => {
  const KEY = "PERPLEXITY_API_KEY";
  const prev = process.env[KEY];
  beforeEach(() => { process.env[KEY] = "test-key"; });
  afterEach(() => { vi.restoreAllMocks(); if (prev === undefined) delete process.env[KEY]; else process.env[KEY] = prev; });

  it("키 없으면 configured=false·호출 시 null(무중단)", async () => {
    delete process.env[KEY];
    expect(perplexityConfigured()).toBe(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await fetchPerplexityCultivation("드래곤프루트-nokey")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled(); // 키 없으면 네트워크 0(쿼터·비용 보호)
  });

  it("정상 응답 → summary 정리(**·[n] 제거) + https citations만", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse("**망고**는 아열대 작물[1]. 물빠짐 좋은 토양이 필요.", ["https://a.example/1", "ftp://bad/2", "https://b.example/3"]) as any,
    );
    const r = await fetchPerplexityCultivation("망고-parse");
    expect(r).not.toBeNull();
    expect(r!.summary).not.toMatch(/\*\*|\[\d+\]/); // 마크다운·각주 마커 제거
    expect(r!.summary).toContain("아열대");
    expect(r!.sources).toEqual(["https://a.example/1", "https://b.example/3"]); // 비-https(ftp) 탈락
    expect(r!.model).toBe("perplexity-sonar");
  });

  it("가드레일: 요청 프롬프트가 정량수치(수확량·소득·가격)를 금지한다", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse("자료 부족.", []) as any);
    await fetchPerplexityCultivation("올리브-guard");
    const body = JSON.parse(String((spy.mock.calls[0]![1] as RequestInit).body));
    const sys = String(body.messages?.[0]?.content ?? "");
    expect(sys).toMatch(/숫자|수확량|소득|가격/); // 정량 금지 지시가 실제로 실림
    expect(body.model).toBe("sonar");
    // Authorization 헤더에 Bearer 키(값 자체는 단언 안 함 — 존재만)
    expect(String((spy.mock.calls[0]![1] as RequestInit & { headers: Record<string, string> }).headers.Authorization)).toMatch(/^Bearer /);
  });

  it("캐시: 동일 작물 2회 호출 시 fetch는 1회(비용·일관성)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse("캐시 테스트 요약.", []) as any);
    const a = await fetchPerplexityCultivation("아보카도-cache");
    const b = await fetchPerplexityCultivation("아보카도-cache");
    expect(spy).toHaveBeenCalledTimes(1); // 2번째는 캐시 적중
    expect(b).toEqual(a);
  });

  it("비정상(non-ok) 응답 → null(무중단)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("err", { status: 500 }) as any);
    expect(await fetchPerplexityCultivation("리치-500")).toBeNull();
  });

  it("빈 content → null(요약 없으면 카드 미표시)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse("", ["https://x.example"]) as any);
    expect(await fetchPerplexityCultivation("패션프루트-empty")).toBeNull();
  });
});
