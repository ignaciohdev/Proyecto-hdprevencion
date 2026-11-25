"use client";

import { useEffect, useState } from "react";
import { authFetch, getApiUrl } from "../../../utils/api";

interface PlantillaInspeccion {
  id: number;
  nombre: string;
  descripcion: string;
  preguntas: string[];
}

interface RespuestaItem {
  pregunta: string;
  estado: "SI" | "NO" | "NA";
  observacion: string;
}

interface InspeccionRealizada {
  id: number;
  plantilla: number;
  plantilla_nombre: string;
  fecha: string;
  porcentaje_cumplimiento: string;
  firma_nombre: string;
  firma_rut: string;
  respuestas: RespuestaItem[];
  username: string;
}

export default function InspeccionesPage() {
  const [inspecciones, setInspecciones] = useState<InspeccionRealizada[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaInspeccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de modales y asistentes
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedInspeccion, setSelectedInspeccion] = useState<InspeccionRealizada | null>(null);
  
  // Estado para la inspección activa
  const [plantillaActiva, setPlantillaActiva] = useState<PlantillaInspeccion | null>(null);
  const [respuestasForm, setRespuestasForm] = useState<RespuestaItem[]>([]);
  
  // Firma y envío
  const [firmaNombre, setFirmaNombre] = useState("");
  const [firmaRut, setFirmaRut] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchInspecciones = async () => {
    try {
      const res = await authFetch(getApiUrl("/api/inspecciones/"));
      if (!res.ok) throw new Error("Error al obtener el historial de inspecciones.");
      const data = await res.json();
      setInspecciones(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar inspecciones.");
    }
  };

  const fetchPlantillas = async () => {
    try {
      const res = await authFetch(getApiUrl("/api/plantillas-inspeccion/"));
      if (!res.ok) throw new Error("Error al cargar las listas de verificación.");
      const data = await res.json();
      setPlantillas(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchInspecciones(), fetchPlantillas()]);
      setLoading(false);
    };
    init();
  }, []);

  const handleSelectTemplate = (plantilla: PlantillaInspeccion) => {
    setPlantillaActiva(plantilla);
    // Inicializar respuestas vacías
    const initialRespuestas = plantilla.preguntas.map((pregunta) => ({
      pregunta,
      estado: "SI" as const,
      observacion: "",
    }));
    setRespuestasForm(initialRespuestas);
    setFirmaNombre("");
    setFirmaRut("");
    setSaveError(null);
    setIsSelectModalOpen(false);
  };

  const handleRespuestaChange = (index: number, estado: "SI" | "NO" | "NA") => {
    setRespuestasForm((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, estado } : item))
    );
  };

  const handleObservacionChange = (index: number, observacion: string) => {
    setRespuestasForm((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, observacion } : item))
    );
  };

  // Calcular porcentaje en tiempo real
  const calcularPorcentajeEnPantalla = () => {
    const totalRespuestas = respuestasForm.filter((r) => r.estado !== "NA");
    const aprobados = totalRespuestas.filter((r) => r.estado === "SI").length;
    if (totalRespuestas.length === 0) return 100;
    return Math.round((aprobados / totalRespuestas.length) * 100);
  };

  const handleSubmitInspeccion = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que se ingresaron observaciones si hay algún 'NO'
    const tieneErroresSinObservacion = respuestasForm.some(
      (r) => r.estado === "NO" && r.observacion.trim() === ""
    );
    if (tieneErroresSinObservacion) {
      setSaveError("Por favor, ingresa una observación para cada ítem que no cumple.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await authFetch(getApiUrl("/api/inspecciones/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plantilla: plantillaActiva?.id,
          respuestas: respuestasForm,
          firma_nombre: firmaNombre,
          firma_rut: firmaRut,
        }),
      });

      if (!res.ok) throw new Error("No se pudo enviar la inspección.");

      // Limpiar y actualizar
      setPlantillaActiva(null);
      fetchInspecciones();
    } catch (err: any) {
      setSaveError(err.message || "Error al guardar la inspección.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1) Encabezado condicional (Si no hay inspección activa) */}
      {!plantillaActiva ? (
        <>
          <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
                Registros de Calidad
              </span>
              <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
                Inspecciones en Terreno
              </h1>
              <p className="text-slate-400 mt-2 text-sm max-w-xl">
                Carga y ejecuta listas de verificación de seguridad en terreno de forma digital y mantén el registro de conformidad ante la ley.
              </p>
            </div>
            <button
              onClick={() => setIsSelectModalOpen(true)}
              className="mt-6 md:mt-0 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer flex items-center space-x-2 text-sm"
            >
              <span>📋</span>
              <span>Iniciar Inspección</span>
            </button>
          </div>

          {/* Historial de Inspecciones */}
          {loading ? (
            <div className="flex justify-center items-center py-20 flex-col space-y-3">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm font-semibold">Cargando historial...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center">
              <p className="font-bold">Error al cargar historial</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : inspecciones.length === 0 ? (
            <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
              <span className="text-5xl mb-4">🗂️</span>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Sin Inspecciones Ejecutadas</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">
                No tienes registros de listas de verificación enviadas aún.
              </p>
              <button
                onClick={() => setIsSelectModalOpen(true)}
                className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow transition-all cursor-pointer"
              >
                Comenzar primera inspección
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white">Historial de Formularios Completados</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-3">Listado / Plantilla</th>
                      <th className="px-6 py-3">Fecha</th>
                      <th className="px-6 py-3">Inspector (Prevencionista)</th>
                      <th className="px-6 py-3 text-center">Cumplimiento</th>
                      <th className="px-6 py-3 text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {inspecciones.map((ins) => {
                      const score = parseFloat(ins.porcentaje_cumplimiento);
                      return (
                        <tr key={ins.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="px-6 py-4 font-bold text-slate-850 dark:text-white">
                            {ins.plantilla_nombre}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {new Date(ins.fecha).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold">{ins.firma_nombre}</p>
                            <p className="text-xs text-slate-400">RUT: {ins.firma_rut}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                score >= 85
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                                  : score >= 70
                                  ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400"
                                  : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {score}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedInspeccion(ins);
                                setIsDetailModalOpen(true);
                              }}
                              className="text-orange-655 hover:underline font-bold text-xs cursor-pointer"
                            >
                              Ver Respuestas
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* 2) Asistente de Inspección Activa */
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
          {/* Cabecera del Checklist */}
          <div className="bg-slate-900 text-white p-6 border-b border-slate-800 flex justify-between items-center flex-wrap gap-4">
            <div>
              <span className="bg-orange-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
                Checklist Interactivo
              </span>
              <h2 className="text-xl font-bold mt-1">{plantillaActiva.nombre}</h2>
              <p className="text-slate-400 text-xs mt-0.5">{plantillaActiva.descripcion}</p>
            </div>
            
            {/* Indicador de cumplimiento dinámico */}
            <div className="text-right bg-slate-800/50 py-2 px-4 rounded-xl border border-slate-700/50">
              <span className="text-[10px] block uppercase text-slate-400 font-bold">Cumplimiento Estimado</span>
              <span className="text-2xl font-extrabold text-orange-500">{calcularPorcentajeEnPantalla()}%</span>
            </div>
          </div>

          <form onSubmit={handleSubmitInspeccion} className="p-6 md:p-8 space-y-6">
            {saveError && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl text-xs">
                {saveError}
              </div>
            )}

            {/* Listado de preguntas */}
            <div className="space-y-6 divide-y divide-slate-100 dark:divide-slate-850">
              {respuestasForm.map((item, index) => (
                <div key={index} className={`pt-6 ${index === 0 ? "pt-0" : ""} space-y-3`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-850 dark:text-slate-200 max-w-xl">
                      {index + 1}. {item.pregunta}
                    </p>

                    {/* Botones de opción grande */}
                    <div className="flex space-x-2 shrink-0">
                      {(["SI", "NO", "NA"] as const).map((est) => (
                        <button
                          key={est}
                          type="button"
                          onClick={() => handleRespuestaChange(index, est)}
                          className={`w-14 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            item.estado === est
                              ? est === "SI"
                                ? "bg-emerald-600 border-transparent text-white shadow-md"
                                : est === "NO"
                                ? "bg-red-600 border-transparent text-white shadow-md"
                                : "bg-slate-500 border-transparent text-white shadow-md"
                              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-355 hover:bg-slate-100"
                          }`}
                        >
                          {est === "SI" ? "Sí" : est === "NO" ? "No" : "N/A"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Campo de observación si selecciona NO */}
                  {item.estado === "NO" && (
                    <div className="animate-slideDown">
                      <label className="block text-[11px] font-bold text-red-500 mb-1">
                        * Detalle de la no conformidad / acción correctiva necesaria:
                      </label>
                      <input
                        type="text"
                        required
                        value={item.observacion}
                        onChange={(e) => handleObservacionChange(index, e.target.value)}
                        className="w-full bg-red-50/20 dark:bg-red-950/5 border border-red-300 dark:border-red-900/50 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-800 dark:text-slate-200"
                        placeholder="ej. Manómetro vencido desde marzo / Extintor sin etiqueta..."
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Panel de Firma Final */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Firma de Responsabilidad del Inspector
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nombre Completo del Prevencionista</label>
                  <input
                    type="text"
                    required
                    value={firmaNombre}
                    onChange={(e) => setFirmaNombre(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="ej. Carlos Mendoza Jara"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">RUT del Inspector</label>
                  <input
                    type="text"
                    required
                    value={firmaRut}
                    onChange={(e) => setFirmaRut(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="ej. 12.345.678-9"
                  />
                </div>
              </div>
            </div>

            {/* Acciones del Formulario */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPlantillaActiva(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-6 rounded-xl text-xs cursor-pointer"
              >
                Descartar Inspección
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all hover:scale-[1.01] cursor-pointer"
              >
                {saving ? "Guardando..." : "Guardar y Enviar Registro ✓"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL SELECCIONAR PLANTILLA */}
      {isSelectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">
              Nueva Inspección en Terreno
            </h2>
            
            <div className="space-y-3">
              {plantillas.map((plt) => (
                <button
                  key={plt.id}
                  onClick={() => handleSelectTemplate(plt)}
                  className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-850 text-left hover:border-orange-500 hover:shadow transition-all group flex flex-col justify-between"
                >
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-orange-500 transition-colors">
                      {plt.nombre}
                    </h4>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                      {plt.descripcion}
                    </p>
                  </div>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold px-2 py-0.5 rounded mt-3 self-start">
                    {plt.preguntas.length} Ítems a evaluar
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsSelectModalOpen(false)}
              className="mt-6 w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE INSPECCIÓN COMPLETADA */}
      {isDetailModalOpen && selectedInspeccion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl relative flex flex-col max-h-[85vh]">
            
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedInspeccion.plantilla_nombre}
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  Ejecutado el {new Date(selectedInspeccion.fecha).toLocaleString()} por {selectedInspeccion.username}
                </p>
              </div>
              <span
                className={`text-sm font-extrabold px-3 py-1 rounded-xl ${
                  parseFloat(selectedInspeccion.porcentaje_cumplimiento) >= 85
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
                    : "bg-amber-50 dark:bg-amber-950/20 text-amber-600"
                }`}
              >
                {selectedInspeccion.porcentaje_cumplimiento}% Cumple
              </span>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-grow">
              <div className="space-y-3">
                {selectedInspeccion.respuestas.map((res, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {i + 1}. {res.pregunta}
                      </p>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded shrink-0 ${
                          res.estado === "SI"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700"
                            : res.estado === "NO"
                            ? "bg-red-100 dark:bg-red-950 text-red-700"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {res.estado === "SI" ? "CUMPLE" : res.estado === "NO" ? "NO CUMPLE" : "N/A"}
                      </span>
                    </div>

                    {res.estado === "NO" && (
                      <div className="bg-red-50/50 dark:bg-red-950/10 p-2.5 rounded-lg border border-red-200/50 text-[11px] text-red-700 dark:text-red-400">
                        <strong>Falla:</strong> {res.observacion || "Sin observaciones ingresadas"}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Sección de firmas */}
              <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <p><strong>Firma de conformidad:</strong></p>
                <p>Inspector: {selectedInspeccion.firma_nombre}</p>
                <p>RUT: {selectedInspeccion.firma_rut}</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedInspeccion(null);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-xl text-xs cursor-pointer shadow"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
