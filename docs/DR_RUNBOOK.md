# LENSMARK 재해복구(DR) 런북

> 장애 유형별 복구 절차. **실행 전 현재 상태 스냅샷부터.** 의심되면 먼저 `bash scripts/deploy.sh verify`로 무결 확인.

## 0. 빠른 판단 (어느 절차로?)
- **라이브 접속 안 됨** → `run.app` 직통(`https://lansmark-api-397463229960.asia-northeast3.run.app/api/version`) 확인.
  - run.app 200 = 서버 무결 → DNS/Hosting/Cloudflare 경로 문제(한국망 Firebase IP 차단 등 — 메모리 firebase-ip-block 참조).
  - run.app도 안 됨 = 서버/배포 문제 → §1.
- **데이터 손상·유실** → 범위로 Layer 선택: 운영 실수/논리 손상 = §2(Layer1), DB 전체/프로젝트 손실 = §3(Layer2).
- **키/시크릿 만료** → §4.

## 1. 배포 롤백 (코드 문제 · ~수초, 빌드 없음)
직전 정상 리비전으로 트래픽 컷오버:
```
bash scripts/deploy.sh rollback
```
→ 최근 리비전 목록 출력 → 직전 READY 리비전으로 100% 전환 + verify. (잘못된 배포·부팅 실패에 1순위.)

## 2. Layer1 — 앱레벨 blob 스냅샷 (운영 실수 · 논리 손상)
- **ops 콘솔 → 🛟 백업/복구 탭.**
- `지금 백업` → 스냅샷 생성. 스냅샷별 `복구`(클라 `RESTORE` 타이핑 + 서버 confirm 이중).
- 복구 전 현재 상태가 자동 pre-restore 스냅샷됨(2단 되돌리기).
- ⚠ **복구 후 in-memory 스테일 → 인스턴스 재시작 필요**: 현재 리비전 재배포(`bash scripts/deploy.sh`) 또는 Cloud Run 리비전 재생성.
- ⚠ 한계: **같은-DB 스냅샷**이라 프로젝트/DB 전체 손실은 보호 못 함 → §3.

## 3. Layer2 — GCP 관리형 PITR (재해 · DB 전체 손실)
- Firestore **PITR 7일 보존**(2026-06-14 활성) + 일일 스케줄 백업.
- 복구는 **새 DB로 복원**(기존 덮어쓰기 안 함 — 안전):
```
gcloud firestore databases restore \
  --source-backup=<백업ID> --destination-database=<새DB명> --project lensmark-dev
# 또는 PITR: --snapshot-time=<RFC3339 7일내>
```
- 복원 DB로 서비스 전환 = `LANSMARK_*` 스토어 설정 변경 + 재배포 (**HUMAN — 승인 후**).
- 백업 목록: `gcloud firestore backups list --location=asia-northeast3 --project lensmark-dev`.

## 4. 키/시크릿 만료 (VWorld·KMA·KAMIS·ADMIN 등)
- Secret Manager `lansmark-*` 시크릿 새 버전 추가(콘솔 or `gcloud secrets versions add`).
- 재배포(`deploy.sh`가 `:latest` 참조) → 새 키 주입.

## 검증 (모든 복구 후 공통)
```
bash scripts/deploy.sh verify   # 버전·store=firestore·시뮬 스모크·커스텀 도메인 200
```
ops-watch(6h cron)가 이후 정기 점검. 클라 에러 폭증은 ops 서버탭/웹훅으로.
