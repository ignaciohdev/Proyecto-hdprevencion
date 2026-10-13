"use client";

import { ReporteRiesgo } from "../types";
import { ReporteItemCard } from "./ReporteItemCard";

interface ReportesListadoProps {
  loading: boolean;
  error: string | null;
  reportesFiltrados: ReporteRiesgo[];
  reportesPaginados: ReporteRiesgo[];
  paginaActual: number;
  totalPaginas: number;
  onCambiarPagina: (pagina: number) => void;
  onRetry: () => void;
  onLimpiarFiltros: () => void;
  onOpenCrear: () => void;
  onResolve: (reporte: ReporteRiesgo) => void;
  onDelete: (id: number) => void;
  onPreviewFoto: (url: string) => void;
}

export function ReportesListado({
  loading,
  error,
  reportesFiltrados,
  reportesPaginados,
  paginaActual,
  totalPaginas,
  onCambiarPagina,
  onRetry,
  onLimpiarFiltros,
  onOpenCrear,
  onResolve,
  onDelete,
  onPreviewFoto,
}: ReportesListadoProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 flex-col space-y-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-semibold">Cargando inspecciones y hallazgos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center">
        <p className="font-bold">Error al cargar la bitácora técnica</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (reportesFiltrados.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
        <span className="text-5xl mb-3">🛡️</span>
        <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
          Sin Hallazgos para los Filtros Seleccionados
        </h3>
        <p className="text-slate-500 text-xs md:text-sm mt-1 max-w-md">
          No se encontraron condiciones o actos subestándar con los criterios actuales.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onLimpiarFiltros}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
          >
            Restablecer Filtros
          </button>
          <button
            onClick={onOpenCrear}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-5 rounded-xl text-xs shadow cursor-pointer"
          >
            ➕ Levantar Hallazgo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs text-slate-500 font-semibold px-1">
        <span>Mostrando {reportesPaginados.length} de {reportesFiltrados.length} hallazgo(s)</span>
        <span>Estándar Mutualidad & DT</span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reportesPaginados.map((rep) => (
          <ReporteItemCard
            key={rep.id}
            reporte={rep}
            onResolve={onResolve}
            onDelete={onDelete}
            onPreviewFoto={onPreviewFoto}
          />
        ))}
      </div>

      {/* Paginador */}
      {totalPaginas > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <button
            disabled={paginaActual === 1}
            onClick={() => onCambiarPagina(paginaActual - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-700 dark:text-slate-300"
          >
            ← Anterior
          </button>
          <span className="text-xs text-slate-500 font-medium px-2">
            Página {paginaActual} de {totalPaginas}
          </span>
          <button
            disabled={paginaActual === totalPaginas}
            onClick={() => onCambiarPagina(paginaActual + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-700 dark:text-slate-300"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
