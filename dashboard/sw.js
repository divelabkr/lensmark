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
      const cp = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("/app")))
  );
});
