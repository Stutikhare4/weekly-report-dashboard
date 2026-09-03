const CACHE_NAME = "weekly-dashboard-v83";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./week-templates.json", "./roles-config.json", "./demo-data/index.json", "./demo-data/salad-days.json", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

// Network-first: always serve fresh files when the server is reachable,
// falling back to cache only when offline. This avoids stale assets after updates.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match("./index.html")),
      ),
  );
});
