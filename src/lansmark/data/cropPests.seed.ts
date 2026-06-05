/** 작물별 주요 병해충 (illustrative — 지역·연도별 발생 차이 큼, 농진청 데이터로 보정). */
export interface PestEntry { name: string; type: "disease" | "insect"; season: string; action: string; }

export const CROP_PESTS: Record<string, PestEntry[]> = {
  sweet_potato:  [{name:"무름병",type:"disease",season:"수확·저장기",action:"배수·상처 최소화·저장환기"},{name:"굼벵이",type:"insect",season:"여름",action:"토양살충·윤작"}],
  potato:        [{name:"역병",type:"disease",season:"장마기",action:"예방적 방제·배수"},{name:"진딧물",type:"insect",season:"봄",action:"초기 방제·바이러스 매개 차단"}],
  soybean:       [{name:"노린재",type:"insect",season:"8~9월 협비대기",action:"적기 방제"},{name:"불마름병",type:"disease",season:"여름",action:"건전종자·윤작"}],
  corn:          [{name:"멸강나방",type:"insect",season:"초여름",action:"예찰·발생초기 방제"},{name:"깨씨무늬병",type:"disease",season:"여름",action:"저항성품종·방제"}],
  garlic:        [{name:"잎마름병",type:"disease",season:"봄",action:"예방방제·배수"},{name:"흑색썩음균핵병",type:"disease",season:"생육후기",action:"윤작·토양소독"}],
  onion:         [{name:"노균병",type:"disease",season:"봄 다습기",action:"예방방제·통풍"},{name:"고자리파리",type:"insect",season:"정식초기",action:"토양처리"}],
  chili_pepper:  [{name:"탄저병",type:"disease",season:"장마~여름",action:"예방방제 필수·강우 후 약제"},{name:"담배나방",type:"insect",season:"여름",action:"적기 방제"}],
  napa_cabbage:  [{name:"무름병",type:"disease",season:"결구기·고온다습",action:"배수·질소과용 금지"},{name:"배추좀나방",type:"insect",season:"가을",action:"예찰·교호방제"}],
  sesame:        [{name:"시들음병",type:"disease",season:"여름",action:"윤작·배수"},{name:"진딧물",type:"insect",season:"생육기",action:"초기 방제"}],
  perilla:       [{name:"녹병",type:"disease",season:"늦여름~가을",action:"통풍·예방방제"},{name:"진딧물",type:"insect",season:"생육기",action:"초기 방제"}],
  balloon_flower:[{name:"뿌리썩음병",type:"disease",season:"장마·과습",action:"배수 최우선·이병주 제거"},{name:"점무늬병",type:"disease",season:"여름",action:"통풍·방제"}],
  strawberry:    [{name:"흰가루병",type:"disease",season:"시설 저온건조",action:"환기·예방방제"},{name:"점박이응애",type:"insect",season:"연중(시설)",action:"천적·약제 교호"}],
  apple:         [{name:"갈색무늬병",type:"disease",season:"여름 강우기",action:"예방방제·낙엽 제거"},{name:"사과응애",type:"insect",season:"여름",action:"예찰·적기 방제"},{name:"심식나방",type:"insect",season:"6~8월",action:"봉지·교미교란"}],
  grape:         [{name:"노균병",type:"disease",season:"강우 후",action:"예방방제·비가림"},{name:"갈색무늬병",type:"disease",season:"여름",action:"통풍·방제"}],
  blueberry:     [{name:"미라병",type:"disease",season:"개화~결실기",action:"이병과 제거·예방방제"},{name:"응애",type:"insect",season:"여름",action:"예찰·약제"}],
  rice:          [{name:"도열병",type:"disease",season:"출수·장마기",action:"질소과용 금지·예방방제"},{name:"벼멸구",type:"insect",season:"7~8월",action:"비래 예찰·발생초기 방제"},{name:"잎집무늬마름병",type:"disease",season:"여름 다습",action:"통풍·적기 방제"}],
  barley:        [{name:"붉은곰팡이병",type:"disease",season:"출수·개화기 강우",action:"개화기 방제·수확 후 건조"},{name:"흰가루병",type:"disease",season:"봄",action:"통풍·예방방제"}],
};

export function getCropPests(cropId: string): PestEntry[] {
  return CROP_PESTS[cropId] ?? [];
}
