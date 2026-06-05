/**
 * 재배 일지(영농 동반) 도메인 타입 — 한 필지·한 작기(作期)의 생애주기 기록.
 *   책임: 데이터의 "형태"(저장·전송)만 정의한다. 계산은 report.ts, 영속은 db/stores.ts,
 *         권한·검증은 routes/journal.ts가 담당한다(기능별 단일책임 분리 · CLAUDE.md #6).
 *   🌱 해자(moat) 연결: predicted(시뮬 예측)와 harvest(수확 실측)가 모두 있으면,
 *       수확 기록 시 플라이휠 OutcomeRecord로 자동 승격된다(routes/journal.ts) → 예측이 현실로 보정된다.
 */

/** 영농 작업 종류 — 파종·정식·시비·방제·관수·제초·관찰·기타. (리포트에서 종류별 횟수 집계) */
export type JournalEventKind =
  | "sow"         // 파종
  | "transplant"  // 정식(이식)
  | "fertilize"   // 시비(거름)
  | "spray"       // 방제(농약·영양제 살포)
  | "irrigate"    // 관수(물대기)
  | "weed"        // 제초
  | "observe"     // 생육 관찰(메모만)
  | "other";      // 기타

/** 영농 작업 1건. 투입(비용·노동)은 선택 — 적은 만큼 리포트 집계 정확도가 올라간다. */
export interface JournalEvent {
  at: string;            // 작업일(ISO: "yyyy-mm-dd" 또는 datetime)
  kind: JournalEventKind;
  note?: string;         // 자유 메모(라우트에서 길이 절단)
  costKrw?: number;      // 이 작업의 투입 비용(원, 0 이상)
  laborHours?: number;   // 투입 노동(시간, 0 이상)
}

/** 수확 실측 1건 — 작기 종료 시 1회 기록(여러 번 수확하는 작물은 합산값 권장). */
export interface HarvestRecord {
  at: string;            // 수확일(ISO)
  yieldKg: number;       // 실수확량(kg, 0 이상)
  revenueKrw?: number;   // 실매출(원, 0 이상)
  salesChannel?: string; // 판로(도매/직거래/가공/공판장 등 — harvest-market 연동 전까지 자유 입력)
  gradeNote?: string;    // 등급·품위 메모
}

/**
 * 시뮬레이션 예측 baseline — 재배 시작 시 /api/simulate 결과에서 떠와 결속한다.
 *   용도: ① 리포트의 "예측 대비 정확도" ② 수확 시 플라이휠 OutcomeRecord(예측치)로 전달.
 *   ⚠ 클라이언트가 보내는 값이므로 라우트에서 0↑·상한 클램프 후 저장(변조/이상치 차단).
 */
export interface JournalPredicted {
  yieldKg: number;
  costKrw: number;
  revenueKrw: number;
  // 지형(플라이휠 버킷 산정용) — 있으면 수확 승격 시 OutcomeRecord.terrain으로 전달.
  terrain?: { slopeDegree?: number; aspect?: string; altitudeM?: number };
  source?: string;       // 예측 출처/신뢰도 메모(예: "sim · confidence=D")
}

/** 작기 상태 — 재배중 → 수확완료 → (사용자가) 종료. */
export type JournalStatus = "growing" | "harvested" | "closed";

/** 재배 일지 1건(= 한 작기). id·userId·시각은 서버가 채운다(클라이언트 주장 불가). */
export interface JournalEntry {
  id: string;            // 서버 생성 식별자(uuid)
  userId: string;        // 소유자(엔티틀먼트 userId) — 소유권 검사 기준(타인 일지 접근 차단)
  createdAt: string;     // 생성 시각(ISO, 서버)
  updatedAt: string;     // 최종 수정 시각(ISO, 서버)
  // 어디서 · 무엇을
  parcelId?: string;
  region?: string;
  lat?: number;
  lng?: number;
  cropId: string;
  variety?: string;      // 품종(자유 입력 — cultivation-guide 연동 시 코드화)
  areaM2?: number;       // 실재배 면적
  plantedAt?: string;    // 정식·파종일(기간 계산 기준)
  // 예측 · 기록
  predicted?: JournalPredicted;
  events: JournalEvent[];
  harvest?: HarvestRecord;
  status: JournalStatus;
}
