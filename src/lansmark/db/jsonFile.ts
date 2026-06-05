/**
 * 의존성 0 영속 JSON 파일 — 단일 인스턴스 재시작 내구성.
 *   - 생성 시 파일 로드(손상/부재 시 initial).
 *   - flush(): 임시파일 쓰기 → rename 으로 **원자적** 교체(부분쓰기 손상 방지).
 *   ⚠ 단일 프로세스(Node는 JS 단일스레드)·중간 볼륨 가정. 고throughput·다중 인스턴스는 DB 어댑터 권장.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, chmodSync } from "node:fs";
import { dirname } from "node:path";

export class JsonFile<T> {
  data: T;
  constructor(private readonly path: string, initial: T) {
    this.data = initial;
    try {
      if (existsSync(path)) this.data = JSON.parse(readFileSync(path, "utf8")) as T;
    } catch { /* 손상 파일 → initial 유지(가용성 우선) */ }
  }
  /** 현재 data를 디스크에 동기·원자적으로 저장. 디스크 오류는 무시(메모리 데이터는 유지). */
  flush(): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); // 소유자 전용 — PII(휴대폰)·시크릿 데이터 타 로컬 사용자 읽기 차단(레드팀 NOTIFY-2)
      renameSync(tmp, this.path);
      try { chmodSync(this.path, 0o600); } catch { /* 권한 변경 불가 환경 무시 — 기존 느슨한 권한 교정용 */ }
    } catch { /* 쓰기 실패 → 다음 변경 때 재시도 */ }
  }
}
