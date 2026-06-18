/**
 * 외부연동(HUMAN GATE) 준비 현황 집계 — '키 존재 여부'만 노출(값 절대 금지). ops/체크리스트·테스트용.
 *   각 통합의 configured()를 모아 IntegrationStatus[] 반환. 파서 검증 전이라 verified는 전부 false.
 *   상세 발급 절차는 HUMAN_GATE.md, seam 코드는 같은 폴더 모듈 참조.
 */
import type { IntegrationStatus } from "./types";
import { kmaWarningConfigured } from "./kmaWarning";
import { ncpmsConfigured } from "./ncpms";
import { nongsaroConfigured } from "./nongsaro";
import { plantDetailConfigured } from "./plantDetail";
import { publicSupportConfigured } from "./publicSupport";
import { vapidConfigured } from "./push";
import { explainConfigured } from "./explain";

export * from "./types";

/** 모니터링 크론 활성 여부(env 플래그). */
export function monitorCronEnabled(): boolean {
  return (process.env.LANSMARK_MONITOR_CRON || "") === "1";
}

/** 통합 준비 현황 — configured만 환경 따라 변하고, verified는 승격 전(실샘플 검증 전) false. */
export function listIntegrations(): IntegrationStatus[] {
  return [
    {
      id: "kma-warning", name: "기상청 기상특보", envVars: ["KMA_API_KEY"], configured: kmaWarningConfigured(), verified: true,
      applyUrl: "https://apihub.kma.go.kr/apiList.do?seqApi=10",
      humanGate: "✓ 활용신청 완료·live 승격(agri-alerts) — 파서 검증(EUC-KR·typ01). 키 없으면 seed 폴백",
    },
    {
      id: "ncpms", name: "NCPMS 병해충 예찰·발생", envVars: ["NCPMS_API_KEY"], configured: ncpmsConfigured(), verified: false,
      applyUrl: "https://ncpms.rda.go.kr/",
      humanGate: "NCPMS OpenAPI apiKey 발급(또는 data.go.kr serviceKey 택1) — 발생/예찰 serviceCode 확인 필요(UNCERTAIN)",
    },
    {
      id: "nongsaro", name: "농사로 국내 재배정보", envVars: ["NONGSARO_API_KEY"], configured: nongsaroConfigured(), verified: false,
      applyUrl: "https://www.nongsaro.go.kr/portal/ps/psz/psza/contentMain.ps?menuId=PS00191",
      humanGate: "농사로 OpenAPI 신청(휴대폰 인증 → 신청 → 승인 → apiKey) — 국내 작물 재배법(재배시기·관수·품종). 외래작물은 미커버",
    },
    {
      id: "plant-detail", name: "식물 재배정보(외래·Perenual·Trefle)", envVars: ["PERENUAL_API_KEY", "TREFLE_TOKEN"], configured: plantDetailConfigured(), verified: false,
      applyUrl: "https://perenual.com/user/developer",
      humanGate: "외래작물 전용 — Perenual key(무료 100/일·우선)·Trefle token(폴백·불안정). 국내 작물은 농사로 사용",
    },
    {
      id: "public-support", name: "공공데이터 농업 지원금", envVars: ["DATA_GO_KR_SERVICE_KEY"], configured: publicSupportConfigured(), verified: false,
      applyUrl: "https://www.data.go.kr/data/15113968/openapi.do",
      humanGate: "data.go.kr serviceKey 발급 + 보조금24 API 활용신청(자동승인) — 오퍼레이션 경로 명세서 확인(UNCERTAIN)",
    },
    {
      id: "web-push", name: "브라우저 푸시(VAPID)", envVars: ["LANSMARK_VAPID_PUBLIC_KEY", "LANSMARK_VAPID_PRIVATE_KEY"], configured: vapidConfigured(), verified: false,
      applyUrl: "(자체 생성 — 외부 발급 없음)",
      humanGate: "VAPID 키쌍 자체 생성(npx web-push generate-vapid-keys) → .env 주입 · web-push 암호화는 승격 시 결정",
    },
    {
      id: "monitor-cron", name: "모니터링 스케줄러", envVars: ["LANSMARK_MONITOR_CRON"], configured: monitorCronEnabled(), verified: false,
      applyUrl: "(인프라·자체)",
      humanGate: "외부 키 불필요 — 데이터 seam(특보·예찰) 승격 후 작업 등록 + LANSMARK_MONITOR_CRON=1",
    },
    {
      id: "ai-explain", name: "AI 근거 설명(Claude)", envVars: ["ANTHROPIC_API_KEY"], configured: explainConfigured(), verified: false,
      applyUrl: "https://console.anthropic.com/",
      humanGate: "Anthropic API 키 발급 → .env. Claude는 엔진이 준 숫자를 '설명'만(날조 금지·출처는 우리 부착). 라이브 키로 실응답 1건 캡처해 출력가드 보정 후 승격(verified). UI는 배포·데이터 뒤.",
    },
  ];
}
