"use client";

import React, { useState } from "react";
import { EmpresaItem, CentroTrabajoItem } from "../types";

interface ModalConstituirCPHSProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaItem[];
  centrosTrabajo: CentroTrabajoItem[];
  empresaSeleccionadaId?: number;
  onCrear: (data: {
    empresa: number;
    centro_trabajo?: number | null;
    nombre: string;
    fecha_constitucion: string;
  }) => Promise<void>;
}

export function ModalConstituirCPHS({
  isOpen,
  onClose,
  empresas,
  centrosTrabajo,
  empresaSeleccionadaId,
  onCrear,
}: ModalConstituirCPHSProps) {
  const [empresaId, setEmpresaId] = useState<number>(
    empresaSeleccionadaId || (empresas[0]?.id ?? 0)
  );
  const [centroId, setCentroId] = useState<string>("");
  const [nombre, setNombre] = useState<string>("CPHS Casa Matriz");
  const [fechaConstitucion, setFechaConstitucion] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const centrosFiltrados = centrosTrabajo.filter((c) => c.empresa === Number(empresaId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      setError("Debe seleccionar una empresa.");
      return;
    }
    if (!nombre.trim()) {
      setError("Debe ingresar un nombre identificador para el comité.");
      return;
    }
    if (!fechaConstitucion) {
      setError("Debe ingresar la fecha de constitución.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      await onCrear({
        empresa: Number(empresaId),
        centro_trabajo: centroId ? Number(centroId) : null,
        nombre: nombre.trim(),
        fecha_constitucion: fechaConstitucion,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Error al constituir el Comité Paritario.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
              Constitución Legal D.S. N° 44
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Nuevo Comité Paritario (CPHS)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1"
          >
            &times;
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Empresa */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Empresa Titular <span className="text-orange-500">*</span>
            </label>
            <select
              value={empresaId}
              onChange={(e) => {
                setEmpresaId(Number(e.target.value));
                setCentroId("");
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.razon_social} ({emp.rut})
                </option>
              ))}
            </select>
          </div>

          {/* Centro de Trabajo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Centro de Trabajo / Faena Asignada (Opcional)
            </label>
            <select
              value={centroId}
              onChange={(e) => setCentroId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">-- Toda la empresa / Casa Matriz --</option>
              {centrosFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nombre o Identificación del CPHS <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: CPHS Casa Matriz, CPHS Mina Los Bronces"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Fecha Constitución */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Fecha de Elección / Constitución <span className="text-orange-500">*</span>
            </label>
            <input
              type="date"
              value={fechaConstitucion}
              onChange={(e) => setFechaConstitucion(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              El mandato vencerá automáticamente en <strong>2 años exactos (730 días)</strong> según lo dispuesto en el Artículo 15 del D.S. N° 44.
            </p>
          </div>

          {/* Footer Botones */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2"
            >
              {guardando ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Constituyendo...</span>
                </>
              ) : (
                <span>Constituir Comité Paritario</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
