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
    return `http://${hostname}:8000${apiPath}`;
  }
  // Fallback para ejecución del lado del servidor (SSR)
  return `http://localhost:8000${apiPath}`;
};

// Singleton Promise para evitar múltiples llamadas concurrentes de refresh
let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresca el access token utilizando la Cookie HttpOnly rotativa
 * o el refresh_token guardado en localStorage como fallback (soporte dual).
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const storedRefresh = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;

      const res = await fetch(getApiUrl("/api/auth/token/refresh/"), {
        method: "POST",
        credentials: "include", // Envía la cookie HttpOnly entre Vercel y Render
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(storedRefresh ? { refresh: storedRefresh } : {}),
      });

      if (!res.ok) {
        throw new Error("No se pudo refrescar la sesión (token inválido o expirado).");
      }

      const data = await res.json();
      const newAccess = data.access;

      if (newAccess && typeof window !== "undefined") {
        localStorage.setItem("access_token", newAccess);
        if (data.refresh) {
          localStorage.setItem("refresh_token", data.refresh);
        }
      }
      return newAccess || null;
    } catch {
      // Si el refresh de 7 días falla o está en la blacklist, limpiar credenciales y redirigir
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_info");
        if (window.location.pathname !== "/ingreso" && !window.location.pathname.startsWith("/participacion") && !window.location.pathname.startsWith("/capacitaciones/firmar")) {
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
 * Helper para obtener headers de autenticación estándar
 */
export const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * authFetch: Interceptor HTTP transparente para DRF + Next.js
 * - Inyecta credentials: 'include' para compatibilidad cross-domain con cookies.
 * - Inyecta Authorization: Bearer <token>.
 * - Si recibe 401 Unauthorized, refresca silenciosamente el token y reintenta la petición.
 * - Si el refresh de 7 días falla, redirige limpiamente a /ingreso.
 */
export const authFetch = async (
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> => {
  const url = typeof input === "string"
    ? (input.startsWith("http://") || input.startsWith("https://") ? input : getApiUrl(input))
    : input;

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const headers = new Headers(init.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...init,
    credentials: "include",
    headers,
  };

  let response = await fetch(url, fetchOptions);

  // Si la petición falla con 401 y no ha sido reintentada aún
  if (response.status === 401 && !(init as any)._isRetry) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      const retryHeaders = new Headers(init.headers || {});
      retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);

      const retryOptions: RequestInit = {
        ...init,
        credentials: "include",
        headers: retryHeaders,
        // Marcador interno para prevenir bucles infinitos
        ...({ _isRetry: true } as any),
      };

      response = await fetch(url, retryOptions);
    }
  }

  return response;
};

/**
 * Cierre de sesión seguro:
 * Invalida el refresh token en el backend (blacklist) y borra la cookie HttpOnly.
 */
export const logoutAuth = async (): Promise<void> => {
  try {
    const storedRefresh = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
    await fetch(getApiUrl("/api/auth/logout/"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(storedRefresh ? { refresh: storedRefresh } : {}),
    });
  } catch {
    // Silencioso
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_info");
      window.location.href = "/ingreso";
    }
  }
};
