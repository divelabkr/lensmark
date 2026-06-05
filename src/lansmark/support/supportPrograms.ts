/**
 * 지원금·지자체·농협 혜택(support-programs) — Phase A: 대표 제도 큐레이션.
 *   책임: (지역·작물 힌트) → 대표 지원 제도 목록 + 작물 관련도 표시(순수·결정적).
 *   데이터 정직성(CLAUDE.md #4): 금액·자격·신청기간을 단정하지 않고 '제도 안내 + 공식 확인 경로'만 제공.
 *   ★ live-upgrade seam: 공공데이터포털 농림사업·지자체 보조사업 + 농협 혜택 큐레이션(데이터 운영 = HUMAN GATE).
 *   가드레일: 지원 보장 금지 · 최신성 보장 안 함(공식 출처 확인 안내) · 면책.
 */
import { getCropProfile } from "../data/crops.seed";
import { SUPPORT_PROGRAMS, type SupportProgram } from "../data/support.seed";

export interface SupportResult {
  region?: string;
  cropId?: string;
  cropNameKo?: string;
  programs: (SupportProgram & { relevant: boolean })[]; // relevant=작물 카테고리 연관
  sources: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "지원 사업 목록은 대표적 제도 안내(참고)입니다. 실제 지원 여부·금액·자격·신청 기간은 반드시 관할 기관/공식 출처로 확인하세요. 최신성을 보장하지 않으며, 지역·연도별로 다릅니다.";

/** 대표 지원 제도 + 작물 관련도. unknown cropId는 무시(전체 목록 반환, 크래시 없음). */
export function buildSupportPrograms(opts: { region?: string; cropId?: string } = {}): SupportResult {
  let cropNameKo: string | undefined, cropCat: string | undefined;
  if (opts.cropId) {
    try { const c = getCropProfile(opts.cropId); cropNameKo = c.cropNameKo; cropCat = c.category; }
    catch { /* 목록 밖 작물 → 작물 필터 없이 전체 안내 */ }
  }
  const programs = SUPPORT_PROGRAMS.map((p) => ({
    ...p,
    relevant: !!(cropCat && p.cropTags && p.cropTags.includes(cropCat)),
  }));
  programs.sort((a, b) => Number(b.relevant) - Number(a.relevant)); // 관련 제도 먼저(안정 정렬)
  return {
    region: opts.region, cropId: opts.cropId, cropNameKo,
    programs,
    sources: ["대표 제도 큐레이션(참고)", "공공데이터포털 농림사업·지자체 보조(예정·seam)", "농협 혜택(예정·seam)"],
    disclaimer: DISCLAIMER,
  };
}
