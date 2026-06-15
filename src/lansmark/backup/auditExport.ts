/**
 * 감사용 1회 내보내기 — 운영자가 카테고리를 골라 선택 자료만 **복호된 평문**으로 압축(zip) 다운로드.
 *   감사(監査) 측이 원하는 자료만 제공하기 위함. 백업(blob 복사·암호문 보존)과 목적이 다름:
 *     백업=재해/되돌리기(암호문 그대로) · 내보내기=감사 제출(사람이 읽도록 복호).
 *   보안 가드: 관리자 전용(라우트), **세션(인증 토큰)·시크릿 제외**, PII 카테고리 명시 라벨.
 *     시크릿(키·엔타이틀먼트 서명키)은 스토어가 아니라 env/Secret Manager라 애초에 포함되지 않음.
 */
import { openAtRest } from "../db/atRest";
import { makeZip, type ZipEntry } from "./zipWriter";
import type { BlobBackend } from "./blobBackend";

/** 카테고리 메타(스토어 키 → 한글 라벨·PII 여부). file/firestore 양쪽 키 이름 모두 커버. */
const CAT_META: Record<string, { label: string; pii: boolean }> = {
  feedback: { label: "플라이휠 실측(작물·지형·수확량)", pii: false },
  journal: { label: "재배일지(좌표·매출·기록)", pii: true },
  accounts: { label: "계정(식별자 해시·메타)", pii: true },
  subscriptions: { label: "알림 구독(휴대폰 번호)", pii: true },
  analytics: { label: "익명 분석(집계·PII 0)", pii: false },
  entitlement: { label: "결제 권한(소진·실효)", pii: false },
  entitlement_use: { label: "결제 권한·소진", pii: false },
  entitlement_revoked: { label: "결제 권한·실효", pii: false },
  idempotency: { label: "웹훅 멱등 키", pii: false },
  flags: { label: "운영 설정(토글)", pii: false },
};
/** 내보내기 금지 — 세션은 인증 토큰 해시(감사 무의미 + 탈취 위험). */
const EXCLUDED = new Set<string>(["sessions"]);

export interface ExportCategory { key: string; label: string; pii: boolean; }

/** 이 모드에서 내보낼 수 있는 카테고리 목록(세션 제외). */
export function listExportCategories(be: BlobBackend): ExportCategory[] {
  return be.listStoreKeys()
    .filter((k) => !EXCLUDED.has(k))
    .map((k) => ({ key: k, label: CAT_META[k]?.label ?? k, pii: !!CAT_META[k]?.pii }));
}

export interface ExportResult { zip: Buffer; manifest: Record<string, unknown>; selected: string[]; }

/**
 * 선택 카테고리를 복호해 zip 생성. 잘못된/제외 키는 무시(화이트리스트). 세션은 절대 포함 안 됨.
 *   각 카테고리 = `<key>.json`(복호 평문) + manifest.json(메타·건수·PII 표시) + README.txt(감사 안내).
 */
export async function buildAuditExport(be: BlobBackend, keys: string[], opts: { appVersion: string; at: string }): Promise<ExportResult> {
  const allow = new Set(listExportCategories(be).map((c) => c.key));
  const selected = [...new Set(keys)].filter((k) => allow.has(k)); // 화이트리스트(세션·미지키 차단)
  const entries: ZipEntry[] = [];
  const items: Array<{ category: string; label: string; pii: boolean; records: number | null; bytes: number; note: string }> = [];
  for (const k of selected) {
    const blob = await be.readStoreBlob(k);
    let plain = "null", note = "", records: number | null = null;
    if (blob == null) { note = "데이터 없음(미영속)"; }
    else {
      const opened = openAtRest(blob); // ENC1 복호 또는 평문 통과
      if (opened.ok) {
        plain = opened.plain;
        try { const j = JSON.parse(plain); records = Array.isArray(j) ? j.length : (j && typeof j === "object" ? Object.keys(j).length : null); } catch { /* 비배열 — records 미상 */ }
      } else { plain = JSON.stringify({ error: "복호 실패", reason: opened.reason }); note = "복호 실패(" + opened.reason + ")"; }
    }
    entries.push({ name: `${k}.json`, data: Buffer.from(plain, "utf8") });
    items.push({ category: k, label: CAT_META[k]?.label ?? k, pii: !!CAT_META[k]?.pii, records, bytes: Buffer.byteLength(plain, "utf8"), note });
  }
  const manifest = {
    product: "LANSMARK",
    purpose: "감사 제출용 1회 내보내기(복호된 평문)",
    exportedAt: opts.at,
    appVersion: opts.appVersion,
    storeMode: be.mode,
    categories: items,
    excluded: ["sessions(인증 토큰 해시)", "암호화 키·서명 시크릿(스토어 미보관 — env/Secret Manager)"],
    note: "선택 카테고리만 포함. PII 표시된 항목은 개인정보 포함 — 안전하게 취급/전달하세요.",
  };
  const readme =
    "LANSMARK 감사 내보내기\n\n" +
    `생성: ${opts.at} · 버전 ${opts.appVersion} · 모드 ${be.mode}\n` +
    `포함 카테고리(${items.length}): ${items.map((i) => i.label + (i.pii ? "[PII]" : "")).join(", ") || "(없음)"}\n\n` +
    "· 각 <카테고리>.json = 복호된 평문 데이터. manifest.json = 메타/건수.\n" +
    "· 제외: 세션(인증 토큰), 암호화 키·서명 시크릿(스토어에 없음).\n" +
    "· [PII] 표시 항목은 개인정보 포함 — 전달·보관에 주의.\n";
  entries.unshift({ name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") });
  entries.push({ name: "README.txt", data: Buffer.from(readme, "utf8") });
  return { zip: makeZip(entries), manifest, selected };
}
