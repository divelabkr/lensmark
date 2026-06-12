/**
 * Firestore 영속 어댑터(§3-1) — 오프라인 검증(fetch 주입·네트워크 0).
 *   핵심: ① warm이 원격 상태를 메모리로 복원 ② 변이가 write-through ③ 로드 실패=sealed(빈 상태 덮어쓰기 방지)
 *        ④ revoked 영속(부활 방지) ⑤ 멱등 mark/seen ⑥ 토큰 캐시.
 */
import { describe, it, expect } from "vitest";
import { FirestoreLite } from "../db/firestoreLite";
import { FsDoc, FirestoreEntitlementStore, FirestoreIdempotency, FirestoreSessionStore, FirestoreAnalyticsStore, createFirestoreStores } from "../db/firestoreStores";

/** 가짜 GCP — 메타데이터 토큰 + lm_state 문서 저장소를 메모리로 흉내. */
function fakeGcp(initialDocs: Record<string, string> = {}, opts?: { failGet?: boolean }) {
  const docs = new Map(Object.entries(initialDocs)); // key=`${coll}/${id}` → json(j 필드)
  const log = { tokenCalls: 0, sets: [] as { key: string; json: string }[], adds: [] as Record<string, string>[] };
  const fetchFn = (async (url: any, init?: any) => {
    const u = String(url);
    if (u.includes("/computeMetadata/v1/instance/service-accounts/default/token")) {
      log.tokenCalls++;
      return new Response(JSON.stringify({ access_token: "tok-" + log.tokenCalls, expires_in: 3600 }), { status: 200 });
    }
    if (u.includes("/computeMetadata/v1/project/project-id")) return new Response("test-proj", { status: 200 });
    const m = u.match(/\/documents\/([^/?]+)(?:\/([^/?]+))?/);
    const coll = m?.[1] ?? "", id = m?.[2] ? decodeURIComponent(m[2]) : undefined;
    if (init?.method === "PATCH" && id) {
      const body = JSON.parse(init.body);
      const j = body.fields.j.stringValue as string;
      docs.set(`${coll}/${id}`, j); log.sets.push({ key: `${coll}/${id}`, json: j });
      return new Response("{}", { status: 200 });
    }
    if (init?.method === "POST" && !id) {
      const body = JSON.parse(init.body);
      const flat: Record<string, string> = {}; for (const k of Object.keys(body.fields)) flat[k] = body.fields[k].stringValue;
      log.adds.push(flat);
      return new Response("{}", { status: 200 });
    }
    // GET
    if (opts?.failGet) return new Response("boom", { status: 500 });
    const j = id ? docs.get(`${coll}/${id}`) : undefined;
    if (j == null) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ fields: { j: { stringValue: j } } }), { status: 200 });
  }) as typeof fetch;
  return { fetchFn, docs, log };
}
const lite = (g: ReturnType<typeof fakeGcp>) => new FirestoreLite({ fetchFn: g.fetchFn, project: "test-proj" });
const tick = () => new Promise((r) => setTimeout(r, 20)); // write-through(비동기) 완료 대기

describe("FirestoreLite — REST·토큰", () => {
  it("getJson: 404=null(최초 부팅) · 토큰은 캐시(반복 호출에도 1회)", async () => {
    const g = fakeGcp();
    const fs = lite(g);
    expect(await fs.getJson("lm_state", "entitlement")).toBeNull();
    await fs.getJson("lm_state", "journal");
    expect(g.log.tokenCalls).toBe(1); // 만료 전 재사용
  });
  it("setJson → PATCH로 {j: json} 기록", async () => {
    const g = fakeGcp();
    await lite(g).setJson("lm_state", "x", '{"a":1}');
    expect(g.docs.get("lm_state/x")).toBe('{"a":1}');
  });
});

const ent = (g: ReturnType<typeof fakeGcp>) => new FirestoreEntitlementStore(new FsDoc(lite(g), "entitlement_use"), new FsDoc(lite(g), "entitlement_revoked"));

describe("FirestoreEntitlementStore — quota·revoked 영속(§3-1 핵심·M2 2문서 분리)", () => {
  it("warm: use/revoked 별도 문서 복원 — revoked 토큰은 재배포 후에도 거부(부활 방지)", async () => {
    const g = fakeGcp({ "lm_state/entitlement_use": JSON.stringify([["jti-a", 3]]), "lm_state/entitlement_revoked": JSON.stringify(["jti-dead"]) });
    const s = ent(g);
    await s.warm();
    expect(s.isRevoked("jti-dead")).toBe(true);      // 실효 보존
    expect(s.consume("jti-dead", 50)).toBe(false);    // 실효 토큰 거부
    expect(s.consume("jti-a", 5)).toBe(true);         // 기존 카운트 3→4 (quota 5 내)
    expect(s.consume("jti-a", 4)).toBe(false);        // 4 소진 후 quota 4 초과
  });
  it("refund: 소진 후 다운스트림 실패 환불 — 1회 복원(과금 공정성·감사 Low)", async () => {
    const s = ent(fakeGcp());
    await s.warm();
    expect(s.consume("jti-r", 2)).toBe(true); // 1/2
    s.refund("jti-r");                          // 환불 → 0
    expect(s.consume("jti-r", 2)).toBe(true);  // 1/2 다시
    expect(s.consume("jti-r", 2)).toBe(true);  // 2/2
    expect(s.consume("jti-r", 2)).toBe(false); // 초과
  });
  it("consume/revoke가 write-through로 각 문서에 반영 + persistRevokedNow 내구 확인(H3)", async () => {
    const g = fakeGcp();
    const s = ent(g);
    await s.warm();
    s.consume("jti-1", 50); s.revoke("jti-2");
    await s.persistRevokedNow(); // 내구 확인(await) — revoked 문서가 원격 반영
    await tick();
    expect(JSON.parse(g.docs.get("lm_state/entitlement_use")!)).toContainEqual(["jti-1", { n: 1 }]); // 신형 직렬화(소진 카운터+만료, P1#5)
    expect(JSON.parse(g.docs.get("lm_state/entitlement_revoked")!)).toContain("jti-2");
  });
});

describe("sealed — 로드 실패 시 빈 상태로 원격을 덮지 않는다(데이터 보호) + isDegraded(H2)", () => {
  it("warm 실패 → throw + sealed·isDegraded + 이후 save 무력화(원격 무변경)", async () => {
    const g = fakeGcp({}, { failGet: true });
    const s = ent(g);
    await expect(s.warm()).rejects.toThrow();
    expect(s.isDegraded()).toBe(true);   // H2: 유료 게이트 ON 거부 판정용
    s.consume("jti-x", 50); s.revoke("jti-y"); // 메모리는 동작
    await tick();
    expect(g.log.sets.length).toBe(0); // 그러나 원격 쓰기 0(봉인)
  });
});

describe("FirestoreIdempotency — 웹훅 재생 차단 영속", () => {
  it("mark→seen + 원격 반영, warm으로 재배포 후에도 seen 유지", async () => {
    const g = fakeGcp();
    const a = new FirestoreIdempotency(new FsDoc(lite(g), "idempotency"));
    await a.warm();
    expect(a.seen("ord-1")).toBe(false);
    a.mark("ord-1"); await tick();
    // '재배포' — 같은 원격 상태로 새 인스턴스 워밍
    const b = new FirestoreIdempotency(new FsDoc(lite(g), "idempotency"));
    await b.warm();
    expect(b.seen("ord-1")).toBe(true); // 재생 차단 유지
  });
});

describe("FirestoreSessionStore — 로그인 세션 재배포 생존", () => {
  it("세션 create → 원격 반영 → 새 인스턴스 warm 후 get 유지", async () => {
    const g = fakeGcp();
    const a = new FirestoreSessionStore(new FsDoc(lite(g), "sessions"));
    await a.warm();
    a.create({ token: "t1", accountId: "acct1", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    await tick();
    const b = new FirestoreSessionStore(new FsDoc(lite(g), "sessions"));
    await b.warm();
    expect(b.get("t1")?.accountId).toBe("acct1"); // 재배포 후 로그인 유지
  });
});

/* ───────── Analytics — 저트래픽 재배포 유실 수정(디바운스 write-through) ─────────
   배경: 라이브(firestore)에서 GET /api/recommend 3회 후 재배포 시 lm_state/analytics 미생성.
   진단: <25건 저트래픽은 throttle을 못 채워 평시 원격 쓰기 0 → 유일 통로가 종료 flush(SIGTERM)뿐이라
        SIGTERM 미수신/race 1800ms 부족 시 통째로 유실. (인프로세스 flushAll 경로 자체는 정상 — 아래 backstop 실증.)
   수정: '25건 즉시' + '마지막 flush 후 첫 변경에서 debounceMs 뒤' 중 빠른 쪽으로 영속 → 유실 폭 ≤ debounceMs. */
describe("FirestoreAnalyticsStore — 저트래픽 유실 수정(디바운스)", () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("디바운스 대기 중엔 미반영(이벤트마다 동기 쓰기 아님)", async () => {
    const g = fakeGcp();
    const a = new FirestoreAnalyticsStore(new FsDoc(lite(g), "analytics"), 60); // 60ms 디바운스
    await a.warm();
    a.funnel("recommend"); a.funnel("recommend"); a.funnel("recommend");
    await tick(); // 20ms < 60ms → 아직 타이머 대기
    expect(g.log.sets.filter((s) => s.key === "lm_state/analytics").length).toBe(0);
  });

  it("핵심 수정: <25건 저트래픽도 debounceMs 뒤 자동 영속 — SIGTERM 없이 재배포 생존", async () => {
    const g = fakeGcp();
    const a = new FirestoreAnalyticsStore(new FsDoc(lite(g), "analytics"), 40);
    await a.warm();
    a.funnel("recommend"); a.funnel("recommend"); a.funnel("recommend"); // 3건(<25)
    await wait(80); await tick(); // > debounceMs → 타이머 발화 + drain 완료
    // '재배포' 모사: 같은 원격 상태로 새 인스턴스 워밍 → 집계 생존(종료 flush 의존 없이)
    const b = new FirestoreAnalyticsStore(new FsDoc(lite(g), "analytics"), 40);
    await b.warm();
    expect(b.snapshot().funnel.recommend).toBe(3);
  });

  it("버스트: 25건 도달 시 디바운스 대기 없이 즉시 영속(throttle 유지)", async () => {
    const g = fakeGcp();
    const a = new FirestoreAnalyticsStore(new FsDoc(lite(g), "analytics"), 999_999); // 디바운스 사실상 무한
    await a.warm();
    for (let i = 0; i < 25; i++) a.demand("rice", "경기");
    await tick(); // 디바운스 대기 없이 25건째 flush
    expect(JSON.parse(g.docs.get("lm_state/analytics")!).demand[0]).toEqual(["rice|경기", 25]);
  });

  it("debounceMs=0: 디바운스 비활성(버스트 throttle만) + 종료 flush backstop은 동작", async () => {
    const g = fakeGcp();
    const a = new FirestoreAnalyticsStore(new FsDoc(lite(g), "analytics"), 0);
    await a.warm();
    a.funnel("recommend");
    await wait(40); await tick();
    expect(g.log.sets.filter((s) => s.key === "lm_state/analytics").length).toBe(0); // 0=비활성 → 자동영속 없음
    a.flush(); await tick();                                                          // backstop(즉시 flush)은 동작
    expect(JSON.parse(g.docs.get("lm_state/analytics")!).funnel.recommend).toBe(1);
  });

  it("backstop: 종료 flushAll이 analytics in-flight save를 끝까지 완료(H3·인프로세스 경로 정상)", async () => {
    const g = fakeGcp();
    const st = createFirestoreStores({ fs: lite(g), analyticsDebounceMs: 0 }); // 디바운스 off → 종료 flush만으로 검증
    await st.ready;
    st.analytics.funnel("recommend"); st.analytics.funnel("recommend"); st.analytics.funnel("recommend");
    await st.flushAll!(); // SIGTERM 경로: analytics.flush()→FsDoc.save()→drain까지 await
    expect(JSON.parse(g.docs.get("lm_state/analytics")!).funnel.recommend).toBe(3);
  });

  it("디바운스 타이머 대기 중 종료(flushAll): 타이머 해제 + 정확히 1회 영속(늦은 중복 쓰기 없음)", async () => {
    const g = fakeGcp();
    const st = createFirestoreStores({ fs: lite(g), analyticsDebounceMs: 10_000 }); // 큰 디바운스(대기 상태 유지)
    await st.ready;
    st.analytics.funnel("recommend"); st.analytics.funnel("simulate"); // 디바운스 타이머 가동(아직 미반영)
    expect(g.log.sets.filter((s) => s.key === "lm_state/analytics").length).toBe(0);
    await st.flushAll!(); await tick(); // 종료: flush()가 대기 타이머 해제 + 즉시 영속
    const sets = g.log.sets.filter((s) => s.key === "lm_state/analytics");
    expect(sets.length).toBe(1); // 타이머 해제 → 종료 후 늦은 중복 쓰기 없음
    const saved = JSON.parse(sets[0].json);
    expect(saved.funnel.recommend).toBe(1); expect(saved.funnel.simulate).toBe(1);
  });

  it("시계열·가입 영속 + 재배포 후 '재방문' 판정(seenAnon 생존·todaySeen 리셋)", async () => {
    const g = fakeGcp();
    const A = "anon-" + "c".repeat(16);
    const s1 = new FirestoreAnalyticsStore(new FsDoc(lite(g), "analytics"), 0); // 디바운스 off → 명시 flush
    await s1.warm();
    s1.funnel("recommend", A); s1.signup("email"); // 신규 1 + 가입(이메일)
    s1.flush(); await tick();                        // 원격 영속
    // 재배포 — 같은 원격 상태로 새 인스턴스(todaySeen은 휘발이라 비어 있음)
    const s2 = new FirestoreAnalyticsStore(new FsDoc(lite(g), "analytics"), 0);
    await s2.warm();
    expect(s2.snapshot().signups.email).toBe(1);     // 가입 방법별 집계 생존
    s2.funnel("recommend", A);                        // A는 seenAnon에 있음(로드됨) + todaySeen엔 없음 → 재방문
    const days = s2.snapshot().days;
    expect(days[days.length - 1].returning).toBe(1);  // 재배포 후에도 '신규' 아닌 '재방문'으로 인식
  });
});

describe("createFirestoreStores — 일괄 생성·ready·auditSink", () => {
  it("ready 후 mode=firestore · auditSink가 lm_audit add", async () => {
    const g = fakeGcp();
    const st = createFirestoreStores({ fs: lite(g) });
    await st.ready;
    expect(st.mode).toBe("firestore");
    st.auditSink!({ at: "2026-01-01T00:00:00Z", type: "테스트", detail: "감사" });
    await tick();
    expect(g.log.adds[0]?.type).toBe("테스트");
  });
});

// FsDoc saveNow 단일 직렬 합류(설계감사 P1#4) — save(drain)와 saveNow가 같은 문서에 동시 PATCH해 옛 스냅샷이
//   새 스냅샷을 덮어쓰던 lost-update(실효 부활)를 제거했는지 고정. PATCH 동시성·실패 전파를 직접 관측.
describe("FsDoc.saveNow — 단일 직렬 합류(P1#4)", () => {
  function makeLite(opts: { failPatch?: boolean } = {}) {
    const state = { sets: [] as string[], inFlight: 0, maxConcurrent: 0 };
    const fetchFn = (async (url: any, init?: any) => {
      const u = String(url);
      if (u.includes("/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (u.includes("/project-id")) return new Response("p", { status: 200 });
      if (init?.method === "PATCH") {
        state.inFlight++; state.maxConcurrent = Math.max(state.maxConcurrent, state.inFlight);
        await Promise.resolve(); // 마이크로태스크 양보 — 두 경로가 겹치면 동시성으로 노출
        state.inFlight--;
        if (opts.failPatch) return new Response("boom", { status: 500 });
        state.sets.push(JSON.parse(init.body).fields.j.stringValue);
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    return { lite: new FirestoreLite({ fetchFn, project: "p" }), state };
  }

  it("save→saveNow: 최신 상태 원격 반영 + 동시 PATCH 0(경합 제거)", async () => {
    const h = makeLite();
    const d = new FsDoc(h.lite, "doc");
    d.save("A");            // drain 시작(PATCH A in-flight)
    await d.saveNow("B");   // 같은 큐로 합류 → A 다음에 순차 전송, 완료 대기
    expect(h.state.sets[h.state.sets.length - 1]).toBe("B"); // 최신(B) 반영
    expect(h.state.maxConcurrent).toBe(1);                   // 동시 PATCH 없음(구버전이면 2)
  });
  it("saveNow: PATCH 영구 실패 → reject(내구 미확인 → durable:false 전파)", async () => {
    const h = makeLite({ failPatch: true });
    const d = new FsDoc(h.lite, "doc");
    await expect(d.saveNow("X")).rejects.toBeTruthy();
  });
});
