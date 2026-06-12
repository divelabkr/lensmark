/**
 * 코어작물 LLM 가드레일 게이트(설계감사 P0) — isCoreCropName.
 *   /api/foreign의 Perplexity 'AI 재배요약'은 외래작물 한정. 실 RDA/KAMIS 소득엔진이 있는 코어 한국작물명이
 *   들어오면 LLM 호출 자체를 차단해야 1원칙(도메인사실 날조 금지)이 코드로 닫힌다. 이 스펙이 그 매칭을 고정한다.
 */
import { describe, it, expect } from "vitest";
import { isCoreCropName } from "../data/crops.seed";

describe("coreCropGate / isCoreCropName (P0 — 외래 한정 LLM 게이트)", () => {
  it("코어작물 한글 정식명 → true", () => {
    for (const n of ["사과", "배추", "마늘", "양파", "감자", "고구마", "참깨", "들깨", "도라지", "포도", "블루베리", "보리"])
      expect(isCoreCropName(n), n).toBe(true);
  });
  it("괄호 이형·기본형(콩/대두·벼/쌀·고추/건고추·옥수수/단옥수수·딸기) → true", () => {
    for (const n of ["콩", "대두", "콩(대두)", "벼", "쌀", "고추", "건고추", "옥수수", "단옥수수", "딸기"])
      expect(isCoreCropName(n), n).toBe(true);
  });
  it("영문명·대소문자·공백 무시 → true", () => {
    for (const n of ["Apple", "apple", "GARLIC", " 사과 ", "  Potato"])
      expect(isCoreCropName(n), n).toBe(true);
  });
  it("외래·특수 작물 → false (AI 요약 허용 대상)", () => {
    for (const n of ["망고", "올리브", "두리안", "아보카도", "Mango", "Olea europaea", "용과", "패션프루트"])
      expect(isCoreCropName(n), n).toBe(false);
  });
  it("빈 입력·공백 → false", () => {
    for (const n of ["", "   ", "\t"]) expect(isCoreCropName(n), JSON.stringify(n)).toBe(false);
  });
});
