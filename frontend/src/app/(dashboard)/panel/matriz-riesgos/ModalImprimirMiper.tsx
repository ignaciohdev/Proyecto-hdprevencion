"use client";

import { MatrizRiesgoMiper, ItemMatrizRiesgo } from "./types";

interface ModalImprimirMiperProps {
  isOpen: boolean;
  onClose: () => void;
  matriz: MatrizRiesgoMiper | null;
  items: ItemMatrizRiesgo[];
}

export default function ModalImprimirMiper({
  isOpen,
  onClose,
  matriz,
  items,
}: ModalImprimirMiperProps) {
  if (!isOpen || !matriz) return null;

  const handlePrint = () => {
    window.print();
  };

  const fechaImpresion = new Date().toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      {/* Contenedor apaisado (Landscape) */}
      <div className="relative w-full max-w-[95vw] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 print:my-0 print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Barra superior de control (Oculta al imprimir) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs">
              🖨️
            </span>
            <span className="font-bold text-sm">
              Vista Previa de Informe Técnico Oficial MIPER (Formato Apaisado)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <span>Imprimir / Exportar a PDF</span>
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

        {/* Estilo para forzar orientación horizontal al imprimir */}
        <style jsx global>{`
          @media print {
            @page {
              size: landscape;
              margin: 8mm;
            }
            body {
              background: white !important;
              color: black !important;
            }
          }
        `}</style>

        {/* CONTENIDO DEL REPORTE TÉCNICO OFICIAL */}
        <div className="p-8 print:p-2 space-y-6 text-slate-800 text-xs">
          {/* Membrete Oficial */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-600 font-black text-xl tracking-tight">HD</span>
                  <span className="font-bold text-slate-900 text-base">PREVENCIÓN</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono border border-slate-300">
                    SST SAAS CHILE
                  </span>
                </div>
                <h1 className="text-base font-extrabold text-slate-900 mt-2 uppercase tracking-wide">
                  Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER)
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">
                  Conforme a Guía Técnica MIPER/IPER del ISP • D.S. N° 44 (2025/2026) • ISO 45001 • D.S. N° 594 • Ley N° 16.744
                </p>
              </div>

              {/* Caja de Registro y Versión */}
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 text-[11px] text-right min-w-[220px]">
                <div><strong>Código / Versión:</strong> MIPER-v{matriz.version}</div>
                <div><strong>Estado:</strong> {matriz.estado_display || matriz.estado}</div>
                <div><strong>Fecha Aprobación:</strong> {matriz.fecha_aprobacion || "Pendiente"}</div>
                <div><strong>Próx. Revisión:</strong> {matriz.fecha_proxima_revision || "Periódica (1 año)"}</div>
                <div><strong>Emisión:</strong> {fechaImpresion}</div>
              </div>
            </div>

            {/* Ficha de la Empresa y Centro de Trabajo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 p-3 bg-slate-100/80 rounded-lg border border-slate-200 text-[11px]">
              <div>
                <span className="text-slate-500 block">Razón Social:</span>
                <strong className="text-slate-900">{matriz.empresa_nombre}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">RUT Empresa:</span>
                <strong className="text-slate-900">{matriz.empresa_rut}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Centro de Trabajo / Faena:</span>
                <strong className="text-slate-900">
                  {matriz.centro_trabajo_nombre || "Instalaciones Generales"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Prevencionista Responsable:</span>
                <strong className="text-slate-900">{matriz.prevencionista_nombre}</strong>
              </div>
            </div>

            {/* Fila de Resumen Técnico */}
            <div className="grid grid-cols-4 gap-2 mt-3 text-center text-[11px]">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <span className="text-slate-500 block">Total Peligros</span>
                <strong className="text-sm font-bold">{matriz.total_peligros}</strong>
              </div>
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-900">
                <span className="block opacity-80">Riesgos Críticos Puros</span>
                <strong className="text-sm font-bold">{matriz.criticos_puros}</strong>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900">
                <span className="block opacity-80">Críticos Residuales</span>
                <strong className="text-sm font-bold">{matriz.criticos_residuales}</strong>
              </div>
              <div className="p-2 bg-teal-50 border border-teal-200 rounded text-teal-900">
                <span className="block opacity-80">Mitigación Global</span>
                <strong className="text-sm font-bold">{matriz.porcentaje_reduccion_riesgo}%</strong>
              </div>
            </div>
          </div>

          {/* Tabla Técnica de la Matriz IPER */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-400 text-[10px]">
              <thead>
                <tr className="bg-slate-800 text-white font-bold text-center">
                  <th rowSpan={2} className="border border-slate-400 p-1.5 w-8">#</th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 w-24">Proceso</th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 w-32">Actividad / Puesto</th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 w-36">Peligro Identificado</th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 w-36">Riesgo / Consecuencia</th>
                  <th colSpan={3} className="border border-slate-400 p-1.5 bg-slate-900">
                    Evaluación Riesgo Puro
                  </th>
                  <th colSpan={5} className="border border-slate-400 p-1.5 bg-slate-700">
                    Jerarquía de Controles Aplicados (Guía ISP)
                  </th>
                  <th colSpan={3} className="border border-slate-400 p-1.5 bg-slate-900">
                    Evaluación Riesgo Residual
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 w-24">Responsable / Plazo</th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 w-20">Estado</th>
                </tr>
                <tr className="bg-slate-700 text-white font-semibold text-center text-[9px]">
                  {/* Puro */}
                  <th className="border border-slate-400 p-1 w-7">P</th>
                  <th className="border border-slate-400 p-1 w-7">S</th>
                  <th className="border border-slate-400 p-1 w-14">MR</th>
                  {/* Jerarquía */}
                  <th className="border border-slate-400 p-1 w-24">1. Eliminación</th>
                  <th className="border border-slate-400 p-1 w-24">2. Sustitución</th>
                  <th className="border border-slate-400 p-1 w-32">3. Ingeniería</th>
                  <th className="border border-slate-400 p-1 w-32">4. Administrativo</th>
                  <th className="border border-slate-400 p-1 w-28">5. EPP</th>
                  {/* Residual */}
                  <th className="border border-slate-400 p-1 w-7">Pr</th>
                  <th className="border border-slate-400 p-1 w-7">Sr</th>
                  <th className="border border-slate-400 p-1 w-14">MR</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="p-8 text-center text-slate-500 italic">
                      No se han registrado ítems evaluados en esta matriz MIPER.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const bgPuro =
                      item.clasificacion_pura === "CRITICO"
                        ? "bg-red-100 text-red-900 font-bold"
                        : item.clasificacion_pura === "ALTO"
                        ? "bg-orange-100 text-orange-900 font-bold"
                        : item.clasificacion_pura === "MEDIO"
                        ? "bg-amber-100 text-amber-900 font-bold"
                        : "bg-emerald-100 text-emerald-900 font-bold";

                    const bgResidual =
                      item.clasificacion_residual === "CRITICO"
                        ? "bg-red-100 text-red-900 font-bold"
                        : item.clasificacion_residual === "ALTO"
                        ? "bg-orange-100 text-orange-900 font-bold"
                        : item.clasificacion_residual === "MEDIO"
                        ? "bg-amber-100 text-amber-900 font-bold"
                        : "bg-emerald-100 text-emerald-900 font-bold";

                    return (
                      <tr key={item.id} className="border-b border-slate-300 hover:bg-slate-50">
                        <td className="border border-slate-300 p-1 text-center font-mono font-bold">
                          {index + 1}
                        </td>
                        <td className="border border-slate-300 p-1 font-semibold">{item.proceso}</td>
                        <td className="border border-slate-300 p-1">
                          <div className="font-medium text-slate-900">{item.actividad}</div>
                          <div className="text-[9px] text-slate-500">
                            {item.puesto_trabajo} • {item.tipo_actividad}
                          </div>
                        </td>
                        <td className="border border-slate-300 p-1">
                          <div>{item.peligro}</div>
                          <span className="inline-block mt-0.5 px-1 py-0.2 rounded text-[8px] font-semibold bg-slate-200 text-slate-700">
                            {item.clasificacion_peligro}
                          </span>
                        </td>
                        <td className="border border-slate-300 p-1 text-slate-700">
                          {item.riesgo_consecuencia}
                        </td>

                        {/* Puro */}
                        <td className="border border-slate-300 p-1 text-center">{item.probabilidad_pura}</td>
                        <td className="border border-slate-300 p-1 text-center">{item.severidad_pura}</td>
                        <td className={`border border-slate-300 p-1 text-center ${bgPuro}`}>
                          <div>{item.magnitud_pura}</div>
                          <div className="text-[8px] uppercase">{item.clasificacion_pura}</div>
                        </td>

                        {/* Jerarquía */}
                        <td className="border border-slate-300 p-1 text-[9px]">
                          {item.control_eliminacion || <span className="text-slate-400">N/A</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[9px]">
                          {item.control_sustitucion || <span className="text-slate-400">N/A</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[9px]">
                          {item.control_ingenieria || <span className="text-slate-400">N/A</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[9px]">
                          {item.control_administrativo || <span className="text-slate-400">N/A</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[9px]">
                          {item.control_epp || <span className="text-slate-400">N/A</span>}
                        </td>

                        {/* Residual */}
                        <td className="border border-slate-300 p-1 text-center">{item.probabilidad_residual}</td>
                        <td className="border border-slate-300 p-1 text-center">{item.severidad_residual}</td>
                        <td className={`border border-slate-300 p-1 text-center ${bgResidual}`}>
                          <div>{item.magnitud_residual}</div>
                          <div className="text-[8px] uppercase">{item.clasificacion_residual}</div>
                        </td>

                        {/* Responsable & Plazo */}
                        <td className="border border-slate-300 p-1 text-[9px]">
                          <div className="font-medium">{item.responsable || "No asignado"}</div>
                          {item.plazo_implementacion && (
                            <div className="text-slate-500">Plazo: {item.plazo_implementacion}</div>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="border border-slate-300 p-1 text-center text-[9px]">
                          <span
                            className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                              item.estado_control === "IMPLEMENTADO"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.estado_control === "EN_PROCESO"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.estado_control}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Cuadro de Doble Firma Legal */}
          <div className="pt-8 border-t border-slate-300 page-break-inside-avoid">
            <p className="text-[10px] text-slate-500 mb-6 italic text-center">
              El presente documento ha sido elaborado según la Guía Técnica para la Identificación de Peligros y Evaluación de Riesgos (MIPER) del Instituto de Salud Pública (ISP) y da cumplimiento al D.S. N° 44 (Reglamento sobre Gestión de Seguridad y Salud en el Trabajo).
            </p>
            <div className="grid grid-cols-2 gap-12 max-w-3xl mx-auto text-center">
              <div className="border-t border-slate-900 pt-3">
                <div className="h-14"></div>
                <strong className="block text-slate-900 text-xs">
                  {matriz.prevencionista_nombre}
                </strong>
                <span className="text-[11px] text-slate-600 block">
                  Prevencionista de Riesgos SNS / Seremi de Salud
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Responsable de Evaluación Técnica MIPER
                </span>
              </div>

              <div className="border-t border-slate-900 pt-3">
                <div className="h-14"></div>
                <strong className="block text-slate-900 text-xs">
                  {matriz.empresa_nombre}
                </strong>
                <span className="text-[11px] text-slate-600 block">
                  Representante Legal / Administrador de Obra
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Aprobación y Compromiso de Recursos Preventivos
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
