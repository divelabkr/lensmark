/**
 * LANSMARK dev 서버 — 오케스트레이터(의존성 0 · Node http).
 *   책임은 "조립"뿐: 설정 로드 → 부팅점검 → 컨텍스트 생성 → (미들웨어 → 라우터) 파이프라인 → listen.
 *   세부 로직은 책임별 모듈에 있다:
 *     config.ts(설정·부팅점검) · context.ts(공유상태) · middleware.ts(보안·레이트리밋) ·
 *     respond.ts(응답헬퍼) · router.ts(+routes/*: 기능별 라우트).
 *   실행:  npm run dev   (tsx)
 */
import http from "node:http";
import { loadConfig, bootSafety } from "./config";
import { createContext, applyRuntimeFlagOverride } from "./context";
import { applySecurity } from "./middleware";
import { route } from "./router";
import { json } from "./respond";
import { APP_VERSION } from "../src/lansmark/version";

const config = loadConfig();
const ctx = createContext(config); // file/memory는 여기서 런타임 오버라이드 적용 완료. firestore는 워밍 후(아래 IIFE)
// file/memory: 오버라이드 반영 後 '실효 설정'으로 운영 fail-closed 검증. firestore는 워밍 後로 미룬다(H1 — 플래그가 비동기 로드).
if (config.storeMode !== "firestore") bootSafety(config);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);
    // 미들웨어: 보안 헤더·CORS·프리플라이트·레이트리밋. true 반환 시 응답 종료(라우팅 중단).
    if (applySecurity(req, res, ctx, url.pathname)) return;
    await route(ctx, req, res, url);
  } catch (e: any) {
    // 내부 에러 메시지는 클라이언트에 노출하지 않는다(정보 유출/반사형 XSS 방지). 서버 로그에만.
    ctx.metrics.errCount++;
    console.error("[lansmark] unhandled", e?.message ?? e);
    json(res, 500, { error: "server error" });
  }
});

// 소켓/요청 타임아웃 하드닝 — 느린 클라이언트가 연결을 오래 점유하는 slow-loris류 완화(Node 기본보다 짧게).
server.requestTimeout = 20_000;   // 요청 전체(헤더+바디) 수신 마감
server.headersTimeout = 10_000;   // 헤더 수신 마감(헤더 드립 차단)
server.keepAliveTimeout = 5_000;  // keep-alive 유휴 연결 회수

// 부팅: firestore 모드는 원격 상태 워밍을 listen 前 대기(§3-1 — 빈 상태로 서비스 시작 방지).
//   워밍 완료 후 플래그 오버라이드 적용 + bootSafety(H1: 토글이 워밍에서 로드되므로 이 순서여야 '실효값' 검증).
//   워밍 실패: 유료 게이트 ON이면 부팅 중단(fail-closed), 무료 베타면 경고 후 지속(sealed가 덮어쓰기 방지 · ops가 게이트 ON 거부=H2).
void (async () => {
  if (config.storeMode === "firestore") {
    let warmed = true;
    if (ctx.storesReady) {
      try { await ctx.storesReady; console.log("[lansmark] firestore 영속 워밍 완료"); }
      catch (e: any) { warmed = false; console.error("[lansmark][SECURITY] firestore 워밍 실패 — 쓰기 봉인(sealed)·메모리로 지속:", e?.message ?? e); }
    }
    applyRuntimeFlagOverride(config, ctx.runtimeFlags); // 워밍된 토글을 config에 반영(H1)
    if (!warmed && config.requireEntitlement) { console.error("[lansmark][SECURITY] firestore 워밍 실패 + 유료 게이트 ON → 부팅 중단(fail-closed)"); process.exit(1); }
    bootSafety(config); // 실효값으로 운영 fail-closed 검증(시크릿·무료개방 등)
  }
  server.listen(config.port, () =>
    console.log(`LENSMARK v${APP_VERSION} dev: http://localhost:${config.port}  (mode=${config.dataMode}, store=${config.storeMode}, vworldKey=${!!config.vworldKey})`),
  );
})();

// graceful 종료 — 재배포(SIGTERM)·Ctrl+C(SIGINT) 시 throttle된 analytics 버퍼를 즉시 저장(레드팀 L-3, 버퍼 손실 방지).
//   다른 File* 스토어는 매 쓰기 flush라 무관 · analytics만 25건 throttle이라 종료 시 강제 저장이 필요.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    void (async () => {
      try { ctx.analytics.flush?.(); } catch { /* 저장 실패는 무시(종료 우선) */ }
      // firestore: 진행 중 쓰기(실효·멱등·실측 등)를 끝까지 대기 — fire-and-forget 유실 방지(H3). 최대 1.8s.
      try { if (ctx.flushStores) await Promise.race([ctx.flushStores(), new Promise((r) => setTimeout(r, 1800))]); } catch { /* */ }
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000).unref(); // close 지연 시에도 강제 종료
    })();
  });
}
