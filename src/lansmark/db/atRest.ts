/**
 * at-rest 암호화 공용 헬퍼(AES-256-GCM) — file(jsonFile)·firestore(FsDoc)가 같은 키·포맷을 쓴다.
 *   포맷: "ENC1:" + base64(iv(12)|tag(16)|ct) · 키: LANSMARK_DATA_KEY(hex 64자=32B, 운영자 주입=HUMAN GATE).
 *   미설정이면 평문(기존 동작 무영향) — 키 설정 시 다음 쓰기부터 암호화로 이행(legacy 평문 로드는 그대로 허용).
 *   ⚠ 복호 불가(키 없음/불일치)는 호출측이 sealed 처리 — 잘못된 키로 원본을 덮어쓰지 않는다(데이터 보호 우선).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const ENC_PREFIX = "ENC1:";

/** 운영자 주입 키(hex 64자=32B)만 인정 — 형식 불일치는 미설정 취급(반쪽 암호화 방지). */
export function dataKey(): Buffer | null {
  const hex = process.env.LANSMARK_DATA_KEY;
  return hex && /^[0-9a-fA-F]{64}$/.test(hex) ? Buffer.from(hex, "hex") : null;
}

export function encryptAtRest(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ENC_PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64"); // iv(12)|tag(16)|ct
}

export function decryptAtRest(blob: string, key: Buffer): string {
  const buf = Buffer.from(blob.slice(ENC_PREFIX.length), "base64");
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

/** 저장 직전 — 키 있으면 암호화, 없으면 평문(기존 동작). */
export function sealAtRest(plain: string): string {
  const key = dataKey();
  return key ? encryptAtRest(plain, key) : plain;
}

/** 로드 직후 — 결과를 명시 구분: ok=평문 반환 / no-key·bad-key=호출측 sealed 처리(원본 보호). */
export function openAtRest(stored: string): { ok: true; plain: string } | { ok: false; reason: "no-key" | "bad-key" } {
  if (!stored.startsWith(ENC_PREFIX)) return { ok: true, plain: stored }; // legacy 평문 — 다음 쓰기에서 암호화로 이행
  const key = dataKey();
  if (!key) return { ok: false, reason: "no-key" };
  try { return { ok: true, plain: decryptAtRest(stored, key) }; }
  catch { return { ok: false, reason: "bad-key" }; }
}
