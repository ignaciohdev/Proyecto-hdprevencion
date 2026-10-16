/**
 * Gestor de Base de Datos Local en Terreno (IndexedDB + Outbox Pattern)
 * Diseñado para operaciones en faenas mineras, forestales y de construcción sin señal de red.
 */

import { authFetch, getApiUrl } from "./api";

const DB_NAME = "HDPrevencion_Offline_DB";
const DB_VERSION = 1;

export interface ColaItem {
  id?: number;
  url: string;
  method: string;
  payload: any;
  headers?: Record<string, string>;
  timestamp: number;
  reintentos: number;
  status: "PENDING" | "SYNCING" | "FAILED";
  errorMsg?: string;
  descripcion?: string;
}

export interface MatrizOffline {
  id: number;
  data: any;
  timestamp: number;
  empresaId?: number;
}

export interface CharlaOffline {
  id: number | string;
  data: any;
  timestamp: number;
}

/**
 * Inicializa y actualiza el esquema de IndexedDB
 */
export function openOfflineDb(): Promise<IDBDatabase> {
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

/**
 * Guarda una petición pendiente en la cola de salida (Outbox)
 */
export async function guardarEnCola(
  url: string,
  method: string,
  payload: any,
  descripcion?: string,
  headers?: Record<string, string>
): Promise<number> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");

    const item: ColaItem = {
      url,
      method: method.toUpperCase(),
      payload,
      headers: headers || { "Content-Type": "application/json" },
      timestamp: Date.now(),
      reintentos: 0,
      status: "PENDING",
      descripcion: descripcion || `${method.toUpperCase()} ${url}`,
    };

    const request = store.add(item);
    request.onsuccess = () => {
      // Disparar evento global para alertar a la UI
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("hdprevencion:queue-updated"));
      }
      resolve(request.result as number);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todas las peticiones pendientes de sincronización
 */
export async function obtenerColaPendiente(): Promise<ColaItem[]> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("offline_queue", "readonly");
      const store = tx.objectStore("offline_queue");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("[OfflineStorage] Error al leer cola pendiente:", err);
    return [];
  }
}

/**
 * Cuenta la cantidad de peticiones pendientes en cola
 */
export async function contarColaPendiente(): Promise<number> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("offline_queue", "readonly");
      const store = tx.objectStore("offline_queue");
      const request = store.count();

      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return 0;
  }
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
 * Sincroniza todas las peticiones pendientes con el servidor Django
 * Se dispara automáticamente al recuperar la señal 'online'
 */
export async function sincronizarColaConServidor(): Promise<{
  total: number;
  exitosas: number;
  fallidas: number;
}> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { total: 0, exitosas: 0, fallidas: 0 };
  }

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

  // Notificar al sistema que la sincronización ha concluido
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
// CACHÉ LOCAL DE MATRICES IPERC Y CAPACITACIONES (CONSULTA OFFLINE)
// -------------------------------------------------------------

export async function guardarMatrizOffline(matriz: any): Promise<void> {
  if (!matriz || !matriz.id) return;
  try {
    const db = await openOfflineDb();
    const tx = db.transaction("cached_matrices", "readwrite");
    const store = tx.objectStore("cached_matrices");
    store.put({
      id: matriz.id,
      data: matriz,
      timestamp: Date.now(),
      empresaId: matriz.empresa,
    });
  } catch (err) {
    console.warn("[OfflineStorage] No se pudo guardar matriz offline:", err);
  }
}

export async function obtenerMatrizOffline(id: number): Promise<any | null> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction("cached_matrices", "readonly");
      const store = tx.objectStore("cached_matrices");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function obtenerTodasMatricesOffline(): Promise<any[]> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction("cached_matrices", "readonly");
      const store = tx.objectStore("cached_matrices");
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map((r: any) => r.data));
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
    const tx = db.transaction("cached_charlas", "readwrite");
    const store = tx.objectStore("cached_charlas");
    store.put({
      id: charla.id,
      data: charla,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn("[OfflineStorage] No se pudo guardar charla offline:", err);
  }
}

export async function obtenerTodasCharlasOffline(): Promise<any[]> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction("cached_charlas", "readonly");
      const store = tx.objectStore("cached_charlas");
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map((r: any) => r.data));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
