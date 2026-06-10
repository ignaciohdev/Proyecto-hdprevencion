"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../../utils/api";

interface ReporteRiesgo {
  id: number;
  tipo: "ACTO" | "CONDICION";
  descripcion: string;
  lugar: string;
  gravedad: "BAJO" | "MEDIO" | "ALTO";
  estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO";
  medida_correctiva: string | null;
  fecha_creacion: string;
  username: string;
}

export default function ReportesRiesgoPage() {
  const [reportes, setReportes] = useState<ReporteRiesgo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedReporte, setSelectedReporte] = useState<ReporteRiesgo | null>(null);

  // Formulario de creación
  const [formCrear, setFormCrear] = useState({
    tipo: "CONDICION",
    lugar: "",
    descripcion: "",
    gravedad: "MEDIO",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Formulario de resolución
  const [medidaCorrectiva, setMedidaCorrectiva] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroGravedad, setFiltroGravedad] = useState<string>("TODOS");

  const fetchReportes = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(getApiUrl("/api/reportes-riesgo/"), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error("Error al obtener la bitácora de riesgos.");
      const data = await res.json();
      setReportes(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Error al cargar la bitácora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportes();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(getApiUrl("/api/reportes-riesgo/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(formCrear),
      });

      if (!res.ok) throw new Error("No se pudo registrar el hallazgo. Verifica los datos.");
      
      setIsCreateModalOpen(false);
      setFormCrear({
        tipo: "CONDICION",
        lugar: "",
        descripcion: "",
        gravedad: "MEDIO",
      });
      fetchReportes();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReporte) return;
    setResolving(true);
    setResolveError(null);
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(getApiUrl(`/api/reportes-riesgo/${selectedReporte.id}/`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          estado: "RESUELTO",
          medida_correctiva: medidaCorrectiva,
        }),
      });

      if (!res.ok) throw new Error("No se pudo registrar la resolución del hallazgo.");
      
      setIsResolveModalOpen(false);
      setMedidaCorrectiva("");
      setSelectedReporte(null);
      fetchReportes();
    } catch (err: any) {
      setResolveError(err.message);
    } finally {
      setResolving(false);
    }
  };

  // Filtrado de reportes en memoria
  const reportesFiltrados = reportes.filter((r) => {
    const matchTipo = filtroTipo === "TODOS" || r.tipo === filtroTipo;
    const matchEstado = filtroEstado === "TODOS" || r.estado === filtroEstado;
    const matchGravedad = filtroGravedad === "TODOS" || r.gravedad === filtroGravedad;
    return matchTipo && matchEstado && matchGravedad;
  });

  // Métricas rápidas
  const totalRiesgos = reportes.length;
  const abiertos = reportes.filter((r) => r.estado !== "RESUELTO").length;
  const resueltos = reportes.filter((r) => r.estado === "RESUELTO").length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
            Prevención Activa
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
            Bitácora de Control de Riesgos
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            Registra y gestiona los actos y condiciones inseguras detectadas en terreno para realizar el seguimiento de su corrección.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="mt-6 md:mt-0 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer flex items-center space-x-2 text-sm"
        >
          <span>➕</span>
          <span>Registrar Hallazgo</span>
        </button>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 transition-all">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total Registrados</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{totalRiesgos}</p>
          <span className="text-xs text-slate-550">Hallazgos históricos</span>
        </div>
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 transition-all">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Pendientes de Corrección</p>
          <p className="text-3xl font-extrabold text-amber-600 mt-1">{abiertos}</p>
          <span className="text-xs text-slate-550">Requieren plan de acción</span>
        </div>
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 transition-all">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Resueltos / Cerrados</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-1">{resueltos}</p>
          <span className="text-xs text-slate-550">Condición segura restablecida</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clasificación</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todos</option>
              <option value="CONDICION">Condiciones Inseguras</option>
              <option value="ACTO">Actos Inseguros</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todos</option>
              <option value="ABIERTO">Abiertos</option>
              <option value="EN_PROCESO">En Proceso</option>
              <option value="RESUELTO">Resueltos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gravedad</label>
            <select
              value={filtroGravedad}
              onChange={(e) => setFiltroGravedad(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todos</option>
              <option value="BAJO">Bajo</option>
              <option value="MEDIO">Medio</option>
              <option value="ALTO">Alto</option>
            </select>
          </div>
        </div>
        
        <span className="text-xs font-bold text-slate-500">
          Mostrando {reportesFiltrados.length} hallazgos
        </span>
      </div>

      {/* Contenido / Listado */}
      {loading ? (
        <div className="flex justify-center items-center py-20 flex-col space-y-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-semibold">Cargando bitácora...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center">
          <p className="font-bold">Error de Carga</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={fetchReportes} className="mt-4 bg-red-600 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-red-700">Reintentar</button>
        </div>
      ) : reportesFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
          <span className="text-5xl mb-4">🛡️</span>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Área Libre de Peligros</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            No hay hallazgos de actos o condiciones inseguras que coincidan con los filtros seleccionados.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow transition-all cursor-pointer"
          >
            Registrar el primer hallazgo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {reportesFiltrados.map((reporte) => (
            <div
              key={reporte.id}
              className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      reporte.tipo === "CONDICION"
                        ? "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400"
                        : "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400"
                    }`}
                  >
                    {reporte.tipo === "CONDICION" ? "🛠️ Condición Insegura" : "👤 Acto Inseguro"}
                  </span>
                  
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      reporte.gravedad === "ALTO"
                        ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                        : reporte.gravedad === "MEDIO"
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Gravedad: {reporte.gravedad}
                  </span>

                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      reporte.estado === "RESUELTO"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {reporte.estado === "RESUELTO" ? "✔ Cerrado / Resuelto" : "⏳ Abierto / Pendiente"}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-350">
                  Ubicación: <span className="font-normal text-slate-900 dark:text-white">{reporte.lugar}</span>
                </h3>
                
                <p className="text-slate-650 dark:text-slate-350 text-sm whitespace-pre-line leading-relaxed">
                  {reporte.descripcion}
                </p>

                {reporte.estado === "RESUELTO" && (
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 mt-2 text-xs">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">✅ Medida Correctiva Aplicada:</span>
                    <p className="text-slate-600 dark:text-slate-350 italic">{reporte.medida_correctiva}</p>
                  </div>
                )}
                
                <div className="text-[10px] text-slate-450 dark:text-slate-400 flex space-x-3 pt-1">
                  <span>Registrado por: {reporte.username}</span>
                  <span>•</span>
                  <span>Fecha: {new Date(reporte.fecha_creacion).toLocaleString()}</span>
                </div>
              </div>

              {reporte.estado !== "RESUELTO" && (
                <button
                  onClick={() => {
                    setSelectedReporte(reporte);
                    setIsResolveModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow hover:scale-[1.02] transition-all cursor-pointer whitespace-nowrap align-self-start md:align-self-auto"
                >
                  Cerrar Hallazgo ✓
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR HALLAZGO */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              Registrar Hallazgo en Terreno
            </h2>

            {createError && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-4 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Clasificación</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormCrear({ ...formCrear, tipo: "CONDICION" })}
                    className={`py-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      formCrear.tipo === "CONDICION"
                        ? "bg-orange-600 border-transparent text-white shadow-md"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-100"
                    }`}
                  >
                    🛠️ Condición Insegura
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCrear({ ...formCrear, tipo: "ACTO" })}
                    className={`py-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      formCrear.tipo === "ACTO"
                        ? "bg-orange-600 border-transparent text-white shadow-md"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-100"
                    }`}
                  >
                    👤 Acto Inseguro
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Ubicación Física</label>
                <input
                  type="text"
                  required
                  value={formCrear.lugar}
                  onChange={(e) => setFormCrear({ ...formCrear, lugar: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="ej. Bodega de herramientas / Andamio exterior piso 4"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Gravedad Estimada</label>
                <select
                  value={formCrear.gravedad}
                  onChange={(e) => setFormCrear({ ...formCrear, gravedad: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700 dark:text-slate-300"
                >
                  <option value="BAJO">Bajo</option>
                  <option value="MEDIO">Medio</option>
                  <option value="ALTO">Alto (Requiere atención urgente)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Descripción del Hallazgo</label>
                <textarea
                  required
                  rows={4}
                  value={formCrear.descripcion}
                  onChange={(e) => setFormCrear({ ...formCrear, descripcion: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="Describe detalladamente el riesgo observado, peligros asociados y posible consecuencia..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  {creating ? "Registrando..." : "Guardar Registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CERRAR HALLAZGO */}
      {isResolveModalOpen && selectedReporte && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              Cierre de Hallazgo de Riesgo
            </h2>
            <p className="text-slate-500 text-xs mb-6">
              Registra las medidas y acciones tomadas para subsanar la condición o acto de riesgo detectado en <strong>{selectedReporte.lugar}</strong>.
            </p>

            {resolveError && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-4 text-xs">
                {resolveError}
              </div>
            )}

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Medida Correctiva Aplicada</label>
                <textarea
                  required
                  rows={4}
                  value={medidaCorrectiva}
                  onChange={(e) => setMedidaCorrectiva(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="ej. Se retiró la herramienta dañada de circulación y se instalaron protecciones metálicas reglamentarias..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => {
                    setIsResolveModalOpen(false);
                    setSelectedReporte(null);
                    setMedidaCorrectiva("");
                  }}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  {resolving ? "Guardando..." : "Resolver y Cerrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
