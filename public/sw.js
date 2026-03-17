const CACHE_NAME = "goje-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/icon-512x512.png",
  "/icon-192x192.png",
  "/audio/start_work.mp3",
  "/audio/start_rest.mp3",
  "/audio/countdown.mp3",
  "/audio/finish.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});
