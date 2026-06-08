/**
 * JsonFile at-rest 암호화 검증 — LANSMARK_DATA_KEY 설정 시 AES-256-GCM, 미설정 시 평문(기존 동작 무영향).
 *   법무 갭 ③(휴대폰·일지 좌표/매출 평문) 대응 seam. 키는 운영자 주입(HUMAN GATE).
 */
import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { JsonFile } from "../db/jsonFile";

const path = join(tmpdir(), "lensmark-jsonfile-enc-test.json");
const KEY = "a".repeat(64); // hex 32바이트(테스트 전용)
afterEach(() => { if (existsSync(path)) rmSync(path); delete process.env.LANSMARK_DATA_KEY; });

describe("JsonFile at-rest 암호화", () => {
  it("키 없으면 평문(기존 동작)", () => {
    delete process.env.LANSMARK_DATA_KEY;
    const a = new JsonFile<{ v: number }>(path, { v: 0 });
    a.data = { v: 1 }; a.flush();
    expect(readFileSync(path, "utf8").startsWith("ENC1:")).toBe(false);
  });

  it("키 있으면 ENC1 암호화 + PII 평문 미노출 + 복호 라운드트립", () => {
    process.env.LANSMARK_DATA_KEY = KEY;
    const a = new JsonFile<{ phone: string }>(path, { phone: "" });
    a.data = { phone: "01012345678" }; a.flush();
    const raw = readFileSync(path, "utf8");
    expect(raw.startsWith("ENC1:")).toBe(true);       // 암호문
    expect(raw.includes("01012345678")).toBe(false);  // 평문 PII 미노출
    const b = new JsonFile<{ phone: string }>(path, { phone: "" }); // 재로드=복호
    expect(b.data.phone).toBe("01012345678");
  });

  it("암호화 파일을 키 없이 열면 복호 불가 → 초기값 유지(가용성·크래시 안 함)", () => {
    process.env.LANSMARK_DATA_KEY = KEY;
    const a = new JsonFile<{ v: number }>(path, { v: 0 }); a.data = { v: 9 }; a.flush();
    delete process.env.LANSMARK_DATA_KEY;
    const b = new JsonFile<{ v: number }>(path, { v: -1 });
    expect(b.data.v).toBe(-1);
    b.data = { v: 5 }; b.flush(); // sealed: 평문 덮어쓰기 금지 → 원본 암호문 보존(데이터 손실 방지)
    expect(readFileSync(path, "utf8").startsWith("ENC1:")).toBe(true);
  });
});
