"use client";

import React from "react";
import { ActaSesionCPHS, ComiteParitario, MiembroCPHS } from "../types";

interface ModalImprimirActaProps {
  isOpen: boolean;
  onClose: () => void;
  acta: ActaSesionCPHS | null;
  comite: ComiteParitario | null;
  miembros: MiembroCPHS[];
}

export function ModalImprimirActa({
  isOpen,
  onClose,
  acta,
  comite,
  miembros,
}: ModalImprimirActaProps) {
  if (!isOpen || !acta || !comite) return null;

  const presidente = miembros.find((m) => m.activo && m.cargo === "PRESIDENTE");
  const secretario = miembros.find((m) => m.activo && m.cargo === "SECRETARIO");

  const fechaSesion = new Date(acta.fecha_hora_sesion);
  const fechaTexto = fechaSesion.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const horaTexto = fechaSesion.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white text-slate-900 border border-slate-300 rounded-2xl max-w-4xl w-full shadow-2xl my-8 overflow-hidden print:border-none print:shadow-none print:rounded-none print:max-w-none print:m-0">
        {/* Barra superior de herramientas (oculta al imprimir) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
              Documento Oficial
            </span>
            <span className="text-xs text-slate-400">• Formato Inspección del Trabajo / Mutualidad</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Imprimir / Guardar en PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl font-bold p-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Cuerpo del Acta Imprimible (Hoja Formal) */}
        <div className="p-10 space-y-8 bg-white text-slate-900 font-sans print:p-8">
          {/* Membrete Oficial */}
          <div className="border-b-2 border-slate-900 pb-5 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wide text-slate-900">
                {comite.empresa_nombre || "Empresa Asesorada"}
              </h2>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                {comite.nombre} • {comite.centro_trabajo_nombre || "Casa Matriz / Faena Principal"}
              </p>
              <p className="text-[11px] text-slate-500">
                Regulado por D.S. N° 44 del Ministerio del Trabajo y Previsión Social • Ley N° 16.744
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold uppercase bg-slate-100 text-slate-800 px-3 py-1 rounded border border-slate-300">
                Acta N° {acta.numero_acta}
              </span>
              <p className="text-xs font-bold text-slate-600 mt-2">
                Sesión {acta.tipo_sesion === "EXTRAORDINARIA" ? "Extraordinaria" : "Ordinaria Mensual"}
              </p>
            </div>
          </div>

          {/* Título Central */}
          <div className="text-center">
            <h1 className="text-lg font-black uppercase text-slate-900 tracking-wider">
              ACTA DE SESIÓN DEL COMITÉ PARITARIO DE HIGIENE Y SEGURIDAD
            </h1>
            <p className="text-xs text-slate-600 mt-1 capitalize font-medium">
              Celebrada el {fechaTexto} a las {horaTexto} horas
            </p>
          </div>

          {/* Datos Generales de la Reunión */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-slate-500 font-semibold">Lugar / Modalidad:</p>
              <p className="font-bold text-slate-900">{acta.lugar}</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold">Período de Mandato:</p>
              <p className="font-bold text-slate-900">
                {comite.fecha_constitucion} al {comite.fecha_vencimiento_mandato || "2 Años D.S. 44"}
              </p>
            </div>
          </div>

          {/* Constancia de Asistencia y Quorum */}
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider border-b border-slate-300 pb-1 mb-2">
              1. Verificación de Asistencia y Quorum Legal (Art. 16 D.S. N° 44)
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed mb-3">
              En conformidad con las disposiciones legales vigentes, se procede a verificar la asistencia de los integrantes del Comité Paritario, constatándose la presencia de los siguientes miembros:
            </p>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <ul className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
                {acta.asistentes && acta.asistentes.length > 0 ? (
                  acta.asistentes.map((asistente, idx) => (
                    <li key={idx} className="flex items-center space-x-2 text-slate-800">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>{asistente}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No se registró lista de asistentes.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Tabla de Materias Tratadas */}
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider border-b border-slate-300 pb-1 mb-2">
              2. Materias Tratadas en la Tabla
            </h3>
            <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono">
              {acta.tabla_temas}
            </div>
          </div>

          {/* Cuadro de Acuerdos Preventivos */}
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider border-b border-slate-300 pb-1 mb-2">
              3. Acuerdos y Medidas Preventivas Adoptadas
            </h3>
            <p className="text-xs text-slate-700 mb-3">
              De conformidad a las facultades conferidas por la Ley N° 16.744, el Comité acuerda las siguientes medidas correctivas y plazos perentorios de cumplimiento:
            </p>

            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <th className="p-2.5 border-r border-slate-300 w-12 text-center">N°</th>
                  <th className="p-2.5 border-r border-slate-300">Acuerdo / Medida Preventiva</th>
                  <th className="p-2.5 border-r border-slate-300 w-44">Responsable</th>
                  <th className="p-2.5 border-r border-slate-300 w-28 text-center">Plazo Límite</th>
                  <th className="p-2.5 w-24 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {acta.acuerdos && acta.acuerdos.length > 0 ? (
                  acta.acuerdos.map((acuerdo, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2.5 border-r border-slate-200 text-center font-bold">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 border-r border-slate-200">{acuerdo.acuerdo}</td>
                      <td className="p-2.5 border-r border-slate-200 font-medium">
                        {acuerdo.responsable || "Sin asignar"}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center">
                        {acuerdo.plazo || "Sin fecha"}
                      </td>
                      <td className="p-2.5 text-center font-bold">
                        {acuerdo.cumplido ? "Ejecutado" : "Pendiente"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                      No se registraron acuerdos pendientes en esta sesión.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bloque Doble de Firmas Directivas */}
          <div className="pt-12 mt-8">
            <p className="text-center text-xs text-slate-600 mb-10 italic">
              Para constancia firman la presente acta los representantes directivos designados conforme a la Ley:
            </p>

            <div className="grid grid-cols-2 gap-16 text-center">
              {/* Firma Presidente */}
              <div className="border-t-2 border-slate-900 pt-3">
                <p className="text-xs font-black uppercase text-slate-900">
                  {presidente ? presidente.nombre : "Presidente del CPHS"}
                </p>
                <p className="text-[11px] font-semibold text-slate-600">
                  {presidente ? `RUT: ${presidente.rut}` : "Firma y Timbre"}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                  Presidente del Comité Paritario
                </p>
              </div>

              {/* Firma Secretario */}
              <div className="border-t-2 border-slate-900 pt-3">
                <p className="text-xs font-black uppercase text-slate-900">
                  {secretario ? secretario.nombre : "Secretario del CPHS"}
                </p>
                <p className="text-[11px] font-semibold text-slate-600">
                  {secretario ? `RUT: ${secretario.rut}` : "Firma y Timbre"}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                  Secretario del Comité Paritario
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
