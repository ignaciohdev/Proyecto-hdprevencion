"use client";

import { useState } from "react";
import { ReporteRiesgo, MetricasReportes, DatosInformeVisita, calcularMatrizRiesgo } from "../types";

interface ModalInformeVisitaProps {
  isOpen: boolean;
  onClose: () => void;
  reportes: ReporteRiesgo[];
  metricas: MetricasReportes;
}

export function ModalInformeVisita({
  isOpen,
  onClose,
  reportes,
  metricas,
}: ModalInformeVisitaProps) {
  const [datosInforme, setDatosInforme] = useState<DatosInformeVisita>({
    empresa_cliente: "Empresa Mandante / Faena Principal",
    faena_lugar: "Instalación Central / Faena",
    nombre_experto: "Prevencionista de Riesgos",
    registro_experto: "SNS / SEREMI Reg. N° RM/I-",
    administrador_faena: "Administrador de Faena / Empleador",
    fecha_visita: new Date().toISOString().split("T")[0],
    observaciones_generales:
      "Se realiza recorrido de inspección técnica en terreno para dar cumplimiento a las obligaciones legales de la Ley 16.744, DS 594 y DS 76. A continuación, se detallan los hallazgos levantados y las prescripciones técnicas obligatorias.",
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-8 max-w-4xl w-full shadow-2xl my-4 sm:my-8 relative max-h-[90vh] overflow-y-auto">
        {/* Cabecera modal no imprimible */}
        <div className="no-print flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
              Estándar Mutualidades (ACHS / Mutual / IST) & Dirección del Trabajo
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Informe Técnico de Visita en Terreno
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-xl text-xs shadow flex items-center space-x-1.5 cursor-pointer"
            >
              <span>🖨️</span>
              <span>Imprimir / Descargar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Configuración rápida de metadatos del informe (no-print) */}
        <div className="no-print bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 space-y-3 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 block">
            ⚙️ Datos para el Membrete y Firmas del Informe Técnico:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Empresa Asesorada</label>
              <input
                type="text"
                value={datosInforme.empresa_cliente}
                onChange={(e) => setDatosInforme({ ...datosInforme, empresa_cliente: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Faena / Instalación</label>
              <input
                type="text"
                value={datosInforme.faena_lugar}
                onChange={(e) => setDatosInforme({ ...datosInforme, faena_lugar: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Fecha de Inspección</label>
              <input
                type="date"
                value={datosInforme.fecha_visita}
                onChange={(e) => setDatosInforme({ ...datosInforme, fecha_visita: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Experto en Prevención y Registro SNS</label>
              <input
                type="text"
                value={datosInforme.nombre_experto}
                onChange={(e) => setDatosInforme({ ...datosInforme, nombre_experto: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
                placeholder="Nombre del Experto"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">N° Registro SNS / SEREMI</label>
              <input
                type="text"
                value={datosInforme.registro_experto}
                onChange={(e) => setDatosInforme({ ...datosInforme, registro_experto: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOCUMENTO FORMAL IMPRIMIBLE (ESTÁNDAR LEY 16.744) */}
        {/* ============================================================== */}
        <div id="informe-tecnico-imprimible" className="bg-white text-slate-900 p-6 md:p-8 rounded-xl border border-slate-300 text-xs font-sans space-y-6">
          {/* Membrete formal */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black text-orange-600 tracking-wider">HD PREVENCIÓN</span>
                <span className="text-slate-400 text-xs font-semibold">| SaaS de Gestión SST</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-1 uppercase tracking-tight">
                INFORME TÉCNICO DE VISITA EN TERRENO
              </h3>
              <p className="text-[11px] text-slate-600">
                Levantamiento de No Conformidades y Prescripciones de Medidas Correctivas (Art. 66 Ley 16.744)
              </p>
            </div>

            <div className="text-right text-[11px] text-slate-700 space-y-0.5">
              <p><strong>Fecha Visita:</strong> {datosInforme.fecha_visita}</p>
              <p><strong>N° Documento:</strong> IT-{new Date().getFullYear()}-{reportes.length}</p>
              <p><strong>Estado:</strong> Oficial</p>
            </div>
          </div>

          {/* Antecedentes de la Asesoría */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px]">
            <div>
              <p><strong>Empresa Asesorada:</strong> {datosInforme.empresa_cliente}</p>
              <p><strong>Faena / Instalación:</strong> {datosInforme.faena_lugar}</p>
            </div>
            <div>
              <p><strong>Experto Asesor:</strong> {datosInforme.nombre_experto}</p>
              <p><strong>Registro SNS / SEREMI:</strong> {datosInforme.registro_experto}</p>
            </div>
          </div>

          {/* Marco Legal */}
          <div className="text-[10px] text-slate-600 bg-slate-50/50 p-2.5 rounded border border-slate-200 italic leading-relaxed">
            <strong>Marco Regulatorio:</strong> En cumplimiento del Art. 66 de la Ley 16.744 y Circular 3333 de la SUSESO, el empleador está obligado a adoptar las medidas de higiene y seguridad prescritas por el Departamento de Prevención de Riesgos. El incumplimiento faculta el recargo de cotización adicional o sanciones de la Autoridad Sanitaria / Inspección del Trabajo.
          </div>

          {/* Resumen Estadístico de Hallazgos */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
              1. Resumen de Hallazgos Levantados
            </h4>
            <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
              <div className="p-2 border rounded bg-slate-50">
                <span className="block font-bold text-slate-700">Total Hallazgos</span>
                <span className="text-base font-extrabold">{reportes.length}</span>
              </div>
              <div className="p-2 border rounded bg-red-50 text-red-800">
                <span className="block font-bold">Críticos / Altos</span>
                <span className="text-base font-extrabold">{metricas.criticosOAltos}</span>
              </div>
              <div className="p-2 border rounded bg-amber-50 text-amber-800">
                <span className="block font-bold">Plazos Vencidos</span>
                <span className="text-base font-extrabold">{metricas.vencidos}</span>
              </div>
              <div className="p-2 border rounded bg-emerald-50 text-emerald-800">
                <span className="block font-bold">Subsanados</span>
                <span className="text-base font-extrabold">{metricas.resueltos}</span>
              </div>
            </div>
          </div>

          {/* Tabla Detallada de Prescripciones */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
              2. Matriz de Hallazgos y Prescripción de Medidas Correctivas
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold">
                    <th className="p-2 border border-slate-700">N°</th>
                    <th className="p-2 border border-slate-700">Ubicación / Puesto</th>
                    <th className="p-2 border border-slate-700">Clasificación & Peligro</th>
                    <th className="p-2 border border-slate-700">Norma Infringida</th>
                    <th className="p-2 border border-slate-700">Descripción del Hallazgo</th>
                    <th className="p-2 border border-slate-700">PxS</th>
                    <th className="p-2 border border-slate-700">Medida Prescrita & Jerarquía</th>
                    <th className="p-2 border border-slate-700">Responsable</th>
                    <th className="p-2 border border-slate-700">Plazo</th>
                  </tr>
                </thead>
                <tbody>
                  {reportes.map((rep, idx) => {
                    const crit = calcularMatrizRiesgo(rep.probabilidad || 2, rep.severidad || 2);
                    return (
                      <tr key={rep.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-1.5 border border-slate-300 font-bold text-center">{idx + 1}</td>
                        <td className="p-1.5 border border-slate-300 font-semibold">{rep.lugar}</td>
                        <td className="p-1.5 border border-slate-300">
                          <span className="font-bold block">{rep.tipo === "CONDICION" ? "Condición" : "Acto"}</span>
                          <span className="text-slate-500">{rep.clasificacion_peligro}</span>
                        </td>
                        <td className="p-1.5 border border-slate-300 font-semibold text-amber-800">
                          {rep.norma_infringida || "DS 594"}
                        </td>
                        <td className="p-1.5 border border-slate-300 max-w-xs">{rep.descripcion}</td>
                        <td className="p-1.5 border border-slate-300 text-center font-bold">
                          {crit.nivel} ({crit.score})
                        </td>
                        <td className="p-1.5 border border-slate-300">
                          <span className="font-bold block text-slate-700">
                            [{rep.jerarquia_control || "ADMINISTRATIVO"}]
                          </span>
                          {rep.medida_correctiva || "Mitigar condición insegura."}
                        </td>
                        <td className="p-1.5 border border-slate-300">{rep.responsable || "Supervisor"}</td>
                        <td className="p-1.5 border border-slate-300 font-bold whitespace-nowrap">
                          {rep.fecha_limite || "Inmediato"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cuadro de Doble Firma Legal */}
          <div className="pt-10 border-t border-slate-300 mt-8">
            <div className="grid grid-cols-2 gap-12 text-center text-[11px]">
              <div className="space-y-1">
                <div className="border-t border-slate-800 pt-2 w-48 mx-auto font-bold">
                  {datosInforme.nombre_experto}
                </div>
                <p className="text-slate-600">Experto en Prevención de Riesgos</p>
                <p className="text-slate-500 text-[10px]">Reg. SNS: {datosInforme.registro_experto}</p>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-800 pt-2 w-48 mx-auto font-bold">
                  {datosInforme.administrador_faena}
                </div>
                <p className="text-slate-600">Recepción Administrador de Faena / Empresa</p>
                <p className="text-slate-500 text-[10px]">Toma de Conocimiento (Art. 66 Ley 16.744)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pie del modal no imprimible */}
        <div className="no-print flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer"
          >
            Cerrar Previsualización
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-6 rounded-xl text-xs cursor-pointer shadow-lg"
          >
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
