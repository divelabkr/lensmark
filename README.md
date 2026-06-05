# LANSMARK Simulator Skeleton

LANSMARK를 **현실 기반 작물·수확·소득 시뮬레이터**로 전환하기 위한 전체 뼈대입니다.

## 제품 정의

LANSMARK는 후보지 추천/토지 매입 판단 서비스가 아니라, 사용자가 입력한 토지 위치와 조건을 바탕으로:

1. 잘 자랄 가능성이 있는 작물·품종군을 보여주고
2. 선택한 작물에 대해 식재량·수확량·비용·판매가·예상소득을 범위로 시뮬레이션하며
3. 비·해충·재난·서리·관수·배수 등 생육 리스크를 알려주는 서비스입니다.

## 사용자 흐름

```txt
주소/핀/영역 입력
→ 작물·품종군 후보
→ 무료는 여기까지
→ 작물 선택
→ 면적/식재량 입력
→ 수확량 P10/P50/P90
→ 비용/판매가/예상소득
→ 생육 리스크
→ 토양검정서/현장자료 업로드 시 정밀화
```

## 포함 구조

```txt
src/lansmark/
  types.ts
  config.ts
  data/
  policy/
  core/
  api/
  components/
  tests/

docs/
  ARCHITECTURE.md
  ROADMAP.md
  MONETIZATION.md
  RISK_GUARDRAILS.md

prisma/
  schema-addon.prisma

CODEX_HANDOFF_PROMPT.md
.env.example
```

## 붙이는 순서

1. `src/lansmark` 폴더를 기존 프로젝트에 복사
2. 기존 후보지/리포트 용어를 시뮬레이터 용어로 교체
3. 무료 작물 후보 API 연결
4. 유료 수확/소득 시뮬레이션 API 연결
5. 결제/리포트/PDF는 이후 붙임
