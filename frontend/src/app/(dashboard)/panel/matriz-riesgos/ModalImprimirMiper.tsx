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
      <div className="relative w-full max-w-[96vw] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 print:my-0 print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Barra superior de control (Oculta al imprimir) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs">
              🖨️
            </span>
            <span className="font-bold text-sm">
              Vista Previa de Informe Técnico Oficial IPERC (Formato Apaisado A4/Carta)
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
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
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
              margin: 6mm;
            }
            body {
              background: white !important;
              color: black !important;
            }
          }
        `}</style>

        {/* CONTENIDO DEL REPORTE TÉCNICO OFICIAL */}
        <div className="p-8 print:p-2 space-y-5 text-slate-800 text-xs">
          {/* Membrete Oficial */}
          <div className="border-b-2 border-slate-900 pb-3">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-600 font-black text-xl tracking-tight">HD</span>
                  <span className="font-bold text-slate-900 text-base">PREVENCIÓN</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono border border-slate-300">
                    SST SAAS CHILE
                  </span>
                </div>
                <h1 className="text-base font-extrabold text-slate-900 mt-1 uppercase tracking-wide">
                  Matriz de Identificación de Peligros, Evaluación y Control de Riesgos (IPERC)
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">
                  Regida exclusivamente por: D.S. N° 44 (MINTRAB) • D.S. N° 594 (MINSAL) • ISO 45001:2018 • Ley N° 16.744 • Circular SUSESO N° 3336 • Guía Técnica ISP
                </p>
              </div>

              {/* Caja de Registro, Control de Versión y Visado */}
              <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-[10px] text-right min-w-[240px]">
                <div><strong>Código / Documento:</strong> IPERC-v{matriz.version}</div>
                <div><strong>Estado de Matriz:</strong> {matriz.estado_display || matriz.estado}</div>
                <div><strong>Fecha de Aprobación:</strong> {matriz.fecha_aprobacion || "Pendiente"}</div>
                <div><strong>Próxima Revisión Legal:</strong> {matriz.fecha_proxima_revision || "Anual / Post-accidente (Art. 7 D.S. 44)"}</div>
                <div><strong>Fecha Emisión:</strong> {fechaImpresion}</div>
              </div>
            </div>

            {/* Ficha de la Empresa y Centro de Trabajo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-2.5 bg-slate-100/90 rounded-lg border border-slate-200 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">Razón Social:</span>
                <strong className="text-slate-900">{matriz.empresa_nombre}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">RUT Empresa:</span>
                <strong className="text-slate-900">{matriz.empresa_rut}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Centro de Trabajo / Faena:</span>
                <strong className="text-slate-900">
                  {matriz.centro_trabajo_nombre || "Instalaciones y Obras Generales"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Prevencionista SST Responsable:</span>
                <strong className="text-slate-900">{matriz.prevencionista_nombre}</strong>
              </div>
            </div>

            {/* Resumen Cuantitativo de Gestión */}
            <div className="grid grid-cols-4 gap-2 mt-2 text-center text-[10px]">
              <div className="p-1.5 bg-slate-50 border border-slate-200 rounded">
                <span className="text-slate-500 block">Total Peligros</span>
                <strong className="text-xs font-bold">{matriz.total_peligros}</strong>
              </div>
              <div className="p-1.5 bg-red-50 border border-red-200 rounded text-red-900">
                <span className="block opacity-80">Riesgos Críticos Puros</span>
                <strong className="text-xs font-bold">{matriz.criticos_puros}</strong>
              </div>
              <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900">
                <span className="block opacity-80">Críticos Residuales</span>
                <strong className="text-xs font-bold">{matriz.criticos_residuales}</strong>
              </div>
              <div className="p-1.5 bg-teal-50 border border-teal-200 rounded text-teal-900">
                <span className="block opacity-80">Eficacia de Mitigación Global</span>
                <strong className="text-xs font-bold">{matriz.porcentaje_reduccion_riesgo}%</strong>
              </div>
            </div>
          </div>

          {/* Tabla de Aplicación Industrial IPERC */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-400 text-[9px]">
              <thead>
                <tr className="bg-slate-800 text-white font-bold text-center">
                  <th rowSpan={2} className="border border-slate-400 p-1 w-6">#</th>
                  <th rowSpan={2} className="border border-slate-400 p-1 w-20">Actividad / Tarea</th>
                  <th rowSpan={2} className="border border-slate-400 p-1 w-28">Peligro Identificado</th>
                  <th rowSpan={2} className="border border-slate-400 p-1 w-28">Riesgo (Evento y Daño)</th>
                  <th colSpan={3} className="border border-slate-400 p-1 bg-slate-900">
                    Eval. Pura (P×C)
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1 w-32 bg-slate-700">
                    Paso 4: Controles Existentes (Terreno)
                  </th>
                  <th colSpan={6} className="border border-slate-400 p-1 bg-slate-800">
                    Paso 5: Controles Requeridos y Jerarquía Legal de Mitigación
                  </th>
                  <th colSpan={3} className="border border-slate-400 p-1 bg-slate-900">
                    Eval. Residual
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1 w-20">Responsable / Plazo</th>
                  <th rowSpan={2} className="border border-slate-400 p-1 w-16">Estado</th>
                </tr>
                <tr className="bg-slate-700 text-white font-semibold text-center text-[8px]">
                  {/* Puro */}
                  <th className="border border-slate-400 p-0.5 w-5">P</th>
                  <th className="border border-slate-400 p-0.5 w-5">C</th>
                  <th className="border border-slate-400 p-0.5 w-10">Nivel</th>
                  {/* Jerarquía y Controles Requeridos */}
                  <th className="border border-slate-400 p-0.5 w-24">Acción Requerida</th>
                  <th className="border border-slate-400 p-0.5 w-16">1. Eliminación</th>
                  <th className="border border-slate-400 p-0.5 w-16">2. Sustitución</th>
                  <th className="border border-slate-400 p-0.5 w-20">3. Ingeniería</th>
                  <th className="border border-slate-400 p-0.5 w-20">4. Admin/PTS</th>
                  <th className="border border-slate-400 p-0.5 w-16">5. EPP ISP</th>
                  {/* Residual */}
                  <th className="border border-slate-400 p-0.5 w-5">Pr</th>
                  <th className="border border-slate-400 p-0.5 w-5">Cr</th>
                  <th className="border border-slate-400 p-0.5 w-10">Nivel</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="p-6 text-center text-slate-500 italic">
                      No se han registrado ítems evaluados en esta matriz IPERC.
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
                        <td className="border border-slate-300 p-1">
                          <div className="font-semibold text-slate-900">{item.actividad}</div>
                          <div className="text-[8px] text-slate-500">
                            {item.proceso} • {item.puesto_trabajo} ({item.tipo_actividad})
                          </div>
                        </td>
                        <td className="border border-slate-300 p-1">
                          <div>{item.peligro}</div>
                          <span className="inline-block mt-0.5 px-1 py-0.2 rounded text-[7px] font-semibold bg-slate-200 text-slate-700">
                            {item.clasificacion_peligro}
                          </span>
                        </td>
                        <td className="border border-slate-300 p-1 text-slate-700">
                          <div>{item.riesgo_consecuencia}</div>
                          {item.es_accidente_grave_fatal && (
                            <span className="inline-block mt-0.5 px-1 py-0.2 rounded text-[7px] font-bold bg-red-600 text-white">
                              Grave/Fatal (Circ. 3336)
                            </span>
                          )}
                          {item.trabajador_sensible && (
                            <span className="inline-block mt-0.5 ml-1 px-1 py-0.2 rounded text-[7px] font-semibold bg-purple-100 text-purple-900 border border-purple-200">
                              Art. 11: {item.trabajador_sensible}
                            </span>
                          )}
                        </td>

                        {/* Puro */}
                        <td className="border border-slate-300 p-0.5 text-center">{item.probabilidad_pura}</td>
                        <td className="border border-slate-300 p-0.5 text-center">{item.severidad_pura}</td>
                        <td className={`border border-slate-300 p-0.5 text-center ${bgPuro}`}>
                          <div>{item.magnitud_pura}</div>
                          <div className="text-[7px] uppercase">{item.clasificacion_pura}</div>
                        </td>

                        {/* Paso 4: Controles Existentes */}
                        <td className="border border-slate-300 p-1 text-[8px] bg-slate-50">
                          {item.controles_existentes || <span className="text-slate-400 italic">Sin controles registrados</span>}
                        </td>

                        {/* Paso 5: Controles Requeridos y Jerarquía */}
                        <td className="border border-slate-300 p-1 text-[8px]">
                          {item.controles_requeridos || <span className="text-slate-400">N/A</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[8px]">
                          {item.control_eliminacion || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[8px]">
                          {item.control_sustitucion || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[8px]">
                          {item.control_ingenieria || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[8px]">
                          {item.control_administrativo || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-[8px]">
                          {item.control_epp || <span className="text-slate-400">-</span>}
                        </td>

                        {/* Residual */}
                        <td className="border border-slate-300 p-0.5 text-center">{item.probabilidad_residual}</td>
                        <td className="border border-slate-300 p-0.5 text-center">{item.severidad_residual}</td>
                        <td className={`border border-slate-300 p-0.5 text-center ${bgResidual}`}>
                          <div>{item.magnitud_residual}</div>
                          <div className="text-[7px] uppercase">{item.clasificacion_residual}</div>
                        </td>

                        {/* Responsable & Plazo */}
                        <td className="border border-slate-300 p-1 text-[8px]">
                          <div className="font-medium text-slate-900">{item.responsable || "No asignado"}</div>
                          {item.plazo_implementacion && (
                            <div className="text-slate-500 font-mono">Plazo: {item.plazo_implementacion}</div>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="border border-slate-300 p-0.5 text-center text-[8px]">
                          <span
                            className={`px-1 py-0.5 rounded text-[7px] font-bold ${
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

          {/* Cuadro de Triple Visado Legal Oficial (Prevencionista + CPHS + Representante Legal) */}
          <div className="pt-4 border-t border-slate-300 page-break-inside-avoid">
            <p className="text-[9px] text-slate-500 mb-5 italic text-center">
              Matriz IPERC elaborada conforme a los Arts. 2 N° 20 y 7 del D.S. N° 44 (Reglamento sobre Gestión de Seguridad y Salud en el Trabajo), D.S. N° 594, Ley N° 16.744 y Cláusula 6.1.2 de la Norma ISO 45001:2018. Visada con la participación del Comité Paritario de Higiene y Seguridad (Art. 66 Ley 16.744 / D.S. 54).
            </p>
            <div className="grid grid-cols-3 gap-8 max-w-4xl mx-auto text-center text-[10px]">
              {/* Prevencionista */}
              <div className="border-t border-slate-900 pt-2">
                <div className="h-10"></div>
                <strong className="block text-slate-900 text-[11px]">
                  {matriz.prevencionista_nombre}
                </strong>
                <span className="text-slate-600 block">
                  Prevencionista de Riesgos SNS / Registro Seremi
                </span>
                <span className="text-slate-400 block text-[9px]">
                  Elaboración Técnica IPERC
                </span>
              </div>

              {/* Comité Paritario (CPHS) */}
              <div className="border-t border-slate-900 pt-2">
                <div className="h-10"></div>
                <strong className="block text-slate-900 text-[11px]">
                  Comité Paritario (CPHS / Trabajadores)
                </strong>
                <span className="text-slate-600 block">
                  Representante Titular de los Trabajadores
                </span>
                <span className="text-slate-400 block text-[9px]">
                  Consulta y Participación (Art. 66 Ley 16.744 / ISO 45001 Cl. 5.4)
                </span>
              </div>

              {/* Representante Legal */}
              <div className="border-t border-slate-900 pt-2">
                <div className="h-10"></div>
                <strong className="block text-slate-900 text-[11px]">
                  {matriz.empresa_nombre}
                </strong>
                <span className="text-slate-600 block">
                  Representante Legal / Gerencia General
                </span>
                <span className="text-slate-400 block text-[9px]">
                  Aprobación y Asignación de Recursos Preventivos
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
