import type { CropProfile } from "../types";

/**
 * 초기 작물 룰북 (illustrative).
 * ⚠️ 아래 경제성/요구조건 수치는 스켈레톤·목업용 근사값이다.
 *    런칭 전 지역 시험성적·실거래 데이터로 반드시 보정/검수해야 한다.
 *    단위: plantingDensityPerM2(주/㎡), yieldKgPerM2(kg/㎡), costKrwPerM2(원/㎡), priceKrwPerKg(원/kg)
 */
export const CROP_PROFILES: CropProfile[] = [
  {
    cropId: "sweet_potato", cropNameKo: "고구마", cropNameEn: "Sweet potato", category: "root",
    cultivarGroups: [
      { groupId: "early_market", nameKo: "조기출하형", description: "빠른 출하와 가격 타이밍 중심", tags: ["early"] },
      { groupId: "storage", nameKo: "저장성 우선형", description: "저장성과 안정 판매 중심", tags: ["storage"] },
    ],
    requirements: { phMin: 5.5, phMax: 6.8, drainage: "medium", waterNeed: "medium", coldTolerance: "medium", frostSensitivity: "medium", sunlightNeed: "high", laborNeed: "medium", suitableSlopeMaxDegree: 10 },
    economics: {
      plantingDensityPerM2: { p10: 2.0, p50: 2.8, p90: 3.5 },
      yieldKgPerM2ByYear: { year1: { p10: 1.2, p50: 1.8, p90: 2.5 }, mature: { p10: 1.2, p50: 1.8, p90: 2.5 } },
      costKrwPerM2: { p10: 1800, p50: 2800, p90: 4200 },
      priceKrwPerKg: { wholesale: { p10: 900, p50: 1400, p90: 2200 }, direct: { p10: 1800, p50: 2800, p90: 4200 }, mixed: { p10: 1300, p50: 2100, p90: 3200 } },
    },
    riskNotes: ["가격 변동성", "수확·선별 노동", "저장 공간 필요", "배수 불량 시 품질 저하"],
    additionalChecks: ["농기계 진입 가능 여부", "토양 물빠짐", "저장 공간", "지역 판매 채널"],
  },
  {
    cropId: "potato", cropNameKo: "감자", cropNameEn: "Potato", category: "root",
    cultivarGroups: [
      { groupId: "spring", nameKo: "봄재배형", description: "봄 파종 중심", tags: ["spring"] },
      { groupId: "processing", nameKo: "가공/저장형", description: "가공·저장 판로 중심", tags: ["processing"] },
    ],
    requirements: { phMin: 5.0, phMax: 6.5, drainage: "high", waterNeed: "medium", coldTolerance: "medium", frostSensitivity: "high", sunlightNeed: "high", laborNeed: "medium", suitableSlopeMaxDegree: 12 },
    economics: {
      plantingDensityPerM2: { p10: 3.5, p50: 4.5, p90: 6.0 },
      yieldKgPerM2ByYear: { year1: { p10: 2.0, p50: 3.0, p90: 4.0 }, mature: { p10: 2.0, p50: 3.0, p90: 4.0 } },
      costKrwPerM2: { p10: 1500, p50: 2500, p90: 3800 },
      priceKrwPerKg: { wholesale: { p10: 600, p50: 1100, p90: 1800 }, direct: { p10: 1500, p50: 2500, p90: 3800 }, mixed: { p10: 1000, p50: 1700, p90: 2600 } },
    },
    riskNotes: ["서리 피해", "역병(疫病) 관리", "가격 변동성", "저장 관리"],
    additionalChecks: ["배수 상태", "씨감자 품질", "저장 공간"],
  },
  {
    cropId: "soybean", cropNameKo: "콩(대두)", cropNameEn: "Soybean", category: "field_crop",
    cultivarGroups: [
      { groupId: "general", nameKo: "일반 메주콩형", description: "장류/일반 판매 중심", tags: ["general"] },
      { groupId: "low_labor", nameKo: "기계화·저관리형", description: "기계 수확 적합", tags: ["low_labor"] },
    ],
    requirements: { phMin: 6.0, phMax: 7.0, drainage: "medium", waterNeed: "low", coldTolerance: "medium", frostSensitivity: "medium", sunlightNeed: "high", laborNeed: "low", suitableSlopeMaxDegree: 12 },
    economics: {
      plantingDensityPerM2: { p10: 12, p50: 18, p90: 25 },
      yieldKgPerM2ByYear: { year1: { p10: 0.15, p50: 0.25, p90: 0.35 }, mature: { p10: 0.15, p50: 0.25, p90: 0.35 } },
      costKrwPerM2: { p10: 600, p50: 1100, p90: 1800 },
      priceKrwPerKg: { wholesale: { p10: 4000, p50: 5500, p90: 7500 }, direct: { p10: 6000, p50: 9000, p90: 13000 }, mixed: { p10: 5000, p50: 7000, p90: 10000 } },
    },
    riskNotes: ["단위면적 수익성 한계", "노린재 등 병해충", "수확기 기계화 의존"],
    additionalChecks: ["기계 수확 가능 여부", "건조 공간", "지역 수매처"],
  },
  {
    cropId: "corn", cropNameKo: "옥수수(찰/단옥수수)", cropNameEn: "Corn", category: "field_crop",
    cultivarGroups: [
      { groupId: "waxy", nameKo: "찰옥수수형", description: "직거래·로컬 판매 중심", tags: ["waxy"] },
      { groupId: "sweet", nameKo: "단옥수수형", description: "신선 출하 중심", tags: ["sweet"] },
    ],
    requirements: { phMin: 5.5, phMax: 7.0, drainage: "medium", waterNeed: "medium", coldTolerance: "low", frostSensitivity: "high", sunlightNeed: "high", laborNeed: "medium", suitableSlopeMaxDegree: 10 },
    economics: {
      plantingDensityPerM2: { p10: 4, p50: 5.5, p90: 7 },
      yieldKgPerM2ByYear: { year1: { p10: 1.0, p50: 1.6, p90: 2.2 }, mature: { p10: 1.0, p50: 1.6, p90: 2.2 } },
      costKrwPerM2: { p10: 1200, p50: 2000, p90: 3000 },
      priceKrwPerKg: { wholesale: { p10: 800, p50: 1400, p90: 2200 }, direct: { p10: 1800, p50: 2800, p90: 4500 }, mixed: { p10: 1300, p50: 2100, p90: 3300 } },
    },
    riskNotes: ["출하 타이밍 집중", "멧돼지/조류 피해", "신선도 관리"],
    additionalChecks: ["판로(직거래/로컬)", "야생동물 피해 대비", "수확 인력"],
  },
  {
    cropId: "garlic", cropNameKo: "마늘", cropNameEn: "Garlic", category: "vegetable",
    cultivarGroups: [
      { groupId: "warm", nameKo: "난지형", description: "남부 따뜻한 지역 적합", tags: ["warm"] },
      { groupId: "cold", nameKo: "한지형", description: "중북부 적합", tags: ["cold"] },
    ],
    requirements: { phMin: 5.5, phMax: 6.5, drainage: "high", waterNeed: "medium", coldTolerance: "high", frostSensitivity: "low", sunlightNeed: "high", laborNeed: "high", suitableSlopeMaxDegree: 8 },
    economics: {
      plantingDensityPerM2: { p10: 15, p50: 22, p90: 30 },
      yieldKgPerM2ByYear: { year1: { p10: 0.9, p50: 1.3, p90: 1.8 }, mature: { p10: 0.9, p50: 1.3, p90: 1.8 } },
      costKrwPerM2: { p10: 3000, p50: 4500, p90: 6500 },
      priceKrwPerKg: { wholesale: { p10: 2500, p50: 4000, p90: 6000 }, direct: { p10: 4000, p50: 6500, p90: 10000 }, mixed: { p10: 3200, p50: 5200, p90: 8000 } },
    },
    riskNotes: ["종구 비용 높음", "파종·수확 노동 집중", "가격 변동성", "잎마름병"],
    additionalChecks: ["종구 확보", "수확 인력", "건조·저장 공간"],
  },
  {
    cropId: "onion", cropNameKo: "양파", cropNameEn: "Onion", category: "vegetable",
    cultivarGroups: [
      { groupId: "early", nameKo: "조생형", description: "이른 출하 중심", tags: ["early"] },
      { groupId: "storage", nameKo: "중만생 저장형", description: "저장·연중 판매 중심", tags: ["storage"] },
    ],
    requirements: { phMin: 6.0, phMax: 7.0, drainage: "medium", waterNeed: "medium", coldTolerance: "high", frostSensitivity: "low", sunlightNeed: "high", laborNeed: "high", suitableSlopeMaxDegree: 8 },
    economics: {
      plantingDensityPerM2: { p10: 20, p50: 28, p90: 36 },
      yieldKgPerM2ByYear: { year1: { p10: 4.0, p50: 6.0, p90: 8.0 }, mature: { p10: 4.0, p50: 6.0, p90: 8.0 } },
      costKrwPerM2: { p10: 2000, p50: 3200, p90: 4800 },
      priceKrwPerKg: { wholesale: { p10: 400, p50: 800, p90: 1400 }, direct: { p10: 1000, p50: 1700, p90: 2800 }, mixed: { p10: 700, p50: 1200, p90: 2000 } },
    },
    riskNotes: ["가격 폭락 위험", "정식·수확 노동", "저장 손실"],
    additionalChecks: ["정식 인력", "저장 공간", "계약재배 가능성"],
  },
  {
    cropId: "chili_pepper", cropNameKo: "고추(건고추)", cropNameEn: "Chili pepper", category: "vegetable",
    cultivarGroups: [
      { groupId: "dried", nameKo: "건고추형", description: "건조·분말 판매 중심", tags: ["dried"] },
      { groupId: "fresh", nameKo: "풋고추형", description: "신선 출하 중심", tags: ["fresh"] },
    ],
    requirements: { phMin: 6.0, phMax: 6.8, drainage: "high", waterNeed: "medium", coldTolerance: "low", frostSensitivity: "high", sunlightNeed: "high", laborNeed: "high", suitableSlopeMaxDegree: 8 },
    economics: {
      plantingDensityPerM2: { p10: 2, p50: 2.8, p90: 3.5 },
      yieldKgPerM2ByYear: { year1: { p10: 0.25, p50: 0.4, p90: 0.6 }, mature: { p10: 0.25, p50: 0.4, p90: 0.6 } },
      costKrwPerM2: { p10: 4000, p50: 6000, p90: 9000 },
      priceKrwPerKg: { wholesale: { p10: 8000, p50: 13000, p90: 20000 }, direct: { p10: 13000, p50: 20000, p90: 32000 }, mixed: { p10: 10000, p50: 16000, p90: 25000 } },
    },
    riskNotes: ["탄저병 치명적", "수확·건조 노동 매우 큼", "서리 민감", "가격 변동성"],
    additionalChecks: ["건조 시설", "병해충 방제 계획", "수확 인력"],
  },
  {
    cropId: "napa_cabbage", cropNameKo: "배추", cropNameEn: "Napa cabbage", category: "vegetable",
    cultivarGroups: [
      { groupId: "autumn", nameKo: "가을배추형", description: "김장철 출하 중심", tags: ["autumn"] },
      { groupId: "highland", nameKo: "고랭지형", description: "여름 고랭지 재배", tags: ["highland"] },
    ],
    requirements: { phMin: 6.0, phMax: 6.8, drainage: "medium", waterNeed: "high", coldTolerance: "medium", frostSensitivity: "medium", sunlightNeed: "high", laborNeed: "medium", suitableSlopeMaxDegree: 10 },
    economics: {
      plantingDensityPerM2: { p10: 2, p50: 2.5, p90: 3 },
      yieldKgPerM2ByYear: { year1: { p10: 6, p50: 8.5, p90: 11 }, mature: { p10: 6, p50: 8.5, p90: 11 } },
      costKrwPerM2: { p10: 1500, p50: 2500, p90: 4000 },
      priceKrwPerKg: { wholesale: { p10: 300, p50: 700, p90: 1500 }, direct: { p10: 800, p50: 1400, p90: 2500 }, mixed: { p10: 550, p50: 1000, p90: 1900 } },
    },
    riskNotes: ["가격 급등락 심함", "무름병/뿌리혹병", "기상 민감"],
    additionalChecks: ["관수 가능 여부", "출하 시기 분산", "계약재배"],
  },
  {
    cropId: "sesame", cropNameKo: "참깨", cropNameEn: "Sesame", category: "oilseed",
    cultivarGroups: [
      { groupId: "general", nameKo: "일반형", description: "착유·일반 판매", tags: ["general"] },
      { groupId: "processing", nameKo: "착유/가공형", description: "참기름 가공 중심", tags: ["processing"] },
    ],
    requirements: { phMin: 5.5, phMax: 7.0, drainage: "high", waterNeed: "low", coldTolerance: "low", frostSensitivity: "medium", sunlightNeed: "high", laborNeed: "medium", suitableSlopeMaxDegree: 12 },
    economics: {
      plantingDensityPerM2: { p10: 10, p50: 15, p90: 20 },
      yieldKgPerM2ByYear: { year1: { p10: 0.05, p50: 0.08, p90: 0.12 }, mature: { p10: 0.05, p50: 0.08, p90: 0.12 } },
      costKrwPerM2: { p10: 700, p50: 1300, p90: 2000 },
      priceKrwPerKg: { wholesale: { p10: 12000, p50: 16000, p90: 22000 }, direct: { p10: 18000, p50: 25000, p90: 35000 }, mixed: { p10: 14000, p50: 20000, p90: 28000 } },
    },
    riskNotes: ["단위면적 수확량 적음", "수확기 비 피해", "도복(쓰러짐)"],
    additionalChecks: ["건조 공간", "착유/가공 판로", "배수"],
  },
  {
    cropId: "perilla", cropNameKo: "들깨", cropNameEn: "Perilla", category: "oilseed",
    cultivarGroups: [
      { groupId: "low_labor", nameKo: "저관리형", description: "관리 부담을 낮추는 방향", tags: ["low_labor"] },
      { groupId: "oil_use", nameKo: "착유/가공형", description: "가공 판매를 고려하는 방향", tags: ["processing"] },
    ],
    requirements: { phMin: 5.5, phMax: 7.0, drainage: "medium", waterNeed: "low", coldTolerance: "medium", frostSensitivity: "medium", sunlightNeed: "high", laborNeed: "low", suitableSlopeMaxDegree: 12 },
    economics: {
      plantingDensityPerM2: { p10: 6, p50: 9, p90: 12 },
      yieldKgPerM2ByYear: { year1: { p10: 0.08, p50: 0.15, p90: 0.25 }, mature: { p10: 0.08, p50: 0.15, p90: 0.25 } },
      costKrwPerM2: { p10: 700, p50: 1300, p90: 2200 },
      priceKrwPerKg: { wholesale: { p10: 7000, p50: 10000, p90: 15000 }, direct: { p10: 10000, p50: 16000, p90: 24000 }, mixed: { p10: 8500, p50: 13000, p90: 19000 } },
    },
    riskNotes: ["단위면적 수익성 한계", "수확·건조 품질 관리", "판로 확보 필요"],
    additionalChecks: ["건조 공간", "가공/직거래 가능성", "지역 수매처"],
  },
  {
    cropId: "balloon_flower", cropNameKo: "도라지", cropNameEn: "Balloon flower", category: "medicinal",
    cultivarGroups: [
      { groupId: "two_year", nameKo: "2년근형", description: "단기 회수 중심", tags: ["short_cycle"] },
      { groupId: "multi_year", nameKo: "3년근 이상형", description: "고부가·약용 중심", tags: ["long_cycle"] },
    ],
    requirements: { phMin: 5.5, phMax: 6.5, drainage: "high", waterNeed: "low", coldTolerance: "high", frostSensitivity: "low", sunlightNeed: "medium", laborNeed: "high", suitableSlopeMaxDegree: 15 },
    economics: {
      plantingDensityPerM2: { p10: 30, p50: 45, p90: 60 },
      yieldKgPerM2ByYear: { year1: { p10: 0, p50: 0.1, p90: 0.3 }, year2: { p10: 0.4, p50: 0.7, p90: 1.0 }, year3: { p10: 0.7, p50: 1.0, p90: 1.4 }, mature: { p10: 0.7, p50: 1.0, p90: 1.4 } },
      costKrwPerM2: { p10: 2000, p50: 3500, p90: 5500 },
      priceKrwPerKg: { wholesale: { p10: 4000, p50: 6500, p90: 9000 }, direct: { p10: 8000, p50: 13000, p90: 20000 }, processed: { p10: 9000, p50: 15000, p90: 24000 }, mixed: { p10: 6000, p50: 10000, p90: 15000 } },
    },
    riskNotes: ["다년생 회수기간 김", "뿌리썩음병(배수 중요)", "수확 노동 큼", "판로 다변화 필요"],
    additionalChecks: ["배수·경사", "다년 점유 가능 여부", "가공/약용 판로"],
  },
  {
    cropId: "strawberry", cropNameKo: "딸기(시설)", cropNameEn: "Strawberry", category: "facility",
    cultivarGroups: [
      { groupId: "fresh", nameKo: "신선 출하형", description: "고품질 신선 판매", tags: ["fresh"] },
      { groupId: "experience", nameKo: "체험농장형", description: "체험·직판 중심", tags: ["experience"] },
    ],
    requirements: { phMin: 5.5, phMax: 6.5, drainage: "high", waterNeed: "high", coldTolerance: "low", frostSensitivity: "medium", sunlightNeed: "high", laborNeed: "high", facilityRecommended: true, suitableSlopeMaxDegree: 5 },
    economics: {
      plantingDensityPerM2: { p10: 6, p50: 8, p90: 10 },
      yieldKgPerM2ByYear: { year1: { p10: 2.5, p50: 4.0, p90: 5.5 }, mature: { p10: 2.5, p50: 4.0, p90: 5.5 } },
      costKrwPerM2: { p10: 15000, p50: 25000, p90: 38000 },
      priceKrwPerKg: { wholesale: { p10: 5000, p50: 8000, p90: 12000 }, direct: { p10: 10000, p50: 15000, p90: 22000 }, experience_farm: { p10: 15000, p50: 22000, p90: 30000 }, mixed: { p10: 9000, p50: 14000, p90: 20000 } },
    },
    riskNotes: ["시설 초기투자 매우 큼", "탄저병/흰가루병", "연중 노동 집중", "난방비"],
    additionalChecks: ["시설/하우스 보유 여부", "관수·양액 설비", "체험 입지(접근성)"],
  },
  {
    cropId: "apple", cropNameKo: "사과", cropNameEn: "Apple", category: "fruit",
    cultivarGroups: [
      { groupId: "cold_tolerant", nameKo: "내한성 우선 품종군", description: "겨울 저온 리스크 완화", tags: ["cold_tolerant"] },
      { groupId: "late_flowering", nameKo: "개화 지연형 품종군", description: "봄서리 리스크 완화", tags: ["frost_avoidance"] },
    ],
    requirements: { phMin: 5.5, phMax: 6.5, drainage: "high", waterNeed: "medium", coldTolerance: "high", frostSensitivity: "high", sunlightNeed: "high", laborNeed: "high", suitableSlopeMaxDegree: 12 },
    economics: {
      plantingDensityPerM2: { p10: 0.1, p50: 0.2, p90: 0.35 },
      yieldKgPerM2ByYear: { year1: { p10: 0, p50: 0, p90: 0.1 }, year2: { p10: 0.1, p50: 0.3, p90: 0.6 }, year3: { p10: 0.8, p50: 1.5, p90: 2.5 }, mature: { p10: 3.0, p50: 4.5, p90: 6.0 } },
      costKrwPerM2: { p10: 8000, p50: 16000, p90: 28000 },
      priceKrwPerKg: { wholesale: { p10: 1500, p50: 2800, p90: 4500 }, direct: { p10: 3000, p50: 5000, p90: 8000 }, mixed: { p10: 2200, p50: 3800, p90: 6000 } },
    },
    riskNotes: ["봄서리(개화기)", "초기 투자·결실까지 수년", "병해충 방제 빈번", "수확 노동 큼"],
    additionalChecks: ["토양검정서", "서리·저온 이력", "관수 가능 여부", "다년 점유"],
  },
  {
    cropId: "grape", cropNameKo: "포도", cropNameEn: "Grape", category: "fruit",
    cultivarGroups: [
      { groupId: "shine", nameKo: "샤인머스캣형", description: "고가 신선 판매 중심", tags: ["premium"] },
      { groupId: "campbell", nameKo: "캠벨/일반형", description: "대중 판매·가공", tags: ["general"] },
    ],
    requirements: { phMin: 6.0, phMax: 6.8, drainage: "high", waterNeed: "medium", coldTolerance: "medium", frostSensitivity: "high", sunlightNeed: "high", laborNeed: "high", facilityRecommended: true, suitableSlopeMaxDegree: 10 },
    economics: {
      plantingDensityPerM2: { p10: 0.1, p50: 0.15, p90: 0.25 },
      yieldKgPerM2ByYear: { year1: { p10: 0, p50: 0, p90: 0.1 }, year2: { p10: 0.2, p50: 0.5, p90: 1.0 }, year3: { p10: 1.0, p50: 1.8, p90: 2.8 }, mature: { p10: 2.0, p50: 3.0, p90: 4.0 } },
      costKrwPerM2: { p10: 10000, p50: 20000, p90: 35000 },
      priceKrwPerKg: { wholesale: { p10: 2000, p50: 4000, p90: 7000 }, direct: { p10: 5000, p50: 9000, p90: 16000 }, mixed: { p10: 3500, p50: 6500, p90: 12000 } },
    },
    riskNotes: ["시설(비가림) 권장", "봄서리·열과", "초기투자 큼", "노동 집약"],
    additionalChecks: ["비가림 시설", "토양검정서", "관수 설비", "다년 점유"],
  },
  {
    cropId: "blueberry", cropNameKo: "블루베리", cropNameEn: "Blueberry", category: "fruit",
    cultivarGroups: [
      { groupId: "cold_tolerant", nameKo: "내한성 우선 품종군", description: "겨울 최저기온 리스크를 줄이는 방향", tags: ["cold_tolerant"] },
      { groupId: "late_flowering", nameKo: "개화 지연형 품종군", description: "봄서리 리스크를 줄이는 방향", tags: ["frost_avoidance"] },
    ],
    requirements: { phMin: 4.2, phMax: 5.5, drainage: "high", waterNeed: "high", coldTolerance: "medium", frostSensitivity: "high", sunlightNeed: "high", laborNeed: "high", suitableSlopeMaxDegree: 8 },
    economics: {
      plantingDensityPerM2: { p10: 0.2, p50: 0.35, p90: 0.5 },
      yieldKgPerM2ByYear: { year1: { p10: 0, p50: 0.05, p90: 0.15 }, year2: { p10: 0.1, p50: 0.35, p90: 0.7 }, year3: { p10: 0.4, p50: 0.9, p90: 1.5 }, mature: { p10: 0.8, p50: 1.5, p90: 2.5 } },
      costKrwPerM2: { p10: 9000, p50: 18000, p90: 32000 },
      priceKrwPerKg: { wholesale: { p10: 5000, p50: 8000, p90: 12000 }, direct: { p10: 12000, p50: 18000, p90: 28000 }, experience_farm: { p10: 14000, p50: 22000, p90: 35000 }, processed: { p10: 8000, p50: 14000, p90: 22000 }, mixed: { p10: 9000, p50: 15000, p90: 24000 } },
    },
    riskNotes: ["토양 pH 필수 확인", "배수 불량 치명적", "초기 투자 높음", "봄서리", "관수 필요"],
    additionalChecks: ["토양검정서", "우기 후 배수 사진", "관수 가능 여부", "지역 재배 사례"],
  },

  /* ── 대표 식량작물(무료 티어용) — ⚠ 아래 수치는 데모 근사값. 실 RDA 소득자료·지역 시험성적으로 검증 필요(verified:false 취지). ── */
  {
    cropId: "rice", cropNameKo: "벼(쌀)", cropNameEn: "Rice", category: "field_crop",
    cultivarGroups: [
      { groupId: "early", nameKo: "조생종", description: "생육기간 짧음·조기 수확(태풍 회피)", tags: ["early"] },
      { groupId: "mid_late", nameKo: "중만생종", description: "수량·식미 중심 주력", tags: ["main_season"] },
    ],
    requirements: { phMin: 5.5, phMax: 6.5, drainage: "low", waterNeed: "high", coldTolerance: "medium", frostSensitivity: "medium", sunlightNeed: "high", laborNeed: "medium", suitableSlopeMaxDegree: 5 },
    economics: {
      plantingDensityPerM2: { p10: 18, p50: 22, p90: 27 },           // 이앙 포기/㎡(근사)
      yieldKgPerM2ByYear: { year1: { p10: 0.45, p50: 0.55, p90: 0.65 }, mature: { p10: 0.45, p50: 0.55, p90: 0.65 } }, // ≈500kg/10a
      costKrwPerM2: { p10: 600, p50: 900, p90: 1300 },
      priceKrwPerKg: { wholesale: { p10: 1800, p50: 2300, p90: 2900 }, direct: { p10: 2800, p50: 3500, p90: 4500 }, mixed: { p10: 2200, p50: 2800, p90: 3600 } },
    },
    riskNotes: ["용수·담수/물떼기 관리", "도복(쓰러짐)", "도열병·멸구류", "쌀값·수급 변동"],
    additionalChecks: ["용수 확보·배수 통제", "이앙 인력·기계", "건조·도정·보관", "공공비축·RPC 출하"],
  },
  {
    cropId: "barley", cropNameKo: "보리", cropNameEn: "Barley", category: "field_crop",
    cultivarGroups: [
      { groupId: "covered", nameKo: "겉보리", description: "사료·식용·정맥", tags: ["hulled"] },
      { groupId: "naked", nameKo: "쌀보리", description: "혼반용 식용 정맥", tags: ["naked"] },
    ],
    requirements: { phMin: 6.0, phMax: 7.0, drainage: "medium", waterNeed: "low", coldTolerance: "high", frostSensitivity: "low", sunlightNeed: "high", laborNeed: "low", suitableSlopeMaxDegree: 10 },
    economics: {
      plantingDensityPerM2: { p10: 300, p50: 400, p90: 500 },        // 조파/산파 본수/㎡(근사)
      yieldKgPerM2ByYear: { year1: { p10: 0.3, p50: 0.4, p90: 0.5 }, mature: { p10: 0.3, p50: 0.4, p90: 0.5 } }, // ≈350kg/10a
      costKrwPerM2: { p10: 400, p50: 600, p90: 900 },
      priceKrwPerKg: { wholesale: { p10: 1200, p50: 1700, p90: 2300 }, direct: { p10: 2000, p50: 2800, p90: 3800 }, mixed: { p10: 1500, p50: 2100, p90: 2900 } },
    },
    riskNotes: ["습해(배수 불량)", "도복", "붉은곰팡이병", "수발아·수급"],
    additionalChecks: ["가을 파종 적기", "배수 관리(이모작)", "벼 후작 일정", "건조·보관"],
  },
];

export function getCropProfile(cropId: string): CropProfile {
  const crop = CROP_PROFILES.find((item) => item.cropId === cropId);
  if (!crop) throw new Error(`Unknown cropId: ${cropId}`);
  return crop;
}

/**
 * 코어 한국작물 이름 집합 — LLM 가드레일 게이트용(외래 한정).
 *   왜: Perplexity AI 재배요약은 '외래·특수 작물'에만 허용한다(1원칙: 실 RDA/KAMIS 소득엔진이 있는
 *   코어작물엔 LLM 추정을 절대 노출하지 않음). /api/foreign에 코어작물명이 들어와도 LLM이 새지 않도록
 *   *엔드포인트 신뢰가 아니라 코드*로 닫는다(설계감사 P0). 한글 정식·괄호前 기본형·괄호內 이형(대두·쌀·건고추 등)·영문 모두 수록.
 */
const CORE_CROP_NAMES: Set<string> = (() => {
  const norm = (x: string) => x.replace(/\s+/g, "").toLowerCase();
  const set = new Set<string>();
  for (const c of CROP_PROFILES) {
    const ko = c.cropNameKo;
    set.add(norm(ko)); // "콩(대두)" 전체
    set.add(norm(ko.replace(/\(.*\)/, ""))); // 괄호前 기본형 "콩"
    const m = ko.match(/\(([^)]+)\)/); // 괄호內 이형 "대두"·"쌀"·"건고추"·"단옥수수"
    if (m) for (const t of m[1].split(/[/·,]/)) { const tt = norm(t); if (tt) set.add(tt); }
    if (c.cropNameEn) set.add(norm(c.cropNameEn)); // "Soybean"
  }
  set.delete("");
  return set;
})();

/** 입력명이 코어 한국작물(실 RDA/KAMIS 소득엔진 대상)인지 — true면 외래 전용 LLM 요약을 적용하면 안 된다(1원칙·코드 게이트). 정규화 후 정확일치. */
export function isCoreCropName(name: string): boolean {
  const n = name.replace(/\s+/g, "").toLowerCase();
  return n.length > 0 && CORE_CROP_NAMES.has(n);
}
