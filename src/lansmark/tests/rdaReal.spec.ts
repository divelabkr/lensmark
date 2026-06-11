/**
 * RDA 실자료 파이프라인 — CSV 파싱·검증·폭 유도·실값 우선 적용 검증(자료 받는 날 무사고 전환 보장).
 */
import { describe, it, expect } from "vitest";
import { parseRdaCsv, baseFromReal } from "../data/rdaRealLoader";
import { getRdaBase } from "../data/rdaIncome";

const HEAD = "cropId,baseYear,yield_p50,yield_p10,yield_p90,cost_p50,cost_p10,cost_p90,price_p50,price_p10,price_p90,source";

describe("parseRdaCsv — 검증·폭 유도", () => {
  it("정상 행 파싱 + p10/p90 모두 있으면 그대로(폭 추정 표기 없음)", () => {
    const rows = parseRdaCsv(`${HEAD}\nsweet_potato,2024,1800,1300,2400,2800000,2200000,3500000,1400,900,2200,농진청 소득조사`);
    expect(rows).toHaveLength(1);
    expect(rows[0].yieldKgPer10a).toEqual({ p10: 1300, p50: 1800, p90: 2400 });
    expect(rows[0].source).not.toContain("폭 추정");
  });
  it("p10/p90 빈칸 → 보수적 폭 유도 + '(일부 폭 추정)' 정직 표기", () => {
    const rows = parseRdaCsv(`${HEAD}\npotato,2024,3000,,,2500000,,,1100,,,농진청 소득조사`);
    const r = rows[0];
    expect(r.yieldKgPer10a.p10).toBe(Math.round(3000 * 0.75));
    expect(r.yieldKgPer10a.p90).toBe(Math.round(3000 * 1.3));
    expect(r.operatingCostPer10aKrw.p10).toBe(Math.round(2500000 * 0.8)); // 비용은 ±20%
    expect(r.source).toContain("일부 폭 추정");
  });
  it("인용(\") 셀 거부 + 컬럼 수 불일치 거부(시프트 오염 차단·M5)", () => {
    expect(() => parseRdaCsv(`${HEAD}\nsoybean,2024,"1,200",,,1900000,,,4500,,,소득조사`)).toThrow(/인용/);
    expect(() => parseRdaCsv(`${HEAD}\nsoybean,2024,1200,,,1900000,,,4500,소득조사`)).toThrow(/컬럼 수/); // 셀 누락=시프트
    const rows = parseRdaCsv(`${HEAD}\nsoybean,2024,1200,,,1900000,,,4500,,,소득조사`); // 따옴표 없는 큰 숫자는 정상
    expect(rows[0].operatingCostPer10aKrw.p50).toBe(1900000);
  });
  it("미등록 cropId·중복·연도 비정상·p50=0 거부(줄번호 포함)", () => {
    expect(() => parseRdaCsv(`${HEAD}\nbanana,2024,1,,,1,,,1,,,x`)).toThrow(/알 수 없는 cropId/);
    expect(() => parseRdaCsv(`${HEAD}\npotato,2024,1,,,1,,,1,,,x\npotato,2024,1,,,1,,,1,,,x`)).toThrow(/중복/);
    expect(() => parseRdaCsv(`${HEAD}\npotato,1999,1,,,1,,,1,,,x`)).toThrow(/baseYear/);
    expect(() => parseRdaCsv(`${HEAD}\npotato,2024,0,,,1,,,1,,,x`)).toThrow(/0보다/);
  });
  it("필수 컬럼 누락 거부", () => {
    expect(() => parseRdaCsv("cropId,baseYear\npotato,2024")).toThrow(/필수 컬럼/);
  });
});

describe("baseFromReal — 실값 변환(verified·연도·출처)", () => {
  it("verified=true + baseYear + 출처에 연도 병기", () => {
    const [row] = parseRdaCsv(`${HEAD}\nsweet_potato,2024,1800,1300,2400,2800000,2200000,3500000,1400,900,2200,농진청 소득조사`);
    const b = baseFromReal(row, "고구마");
    expect(b.verified).toBe(true);
    expect(b.baseYear).toBe(2024);
    expect(b.source).toContain("2024년 기준");
    expect(b.yieldKgPer10a.p50).toBe(1800);
  });
});

describe("getRdaBase — 실자료(2024) 적재 + 미수록 작물 데모 폴백", () => {
  it("적재 작물(고구마) → verified=true · 실 출처·기준연도 2024", () => {
    const b = getRdaBase("sweet_potato"); // RDA_REAL에 있음(소득조사 2024)
    expect(b.verified).toBe(true);
    expect(b.source).toContain("농진청 농산물소득조사");
    expect(b.baseYear).toBe(2024);
  });
  it("미수록 작물(rice — 미곡 별도조사) → verified=false·데모 폴백(기존 동작 유지)", () => {
    const b = getRdaBase("rice"); // RDA_REAL에 없음 → 데모
    expect(b.verified).toBe(false);
    expect(b.source).toContain("데모");
    expect(b.baseYear).toBeUndefined();
  });
});

describe("getRdaBase — 지역(도) 오버라이드 + 시도명 정규화 + 폴백", () => {
  it("적재 도(블루베리 전남)는 그 도 실값 — 전체 시도명/2자 코드 모두 정규화", () => {
    const full = getRdaBase("blueberry", "전라남도");
    const short = getRdaBase("blueberry", "전남");
    expect(full.yieldKgPer10a.p50).toBe(630);                 // 전남 실값(전국 491과 다름)
    expect(full.verified).toBe(true);
    expect(full.source).toContain("지역별");
    expect(full.source).toContain("전남");
    expect(short.yieldKgPer10a).toEqual(full.yieldKgPer10a);  // 전남 == 전라남도(정규화)
  });
  it("미조사 도(블루베리 제주)·미지원 형식 → 전국 base 폴백", () => {
    const nat = getRdaBase("blueberry");
    expect(getRdaBase("blueberry", "제주특별자치도").yieldKgPer10a).toEqual(nat.yieldKgPer10a); // 블루베리 제주 미조사 → 전국
    expect(getRdaBase("blueberry", "제주특별자치도").source).not.toContain("지역별");
    expect(getRdaBase("blueberry", "엉뚱지역").yieldKgPer10a).toEqual(nat.yieldKgPer10a);        // 미지원 형식 → 전국
  });
});
