/**
 * 농업 지원·혜택 제도 시드 — 대표적·안정적으로 공개된 제도 목록(참고용).
 *   ⚠ 데이터 정직성(CLAUDE.md #4): 구체 금액·자격·신청기간은 해마다·지역마다 달라 **단정하지 않는다**.
 *      각 항목은 '제도명 + 주관 + 일반 설명 + 공식 확인 경로'만 담고, 실제 지원 여부는 공식 출처로 확인하도록 안내한다.
 *   ★ live-upgrade seam: 공공데이터포털 농림사업·지자체 보조사업 + 농협 혜택 큐레이션(API 정형성 약함 → 데이터 운영 필요).
 */
export interface SupportProgram {
  id: string;
  name: string;                                  // 제도명(공개 사실)
  provider: "정부" | "지자체" | "농협" | "공공";  // 제공 주체 구분
  agency: string;                                // 주관 기관
  summary: string;                               // 한 줄 설명(일반)
  audience: string;                              // 대상(일반 안내)
  cropTags?: string[];                           // 관련 작물 카테고리(있으면 우선 노출)
  officialHint: string;                          // 공식 확인 경로(기관/포털 — 정확 URL은 단정 안 함)
}

export const SUPPORT_PROGRAMS: SupportProgram[] = [
  { id: "young_farmer", name: "청년후계농 영농정착지원사업", provider: "정부", agency: "농림축산식품부", summary: "청년 신규 농업인의 영농 정착(정착지원금·교육·농지 등) 지원", audience: "만 18~40세 신규·청년 농업인", officialHint: "농림축산식품부 · 농림사업정보시스템(Agrix) · 관할 시군 농업기술센터" },
  { id: "direct_payment", name: "공익직불제(기본형 직불금)", provider: "정부", agency: "농림축산식품부", summary: "요건을 갖춘 농지·농업인에 직불금 지급(공익 기능 이행)", audience: "등록 농업인·대상 농지", officialHint: "농림축산식품부 · 관할 읍면동 · 국립농산물품질관리원" },
  { id: "crop_insurance", name: "농작물재해보험", provider: "정부", agency: "농림축산식품부 · NH농협손해보험", summary: "자연재해 피해 보상(국가·지자체 보험료 보조)", audience: "대상 품목 가입 농가", officialHint: "지역 농협 · NH농협손해보험" },
  { id: "machine_rental", name: "농기계 임대사업", provider: "지자체", agency: "시군 농업기술센터", summary: "고가 농기계를 저렴하게 임대(작업 효율·비용 절감)", audience: "관내 농업인", officialHint: "관할 시군 농업기술센터" },
  { id: "nh_fund", name: "농협 영농·시설 자금(저리·이차보전)", provider: "농협", agency: "지역 농협", summary: "영농·농자재·시설 자금 융자(조건부 이자 지원)", audience: "조합원·농업인", officialHint: "가입 지역 농협(영농지도·금융 창구)" },
  { id: "smartfarm", name: "시설원예·스마트팜 지원사업", provider: "정부", agency: "농림축산식품부 · 지자체", summary: "시설·스마트팜 설치·개선 보조(공모·예산 범위 내)", audience: "시설 작물 농가", cropTags: ["facility", "fruit", "vegetable"], officialHint: "농림축산식품부 · 관할 지자체 공고" },
  { id: "return_farmer", name: "귀농·귀촌 지원(정착·창업·주택)", provider: "지자체", agency: "시군 · 농림축산식품부", summary: "귀농 정착·창업·주택 자금 등(지역별 상이)", audience: "귀농·귀촌인", officialHint: "귀농귀촌종합센터 · 관할 시군" },
  { id: "agtech_edu", name: "농업기술센터 교육·현장 컨설팅", provider: "지자체", agency: "시군 농업기술센터", summary: "작물별 재배기술·경영 교육 및 현장 지도(대체로 무료)", audience: "관내 농업인", officialHint: "관할 시군 농업기술센터 · 농사로" },
];
