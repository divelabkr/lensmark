/**
 * at-rest 보안 보강 회귀(G1·G2) — ① firestore 문서 암호화(file과 동일 키·포맷) ② 세션 토큰 at-rest 해시.
 *   원칙 고정: 평문 PII가 저장 페이로드에 남지 않는다 · 복호 불가=sealed(원본 덮어쓰기 금지) · legacy 평문은 로드 후 암호화로 이행.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sealAtRest, openAtRest, ENC_PREFIX } from "../db/atRest";
import { FsDoc } from "../db/firestoreStores";
import { FileSessionStore } from "../db/stores";

const KEY = "a".repeat(64); // 테스트 전용 32B hex(실키 아님)
let prevKey: string | undefined;
beforeEach(() => { prevKey = process.env.LANSMARK_DATA_KEY; });
afterEach(() => { if (prevKey == null) delete process.env.LANSMARK_DATA_KEY; else process.env.LANSMARK_DATA_KEY = prevKey; });

/** FsDoc용 FirestoreLite 스텁 — 원격 문서 1개를 메모리로 흉내(저장 페이로드 검사용). */
function stubFs(initial: string | null = null) {
  const box = { stored: initial as string | null, sets: 0 };
  const fs = {
    async getJson(_c: string, _id: string) { return box.stored; },
    async setJson(_c: string, _id: string, j: string) { box.stored = j; box.sets++; },
  } as any;
  return { fs, box };
}

describe("G1 — FsDoc at-rest 암호화(firestore도 file과 동일 보호)", () => {
  it("키 설정 시 저장 페이로드가 ENC1: 암호문(평문 PII 미노출) · load가 복호", async () => {
    process.env.LANSMARK_DATA_KEY = KEY;
    const { fs, box } = stubFs();
    const doc = new FsDoc(fs, "subs");
    await doc.saveNow(JSON.stringify([{ phone: "01012345678" }])); // PII 마커
    expect(box.stored!.startsWith(ENC_PREFIX)).toBe(true);
    expect(box.stored!).not.toContain("01012345678");              // 평문 전화번호 0
    const doc2 = new FsDoc(fs, "subs");
    expect(JSON.parse((await doc2.load())!)[0].phone).toBe("01012345678"); // 왕복 복호
  });

  it("legacy 평문 문서는 그대로 로드(이행 호환) · 다음 저장부터 암호화", async () => {
    process.env.LANSMARK_DATA_KEY = KEY;
    const { fs, box } = stubFs(JSON.stringify({ legacy: true })); // 기존 평문
    const doc = new FsDoc(fs, "x");
    expect(JSON.parse((await doc.load())!)).toEqual({ legacy: true });
    await doc.saveNow(JSON.stringify({ legacy: false }));
    expect(box.stored!.startsWith(ENC_PREFIX)).toBe(true);        // 업그레이드-온-라이트
  });

  it("암호화 문서 + 키 없음/불일치 → sealed(저장 차단 — 원본 보호)", async () => {
    process.env.LANSMARK_DATA_KEY = KEY;
    const enc = sealAtRest(JSON.stringify({ secret: 1 }));
    delete process.env.LANSMARK_DATA_KEY;                          // 키 누락 시나리오
    const { fs, box } = stubFs(enc);
    const doc = new FsDoc(fs, "y");
    await expect(doc.load()).rejects.toThrow(/복호|at-rest/);
    expect(doc.sealed).toBe(true);
    doc.save("{}"); await doc.whenDrained();
    expect(box.stored).toBe(enc);                                  // 덮어쓰기 0
  });

  it("openAtRest: 잘못된 키는 bad-key(예외 아님 — 호출측 sealed 판단)", () => {
    process.env.LANSMARK_DATA_KEY = KEY;
    const enc = sealAtRest("hello");
    process.env.LANSMARK_DATA_KEY = "b".repeat(64);
    const r = openAtRest(enc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-key");
  });
});

describe("G2 — 세션 토큰 at-rest 해시(스토어 유출 시 세션 탈취 불가)", () => {
  it("영속 파일에 원토큰이 없고(해시만) get/delete는 원토큰으로 동작", () => {
    delete process.env.LANSMARK_DATA_KEY; // 평문 파일로 내용 검사(암호화와 독립된 G2 검증)
    const dir = mkdtempSync(join(tmpdir(), "lm-sess-"));
    try {
      const store = new FileSessionStore(join(dir, "sessions.json"));
      const RAW = "tok-very-secret-192bit-random";
      store.create({ token: RAW, accountId: "A1", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() } as any);
      const onDisk = readFileSync(join(dir, "sessions.json"), "utf8");
      expect(onDisk).not.toContain(RAW);                 // 원토큰 at-rest 0
      expect(store.get(RAW)?.accountId).toBe("A1");      // 원토큰 조회는 정상(내부 해시)
      expect(store.get("wrong-token")).toBeUndefined();
      store.delete(RAW);
      expect(store.get(RAW)).toBeUndefined();            // 로그아웃 동작 보존
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
