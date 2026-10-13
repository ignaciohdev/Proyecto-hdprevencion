"use client";

import { useState, useEffect } from "react";
import { ReporteRiesgo } from "../types";

interface ModalResolverReporteProps {
  isOpen: boolean;
  reporte: ReporteRiesgo | null;
  onClose: () => void;
  onSubmit: (id: number, medida: string) => Promise<{ success: boolean; error?: string }>;
}

export function ModalResolverReporte({
  isOpen,
  reporte,
  onClose,
  onSubmit,
}: ModalResolverReporteProps) {
  const [medida, setMedida] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reporte) {
      setMedida(reporte.medida_correctiva || "");
      setError(null);
    }
  }, [reporte]);

  if (!isOpen || !reporte) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medida.trim()) {
      setError("Debes ingresar la medida correctiva implementada.");
      return;
    }

    setResolving(true);
    setError(null);

    const res = await onSubmit(reporte.id, medida.trim());
    if (res.success) {
      setMedida("");
      onClose();
    } else {
      setError(res.error || "No se pudo cerrar el hallazgo.");
    }
    setResolving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
        <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
          Cierre y Subsanación de Hallazgo
        </h2>
        <p className="text-slate-500 text-xs mb-4">
          Registra las acciones y medidas adoptadas para corregir la condición o acto subestándar en{" "}
          <strong>{reporte.lugar}</strong> ({reporte.empresa_faena || "Faena"}).
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-4 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Medida Correctiva Implementada Efectivamente *
            </label>
            <textarea
              required
              rows={4}
              value={medida}
              onChange={(e) => setMedida(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-orange-500 resize-none text-slate-900 dark:text-white"
              placeholder="ej. Se retiró la herramienta con cable pelado de circulación, se instalaron barandas reglamentarias con rodapié y se verificó tarjeta verde de andamio operativo..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={resolving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer shadow-md disabled:opacity-50"
            >
              {resolving ? "Guardando..." : "Subsanar y Cerrar Hallazgo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
