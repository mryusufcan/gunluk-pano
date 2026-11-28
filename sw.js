/* Günün Panosu - çevrimdışı desteği.
   CACHE adı yayın sırasında commit SHA'sı ile değiştirilir
   (.github/workflows/pages.yml); elle sürüm artırmak gerekmez.
   Yeni dosya eklerken ASSETS listesine de ekleyin. */
const CACHE = "gunluk-pano-__CACHE_VERSION__";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./assets/inter.css",
  "./assets/inter-latin.woff2",
  "./assets/inter-latin-ext.woff2",
  "./app.js",
  "./phones.enc",
  "./manifest.webmanifest",
  "./assets/ikon.svg",
  "./assets/ikon-32.png",
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

  // Sayfa ve kod dosyaları: önce ağ (güncel sürüm), çevrimdışıysa önbellek.
  if (request.mode === "navigate" || /\.(?:html|js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
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

  // Statik dosyalar: önce önbellek (anında açılış), arka planda tazele.
  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit || new Response("Çevrimdışı", { status: 504 }));
      return hit || fresh;
    }),
  );
});
