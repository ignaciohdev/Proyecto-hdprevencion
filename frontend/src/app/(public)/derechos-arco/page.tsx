"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getApiUrl, parseJsonResponse } from "../../utils/api";

interface ArcoStatusResponse {
  uuid: string;
  tipo_derecho: string;
  tipo_derecho_display: string;
  estado: string;
  estado_display: string;
  fecha_solicitud: string;
  fecha_limite_30d: string;
  bloqueo_provisional_activo: boolean;
  fecha_resolucion: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function DerechosArcoInner() {
  const searchParams = useSearchParams();
  const initialUuid = searchParams.get("uuid") || "";

  const [tab, setTab] = useState<"nueva" | "seguimiento">(initialUuid ? "seguimiento" : "nueva");
  const [formData, setFormData] = useState({
    tipo_derecho: "ACCESO",
    rut_titular: "",
    nombre_titular: "",
    email_titular: "",
    telefono_titular: "",
    detalle_solicitud: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    uuid: string;
    fecha_limite_30d: string;
    tipo_derecho_display: string;
  } | null>(null);

  // Estado de consulta por UUID (Seguimiento ARCO-POL)
  const [consultaUuid, setConsultaUuid] = useState(initialUuid);
  const [consultaLoading, setConsultaLoading] = useState(false);
  const [consultaError, setConsultaError] = useState<string | null>(null);
  const [consultaResultado, setConsultaResultado] = useState<ArcoStatusResponse | null>(null);

  const consultarEstado = async (uuidObjetivo: string) => {
    const clean = uuidObjetivo.trim();
    if (!UUID_REGEX.test(clean)) {
      setConsultaError("Ingresa un código UUID válido (ejemplo: 123e4567-e89b-12d3-a456-426614174000).");
      setConsultaResultado(null);
      return;
    }

    setConsultaLoading(true);
    setConsultaError(null);
    setConsultaResultado(null);

    try {
      const response = await fetch(getApiUrl(`/api/privacidad/consultar-derecho/${encodeURIComponent(clean)}/`));
      if (response.status === 404) {
        throw new Error("No existe ninguna solicitud registrada con ese código UUID.");
      }
      const data = await parseJsonResponse<ArcoStatusResponse>(response);
      if (!response.ok) {
        throw new Error((data as any)?.detail || "No se pudo consultar el estado de la solicitud.");
      }
      setConsultaResultado(data);
    } catch (err: any) {
      setConsultaError(err.message || "Error al consultar seguimiento ARCO-POL.");
    } finally {
      setConsultaLoading(false);
    }
  };

  useEffect(() => {
    if (initialUuid && UUID_REGEX.test(initialUuid.trim())) {
      setTab("seguimiento");
      consultarEstado(initialUuid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUuid]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/privacidad/solicitar-derecho/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || "Ocurrió un error al ingresar la solicitud.");
      }

      setResultado({
        uuid: data.uuid,
        fecha_limite_30d: data.fecha_limite_30d,
        tipo_derecho_display: data.tipo_derecho_display || formData.tipo_derecho,
      });
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 border-b border-slate-800 pb-6">
          <Link
            href="/"
            className="text-xs text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider mb-4 inline-block"
          >
            ← Volver al Inicio
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Canal de Ejercicio de Derechos del Titular (ARCO-POL)
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Conforme a los Arts. 4 al 11 de la Ley N° 21.719 sobre Protección de Datos Personales en Chile.
          </p>
        </div>

        {/* Selector de pestaña: Ingreso vs Seguimiento UUID */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => setTab("nueva")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === "nueva"
                ? "bg-orange-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Ingresar Nueva Solicitud
          </button>
          <button
            type="button"
            onClick={() => setTab("seguimiento")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === "seguimiento"
                ? "bg-orange-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Consultar Estado por UUID
          </button>
        </div>

        {tab === "seguimiento" ? (
          <div className="space-y-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                consultarEstado(consultaUuid);
              }}
              className="space-y-4 bg-slate-950/70 p-6 rounded-2xl border border-slate-800"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Código Único de Seguimiento (UUID)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    value={consultaUuid}
                    onChange={(e) => setConsultaUuid(e.target.value)}
                    placeholder="Ej: 550e8400-e29b-41d4-a716-446655440000"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="submit"
                    disabled={consultaLoading}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-3 rounded-xl text-xs cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {consultaLoading ? "Consultando..." : "Consultar Estado"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Por protección de datos, esta consulta pública muestra únicamente el estado de tramitación y plazos legales sin exponer datos personales.
                </p>
              </div>
            </form>

            {consultaError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-medium">
                ⚠️ {consultaError}
              </div>
            )}

            {consultaResultado && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Derecho Solicitado</span>
                    <h2 className="text-base font-bold text-white">{consultaResultado.tipo_derecho_display}</h2>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      consultaResultado.estado === "RESUELTA"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                        : consultaResultado.estado === "RECHAZADA"
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {consultaResultado.estado_display}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block mb-1">Fecha de Ingreso</span>
                    <span className="font-semibold text-white">
                      {new Date(consultaResultado.fecha_solicitud).toLocaleDateString("es-CL")}
                    </span>
                  </div>
                  <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block mb-1">Plazo Legal Máximo (30 días)</span>
                    <span className="font-semibold text-orange-400">{consultaResultado.fecha_limite_30d}</span>
                  </div>
                  <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block mb-1">Bloqueo Temporal Provisional (Art. 11)</span>
                    <span className="font-semibold text-white">
                      {consultaResultado.bloqueo_provisional_activo ? "Activo (tratamiento suspendido)" : "No aplica / Inactivo"}
                    </span>
                  </div>
                  <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block mb-1">Fecha de Resolución</span>
                    <span className="font-semibold text-white">
                      {consultaResultado.fecha_resolucion
                        ? new Date(consultaResultado.fecha_resolucion).toLocaleDateString("es-CL")
                        : "En tramitación"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : resultado ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 animate-fadeIn">
            <span className="text-4xl">✅</span>
            <h2 className="text-xl font-bold text-emerald-400">Solicitud Ingresada Exitosamente</h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-lg mx-auto">
              Hemos registrado formalmente tu solicitud de{" "}
              <strong className="text-white">{resultado.tipo_derecho_display}</strong>.
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left space-y-2 max-w-md mx-auto">
              <div className="text-xs">
                <span className="text-slate-500 block">Código de Seguimiento (UUID):</span>
                <span className="font-mono text-orange-400 font-bold break-all">{resultado.uuid}</span>
              </div>
              <div className="text-xs">
                <span className="text-slate-500 block">Fecha Límite Legal de Respuesta (30 días corridos):</span>
                <span className="font-semibold text-white">{resultado.fecha_limite_30d}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Recibirás la respuesta oficial motivada a tu correo electrónico. Si requieres asistencia adicional o deseas reclamar ante la Agencia de Protección de Datos Personales, guarda tu código de seguimiento.
            </p>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const u = resultado.uuid;
                  setConsultaUuid(u);
                  setTab("seguimiento");
                  consultarEstado(u);
                }}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Consultar estado ahora
              </button>
              <button
                type="button"
                onClick={() => {
                  setResultado(null);
                  setFormData({
                    tipo_derecho: "ACCESO",
                    rut_titular: "",
                    nombre_titular: "",
                    email_titular: "",
                    telefono_titular: "",
                    detalle_solicitud: "",
                  });
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Ingresar otra solicitud
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 text-xs text-slate-400 space-y-1">
              <p>
                ⚖️ <strong>Información Legal:</strong> La tramitación es completamente gratuita. La respuesta será entregada en un plazo legal máximo de 30 días corridos (Art. 11 Ley 21.719). En solicitudes de bloqueo, tus datos serán congelados provisoriamente dentro de 2 días hábiles.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-medium">
                ⚠️ {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Tipo de Derecho que Deseas Ejercer <span className="text-orange-500">*</span>
              </label>
              <select
                name="tipo_derecho"
                value={formData.tipo_derecho}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              >
                <option value="ACCESO">Derecho de Acceso (Art. 5) — Conocer los datos tratados</option>
                <option value="RECTIFICACION">Derecho de Rectificación (Art. 6) — Corregir datos inexactos</option>
                <option value="SUPRESION">Derecho de Supresión (Art. 7) — Solicitar borrado de datos</option>
                <option value="OPOSICION">Derecho de Oposición (Art. 8) — Oponerse a tratamientos específicos</option>
                <option value="PORTABILIDAD">Derecho a la Portabilidad (Art. 9) — Copia estructurada interoperable</option>
                <option value="BLOQUEO">Derecho de Bloqueo Temporal (Art. 11) — Suspender el tratamiento</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  RUT del Titular <span className="text-orange-500">*</span>
                </label>
                <input
                  type="text"
                  name="rut_titular"
                  required
                  value={formData.rut_titular}
                  onChange={handleChange}
                  placeholder="Ej: 12.345.678-9"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre Completo <span className="text-orange-500">*</span>
                </label>
                <input
                  type="text"
                  name="nombre_titular"
                  required
                  value={formData.nombre_titular}
                  onChange={handleChange}
                  placeholder="Nombre y Apellidos"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Correo Electrónico de Respuesta <span className="text-orange-500">*</span>
                </label>
                <input
                  type="email"
                  name="email_titular"
                  required
                  value={formData.email_titular}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.cl"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Teléfono de Contacto (Opcional)
                </label>
                <input
                  type="text"
                  name="telefono_titular"
                  value={formData.telefono_titular}
                  onChange={handleChange}
                  placeholder="+56 9 1234 5678"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Detalle y Fundamentos de la Solicitud <span className="text-orange-500">*</span>
              </label>
              <textarea
                name="detalle_solicitud"
                required
                rows={4}
                value={formData.detalle_solicitud}
                onChange={handleChange}
                placeholder="Indica con claridad qué información deseas conocer, rectificar, suprimir o bloquear..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Registrando Solicitud..." : "⚖️ Enviar Solicitud de Derechos ARCO-POL"}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>HD Prevención — Privacidad y Cumplimiento Normativo</span>
          <Link href="/privacidad" className="hover:text-white transition-colors">
            Política de Privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DerechosArcoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <DerechosArcoInner />
    </Suspense>
  );
}
