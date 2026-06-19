/**
 * explainUxProbe — AI 설명의 'UX 품질'을 여러 시나리오로 라이브 점검(설명은 화면 미노출 → 응답 텍스트가 곧 UX).
 *   점검축: 본문 톤(추정·범위·과신 금지)·가독성(문장수·길이)·면책 환기·엣지(좁은범위·빈약근거·이상치) 대응 일관성.
 *   자동 체크는 보조 신호 — 최종 판단은 본문을 사람이 읽고. 보안: 키 '값' 비표시.
 *   실행: npx tsx --env-file=.env scripts/explainUxProbe.ts
 */
import { fetchExplanation, explainConfigured, type ExplainInput } from "../src/lansmark/integrations/explain";

const scenarios: { name: string; input: ExplainInput }[] = [
  { name: "정상(딸기·충남)", input: { cropNameKo: "딸기", region: "충청남도", income: { p10: 8_000_000, p50: 15_000_000, p90: 24_000_000 }, reasons: ["시설 재배 적합", "겨울 일조 충분"], climateFacts: ["연평균기온 13.1℃", "겨울 일조시간 양호"], sources: ["농진청 농산물소득조사 2024", "KAMIS 시세"] } },
  { name: "좁은 범위(불확실성↓)", input: { cropNameKo: "배추", region: "강원도", income: { p10: 9_500_000, p50: 10_000_000, p90: 10_500_000 }, reasons: ["고랭지 적지"], climateFacts: ["여름 서늘"], sources: ["농진청 농산물소득조사 2024"] } },
  { name: "넓은범위+저소득(위험↑)", input: { cropNameKo: "고추", region: "경상남도", income: { p10: 1_000_000, p50: 6_000_000, p90: 18_000_000 }, reasons: ["병해충 변동 큼", "가격 변동성 큼"], climateFacts: ["여름 고온다습"], sources: ["농진청 농산물소득조사 2024", "KAMIS 시세"] } },
  { name: "빈약한 근거(정보 적음)", input: { cropNameKo: "참깨", region: "전라북도", income: { p10: 2_000_000, p50: 3_500_000, p90: 5_000_000 }, reasons: [], climateFacts: [], sources: ["농진청 농산물소득조사 2024"] } },
  { name: "이상치(p10>p90·변조)", input: { cropNameKo: "마늘", region: "전라남도", income: { p10: 20_000_000, p50: 12_000_000, p90: 5_000_000 }, reasons: ["입력 순서 비정상"], climateFacts: ["연평균기온 14.2℃"], sources: ["농진청 농산물소득조사 2024"] } },
];

// 보조 신호(휴먼 판단 보강) — 문장수·길이·면책·헤징(추정 톤)·과신 단정.
function uxChecks(text: string) {
  const sentences = text.split(/[.!?。]\s+|\n+/).filter((s) => s.trim().length > 3);
  const hasDisclaimer = /보장|보증/.test(text);                                   // 보통 '보장이 아님' 환기
  const hedging = (text.match(/추정|범위|정도|보입니다|편|수 있|예상|가량|가능성|나타날/g) || []).length;
  const overclaim = /반드시|확실히|틀림없|무조건|보장합니다|보장해|100%/.test(text); // 단정·보장 = 가드레일 위반
  return { sentenceCount: sentences.length, chars: text.length, hasDisclaimer, hedging, overclaim };
}

async function main() {
  console.log("── AI 설명 UX 프로브(라이브) ──");
  console.log("키 존재:", explainConfigured(), "\n");
  if (!explainConfigured()) { console.log("⚠ 키 없음 → .env에 ANTHROPIC_API_KEY 채운 뒤 재실행."); return; }

  for (const sc of scenarios) {
    const { p10, p50, p90 } = sc.input.income;
    console.log(`### ${sc.name}`);
    console.log(`입력 소득(원): ${p10.toLocaleString()} / ${p50.toLocaleString()} / ${p90.toLocaleString()} · 근거 ${sc.input.reasons.length}개 · 기후 ${sc.input.climateFacts.length}개`);
    const out = await fetchExplanation(sc.input);
    if (!out) { console.log("→ ❌ 폐기(null) — 출력가드 또는 네트워크\n"); continue; }
    const c = uxChecks(out.text);
    console.log(`→ 채택 · 문장 ${c.sentenceCount} · ${c.chars}자 · 면책 ${c.hasDisclaimer ? "✓" : "✗"} · 헤징 ${c.hedging} · 과신 ${c.overclaim ? "⛔ 있음" : "✓ 없음"}`);
    console.log("본문:", out.text.replace(/\s+/g, " "));
    console.log();
  }
}
main().catch((e) => { console.error("UX 프로브 오류:", e?.message ?? e); process.exit(1); });
