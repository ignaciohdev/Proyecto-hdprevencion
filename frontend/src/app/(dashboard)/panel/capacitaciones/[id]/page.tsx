"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { getApiUrl } from "../../../../utils/api";

interface TemaCapacitacion {
  id: number;
  titulo: string;
  categoria: string;
  duracion_minutos: number;
  descripcion: string;
  contenido_clave: string[];
}

interface Asistente {
  nombre: string;
  rut: string;
  firma: string;
}

interface RegistroCapacitacion {
  id: number;
  uuid?: string;
  tema: number;
  tema_titulo: string;
  tema_detalle: TemaCapacitacion;
  estado: "PROGRAMADA" | "REALIZADA" | "CANCELADA";
  fecha_programada: string;
  fecha_realizacion: string | null;
  lugar: string;
  asistentes: Asistente[];
  observaciones: string | null;
  username: string;
}

export default function DetalleCapacitacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: capacitacionId } = use(params);
  const router = useRouter();
  const [capacitacion, setCapacitacion] = useState<RegistroCapacitacion | null>(null);
  const [userPlan, setUserPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  // Formulario de Asistentes
  const [asistentesLocales, setAsistentesLocales] = useState<Asistente[]>([]);
  const [formAsistente, setFormAsistente] = useState({
    nombre: "",
    rut: "",
    firma: "",
  });

  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCapacitacion = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    try {
      // 1. Cargar capacitación
      const res = await fetch(getApiUrl(`/api/registro-capacitacion/${capacitacionId}/`), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error("No se pudo cargar la información de la capacitación.");
      const data = await res.json();
      setCapacitacion(data);
      setAsistentesLocales(data.asistentes || []);
      setObservaciones(data.observaciones || "");

      // 2. Cargar perfil para ver marca de agua / marca blanca
      const resUser = await fetch(getApiUrl("/api/usuarios/perfil/"), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (resUser.ok) {
        const userData = await resUser.json();
        setUserPlan(userData.suscripcion_activa);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Error al cargar la capacitación.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCapacitacion();
  }, [capacitacionId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Polling para actualizar asistentes si la sesión está PROGRAMADA
  useEffect(() => {
    if (!capacitacion || capacitacion.estado !== "PROGRAMADA") return;

    const interval = setInterval(() => {
      const token = localStorage.getItem("access_token");
      fetch(getApiUrl(`/api/registro-capacitacion/${capacitacionId}/`), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })
        .then((res) => {
          if (res.ok) return res.json();
        })
        .then((data) => {
          if (data) {
            setCapacitacion(data);
            setAsistentesLocales(data.asistentes || []);
          }
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, [capacitacionId, capacitacion?.estado]);

  const handleAddAsistente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAsistente.nombre.trim() || !formAsistente.rut.trim() || !formAsistente.firma.trim()) {
      alert("Por favor completa el nombre, RUT y la firma del trabajador.");
      return;
    }

    setAsistentesLocales([...asistentesLocales, { ...formAsistente }]);
    setFormAsistente({ nombre: "", rut: "", firma: "" });
  };

  const handleRemoveAsistente = (idx: number) => {
    setAsistentesLocales(asistentesLocales.filter((_, i) => i !== idx));
  };

  const handleFinalizarCharla = async () => {
    if (asistentesLocales.length === 0) {
      if (!confirm("No has registrado ningún asistente en la lista. ¿Deseas finalizar la capacitación de todas formas?")) {
        return;
      }
    }

    setSaving(true);
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(getApiUrl(`/api/registro-capacitacion/${capacitacionId}/finalizar/`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          asistentes: asistentesLocales,
          observaciones: observaciones,
        }),
      });

      if (!res.ok) throw new Error("No se pudo finalizar y guardar la capacitación.");
      alert("¡Capacitación registrada y guardada con éxito!");
      loadCapacitacion();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 flex-col space-y-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-semibold">Cargando sesión de capacitación...</p>
      </div>
    );
  }

  if (error || !capacitacion) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center max-w-lg mx-auto">
        <p className="font-bold">Error</p>
        <p className="text-sm mt-1">{error || "No se encontró el registro."}</p>
        <button onClick={() => router.push("/panel/capacitaciones")} className="mt-4 bg-orange-600 text-white font-bold py-2.5 px-5 rounded-xl text-xs hover:bg-orange-700">Volver al PAC</button>
      </div>
    );
  }

  const getCategoriaLabel = (cat: string) => {
    switch (cat) {
      case "CHARLA_5_MIN":
        return "Charla de 5 Minutos (Operativa)";
      case "INDUCCION_ODI":
        return "Información de los riesgos laborales (ODI Art. 15 D.S. N° 44)";
      case "CURSO_8H_GENERO":
        return "Curso Bienal 8h con Enfoque de Género (Art. 16 D.S. N° 44)";
      case "CURSO_20H_CPHS":
        return "Curso 20h CPHS (Mutualidad / D.S. N° 44)";
      case "CURSO_1H_EPP":
        return "Capacitación Obligatoria EPP 1h (D.S. N° 44)";
      case "CURSO_TEORICO":
        return "Capacitación Teórica de Seguridad";
      case "CURSO_PRACTICO":
        return "Capacitación Práctica / Simulacro";
      default:
        return cat;
    }
  };

  const hasWatermark = userPlan ? userPlan.marca_agua : true;
  const isWhiteLabel = userPlan ? userPlan.marca_blanca : false;

  return (
    <div className="space-y-6 print:space-y-0 print:p-0">
      
      {/* Barra de herramientas superior - Se oculta al imprimir */}
      <div className="flex justify-between items-center print:hidden bg-white dark:bg-slate-955 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => router.push("/panel/capacitaciones")}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold text-sm flex items-center space-x-1 cursor-pointer"
        >
          <span>← Volver al Plan de Capacitaciones</span>
        </button>

        {capacitacion.estado === "REALIZADA" && (
          <button
            onClick={() => window.print()}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-md"
          >
            <span>🖨️</span>
            <span>Imprimir Acta / Exportar PDF</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        
        {/* Lado Izquierdo: Ficha del Tema y Contenido */}
        <div className="lg:col-span-1 space-y-6 print:hidden">
          
          {/* Ficha Temario */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded border border-orange-200">
              Contenido Temático
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">
              {capacitacion.tema_titulo}
            </h3>
            
            {capacitacion.tema_detalle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-900/50">
                {capacitacion.tema_detalle.descripcion}
              </p>
            )}

            {capacitacion.tema_detalle && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Puntos Clave del Contenido:</p>
                <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {capacitacion.tema_detalle.contenido_clave.map((p, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="text-orange-500 font-bold font-mono">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Tarjeta del Código QR de Asistencia */}
          {capacitacion.estado === "PROGRAMADA" && origin && (
            <div className="bg-white dark:bg-slate-955 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center space-y-4">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Escanear para Firmar en Terreno</h4>
              <p className="text-[10px] text-slate-450 leading-normal">
                Muestra este código QR a los trabajadores para que firmen la charla con su dedo desde sus celulares.
              </p>
              <div className="bg-white p-3.5 rounded-xl shadow border border-slate-200">
                <QRCodeSVG
                  value={`${origin}/capacitaciones/firmar/${capacitacion.uuid || capacitacionId}`}
                  size={180}
                  level="M"
                />
              </div>
              <div className="text-[10px] bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-250 dark:border-slate-850 font-mono select-all break-all w-full text-slate-550 text-left">
                <strong className="block text-[8px] uppercase text-slate-400 font-sans mb-0.5">Enlace de Firma:</strong>
                {`${origin}/capacitaciones/firmar/${capacitacion.uuid || capacitacionId}`}
              </div>
            </div>
          )}
        </div>

        {/* Lado Derecho: Flujo de Firma / Acta de Asistencia */}
        <div className="lg:col-span-2 space-y-6 print:p-0">
          
          {/* PANEL DE REGISTRO EN TIEMPO REAL */}
          {capacitacion.estado === "PROGRAMADA" && (
            <div className="bg-white dark:bg-slate-950 p-6 md:p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 space-y-6 print:hidden">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Relatoría y Control de Asistencia</h2>
                <p className="text-xs text-slate-400 mt-1">Ingresa el Nombre y RUT de cada trabajador asistente y su firma digital de aceptación de la charla.</p>
              </div>

              {/* Formulario rápido para añadir trabajadores */}
              <form onSubmit={handleAddAsistente} className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">Nombre del Trabajador</label>
                  <input
                    type="text"
                    required
                    value={formAsistente.nombre}
                    onChange={(e) => setFormAsistente({ ...formAsistente, nombre: e.target.value })}
                    placeholder="Ej. Pedro Pérez"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">RUT del Trabajador</label>
                  <input
                    type="text"
                    required
                    value={formAsistente.rut}
                    onChange={(e) => setFormAsistente({ ...formAsistente, rut: e.target.value })}
                    placeholder="Ej. 12.345.678-9"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">Firma Digital (Texto)</label>
                  <input
                    type="text"
                    required
                    value={formAsistente.firma}
                    onChange={(e) => setFormAsistente({ ...formAsistente, firma: e.target.value })}
                    placeholder="Escribe Nombre Completo para firmar"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-900 dark:text-white font-mono italic"
                  />
                </div>
                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-5 rounded-lg text-xs transition-all cursor-pointer"
                  >
                    + Agregar Asistente
                  </button>
                </div>
              </form>

              {/* Listado temporal */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Trabajadores Asistentes Registrados ({asistentesLocales.length})</h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">RUT</th>
                        <th className="p-3">Firma Digital</th>
                        <th className="p-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                      {asistentesLocales.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-450 italic">Aún no has añadido asistentes a la charla.</td>
                        </tr>
                      ) : (
                        asistentesLocales.map((asistente, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/10 transition-colors">
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{asistente.nombre}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 font-mono">{asistente.rut}</td>
                            <td className="p-3">
                              {asistente.firma.startsWith("data:image/") ? (
                                <img
                                  src={asistente.firma}
                                  alt="Firma"
                                  className="h-8 max-w-[120px] object-contain dark:bg-white dark:p-1 dark:rounded"
                                />
                              ) : (
                                <span className="text-orange-600 dark:text-orange-500 italic font-mono">{asistente.firma}</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveAsistente(idx)}
                                className="text-red-500 hover:text-red-400 cursor-pointer"
                              >
                                ❌
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observaciones y Cierre */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-850">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Observaciones / Desviaciones durante la Charla</label>
                  <textarea
                    rows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="ej. Trabajadores mostraron alto interés. Se recalca el uso obligatorio del calzado de seguridad."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl p-3 text-xs focus:outline-none resize-none text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleFinalizarCharla}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl text-sm shadow-md transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    {saving ? "Guardando Registro..." : "Finalizar Charla y Firmar Acta ✓"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA DEL ACTA DE CAPACITACIÓN OFICIAL (IMPRIMIBLE A4) */}
          {capacitacion.estado === "REALIZADA" && (
            <div className="bg-white dark:bg-slate-950 p-8 md:p-12 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 relative max-w-[800px] mx-auto print:shadow-none print:border-none print:p-0 print:my-0">
              
              {/* Marca de agua - Solo si no es white label y no tiene plan profesional/expert */}
              {hasWatermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-45 select-none z-0">
                  <span className="text-7xl md:text-8xl font-black tracking-widest text-red-650">
                    HD PREVENCIÓN
                  </span>
                </div>
              )}

              {/* Encabezado del Acta */}
              <div className="border-b-4 border-slate-800 dark:border-slate-700 pb-6 flex justify-between items-start">
                <div>
                  {!isWhiteLabel ? (
                    <div className="flex items-center space-x-2 text-orange-600 mb-2">
                      <img src="/logo_light.png" alt="HD Prevención Logo" className="h-8 w-auto dark:hidden" />
                      <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-8 w-auto hidden dark:block" />
                      <span className="font-extrabold text-sm tracking-wider uppercase">HD Prevención</span>
                    </div>
                  ) : (
                    <div className="h-10"></div>
                  )}
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                    REGISTRO DE ASISTENCIA A CAPACITACIÓN
                  </h1>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 uppercase font-bold tracking-wider mt-1">
                    En cumplimiento con la Ley N° 16.744 y el D.S. N° 44 (Información de Riesgos Laborales y Capacitación SST)
                  </p>
                </div>
                <div className="text-right text-xs">
                  <span className="bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-full font-bold border border-slate-200 dark:border-slate-800">
                    N° Registro: C-{capacitacion.id}
                  </span>
                </div>
              </div>

              {/* Metadatos del Registro */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6 border-b border-slate-200 dark:border-slate-800 text-xs">
                <div className="space-y-1">
                  <p><strong className="text-slate-400 uppercase text-[9px] block">Título de la Actividad:</strong> {capacitacion.tema_titulo}</p>
                  <p><strong className="text-slate-400 uppercase text-[9px] block">Tipo de Sesión:</strong> {capacitacion.tema_detalle ? getCategoriaLabel(capacitacion.tema_detalle.categoria) : "Capacitación"}</p>
                  <p><strong className="text-slate-400 uppercase text-[9px] block">Duración:</strong> {capacitacion.tema_detalle ? `${capacitacion.tema_detalle.duracion_minutos} Minutos` : "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p><strong className="text-slate-400 uppercase text-[9px] block">Fecha de Realización:</strong> {capacitacion.fecha_realizacion ? new Date(capacitacion.fecha_realizacion).toLocaleString() : "N/A"}</p>
                  <p><strong className="text-slate-400 uppercase text-[9px] block">Lugar Físico:</strong> {capacitacion.lugar}</p>
                  <p><strong className="text-slate-400 uppercase text-[9px] block">Relator de la Charla:</strong> {capacitacion.username}</p>
                </div>
              </div>

              {/* Temario / Resumen de Puntos Clave */}
              {capacitacion.tema_detalle && (
                <div className="py-6 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Temas y Objetivos Tratados</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">{capacitacion.tema_detalle.descripcion}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-650 dark:text-slate-400 pt-1">
                    {capacitacion.tema_detalle.contenido_clave.map((p, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-orange-500 font-bold">•</span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista Oficial de Firmas de Asistencia */}
              <div className="py-6 space-y-4">
                <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Declaración de Recibo e Instrucción</h3>
                <p className="text-[10px] text-slate-450 leading-relaxed">
                  Los suscritos en el presente registro declaran bajo firma haber asistido a la charla de seguridad indicada y haber comprendido los contenidos clave expuestos, riesgos evaluados y las medidas preventivas obligatorias que deben aplicar en su puesto de trabajo.
                </p>

                <div className="border border-slate-250 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/30">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5">Nombre Trabajador</th>
                        <th className="p-2.5">RUT</th>
                        <th className="p-2.5">Firma de Conformidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                      {asistentesLocales.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-slate-450 italic">Sin asistentes registrados en esta capacitación.</td>
                        </tr>
                      ) : (
                        asistentesLocales.map((asistente, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{asistente.nombre}</td>
                            <td className="p-2.5 font-mono text-slate-500">{asistente.rut}</td>
                            <td className="p-2.5 text-center">
                              {asistente.firma.startsWith("data:image/") ? (
                                <img
                                  src={asistente.firma}
                                  alt="Firma"
                                  className="h-9 max-w-[140px] object-contain mx-auto print:brightness-95"
                                />
                              ) : (
                                <span className="text-orange-655 font-mono italic text-[11px]">{asistente.firma}</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observaciones del Acta */}
              {capacitacion.observaciones && (
                <div className="py-4 border-t border-slate-200 dark:border-slate-850 text-xs">
                  <strong className="text-slate-400 uppercase text-[9px] block">Observaciones y Notas de Cierre:</strong>
                  <p className="text-slate-700 dark:text-slate-300 italic mt-1 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-150 dark:border-slate-900/60 leading-relaxed">
                    {capacitacion.observaciones}
                  </p>
                </div>
              )}

              {/* Pie del Acta y Firmas del Relator */}
              <div className="pt-12 mt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="flex flex-col items-center justify-end h-28">
                  <div className="w-48 border-b border-slate-400 dark:border-slate-700 pb-1 font-mono italic text-orange-655 font-bold">
                    {capacitacion.username.toUpperCase()}
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white mt-1">Firma Relator (Prevencionista)</span>
                  <span className="text-[10px] text-slate-400">HD Prevención SaaS</span>
                </div>
                <div className="flex flex-col items-center justify-end h-28">
                  <div className="w-48 border-b border-slate-400 dark:border-slate-700 pb-1 font-mono italic text-slate-300">
                    Firma Electrónica Simple
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white mt-1">Representante de Trabajadores</span>
                  <span className="text-[10px] text-slate-400">Resguardo del Acta</span>
                </div>
              </div>

              {/* Branding HD Prevención al pie - Oculto si es marca blanca */}
              {!isWhiteLabel && (
                <div className="mt-12 pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-[9px] text-slate-400 print:block">
                  Documento generado electrónicamente en la plataforma HD Prevención (www.hdprevencion.cl). Código de Verificación Seguro: PAC-ID{capacitacion.id}-VERIFY
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
