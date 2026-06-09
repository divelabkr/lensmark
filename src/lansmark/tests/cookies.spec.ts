/**
 * 쿠키 헬퍼(S5) — 파싱·세션 추출(듀얼모드)·발급/파기 속성 검증.
 *   보안 속성: HttpOnly·SameSite=Strict·Secure(운영만). 듀얼모드: 쿠키 우선, 없으면 x-lansmark-session 헤더.
 */
import { describe, it, expect } from "vitest";
import type * as http from "node:http";
import { parseCookies, sessionTokenFrom, sessionCookie, clearSessionCookie, SESSION_COOKIE } from "../../../server/cookies";

const req = (headers: Record<string, string>) => ({ headers } as unknown as http.IncomingMessage);

describe("cookies — 파싱·듀얼모드 세션 추출", () => {
  it("parseCookies: 다중 쿠키·공백·URL 디코드", () => {
    const c = parseCookies(req({ cookie: "a=1; lm_session=abc%20def;  b=2" }));
    expect(c.a).toBe("1");
    expect(c.lm_session).toBe("abc def");
    expect(c.b).toBe("2");
  });
  it("parseCookies: 쿠키 헤더 없으면 빈 객체", () => {
    expect(parseCookies(req({}))).toEqual({});
  });

  it("sessionTokenFrom: 쿠키 우선", () => {
    expect(sessionTokenFrom(req({ cookie: `${SESSION_COOKIE}=COOKIETOK`, "x-lansmark-session": "HDRTOK" }))).toBe("COOKIETOK");
  });
  it("sessionTokenFrom: 쿠키 없으면 헤더 폴백(테스트·비브라우저 API 하위호환)", () => {
    expect(sessionTokenFrom(req({ "x-lansmark-session": "HDRTOK" }))).toBe("HDRTOK");
  });
  it("sessionTokenFrom: 둘 다 없으면 빈 문자열", () => {
    expect(sessionTokenFrom(req({}))).toBe("");
  });
});

describe("cookies — 발급/파기 보안 속성", () => {
  it("sessionCookie: HttpOnly·SameSite=Strict·Path·Max-Age 포함, Secure는 secure=true만", () => {
    const dev = sessionCookie("TOK", 3600, false);
    expect(dev).toContain(`${SESSION_COOKIE}=TOK`);
    expect(dev).toContain("HttpOnly");
    expect(dev).toContain("SameSite=Strict");
    expect(dev).toContain("Path=/");
    expect(dev).toContain("Max-Age=3600");
    expect(dev).not.toContain("Secure"); // dev(http)에서 Secure 붙이면 쿠키 미저장 → 빼야 함
    expect(sessionCookie("TOK", 3600, true)).toContain("Secure"); // 운영(HTTPS)만
  });
  it("clearSessionCookie: Max-Age=0(즉시 파기)", () => {
    expect(clearSessionCookie(false)).toContain("Max-Age=0");
    expect(clearSessionCookie(true)).toContain("Secure");
  });
});
