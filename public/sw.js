// Retirement worker: recover clients controlled by the legacy navigation cache.
// Never substitute home-page HTML for another route or intercept RSC requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("shwasa-")) await caches.delete(key);
      await self.clients.claim();
      await self.registration.unregister();
    })(),
  ),
);
