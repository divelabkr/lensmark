# ROADMAP.md — LENSMARK 계획 SSOT (forward plan)

> **완료 기능 SSOT = `scripts/featureMap.ts`(+ `npm run arch`로 코드 대조).** 이 문서는 그 반대편 — **앞으로 할 것·게이트**의 단일 출처.
> 변경 이력은 `CHANGELOG.md`/`version.ts`, 보안 런북은 `SECURITY.md`, 법무는 `LEGAL_CHECKLIST.md`, AI 작업방식은 `../AI_WORKING_AGREEMENT.md`.
> 현재: **v0.39.0** · 33기능 · arch 0 · tsc·vitest 393 그린.

## 0. 정체성 / 단계
땅 선택 → 무료 작물추천 → 유료 정밀 소득시뮬(P10/50/90·근거) → 재배운영 동반 → 실측 보정 플라이휠(해자).
스테이지: assess → land → recommend → pay → simulate → growth → operate → act → feedback → ops → platform.

## 1. ✅ 완료 (대표 — 상세는 featureMap/CHANGELOG)
- 코어: 지도·필지·토지분류·무료추천·정밀시뮬·예산·온난화시나리오·생육출하·재배가이드·지원금·모니터링·병충해·출하시세·플라이휠·귀농진단
- 플랫폼: 보안 미들웨어·영속성·버전팝업·세션IO·서버코어·provider 드롭인·**PWA 쉘**
- 이번 사이클(0.26→0.39): give/get B·지도토글·**법무(삭제권·at-rest 암호화 seam·ops CORS)**·**ops 유료게이트 토글**·**계정 시스템(코어→휴대폰OTP→유료연계)**·**4모델 파이프라인+panel-review 도구**·보안하드닝·**perf(gzip)**·**감사로그+SECURITY.md**·**모바일 바텀시트**·**PWA 쉘**

## 2. 🔜 다음 (빌드 가능 — 키 불필요/일부 HUMAN GATE)
| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| M1 | **웹푸시 알람**(① SMS 대체) | 다음 | PWA SW 위에·VAPID 자가생성(무료). 구독저장+발송 seam |
| M2 | **이메일 매직링크 로그인** | 다음 | verifier+콜백+이메일 seam. 이메일 발송키=HUMAN GATE(무료티어) |
| S5 | **세션 httpOnly 쿠키**(XSS 노출 제거) | 다음 | localStorage→쿠키+CSRF. 실기기 재검증 |
| U1 | 모바일 헤더 정리(버튼 ⋯메뉴) | 폴리시 | 바텀시트 후속 UX |
| U2 | 핀 분석 워터폴 병렬화 | perf 후속 | landClass→(recommend·terrain·parcel 병렬) |

## 3. 🌱 seam/후속 (HUMAN GATE 또는 성장단계 — featureMap status=seam/mock)
- act-stage 연결: **sales-connect**(판로·계약)·**finance-connect**(정책자금) — 파트너/기관 연계(HUMAN GATE)
- **integrations-seam**: NCPMS·Perenual·농사로 등 — 키 확보 시 live 승격
- **crop-transition**(온난화 전환 로드맵)·**b2b-consulting** — 성장 단계
- 결제 완전 결속(#3 후속): 주문생성 시 order→account 매핑(웹훅 경로 결속)
- 멀티인스턴스: 파일스토어→DB 어댑터(유니크 제약·락)

### 3-1. 🔒 보안 감사 잔여(유료 정식 과금 전 처리 — 0.45.0 3-에이전트 감사)
> 무료 베타엔 무해(유료 게이트 OFF). **실제 과금 켜기 전** 필수.
- ✅(0.46.0) **Firestore 영속 어댑터** — quota·revocation·idempotency·계정·세션·일지·실측·감사로그가 재배포에 내구(LANSMARK_STORE=firestore · 무의존성 REST · sealed 가드 · 유료게이트 ON+워밍실패=부팅중단). **잔여**: 다중 인스턴스 정합(per-record 문서·유니크 제약 — max-instances>1 전 필수) · 50k 축출은 여전히 메모리 상한(영속은 최신 전체 상태라 revoked 부활은 해소)
- ✅(0.47.0) **라이브 실전환 + 재배포 생존 실증**(lensmark-dev `store:firestore` · 실측 1건→재배포(인스턴스 교체)→**records=2** 부팅 워밍 이어쓰기) · ops 콘솔에 store/degraded 노출·revoke UI · 유료 게이트 ON/OFF 라이브 토글 검증(`/api/simulate` 402↔400). **추가 잔여**: analytics(익명 집계)는 throttle·종료 flush 의존 → 재배포 직전 소량 유실 가능(점검 중 · 핵심 데이터는 write-through 생존)
- ✅(0.82.0) **세션 토큰 응답 바디 비노출(브라우저)** — verify/register/login 3곳: Origin 헤더 동봉(=브라우저) 요청엔 바디 `{session}` 생략·httpOnly Set-Cookie만(비브라우저 API/테스트는 기존 유지 — sessionBody 헬퍼·회귀 테스트).
- **익명 결속토큰 사용 정책** — 결속 토큰을 '세션 없이' 사용하면 여전히 bearer(쿼터 한정). 완전 차단하려면 결속 토큰의 익명 사용 거부(제품 결정) + DB 결속.
- **ops 관리자 토큰 httpOnly화** — 현재 sessionStorage(운영자 표면, esc 처리됨) → 쿠키로(후속).
- **fetchJsonSafe 업스트림 바디 크기 캡**(방어심도) · **fetchRestrictedSoilEvidence 미구현 throw 유지**.

## 4. ⛔ HUMAN GATE — 출시 차단 (코드 준비됨·값/승인은 사람)
| 게이트 | 현재 | 필요 |
|---|---|---|
| 운영 시크릿 | ENTITLEMENT_SECRET·ADMIN_TOKEN·DATA_KEY **미설정** | `openssl rand -hex 32` 주입(prod 부팅 강제) |
| TLS/HTTPS | 없음 | nginx/플랫폼 + trustProxyHops (SW/세션/PII 필수) |
| at-rest 키 | DATA_KEY 미설정→평문 | 주입+백업(분실=복구불가) |
| 실 데이터 | mock RDA 소득 | 농진청 실 소득자료 |
| 법무 | 약관·방침 초안 | 법무확정·사업자정보·위탁계약(LEGAL_CHECKLIST) |
| 로그인/알람 키 | — | 이메일(M2)·카카오(선택)·웹푸시 VAPID(자가생성) |

## 5. 🚦 출시 전 최종 게이트(요약)
1. §4 HUMAN GATE 전부 충족(시크릿·TLS·법무·실데이터)
2. PWA SW/설치 실기기/HTTPS 검증 · M1 웹푸시 · M2 로그인 live
3. 그린(tsc·vitest·arch) + 보안 포스처(SECURITY.md) + 실기기 스모크
4. 무료베타 토글 결정(ops) · 유료 전환 시점

## 검증 루틴 (매 슬라이스)
빌드 → panel-review(Gemini·Codex·qwen 병렬·폴백) → Claude 트리아지 → 그린게이트 → 버전 SSOT → 런타임/실기기 → 기능단위 커밋. (상세 `../AI_WORKING_AGREEMENT.md`)
