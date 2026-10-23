// Service worker: keeps the app shell (and its emergency card) available offline (NFR-09).
// Network-first for same-origin pages and assets, so updates show up at once; cache is the offline fallback.
const CACHE = "yatrasetu-v4";
const ASSETS = ["/", "/static/style.css", "/static/app.js", "/static/voice.js", "/static/i18n.js", "/static/charts.js", "/static/manifest.json"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // revalidate static files with the server (cheap 304 when unchanged) so a new release is never masked by the HTTP cache
  const req = url.pathname.startsWith("/static/") ? new Request(e.request.url, { cache: "no-cache" }) : e.request;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then(hit => hit || caches.match("/"))));
});
