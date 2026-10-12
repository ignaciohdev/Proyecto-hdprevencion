"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiUrl } from "../../utils/api";

function IngresoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/panel";

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/auth/login/"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Credenciales incorrectas.");
      }

      // Guardar tokens JWT en localStorage
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);

      setSuccess(true);
      setTimeout(() => {
        router.push(nextPath);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex items-center justify-center py-12 px-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-950 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <a href="/" className="group flex flex-col items-center">
            <img src="/logo_light.png" alt="HD Prevención Logo" className="h-16 w-auto block dark:hidden mb-2 group-hover:scale-105 transition-transform" />
            <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-16 w-auto hidden dark:block mb-2 group-hover:scale-105 transition-transform" />
            <span className="text-3xl font-extrabold text-orange-600 tracking-wide">
              HD Prevención
            </span>
          </a>
          <h2 className="text-2xl font-bold mt-4 text-slate-900 dark:text-white">
            Iniciar Sesión
          </h2>
          <p className="text-slate-500 dark:text-slate-450 mt-2 text-sm">
            Ingresa al portal para descargar formatos y gestionar riesgos
          </p>
        </div>

        {/* Notificaciones */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-250 p-3 rounded-xl mb-6 text-sm text-center font-semibold">
            ¡Ingreso exitoso! Redirigiendo...
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Nombre de Usuario
            </label>
            <input
              type="text"
              name="username"
              required
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="Tu nombre de usuario"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Contraseña
              </label>
              <a href="#" className="text-xs text-orange-655 hover:underline">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:scale-100 cursor-pointer"
          >
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </form>

        {/* Footer del card */}
        <div className="text-center mt-6 text-sm text-slate-500 dark:text-slate-450">
          ¿Aún no tienes cuenta?{" "}
          <a href="/registro" className="text-orange-655 hover:text-orange-500 font-semibold underline">
            Regístrate aquí
          </a>
        </div>
      </div>
    </main>
  );
}

export default function Ingreso() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex items-center justify-center py-12 px-4">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    }>
      <IngresoInner />
    </Suspense>
  );
}
