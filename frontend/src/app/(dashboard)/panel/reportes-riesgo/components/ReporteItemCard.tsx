"use client";

import {
  ReporteRiesgo,
  JERARQUIA_CONTROLES,
  calcularMatrizRiesgo,
  getEstadoPlazoLegal,
} from "../types";

interface ReporteItemCardProps {
  reporte: ReporteRiesgo;
  onResolve: (reporte: ReporteRiesgo) => void;
  onDelete?: (id: number) => void;
  onPreviewFoto: (url: string) => void;
}

export function ReporteItemCard({
  reporte,
  onResolve,
  onDelete,
  onPreviewFoto,
}: ReporteItemCardProps) {
  const semaforoPlazo = getEstadoPlazoLegal(reporte.fecha_limite, reporte.estado);
  const criticidad = calcularMatrizRiesgo(reporte.probabilidad || 2, reporte.severidad || 2);
  const jerarquiaObj = JERARQUIA_CONTROLES.find((j) => j.valor === reporte.jerarquia_control);

  return (
    <div
      className={`bg-white dark:bg-slate-950 p-5 md:p-6 rounded-2xl border transition-all shadow-sm hover:shadow-md ${
        reporte.estado === "RESUELTO"
          ? "border-slate-200 dark:border-slate-800/80 opacity-90"
          : semaforoPlazo.estado === "VENCIDO"
          ? "border-red-300 dark:border-red-900/60 bg-red-50/10"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
        {/* Contenido principal */}
        <div className="space-y-3 flex-1">
          {/* Fila de Insignias / Badges Legales */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Clasificación */}
            <span
              className={`font-bold px-2.5 py-0.5 rounded-full ${
                reporte.tipo === "CONDICION"
                  ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                  : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
              }`}
            >
              {reporte.tipo === "CONDICION" ? "🛠️ Condición Subestándar" : "👤 Acto Subestándar"}
            </span>

            {/* Peligro Normativo */}
            <span className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800 font-semibold px-2.5 py-0.5 rounded-full">
              {reporte.clasificacion_peligro || "SEGURIDAD"}
            </span>

            {/* Norma Infringida */}
            {reporte.norma_infringida && (
              <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold px-2.5 py-0.5 rounded-full">
                📜 {reporte.norma_infringida}
              </span>
            )}

            {/* Criticidad P x S */}
            <span className={`font-bold px-2.5 py-0.5 rounded-full border ${criticidad.colorBadge}`}>
              Criticidad: {criticidad.etiqueta.split(" ")[0]} (PxS: {criticidad.score})
            </span>

            {/* Semáforo Plazo */}
            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] ${semaforoPlazo.badgeClase}`}>
              {semaforoPlazo.etiqueta}
            </span>
          </div>

          {/* Ubicación y Faena */}
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              📍 {reporte.empresa_faena ? `${reporte.empresa_faena} — ` : ""}
              {reporte.area_puesto ? `${reporte.area_puesto} ` : ""}
              <span className="font-normal text-slate-600 dark:text-slate-400">
                ({reporte.lugar})
              </span>
            </p>
          </div>

          {/* Descripción del Hallazgo */}
          <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-line leading-relaxed">
            {reporte.descripcion}
          </p>

          {/* Evidencia Fotográfica y Medida */}
          <div className="flex flex-col sm:flex-row gap-4 pt-1">
            {reporte.foto_evidencia && (
              <div className="shrink-0">
                <img
                  src={reporte.foto_evidencia}
                  alt="Evidencia fotográfica en terreno"
                  onClick={() => onPreviewFoto(reporte.foto_evidencia)}
                  className="h-24 w-24 object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                  title="Clic para ver foto en tamaño completo"
                />
                <span
                  onClick={() => onPreviewFoto(reporte.foto_evidencia)}
                  className="text-[10px] text-slate-400 block text-center mt-1 cursor-pointer hover:text-orange-500"
                >
                  🔍 Ampliar foto
                </span>
              </div>
            )}

            {/* Medida y Jerarquía de Control */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  📋 Medida Correctiva Prescrita:
                </span>
                {jerarquiaObj && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${jerarquiaObj.color}`}>
                    {jerarquiaObj.etiqueta}
                  </span>
                )}
              </div>

              <p className="text-slate-600 dark:text-slate-400 italic">
                {reporte.medida_correctiva || "Sin prescripción técnica detallada."}
              </p>

              {/* Responsable y Plazo Art. 66 */}
              <div className="flex items-center space-x-4 pt-1 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
                <span>
                  👤 <strong>Responsable:</strong> {reporte.responsable || "Supervisor de Faena"}
                </span>
                <span>
                  📅 <strong>Plazo:</strong> {reporte.fecha_limite || "Inmediato"}
                </span>
              </div>
            </div>
          </div>

          {/* Medida Correctiva Aplicada si está resuelto */}
          {reporte.estado === "RESUELTO" && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-400 block">
                ✅ Subsanación y Cierre Verificado:
              </span>
              <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                {reporte.medida_correctiva}
              </p>
              {reporte.fecha_resolucion && (
                <span className="text-[10px] text-slate-400 block mt-1">
                  Fecha de Cierre: {new Date(reporte.fecha_resolucion).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Notificación QR Trabajador si aplica */}
          {reporte.reportado_por_externo && (
            <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/30 text-[11px] text-amber-800 dark:text-amber-400">
              🏗️ <strong>Reporte Participativo QR Trabajador:</strong> {reporte.nombre_reportante || "Anónimo"}{" "}
              {reporte.rut_reportante ? `(${reporte.rut_reportante})` : ""}
            </div>
          )}

          {/* Metadatos inferiores */}
          <div className="text-[10px] text-slate-400 flex items-center space-x-3 pt-1">
            <span>Registrado por: {reporte.username || "Prevencionista"}</span>
            <span>•</span>
            <span>Fecha: {new Date(reporte.fecha_creacion).toLocaleString()}</span>
          </div>
        </div>

        {/* Botones de Acción Lateral */}
        <div className="self-end lg:self-center shrink-0 flex items-center gap-2">
          {reporte.estado !== "RESUELTO" ? (
            <button
              onClick={() => onResolve(reporte)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow transition-all hover:scale-[1.02] cursor-pointer flex items-center space-x-1.5"
            >
              <span>✓</span>
              <span>Cerrar Hallazgo</span>
            </button>
          ) : (
            <span className="bg-slate-100 dark:bg-slate-900 text-slate-400 font-semibold py-2 px-3 rounded-xl text-xs border border-slate-200 dark:border-slate-800">
              Resuelto ✓
            </span>
          )}

          {onDelete && (
            <button
              onClick={() => {
                if (confirm("¿Estás seguro de que deseas eliminar este hallazgo?")) {
                  onDelete(reporte.id);
                }
              }}
              className="text-slate-400 hover:text-red-500 p-2 rounded-lg text-xs cursor-pointer transition-colors"
              title="Eliminar hallazgo"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
