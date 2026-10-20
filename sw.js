/* Navigome service worker: cache the app shell, never cache API results on error. */
const CACHE = "navigome-v4";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./vikunja.js",
  "./statemachine.js",
  "./config.js",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Auto-token endpoint: network only, never cached (a cached token would survive
  // cache clears and would be readable from the SW cache).
  if (url.origin === self.location.origin && url.pathname.endsWith("/token.json")) {
    event.respondWith(fetch(request));
    return;
  }

  // Vikunja API via same-origin proxy: network-first, cache only 2xx, fallback on network error.
  if (url.origin === self.location.origin && url.pathname.includes("/vikunja-api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || Response.error())),
    );
    return;
  }

  // Same-origin statics: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return res;
          }),
      ),
    );
  }
});
