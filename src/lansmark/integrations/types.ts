/**
 * 외부연동(HUMAN GATE) seam 공통 타입 — "키 꽂으면 live, 없으면 unconfigured" 준비층.
 *   책임: 각 통합의 설정 상태(환경변수 '존재 여부'만) + 결과 출처 라벨을 표준화한다.
 *   원칙(CLAUDE.md #4 추측 금지): 실응답 파서는 키 확보 후 '실제 샘플 캡처'로 검증한 뒤 슬라이스 승격 시 작성한다.
 *           그 전까지 live 경로는 ShapeUnverifiedError로 명시적으로 막아 '미검증을 실데이터로 위장'하지 않는다.
 *   보안: 키 '값'은 이 계층에 절대 담지 않는다(존재 여부 boolean만). 비밀은 사용처에서 process.env로 직접 읽는다.
 */

export type IntegrationId =
  | "kma-warning"     // 기상청 기상특보(활용신청 HUMAN GATE)
  | "ncpms"           // 농진청 NCPMS 병해충 예찰(키)
  | "nongsaro"        // 농진청 농사로 국내 작물 재배정보(키)
  | "plant-detail"    // Trefle/Perenual 식물 재배정보(외래·키)
  | "public-support"  // 공공데이터포털 농업 지원금(서비스키)
  | "web-push"        // 브라우저 푸시(VAPID 자체생성)
  | "monitor-cron"    // 모니터링 스케줄러(인프라)
  | "ai-explain";     // Claude 근거 설명(ANTHROPIC_API_KEY · 숫자 설명만·날조 금지)

/** 통합 준비 상태 — ops/체크리스트 노출용. 키 '값'은 담지 않고 '존재 여부'만. */
export interface IntegrationStatus {
  id: IntegrationId;
  name: string;        // 한글 이름
  envVars: string[];   // 필요한 환경변수 '이름'(값 아님)
  configured: boolean; // 필요한 env가 모두 존재하는가
  verified: boolean;   // 실응답 파서 검증·live 승격 여부(미승격 seam=false, 승격=true)
  applyUrl: string;    // 신청/발급 위치
  humanGate: string;   // 사용자가 직접 해야 할 일(활용신청·약관·계정 등)
}

/** seam 호출 결과 — '미설정/미검증'을 절대 '실데이터(live)'로 위장하지 않는다. */
export type IntegrationResult<T> =
  | { source: "unconfigured"; verified: false; data: null; reason: string } // 키 없음 → 호출 안 함
  | { source: "unverified"; verified: false; data: null; reason: string }   // 키는 있으나 파서 미검증
  | { source: "live"; verified: true; data: T };                            // 슬라이스 승격(실응답 검증) 후에만

/** env 존재 검사 — 값 노출 없이 boolean만(공백/빈문자=미설정). */
export function hasEnv(...names: string[]): boolean {
  return names.length > 0 && names.every((n) => !!(process.env[n] && String(process.env[n]).trim()));
}

/**
 * 파서 미검증 가드 — 추측 파싱 대신 명시적으로 막는다(슬라이스 승격 시 제거).
 *   throw됨으로써 라우트/도메인은 자연히 mock/seed로 폴백한다(조용한 오염 방지).
 */
export class ShapeUnverifiedError extends Error {
  constructor(public integration: IntegrationId, public hint: string) {
    super(`SHAPE_UNVERIFIED[${integration}]: 실응답 샘플 캡처 후 파서 작성 필요 — ${hint}`);
    this.name = "ShapeUnverifiedError";
  }
}
