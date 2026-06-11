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
    // Si estamos en el navegador, usamos el hostname actual (ej: localhost o 192.168.18.13)
    const hostname = window.location.hostname;
    return `http://${hostname}:8000${apiPath}`;
  }
  // Fallback para ejecución del lado del servidor (SSR)
  return `http://localhost:8000${apiPath}`;
};

