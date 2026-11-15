// Service Worker - HD Prevención PWA Offline-First para Faenas Industriales
// Conforme a estándares modernos de Service Workers y Next.js 16 (App Router)

const CACHE_NAME_PREFIX = "hdprevencion";
const CACHE_VERSION = "v1.1";
const STATIC_CACHE = `${CACHE_NAME_PREFIX}-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_NAME_PREFIX}-dynamic-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_NAME_PREFIX}-api-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/",
  "/panel",
  "/offline.html",
  "/manifest.json",
  "/logo_dark.png",
  "/logo_light.png",
  "/favicon.ico",
];

// 1. INSTALACIÓN: Precachear assets críticos y activar inmediatamente
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[SW] Advertencia al precachear algunos assets:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// 2. ACTIVACIÓN: Limpieza de versiones obsoletas y toma de control inmediata
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName.startsWith(CACHE_NAME_PREFIX) &&
              cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== API_CACHE
            ) {
              console.log("[SW] Eliminando caché antigua:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. FETCH: Estrategias de caché según el tipo de recurso
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no sean HTTP/HTTPS (e.g. extensiones chrome, esquemas raros)
  if (!url.protocol.startsWith("http")) return;

  // A) Solicitudes de mutación (POST, PUT, PATCH, DELETE):
  // Se delegan directamente a la red. El outbox en IndexedDB gestiona los fallos offline.
  if (request.method !== "GET") {
    return;
  }

  // B) Consultas a API de Lectura (GET /api/...):
  // Rutas con datos personales o sensibles que nunca deben persistir en caché compartida (Ley 21.719 A-4)
  const RUTAS_DATOS_PERSONALES = [
    "/api/denuncias",
    "/api/trabajadores",
    "/api/accidentes",
    "/api/investigaciones-accidentes",
    "/api/reportes-riesgo",
    "/api/usuarios",
    "/api/auth",
    "/api/epp",
    "/api/capacitaciones/registro",
  ];

  if (url.pathname.startsWith("/api/")) {
    const esRutaSensible = RUTAS_DATOS_PERSONALES.some((ruta) =>
      url.pathname.startsWith(ruta)
    );

    // Si la ruta contiene datos sensibles o personales, pasa directo a la red sin almacenar en caché
    if (esRutaSensible) {
      event.respondWith(fetch(request));
      return;
    }

    // Estrategia Network-First con fallback a caché de API offline para catálogos y datos no sensibles
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            const headers = new Headers(cachedResponse.headers);
            headers.set("X-HDPrevencion-Offline", "true");
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers,
            });
          }
          return new Response(
            JSON.stringify({
              offline: true,
              detail: "Sin conexión a internet. Datos no disponibles en caché local.",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        })
    );
    return;
  }

  // C) Peticiones de navegación HTML (rutas de la app):
  // Estrategia Network-First con fallback a caché o a la página offline de contingencia
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) {
            return offlinePage;
          }
          return new Response("Operando en Modo Faena Offline (Sin conexión)", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        })
    );
    return;
  }

  // D) Recursos estáticos (Imágenes, scripts, CSS, fuentes):
  // Estrategia Stale-While-Revalidate / Cache-First
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2|woff|ttf|css|js)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // E) Resto de solicitudes: Network con fallback a cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
