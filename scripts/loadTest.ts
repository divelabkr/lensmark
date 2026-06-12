/**
 * 부하 테스트 하니스 — 무의존(fetch·k6/autocannon 설치 불필요). 베타 규모 검증용(한계점·지연 분포 측정, '수백만' 아님).
 *   ⚠ 반드시 mock 모드 로컬 서버에(라이브 금지 — 외부 API 쿼터 소진·analytics 오염):
 *     LANSMARK_DATA_MODE=mock LANSMARK_RATE_GLOBAL=100000 LANSMARK_RATE_SENSITIVE=100000 PORT=8899 npx tsx server/devServer.ts
 *   사용: LOAD_BASE=http://127.0.0.1:8899 npx tsx scripts/loadTest.ts [동시수=20] [지속초=10]
 *   출력: 시나리오별 RPS · 지연 p50/p95/p99/max · 상태코드 분포. exit 1 = 5xx 발생(회귀 신호).
 */
const BASE = (process.env.LOAD_BASE || "http://127.0.0.1:8899").replace(/\/$/, "");
const CONC = Math.max(1, Number(process.argv[2] || 20));   // 동시 가상 사용자
const DUR_S = Math.max(2, Number(process.argv[3] || 10));  // 시나리오당 지속(초)

interface Scenario { name: string; req: () => Promise<Response>; }
const J = { "Content-Type": "application/json" };
const SIM_BODY = JSON.stringify({ land: { areaM2: 3300, soilEvidence: { source: "none" } }, cropId: "apple", salesChannel: "mixed", region: "경상북도" });
const REC_BODY = JSON.stringify({ land: { lat: 36.4, lng: 128.9, areaM2: 3300 }, limit: 6 });

const SCENARIOS: Scenario[] = [
  { name: "GET  /api/health      (가벼움·기준선)", req: () => fetch(`${BASE}/api/health`) },
  { name: "POST /api/recommend   (무료 추천)", req: () => fetch(`${BASE}/api/recommend`, { method: "POST", headers: J, body: REC_BODY }) },
  { name: "POST /api/simulate    (정밀 엔진·최중량)", req: () => fetch(`${BASE}/api/simulate`, { method: "POST", headers: J, body: SIM_BODY }) },
  { name: "GET  /app             (HTML+gzip 전송)", req: () => fetch(`${BASE}/app`, { headers: { "accept-encoding": "gzip" } }) },
];

const pct = (xs: number[], p: number): number => xs.length ? xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : 0;

async function runScenario(s: Scenario): Promise<boolean> {
  const lat: number[] = []; const codes = new Map<number, number>(); let inflightErr = 0;
  const end = Date.now() + DUR_S * 1000;
  // CONC개의 닫힌 루프(closed-loop) 워커 — 각자 응답 받으면 즉시 다음 요청(현실 사용자 근사)
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (Date.now() < end) {
      const t0 = performance.now();
      try {
        const r = await s.req();
        await r.arrayBuffer(); // 바디 소진(소켓 재사용·전송시간 포함 측정)
        codes.set(r.status, (codes.get(r.status) || 0) + 1);
      } catch { inflightErr++; }
      lat.push(performance.now() - t0);
    }
  }));
  lat.sort((a, b) => a - b);
  const total = lat.length, rps = Math.round(total / DUR_S);
  const codeStr = [...codes.entries()].sort((a, b) => a[0] - b[0]).map(([c, n]) => `${c}×${n}`).join(" ");
  const fiveXX = [...codes.entries()].filter(([c]) => c >= 500).reduce((a, [, n]) => a + n, 0);
  console.log(`\n${s.name}`);
  console.log(`  RPS ${rps}  · 요청 ${total} · 코드 ${codeStr}${inflightErr ? ` · 네트워크오류 ${inflightErr}` : ""}`);
  console.log(`  지연(ms) p50 ${pct(lat, 50).toFixed(0)} · p95 ${pct(lat, 95).toFixed(0)} · p99 ${pct(lat, 99).toFixed(0)} · max ${pct(lat, 100).toFixed(0)}`);
  if (fiveXX) console.log(`  ✗ 5xx ${fiveXX}건 — 부하에서 서버 오류(회귀)`);
  return fiveXX === 0 && inflightErr === 0;
}

(async () => {
  // 안전핀: 라이브 도메인/Run URL을 향하면 거부(쿼터·과금·계측 오염 방지)
  if (/run\.app|lensmark\.kr/.test(BASE)) { console.error("⛔ 라이브 대상 부하 금지 — mock 로컬 서버에만(헤더 주석 참조)"); process.exit(2); }
  let h: any;
  try { h = await (await fetch(`${BASE}/api/health`)).json(); } catch { console.error(`⛔ 서버 접근 불가: ${BASE} — mock 서버를 먼저 띄우세요(헤더 주석)`); process.exit(2); }
  if (h.mode !== "mock") console.warn(`⚠ 서버 mode=${h.mode}(mock 아님) — 외부 API 호출이 섞여 수치 왜곡·쿼터 소진 가능`);
  console.log(`부하 테스트 — ${BASE} · 동시 ${CONC} · 시나리오당 ${DUR_S}s · server v${h.version}(${h.mode})`);
  let ok = true;
  for (const s of SCENARIOS) ok = (await runScenario(s)) && ok;
  console.log(ok ? "\n✓ 전 시나리오 5xx 0 — 한계 내" : "\n✗ 오류 발생 — 위 시나리오 확인");
  process.exit(ok ? 0 : 1);
})();
