"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Registro() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
    tipo_usuario: "INDIVIDUAL",
    cuenta_padre: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.password_confirm,
        tipo_usuario: formData.tipo_usuario,
        cuenta_padre: formData.tipo_usuario === "CORPORATIVO" && formData.cuenta_padre ? parseInt(formData.cuenta_padre) : null,
      };

      const response = await fetch("http://localhost:8000/api/auth/register/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

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
      setError(err.message || "Ocurrió un error inesperado.");
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

          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Tipo de Cuenta
            </label>
            <select
              name="tipo_usuario"
              value={formData.tipo_usuario}
              onChange={handleChange}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="CORPORATIVO">Multi-asiento Corporativo (Consultoras)</option>
            </select>
          </div>

          {formData.tipo_usuario === "CORPORATIVO" && (
            <div className="animate-fadeIn">
              <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
                ID de Cuenta Padre (Asiento Asociado)
              </label>
              <input
                type="text"
                name="cuenta_padre"
                value={formData.cuenta_padre}
                onChange={handleChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="ID del Administrador Principal"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ingresa el ID de la consultora principal si te estás uniendo a una suscripción existente.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:scale-100 cursor-pointer"
          >
            {loading ? "Registrando..." : "Registrarse"}
          </button>
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
