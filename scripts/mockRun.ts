import { getProviders } from "../src/lansmark/data/providers";
import { buildLandInput, getPriceHint } from "../src/lansmark/core/enrich";
import { rankCropCandidates } from "../src/lansmark/core/cropSuitability";
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

  line(`\n══ 4) 유료 정밀 시뮬 ══`);
  line(`  (캐노니컬 엔진 core/parcelSimulator.ts — 실 흐름은 POST /api/simulate로 실행/검증. 레거시 데모 엔진은 v0.76.7 제거)`);

  line("\n══ 5) Entitlement (결제 토큰) 데모 ══");
  process.env.LANSMARK_ENTITLEMENT_SECRET ||= require("node:crypto").randomBytes(16).toString("hex"); // 데모용 임시 랜덤(소스 하드코딩 시크릿 제거)
  const token = mintEntitlementToken({ userId: "u_123", exp: Date.now() + 3600_000 });
  const ent = await assertPaidEntitlement({ get: (n) => (n === "x-lansmark-entitlement" ? token : null) });
  line(`  발급 토큰 검증 OK → userId=${ent.userId}, source=${ent.source}`);

  line("\n✅ 전체 무료→유료 흐름이 API 없이(mock) 정상 동작.");
}

main().catch((e) => { console.error(e); process.exit(1); });
