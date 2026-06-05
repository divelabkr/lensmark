# Codex Handoff Prompt

너는 LANSMARK 프로젝트를 이어받는 시니어 풀스택 엔지니어다.

## 현재 목표

기존 LANSMARK를 “후보지 리포트”에서 **현실 기반 작물·수확·소득 시뮬레이터**로 전환한다.

## 제품 흐름

```txt
주소/핀/영역 입력
→ 토지 조건 분석
→ 작물·품종군 후보 TOP 5
→ 무료 결과 종료
→ 작물 선택
→ 면적/식재량 입력
→ 수확량 범위
→ 비용 범위
→ 판매가 범위
→ 예상소득 범위
→ 생육 리스크
→ PDF/공유 리포트
```

## 절대 금지

- 수익 보장 문구 금지
- 재배 성공 보장 금지
- 매입/임대 추천 금지
- 품종명 확정 추천 금지
- 단일 소득값만 표시 금지
- 제한 API 우회 금지
- TORAM_COMMERCIAL_PERMISSION=false일 때 흙토람/토양 제한 API 호출 금지

## 구현 순서

1. 현재 repo 구조를 파악한다.
2. 기존 LANSMARK 관련 파일을 찾는다.
3. 이 skeleton의 `src/lansmark`를 새 모듈로 추가한다.
4. 기존 기능을 삭제하지 말고 새 API route로 우선 연결한다.
5. 무료 후보 API부터 작동시킨다.
6. 유료 시뮬레이션 API를 작동시킨다.
7. UI는 카드/표 형태로 최소 구현한다.
8. typecheck/build/test를 통과시킨다.
9. 변경 로그를 `docs/codex-log`에 남긴다.

## 완료 기준

- 주소 없이도 수동 LandInput으로 작물 후보 TOP 5 생성 가능
- cropId 선택 후 수확/비용/매출/소득 범위 계산 가능
- 결과에 confidence, assumptions, disclaimers 포함
- 토양검정서 없으면 신뢰도 제한 표시
- 제한 API는 feature flag로 차단
