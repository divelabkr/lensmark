/**
 * Dream 스냅샷 캐시 — consolidate()의 정리 결과(이상치격리·recency 가중·버킷승격)를 store별 TTL 캐시.
 *   ① 매 simulate의 raw 재계산(store 전체 스캔)을 없애고(재활용·성능)
 *   ② 정밀화된 보정을 사용자에게 도달시킨다(해자 — consolidate가 코드만 있고 프로덕션 미호출이던 갭 해소).
 *
 *   ★ store별 상태(WeakMap): 운영은 단일 인스턴스라 store 1개지만, 상태를 store에 묶어 테스트·다중 store 환경서 누수 0(격리).
 *   ★ lazy+TTL(스케줄러 없이): min=0 단일 인스턴스라 cron 상주가 어렵다 → '없거나·dirty(피드백 추가)·TTL 만료' 시 첫 조회가 1회
 *     재생성하는 자기치유. 동시 재생성은 in-flight 1개로 합쳐 stampede 차단(provider cache와 동일 사상).
 *   ★ 점진·안전: 스냅샷에 해당 키(실측)가 없으면 raw getCalibration 폴백 → 콜드/신규 작물은 기존 동작 그대로(회귀 0).
 */
import { consolidate, lookupCalibration, type CalibrationSnapshot } from "./consolidate";
import { getCalibration } from "./calibration";
import type { CalibrationResult } from "./calibrate";
import type { FeedbackStore } from "./feedbackStore";

interface CacheState { snapshot: CalibrationSnapshot | null; builtAt: number; dirty: boolean; building: Promise<void> | null; }
const TTL_MS = 10 * 60 * 1000; // 10분 — 저트래픽엔 충분(피드백 추가는 markCalibrationDirty로 즉시 무효화하므로 신선도 손실 없음)
const byStore = new WeakMap<FeedbackStore, CacheState>();

function stateOf(store: FeedbackStore): CacheState {
  let s = byStore.get(store);
  if (!s) { s = { snapshot: null, builtAt: 0, dirty: false, building: null }; byStore.set(store, s); }
  return s;
}

/** 실측 피드백 추가 시 호출 — 해당 store 스냅샷 무효화(다음 조회가 재정리·정밀화 즉시 반영). */
export function markCalibrationDirty(store: FeedbackStore): void { stateOf(store).dirty = true; }

/** 운영/테스트 점검용 — 해당 store의 현재 정리 리포트(미생성이면 null). */
export function currentSnapshotReport(store: FeedbackStore): CalibrationSnapshot["report"] | null {
  const snap = stateOf(store).snapshot;
  return snap ? snap.report : null;
}

async function ensureSnapshot(store: FeedbackStore, now: number): Promise<void> {
  const s = stateOf(store);
  if (s.snapshot && !s.dirty && now - s.builtAt < TTL_MS) return;     // 신선 → 재생성 불필요
  if (s.building) return s.building;                                  // 진행 중 재생성 공유(동시 1회·stampede 차단)
  s.building = (async () => {
    const records = await store.all();
    s.snapshot = consolidate(records, { now });
    s.builtAt = now; s.dirty = false;
  })().finally(() => { s.building = null; });
  return s.building;
}

/**
 * Dream 스냅샷 기반 보정 — 이상치격리·recency 가중·버킷승격이 반영된 정밀 보정(raw getCalibration 대비).
 *   스냅샷에 실측 키가 있으면 정밀 보정, 없으면(콜드/신규 작물) raw getCalibration으로 폴백(기존 동작 보존·무중단).
 */
export async function getConsolidatedCalibration(
  cropId: string, region: string | undefined, store: FeedbackStore, bucket?: string, now = Date.now(),
): Promise<CalibrationResult> {
  try {
    await ensureSnapshot(store, now);
    const snap = stateOf(store).snapshot;
    if (snap) {
      const cal = lookupCalibration(snap, cropId, region, bucket);
      if (cal.n > 0) return cal;                                      // 스냅샷에 실측 있음 → 정밀화된 보정 사용
    }
  } catch { /* 스냅샷 실패 → 아래 raw 폴백(무중단) */ }
  return getCalibration(cropId, region, store, bucket);             // 콜드/신규/실패 → 기존 raw 경로
}
