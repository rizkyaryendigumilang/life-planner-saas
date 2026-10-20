const CACHE_NAME = "life-planner-v1";

function resolveScopeAssets() {
  const scope = self.registration ? self.registration.scope : self.location.href;
  return [
    new URL("./", scope).pathname,
    new URL("index.html", scope).pathname,
    new URL("manifest.webmanifest", scope).pathname,
    new URL("brand-mark.svg", scope).pathname,
    new URL("brand-mark.png", scope).pathname,
    new URL("pwa-192x192.png", scope).pathname,
    new URL("pwa-512x512.png", scope).pathname,
    new URL("apple-touch-icon.png", scope).pathname,
    new URL("favicon-32x32.png", scope).pathname,
    new URL("favicon.png", scope).pathname,
  ];
}

// Install event: Pre-cache static app shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const assets = resolveScopeAssets();
      return cache.addAll(assets).catch((err) => {
        console.warn("PWA: Failed to cache some static assets during install:", err);
      });
    })
  );
});

// Activate event: Clean up previous caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      }),
    ])
  );
});

// Fetch event: Network-first for pages and API, Cache-first for icons and images
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API requests, PocketBase backend, or OAuth endpoints
  if (
    url.pathname.startsWith("/api") ||
    url.port === "8090" ||
    url.port === "3001" ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // Cache-first for icons and static images
  if (
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-first for app shell & scripts with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get("accept")?.includes("text/html")) {
            const indexUrl = new URL("index.html", self.registration ? self.registration.scope : self.location.href).pathname;
            return caches.match(indexUrl);
          }
        });
      })
  );
});
