/**
 * 런타임 토글(영속) — 운영자가 ops 콘솔에서 재시작 없이 바꾸는 설정.
 *   현재 항목: requireEntitlement(유료 게이트 ON ↔ 무료 베타 OFF).
 *   영속: file=디스크(JsonFile) · firestore=lm_state/flags 문서 · memory(테스트)=휘발.
 *   부팅: createContext가 이 오버라이드를 읽어 config.requireEntitlement에 적용(.env 기본값을 덮어씀)
 *     → bootSafety가 '실효값'을 검증. ⚠ firestore는 비동기 워밍이라 적용 시점이 listen 前 storesReady 이후(devServer).
 *   감사 H1 수정: 과거 firestore 모드가 메모리 폴백이라 토글이 재시작 시 증발(무료로 silent 회귀)했다 → firestore 백엔드 추가.
 */
import { join } from "node:path";
import { JsonFile } from "../src/lansmark/db/jsonFile";
import { FirestoreLite } from "../src/lansmark/db/firestoreLite";
import { FsDoc } from "../src/lansmark/db/firestoreStores";

interface Flags { requireEntitlement?: boolean; pgPreference?: "toss" | "paypal"; } // 미설정(undefined)=오버라이드 없음(config/.env 기본 사용)

export class RuntimeFlagsStore {
  private file: JsonFile<Flags> | null = null;   // file 모드(생성자서 동기 로드)
  private doc: FsDoc | null = null;              // firestore 모드(warm()로 비동기 로드)
  private mem: Flags = {};
  constructor(mode: "memory" | "file" | "firestore", dir: string, fs?: FirestoreLite) {
    if (mode === "file") this.file = new JsonFile<Flags>(join(dir, "runtimeFlags.json"), {}); // 다른 영속 스토어와 같은 dataDir
    else if (mode === "firestore") this.doc = new FsDoc(fs ?? new FirestoreLite(), "flags");
  }

  /** firestore 원격 로드(부팅 워밍) — file/memory는 즉시 resolve(생성자서 로드/휘발). devServer가 listen 前 await. */
  async warm(): Promise<void> {
    if (!this.doc) return;
    const j = await this.doc.load();
    if (j) this.mem = JSON.parse(j) as Flags;
  }

  private get d(): Flags { return this.file ? this.file.data : this.mem; }

  /** 유료 게이트 오버라이드 값(없으면 null = config/.env 기본 사용). */
  requireEntitlement(): boolean | null {
    const v = this.d.requireEntitlement;
    return typeof v === "boolean" ? v : null;
  }
  /** 유료 게이트 오버라이드 저장(영속) — ops 토글이 호출. file=디스크, firestore=lm_state/flags 문서. */
  setRequireEntitlement(v: boolean): void {
    this.d.requireEntitlement = v;
    this.file?.flush();
    this.doc?.save(JSON.stringify(this.mem)); // firestore write-through(재시작 보존)
  }

  /** PG 선호(활성 결제수단) 오버라이드 값 — 없으면 null(자동: live 중 toss>paypal). */
  pgPreference(): "toss" | "paypal" | null {
    const v = this.d.pgPreference;
    return v === "toss" || v === "paypal" ? v : null;
  }
  /** PG 선호 저장(영속) — null이면 오버라이드 제거(자동 선택 복귀). ops PG 스위칭 토글이 호출. */
  setPgPreference(v: "toss" | "paypal" | null): void {
    if (v === null) delete this.d.pgPreference; else this.d.pgPreference = v;
    this.file?.flush();
    this.doc?.save(JSON.stringify(this.mem)); // firestore write-through(재시작 보존)
  }
}
