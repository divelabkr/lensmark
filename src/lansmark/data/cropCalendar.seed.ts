/**
 * 작물별 연간 작기 캘린더 (illustrative — 지역·품종별 보정 필요).
 * 월은 1~12. perennial(과수)은 개화/수확 중심의 연간 사이클.
 */
export interface CropCalendar {
  cropId: string;
  sow?: number[];      // 파종/정식
  bloom?: number[];    // 개화
  harvest: number[];   // 수확
  care?: { month: number; label: string }[];
  note?: string;
}

export const CROP_CALENDARS: Record<string, CropCalendar> = {
  sweet_potato:  { cropId:"sweet_potato", sow:[5], harvest:[9,10], care:[{month:6,label:"순지르기·제초"}] },
  potato:        { cropId:"potato", sow:[3,4], harvest:[6,7], care:[{month:5,label:"북주기·방제"}] },
  soybean:       { cropId:"soybean", sow:[6], harvest:[10,11], care:[{month:8,label:"노린재 방제"}] },
  corn:          { cropId:"corn", sow:[4,5], harvest:[7,8], care:[{month:6,label:"추비·방제"}] },
  garlic:        { cropId:"garlic", sow:[9,10], harvest:[6], note:"가을 파종 → 이듬해 6월 수확", care:[{month:3,label:"웃거름"}] },
  onion:         { cropId:"onion", sow:[10,11], harvest:[6], note:"가을 정식 → 이듬해 6월 수확", care:[{month:3,label:"웃거름·관수"}] },
  chili_pepper:  { cropId:"chili_pepper", sow:[5], harvest:[8,9,10], care:[{month:7,label:"탄저병 방제"}] },
  napa_cabbage:  { cropId:"napa_cabbage", sow:[8], harvest:[11], care:[{month:9,label:"결구 관리·방제"}] },
  sesame:        { cropId:"sesame", sow:[5,6], harvest:[9], care:[{month:7,label:"도복·병해 관리"}] },
  perilla:       { cropId:"perilla", sow:[6,7], harvest:[10], care:[{month:8,label:"적심·제초"}] },
  balloon_flower:{ cropId:"balloon_flower", sow:[3,4], harvest:[10,11], note:"2~3년근 수확", care:[{month:6,label:"제초·배수 관리"}] },
  strawberry:    { cropId:"strawberry", sow:[9], harvest:[12,1,2,3,4,5], note:"시설 촉성 — 겨울~봄 수확", care:[{month:11,label:"보온·관수"}] },
  apple:         { cropId:"apple", bloom:[4,5], harvest:[9,10], care:[{month:6,label:"적과"},{month:7,label:"방제"}] },
  grape:         { cropId:"grape", bloom:[5,6], harvest:[8,9], care:[{month:7,label:"송이 관리·방제"}] },
  blueberry:     { cropId:"blueberry", bloom:[4], harvest:[6,7], care:[{month:5,label:"관수·조류 대비"}] },
  rice:          { cropId:"rice", sow:[5,6], harvest:[9,10], note:"이앙 → 가을 수확", care:[{month:7,label:"중간물떼기·방제"}] },
  barley:        { cropId:"barley", sow:[10,11], harvest:[6], note:"가을 파종 → 이듬해 6월 수확(맥류)", care:[{month:3,label:"웃거름·답압"}] },
};

export function getCropCalendar(cropId: string): CropCalendar | null {
  return CROP_CALENDARS[cropId] ?? null;
}
