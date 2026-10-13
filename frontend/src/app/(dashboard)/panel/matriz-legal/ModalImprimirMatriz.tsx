"use client";

import { MatrizLegal, ItemMatrizLegal, ORGANISMOS_CONFIG, ESTADO_CONFIG } from "./types";

interface ModalImprimirMatrizProps {
  isOpen: boolean;
  onClose: () => void;
  matriz: MatrizLegal | null;
  items: ItemMatrizLegal[];
}

export default function ModalImprimirMatriz({
  isOpen,
  onClose,
  matriz,
  items,
}: ModalImprimirMatrizProps) {
  if (!isOpen || !matriz) return null;

  const handlePrint = () => {
    window.print();
  };

  const semaforoColor =
    matriz.estado_semaforo === "OPTIMO"
      ? "text-emerald-700 bg-emerald-100 border-emerald-300"
      : matriz.estado_semaforo === "REGULAR"
      ? "text-amber-700 bg-amber-100 border-amber-300"
      : "text-red-700 bg-red-100 border-red-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      {/* Contenedor principal con estilo documento A4 */}
      <div className="relative w-full max-w-5xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:my-0 print:border-none print:shadow-none print:w-full print:max-w-none">
        
        {/* Barra superior no imprimible */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="font-bold text-sm">Vista Previa de Informe Ejecutivo Imprimible</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Imprimir / Guardar en PDF</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* CONTENIDO IMPRIMIBLE OFICIAL */}
        <div className="p-8 sm:p-12 space-y-8 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-6">
          
          {/* Membrete Oficial */}
          <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-black text-orange-600 tracking-tight">HD PREVENCIÓN</span>
                <span className="text-xs text-slate-500 font-medium">• Software de Seguridad Laboral</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Matriz de Cumplimiento Legal SST
              </h1>
              <p className="text-xs text-slate-600">
                Auditoría Normativa Conforme a D.S. N° 594, Ley N° 16.744, D.S. N° 44 y Ley Karin N° 21.643
              </p>
            </div>

            <div className="text-right sm:text-right text-xs text-slate-600">
              <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString("es-CL")}</p>
              <p><strong>Folio Auditoría:</strong> ML-{matriz.id.toString().padStart(6, "0")}</p>
              <p><strong>Rubro Evaluado:</strong> {matriz.rubro_principal_display}</p>
            </div>
          </div>

          {/* Datos de la Empresa y Faena */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Razón Social:</span>
              <strong className="text-slate-900">{matriz.empresa_nombre}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">RUT Empresa:</span>
              <span className="text-slate-900 font-mono font-bold">{matriz.empresa_rut}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Centro de Trabajo / Faena:</span>
              <span className="text-slate-900">{matriz.centro_trabajo_nombre || "Casa Matriz / Toda la Empresa"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Organismo Administrador (Mutual):</span>
              <span className="text-slate-900 font-bold">{matriz.empresa_mutualidad || "No informada"}</span>
            </div>
          </div>

          {/* Resumen Ejecutivo y Semáforo */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-xl border border-slate-200 bg-slate-50/70 gap-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Nivel Global de Conformidad Legal:
              </span>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-900">{matriz.porcentaje_cumplimiento}%</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black border ${semaforoColor}`}>
                  ESTADO {matriz.estado_semaforo}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-lg font-black text-emerald-700 block">{matriz.cumplidos}</span>
                <span className="text-[10px] text-emerald-800 font-semibold">Cumplidos</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-lg font-black text-amber-700 block">{matriz.en_proceso}</span>
                <span className="text-[10px] text-amber-800 font-semibold">En Proceso</span>
              </div>
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                <span className="text-lg font-black text-red-700 block">{matriz.brechas_criticas}</span>
                <span className="text-[10px] text-red-800 font-semibold">Brechas Críticas</span>
              </div>
            </div>
          </div>

          {/* TABLA DE EVALUACIÓN DETALLADA */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Detalle de Requisitos y Evidencias de Cumplimiento
            </h3>

            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2 border-r border-slate-300 w-24">Organismo</th>
                  <th className="p-2 border-r border-slate-300 w-36">Norma y Artículo</th>
                  <th className="p-2 border-r border-slate-300">Materia / Exigencia Obligatoria</th>
                  <th className="p-2 border-r border-slate-300 w-28">Estado</th>
                  <th className="p-2 border-r border-slate-300">Evidencia Documentada</th>
                  <th className="p-2 w-28">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const org = ORGANISMOS_CONFIG[it.organismo]?.label || it.organismo;
                  const est = ESTADO_CONFIG[it.estado]?.label || it.estado;
                  return (
                    <tr
                      key={it.id}
                      className={`border-b border-slate-200 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      <td className="p-2 border-r border-slate-300 font-semibold text-slate-700">
                        {it.organismo}
                      </td>
                      <td className="p-2 border-r border-slate-300 font-bold text-slate-900">
                        {it.identificacion_norma} <br />
                        <span className="text-slate-500 font-normal">{it.articulo}</span>
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <strong className="text-slate-900 block mb-0.5">{it.titulo}</strong>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{it.descripcion_exigencia}</p>
                      </td>
                      <td className="p-2 border-r border-slate-300 font-bold">
                        <span
                          className={
                            it.estado === "CUMPLE"
                              ? "text-emerald-700"
                              : it.estado === "NO_CUMPLE"
                              ? "text-red-700"
                              : "text-amber-700"
                          }
                        >
                          {est}
                        </span>
                      </td>
                      <td className="p-2 border-r border-slate-300 text-[11px] text-slate-700">
                        {it.evidencia_cumplimiento || (
                          <span className="text-slate-400 italic">Sin evidencia documentada</span>
                        )}
                      </td>
                      <td className="p-2 text-[11px] text-slate-700">
                        {it.responsable || "No asignado"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cuadro de Firmas Legales */}
          <div className="pt-16 grid grid-cols-2 gap-16 text-center text-xs break-inside-avoid">
            <div className="border-t border-slate-800 pt-3">
              <strong className="block text-slate-900 text-sm">{matriz.prevencionista_nombre}</strong>
              <span className="text-slate-600 block">Prevencionista de Riesgos Auditor</span>
              <span className="text-slate-400 text-[11px]">Registro Nacional SNS / Seremi de Salud</span>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <strong className="block text-slate-900 text-sm">Representante Legal / Gerencia</strong>
              <span className="text-slate-600 block">{matriz.empresa_nombre}</span>
              <span className="text-slate-400 text-[11px]">Toma de conocimiento y plan de acción</span>
            </div>
          </div>

          {/* Pie de Página */}
          <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">
            Documento emitido electrónicamente por HD Prevención para fines de auditoría ante la Dirección del Trabajo (DT) y Seremi de Salud.
          </div>
        </div>
      </div>
    </div>
  );
}
