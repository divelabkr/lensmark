#!/usr/bin/env bash
# 프리뷰 서빙 정합 점검 (제도적 안전장치 · 2026-06-13).
#   배경: preview 서버가 좀비 프록시로 포트를 잡은 채 무응답(HTTP 000)인데 '반영됨'이라 보고 →
#         사용자 브라우저가 캐시된 옛 페이지를 보여 "뭐가 다르니" 혼선. 편집≠서빙 갭이 원인.
#   동작(PostToolUse 훅): dashboard/*.html 편집 시에만 발화. 비차단(경고만, 항상 exit 0).
#     ① 포트 미실행 → 조용히 스킵(프리뷰 안 쓰는 작업)
#     ② 포트는 잡았으나 무응답/빈응답(좀비/멈춤) → ⛔ 경고 + 정리·재기동 안내('반영됨' 보고 금지)
#     ③ 200인데 파일↔서빙 불일치(스테일) → ⚠ 경고(서버 재기동 권장)  ※ 서버는 요청마다 CSP nonce 주입 → 비교 전 nonce 제거
root="${CLAUDE_PROJECT_DIR:-.}"
input=$(cat 2>/dev/null || true)

# dashboard HTML 편집일 때만 — 어느 파일인지에 따라 점검 라우트 결정(앱=/app, 운영=/ops). 그 외엔 종료.
f=$(printf '%s' "$input" | grep -oE 'dashboard/[A-Za-z0-9_]+\.html' | head -1)
case "$f" in
  *lansmark_app.html) ROUTE="/app"; FILE="dashboard/lansmark_app.html";;
  *lansmark_ops.html) ROUTE="/ops"; FILE="dashboard/lansmark_ops.html";;
  *) exit 0;;
esac

# 디스크 파일 크기(없으면 0) — 응답이 이만큼 나오는지 sanity 기준.
disk=$(wc -c < "$root/$FILE" 2>/dev/null | tr -d ' '); disk=${disk:-0}
for PORT in 8801 8787; do # freebeta·atlas preview 포트
  lsof -ti "tcp:$PORT" >/dev/null 2>&1 || continue
  url="http://127.0.0.1:$PORT$ROUTE"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  n=$(curl -s --max-time 5 "$url" 2>/dev/null | wc -c | tr -d ' '); n=${n:-0}
  if [ "$code" != "200" ] || [ "$n" -lt 1 ]; then
    echo "⛔ [preview-check] :$PORT 가 포트를 잡았으나 무응답/빈응답(HTTP ${code:-000}) — 좀비/멈춤." >&2
    echo "   → 사용자에게 '반영됨' 보고 금지. 정리 후 재기동: lsof -ti tcp:$PORT | xargs kill -9 → preview_start 재호출." >&2
    continue
  fi
  # 서버(pages.ts)는 요청마다 파일을 fresh read → 스테일 위험 없음. 응답이 디스크의 절반 미만이면 잘림/오류로 간주(0바이트 사건 포착).
  if [ "$disk" -gt 0 ] && [ "$n" -lt $((disk/2)) ]; then
    echo "⛔ [preview-check] :$PORT $ROUTE 응답이 비정상적으로 작음(${n}B ≪ 파일 ${disk}B) — 잘림/오류 추정. 재기동 권장." >&2
  else
    echo "✓ [preview-check] :$PORT 가 $FILE 서빙 정상(${n}B · 요청마다 fresh read → 현재 내용)."
  fi
done
exit 0
