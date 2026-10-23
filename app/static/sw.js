// Service worker: caches the app shell so the emergency card works offline (NFR-09).
const CACHE = "yatrasetu-v1";
const ASSETS = ["/static/style.css", "/static/app.js", "/static/charts.js", "/static/manifest.json"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
