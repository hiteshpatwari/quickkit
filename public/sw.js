const CACHE = "quickkit-shell-v5";
const SHELL = ["/", "/favorites", "/settings", "/privacy", "/about", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([self.skipWaiting(), caches.open(CACHE).then((cache) => cache.addAll(SHELL))]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && ["document", "script", "style", "font", "worker"].includes(request.destination)) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
  );
});
