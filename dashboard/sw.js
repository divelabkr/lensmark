/* LENSMARK 서비스워커 — 앱 쉘 캐시(오프라인·설치형 PWA). API는 항상 네트워크(동적·캐시 금지). */
const CACHE = "lensmark-shell-v1";
const SHELL = [
  "/app", "/manifest.webmanifest", "/icon.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))); // 일부 실패해도 설치 진행
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
  // 앱 쉘: 네트워크 우선(최신성) → 실패 시 캐시(오프라인). nonce는 캐시된 응답 내에서 자가일관.
  e.respondWith(
    fetch(e.request).then((r) => {
      // 성공(2xx) + basic/cors 응답만 캐시 — opaque(cross-origin)·에러 응답은 캐시 금지(poisoned/stale 영속 방지).
      if (r && r.ok && (r.type === "basic" || r.type === "cors")) {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("/app")))
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
