import { describe, it, expect } from "vitest";
import { cached } from "../data/providers/cache";

// provider 외부조회 캐시 데코레이터 회귀가드 — hit 절감·in-flight 병합(stampede)·cap 방출·실패 비캐시.
describe("cached — TTL 캐시 + in-flight 병합(외부호출 절감)", () => {
  it("TTL 내 재호출은 원본 fn 1회만(캐시 hit)", async () => {
    let calls = 0;
    const fn = cached(async (x: number) => { calls++; return x * 2; }, { ttlMs: 10_000, key: (x) => String(x) });
    expect(await fn(5)).toBe(10);
    expect(await fn(5)).toBe(10); // 같은 키 → 캐시
    expect(calls).toBe(1);
  });

  it("다른 키는 각각 호출", async () => {
    let calls = 0;
    const fn = cached(async (x: number) => { calls++; return x; }, { ttlMs: 10_000, key: (x) => String(x) });
    await fn(1); await fn(2);
    expect(calls).toBe(2);
  });

  it("ttl 0이면 항상 재호출(만료 경로)", async () => {
    let calls = 0;
    const fn = cached(async (x: number) => { calls++; return x; }, { ttlMs: 0, key: (x) => String(x) });
    await fn(1); await fn(1);
    expect(calls).toBe(2);
  });

  it("in-flight 병합 — 동시 동일요청은 1회로 합침(thundering herd 차단)", async () => {
    let calls = 0;
    const fn = cached(async (x: number) => { calls++; await new Promise((r) => setTimeout(r, 20)); return x; }, { ttlMs: 10_000, key: (x) => String(x) });
    const [a, b] = await Promise.all([fn(7), fn(7)]); // 동시 2요청
    expect(a).toBe(7); expect(b).toBe(7);
    expect(calls).toBe(1);
  });

  it("cap 초과 시 가장 오래된 항목 방출(메모리 가드)", async () => {
    let calls = 0;
    const fn = cached(async (x: number) => { calls++; return x; }, { ttlMs: 100_000, key: (x) => String(x), cap: 2 });
    await fn(1); await fn(2); await fn(3); // 1 방출
    await fn(1);                            // 방출됐으니 재호출
    expect(calls).toBe(4);
  });

  it("실패는 캐시하지 않는다(다음 호출이 재시도)", async () => {
    let calls = 0;
    const fn = cached(async (): Promise<number> => { calls++; throw new Error("boom"); }, { ttlMs: 100_000, key: () => "k" });
    await expect(fn()).rejects.toThrow("boom");
    await expect(fn()).rejects.toThrow("boom");
    expect(calls).toBe(2); // 두 번 다 시도(실패 비캐시)
  });
});
