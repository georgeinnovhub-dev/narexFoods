/* NAREX Foods service worker — minimal, staleness-proof PWA caching.
 * - Never touches /api/* (always live).
 * - NETWORK-FIRST for everything, updating the cache on every success.
 *   (Turbopack dev chunks are path-hashed, not content-hashed — cache-first
 *   would serve stale code forever, so we always hit the network first and
 *   only fall back to the cache when offline.)
 */
const CACHE = "narex-v2";
const PRECACHE = ["/", "/narex-logo.svg", "/narex-icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  /* Network-first with cache fallback (offline shell). */
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match("/"))
      )
  );
});
