/**
 * 의존성 0 영속 JSON 파일 — 단일 인스턴스 재시작 내구성.
 *   - 생성 시 파일 로드(손상/부재 시 initial).
 *   - flush(): 임시파일 쓰기 → rename 으로 **원자적** 교체(부분쓰기 손상 방지).
 *   ⚠ 단일 프로세스(Node는 JS 단일스레드)·중간 볼륨 가정. 고throughput·다중 인스턴스는 DB 어댑터 권장.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
// at-rest 암호화는 공용 모듈(atRest.ts) — file·firestore가 같은 키(LANSMARK_DATA_KEY)·포맷(ENC1:)을 쓴다(보안갭 G1 보강).
import { ENC_PREFIX, dataKey, encryptAtRest as encrypt, decryptAtRest as decrypt } from "./atRest";

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
          // 평문(키 설정 시 다음 flush에서 암호화로 이행). 손상 시 sealed — 빈 상태로 덮어써 보안 상태(실효 등) 유실 방지(감사 M3).
          try { this.data = JSON.parse(raw) as T; }
          catch { this.sealed = true; console.warn(`[jsonFile] ${this.path} 평문 파싱 실패(손상) — 덮어쓰기 차단(데이터 보호). 파일 확인/격리 필요.`); }
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
