/**
 * 런타임 토글(영속) — 운영자가 ops 콘솔에서 재시작 없이 바꾸는 설정.
 *   현재 항목: requireEntitlement(유료 게이트 ON ↔ 무료 베타 OFF).
 *   file 모드면 디스크 영속(재시작 보존), memory(테스트·휘발)면 프로세스 수명 동안만.
 *   부팅 시 createContext가 이 오버라이드를 읽어 config.requireEntitlement에 적용(.env 기본값을 덮어씀)
 *   → bootSafety가 '실효값'을 검증(운영 무료개방은 ALLOW_OPEN_PAID=1 동의 유지).
 */
import { join } from "node:path";
import { JsonFile } from "../src/lansmark/db/jsonFile";

interface Flags { requireEntitlement?: boolean; } // 미설정(undefined)=오버라이드 없음(config/.env 기본 사용)

export class RuntimeFlagsStore {
  private file: JsonFile<Flags> | null;
  private mem: Flags = {};
  constructor(mode: "memory" | "file", dir: string) {
    // file 모드만 디스크 영속 — 다른 영속 스토어와 같은 dataDir에 둔다.
    this.file = mode === "file" ? new JsonFile<Flags>(join(dir, "runtimeFlags.json"), {}) : null;
  }
  private get d(): Flags { return this.file ? this.file.data : this.mem; }

  /** 유료 게이트 오버라이드 값(없으면 null = config/.env 기본 사용). */
  requireEntitlement(): boolean | null {
    const v = this.d.requireEntitlement;
    return typeof v === "boolean" ? v : null;
  }
  /** 유료 게이트 오버라이드 저장(영속) — ops 토글이 호출. */
  setRequireEntitlement(v: boolean): void {
    this.d.requireEntitlement = v;
    this.file?.flush();
  }
}
