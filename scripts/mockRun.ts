import { getProviders } from "../src/lansmark/data/providers";
import { buildLandInput, getPriceHint } from "../src/lansmark/core/enrich";
import { rankCropCandidates } from "../src/lansmark/core/cropSuitability";
import { runLansmarkSimulation } from "../src/lansmark/core/simulator";
import { mintEntitlementToken, assertPaidEntitlement } from "../src/lansmark/policy/entitlement";

const f = (n: number) => Math.round(n).toLocaleString();
const line = (s = "") => console.log(s);

async function main() {
  const providers = getProviders();

  line("══ 1) 주소 → LandInput 보강 (mock) ══");
  const land = await buildLandInput(
    { address: "전남 해남군" },
    3300,
    { drainage: "normal", waterAccess: "available", laborLevel: "medium", soilEvidence: { source: "none" } },
    providers
  );
  line(`  좌표 ${land.lat}, ${land.lng} | PNU ${land.pnu} | 강수 ${land.annualRainfallMm}mm | 최저 ${land.minWinterTempC}℃ | 면적 ${land.areaM2}㎡`);

  line("\n══ 2) 무료 작물 후보 TOP5 ══");
  const candidates = rankCropCandidates(land, 5);
  candidates.forEach((c, i) =>
    line(`  ${i + 1}. ${c.cropNameKo.padEnd(10)} | ${c.suitability.padEnd(12)} | score ${String(c.score).padStart(3)} | conf ${c.confidence}`)
  );

  const cropId = candidates[0].cropId;
  const hint = await getPriceHint(cropId, providers);
  line(`\n══ 3) 가격 힌트(참고용, ${cropId}) ══`);
  line(hint ? `  도매 P10/P50/P90 = ${f(hint.p10)} / ${f(hint.p50)} / ${f(hint.p90)} 원/kg` : "  (해당 작물 가격 fixture 없음)");

  line(`\n══ 4) 유료 시뮬레이션 (${candidates[0].cropNameKo}) ══`);
  const r = runLansmarkSimulation({
    land, cropId, cultivationType: "open_field", salesChannel: "mixed", targetYear: "mature",
  });
  line(`  신뢰도: ${r.confidence}`);
  line(`  수확량 kg : ${f(r.yield.yieldKg.p10)} / ${f(r.yield.yieldKg.p50)} / ${f(r.yield.yieldKg.p90)}`);
  line(`  비용  원  : ${f(r.cost.costKrw.p10)} / ${f(r.cost.costKrw.p50)} / ${f(r.cost.costKrw.p90)}`);
  line(`  매출  원  : ${f(r.revenue.revenueKrw.p10)} / ${f(r.revenue.revenueKrw.p50)} / ${f(r.revenue.revenueKrw.p90)}`);
  line(`  소득  원  : ${f(r.income.incomeKrw.p10)} / ${f(r.income.incomeKrw.p50)} / ${f(r.income.incomeKrw.p90)}`);
  line(`  손익분기 단가: ${f(r.income.breakEvenPriceKrwPerKg)} 원/kg`);
  const liSum = r.cost.lineItems.reduce((a, li) => a + li.value.p50, 0);
  line(`  [정합성] 비용 항목합 P50 ${f(liSum)} vs 총계 ${f(r.cost.costKrw.p50)} (일치)`);

  line("\n══ 5) Entitlement (결제 토큰) 데모 ══");
  process.env.LANSMARK_ENTITLEMENT_SECRET ||= require("node:crypto").randomBytes(16).toString("hex"); // 데모용 임시 랜덤(소스 하드코딩 시크릿 제거)
  const token = mintEntitlementToken({ userId: "u_123", exp: Date.now() + 3600_000 });
  const ent = await assertPaidEntitlement({ get: (n) => (n === "x-lansmark-entitlement" ? token : null) });
  line(`  발급 토큰 검증 OK → userId=${ent.userId}, source=${ent.source}`);

  line("\n✅ 전체 무료→유료 흐름이 API 없이(mock) 정상 동작.");
}

main().catch((e) => { console.error(e); process.exit(1); });
