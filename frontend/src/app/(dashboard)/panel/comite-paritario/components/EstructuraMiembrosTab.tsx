"use client";

import React from "react";
import { MiembroCPHS, ComiteParitario } from "../types";

interface EstructuraMiembrosTabProps {
  comite: ComiteParitario | null;
  miembros: MiembroCPHS[];
  onAgregarMiembro: (estamento?: "EMPRESA" | "TRABAJADORES", tipo?: "TITULAR" | "SUPLENTE") => void;
  onEditarMiembro: (miembro: MiembroCPHS) => void;
  onEliminarMiembro: (miembroId: number) => void;
}

export function EstructuraMiembrosTab({
  comite,
  miembros,
  onAgregarMiembro,
  onEditarMiembro,
  onEliminarMiembro,
}: EstructuraMiembrosTabProps) {
  if (!comite) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 dark:text-slate-400">
          Seleccione o constituya un Comité Paritario para gestionar sus integrantes.
        </p>
      </div>
    );
  }

  // Filtrado de estamentos
  const titularesEmpresa = miembros.filter(
    (m) => m.activo && m.estamento === "EMPRESA" && m.tipo_representacion === "TITULAR"
  );
  const suplentesEmpresa = miembros.filter(
    (m) => m.activo && m.estamento === "EMPRESA" && m.tipo_representacion === "SUPLENTE"
  );
  const titularesTrabajadores = miembros.filter(
    (m) => m.activo && m.estamento === "TRABAJADORES" && m.tipo_representacion === "TITULAR"
  );
  const suplentesTrabajadores = miembros.filter(
    (m) => m.activo && m.estamento === "TRABAJADORES" && m.tipo_representacion === "SUPLENTE"
  );

  const tienePresidente = miembros.some((m) => m.activo && m.cargo === "PRESIDENTE");
  const tieneSecretario = miembros.some((m) => m.activo && m.cargo === "SECRETARIO");
  const paridadCompleta = titularesEmpresa.length === 3 && titularesTrabajadores.length === 3;

  const renderBadgeCargo = (cargo: string) => {
    if (cargo === "PRESIDENTE") {
      return (
        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 uppercase tracking-wide">
          Presidente CPHS
        </span>
      );
    }
    if (cargo === "SECRETARIO") {
      return (
        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase tracking-wide">
          Secretario CPHS
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        Vocal
      </span>
    );
  };

  const renderSlotMiembro = (
    m: MiembroCPHS | undefined,
    estamento: "EMPRESA" | "TRABAJADORES",
    tipo: "TITULAR" | "SUPLENTE",
    numeroCupo: number
  ) => {
    if (!m) {
      return (
        <button
          key={`slot-vacio-${estamento}-${tipo}-${numeroCupo}`}
          onClick={() => onAgregarMiembro(estamento, tipo)}
          className="w-full text-left p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700/80 hover:border-orange-500/60 dark:hover:border-orange-500/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-orange-50/20 dark:hover:bg-orange-950/10 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full border border-dashed border-slate-400 dark:border-slate-600 flex items-center justify-center text-slate-400 group-hover:text-orange-500 group-hover:border-orange-500 text-sm">
              +
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                Cupo {tipo === "TITULAR" ? "Titular" : "Suplente"} #{numeroCupo} vacante
              </p>
              <p className="text-[11px] text-slate-400">Clic para designar integrante</p>
            </div>
          </div>
          <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            Asignar &rarr;
          </span>
        </button>
      );
    }

    return (
      <div
        key={m.id}
        className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 shadow-sm flex items-center justify-between group hover:border-slate-300 dark:hover:border-slate-600 transition-all"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs flex-shrink-0">
            {m.nombre.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {m.nombre}
              </p>
              {renderBadgeCargo(m.cargo)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              RUT: {m.rut} {m.fecha_designacion ? `• Desde ${m.fecha_designacion}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100">
          <button
            onClick={() => onEditarMiembro(m)}
            className="p-1.5 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            title="Editar integrante"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => onEliminarMiembro(m.id)}
            className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
            title="Remover del comité"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Estado de Paridad Legal */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              paridadCompleta && tienePresidente && tieneSecretario
                ? "bg-emerald-500"
                : "bg-amber-500 animate-pulse"
            }`}
          />
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {paridadCompleta && tienePresidente && tieneSecretario
                ? "Comité Paritario constituido conforme a D.S. N° 44 (6 Titulares + Cargos Electos)"
                : "Estructura Paritaria en Formación"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Requisitos legales: 3 titulares patronales, 3 titulares de trabajadores, 1 Presidente y 1 Secretario.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!tienePresidente && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              Falta Presidente
            </span>
          )}
          {!tieneSecretario && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              Falta Secretario
            </span>
          )}
          <button
            onClick={() => onAgregarMiembro()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2"
          >
            <span>+ Agregar Integrante</span>
          </button>
        </div>
      </div>

      {/* Matriz Paritaria en 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUMNA A: REPRESENTACIÓN DEL EMPLEADOR */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                Estamento Patronal
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Representantes de la Empresa
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              {titularesEmpresa.length}/3 Titulares • {suplentesEmpresa.length}/3 Suplentes
            </span>
          </div>

          {/* Titulares Empresa */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
              Miembros Titulares (3 Cupos Legales)
            </h4>
            <div className="space-y-2.5">
              {[0, 1, 2].map((idx) =>
                renderSlotMiembro(titularesEmpresa[idx], "EMPRESA", "TITULAR", idx + 1)
              )}
            </div>
          </div>

          {/* Suplentes Empresa */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
              Miembros Suplentes (3 Cupos Legales)
            </h4>
            <div className="space-y-2.5">
              {[0, 1, 2].map((idx) =>
                renderSlotMiembro(suplentesEmpresa[idx], "EMPRESA", "SUPLENTE", idx + 1)
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA B: REPRESENTACIÓN DE LOS TRABAJADORES */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                Estamento Laboral
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Representantes de los Trabajadores
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {titularesTrabajadores.length}/3 Titulares • {suplentesTrabajadores.length}/3 Suplentes
            </span>
          </div>

          {/* Titulares Trabajadores */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
              Miembros Titulares (3 Cupos Legales)
            </h4>
            <div className="space-y-2.5">
              {[0, 1, 2].map((idx) =>
                renderSlotMiembro(titularesTrabajadores[idx], "TRABAJADORES", "TITULAR", idx + 1)
              )}
            </div>
          </div>

          {/* Suplentes Trabajadores */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
              Miembros Suplentes (3 Cupos Legales)
            </h4>
            <div className="space-y-2.5">
              {[0, 1, 2].map((idx) =>
                renderSlotMiembro(suplentesTrabajadores[idx], "TRABAJADORES", "SUPLENTE", idx + 1)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
