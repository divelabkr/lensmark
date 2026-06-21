#!/usr/bin/env bash
# dataPrune — .data 업로드 데이터 정리(중복 제거 + 옵션 압축). 로컬 디스크 회수용.
#   왜: 업로드 원본이 한글명+ASCII사본으로 '완전 중복'되면 디스크만 2배 먹는다(해시 동일분만 안전 제거).
#   안전: .gitignore된 .data만 대상(git·소스 무관). 해시가 같은 쌍에서 '한글원본'을 남기고 사본 제거(원본 보존 우선).
#   사용: bash scripts/dataPrune.sh [--gzip]   (--gzip이면 남은 PDF를 gzip -9로 압축)
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
DIR=".data/rda_pdfs"
[ -d "$DIR" ] || { echo "대상 없음: $DIR (정리할 것 없음)"; exit 0; }

echo "=== $DIR 정리 전 ==="; du -sh "$DIR"

# 1) 해시 기준 중복 탐지 — 같은 내용이면 'ASCII 사본(reg*/nat*)'을 지우고 한글원본 보존.
declare -A seen
shopt -s nullglob
for f in "$DIR"/*; do
  [ -f "$f" ] || continue
  h=$(shasum -a 256 "$f" 2>/dev/null | awk '{print $1}')
  [ -z "$h" ] && continue
  if [ -n "${seen[$h]:-}" ]; then
    # 이미 동일 내용 존재 → 둘 중 ASCII 패턴(reg/nat 시작)을 제거 대상으로
    keep="${seen[$h]}"; dup="$f"
    base_dup=$(basename "$dup")
    if [[ "$base_dup" =~ ^(reg|nat) ]]; then
      echo "중복 제거(사본): $dup  ← 동일: $keep"
      rm -f "$dup"
    else
      # 새로 만난 게 한글원본이고 기존이 ASCII면, ASCII를 지우고 원본 유지
      base_keep=$(basename "$keep")
      if [[ "$base_keep" =~ ^(reg|nat) ]]; then
        echo "중복 제거(사본): $keep  ← 동일: $dup"
        rm -f "$keep"; seen[$h]="$dup"
      else
        echo "중복 제거: $dup  ← 동일: $keep"; rm -f "$dup"
      fi
    fi
  else
    seen[$h]="$f"
  fi
done

# 2) 옵션 압축
if [ "${1:-}" = "--gzip" ]; then
  echo "=== gzip -9 압축(복원: gunzip) ==="
  gzip -9 "$DIR"/*.pdf 2>/dev/null || true
fi

echo "=== 정리 후 ==="; du -sh "$DIR"
echo "✓ 완료. (PDF는 'npm run rda:build'로 추출 후엔 외부 보관 가능 — docs/CAPACITY.md S2)"
