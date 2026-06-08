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
import { createContext } from "./context";
import { applySecurity } from "./middleware";
import { route } from "./router";
import { json } from "./respond";
import { APP_VERSION } from "../src/lansmark/version";

const config = loadConfig();
const ctx = createContext(config); // 영속 런타임 오버라이드(유료 게이트 등)를 config에 적용
bootSafety(config);                // 오버라이드 반영 後 '실효 설정'으로 운영 fail-closed 검증(위조 시크릿·무료개방 등)

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

server.listen(config.port, () =>
  console.log(`LENSMARK v${APP_VERSION} dev: http://localhost:${config.port}  (mode=${config.dataMode}, vworldKey=${!!config.vworldKey})`),
);

// graceful 종료 — 재배포(SIGTERM)·Ctrl+C(SIGINT) 시 throttle된 analytics 버퍼를 즉시 저장(레드팀 L-3, 버퍼 손실 방지).
//   다른 File* 스토어는 매 쓰기 flush라 무관 · analytics만 25건 throttle이라 종료 시 강제 저장이 필요.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    try { ctx.analytics.flush?.(); } catch { /* 저장 실패는 무시(종료 우선) */ }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref(); // close 지연 시에도 강제 종료(flush는 이미 완료)
  });
}
