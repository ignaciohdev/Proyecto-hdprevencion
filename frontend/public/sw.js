// Service Worker - HD Prevención PWA Offline-First para Faenas Industriales
// Conforme a estándares modernos de Service Workers, Next.js 16 (App Router) y Ley N° 21.719

const CACHE_NAME_PREFIX = "hdprevencion";
const CACHE_VERSION = "v1.2";
const STATIC_CACHE = `${CACHE_NAME_PREFIX}-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_NAME_PREFIX}-dynamic-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_NAME_PREFIX}-api-${CACHE_VERSION}`;

// Solo assets públicos estáticos; nunca precachear rutas privadas (/panel)
const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/logo_dark.png",
  "/logo_light.png",
  "/favicon.ico",
];

// Prefijos explícitos de datos personales/sensibles o contexto multi-tenant (nunca cachear)
const RUTAS_DATOS_PERSONALES = [
  "/api/auth",
  "/api/usuarios",
  "/api/documentos-usuario",
  "/api/contacto",
  "/api/solicitudes-capacitacion",
  "/api/reportes-riesgo",
  "/api/inspecciones",
  "/api/accidentes",
  "/api/registro-capacitacion",
  "/api/buzon",
  "/api/contratistas",
  "/api/documentos-contratista",
  "/api/trabajadores-subcontratados",
  "/api/empresas",
  "/api/centros-trabajo",
  "/api/trabajadores",
  "/api/sugerencias-laborales",
  "/api/denuncias-ley-karin",
  "/api/comites-paritarios",
  "/api/miembros-cphs",
  "/api/actas-cphs",
  "/api/entregas-epp",
  "/api/matrices-legales",
  "/api/items-matriz-legal",
  "/api/matrices-riesgo-miper",
  "/api/items-matriz-riesgo",
  "/api/privacidad",
  "/api/dashboard",
  "/api/publico",
];

// Allowlist de catálogos exclusivamente públicos y libres de PII elegibles para fallback offline
const RUTAS_CATALOGO_PUBLICO = [
  "/api/noticias",
  "/api/servicios",
  "/api/planes",
  "/api/plantillas-maestras",
  "/api/plantillas-inspeccion",
  "/api/temas-capacitacion",
  "/api/requisitos-legales-base",
  "/api/clima",
];

// Rutas HTML autenticadas o con formularios personales que no deben almacenarse en DYNAMIC_CACHE
const RUTAS_NAVEGACION_PRIVADAS = [
  "/panel",
  "/ingreso",
  "/registro",
  "/derechos-arco",
];

// 1. INSTALACIÓN: Precachear assets públicos críticos y activar inmediatamente
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

// 2. ACTIVACIÓN: Limpieza de versiones obsoletas (incluida v1.1) y toma de control inmediata
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

// 3. FETCH: Estrategias de caché con privacidad por defecto (Art. 14 quáter Ley 21.719)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.protocol.startsWith("http")) return;

  // A) Mutaciones (POST, PUT, PATCH, DELETE): directo a red
  if (request.method !== "GET") {
    return;
  }

  // B) Consultas a API de Lectura (GET /api/...):
  if (url.pathname.startsWith("/api/")) {
    const esRutaSensible = RUTAS_DATOS_PERSONALES.some((ruta) =>
      url.pathname.startsWith(ruta)
    );
    const esCatalogoPublico = RUTAS_CATALOGO_PUBLICO.some((ruta) =>
      url.pathname.startsWith(ruta)
    );

    // Política privacy-by-default: toda ruta sensible o fuera de allowlist va directo a red sin caché
    if (esRutaSensible || !esCatalogoPublico) {
      event.respondWith(fetch(request));
      return;
    }

    // Catálogos públicos no personales: Network-First con fallback a API_CACHE
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

  // C) Peticiones de navegación HTML:
  // Nunca almacenar en caché rutas privadas (/panel/*, auth, ARCO)
  if (request.mode === "navigate") {
    const esNavegacionPrivada = RUTAS_NAVEGACION_PRIVADAS.some((ruta) =>
      url.pathname.startsWith(ruta)
    );

    if (esNavegacionPrivada) {
      event.respondWith(
        fetch(request).catch(async () => {
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

    // Rutas públicas HTML: Network-First con fallback a caché o página offline
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

  // E) Resto de solicitudes: Network directo sin caché
  event.respondWith(fetch(request));
});
