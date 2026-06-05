/**
 * KAMIS Open API 코드 매핑 (cropId → 부류/품목/품종).
 * API 파라미터: p_itemcategorycode(부류) · p_itemcode(품목) · p_kindcode(품종)
 * 부류(category): 100 식량작물 · 200 채소류 · 300 특용작물 · 400 과일류
 *
 * ⚠️ itemCode/kindCode는 KAMIS 코드표로 반드시 검증 후 채울 것:
 *   - KAMIS 가격조회 페이지의 부류/품목/품종 드롭다운
 *     https://www.kamis.or.kr/customer/price/retail/item.do
 *   - 농식품 공공데이터포털 '품목표준코드' 서비스
 *     https://data.mafra.go.kr (가락시장품목코드/품목표준코드/품종표준코드)
 * 일부 작물(예: 블루베리)은 KAMIS 미등록일 수 있어 대체 출처가 필요하다.
 */
export interface KamisCode {
  categoryCode: string;     // 부류 (확정)
  itemCode?: string;        // 품목 (검증 후 입력)
  kindCode?: string;        // 품종 (기본 "01"=일반, 검증)
  rankCode?: string;        // 등급 (예: 04=상품, 05=중품 — 검증)
  verified: boolean;        // 코드 검증 완료 여부
  note?: string;
}

export const KAMIS_CODES: Record<string, KamisCode> = {
  // ── 식량작물 (100) ──
  rice:          { categoryCode: "100", verified: false, note: "쌀(백미/현미 품종) 품목·등급 코드 확인 필요 — 무료 대표작물" },
  barley:        { categoryCode: "100", verified: false, note: "보리(겉보리/쌀보리 품종) 품목코드 확인 필요 — 무료 대표작물" },
  sweet_potato:  { categoryCode: "100", verified: false, note: "고구마 품목코드 확인 필요" },
  potato:        { categoryCode: "100", verified: false, note: "감자 품목코드 확인 필요" },
  soybean:       { categoryCode: "100", verified: false, note: "콩(메주콩/백태) 품목·품종 확인 필요" },
  corn:          { categoryCode: "100", verified: false, note: "옥수수 품목코드 확인 필요" },
  // ── 채소류 (200) ──
  garlic:        { categoryCode: "200", verified: false, note: "마늘(깐마늘/통마늘 품종 구분) 확인 필요" },
  onion:         { categoryCode: "200", verified: false, note: "양파 품목코드 확인 필요" },
  chili_pepper:  { categoryCode: "200", verified: false, note: "건고추(화건/양건 품종) 확인 필요" },
  napa_cabbage:  { categoryCode: "200", verified: false, note: "배추 품목코드 확인 필요" },
  strawberry:    { categoryCode: "200", verified: false, note: "딸기 — KAMIS 분류(채소/과채) 확인 필요" },
  // ── 특용작물 (300) ──
  sesame:        { categoryCode: "300", verified: false, note: "참깨 품목코드 확인 필요" },
  perilla:       { categoryCode: "300", verified: false, note: "들깨 품목코드 확인 필요" },
  balloon_flower:{ categoryCode: "300", verified: false, note: "도라지 — KAMIS 등록 여부 확인 필요" },
  // ── 과일류 (400) ──
  apple:         { categoryCode: "400", itemCode: "411", kindCode: "05", rankCode: "04", verified: true, note: "실연동 검증: error 000 · 전국평균 ~9,100원/kg(과일 도매 범위) · convert_kg_yn=Y" },
  grape:         { categoryCode: "400", verified: false, note: "포도(샤인머스캣/캠벨 품종) 확인 필요" },
  blueberry:     { categoryCode: "400", verified: false, note: "블루베리 — KAMIS 미등록 가능, 대체 출처 필요" },
};

export function getKamisCode(cropId: string): KamisCode | null {
  return KAMIS_CODES[cropId] ?? null;
}
