"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authFetch, getApiUrl, getSessionUser } from "../../utils/api";

function ContactoPageInner() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    asunto: "",
    mensaje: "",
  });

  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const asuntoParam = searchParams.get("asunto") || "";
    setFormData((prev) => ({
      ...prev,
      asunto: asuntoParam,
      mensaje: "",
    }));

    void getSessionUser().then((user) => {
      if (user) {
        setFormData((prev) => ({
          ...prev,
          nombre: prev.nombre || user.username || "",
          email: prev.email || user.email || "",
        }));
      }
    });
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceptaPrivacidad) {
      setError("Debes autorizar el tratamiento de tus datos de contacto conforme a la Política de Privacidad.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const sessionUser = await getSessionUser();
      const fetcher = sessionUser ? authFetch : fetch;
      const res = await fetcher(getApiUrl("/api/contacto/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          acepta_privacidad: aceptaPrivacidad,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.acepta_privacidad?.[0] ||
          errData.detail ||
          "Ocurrió un error al enviar el mensaje."
        );
      }

      setSuccess(true);
      setAceptaPrivacidad(false);
      setFormData((prev) => ({
        ...prev,
        asunto: "",
        mensaje: "",
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
      {/* Encabezado */}
        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800">
          <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
            Soporte Directo
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
            Contacto y Asesoría Técnica
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl">
            ¿Tienes dudas sobre alguna matriz de riesgo, fiscalización o normativa chilena? Envía tu consulta directa a nuestro equipo de prevencionistas expertos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-6 md:p-8 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold mb-6">Enviar Mensaje</h2>

            {success && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-xl mb-6 text-sm">
                ¡Tu consulta ha sido enviada exitosamente! Un experto de nuestro equipo se pondrá en contacto contigo a la brevedad.
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-4 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Tu Nombre
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    required
                    value={formData.nombre}
                    onChange={handleChange}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="Tu nombre completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Tu Correo
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="correo@ejemplo.cl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Asunto
                </label>
                <input
                  type="text"
                  name="asunto"
                  required
                  value={formData.asunto}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="ej. Duda con Matriz IPER"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Detalle de la Consulta
                </label>
                <textarea
                  name="mensaje"
                  required
                  rows={5}
                  value={formData.mensaje}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                  placeholder="Escribe aquí tu pregunta detallada..."
                />
              </div>

              {/* Consentimiento opt-in y aviso corto (Art. 12 y 14 ter Ley 21.719) */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={aceptaPrivacidad}
                    onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                    required
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 shrink-0"
                  />
                  <span>
                    Autorizo el tratamiento de mis datos de contacto para gestionar y responder esta solicitud conforme a la{" "}
                    <a href="/privacidad" target="_blank" className="text-orange-600 underline font-semibold">
                      Política de Privacidad
                    </a>. <span className="text-rose-500">*</span>
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-6">
                  HD Prevención tratará tus datos exclusivamente para responder tu consulta, conservándolos hasta por 12 meses. Ejerce tus derechos en{" "}
                  <a href="/derechos-arco" className="text-orange-600 underline font-semibold">/derechos-arco</a>.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 cursor-pointer"
              >
                {loading ? "Enviando..." : "Enviar Consulta"}
              </button>
            </form>
          </div>

          {/* Tarjetas de Información */}
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>📞</span>
                <span>Canales Directos</span>
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                Lunes a Viernes: 09:00 - 18:00 hrs.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <p className="flex items-center space-x-2">
                  <span className="font-semibold text-orange-600">Email:</span>
                  <span>soporte@hdprevencion.cl</span>
                </p>
                <p className="flex items-center space-x-2">
                  <span className="font-semibold text-orange-600">Teléfono:</span>
                  <span>+56 9 8765 4321</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>🛡️</span>
                <span>Preguntas Frecuentes</span>
              </h3>
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <p className="font-bold">¿Cómo descargo los formatos oficiales?</p>
                  <p className="text-slate-500 mt-1">Ve al panel de "Documentos", selecciona el formato que necesitas y edítalo en línea antes de descargarlo.</p>
                </div>
                <div>
                  <p className="font-bold">¿Tiene costo la asesoría técnica?</p>
                  <p className="text-slate-500 mt-1">Las consultas escritas sencillas están incluidas en todos los planes. Las inspecciones en terreno requieren cotización.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
  );
}

export default function ContactoPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ContactoPageInner />
    </Suspense>
  );
}
