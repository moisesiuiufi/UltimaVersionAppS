const CACHE_NAME = "password-app-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/offline.html",
];

// Instalar y cachear recursos esenciales
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of urlsToCache) {
        try {
          const response = await fetch(new Request(url, { cache: "reload" }));
          if (response.ok) await cache.put(url, response.clone());
        } catch (err) {
          console.warn(`No se pudo cachear: ${url}`, err);
        }
      }
    })
  );
  self.skipWaiting(); // Activar inmediatamente
});

// Activar y limpiar cachés antiguos
self.addEventListener("activate", event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cache =>
          !cacheWhitelist.includes(cache) ? caches.delete(cache) : null
        )
      )
    )
  );
  self.clients.claim(); // Tomar control de las páginas
});

// Forzar red y fallback a offline.html
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestURL = new URL(event.request.url);
  const isExternal = requestURL.origin !== self.location.origin;
  const isImage = /\.(png|jpg|jpeg|webp|svg|gif)$/i.test(requestURL.pathname);
  if (isExternal || isImage) return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Si la red responde, también actualizamos caché
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Si no hay red, mostrar offline solo si es navegación
        if (event.request.mode === "navigate") {
          return caches.match("/offline.html");
        }
        // Si no es navegación, intenta devolverlo desde caché
        return caches.match(event.request);
      })
  );
});

  