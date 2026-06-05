/**
 * HTTP 응답 헬퍼 — JSON·HTML 전송, 요청 바디 읽기, 입력오류 응답.
 *   책임: "어떻게 보낼지"(직렬화·헤더·nonce·바디상한)만 담당. "무엇을 보낼지"는 라우트의 몫.
 *   공통 보안/CORS 헤더는 미들웨어가 이미 setHeader로 깔아두므로 여기선 Content-Type·캐시·CSP만 다룬다.
 */
import type * as http from "node:http";
import { genNonce, injectNonce, htmlCsp } from "../src/lansmark/api/security";
import { MAX_BODY_BYTES } from "../src/lansmark/api/httpUtil";
import { ValidationError } from "../src/lansmark/core/validate";

/** JSON 응답(no-store: API 응답은 캐시하지 않는다). */
export function json(res: http.ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/** HTML 응답: 요청별 nonce 생성 → 인라인 `<script>`에 주입 + HTML용 CSP(미들웨어의 API_CSP를 덮어씀). */
export function sendHtml(res: http.ServerResponse, html: string): void {
  const nonce = genNonce();
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": htmlCsp(nonce),
    "Cache-Control": "no-cache",
  });
  res.end(injectNonce(html, nonce));
}

/** 입력 검증 실패 → 400. ValidationError 메시지는 안전(입력 미반영)하므로 노출, 그 외는 일반화. */
export function badInput(res: http.ServerResponse, e: unknown): void {
  json(res, 400, { error: e instanceof ValidationError ? e.message : "유효하지 않은 입력입니다." });
}

/** 요청 바디를 문자열로 읽되, 상한 초과 시 연결을 끊는다(메모리 고갈 DoS 방지). */
export function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let b = "", len = 0;
    req.on("data", (c) => {
      len += (c as Buffer).length;
      if (len > MAX_BODY_BYTES) { reject(new Error("payload too large")); req.destroy(); }
      else b += c;
    });
    req.on("end", () => resolve(b));
    req.on("error", reject);
  });
}
