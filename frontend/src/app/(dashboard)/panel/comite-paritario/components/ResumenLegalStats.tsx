"use client";

import React from "react";
import { EstadisticasCPHS } from "../types";

interface ResumenLegalStatsProps {
  stats: EstadisticasCPHS | null;
  loading: boolean;
}

export function ResumenLegalStats({ stats, loading }: ResumenLegalStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 bg-slate-200 dark:bg-slate-800/60 rounded-2xl border border-slate-300 dark:border-slate-800"
          />
        ))}
      </div>
    );
  }

  // 1. Semáforo de Vigencia de Mandato (D.S. 44 - 2 Años)
  const dias = stats.dias_restantes_mandato;
  let colorBadge = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  let textoEstado = "Mandato Legal Vigente";
  let barColor = "bg-emerald-500";
  let progresoMandato = Math.min(100, Math.max(0, Math.round(((730 - dias) / 730) * 100)));

  if (dias <= 0) {
    colorBadge = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
    textoEstado = "Mandato Vencido (Renovación Inmediata)";
    barColor = "bg-rose-500";
    progresoMandato = 100;
  } else if (dias <= 60) {
    colorBadge = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    textoEstado = "Por Vencer (< 60 días - Iniciar Proceso)";
    barColor = "bg-amber-500";
  }

  // 2. Sesiones Mensuales
  const porcentajeSesiones = stats.porcentaje_cumplimiento_sesiones;
  const sesionAlDia = stats.sesiones_ordinarias_ano >= new Date().getMonth() + 1;

  // 3. Acuerdos
  const tasaAcuerdos = stats.tasa_cumplimiento_acuerdos;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Tarjeta 1: Vigencia del Mandato */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Vigencia Mandato (D.S. 44)
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {dias > 0 ? dias : 0}
              </span>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                días restantes
              </span>
            </div>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${colorBadge}`}
          >
            {textoEstado}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Electo: {stats.fecha_constitucion}</span>
            <span>Vence: {stats.fecha_vencimiento_mandato || "Sin asignar"}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${barColor}`}
              style={{ width: `${progresoMandato}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tarjeta 2: Cumplimiento de Sesiones Mensuales */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Sesiones Ordinarias (Año {new Date().getFullYear()})
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.sesiones_ordinarias_ano}
              </span>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                de {stats.meta_legal_anual} obligatorias
              </span>
            </div>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
              sesionAlDia
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
            }`}
          >
            {sesionAlDia ? "Sesiones al Día" : "Sesión Pendiente"}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Avance Legal Anual</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {porcentajeSesiones}%
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-orange-500 h-full transition-all duration-500"
              style={{ width: `${porcentajeSesiones}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tarjeta 3: Acuerdos Preventivos */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Acuerdos Preventivos
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.acuerdos_cumplidos}
              </span>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                de {stats.total_acuerdos} ejecutados
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
            {stats.acuerdos_pendientes} Pendientes
          </span>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Tasa de Cierre</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {tasaAcuerdos}%
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${tasaAcuerdos}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
