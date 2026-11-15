/* Günün Panosu — çevrimdışı desteği.
   Dosyaları değiştirdiğinizde CACHE adındaki sürümü artırın (v1 → v2). */
const CACHE = "gunluk-pano-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/ikon.svg",
  "./assets/ikon-180.png",
  "./assets/ikon-192.png",
  "./assets/ikon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // İçerik her zaman ağdan gelir; önbelleğe alınmaz.
  if (url.pathname.endsWith("/content.json")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // Sayfa açılışı: önce ağ (güncel sürüm), çevrimdışıysa önbellek.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("./index.html")),
        ),
    );
    return;
  }

  // Statik dosyalar: önce ağ (güncel sürüm), çevrimdışıysa önbellek.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
