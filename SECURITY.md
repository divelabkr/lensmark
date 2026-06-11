# SECURITY.md — LENSMARK 운영 보안 런북

> 배포 직전 체크리스트 + 코드 내장 보호 + 키 관리. 코드 레벨은 대부분 구현됨(아래 §2) — 실질 갭은 **운영 HUMAN GATE**(TLS·키·시크릿 주입, §1).

## 1) 배포 직전 필수 (HUMAN GATE) — `bootSafety`가 운영서 강제하나 값은 사람이 주입
| 항목 | 방법 | 비고 |
|---|---|---|
| **TLS/HTTPS** | nginx/플랫폼 TLS 종단 + `LANSMARK_TRUST_PROXY_HOPS=1` | 세션·PII 평문 전송 금지. 프록시 뒤 `X-Forwarded-Proto` 신뢰 → HSTS 발효 |
| **ENTITLEMENT_SECRET** | `openssl rand -hex 32` → `LANSMARK_ENTITLEMENT_SECRET` | 토큰 서명·실효. 미설정/약함이면 prod 부팅 차단 |
| **ACCOUNT_SECRET** | `openssl rand -hex 32` → `LANSMARK_ACCOUNT_SECRET` | 계정 식별자 해시 전용(엔티틀 회전과 격리). 미설정 시 ENTITLEMENT_SECRET 폴백 |
| **DATA_KEY (at-rest)** | `openssl rand -hex 32` → `LANSMARK_DATA_KEY` | ⚠ **분실 시 암호데이터 영구 복구불가 → 별도 백업 필수.** 미설정이면 평문+0600 |
| **ADMIN_TOKEN** | 강한 랜덤 → `LANSMARK_ADMIN_TOKEN` | 운영 콘솔(`/ops`). 미설정이면 prod 부팅 차단 |
| **결제 키** | `PG_WEBHOOK_SECRET`·`TOSS_SECRET_KEY` | webhook 서명검증·confirm |
| **CORS** | `LANSMARK_CORS_ORIGIN=https://lensmark.kr` | `*` 금지(prod 부팅 차단). |
| **무료베타 토글** | `LANSMARK_REQUIRE_ENTITLEMENT=false`면 `LANSMARK_ALLOW_OPEN_PAID=1` 명시 | 또는 ops 콘솔 토글 |

> ⚠ `.env`는 절대 git 커밋 금지(`.gitignore`에 `.env`·`.data/` 등재됨). 키는 플랫폼 시크릿/비밀관리자에.

## 2) 코드 내장 보호 (이미 구현 — 검증됨)
- **헤더/XSS**: CSP(요청별 nonce·`unsafe-inline` 미사용=주입 스크립트 차단)·HSTS(https)·nosniff·X-Frame-DENY·COOP·CORP·Permissions-Policy
- **요청**: 레이트리밋(글로벌+민감: auth·결제·시뮬)·XFF 위조 가드(trustProxyHops)·바디 상한·입력 clamp/sanitize
- **인증/계정**: 세션(무작위 192bit·만료)·계정 식별자 HMAC 해시(원 전화/이메일 미저장)·OTP 챌린지 시도 상한
- **결제**: 금액 서버권위·webhook HMAC+멱등·jti 결정적(이중발급 차단)·revoke 킬스위치·구매자 결속(`boundAccount`)·토큰 길이 cap
- **암호화**: at-rest AES-256-GCM seam(`DATA_KEY` 주입 시·`ENC1:`)·파일 0600·sealed 가드(키 분실 시 평문 덮어쓰기 차단)
- **감사**: 보안 이벤트(로그인·실효·결제·게이트 토글·일지 삭제) → `audit.jsonl` 영속(append-only·0600·재시작 보존)
- **ops**: 관리자 timing-safe 토큰 비교·`/api/ops/*` cross-origin 판독 차단·게이트 토글 prod 가드(`ALLOW_OPEN_PAID`)
- **부팅 fail-closed**: 운영서 약한시크릿·CORS*·무인증콘솔·무료개방을 차단(`bootSafety`)

## 3) 키 관리
- **생성**: `openssl rand -hex 32`(32바이트). **보관**: 플랫폼 시크릿/비밀관리자(.env 평문·git 금지).
- **DATA_KEY 백업 필수**: 분실 = 암호화된 휴대폰·일지 영구 복구 불가.
- **회전**: `ENTITLEMENT_SECRET` 회전 시 기존 발급 토큰 무효(재로그인 필요). `ACCOUNT_SECRET` 분리로 계정 해시는 독립 유지.

## 4) 사고 대응
- **토큰 탈취/환불**: `POST /api/ops/revoke {jti}` (관리자) → 즉시 실효(전 유료 surface 킬스위치).
- **계정 침해**: 해당 세션 파기(로그아웃) / 스토어에서 세션 삭제. `audit.jsonl`로 사건 추적.
- **유료 게이트 오작동**: ops 콘솔 토글 또는 `LANSMARK_REQUIRE_ENTITLEMENT` 재설정.

## 5) 운영 후 강화 (P1/P2 — 미구현)
- 감사로그 외부 전송(SIEM)·로테이션 · 세션 httpOnly+Secure 쿠키(현재 localStorage·강한 CSP로 완화) · 계정 lockout/이상탐지 · 멀티인스턴스 DB(유니크 제약·락) · 백업 암호화 · 개인정보 영향평가(PIA, 규모 시)
- **익명 계측(신규/재방문·v0.52) 알려진 한계** — 브라우저 익명ID(`x-lansmark-anon`)를 비식별 해시 집합으로만 중복제거(여정 미저장·PII 0). 단 ⚠ **위조 가능**: 조작된 anon-id 스팸으로 신규/재방문 수 부풀리기·`seenAnon` FIFO 축출 가능 → `/api/*` 글로벌 레이트리밋(IP당)으로 바운드 + 콘솔 '참고용' 라벨로 완화. '검증된 사실' 아님(마케팅 수치 사용 금지). 정밀 집계는 DB 어댑터(per-record·ROADMAP §3-1) 승격 시. **처리방침에 익명 접속 집계 고지 반영(`dashboard/lansmark_privacy.html`) — 법무 검토는 HUMAN GATE.**

## 6) PIPA(개인정보) — `LEGAL_CHECKLIST.md` 참조
동의·마스킹·삭제권·파기·at-rest 암호화 seam 구현. 방침 확정·사업자정보·위탁계약·키 주입은 법무/운영 HUMAN GATE.
