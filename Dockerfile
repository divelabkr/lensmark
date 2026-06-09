# LENSMARK API — Cloud Run 컨테이너(현재 무의존성 Node 서버를 '그대로' 실행).
#   ⚠ 상태(.data 파일 스토어)는 컨테이너 파일시스템 = 휘발 → dev 검증용. prod 영속은 Firestore 어댑터(ROADMAP §3-1) 필요.
#   ⚠ 시크릿은 이미지에 굽지 않는다 — Cloud Run 환경변수/Secret Manager로 주입(DEPLOY.md 참조). .dockerignore가 .env·.data 제외.
FROM node:20-slim
WORKDIR /app

# 1) 의존성(레이어 캐시) — tsx가 런타임 엔트리라 dev 의존성 포함 설치(lockfile 결정적).
COPY package.json package-lock.json ./
RUN npm ci

# 2) 소스 복사(.dockerignore가 .env·.data·node_modules·.git·samples 제외 → 시크릿/PII 미포함)
COPY . .

ENV NODE_ENV=production
# Cloud Run이 PORT를 주입(기본 8080). 서버는 process.env.PORT를 따른다(config.ts).
# .data는 컨테이너의 쓰기가능 /tmp로(휘발) — 영구 보존 아님(prod는 Firestore).
ENV LANSMARK_DATA_DIR=/tmp/lansmark-data
EXPOSE 8080
CMD ["npm", "run", "start"]
