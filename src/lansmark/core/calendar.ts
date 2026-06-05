import { getCropCalendar } from "../data/cropCalendar.seed";
import { getCropProfile } from "../data/crops.seed";

export type MonthStage = "idle" | "sow" | "growth" | "bloom" | "harvest";
export interface CalendarMonth {
  month: number;        // 1~12
  stage: MonthStage;
  label?: string;       // care 등 비고
  frostRisk?: boolean;  // 서리 민감 작물의 개화/정식기 저온 경고
}
export interface GrowthCalendar {
  cropId: string;
  cropNameKo: string;
  months: CalendarMonth[];
  note?: string;
}

export function buildGrowthCalendar(cropId: string): GrowthCalendar {
  const cal = getCropCalendar(cropId);
  const crop = getCropProfile(cropId);
  const months: CalendarMonth[] = [];
  const sow = new Set(cal?.sow ?? []);
  const bloom = new Set(cal?.bloom ?? []);
  const harvest = new Set(cal?.harvest ?? []);
  const careMap = new Map((cal?.care ?? []).map((c) => [c.month, c.label]));
  const frostSensitive = crop.requirements.frostSensitivity === "high";

  // 활동 구간(파종/개화 ~ 수확) 사이를 growth로 채움
  const active = new Set<number>([...sow, ...bloom, ...harvest]);
  const minA = active.size ? Math.min(...active) : 0;
  const maxA = active.size ? Math.max(...active) : 0;

  for (let m = 1; m <= 12; m++) {
    let stage: MonthStage = "idle";
    if (sow.has(m)) stage = "sow";
    else if (bloom.has(m)) stage = "bloom";
    else if (harvest.has(m)) stage = "harvest";
    else if (m > minA && m < maxA && active.size > 1) stage = "growth";
    const frostRisk = frostSensitive && (sow.has(m) || bloom.has(m));
    months.push({ month: m, stage, label: careMap.get(m), frostRisk });
  }

  return { cropId, cropNameKo: crop.cropNameKo, months, note: cal?.note };
}
