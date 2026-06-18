/**
 * 외부연동(HUMAN GATE) seam — 오프라인 검증(네트워크·실키 불필요).
 *   URL 빌더(문서 기준)·키게이트(키 없으면 호출 안 함)·파서 차단(SHAPE_UNVERIFIED)·스케줄러(기본 off)·현황 집계.
 *   ⚠ 실응답 파싱은 키 확보 후 별도(추측 금지) — 여기선 '준비층'의 정직성만 고정한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hasEnv, ShapeUnverifiedError } from "../integrations/types";
import { ncpmsUrl, SERVICE_CODE, ncpmsConfigured, fetchNcpmsSample, parseNcpms, parseNcpmsPestList } from "../integrations/ncpms";
import { ngsUrl, nongsaroConfigured, fetchNongsaroSample, parseNongsaro } from "../integrations/nongsaro";
import { perenualSpeciesListUrl, trefleSearchUrl, plantDetailConfigured, fetchPerenualSample, parsePlantDetail } from "../integrations/plantDetail";
import { withServiceKey, publicSupportConfigured, fetchSupportSample, parsePublicSupport } from "../integrations/publicSupport";
import { ConsolePushSender, vapidConfigured, createPushSender } from "../integrations/push";
import { MonitorScheduler } from "../integrations/scheduler";
import { listIntegrations, monitorCronEnabled } from "../integrations/index";

// env를 결정적으로 통제(앰비언트 .env에 영향받지 않게) — 통합 키 전부 비우고 복원.
const KEYS = ["KMA_API_KEY", "NCPMS_API_KEY", "NONGSARO_API_KEY", "PERENUAL_API_KEY", "TREFLE_TOKEN", "DATA_GO_KR_SERVICE_KEY",
  "LANSMARK_VAPID_PUBLIC_KEY", "LANSMARK_VAPID_PRIVATE_KEY", "LANSMARK_MONITOR_CRON"];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("integrations/types", () => {
  it("hasEnv: 모든 이름이 비어있지 않을 때만 true", () => {
    expect(hasEnv("KMA_API_KEY")).toBe(false);
    process.env.KMA_API_KEY = "x";
    expect(hasEnv("KMA_API_KEY")).toBe(true);
    process.env.KMA_API_KEY = "   "; // 공백=미설정
    expect(hasEnv("KMA_API_KEY")).toBe(false);
    expect(hasEnv()).toBe(false); // 인자 없음=false
  });
  it("ShapeUnverifiedError: 통합ID·힌트 포함", () => {
    const e = new ShapeUnverifiedError("ncpms", "힌트");
    expect(e).toBeInstanceOf(Error);
    expect(e.integration).toBe("ncpms");
    expect(e.message).toMatch(/SHAPE_UNVERIFIED\[ncpms\]/);
  });
});

// KMA 기상특보는 live 승격됨 → 전용 테스트는 kmaWarning.spec.ts (실파서·지역매칭).

describe("NCPMS seam", () => {
  it("URL 빌더: npmsAPI/service·apiKey·serviceCode", () => {
    const u = ncpmsUrl("KEY", SERVICE_CODE.PEST_DETAIL, { sickKey: "1" });
    expect(u).toContain("ncpms.rda.go.kr/npmsAPI/service");
    expect(u).toContain("apiKey=KEY");
    expect(u).toContain("serviceCode=SVC05");
    expect(u).toContain("sickKey=1");
  });
  it("키 게이트 + 파서 차단", async () => {
    expect(ncpmsConfigured()).toBe(false);
    expect(await fetchNcpmsSample("SVC05")).toBeNull();
    expect(() => parseNcpms("<xml/>")).toThrow(ShapeUnverifiedError);
  });
});

describe("농사로 국내 재배정보 seam", () => {
  it("URL 빌더: api.nongsaro.go.kr/service/{svc}/{op}·apiKey·apiType", () => {
    const u = ngsUrl("KEY", "garden", "lightList", { sType: "sNm" });
    expect(u).toContain("api.nongsaro.go.kr/service/garden/lightList");
    expect(u).toContain("apiKey=KEY");
    expect(u).toContain("apiType=xml");
    expect(u).toContain("sType=sNm");
  });
  it("키 게이트 + 파서 차단", async () => {
    expect(nongsaroConfigured()).toBe(false);
    expect(await fetchNongsaroSample("garden", "lightList")).toBeNull();
    expect(() => parseNongsaro("<xml/>")).toThrow(ShapeUnverifiedError);
  });
});

describe("식물 재배정보 seam(Perenual·Trefle)", () => {
  it("URL 빌더: Perenual key·Trefle token", () => {
    expect(perenualSpeciesListUrl("K", "mango")).toContain("perenual.com/api/v2/species-list?key=K&q=mango");
    expect(trefleSearchUrl("T", "olive")).toContain("trefle.io/api/v1/plants/search?token=T&q=olive");
  });
  it("키 게이트(둘 다 없음) + 파서 차단", async () => {
    expect(plantDetailConfigured()).toBe(false);
    expect(await fetchPerenualSample("mango")).toBeNull();
    expect(() => parsePlantDetail({})).toThrow(ShapeUnverifiedError);
  });
});

describe("공공데이터 지원금 seam", () => {
  it("withServiceKey: serviceKey·returnType 부착(base 추측 안 함)", () => {
    const u = withServiceKey("https://api.example.go.kr/op", "SK", { page: "1" });
    expect(u).toContain("serviceKey=SK");
    expect(u).toContain("returnType=JSON");
    expect(u).toContain("page=1");
  });
  it("잘못된 endpoint면 throw(명세서 경로 강제)", () => {
    expect(() => withServiceKey("not-a-url", "SK")).toThrow();
  });
  it("키 게이트 + 파서 차단", async () => {
    expect(publicSupportConfigured()).toBe(false);
    expect(await fetchSupportSample("https://api.example.go.kr/op")).toBeNull();
    expect(() => parsePublicSupport({})).toThrow(ShapeUnverifiedError);
  });
});

describe("푸시 seam", () => {
  it("VAPID 미설정 → console 발신자(미전송·ok:false)", async () => {
    expect(vapidConfigured()).toBe(false);
    const s = createPushSender();
    expect(s.mode).toBe("console");
    const r = await s.send({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p", auth: "a" } }, { title: "t", body: "b" });
    expect(r.ok).toBe(false); // 성공으로 위장하지 않음
  });
  it("ConsolePushSender는 잘못된 endpoint도 throw 없이 처리", async () => {
    const r = await new ConsolePushSender().send({ endpoint: "bad", keys: { p256dh: "", auth: "" } }, { title: "", body: "" });
    expect(r.ok).toBe(false);
  });
});

describe("모니터링 스케줄러 seam", () => {
  it("기본 비활성: 등록돼도 LANSMARK_MONITOR_CRON 없으면 가동 안 함", () => {
    const s = new MonitorScheduler();
    s.register({ id: "j1", everyMs: 60000, run: async () => {} });
    expect(s.size).toBe(1);
    const r = s.start();
    expect(r.enabled).toBe(false);
    expect(r.started).toBe(0);
    expect(s.running).toBe(false);
    s.stop();
  });
  it("플래그=1이면 가동(타이머 unref) 후 stop", () => {
    process.env.LANSMARK_MONITOR_CRON = "1";
    const s = new MonitorScheduler();
    s.register({ id: "j1", everyMs: 1, run: async () => {} }); // everyMs는 최소 1분으로 클램프됨
    const r = s.start();
    expect(r.enabled).toBe(true);
    expect(r.started).toBe(1);
    expect(s.running).toBe(true);
    s.stop();
    expect(s.running).toBe(false);
  });
  it("F1: 비유한 everyMs(NaN)도 최소 1분으로 클램프(과다폴링 가드 우회 차단)", () => {
    vi.useFakeTimers();
    try {
      process.env.LANSMARK_MONITOR_CRON = "1";
      const s = new MonitorScheduler();
      let fires = 0;
      s.register({ id: "bad", everyMs: NaN, run: async () => { fires++; } });
      s.start();
      vi.advanceTimersByTime(59_000); // 59초 — 클램프(60초)면 아직 0(버그면 0ms로 폭발)
      expect(fires).toBe(0);
      vi.advanceTimersByTime(2_000);  // 61초 — 정확히 1회
      expect(fires).toBe(1);
      s.stop();
    } finally { vi.useRealTimers(); }
  });
  it("F2: start 재호출 시 started=신규 가동 수(누적 총수 아님)", () => {
    process.env.LANSMARK_MONITOR_CRON = "1";
    const s = new MonitorScheduler();
    s.register({ id: "a", everyMs: 60000, run: async () => {} });
    expect(s.start().started).toBe(1);
    s.register({ id: "b", everyMs: 60000, run: async () => {} });
    expect(s.start().started).toBe(1); // 신규 1개만(누적 2 아님 — JSDoc 계약)
    expect(s.size).toBe(2);
    s.stop();
  });
});

describe("준비 현황 집계", () => {
  it("8종 · 미승격 seam은 verified=false·KMA특보는 live(true) · 키 없으면 configured 전부 false", () => {
    const list = listIntegrations();
    expect(list.length).toBe(8);
    expect(list.find((x) => x.id === "kma-warning")!.verified).toBe(true);            // live 승격
    expect(list.filter((x) => x.id !== "kma-warning").every((x) => x.verified === false)).toBe(true); // 나머지 seam
    expect(list.every((x) => x.configured === false)).toBe(true); // beforeEach가 키 비움
    expect(monitorCronEnabled()).toBe(false);
  });
  it("키 주입 시 해당 통합만 configured=true(존재여부만·값 비노출)", () => {
    process.env.KMA_API_KEY = "x";
    process.env.PERENUAL_API_KEY = "y";
    const m = new Map(listIntegrations().map((x) => [x.id, x.configured]));
    expect(m.get("kma-warning")).toBe(true);
    expect(m.get("plant-detail")).toBe(true); // Perenual만으로도 true
    expect(m.get("ncpms")).toBe(false);
    // status 객체엔 키 '값'이 없다(envVars=이름만)
    const kma = listIntegrations().find((x) => x.id === "kma-warning")!;
    expect(JSON.stringify(kma)).not.toContain('"x"');
    expect(kma.envVars).toContain("KMA_API_KEY");
  });
});

// NCPMS SVC01(병해충 검색·JSON) 파서 — 라이브 실증 형태 고정(이름 추출·중복제거·상한·형태가드)
describe("parseNcpmsPestList — NCPMS 병해충 목록 파서", () => {
  it("service.list[]에서 sickNameKor 추출 + 중복제거 + 상한", () => {
    const json = { service: { totalCount: "3", list: [
      { sickNameKor: "갈색무늬병", cropName: "사과", cropCode: "FT01" },
      { sickNameKor: "갈색무늬병", cropName: "사과" },   // 중복
      { sickNameKor: "검은별무늬병", cropName: "사과" },
    ] } };
    const r = parseNcpmsPestList(json, 8);
    expect(r.map((p) => p.nameKor)).toEqual(["갈색무늬병", "검은별무늬병"]); // 중복 1건
    expect(r[0].cropCode).toBe("FT01");
    expect(parseNcpmsPestList(json, 1).length).toBe(1); // 상한
  });
  it("형태 불일치(list 없음/null) → [](무중단)", () => {
    expect(parseNcpmsPestList(null)).toEqual([]);
    expect(parseNcpmsPestList({ service: {} })).toEqual([]);
    expect(parseNcpmsPestList({ service: { list: "nope" } })).toEqual([]);
  });
});
