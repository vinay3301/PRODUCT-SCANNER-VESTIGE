const CACHE = "product-scanner-v2";
const CORE = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always check the network for page navigations so users receive the latest
  // deployed app instead of being trapped on a stale cached index.html.
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        return (await caches.match(event.request)) ||
          (await caches.match("./index.html")) ||
          Response.error();
      }
    })());
    return;
  }

  // Keep the lightweight app assets cache-first for offline startup.
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request))
  );
});
