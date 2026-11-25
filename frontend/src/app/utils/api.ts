import { limpiarTodoOfflineStorage } from "./offlineStorage";

export interface SessionUserInfo {
  id?: number;
  username?: string;
  email?: string;
  tipo_usuario?: string;
  cuenta_padre_id?: number | null;
  is_superuser?: boolean;
  is_staff?: boolean;
  mfa_enabled?: boolean;
  mfa_obligatorio?: boolean;
  exp?: number;
}

// Almacenamiento exclusivo en memoria para Access Token (mitigación XSS - data-privacy-by-design)
let inMemoryAccessToken: string | null = null;
let cachedSessionUser: SessionUserInfo | null | undefined = undefined;
let sessionCheckPromise: Promise<SessionUserInfo | null> | null = null;

// Helper para resolver la URL base del backend de forma dinámica
export const getApiUrl = (path: string): string => {
  const apiPath = path.startsWith('/') ? path : `/${path}`;

  // Si está definida la variable de entorno, la usamos directamente (producción en Vercel)
  if (process.env.NEXT_PUBLIC_API_URL) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL.endsWith('/')
      ? process.env.NEXT_PUBLIC_API_URL.slice(0, -1)
      : process.env.NEXT_PUBLIC_API_URL;
    return `${baseUrl}${apiPath}`;
  }

  if (typeof window !== "undefined") {
    // Si estamos en el navegador, usamos el hostname actual (ej: localhost o IP de red local)
    const hostname = window.location.hostname;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.");
    if (!isLocal) {
      console.warn(
        `[HD Prevención] ADVERTENCIA: NEXT_PUBLIC_API_URL no está configurada en el entorno de despliegue (Vercel). Las peticiones hacia ${apiPath} podrían fallar si el backend está en otro dominio (ej. Render).`
      );
    }
    return `http://${hostname}:8000${apiPath}`;
  }
  // Fallback para ejecución del lado del servidor (SSR)
  return `http://localhost:8000${apiPath}`;
};

// Helper para construir rutas hacia el panel de administración backend (DJANGO_ADMIN_PATH)
export const getAdminUrl = (subpath: string = ""): string => {
  const adminBase = (process.env.NEXT_PUBLIC_ADMIN_PATH || "sst-control-panel")
    .replace(/^\/+|\/+$/g, "");
  const cleanSubpath = subpath.replace(/^\/+/, "");
  return getApiUrl(`/${adminBase}/${cleanSubpath}`);
};

/**
 * Elimina cualquier residuo heredado de tokens en localStorage.
 */
export const clearLegacyTokenStorage = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_info");
  } catch {
    // Silencioso
  }
};

function decodeJwtPayload(token: string | null): SessionUserInfo | null {
  if (!token || typeof window === "undefined") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const jsonPayload = decodeURIComponent(
      window
        .atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as SessionUserInfo;
  } catch {
    return null;
  }
}

export const setAccessToken = (token: string | null): void => {
  inMemoryAccessToken = token;
  cachedSessionUser = token ? decodeJwtPayload(token) : null;
  clearLegacyTokenStorage();
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const getTokenPayload = (): SessionUserInfo | null => {
  return decodeJwtPayload(inMemoryAccessToken);
};

function isTokenFresh(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp * 1000 > Date.now() + 10_000;
}

/**
 * Parser seguro de respuestas HTTP para evitar errores de sintaxis 'Unexpected token <'
 * cuando el servidor responde con HTML (404 de Vercel o 502/503/504 por spin-down de Render).
 */
export async function parseJsonResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (response.status === 404) {
      throw new Error(
        "No se encontró el servicio backend (Error 404). Verifica que NEXT_PUBLIC_API_URL esté configurado en Vercel y que el backend de Render esté desplegado."
      );
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error(
        "El servidor en Render se está iniciando (arranque en frío del plan gratuito). Por favor, espera 30 segundos y vuelve a intentar."
      );
    }
    throw new Error(
      `El servidor respondió con formato inesperado (Código HTTP ${response.status}). Posible falla en el servicio o cold-start de Render.`
    );
  }
  return response.json();
}

// Singleton Promise para evitar múltiples llamadas concurrentes de refresh
let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresca el access token en memoria utilizando exclusivamente la Cookie HttpOnly rotativa.
 */
export const refreshAccessToken = async (
  options: { redirectOnFail?: boolean } = {}
): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;
  const { redirectOnFail = true } = options;

  refreshPromise = (async () => {
    try {
      const res = await fetch(getApiUrl("/api/auth/token/refresh/"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error("No se pudo refrescar la sesión (cookie inválida o expirada).");
      }

      const data = await res.json();
      const newAccess: string | null = data.access || null;
      setAccessToken(newAccess);
      return newAccess;
    } catch {
      setAccessToken(null);
      if (typeof window !== "undefined") {
        void limpiarTodoOfflineStorage();
        if (
          redirectOnFail &&
          window.location.pathname !== "/ingreso" &&
          !window.location.pathname.startsWith("/participacion") &&
          !window.location.pathname.startsWith("/capacitaciones/firmar")
        ) {
          window.location.href = "/ingreso";
        }
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Asegura un access token vigente en memoria mediante refresh silencioso con Cookie HttpOnly.
 */
export const ensureAccessToken = async (): Promise<string | null> => {
  clearLegacyTokenStorage();
  if (isTokenFresh(inMemoryAccessToken)) {
    return inMemoryAccessToken;
  }
  return refreshAccessToken({ redirectOnFail: false });
};

/**
 * Consulta silenciosa de sesión activa para vistas públicas/navegación sin escribir tokens en localStorage.
 */
export const getSessionUser = async (): Promise<SessionUserInfo | null> => {
  clearLegacyTokenStorage();
  if (isTokenFresh(inMemoryAccessToken)) {
    return decodeJwtPayload(inMemoryAccessToken);
  }
  if (cachedSessionUser !== undefined) {
    return cachedSessionUser;
  }
  if (sessionCheckPromise) return sessionCheckPromise;

  sessionCheckPromise = (async () => {
    try {
      const res = await fetch(getApiUrl("/api/auth/session/"), {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        cachedSessionUser = null;
        return null;
      }
      const data = await res.json();
      if (data?.authenticated && data.user) {
        cachedSessionUser = data.user as SessionUserInfo;
        return cachedSessionUser;
      }
      cachedSessionUser = null;
      return null;
    } catch {
      return null;
    } finally {
      sessionCheckPromise = null;
    }
  })();

  return sessionCheckPromise;
};

/**
 * Helper para obtener headers de autenticación estándar desde memoria.
 */
export const getAuthHeaders = (): Record<string, string> => {
  return inMemoryAccessToken ? { Authorization: `Bearer ${inMemoryAccessToken}` } : {};
};

/**
 * authFetch: Interceptor HTTP transparente para DRF + Next.js
 * - Mantiene Access Token solo en memoria y Refresh Token exclusivamente en Cookie HttpOnly.
 * - Realiza refresh silencioso automático tras recarga de página o expiración de access token (401).
 */
export const authFetch = async (
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> => {
  const url = typeof input === "string"
    ? (input.startsWith("http://") || input.startsWith("https://") ? input : getApiUrl(input))
    : input;

  const headers = new Headers(init.headers || {});
  let token = inMemoryAccessToken;

  if (!headers.has("Authorization") && !(init as any)._skipAutoRefresh) {
    if (!isTokenFresh(token)) {
      token = await refreshAccessToken({ redirectOnFail: false });
    }
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...init,
    credentials: "include",
    headers,
  };

  let response = await fetch(url, fetchOptions);

  if (response.status === 401 && !(init as any)._isRetry) {
    const newAccessToken = await refreshAccessToken({
      redirectOnFail: (init as any).redirectOnFail ?? true,
    });
    if (newAccessToken) {
      const retryHeaders = new Headers(init.headers || {});
      retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);

      const retryOptions: RequestInit = {
        ...init,
        credentials: "include",
        headers: retryHeaders,
        ...({ _isRetry: true } as any),
      };

      response = await fetch(url, retryOptions);
    }
  }

  return response;
};

/**
 * Cierre de sesión seguro:
 * Invalida el refresh token de la cookie HttpOnly en el backend y limpia memoria, caches SW e IndexedDB.
 */
export const logoutAuth = async (): Promise<void> => {
  try {
    await fetch(getApiUrl("/api/auth/logout/"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  } catch {
    // Silencioso
  } finally {
    setAccessToken(null);
    if (typeof window !== "undefined") {
      clearLegacyTokenStorage();
      sessionStorage.clear();

      if ("caches" in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys
              .filter((k) => k.startsWith("hdprevencion"))
              .map((k) => caches.delete(k))
          );
        } catch {
          // Silencioso
        }
      }

      await limpiarTodoOfflineStorage();
      window.location.href = "/ingreso";
    }
  }
};
