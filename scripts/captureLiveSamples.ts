/**
 * 실연동 샘플 캡처 — `.env`에 키를 넣고 실행하면 각 외부 API의 "원본 응답"을 `samples/`에 저장한다.
 *   목적: 추측 없이(=CLAUDE.md 불변식 #4) 파서를 완성하기 위함. 키 → 실제 응답 → 파서 설계/검증.
 *   실행:  npm run capture   (tsx)
 *   ⚠ 키 입력·실행은 운영자가 한다. 저장된 `samples/*`(키는 마스킹됨)를 공유하면 파서를 마무리한다.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { asosDailyUrl, nearestStation } from "../src/lansmark/geo/kma";
import { kamisDailyUrl } from "../src/lansmark/geo/kamis";

// .env 로더(의존성 0): `KEY=VALUE` 줄만 파싱(이미 셋된 값은 보존).
function loadDotenv(): void {
  const p = join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotenv();

const OUT = join(process.cwd(), "samples");
mkdirSync(OUT, { recursive: true });

const mask = (s: string) => s.replace(/((?:authKey|p_cert_key|p_cert_id|key)=)[^&\s]+/gi, "$1***"); // 저장물에 키 노출 방지
const save = (name: string, body: string) => { writeFileSync(join(OUT, name), body); console.log(`  ✔ samples/${name} (${body.length}B)`); };
const skip = (name: string, why: string) => console.log(`  – ${name} 건너뜀 — ${why}`);

/** 원본 응답을 헤더 주석(상태·마스킹된 URL)과 함께 반환. */
async function raw(url: string): Promise<string> {
  const r = await fetch(url);
  const head = `# HTTP ${r.status} ${r.statusText}\n# ${mask(url)}\n# captured ${new Date().toISOString()}\n\n`;
  return head + (await r.text());
}

// 테스트 좌표(전북 김제 평야 — 농경지)
const LAT = 35.80, LNG = 126.88;
const yyyymmdd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  console.log("LANSMARK 실연동 샘플 캡처 → samples/  (키 있는 통합만)");

  // 1) VWorld geocode (이미 구현됨 — 키로 실제 동작/응답형태 검증)
  const vk = process.env.VWORLD_API_KEY;
  if (vk) {
    const gu = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326&type=road&address=${encodeURIComponent("전북 김제시 시청로 1")}&format=json&key=${vk}`;
    try { save("vworld-geocode.json", await raw(gu)); } catch (e: any) { skip("vworld-geocode", e.message); }
    // 2) VWorld 필지경계 WFS
    const pu = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${vk}&domain=localhost&geomFilter=POINT(${LNG} ${LAT})&format=json&crs=EPSG:4326&size=1`;
    try { save("vworld-parcel.json", await raw(pu)); } catch (e: any) { skip("vworld-parcel", e.message); }
    // 3) VWorld DEM — URL 스펙 미확정(3D Data API). 공식 docs 확인 후 캡처 추가.
    skip("vworld-dem", "VWorld 3D Data API(DEM) 요청 URL 스펙 필요 — 공식 docs/샘플 제공 시 추가");
  } else skip("vworld-*", "VWORLD_API_KEY 없음");

  // 4) KMA ASOS 일자료(최근 35일) — 고정폭 텍스트 응답 형태 확보용
  const kk = process.env.KMA_API_KEY;
  if (kk) {
    const st = nearestStation(LAT, LNG);
    const end = new Date(), start = new Date(end.getTime() - 35 * 86400000);
    try { save("kma-asos.txt", await raw(asosDailyUrl(st.stn, yyyymmdd(start), yyyymmdd(end), kk))); console.log(`     (최근접 지점 ${st.name}/stn ${st.stn})`); }
    catch (e: any) { skip("kma-asos", e.message); }
  } else skip("kma-asos", "KMA_API_KEY 없음");

  // 5) KAMIS 일별 도매 — 응답 envelope/필드명 확보용(품목코드는 예시, 공식 코드표로 교체)
  const ck = process.env.KAMIS_API_KEY, ci = process.env.KAMIS_API_ID;
  if (ck && ci) {
    const end = new Date(), start = new Date(end.getTime() - 30 * 86400000);
    const u = kamisDailyUrl({ certKey: ck, certId: ci, category: "400", item: "411", start: isoDay(start), end: isoDay(end) }); // 411=예시(검증 전)
    try { save("kamis-sample.json", await raw(u)); } catch (e: any) { skip("kamis", e.message); }
  } else skip("kamis", "KAMIS_API_KEY/ID 없음");

  console.log("\n완료. samples/* 의 원본 응답(키 마스킹됨)을 공유하면, 추측 없이 파서를 마무리합니다.");
  console.log("미해결: VWorld DEM 요청 스펙, RDA 소득자료(공공데이터포털 'AMIS 농산물소득' 등) 원본.");
}

main().catch((e) => { console.error("capture 실패:", e?.message ?? e); process.exit(1); });
