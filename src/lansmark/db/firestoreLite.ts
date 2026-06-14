/**
 * Firestore 경량 클라이언트(무의존성·REST) — Cloud Run 재배포에도 상태가 살아남게 하는 영속 백엔드.
 *   왜 SDK가 아니라 REST: 이 저장소는 런타임 의존성 0이 원칙(공급망·번들 최소). Cloud Run에선
 *   메타데이터 서버가 서비스계정 토큰을 주므로(키 파일 불필요) fetch만으로 충분하다.
 *   인증: GCE/Cloud Run 메타데이터 서버(http://metadata.google.internal) → access_token(만료 전 캐시 갱신).
 *   문서 모델: 각 스토어의 전체 상태를 {"j": "<JSON 문자열>"} 단일 필드로 저장(blob-per-store) —
 *   기존 JsonFile(파일 1개=스토어 1개)과 1:1 미러라 호출부 무변경. ⚠ 문서 1MiB 한도(beta 규모 OK,
 *   유료 확장 시 per-record 어댑터로 승격 — ROADMAP §3-1).
 *   테스트: fetchFn 주입으로 오프라인 검증(네트워크 불요).
 */

export interface FirestoreLiteOpts {
  project?: string;                       // 미지정 시 메타데이터 서버에서 project-id 조회
  databaseId?: string;                    // 기본 "(default)"
  fetchFn?: typeof fetch;                 // 테스트 주입용
  metadataBase?: string;                  // 테스트 주입용(기본 metadata.google.internal)
  timeoutMs?: number;                     // 호출 타임아웃(기본 5s)
}

interface TokenCache { token: string; expAt: number; }

export class FirestoreLite {
  private readonly f: typeof fetch;
  private readonly meta: string;
  private readonly dbId: string;
  private readonly timeoutMs: number;
  private projectId?: string;
  private tok?: TokenCache;

  constructor(private readonly opts: FirestoreLiteOpts = {}) {
    this.f = opts.fetchFn ?? fetch;
    this.meta = (opts.metadataBase ?? "http://metadata.google.internal").replace(/\/$/, "");
    this.dbId = opts.databaseId ?? "(default)";
    this.timeoutMs = opts.timeoutMs ?? 5_000;
    this.projectId = opts.project;
  }

  /** 타임아웃 부착 fetch — 메타데이터/파이어스토어 호출이 부팅·요청을 무한정 잡지 않게. */
  private async call(url: string, init?: RequestInit): Promise<Response> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.timeoutMs);
    try { return await this.f(url, { ...init, signal: ac.signal }); }
    finally { clearTimeout(t); }
  }

  /** 프로젝트 ID — env(LANSMARK_GCP_PROJECT/GOOGLE_CLOUD_PROJECT) → 메타데이터 서버 순. */
  private async project(): Promise<string> {
    if (this.projectId) return this.projectId;
    const env = process.env.LANSMARK_GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (env) { this.projectId = env; return env; }
    const r = await this.call(`${this.meta}/computeMetadata/v1/project/project-id`, { headers: { "Metadata-Flavor": "Google" } });
    if (!r.ok) throw new Error(`metadata project-id HTTP ${r.status}`);
    this.projectId = (await r.text()).trim();
    return this.projectId;
  }

  /** 서비스계정 access_token(메타데이터 서버) — 만료 60초 전 갱신 캐시. 키 파일·시크릿 불필요. */
  private async token(): Promise<string> {
    const now = Date.now();
    if (this.tok && now < this.tok.expAt - 60_000) return this.tok.token;
    const r = await this.call(`${this.meta}/computeMetadata/v1/instance/service-accounts/default/token`, { headers: { "Metadata-Flavor": "Google" } });
    if (!r.ok) throw new Error(`metadata token HTTP ${r.status}`);
    const d = (await r.json()) as { access_token: string; expires_in: number };
    this.tok = { token: d.access_token, expAt: now + Math.max(60, d.expires_in) * 1000 };
    return this.tok.token;
  }

  private async docUrl(collection: string, id?: string): Promise<string> {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(collection)) throw new Error(`firestore 컬렉션명 부적합: ${collection}`); // 경로 주입 방어(현재 호출부는 상수)
    const p = await this.project();
    const base = `https://firestore.googleapis.com/v1/projects/${p}/databases/${encodeURIComponent(this.dbId)}/documents/${collection}`;
    return id != null ? `${base}/${encodeURIComponent(id)}` : base;
  }

  /** 단일 문서의 j(JSON 문자열) 읽기 — 404=null(최초 부팅), 그 외 오류는 throw(호출부가 sealed 처리). */
  async getJson(collection: string, id: string): Promise<string | null> {
    const url = await this.docUrl(collection, id);
    // 일시 장애(토큰·메타데이터·5xx) 재시도(P2 부팅 견고화) — 한 번의 transient가 스토어를 sealed로 만들지 않게. 404는 정상(최초)이라 즉시 null.
    let last: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await this.call(url, { headers: { Authorization: `Bearer ${await this.token()}` } });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`firestore get ${collection}/${id} HTTP ${r.status}`);
        const d = (await r.json()) as { fields?: { j?: { stringValue?: string } } };
        return d.fields?.j?.stringValue ?? null;
      } catch (e) { last = e; if (i < 2) await new Promise((r) => setTimeout(r, 300 * (i + 1))); }
    }
    throw last;
  }

  /** 단일 문서 upsert(전체 교체) — {"j": json}. */
  async setJson(collection: string, id: string, json: string): Promise<void> {
    const url = await this.docUrl(collection, id);
    const r = await this.call(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { j: { stringValue: json } } }),
    });
    if (!r.ok) throw new Error(`firestore set ${collection}/${id} HTTP ${r.status}`);
  }

  /** 컬렉션의 문서 id 전체 나열(페이지네이션) — 백업 스냅샷(lm_backups) 열거·prune용. 컬렉션 없으면 빈 배열. */
  async listDocIds(collection: string): Promise<string[]> {
    const base = await this.docUrl(collection); // 컬렉션 URL(문서 id 없음)
    const ids: string[] = [];
    let pageToken: string | undefined;
    for (let guard = 0; guard < 200; guard++) { // 안전 상한(무한 페이지 루프 방지)
      const u = new URL(base);
      u.searchParams.set("pageSize", "300");
      if (pageToken) u.searchParams.set("pageToken", pageToken);
      const r = await this.call(u.toString(), { headers: { Authorization: `Bearer ${await this.token()}` } });
      if (r.status === 404) break; // 컬렉션 미존재(스냅샷 0)
      if (!r.ok) throw new Error(`firestore list ${collection} HTTP ${r.status}`);
      const d = (await r.json()) as { documents?: { name?: string }[]; nextPageToken?: string };
      for (const doc of d.documents ?? []) { const nm = doc.name ?? ""; const seg = nm.slice(nm.lastIndexOf("/") + 1); if (seg) ids.push(decodeURIComponent(seg)); }
      if (!d.nextPageToken) break;
      pageToken = d.nextPageToken;
    }
    return ids;
  }

  /** 단일 문서 삭제(백업 prune용) — 404(이미 없음)는 성공으로 간주. */
  async deleteDoc(collection: string, id: string): Promise<void> {
    const url = await this.docUrl(collection, id);
    const r = await this.call(url, { method: "DELETE", headers: { Authorization: `Bearer ${await this.token()}` } });
    if (!r.ok && r.status !== 404) throw new Error(`firestore delete ${collection}/${id} HTTP ${r.status}`);
  }

  /** 자동 ID 문서 추가(감사로그 등 append-only) — 실패는 호출부에서 무시 가능(운영 연속성 우선). */
  async addDoc(collection: string, fields: Record<string, string>): Promise<void> {
    const url = await this.docUrl(collection);
    const fs: Record<string, { stringValue: string }> = {};
    for (const k of Object.keys(fields)) fs[k] = { stringValue: fields[k] };
    const r = await this.call(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fs }),
    });
    if (!r.ok) throw new Error(`firestore add ${collection} HTTP ${r.status}`);
  }
}
