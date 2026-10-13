"use client";

import { useState, useEffect } from "react";
import { ItemMatrizLegal, ESTADO_CONFIG, ORGANISMOS_CONFIG } from "./types";
import { getApiUrl, authFetch, parseJsonResponse } from "../../../utils/api";

interface ModalEditarItemProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemMatrizLegal | null;
  onItemActualizado: (itemActualizado: ItemMatrizLegal) => void;
}

export default function ModalEditarItem({
  isOpen,
  onClose,
  item,
  onItemActualizado,
}: ModalEditarItemProps) {
  const [estado, setEstado] = useState<ItemMatrizLegal["estado"]>("EN_PROCESO");
  const [evidencia, setEvidencia] = useState("");
  const [responsable, setResponsable] = useState("");
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [fechaVerificacion, setFechaVerificacion] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setEstado(item.estado);
      setEvidencia(item.evidencia_cumplimiento || "");
      setResponsable(item.responsable || "");
      setFechaCompromiso(item.fecha_compromiso || "");
      setFechaVerificacion(item.fecha_verificacion || "");
      setObservaciones(item.observaciones || "");
      setError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const orgConfig = ORGANISMOS_CONFIG[item.organismo] || {
    label: item.organismo,
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        estado,
        evidencia_cumplimiento: evidencia,
        responsable,
        fecha_compromiso: fechaCompromiso || null,
        fecha_verificacion: fechaVerificacion || null,
        observaciones,
      };

      const res = await authFetch(getApiUrl(`/api/items-matriz-legal/${item.id}/`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("No se pudo actualizar el requisito legal.");
      }

      const itemActualizado = await parseJsonResponse<ItemMatrizLegal>(res);
      onItemActualizado(itemActualizado);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${orgConfig.badge}`}>
                {orgConfig.label}
              </span>
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                {item.identificacion_norma} {item.articulo}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {item.titulo}
            </h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-sm">
          {error && (
            <div className="p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl">
              {error}
            </div>
          )}

          {/* Resumen de la Exigencia y Sanción */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Exigencia Legal Obligatoria:
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {item.descripcion_exigencia}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
              <span>⚠️ Sanción / Multa Legal:</span>
              <span className="text-slate-600 dark:text-slate-400">{item.sancion_multa}</span>
            </div>
          </div>

          {/* Selector de Estado */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Estado de Cumplimiento Normativo *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["CUMPLE", "EN_PROCESO", "NO_CUMPLE", "NO_APLICA"] as const).map((est) => {
                const conf = ESTADO_CONFIG[est];
                const isSelected = estado === est;
                return (
                  <button
                    key={est}
                    type="button"
                    onClick={() => setEstado(est)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "ring-2 ring-orange-500 font-bold " + conf.badge
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                    <span>{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Evidencia de Cumplimiento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Evidencia de Cumplimiento Documentada
            </label>
            <textarea
              rows={3}
              value={evidencia}
              onChange={(e) => setEvidencia(e.target.value)}
              placeholder="Ej: Registro digital de firmas de entrega de EPP con fecha 12/10/2026 en faena. Folio DT o comprobante guardado en panel."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Esta evidencia se incorporará en el informe ejecutivo formal para la Dirección del Trabajo y Seremi.
            </p>
          </div>

          {/* Responsable y Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Responsable Asignado
              </label>
              <input
                type="text"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Ej: Juan Pérez (Jefe Faena)"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Fecha Compromiso
              </label>
              <input
                type="date"
                value={fechaCompromiso}
                onChange={(e) => setFechaCompromiso(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Fecha Verificación
              </label>
              <input
                type="date"
                value={fechaVerificacion}
                onChange={(e) => setFechaVerificacion(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Observaciones Técnicas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Observaciones Técnicas Adicionales
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas internas sobre compras pendientes, cotizaciones o acuerdos paritarios."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Footer de Acciones */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Evidencia y Estado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
