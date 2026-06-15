/* LENSMARK 서비스워커 — 앱 쉘 캐시(오프라인·설치형 PWA). API는 항상 네트워크(동적·캐시 금지). */
const CACHE = "lensmark-shell-v2"; // v1→v2: null-응답 버그 수정 + 빈/손상 캐시 강제 재구성(activate가 v1 삭제)
const SHELL = [
  "/app", "/manifest.webmanifest", "/icon.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
];
// 네트워크·캐시 모두 실패 시 내비게이션에 돌려줄 최소 오프라인 페이지(절대 null 금지 — WebKit "Returned response is null" 방지).
const OFFLINE_HTML =
  "<!doctype html><html lang=ko><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
  "<title>LENSMARK — 연결 실패</title></head><body style='font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:30rem;margin:16vh auto;padding:0 1.5rem;text-align:center;color:#1f2937'>" +
  "<h2 style='font-size:1.25rem;margin:0 0 .6rem'>지금 연결할 수 없습니다</h2>" +
  "<p style='color:#6b7280;line-height:1.65;margin:0 0 1.3rem'>네트워크가 일시적으로 불안정하거나 차단된 상태입니다. 잠시 후 새로고침하거나 다른 네트워크(예: 모바일 데이터)로 시도해 주세요.</p>" +
  "<button onclick='location.reload()' style='padding:.7rem 1.5rem;border:0;border-radius:10px;background:#16a34a;color:#fff;font-weight:700;font-size:1rem;cursor:pointer'>새로고침</button>" +
  "</body></html>";

self.addEventListener("install", (e) => {
  // 개별 캐시(allSettled) — CDN 1개가 실패해도 로컬 쉘(/app 등)은 캐시된다(addAll은 하나라도 실패하면 전체 거부→빈 캐시→오프라인 폴백 불가 버그).
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;                 // 변경요청(POST 등)은 SW 미개입
  const u = new URL(e.request.url);
  if (u.origin === location.origin && u.pathname.startsWith("/api/")) return; // API는 네트워크 직통(캐시 금지)
  const isNav = e.request.mode === "navigate";            // 페이지 내비게이션(문서 로드)
  // 앱 쉘: 네트워크 우선(최신성) → 실패 시 캐시(오프라인). nonce는 캐시된 응답 내에서 자가일관.
  e.respondWith(
    fetch(e.request).then((r) => {
      // 성공(2xx) + basic/cors 응답만 캐시 — opaque(cross-origin)·에러 응답은 캐시 금지(poisoned/stale 영속 방지).
      if (r && r.ok && (r.type === "basic" || r.type === "cors")) {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {});
      }
      return r;
    }).catch(async () => {
      // ⚠ 네트워크 실패 폴백 — **절대 null/undefined 반환 금지**(respondWith(null)=WebKit "Returned response is null"로 페이지 하드 실패).
      const cached = (await caches.match(e.request)) || (isNav ? await caches.match("/app") : null);
      if (cached) return cached;                            // 캐시 있으면 오프라인 제공(쉘 로드)
      if (isNav) return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }); // 내비=오프라인 페이지
      return Response.error();                              // 서브리소스=정상 네트워크 에러(유효 Response·null 아님)
    })
  );
});

/* ===== 웹푸시(M1) — 수확기·특보 알림 표시 + 클릭 시 앱 포커스 ===== */
// 푸시 수신: 서버 페이로드(JSON)를 알림으로 표시. 형식 오류·빈 데이터는 안전 기본값.
self.addEventListener("push", (e) => {
  let d = { title: "LENSMARK", body: "", url: "/app" };
  try { if (e.data) d = Object.assign(d, e.data.json()); } catch (_) { try { d.body = e.data ? e.data.text() : ""; } catch (_2) {} }
  e.waitUntil(self.registration.showNotification(d.title || "LENSMARK", {
    body: d.body || "", icon: "/icon.svg", badge: "/icon.svg", data: { url: d.url || "/app" },
  }));
});
// 알림 클릭: 열린 앱 탭이 있으면 포커스, 없으면 새 창. (중복 탭 방지)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/app";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
