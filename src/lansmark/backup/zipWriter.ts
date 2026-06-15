/**
 * 의존성 0 ZIP 작성기 — 감사용 내보내기(여러 카테고리 JSON을 한 압축파일로).
 *   표준 ZIP(local file header + central directory + EOCD). 압축=raw DEFLATE(zlib 내장),
 *   더 크면 STORE(무압축)로 폴백. CRC-32는 표준 다항식(0xEDB88320)으로 자체 계산(런타임 의존성 원칙).
 *   ⚠ ZIP64 미지원 — 단일 항목·전체 4GB 미만 가정(감사 자료 규모엔 충분).
 */
import { deflateRawSync } from "node:zlib";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry { name: string; data: Buffer; }

/** 항목들을 표준 ZIP 한 개(Buffer)로. 이름은 UTF-8(플래그 bit11). */
export function makeZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const comp = deflateRawSync(e.data);
    const useDeflate = comp.length < e.data.length;
    const body = useDeflate ? comp : e.data;
    const method = useDeflate ? 8 : 0; // 8=deflate · 0=store
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // local file header sig
    lfh.writeUInt16LE(20, 4);         // version needed
    lfh.writeUInt16LE(0x0800, 6);     // flags: UTF-8 이름(bit11)
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10); lfh.writeUInt16LE(0x21, 12); // mod time/date(고정 — 결정적)
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(body.length, 18);     // compressed size
    lfh.writeUInt32LE(e.data.length, 22);   // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);               // extra len
    parts.push(lfh, nameBuf, body);
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // central dir header sig
    cdh.writeUInt16LE(20, 4); cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8); cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(0, 12); cdh.writeUInt16LE(0x21, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(body.length, 20); cdh.writeUInt32LE(e.data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); cdh.writeUInt16LE(0, 32); // extra/comment len
    cdh.writeUInt16LE(0, 34); cdh.writeUInt16LE(0, 36); // disk start / internal attrs
    cdh.writeUInt32LE(0, 38);            // external attrs
    cdh.writeUInt32LE(offset, 42);       // local header offset
    central.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD sig
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment len
  return Buffer.concat([...parts, centralBuf, eocd]);
}
