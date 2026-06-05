# DEPLOY.md — LANSMARK 운영 배포 (도메인: lensmark.kr)

> 데이터 통합 키는 `RUN_GOLIVE.md`, 본 문서는 **도메인·호스팅·운영 env·보안 배포**.
> ⚠ **HUMAN GATE(사장님 직접)**: 서버 호스팅·DNS·TLS 인증서·비밀값 생성. 코드/AI는 설정 템플릿·가이드만 제공.
> ⚠ 철자: 도메인 `lensmark.kr`(lens-) ↔ 브랜드/코드 `LANSMARK`(lans-). 의도면 그대로, 오타면 지금 정정.

## 0) 구성 개요
```
사용자 → https://lensmark.kr → [nginx :443 TLS] → [Node 앱 127.0.0.1:8787]
                                  └ Let's Encrypt 인증서      └ npx tsx server/devServer.ts (pm2/systemd)
```
앱은 무의존성 Node http 서버 + 자체 보안헤더(CSP·HSTS·nosniff). TLS는 nginx(또는 Cloudflare)가 종단.

## 1) 서버 준비 (Ubuntu 예시)
- Node 20 설치(프로젝트는 Node 20·tsx 사용). `node -v` → v20.x
- 코드 배치 → `npm ci` (devDeps의 tsx/typescript 포함 — 운영 실행에 tsx 필요)
- 데이터 디렉터리: `sudo mkdir -p /var/lib/lansmark/data && sudo chown $USER /var/lib/lansmark/data && chmod 700 /var/lib/lansmark/data`

## 2) 운영 env (.env)
```
cp .env.production.example .env
# 비밀값 2개 생성(각각):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → LANSMARK_ENTITLEMENT_SECRET / LANSMARK_ADMIN_TOKEN 에 각각 채움
```
필수 확인: `NODE_ENV=production` · `LANSMARK_CORS_ORIGIN=https://lensmark.kr,https://www.lensmark.kr` · 비밀 2개 채움 · `LANSMARK_TRUST_PROXY_HOPS=1`(nginx 1단).
> 안전장치: 위가 비면 **앱이 부팅을 거부**(fail-closed)한다 — 잘못된 설정으로 운영 노출 방지.

## 3) 프로세스 실행 (pm2 예시)
```
npm i -g pm2
pm2 start "npx tsx server/devServer.ts" --name lansmark --cwd /path/to/lansmark_simulator_skeleton
pm2 save && pm2 startup    # 재부팅 자동기동
```
(systemd 선호 시: ExecStart=`/usr/bin/npx tsx server/devServer.ts`, EnvironmentFile=`.env`, WorkingDirectory=프로젝트경로.)

## 4) 리버스 프록시 + TLS (nginx)
```nginx
server {
  listen 443 ssl http2;
  server_name lensmark.kr www.lensmark.kr;
  ssl_certificate     /etc/letsencrypt/live/lensmark.kr/fullchain.pem;   # certbot 발급
  ssl_certificate_key /etc/letsencrypt/live/lensmark.kr/privkey.pem;
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # 앱 RL이 신뢰(TRUST_PROXY_HOPS=1)
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
server { listen 80; server_name lensmark.kr www.lensmark.kr; return 301 https://$host$request_uri; }  # HTTP→HTTPS
```
인증서: `sudo certbot --nginx -d lensmark.kr -d www.lensmark.kr`

## 5) DNS (도메인 등록처)
- `A` 레코드: `lensmark.kr` → 서버 공인 IP
- `CNAME`(또는 A) : `www.lensmark.kr` → `lensmark.kr`(또는 동일 IP)
- (Cloudflare 사용 시 프록시 ON이면 `LANSMARK_TRUST_PROXY_HOPS=2`)

## 6) 배포 후 점검
```
curl -s https://lensmark.kr/api/health        # ok·storeMode·integrations 상태
curl -s https://lensmark.kr/api/version        # 0.23.0
# 페이지: https://lensmark.kr/(앱) · /ops(콘솔·admin토큰) · /terms · /privacy
```
- CORS: 타 출처에서의 요청이 차단되는지(허용 도메인만).
- 부팅 로그에 `[SECURITY]` 경고가 없어야 함(있으면 env 보완).

## 7) 운영 전 체크리스트
- [ ] `NODE_ENV=production` + 비밀 2개 생성·주입
- [ ] CORS = lensmark.kr 도메인 (전체허용 * 아님)
- [ ] TLS(HTTPS) 정상 · HTTP→HTTPS 리다이렉트
- [ ] `/var/lib/lansmark/data` 쓰기권한(재시작 보존)
- [ ] `/terms`·`/privacy` 초안 → **법무 검토 후 확정**(공개·PII 수집 전제)
- [ ] (무료 베타) 결제 비활성 상태로 오픈 → 실측 플라이휠 수집
- [ ] (유료 전 — Phase 2) 실 RDA 소득자료 · Toss 라이브 키 · 약관 확정
