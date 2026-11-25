/**
 * Gestor de Base de Datos Local en Terreno (IndexedDB + Outbox Pattern)
 * Diseñado para operaciones en faenas mineras, forestales y de construcción sin señal de red.
 * Incluye expiración automática (TTL) y limpieza integral al cierre de sesión (data-privacy-by-design).
 */

import { authFetch, getApiUrl } from "./api";

const DB_NAME = "HDPrevencion_Offline_DB";
const DB_VERSION = 1;

export const OFFLINE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas para cachés en dispositivo
export const OFFLINE_QUEUE_TTL_MS = 72 * 60 * 60 * 1000; // 72 horas máximo para cola pendiente

let purgePromise: Promise<{ queueRemoved: number; matricesRemoved: number; charlasRemoved: number }> | null = null;
let lastPurgeAt = 0;

export interface ColaItem {
  id?: number;
  url: string;
  method: string;
  payload: any;
  headers?: Record<string, string>;
  timestamp: number;
  expiresAt?: number;
  reintentos: number;
  status: "PENDING" | "SYNCING" | "FAILED";
  errorMsg?: string;
  descripcion?: string;
}

export interface MatrizOffline {
  id: number;
  data: any;
  timestamp: number;
  expiresAt?: number;
  empresaId?: number;
}

export interface CharlaOffline {
  id: number | string;
  data: any;
  timestamp: number;
  expiresAt?: number;
}

function isRecordExpired(record: { timestamp?: number; expiresAt?: number } | null | undefined, defaultTtlMs: number, now = Date.now()): boolean {
  if (!record) return true;
  if (typeof record.expiresAt === "number") {
    return now >= record.expiresAt;
  }
  if (typeof record.timestamp === "number") {
    return now >= record.timestamp + defaultTtlMs;
  }
  return true;
}

function openRawOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB no está disponible en este entorno."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Cola de peticiones offline (Outbox pattern)
      if (!db.objectStoreNames.contains("offline_queue")) {
        const queueStore = db.createObjectStore("offline_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        queueStore.createIndex("timestamp", "timestamp", { unique: false });
        queueStore.createIndex("status", "status", { unique: false });
      }

      // 2. Caché local de matrices IPERC
      if (!db.objectStoreNames.contains("cached_matrices")) {
        const matrixStore = db.createObjectStore("cached_matrices", {
          keyPath: "id",
        });
        matrixStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // 3. Caché local de capacitaciones y charlas en terreno
      if (!db.objectStoreNames.contains("cached_charlas")) {
        const charlasStore = db.createObjectStore("cached_charlas", {
          keyPath: "id",
        });
        charlasStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function purgeExpiredInStore(
  db: IDBDatabase,
  storeName: "offline_queue" | "cached_matrices" | "cached_charlas",
  ttlMs: number,
  now: number
): Promise<number> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      let removed = 0;

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (isRecordExpired(cursor.value, ttlMs, now)) {
          cursor.delete();
          removed++;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => resolve(removed);
      tx.onabort = () => resolve(removed);
    } catch {
      resolve(0);
    }
  });
}

/**
 * Elimina registros expirados según su TTL en todos los almacenes de IndexedDB.
 */
export async function purgarOfflineExpirados(
  now: number = Date.now()
): Promise<{ queueRemoved: number; matricesRemoved: number; charlasRemoved: number }> {
  if (purgePromise) return purgePromise;

  purgePromise = (async () => {
    try {
      const db = await openRawOfflineDb();
      const [queueRemoved, matricesRemoved, charlasRemoved] = await Promise.all([
        purgeExpiredInStore(db, "offline_queue", OFFLINE_QUEUE_TTL_MS, now),
        purgeExpiredInStore(db, "cached_matrices", OFFLINE_CACHE_TTL_MS, now),
        purgeExpiredInStore(db, "cached_charlas", OFFLINE_CACHE_TTL_MS, now),
      ]);
      lastPurgeAt = now;
      if (queueRemoved > 0 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("hdprevencion:queue-updated"));
      }
      return { queueRemoved, matricesRemoved, charlasRemoved };
    } catch {
      return { queueRemoved: 0, matricesRemoved: 0, charlasRemoved: 0 };
    } finally {
      purgePromise = null;
    }
  })();

  return purgePromise;
}

/**
 * Limpieza integral de todos los datos locales offline (usado en cierre de sesión o expiración).
 */
export async function limpiarTodoOfflineStorage(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openRawOfflineDb();
    await new Promise<void>((resolve) => {
      try {
        const storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length === 0) {
          resolve();
          return;
        }
        const tx = db.transaction(storeNames, "readwrite");
        for (const name of storeNames) {
          tx.objectStore(name).clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
    db.close();
  } catch {
    // Silencioso
  }

  try {
    window.indexedDB.deleteDatabase(DB_NAME);
  } catch {
    // Silencioso
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hdprevencion:queue-updated"));
  }
}

/**
 * Inicializa y actualiza el esquema de IndexedDB ejecutando purga periódica de TTL.
 */
export async function openOfflineDb(): Promise<IDBDatabase> {
  const db = await openRawOfflineDb();
  const now = Date.now();
  if (now - lastPurgeAt > 60_000) {
    lastPurgeAt = now;
    void purgarOfflineExpirados(now);
  }
  return db;
}

/**
 * Guarda una petición pendiente en la cola de salida (Outbox) con TTL.
 */
export async function guardarEnCola(
  url: string,
  method: string,
  payload: any,
  descripcion?: string,
  headers?: Record<string, string>
): Promise<number> {
  const db = await openOfflineDb();
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");

    const item: ColaItem = {
      url,
      method: method.toUpperCase(),
      payload,
      headers: headers || { "Content-Type": "application/json" },
      timestamp: now,
      expiresAt: now + OFFLINE_QUEUE_TTL_MS,
      reintentos: 0,
      status: "PENDING",
      descripcion: descripcion || `${method.toUpperCase()} ${url}`,
    };

    const request = store.add(item);
    request.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("hdprevencion:queue-updated"));
      }
      resolve(request.result as number);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todas las peticiones vigentes (no expiradas) pendientes de sincronización
 */
export async function obtenerColaPendiente(): Promise<ColaItem[]> {
  try {
    const db = await openOfflineDb();
    const now = Date.now();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("offline_queue", "readonly");
      const store = tx.objectStore("offline_queue");
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result || []) as ColaItem[];
        resolve(items.filter((item) => !isRecordExpired(item, OFFLINE_QUEUE_TTL_MS, now)));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("[OfflineStorage] Error al leer cola pendiente:", err);
    return [];
  }
}

/**
 * Cuenta la cantidad de peticiones vigentes pendientes en cola
 */
export async function contarColaPendiente(): Promise<number> {
  const items = await obtenerColaPendiente();
  return items.length;
}

/**
 * Elimina un elemento sincronizado de la cola
 */
export async function eliminarDeCola(id: number): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");
    const request = store.delete(id);

    request.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("hdprevencion:queue-updated"));
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Actualiza el estado o mensaje de error de un ítem en cola
 */
export async function actualizarItemCola(
  id: number,
  cambios: Partial<ColaItem>
): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) {
        resolve();
        return;
      }
      const updated = { ...item, ...cambios };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Sincroniza todas las peticiones pendientes vigentes con el servidor Django
 */
export async function sincronizarColaConServidor(): Promise<{
  total: number;
  exitosas: number;
  fallidas: number;
}> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { total: 0, exitosas: 0, fallidas: 0 };
  }

  await purgarOfflineExpirados();
  const items = await obtenerColaPendiente();
  if (items.length === 0) {
    return { total: 0, exitosas: 0, fallidas: 0 };
  }

  let exitosas = 0;
  let fallidas = 0;

  for (const item of items) {
    if (!item.id) continue;

    try {
      await actualizarItemCola(item.id, { status: "SYNCING" });

      const requestUrl = item.url.startsWith("http") ? item.url : getApiUrl(item.url);
      const res = await authFetch(requestUrl, {
        method: item.method,
        headers: item.headers || { "Content-Type": "application/json" },
        body: item.payload ? JSON.stringify(item.payload) : undefined,
      });

      if (res.ok) {
        await eliminarDeCola(item.id);
        exitosas++;
      } else {
        const errorText = await res.text().catch(() => "Error en respuesta del servidor");
        await actualizarItemCola(item.id, {
          status: "FAILED",
          reintentos: (item.reintentos || 0) + 1,
          errorMsg: `HTTP ${res.status}: ${errorText.substring(0, 120)}`,
        });
        fallidas++;
      }
    } catch (err: any) {
      await actualizarItemCola(item.id, {
        status: "FAILED",
        reintentos: (item.reintentos || 0) + 1,
        errorMsg: err.message || "Fallo de red durante la sincronización",
      });
      fallidas++;
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hdprevencion:sync-completed", {
        detail: { total: items.length, exitosas, fallidas },
      })
    );
    window.dispatchEvent(new CustomEvent("hdprevencion:queue-updated"));
  }

  return { total: items.length, exitosas, fallidas };
}

// -------------------------------------------------------------
// CACHÉ LOCAL DE MATRICES IPERC Y CAPACITACIONES (CONSULTA OFFLINE CON TTL)
// -------------------------------------------------------------

export async function guardarMatrizOffline(matriz: any): Promise<void> {
  if (!matriz || !matriz.id) return;
  try {
    const db = await openOfflineDb();
    const now = Date.now();
    const tx = db.transaction("cached_matrices", "readwrite");
    const store = tx.objectStore("cached_matrices");
    store.put({
      id: matriz.id,
      data: matriz,
      timestamp: now,
      expiresAt: now + OFFLINE_CACHE_TTL_MS,
      empresaId: matriz.empresa,
    });
  } catch (err) {
    console.warn("[OfflineStorage] No se pudo guardar matriz offline:", err);
  }
}

export async function obtenerMatrizOffline(id: number): Promise<any | null> {
  try {
    const db = await openOfflineDb();
    const now = Date.now();
    return new Promise((resolve) => {
      const tx = db.transaction("cached_matrices", "readwrite");
      const store = tx.objectStore("cached_matrices");
      const req = store.get(id);
      req.onsuccess = () => {
        const rec = req.result as MatrizOffline | undefined;
        if (!rec || isRecordExpired(rec, OFFLINE_CACHE_TTL_MS, now)) {
          if (rec) store.delete(id);
          resolve(null);
          return;
        }
        resolve(rec.data);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function obtenerTodasMatricesOffline(): Promise<any[]> {
  try {
    const db = await openOfflineDb();
    const now = Date.now();
    return new Promise((resolve) => {
      const tx = db.transaction("cached_matrices", "readonly");
      const store = tx.objectStore("cached_matrices");
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as MatrizOffline[];
        resolve(
          list
            .filter((r) => !isRecordExpired(r, OFFLINE_CACHE_TTL_MS, now))
            .map((r) => r.data)
        );
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function guardarCharlaOffline(charla: any): Promise<void> {
  if (!charla || !charla.id) return;
  try {
    const db = await openOfflineDb();
    const now = Date.now();
    const tx = db.transaction("cached_charlas", "readwrite");
    const store = tx.objectStore("cached_charlas");
    store.put({
      id: charla.id,
      data: charla,
      timestamp: now,
      expiresAt: now + OFFLINE_CACHE_TTL_MS,
    });
  } catch (err) {
    console.warn("[OfflineStorage] No se pudo guardar charla offline:", err);
  }
}

export async function obtenerTodasCharlasOffline(): Promise<any[]> {
  try {
    const db = await openOfflineDb();
    const now = Date.now();
    return new Promise((resolve) => {
      const tx = db.transaction("cached_charlas", "readonly");
      const store = tx.objectStore("cached_charlas");
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as CharlaOffline[];
        resolve(
          list
            .filter((r) => !isRecordExpired(r, OFFLINE_CACHE_TTL_MS, now))
            .map((r) => r.data)
        );
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
