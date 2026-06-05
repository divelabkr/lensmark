/**
 * KMA 기상특보(live) — URL 빌더·파서·지역매칭. 합성 행은 '실캡처로 검증된 포맷'(help=1 공식 범례 + wrn_reg 실데이터 행포맷)으로 구성.
 *   값(종류·수준)은 KMA 원문 패스스루(임의 해석 안 함). 캡처 시점 발효 0건이라 활성 행은 문서 포맷으로 합성해 고정.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { warningNowUrl, warningRegionUrl, kmaWarningConfigured, fetchActiveWarnings, parseWarnings, parseWarningRegions, warningsForRegion } from "../integrations/kmaWarning";

// 실캡처 헤더(#) + 문서 포맷 데이터행 2건(REG_UP REG_UP_KO REG_ID REG_KO TM_FC TM_EF WRN LVL CMD ED_TM)
const WRN_NOW = [
  "#START7777",
  "#  특보현황 조회",
  "# REG_UP  REG_UP_KO  REG_ID  REG_KO  TM_FC  TM_EF  WRN  LVL  CMD  ED_TM",
  "L1010000 강원 L1010100 강릉 202606050900 202606051000 호우 경보 발표 -",
  "L1100000 서울 L1100600 서울 202606050800 202606051100 강풍 주의보 발표 -",
  "L9000000 경남 L9001000 창원 202606050900 202606051000 호우 경보 발표 -",   // 5개 도 약칭(레드팀 H)
  "L1010000 경기 L1010400 광주 202606050800 202606051100 강풍 주의보 발표 -", // 경기 광주시(동명·과매칭 레드팀 M)
  "#7777END",
].join("\n");
// 실캡처 wrn_reg 행포맷(REG_ID TM_ST TM_ED REG_SP REG_UP REG_KO REG_NAME)
const WRN_REG = [
  "#START7777",
  "# REG_ID TM_ST TM_ED REG_SP REG_UP REG_KO REG_NAME",
  "L1010100 200507010000 210012310000 00000013 L1010000 강릉 강릉시",
  "L1100600 200507010000 210012310000 00000013 L1100000 서울 서울특별시",
  "#7777END",
].join("\n");

describe("KMA 기상특보 URL·설정", () => {
  it("URL 빌더: typ01 경로·authKey 인코딩", () => {
    expect(warningNowUrl("AUTH KEY", { help: 1 })).toContain("apihub.kma.go.kr/api/typ01/url/wrn_now_data.php");
    expect(warningNowUrl("AUTH KEY")).toContain("authKey=AUTH%20KEY");
    expect(warningRegionUrl("k")).toContain("wrn_reg.php");
  });
  it("키 게이트", () => { delete process.env.KMA_API_KEY; expect(kmaWarningConfigured()).toBe(false); });
});

describe("parseWarnings (현재 발효 특보)", () => {
  it("데이터행 파싱 + 값 패스스루(종류·수준)", () => {
    const w = parseWarnings(WRN_NOW);
    expect(w.length).toBe(4);
    expect(w[0]).toMatchObject({ regId: "L1010100", regKo: "강릉", regUpKo: "강원", kind: "호우", level: "경보", cmd: "발표" });
    expect(w[1]).toMatchObject({ regKo: "서울", kind: "강풍", level: "주의보" });
  });
  it("발효 0건(범례만) → 빈 배열 · #주석/짧은 행 무시", () => {
    expect(parseWarnings("#START7777\n#  특보현황 조회\n#7777END")).toEqual([]);
    expect(parseWarnings("")).toEqual([]);
  });
});

describe("parseWarningRegions (구역코드 맵)", () => {
  it("REG_ID → 구역명", () => {
    const m = parseWarningRegions(WRN_REG);
    expect(m.size).toBe(2);
    expect(m.get("L1010100")).toEqual({ regKo: "강릉", regName: "강릉시" });
  });
});

describe("warningsForRegion (지역 매칭)", () => {
  const w = parseWarnings(WRN_NOW);
  it("시도 약칭 매핑(레드팀 H: 5개 도)·상위구역 정확매칭(레드팀 M: 동명 과매칭 차단)", () => {
    expect(warningsForRegion(w, "강원도").map((x) => x.kind)).toContain("호우");   // 강원도→강원(regUpKo)
    expect(warningsForRegion(w, "강릉시").map((x) => x.kind)).toContain("호우");   // 강릉시→강릉(regKo)
    expect(warningsForRegion(w, "서울특별시").map((x) => x.kind)).toContain("강풍");
    // H: 도(道) 전체명 약칭 매핑 — 접미사 제거로는 실패하던 경상남도→경남(regUpKo) 매칭
    expect(warningsForRegion(w, "경상남도").map((x) => x.kind)).toContain("호우");
    // M: 광주광역시는 regUpKo='광주' 특보만 — 경기 광주시(regUpKo=경기·regKo=광주)는 과매칭 안 됨
    expect(warningsForRegion(w, "광주광역시")).toEqual([]);
    expect(warningsForRegion(w, "제주")).toEqual([]);                              // 매칭 없음
    expect(warningsForRegion(w, "")).toEqual([]);
  });
});

describe("fetchActiveWarnings 키 게이트", () => {
  const saved = process.env.KMA_API_KEY;
  beforeEach(() => { delete process.env.KMA_API_KEY; });
  afterEach(() => { if (saved === undefined) delete process.env.KMA_API_KEY; else process.env.KMA_API_KEY = saved; });
  it("키 없으면 [] (호출 안 함)", async () => { expect(await fetchActiveWarnings()).toEqual([]); });
});
