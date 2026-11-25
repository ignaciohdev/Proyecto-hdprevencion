"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, ensureAccessToken, getApiUrl } from "../../../utils/api";

interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string;
  activo: boolean;
}

interface SuscripcionActiva {
  id: number;
  plan_id: number;
  plan_nombre: string;
  plan_codigo: string;
  precio: number;
  acceso_servicios?: boolean;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  tipo_usuario: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  suscripcion_activa: SuscripcionActiva | null;
}

export default function PanelServiciosPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del Modal de Solicitud de Asesoría
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
  const [formSolicitud, setFormSolicitud] = useState({
    faena: "",
    telefono: "",
    fecha_tentativa: "",
    detalles: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const token = await ensureAccessToken();
      if (!token) {
        router.push("/ingreso");
        return;
      }

      try {
        // 1. Cargar perfil del usuario para validar suscripción de pago
        const resUser = await authFetch(getApiUrl("/api/usuarios/perfil/"));

        if (!resUser.ok) throw new Error("No se pudo cargar el perfil del usuario.");
        const userData: UserProfile = await resUser.json();
        setProfile(userData);

        const isPaid =
          userData.is_superuser ||
          userData.is_staff ||
          (userData.suscripcion_activa &&
            (userData.suscripcion_activa.acceso_servicios ||
              userData.suscripcion_activa.precio > 0) &&
            userData.suscripcion_activa.plan_codigo !== "basico");

        // 2. Si el usuario cuenta con plan de pago, cargar los servicios
        if (isPaid) {
          const resServicios = await authFetch(getApiUrl("/api/servicios/"));

          if (resServicios.ok) {
            const dataServicios: Servicio[] = await resServicios.json();
            setServicios(dataServicios);
          } else {
            // Fallback por si la base de datos aún no tiene registros de servicios
            setServicios([
              {
                id: 1,
                nombre: "Evaluación Ergonómica de Puestos de Trabajo (TMERT)",
                descripcion:
                  "Estudio biomecánico detallado en terreno para identificar factores de riesgo musculoesquelético según la Norma Técnica TMERT-EESS y Ley 20.949.",
                icono: "activity",
                activo: true,
              },
              {
                id: 2,
                nombre: "Asesoría y Constitución de Comité Paritario (D.S. N° 44)",
                descripcion:
                  "Guía legal completa para el proceso electoral, constitución, actas oficiales ante la Dirección del Trabajo y plan de trabajo del CPHS.",
                icono: "users",
                activo: true,
              },
              {
                id: 3,
                nombre: "Auditoría de Cumplimiento Legal y Condiciones Sanitarias (DS 594)",
                descripcion:
                  "Diagnóstico preventivo en terreno previo a fiscalizaciones de SEREMI de Salud o Inspección del Trabajo para prevenir clausuras y sanciones.",
                icono: "clipboard-list",
                activo: true,
              },
              {
                id: 4,
                nombre: "Confección y Actualización de RIOHS & Matriz IPER",
                descripcion:
                  "Levantamiento técnico de peligros por puesto de trabajo y redacción del Reglamento Interno de Orden, Higiene y Seguridad visable legalmente.",
                icono: "shield",
                activo: true,
              },
            ]);
          }
        }
      } catch (err: any) {
        setError(err.message || "Error al cargar los servicios.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const isPaidPlan =
    profile?.is_superuser ||
    profile?.is_staff ||
    (profile?.suscripcion_activa &&
      (profile.suscripcion_activa.acceso_servicios ||
        profile.suscripcion_activa.precio > 0) &&
      profile.suscripcion_activa.plan_codigo !== "basico");

  const handleOpenModal = (servicio: Servicio) => {
    setSelectedServicio(servicio);
    setMensajeExito(null);
    setFormSolicitud({
      faena: "",
      telefono: "",
      fecha_tentativa: "",
      detalles: "",
    });
  };

  const handleEnviarSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServicio) return;

    setEnviando(true);

    try {
      const payload = {
        nombre: profile?.username || "Usuario Suscriptor",
        email: profile?.email || "usuario@hdprevencion.cl",
        asunto: `Solicitud de Asesoría Premium: ${selectedServicio.nombre}`,
        mensaje: `Solicitud de Asesoría Exclusiva para Suscriptores:
- Servicio: ${selectedServicio.nombre}
- Faena / Instalación: ${formSolicitud.faena}
- Teléfono / WhatsApp: ${formSolicitud.telefono}
- Fecha Tentativa: ${formSolicitud.fecha_tentativa || "Por coordinar"}
- Plan Activo: ${profile?.suscripcion_activa?.plan_nombre || "Plan de Pago"}
- Requerimientos adicionales:
${formSolicitud.detalles}`,
      };

      const res = await authFetch(getApiUrl("/api/contacto/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("No se pudo registrar la solicitud.");

      setMensajeExito(
        `¡Solicitud enviada con éxito! Nuestro equipo técnico se pondrá en contacto al correo ${profile?.email} para coordinar la fecha y visita.`
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 flex-col space-y-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-semibold">Validando privilegios de suscripción...</p>
      </div>
    );
  }

  // PANTALLA DE BLOQUEO (Para usuarios en Plan Básico sin pago)
  if (!isPaidPlan) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-8 animate-fadeIn">
        <div className="bg-white dark:bg-slate-950 p-8 md:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-950/40 text-orange-600 rounded-3xl flex items-center justify-center text-4xl mx-auto border border-orange-200 dark:border-orange-900/50 shadow-inner">
            🔒
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-900/50">
              Beneficio Exclusivo para Suscriptores de Pago
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
              Módulo de Asesorías y Servicios Técnicos en Terreno
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Actualmente cuentas con el <strong className="text-slate-700 dark:text-slate-200">{profile?.suscripcion_activa?.plan_nombre || "Plan Básico"}</strong>. 
              El acceso a solicitar asesorías técnicas, auditorías de cumplimiento D.S. 594, evaluaciones ergonómicas TMERT y levantamiento de matrices IPER con ingenieros senior se desbloquea al activar un plan de pago.
            </p>
          </div>

          {/* Comparativa de Beneficios Desbloqueables */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto pt-4 text-xs">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">📋 Matrices & RIOHS</span>
              <p className="text-slate-400">Revisión y confección visada por prevencionistas acreditados.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">🔍 Auditorías DS 594</span>
              <p className="text-slate-400">Inspecciones previas a fiscalizaciones de SEREMI y DT.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">⚡ Tarifas Preferenciales</span>
              <p className="text-slate-400">Descuentos directos en horas profesionales en terreno.</p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={() => router.push("/panel/planes")}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-8 rounded-xl text-sm shadow-lg shadow-orange-600/25 transition-all hover:scale-[1.02] cursor-pointer"
            >
              Mejorar mi Plan y Desbloquear →
            </button>
            <button
              onClick={() => router.push("/panel")}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-3.5 px-6 rounded-xl text-sm transition-all cursor-pointer"
            >
              Volver al Resumen General
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PANTALLA DESBLOQUEADA (Para usuarios con Plan Profesional, Expert, Consultora o Admin)
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Encabezado Principal */}
      <div className="bg-slate-900 text-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase px-3 py-1 rounded-full flex items-center space-x-1">
              <span>✓</span>
              <span>Desbloqueado con tu {profile?.suscripcion_activa?.plan_nombre || "Suscripción Premium"}</span>
            </span>
            <span className="bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase px-3 py-1 rounded-full">
              Soporte Prioritario
            </span>
          </div>

          <h1 className="text-3xl font-extrabold text-white leading-tight">
            Asesorías y Servicios Técnicos en Terreno
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Como cliente suscriptor, cuentas con tarifas preferenciales y acceso prioritario para agendar auditorías oficiales, evaluaciones especializadas TMERT y consultoría en faenas.
          </p>
        </div>

        <div className="mt-6 md:mt-0 z-10 flex flex-col items-end">
          <span className="text-xs text-slate-400">Atención técnica garantizada</span>
          <span className="text-sm font-bold text-orange-400 mt-0.5">contacto@hdprevencion.cl</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4 rounded-xl text-xs text-red-650 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Grid de Servicios Disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {servicios.map((servicio) => (
          <div
            key={servicio.id}
            className="bg-white dark:bg-slate-950 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 rounded-2xl text-2xl font-bold">
                  {servicio.icono === "users"
                    ? "👥"
                    : servicio.icono === "activity"
                    ? "⚡"
                    : servicio.icono === "shield"
                    ? "🛡️"
                    : "📋"}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {servicio.nombre}
                  </h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                    ● Disponible para tu Plan
                  </span>
                </div>
              </div>

              <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm leading-relaxed">
                {servicio.descripcion}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Respaldo con Informe Técnico
              </span>
              <button
                type="button"
                onClick={() => handleOpenModal(servicio)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer"
              >
                Solicitar Asesoría →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE SOLICITUD DE ASESORÍA */}
      {selectedServicio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded">
                  Asesoría en Terreno
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {selectedServicio.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServicio(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {mensajeExito ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-6 rounded-2xl text-center space-y-3">
                <span className="text-4xl">🎉</span>
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                  {mensajeExito}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedServicio(null)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnviarSolicitud} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Faena, Obra o Instalación *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSolicitud.faena}
                    onChange={(e) => setFormSolicitud({ ...formSolicitud, faena: e.target.value })}
                    placeholder="Ej. Casa Matriz Santiago / Faena Minera Antofagasta"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formSolicitud.telefono}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, telefono: e.target.value })}
                      placeholder="Ej. +56 9 1234 5678"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                      Fecha Tentativa Deseada
                    </label>
                    <input
                      type="date"
                      value={formSolicitud.fecha_tentativa}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, fecha_tentativa: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Detalles o Alcance del Requerimiento
                  </label>
                  <textarea
                    rows={3}
                    value={formSolicitud.detalles}
                    onChange={(e) => setFormSolicitud({ ...formSolicitud, detalles: e.target.value })}
                    placeholder="Indica cantidad aproximada de puestos a evaluar, turnos o urgencia del servicio..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedServicio(null)}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {enviando ? "Enviando Solicitud..." : "Confirmar Solicitud de Asesoría"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
