/**
 * 의존성 0 영속 JSON 파일 — 단일 인스턴스 재시작 내구성.
 *   - 생성 시 파일 로드(손상/부재 시 initial).
 *   - flush(): 임시파일 쓰기 → rename 으로 **원자적** 교체(부분쓰기 손상 방지).
 *   ⚠ 단일 프로세스(Node는 JS 단일스레드)·중간 볼륨 가정. 고throughput·다중 인스턴스는 DB 어댑터 권장.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/* ── 선택적 at-rest 암호화(AES-256-GCM) — LANSMARK_DATA_KEY(hex 64자=32B) 설정 시 활성, 미설정이면 평문(0600).
   운영 PII(휴대폰·재배일지 좌표/매출)는 키 주입(HUMAN GATE)으로 암호화(법무 갭 ③). 키는 코드/AI가 만들지 않는다. */
const ENC_PREFIX = "ENC1:";
function dataKey(): Buffer | null {
  const hex = process.env.LANSMARK_DATA_KEY;
  return hex && /^[0-9a-fA-F]{64}$/.test(hex) ? Buffer.from(hex, "hex") : null;
}
function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ENC_PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64"); // iv(12)|tag(16)|ct
}
function decrypt(blob: string, key: Buffer): string {
  const buf = Buffer.from(blob.slice(ENC_PREFIX.length), "base64");
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

export class JsonFile<T> {
  data: T;
  private sealed = false; // 암호화 파일을 못 읽음(키 없음/불일치) → flush 금지(평문 덮어쓰기 데이터손실 방지)
  constructor(private readonly path: string, initial: T) {
    this.data = initial;
    try {
      if (existsSync(path)) {
        const raw = readFileSync(path, "utf8");
        if (raw.startsWith(ENC_PREFIX)) {                 // 암호화 파일 → 키로 복호
          const key = dataKey();
          if (!key) { this.sealed = true; console.warn(`[jsonFile] ${this.path} 암호화됨 — LANSMARK_DATA_KEY 필요(복호 불가, 덮어쓰기 차단)`); }
          else {
            try { this.data = JSON.parse(decrypt(raw, key)) as T; }
            catch { this.sealed = true; console.warn(`[jsonFile] ${this.path} 복호 실패(키 불일치/손상) — 덮어쓰기 차단`); } // 잘못된 키로 원본을 날리지 않음
          }
        } else {
          this.data = JSON.parse(raw) as T;               // 평문(키 설정 시 다음 flush에서 암호화로 이행)
        }
      }
    } catch { /* 파일 읽기 오류 → initial 유지(가용성 우선) */ }
  }
  /** 현재 data를 디스크에 동기·원자적으로 저장. 디스크 오류는 무시(메모리 데이터는 유지). */
  flush(): void {
    if (this.sealed) return; // 못 읽은 암호화 파일을 평문으로 덮어쓰지 않음(키 누락 오설정 시 데이터 손실 방지)
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      const key = dataKey();
      const blob = JSON.stringify(this.data);
      writeFileSync(tmp, key ? encrypt(blob, key) : blob, { mode: 0o600 }); // 키 있으면 at-rest 암호화 · 0600(타 로컬사용자 차단·레드팀 NOTIFY-2)
      renameSync(tmp, this.path);
      try { chmodSync(this.path, 0o600); } catch { /* 권한 변경 불가 환경 무시 — 기존 느슨한 권한 교정용 */ }
    } catch { /* 쓰기 실패 → 다음 변경 때 재시도 */ }
  }
}
