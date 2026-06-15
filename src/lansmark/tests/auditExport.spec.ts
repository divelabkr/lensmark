/**
 * 감사용 내보내기 — 카테고리(세션 제외·PII 라벨) + ENC1 복호 + zip(의존성0) 검증.
 */
import { describe, it, expect, afterEach } from "vitest";
import { MemoryBlobBackend } from "../backup/blobBackend";
import { listExportCategories, buildAuditExport } from "../backup/auditExport";
import { makeZip } from "../backup/zipWriter";
import { encryptAtRest } from "../db/atRest";
import { inflateRawSync } from "node:zlib";

const KEY_HEX = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
afterEach(() => { delete process.env.LANSMARK_DATA_KEY; });

describe("auditExport — 카테고리·복호·zip", () => {
  it("listExportCategories: 세션 제외 + PII 라벨", () => {
    const be = new MemoryBlobBackend(new Map([["feedback", "[]"], ["journal", "[]"], ["subscriptions", "[]"], ["sessions", "[]"]]));
    const cats = listExportCategories(be);
    const keys = cats.map((c) => c.key);
    expect(keys).toContain("feedback");
    expect(keys).not.toContain("sessions"); // 인증 토큰 — 내보내기 금지
    expect(cats.find((c) => c.key === "journal")!.pii).toBe(true);
    expect(cats.find((c) => c.key === "subscriptions")!.pii).toBe(true);
    expect(cats.find((c) => c.key === "feedback")!.pii).toBe(false);
  });

  it("ENC1 복호 + 건수 + zip(PK) + manifest/README 포함", async () => {
    process.env.LANSMARK_DATA_KEY = KEY_HEX;
    const enc = encryptAtRest(JSON.stringify([1, 2, 3]), Buffer.from(KEY_HEX, "hex"));
    const be = new MemoryBlobBackend(new Map([["feedback", enc]]));
    const { zip, manifest, selected } = await buildAuditExport(be, ["feedback"], { appVersion: "t", at: "2026-06-15T00:00:00Z" });
    expect(selected).toEqual(["feedback"]);
    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304"); // PK\x03\x04
    const cat = (manifest as any).categories[0];
    expect(cat.records).toBe(3); // 복호+파싱 성공
    expect(cat.note).toBe("");
    const s = zip.toString("latin1");
    for (const f of ["manifest.json", "feedback.json", "README.txt"]) expect(s).toContain(f);
  });

  it("세션·미지 키는 요청해도 제외(화이트리스트)", async () => {
    const be = new MemoryBlobBackend(new Map([["feedback", "[]"], ["sessions", "[]"]]));
    const { selected } = await buildAuditExport(be, ["sessions", "feedback", "nope"], { appVersion: "t", at: "x" });
    expect(selected).toEqual(["feedback"]); // 세션·미지키 차단
  });

  it("평문(키 없음) 통과 + 객체 키 건수", async () => {
    const be = new MemoryBlobBackend(new Map([["analytics", JSON.stringify({ a: 1, b: 2 })]]));
    const { manifest } = await buildAuditExport(be, ["analytics"], { appVersion: "t", at: "x" });
    expect((manifest as any).categories[0].records).toBe(2);
  });
});

describe("zipWriter — 유효 ZIP(라운드트립)", () => {
  it("deflate 항목을 inflateRawSync로 복원(무결성)", () => {
    const payload = Buffer.from("LANSMARK ".repeat(50) + "감사 자료", "utf8"); // 반복=압축됨
    const zip = makeZip([{ name: "a.json", data: payload }]);
    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
    // 로컬 헤더 파싱: 압축법(8=deflate), 이름길이, 압축크기 → body 추출 후 inflate
    const method = zip.readUInt16LE(8);
    const csize = zip.readUInt32LE(18);
    const nlen = zip.readUInt16LE(26);
    const elen = zip.readUInt16LE(28);
    const start = 30 + nlen + elen;
    const body = zip.subarray(start, start + csize);
    const out = method === 8 ? inflateRawSync(body) : body;
    expect(out.toString("utf8")).toBe(payload.toString("utf8")); // 라운드트립 일치
    expect(method).toBe(8); // 반복 페이로드라 deflate 채택
  });
});
