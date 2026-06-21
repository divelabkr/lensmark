/**
 * explainSmoke — AI 근거설명 seam 로컬 스모크/캡처 도구(키+네트워크 있는 곳에서 실행).
 *   목적: ANTHROPIC_API_KEY를 .env에 넣은 뒤 'live 응답이 실제로 오는가 + 출력가드를 통과하는가'를 1회 확인.
 *         이게 'verified 승격'의 첫 단계(실응답 1건 캡처) — 출력 텍스트를 보고 출력가드를 보정한다.
 *   보안: 키 '값'은 절대 출력하지 않는다(존재 여부·접두사 형태만). 네트워크 차단 환경에선 fetch 실패→null(무중단).
 *   실행: (맥북 repo 루트, .env에 키 채운 뒤)  npx tsx scripts/explainSmoke.ts
 */
import { buildExplainMessages, fetchExplanation, explainConfigured } from "../src/lansmark/integrations/explain";

// 샘플 입력 — 엔진이 산출했다고 가정한 값(설명 대상). 실제 숫자는 결정적 엔진에서 옴.
const sample = {
  cropNameKo: "사과",
  region: "경상북도",
  income: { p10: 5_000_000, p50: 12_000_000, p90: 19_000_000 },
  reasons: ["토양 pH 적정", "겨울 최저 −8℃ — 내한 경계"],
  climateFacts: ["연평균기온 12.3℃", "적산온도 2840℃·일"],
  sources: ["농진청 농산물소득조사 2024", "KAMIS 시세"],
};

async function main() {
  const k = process.env.ANTHROPIC_API_KEY;
  console.log("── AI 설명 스모크 ──");
  console.log("키 존재:", explainConfigured(), k ? `(접두사 ${k.slice(0, 3)}…·값 비표시)` : "(키 없음)");

  if (!explainConfigured()) {
    console.log("\n⚠ 키 없음 → 라이브 호출 생략. .env의 ANTHROPIC_API_KEY를 채운 뒤 다시 실행하세요.");
    console.log("  (참고: 아래는 Claude에게 보낼 결정적 프롬프트 — 숫자는 엔진값만 들어감)");
    const { system, user } = buildExplainMessages(sample);
    console.log("\n[system]\n" + system + "\n\n[user]\n" + user);
    return;
  }

  console.log("\n라이브 호출 중(최대 15초)…");
  const t0 = Date.now();
  const out = await fetchExplanation(sample);
  const ms = Date.now() - t0;

  if (!out) {
    console.log(`\n❌ 응답 null (${ms}ms) — 네트워크 차단/타임아웃/거부, 또는 출력가드가 폐기(날조 금액·URL).`);
    console.log("  네트워크 되는 곳에서 재시도. 계속 null이면 키/네트워크 점검.");
    return;
  }

  console.log(`\n✅ 실응답 채택됨 (${ms}ms · model=${out.model}) — 출력가드(금액·URL 날조) 통과.`);
  console.log("─ 설명 본문(이 텍스트를 Claude에게 붙여주면 출력가드 보정 가능·키는 빼고) ─\n");
  console.log(out.text);
  console.log("\n─ 출처(우리가 부착, Claude가 만들지 않음) ─");
  console.log(out.sources.join(" · "));
  console.log("\n다음: 이 본문에 '엔진이 안 준 숫자/보장 표현'이 있는지 함께 보고 → 없으면 verified 승격.");
}

main().catch((e) => { console.error("스모크 오류:", e?.message ?? e); process.exit(1); });
