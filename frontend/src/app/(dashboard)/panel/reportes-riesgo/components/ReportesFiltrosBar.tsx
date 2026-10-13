"use client";

interface ReportesFiltrosBarProps {
  busqueda: string;
  setBusqueda: (val: string) => void;
  filtroTipo: string;
  setFiltroTipo: (val: string) => void;
  filtroPeligro: string;
  setFiltroPeligro: (val: string) => void;
  filtroGravedad: string;
  setFiltroGravedad: (val: string) => void;
  filtroEstado: string;
  setFiltroEstado: (val: string) => void;
  filtroPlazo: string;
  setFiltroPlazo: (val: string) => void;
  filtroEmpresa: string;
  setFiltroEmpresa: (val: string) => void;
  filtroFaena: string;
  setFiltroFaena: (val: string) => void;
  empresasUnicas: string[];
  faenasUnicas: string[];
  orden: "FECHA_DESC" | "FECHA_ASC" | "CRITICIDAD_DESC";
  setOrden: (val: "FECHA_DESC" | "FECHA_ASC" | "CRITICIDAD_DESC") => void;
  onExportarCSV: () => void;
  onLimpiarFiltros: () => void;
}

export function ReportesFiltrosBar({
  busqueda,
  setBusqueda,
  filtroTipo,
  setFiltroTipo,
  filtroPeligro,
  setFiltroPeligro,
  filtroGravedad,
  setFiltroGravedad,
  filtroEstado,
  setFiltroEstado,
  filtroPlazo,
  setFiltroPlazo,
  filtroEmpresa,
  setFiltroEmpresa,
  filtroFaena,
  setFiltroFaena,
  empresasUnicas,
  faenasUnicas,
  orden,
  setOrden,
  onExportarCSV,
  onLimpiarFiltros,
}: ReportesFiltrosBarProps) {
  const tieneFiltrosActivos =
    busqueda !== "" ||
    filtroTipo !== "TODOS" ||
    filtroPeligro !== "TODOS" ||
    filtroGravedad !== "TODOS" ||
    filtroEstado !== "TODOS" ||
    filtroPlazo !== "TODOS" ||
    filtroEmpresa !== "TODAS" ||
    filtroFaena !== "TODAS";

  return (
    <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
      {/* Barra superior de Búsqueda y Exportación */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Buscador */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por faena, área, norma (ej. DS 594 Art. 38), responsable o descripción..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Acciones derechas */}
        <div className="flex items-center gap-2">
          {tieneFiltrosActivos && (
            <button
              onClick={onLimpiarFiltros}
              className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 font-bold px-2 py-1.5 hover:underline cursor-pointer"
            >
              Limpiar Filtros
            </button>
          )}

          <button
            onClick={onExportarCSV}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2 px-3 rounded-xl text-xs border border-slate-300 dark:border-slate-800 transition-all flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>📥</span>
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Filtros selectores en cuadrícula */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-900">
        {/* Clasificación */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Clasificación</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value="TODOS">Todos los tipos</option>
            <option value="CONDICION">🛠️ Condición Insegura</option>
            <option value="ACTO">👤 Acto Inseguro</option>
          </select>
        </div>

        {/* Peligro Normativo */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Peligro Normativo</label>
          <select
            value={filtroPeligro}
            onChange={(e) => setFiltroPeligro(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value="TODOS">Todos los peligros</option>
            <option value="SEGURIDAD">Seguridad / Mecánico</option>
            <option value="FISICO">Físico (PREXOR/UV)</option>
            <option value="QUIMICO">Químico (PLANESI)</option>
            <option value="ERGONOMICO">Ergonómico (TMERT)</option>
            <option value="BIOLOGICO">Biológico</option>
            <option value="PSICOSOCIAL">Psicosocial (ISTAS 21)</option>
          </select>
        </div>

        {/* Nivel de Riesgo (PxS) */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nivel Riesgo (PxS)</label>
          <select
            value={filtroGravedad}
            onChange={(e) => setFiltroGravedad(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value="TODOS">Todas las criticidades</option>
            <option value="CRITICO">🔴 Crítico (Intolerable)</option>
            <option value="ALTO">🟠 Alto (Importante)</option>
            <option value="MEDIO">🟡 Medio (Moderado)</option>
            <option value="BAJO">🟢 Bajo (Leve)</option>
          </select>
        </div>

        {/* Estado Operacional */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ABIERTO">Abierto</option>
            <option value="EN_PROCESO">En Proceso</option>
            <option value="RESUELTO">Resuelto</option>
          </select>
        </div>

        {/* Semáforo de Plazo */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Semáforo de Plazo</label>
          <select
            value={filtroPlazo}
            onChange={(e) => setFiltroPlazo(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value="TODOS">Todos los plazos</option>
            <option value="VENCIDO">⚠️ Solo Vencidos</option>
            <option value="POR_VENCER">⏳ Por Vencer (≤ 5 días)</option>
            <option value="EN_PLAZO">🟢 En Plazo</option>
            <option value="RESUELTO">✅ Subsanados</option>
          </select>
        </div>

        {/* Ordenamiento */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Orden</label>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as "FECHA_DESC" | "FECHA_ASC" | "CRITICIDAD_DESC")}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value="FECHA_DESC">Más recientes</option>
            <option value="FECHA_ASC">Más antiguos</option>
            <option value="CRITICIDAD_DESC">Mayor criticidad (PxS)</option>
          </select>
        </div>
      </div>

      {/* Selectores de Empresa y Faena (si existen registros) */}
      {(empresasUnicas.length > 0 || faenasUnicas.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-900/60">
          {empresasUnicas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Empresa:</span>
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <option value="TODAS">Todas las empresas</option>
                {empresasUnicas.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>
            </div>
          )}

          {faenasUnicas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Área / Faena:</span>
              <select
                value={filtroFaena}
                onChange={(e) => setFiltroFaena(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <option value="TODAS">Todas las áreas</option>
                {faenasUnicas.map((faena) => (
                  <option key={faena} value={faena}>
                    {faena}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
