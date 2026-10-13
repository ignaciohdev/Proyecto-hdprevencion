"use client";

import { useState } from "react";
import {
  MatrizCalorData,
  ESCALA_PROBABILIDAD,
  ESCALA_SEVERIDAD,
  CLASIFICACIONES_RIESGO,
  ClasificacionRiesgo,
  getClasificacionColor,
  getClasificacionSolidBg,
} from "./types";

interface MatrizCalorWidgetProps {
  data: MatrizCalorData | null;
  loading?: boolean;
}

export default function MatrizCalorWidget({ data, loading }: MatrizCalorWidgetProps) {
  const [modo, setModo] = useState<"puro" | "residual">("residual");
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<{
    p: number;
    s: number;
    mag: number;
    clasif: ClasificacionRiesgo;
    count: number;
  } | null>(null);

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center animate-pulse">
        <div className="h-6 w-64 bg-slate-800 rounded mx-auto mb-4"></div>
        <div className="h-72 w-full bg-slate-800/40 rounded-xl"></div>
      </div>
    );
  }

  if (!data || !data.grid || data.grid.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center">
        <p className="text-slate-400 text-sm">
          No hay datos suficientes para generar el mapa de calor 5x5. Añade peligros evaluados a la matriz.
        </p>
      </div>
    );
  }

  const totales = data.totales || {
    puro: { critico: 0, alto: 0, medio: 0, bajo: 0 },
    residual: { critico: 0, alto: 0, medio: 0, bajo: 0 },
  };

  const currentTotales = modo === "puro" ? totales.puro : totales.residual;

  // Mapa rápido de celdas por clave "P_S"
  const celdasMap = new Map<string, typeof data.grid[0]>();
  data.grid.forEach((c) => {
    celdasMap.set(`${c.probabilidad}_${c.severidad}`, c);
  });

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6">
      {/* Header con Alternador y Métricas Clave */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Guía Técnica ISP
            </span>
            <span className="text-xs text-slate-400">Normativa D.S. N° 44</span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            Matriz de Calor 5x5: {data.matriz_nombre}
          </h3>
          <p className="text-xs text-slate-400">
            Distribución bidimensional de Severidad vs. Probabilidad según metodología oficial de prevención.
          </p>
        </div>

        {/* Selector de Modo (Puro vs Residual) */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-start lg:self-center">
          <button
            type="button"
            onClick={() => setModo("puro")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              modo === "puro"
                ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-orange-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔥 Riesgo Puro (Sin Controles)
          </button>
          <button
            type="button"
            onClick={() => setModo("residual")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              modo === "residual"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🛡️ Riesgo Residual (Con Controles)
          </button>
        </div>
      </div>

      {/* Indicadores de Distribución Rápida */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["CRITICO", "ALTO", "MEDIO", "BAJO"] as ClasificacionRiesgo[]).map((nivel) => {
          const cfg = CLASIFICACIONES_RIESGO[nivel];
          const count =
            nivel === "CRITICO"
              ? currentTotales.critico
              : nivel === "ALTO"
              ? currentTotales.alto
              : nivel === "MEDIO"
              ? currentTotales.medio
              : currentTotales.bajo;

          const countOtro =
            modo === "puro"
              ? nivel === "CRITICO"
                ? totales.residual.critico
                : nivel === "ALTO"
                ? totales.residual.alto
                : nivel === "MEDIO"
                ? totales.residual.medio
                : totales.residual.bajo
              : nivel === "CRITICO"
              ? totales.puro.critico
              : nivel === "ALTO"
              ? totales.puro.alto
              : nivel === "MEDIO"
              ? totales.puro.medio
              : totales.puro.bajo;

          return (
            <div
              key={nivel}
              className={`p-3 rounded-xl border transition-all ${cfg.colorBadge} flex items-center justify-between`}
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                  {cfg.nombre.split(" / ")[0]} ({cfg.rango})
                </div>
                <div className="text-2xl font-black mt-0.5">{count}</div>
              </div>
              <div className="text-right text-[10px] opacity-75">
                <div>{modo === "puro" ? "Residual:" : "Puro:"}</div>
                <div className="font-bold text-xs">{countOtro}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cuadrícula 5x5 */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[620px]">
          {/* Fila de Encabezado Superior (Eje X: Probabilidad 1 a 5) */}
          <div className="grid grid-cols-[140px_repeat(5,1fr)] gap-2 mb-2 items-center">
            <div className="text-right pr-2 text-xs font-semibold text-slate-400">
              Severidad ↓ / Prob. →
            </div>
            {[1, 2, 3, 4, 5].map((p) => (
              <div
                key={p}
                className="text-center p-2 rounded-lg bg-slate-950/60 border border-slate-800/80"
              >
                <div className="text-xs font-bold text-slate-200">
                  P = {p}
                </div>
                <div className="text-[10px] text-slate-400 truncate" title={ESCALA_PROBABILIDAD[p]?.etiqueta}>
                  {ESCALA_PROBABILIDAD[p]?.etiqueta.replace(/^\d+ - /, "")}
                </div>
              </div>
            ))}
          </div>

          {/* Filas 5 a 1 (Eje Y: Severidad) */}
          {[5, 4, 3, 2, 1].map((s) => (
            <div
              key={s}
              className="grid grid-cols-[140px_repeat(5,1fr)] gap-2 mb-2 items-stretch"
            >
              {/* Etiqueta Eje Y */}
              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col justify-center">
                <div className="text-xs font-bold text-slate-200">
                  S = {s}
                </div>
                <div className="text-[10px] text-slate-400 truncate" title={ESCALA_SEVERIDAD[s]?.etiqueta}>
                  {ESCALA_SEVERIDAD[s]?.etiqueta.replace(/^\d+ - /, "")}
                </div>
              </div>

              {/* 5 Celdas de la fila */}
              {[1, 2, 3, 4, 5].map((p) => {
                const celda = celdasMap.get(`${p}_${s}`);
                const mag = p * s;
                const clasif: ClasificacionRiesgo =
                  mag >= 17 ? "CRITICO" : mag >= 10 ? "ALTO" : mag >= 5 ? "MEDIO" : "BAJO";

                const count = modo === "puro" ? celda?.count_puro || 0 : celda?.count_residual || 0;
                const isSelected =
                  celdaSeleccionada?.p === p && celdaSeleccionada?.s === s;

                return (
                  <button
                    key={`${p}_${s}`}
                    type="button"
                    onClick={() =>
                      setCeldaSeleccionada({
                        p,
                        s,
                        mag,
                        clasif,
                        count,
                      })
                    }
                    className={`relative p-3 rounded-xl border flex flex-col items-center justify-between transition-all duration-150 min-h-[76px] cursor-pointer hover:scale-[1.03] hover:z-10 ${
                      getClasificacionColor(clasif)
                    } ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950 shadow-xl"
                        : "hover:border-slate-400"
                    }`}
                  >
                    {/* Indicador de Magnitud (P x S) */}
                    <div className="w-full flex items-center justify-between text-[11px] font-mono font-bold opacity-80">
                      <span>{p}×{s}</span>
                      <span className="text-xs">{mag}</span>
                    </div>

                    {/* Conteo de Peligros en esta celda */}
                    <div className="my-1">
                      {count > 0 ? (
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-black shadow-md ${
                            getClasificacionSolidBg(clasif)
                          }`}
                        >
                          {count} {count === 1 ? "peligro" : "peligros"}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium">
                          0
                        </span>
                      )}
                    </div>

                    {/* Etiqueta de clasificación */}
                    <div className="text-[9px] uppercase tracking-wider font-semibold opacity-75">
                      {clasif}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Detalle interactivo de la celda seleccionada */}
      {celdaSeleccionada ? (
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${getClasificacionSolidBg(
                  celdaSeleccionada.clasif
                )}`}
              >
                {celdaSeleccionada.clasif} (MR = {celdaSeleccionada.mag})
              </span>
              <span className="text-xs text-slate-300">
                Probabilidad: {ESCALA_PROBABILIDAD[celdaSeleccionada.p]?.etiqueta} • Severidad:{" "}
                {ESCALA_SEVERIDAD[celdaSeleccionada.s]?.etiqueta}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCeldaSeleccionada(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
            >
              ✕ Cerrar
            </button>
          </div>
          <p className="text-xs text-slate-300">
            <span className="font-semibold text-white">Acción normativa recomendada:</span>{" "}
            {CLASIFICACIONES_RIESGO[celdaSeleccionada.clasif].accionRequerida}
          </p>
          <p className="text-xs text-slate-400">
            Hay <strong className="text-white">{celdaSeleccionada.count}</strong> peligro(s) en esta celda bajo la evaluación{" "}
            <strong className="text-white">{modo === "puro" ? "Pura" : "Residual"}</strong>.
          </p>
        </div>
      ) : null}

      {/* Leyenda y Explicación Técnica */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
        <div>
          <h4 className="font-semibold text-slate-200 mb-1">
            ¿Cómo interpretar la Matriz de Calor?
          </h4>
          <p className="leading-relaxed">
            La Guía Técnica del ISP clasifica el riesgo según el producto de la probabilidad de ocurrencia por la severidad del daño. El objetivo de la jerarquía de controles es desplazar los eventos desde la zona roja/naranja (Crítico/Alto) hacia la zona verde/amarilla (Bajo/Medio).
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-200 mb-1">
            Eficacia Global de Mitigación
          </h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, data.porcentaje_reduccion_riesgo))}%` }}
              ></div>
            </div>
            <span className="font-bold text-emerald-400 text-sm whitespace-nowrap">
              {data.porcentaje_reduccion_riesgo}% Reducción
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {data.totales.puro.critico} Críticos puros mitigados a {data.totales.residual.critico} residuales.
          </p>
        </div>
      </div>
    </div>
  );
}
