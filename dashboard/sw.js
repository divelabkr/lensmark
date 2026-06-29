/* LENSMARK 서비스워커 — 앱 쉘 캐시(오프라인·설치형 PWA). API는 항상 네트워크(동적·캐시 금지). */
const CACHE = "lensmark-shell-v15"; // v14→v15: app.html S4 작물→지형→시뮬 다리(PENDING_CROP·cr-sim 버튼) 반영. SW 자동갱신·버전정합·부팅비콘재시도·OFFLINE 플래그·install fetch+put·빈캐시 fail-safe·updateViaCache 유지.
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
  // 관측(복구 아님): 연결 실패 화면을 띄웠다는 사실만 남긴다 → 다음 정상 로드 때 앱이 자동 보고. 여기서 unregister·캐시삭제 같은 복구는 하지 않는다.
  "<script>try{localStorage.setItem('lm_offline_seen','1')}catch(e){}</script>" +
  "</body></html>";

self.addEventListener("install", (e) => {
  // 핵심 로컬 쉘(/app)은 반드시 캐시 — 실패하면 install 거부→SW 미설치(앱은 서버 직접 로드로 정상 동작·빈 캐시로 활성화돼 폴백 잃는 먹통을 원천 차단하는 fail-safe).
  //   /app은 c.add 대신 fetch+put: c.add가 일부 환경(zstd 인코딩/Vary 응답)에서 SW install을 redundant로 만드는 것을 우회.
  //   나머지(manifest·icon·CDN leaflet)는 개별 .catch best-effort — cross-origin CDN이 CSP connect-src('self')에 막혀 실패해도 install이 안 깨지게(leaflet은 런타임 <script>로 로드되므로 SW 캐시는 보너스).
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    const r = await fetch("/app", { cache: "reload" });
    if (!r || !r.ok) throw new Error("shell fetch " + (r && r.status)); // 핵심 쉘 실패 → install 거부(fail-safe)
    await c.put("/app", r.clone());
    await Promise.allSettled(SHELL.filter((u) => u !== "/app").map((u) => c.add(u).catch(() => {})));
  }));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  // 옛 캐시 삭제는 새 캐시에 핵심 쉘(/app)이 실재할 때만(이중 안전) — 빈 새 캐시 + 옛 캐시 소멸로 폴백을 잃는 것 방지.
  e.waitUntil((async () => {
    const hasShell = await caches.match("/app", { cacheName: CACHE });
    if (hasShell) {
      const ks = await caches.keys();
      await Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;                 // 변경요청(POST 등)은 SW 미개입
  const u = new URL(e.request.url);
  if (u.origin === location.origin && u.pathname.startsWith("/api/")) return; // API는 네트워크 직통(캐시 금지)
  const isNav = e.request.mode === "navigate";            // 페이지 내비게이션(문서 로드)
  // 앱 쉘: 네트워크 우선(최신성) → 실패 시 캐시(오프라인). nonce는 캐시된 응답 내에서 자가일관.
  e.respondWith((async () => {
    const putCache = (req, r) => { if (r && r.ok && (r.type === "basic" || r.type === "cors")) caches.open(CACHE).then((c) => c.put(req, r.clone())).catch(() => {}); };
    if (isNav) {
      // navigation 콜드스타트(min=0) 견고화: ① 짧은 재시도(서버 살아있거나 빨리 깨면 최신)
      for (let i = 0; i < 3; i++) {
        try {
          const r = await fetch(e.request);
          if (r && r.ok && (r.type === "basic" || r.type === "cors")) { putCache(e.request, r); return r; }
          if (r && r.status < 500) return r;                // 4xx 그대로(재시도 무의미)
        } catch (_) { /* 네트워크 실패 → 아래 캐시 쉘 */ }
        if (i < 2) await new Promise((s) => setTimeout(s, 500 * (i + 1))); // 0.5/1.0s
      }
      // ② 콜드스타트 지속 → 캐시 쉘 즉시(앱이 뜸 — '연결 실패' 회피) + 백그라운드로 서버 깨워 다음 로드 최신화(SWR)
      const shell = (await caches.match(e.request)) || (await caches.match("/app"));
      if (shell) { e.waitUntil(fetch(e.request).then((r) => putCache(e.request, r)).catch(() => {})); return shell; }
      // ③ 캐시도 없음(첫 방문 중 콜드스타트) → 길게 한 번 더 대기 후 오프라인 페이지(⚠ 절대 null 금지)
      try { const r = await fetch(e.request); if (r && r.ok) { putCache(e.request, r); return r; } } catch (_) {}
      return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    // 서브리소스: 네트워크 우선 → 실패 시 캐시(유효 Response·null 아님)
    try {
      const r = await fetch(e.request);
      if (r && r.ok && (r.type === "basic" || r.type === "cors")) { putCache(e.request, r); return r; }
      return r || Response.error();
    } catch (_) {
      return (await caches.match(e.request)) || Response.error();
    }
  })());
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
