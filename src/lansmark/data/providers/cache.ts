/**
 * 외부조회 TTL 캐시 + in-flight 병합 — 무의존 데코레이터(단일 인스턴스 in-memory).
 *   왜: 같은 땅·작물을 반복 분석하면 KAMIS/KMA/VWorld/DEM을 매번 재호출 → 무료 API라 '비용'보다 7초 타임아웃·쿼터·체감을 해친다.
 *       격자/작물 키로 묶어 "한 번 데운 값을 모두가 재사용". 동시 동일요청은 in-flight로 1회 합침(thundering herd 차단).
 *   왜 Map(Redis 아님): min=max=1 단일 인스턴스라 인스턴스 간 공유 불필요 → Map으로 충분(무의존·비용0). 재시작 휘발은 무료 API라 무해(재호출 $0).
 *   ⚠ 캐시키에 비밀(API키)을 넣지 않는다 — opt.key가 좌표·작물 등 식별자만 쓰도록 호출부가 보장.
 */
type Entry<V> = { at: number; v: V };

export function cached<A extends unknown[], V>(
  fn: (...a: A) => Promise<V>,
  opt: { ttlMs: number; key: (...a: A) => string; cap?: number },
): (...a: A) => Promise<V> {
  const store = new Map<string, Entry<V>>();
  const inflight = new Map<string, Promise<V>>();
  return (...a: A): Promise<V> => {
    const k = opt.key(...a);
    const hit = store.get(k);
    if (hit && Date.now() - hit.at < opt.ttlMs) return Promise.resolve(hit.v); // 신선 → 즉시(외부호출 0)
    const flying = inflight.get(k);
    if (flying) return flying;                                                  // 진행 중 → 공유(stampede 차단)
    const p = fn(...a)
      .then((v) => {
        store.set(k, { at: Date.now(), v });
        // FIFO 방출(삽입순 Map의 첫 키) — 키가 격자/작물이라 폭발하지 않지만 상한으로 메모리 가드.
        if (opt.cap && store.size > opt.cap) {
          const oldest = store.keys().next().value;
          if (oldest !== undefined) store.delete(oldest);
        }
        inflight.delete(k);
        return v;
      })
      .catch((e) => { inflight.delete(k); throw e; }); // 실패는 캐시 안 함(다음 호출이 재시도) — in-flight만 정리
    inflight.set(k, p);
    return p;
  };
}
