"use client";

import React from "react";
import { EntregaEPP } from "../types";

interface ModalComprobanteImprimibleProps {
  isOpen: boolean;
  onClose: () => void;
  entrega: EntregaEPP | null;
}

export function ModalComprobanteImprimible({
  isOpen,
  onClose,
  entrega,
}: ModalComprobanteImprimibleProps) {
  if (!isOpen || !entrega) return null;

  const fechaHora = new Date(entrega.fecha_hora_entrega);
  const fechaTexto = fechaHora.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white text-slate-900 border border-slate-300 rounded-2xl max-w-4xl w-full shadow-2xl my-6 overflow-hidden print:border-none print:shadow-none print:rounded-none print:max-w-none print:m-0">
        {/* Barra superior de herramientas (oculta al imprimir) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
              Comprobante Legal DT
            </span>
            <span className="text-xs text-slate-400">
              • Art. 68 Ley 16.744 / Art. 53 D.S. 594 / Art. 153-157 Código del Trabajo
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Imprimir / Exportar a PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl font-bold p-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Ficha Formal de Entrega (Imprimible) */}
        <div className="p-10 space-y-7 bg-white text-slate-900 font-sans print:p-8">
          {/* Encabezado Formal */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wide text-slate-900">
                {entrega.empresa_nombre || "Empresa Empleadora"}
              </h2>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">
                RUT: {entrega.empresa_rut || "N/A"} •{" "}
                {entrega.centro_trabajo_nombre || "Casa Matriz / Faena Asignada"}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Departamento de Prevención de Riesgos y Gestión de Seguridad Laboral
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black uppercase bg-slate-100 text-slate-800 px-3 py-1 rounded border border-slate-300">
                Folio Digital #{entrega.id}
              </span>
              <p className="text-xs text-slate-500 mt-2 font-medium">Fecha: {fechaTexto}</p>
            </div>
          </div>

          {/* Título del Documento */}
          <div className="text-center">
            <h1 className="text-base font-black uppercase text-slate-900 tracking-wider">
              COMPROBANTE DE RECEPCIÓN DE ELEMENTOS DE PROTECCIÓN PERSONAL (EPP)
              {entrega.entrega_riohs && " Y REGLAMENTO INTERNO (RIOHS)"}
            </h1>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Constancia suscrita conforme al Art. 68 de la Ley N° 16.744 y Art. 53 del D.S. N° 594
            </p>
          </div>

          {/* Ficha del Trabajador Receptor */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-slate-500 font-semibold">Nombre del Trabajador:</span>
              <p className="font-extrabold text-slate-900 text-sm">
                {entrega.trabajador_nombre_completo ||
                  `${entrega.trabajador_nombres} ${entrega.trabajador_apellidos}`}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">RUT:</span>
              <p className="font-bold text-slate-900">{entrega.trabajador_rut}</p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Cargo u Ocupación:</span>
              <p className="font-bold text-slate-900">{entrega.trabajador_cargo || "Operador"}</p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Lugar de Entrega:</span>
              <p className="font-bold text-slate-900">
                {entrega.centro_trabajo_nombre || "Casa Matriz"}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Responsable de Entrega:</span>
              <p className="font-bold text-slate-900">
                {entrega.responsable_nombre || "Prevención de Riesgos"}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">IP Dispositivo Firmante:</span>
              <p className="font-mono text-slate-700">{entrega.ip_registro || "127.0.0.1"}</p>
            </div>
          </div>

          {/* Tabla de Equipos Entregados */}
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-2 border-b border-slate-300 pb-1">
              1. Detalle de Equipos y Elementos de Protección Entregados
            </h3>

            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <th className="p-2 border-r border-slate-300 w-10 text-center">N°</th>
                  <th className="p-2 border-r border-slate-300">Elemento de Protección Personal</th>
                  <th className="p-2 border-r border-slate-300">Marca / Modelo</th>
                  <th className="p-2 border-r border-slate-300">Certificación Legal</th>
                  <th className="p-2 border-r border-slate-300 w-16 text-center">Talla</th>
                  <th className="p-2 border-r border-slate-300 w-14 text-center">Cant.</th>
                  <th className="p-2 text-center w-28">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {entrega.items_epp && entrega.items_epp.length > 0 ? (
                  entrega.items_epp.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-bold">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-semibold">{item.tipo}</td>
                      <td className="p-2 border-r border-slate-200 text-slate-700">
                        {item.marca_modelo || "-"}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-700">
                        {item.certificacion || "Norma Chilena Oficial"}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono">
                        {item.talla || "-"}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-bold">
                        {item.cantidad}
                      </td>
                      <td className="p-2 text-center text-[10px] uppercase font-bold text-slate-600">
                        {item.motivo === "ENTREGA_INICIAL"
                          ? "Inicial"
                          : item.motivo === "RECAMBIO_DESGASTE"
                          ? "Desgaste"
                          : item.motivo === "DETERIORO"
                          ? "Deterioro"
                          : "Reposición"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                      No hay elementos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cláusulas Legales y Declaración de Recepción */}
          <div className="space-y-3 text-[11px] text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-black uppercase text-slate-900 tracking-wider text-xs">
              2. Declaraciones Legales del Trabajador Receptor
            </h4>

            {entrega.entrega_riohs && (
              <p>
                <strong>a) Recepción del Reglamento Interno (RIOHS):</strong> Declaro bajo firma haber recibido en este acto en forma gratuita un ejemplar íntegro del Reglamento Interno de Orden, Higiene y Seguridad de la empresa {entrega.version_riohs ? `(${entrega.version_riohs})` : ""}, asumiendo la obligación legal de dar estricto cumplimiento a todas las normas de prevención de riesgos y disciplina laboral contenidas en él, según los Artículos 153 a 157 del Código del Trabajo.
              </p>
            )}

            {entrega.declaracion_capacitacion && (
              <p>
                <strong>b) Inducción y Capacitación en Uso de EPP (Art. 53 D.S. N° 594):</strong> Declaro haber recibido instrucción teórica y práctica respecto del correcto uso, ajuste anatómico, inspección visual previa a la jornada, limpieza, almacenamiento y limitaciones de cada uno de los Elementos de Protección Personal entregados. Me comprometo a utilizarlos permanentemente durante toda la jornada laboral en las tareas que lo requieran y a solicitar su inmediato recambio ante cualquier defecto o desgaste.
              </p>
            )}

            <p>
              <strong>c) Gratuidad Legal (Art. 68 Ley N° 16.744):</strong> Se deja expresa constancia de que todos los elementos de protección individual descritos han sido proporcionados en forma totalmente gratuita por la empresa empleadora.
            </p>
          </div>

          {/* Bloque de Firmas */}
          <div className="pt-6">
            <div className="grid grid-cols-2 gap-12 text-center items-end">
              {/* Firma del Trabajador Receptor con Evidencia Digital */}
              <div className="space-y-2 border-t-2 border-slate-900 pt-2">
                {entrega.firma_digital ? (
                  <div className="h-24 flex items-center justify-center">
                    <img
                      src={entrega.firma_digital}
                      alt="Firma Digitalizada del Trabajador"
                      className="max-h-24 max-w-full object-contain filter contrast-125"
                    />
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center text-slate-400 italic text-xs">
                    Firma manuscrita
                  </div>
                )}
                <div>
                  <p className="text-xs font-black uppercase text-slate-900">
                    {entrega.trabajador_nombre_completo ||
                      `${entrega.trabajador_nombres} ${entrega.trabajador_apellidos}`}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    RUT: {entrega.trabajador_rut}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    Firma Digitalizada del Trabajador Receptor
                  </p>
                </div>
              </div>

              {/* Firma del Responsable de Bodega / Prevención */}
              <div className="space-y-2 border-t-2 border-slate-900 pt-2">
                <div className="h-24 flex items-center justify-center text-slate-400 text-xs italic">
                  Firma y Timbre Autorizado
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-900">
                    {entrega.responsable_nombre || "Encargado de Prevención / Bodega"}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    {entrega.empresa_nombre}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    Responsable de Entrega y Capacitación
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-2">
              Documento generado electrónicamente a través de la plataforma SaaS HD Prevención • Válido ante fiscalizaciones de la Dirección del Trabajo (DT) y Seremi de Salud.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
