"use client";

import React, { useState } from "react";
import { ActaSesionCPHS, ComiteParitario } from "../types";

interface LibroActasTabProps {
  comite: ComiteParitario | null;
  actas: ActaSesionCPHS[];
  loading: boolean;
  onCrearActa: () => void;
  onVerActaImprimible: (acta: ActaSesionCPHS) => void;
  onToggleAcuerdo: (actaId: number, index: number, cumplido: boolean) => Promise<void>;
}

export function LibroActasTab({
  comite,
  actas,
  loading,
  onCrearActa,
  onVerActaImprimible,
  onToggleAcuerdo,
}: LibroActasTabProps) {
  const [filtroTipo, setFiltroTipo] = useState<string>("TODAS");
  const [actualizandoAcuerdo, setActualizandoAcuerdo] = useState<string | null>(null);

  if (!comite) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 dark:text-slate-400">
          Seleccione un Comité Paritario para consultar su Libro Digital de Actas.
        </p>
      </div>
    );
  }

  const actasFiltradas = actas.filter((a) => {
    if (filtroTipo === "TODAS") return true;
    return a.tipo_sesion === filtroTipo;
  });

  const handleToggle = async (actaId: number, index: number, actual: boolean) => {
    const key = `${actaId}-${index}`;
    try {
      setActualizandoAcuerdo(key);
      await onToggleAcuerdo(actaId, index, !actual);
    } finally {
      setActualizandoAcuerdo(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros y Acción Nueva Acta */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFiltroTipo("TODAS")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filtroTipo === "TODAS"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Todas ({actas.length})
          </button>
          <button
            onClick={() => setFiltroTipo("ORDINARIA")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filtroTipo === "ORDINARIA"
                ? "bg-orange-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Ordinarias Mensuales
          </button>
          <button
            onClick={() => setFiltroTipo("EXTRAORDINARIA")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filtroTipo === "EXTRAORDINARIA"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Extraordinarias
          </button>
        </div>

        <button
          onClick={onCrearActa}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Registrar Nueva Acta</span>
        </button>
      </div>

      {/* Listado de Actas */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 bg-slate-200 dark:bg-slate-800/60 rounded-2xl border border-slate-300 dark:border-slate-800"
            />
          ))}
        </div>
      ) : actasFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No hay actas registradas para este filtro
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            El D.S. N° 44 exige al menos una reunión ordinaria mensual. Registre la primera sesión para iniciar el Libro Digital de Actas.
          </p>
          <button
            onClick={onCrearActa}
            className="mt-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-2"
          >
            <span>+ Registrar Acta N° 1</span>
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {actasFiltradas.map((acta) => {
            const fechaHora = new Date(acta.fecha_hora_sesion);
            const fechaLegible = fechaHora.toLocaleDateString("es-CL", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            const totalAcuerdos = acta.acuerdos ? acta.acuerdos.length : 0;
            const cumplidos = acta.acuerdos
              ? acta.acuerdos.filter((a) => a.cumplido).length
              : 0;

            return (
              <div
                key={acta.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Cabecera del Acta */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex flex-col items-center justify-center font-black flex-shrink-0">
                      <span className="text-[10px] uppercase font-bold leading-none">Acta</span>
                      <span className="text-lg leading-tight">#{acta.numero_acta}</span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                            acta.tipo_sesion === "EXTRAORDINARIA"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {acta.tipo_sesion === "EXTRAORDINARIA"
                            ? "Sesión Extraordinaria"
                            : "Sesión Ordinaria Mensual"}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {fechaLegible}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                        <span className="text-slate-400">Lugar:</span> {acta.lugar} •{" "}
                        <span className="text-slate-400">Asistencia:</span>{" "}
                        {acta.asistentes?.length || 0} integrantes presentes
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {cumplidos}/{totalAcuerdos} Acuerdos
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {totalAcuerdos > 0 && cumplidos === totalAcuerdos
                          ? "Todos cerrados"
                          : `${totalAcuerdos - cumplidos} pendientes`}
                      </p>
                    </div>

                    <button
                      onClick={() => onVerActaImprimible(acta)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      <span>Imprimir / DT</span>
                    </button>
                  </div>
                </div>

                {/* Materias y Acuerdos */}
                <div className="p-5 space-y-4">
                  {/* Puntos de la Tabla */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Puntos Tratados en la Tabla
                    </h5>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                      {acta.tabla_temas}
                    </p>
                  </div>

                  {/* Acuerdos Preventivos */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Acuerdos Preventivos y Compromisos ({totalAcuerdos})
                    </h5>

                    {totalAcuerdos === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        No se registraron acuerdos pendientes en esta sesión.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {acta.acuerdos.map((acuerdo, idx) => {
                          const isUpdating = actualizandoAcuerdo === `${acta.id}-${idx}`;

                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                                acuerdo.cumplido
                                  ? "bg-emerald-500/5 border-emerald-500/20 text-slate-700 dark:text-slate-300"
                                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              <div className="flex items-start space-x-3 min-w-0 pr-3">
                                <button
                                  disabled={isUpdating}
                                  onClick={() => handleToggle(acta.id, idx, acuerdo.cumplido)}
                                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                                    acuerdo.cumplido
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "border-slate-300 dark:border-slate-600 hover:border-orange-500"
                                  } ${isUpdating ? "opacity-50 cursor-wait" : ""}`}
                                >
                                  {acuerdo.cumplido && (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>

                                <div className="min-w-0">
                                  <p
                                    className={`text-xs font-semibold ${
                                      acuerdo.cumplido
                                        ? "line-through text-slate-400 dark:text-slate-500"
                                        : ""
                                    }`}
                                  >
                                    {acuerdo.acuerdo}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                      Responsable:
                                    </span>{" "}
                                    {acuerdo.responsable || "No asignado"} •{" "}
                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                      Plazo:
                                    </span>{" "}
                                    {acuerdo.plazo || "Sin fecha fija"}{" "}
                                    {acuerdo.cumplido && acuerdo.fecha_cumplimiento
                                      ? `(Cumplido el ${acuerdo.fecha_cumplimiento})`
                                      : ""}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                                  acuerdo.cumplido
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                }`}
                              >
                                {acuerdo.cumplido ? "Ejecutado" : "Pendiente"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
