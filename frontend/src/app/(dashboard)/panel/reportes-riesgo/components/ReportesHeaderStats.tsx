"use client";

import { MetricasReportes } from "../types";

interface ReportesHeaderStatsProps {
  metricas: MetricasReportes;
  onOpenPlantillas: () => void;
  onOpenInforme: () => void;
  onOpenCrear: () => void;
  onFilterVencidos: () => void;
}

export function ReportesHeaderStats({
  metricas,
  onOpenPlantillas,
  onOpenInforme,
  onOpenCrear,
  onFilterVencidos,
}: ReportesHeaderStatsProps) {
  return (
    <div className="space-y-6">
      {/* 1. Encabezado Técnico Ejecutivo */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl shadow-xl border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <span className="bg-orange-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              SST Normativa Chile (DS 594 - Ley 16.744)
            </span>
            <span className="bg-slate-800 text-slate-300 text-xs font-semibold px-3 py-1 rounded-full border border-slate-700">
              Inspecciones en Terreno
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-3 leading-tight tracking-tight">
            Inspecciones y Hallazgos en Terreno
          </h1>
          <p className="text-slate-400 mt-2 text-xs md:text-sm max-w-2xl leading-relaxed">
            Levantamiento de no conformidades, condiciones y actos subestándar. Evalúa criticidad con la matriz cuantitativa PxS, prescribe jerarquía de control legal y emite el Informe Técnico de Visita en un clic.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap gap-2.5 w-full lg:w-auto">
          <button
            onClick={onOpenPlantillas}
            className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs border border-slate-700 shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center space-x-2 cursor-pointer"
            title="Cargar plantillas predefinidas de DS 594, DS 76 y MINSAL"
          >
            <span>📋</span>
            <span>Plantillas DS 594</span>
          </button>

          <button
            onClick={onOpenInforme}
            className="flex-1 sm:flex-none bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] flex items-center justify-center space-x-2 cursor-pointer"
            title="Generar e imprimir Informe Técnico de Visita con firma formal"
          >
            <span>📄</span>
            <span>Informe Técnico PDF</span>
          </button>

          <button
            onClick={onOpenCrear}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>➕</span>
            <span>Levantar Hallazgo</span>
          </button>
        </div>
      </div>

      {/* 2. Panel de Métricas y Semáforo Legal */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {/* Total Hallazgos */}
        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Total Hallazgos</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metricas.total}</p>
          <span className="text-[10px] text-slate-400">Levantados en faena</span>
        </div>

        {/* Pendientes de Acción */}
        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Pendientes de Acción</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{metricas.abiertos}</p>
          <span className="text-[10px] text-slate-400">Requieren medidas</span>
        </div>

        {/* Críticos & Altos */}
        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Críticos & Altos</p>
          <p className="text-2xl font-black text-orange-600 mt-1">{metricas.criticosOAltos}</p>
          <span className="text-[10px] text-slate-400">Atención inmediata</span>
        </div>

        {/* Semáforo de Plazos Vencidos */}
        <div
          onClick={onFilterVencidos}
          className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${
            metricas.vencidos > 0
              ? "bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-900 hover:border-red-500"
              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          }`}
          title="Clic para filtrar solo hallazgos vencidos"
        >
          <p className="text-red-700 dark:text-red-400 text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center space-x-1">
            <span>⚠️ Plazos Vencidos</span>
          </p>
          <p className="text-2xl font-black text-red-600 mt-1">{metricas.vencidos}</p>
          <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
            {metricas.vencidos > 0 ? "¡Riesgo Legal / Multas DT!" : "Sin atrasos en faena"}
          </span>
        </div>

        {/* Subsanados */}
        <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Subsanados</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{metricas.resueltos}</p>
          <span className="text-[10px] text-slate-400">
            {metricas.resueltosMes > 0 ? `${metricas.resueltosMes} cerrados este mes` : "Condición corregida"}
          </span>
        </div>
      </div>
    </div>
  );
}
