"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl, parseJsonResponse } from "../../utils/api";

export default function Registro() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
  });
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [aceptaMarketing, setAceptaMarketing] = useState(false);

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

    // Validación básica en frontend
    if (formData.password !== formData.password_confirm) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    if (!aceptaPrivacidad) {
      setError("Debes leer la Política de Privacidad y aceptar los Términos y Condiciones del Servicio para crear tu cuenta.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.password_confirm,
        acepta_privacidad: aceptaPrivacidad,
        acepta_marketing: aceptaMarketing,
      };

      const response = await fetch(getApiUrl("/api/auth/register/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        // Manejar errores de validación de Django
        const errorMessages = Object.entries(data)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(" ") : value}`)
          .join(" | ");
        throw new Error(errorMessages || "Error en el registro.");
      }

      // Guardar tokens JWT en localStorage
      localStorage.setItem("access_token", data.tokens.access);
      localStorage.setItem("refresh_token", data.tokens.refresh);
      localStorage.setItem("user_info", JSON.stringify(data.user));

      setSuccess(true);
      setTimeout(() => {
        // Redirigir al inicio o panel
        router.push("/panel");
      }, 2000);
    } catch (err: any) {
      if (err.name === "TypeError" || err.message === "Failed to fetch") {
        setError(`No se pudo conectar con el backend (${getApiUrl("/api/auth/register/")}). Verifica que el servicio en Render esté encendido en estado 'Live'.`);
      } else {
        setError(err.message || "Ocurrió un error inesperado.");
      }
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
            Crear una cuenta nueva
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Regístrate para gestionar y descargar tus formatos de seguridad
          </p>
        </div>

        {/* Notificaciones */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-xl mb-6 text-sm text-center font-semibold">
            ¡Registro exitoso! Iniciando sesión...
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
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
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="ej. JuanPerez"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Correo Electrónico
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="correo@ejemplo.cl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="******"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Confirmar Clave
              </label>
              <input
                type="password"
                name="password_confirm"
                required
                value={formData.password_confirm}
                onChange={handleChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="******"
              />
            </div>
          </div>

          {/* Consentimientos explícitos (no premarcados - Art. 12 y 14 ter Ley 21.719) */}
          <div className="space-y-2.5 pt-1 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={aceptaPrivacidad}
                onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                required
                className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 shrink-0"
              />
              <span>
                He leído la{" "}
                <a href="/privacidad" target="_blank" className="text-orange-600 hover:underline font-semibold">
                  Política de Privacidad
                </a>{" "}
                y acepto los{" "}
                <a href="/terminos" target="_blank" className="text-orange-600 hover:underline font-semibold">
                  Términos y Condiciones del Servicio
                </a>{" "}
                para la creación y uso de mi cuenta. <span className="text-rose-500">*</span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={aceptaMarketing}
                onChange={(e) => setAceptaMarketing(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 shrink-0"
              />
              <span className="text-slate-500 dark:text-slate-400">
                Quiero recibir actualizaciones normativas SST y novedades de HD Prevención por correo electrónico.{" "}
                <em>(Opcional; puedes revocarlo en cualquier momento desde Mi Perfil.)</em>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:scale-100 cursor-pointer"
          >
            {loading ? "Registrando..." : "Registrarse"}
          </button>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            🔒 <strong>Aviso de Privacidad (Art. 14 ter Ley N° 21.719):</strong> Tus datos (usuario, correo y credenciales) son tratados por <strong>HD Prevención</strong> (Responsable) para crear y administrar tu cuenta. Puedes ejercer tus derechos ARCO-POL en{" "}
            <a href="/derechos-arco" className="text-orange-600 underline font-semibold">/derechos-arco</a> o escribiendo a{" "}
            <span className="font-mono">privacidad@hdprevencion.cl</span>.
          </p>
        </form>

        {/* Footer del card */}
        <div className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
          ¿Ya tienes cuenta?{" "}
          <a href="/ingreso" className="text-orange-600 hover:text-orange-500 font-semibold underline">
            Inicia Sesión
          </a>
        </div>
      </div>
    </main>
  );
}
