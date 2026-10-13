"use client";

import { useState, useEffect } from "react";
import { EmpresaSimple, CentroTrabajoSimple, MatrizLegal, RUBROS_CHOICES } from "./types";
import { getApiUrl, authFetch, parseJsonResponse } from "../../../utils/api";

interface ModalGenerarMatrizProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaSimple[];
  selectedEmpresaId: number | null;
  onMatrizGenerada: (nuevaMatriz: MatrizLegal) => void;
}

export default function ModalGenerarMatriz({
  isOpen,
  onClose,
  empresas,
  selectedEmpresaId,
  onMatrizGenerada,
}: ModalGenerarMatrizProps) {
  const [empresaId, setEmpresaId] = useState<string>(selectedEmpresaId ? String(selectedEmpresaId) : "");
  const [centroTrabajoId, setCentroTrabajoId] = useState<string>("");
  const [centros, setCentros] = useState<CentroTrabajoSimple[]>([]);
  const [loadingCentros, setLoadingCentros] = useState(false);
  const [rubro, setRubro] = useState<string>("CONSTRUCCION");
  const [dotacionEstimada, setDotacionEstimada] = useState<number>(30);

  const [condiciones, setCondiciones] = useState<Record<string, boolean>>({
    mas_100_trabajadores: false,
    mas_25_trabajadores: true,
    mas_10_trabajadores: true,
    trabajo_altura: true,
    sustancias_peligrosas: false,
    subcontratacion: true,
    ruido_ocupacional: true,
    silice_polvo: false,
    espacios_confinados: false,
  });

  const [observacionGeneral, setObservacionGeneral] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDotacionChange = (nuevaDotacion: number) => {
    const val = Math.max(0, nuevaDotacion);
    setDotacionEstimada(val);
    setCondiciones((prev) => ({
      ...prev,
      mas_10_trabajadores: val >= 10,
      mas_25_trabajadores: val >= 25,
      mas_100_trabajadores: val >= 100,
    }));
  };

  useEffect(() => {
    if (selectedEmpresaId) {
      setEmpresaId(String(selectedEmpresaId));
    } else if (empresas.length > 0 && !empresaId) {
      setEmpresaId(String(empresas[0].id));
    }
  }, [selectedEmpresaId, empresas]);

  useEffect(() => {
    if (!empresaId) {
      setCentros([]);
      setCentroTrabajoId("");
      return;
    }

    const cargarCentros = async () => {
      setLoadingCentros(true);
      try {
        const res = await authFetch(getApiUrl(`/api/centros-trabajo/?empresa=${empresaId}`));
        if (res.ok) {
          const data = await parseJsonResponse<CentroTrabajoSimple[]>(res);
          setCentros(data || []);
          if (data && data.length > 0) {
            setCentroTrabajoId(String(data[0].id));
          } else {
            setCentroTrabajoId("");
          }
        }
      } catch (err) {
        console.error("Error cargando centros de trabajo:", err);
      } finally {
        setLoadingCentros(false);
      }
    };

    const autoDetectarDatosEmpresa = async () => {
      try {
        // Consultar trabajadores
        const resTrab = await authFetch(getApiUrl(`/api/trabajadores/?empresa=${empresaId}`));
        if (resTrab.ok) {
          const trabs = await parseJsonResponse<any[]>(resTrab);
          const count = Array.isArray(trabs) ? trabs.length : 0;
          if (count > 0) {
            handleDotacionChange(count);
          }
        }
        // Consultar si existen contratistas vinculados
        const resCont = await authFetch(getApiUrl(`/api/contratistas/?empresa=${empresaId}`));
        if (resCont.ok) {
          const contrs = await parseJsonResponse<any[]>(resCont);
          if (Array.isArray(contrs) && contrs.length > 0) {
            setCondiciones((prev) => ({ ...prev, subcontratacion: true }));
          }
        }
      } catch (err) {
        console.error("Error al auto-detectar dotación y contratistas:", err);
      }
    };

    cargarCentros();
    autoDetectarDatosEmpresa();
  }, [empresaId]);

  if (!isOpen) return null;

  const toggleCondicion = (key: string) => {
    setCondiciones((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      setError("Debes seleccionar una empresa para evaluar.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        empresa_id: parseInt(empresaId),
        centro_trabajo_id: centroTrabajoId ? parseInt(centroTrabajoId) : null,
        rubro,
        condiciones,
        observacion_general: observacionGeneral,
      };

      const res = await authFetch(getApiUrl("/api/matrices-legales/generar-automatica/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await parseJsonResponse(res).catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Error al generar la matriz legal.");
      }

      const nuevaMatriz = await parseJsonResponse<MatrizLegal>(res);
      onMatrizGenerada(nuevaMatriz);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Generar Matriz Legal Automatizada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Normativa Chilena SST • Selección por actividad económica y faena
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl">
              {error}
            </div>
          )}

          {/* Selectores de Empresa y Centro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Empresa Asesorada *
              </label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Selecciona una empresa...</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.razon_social} ({emp.rut})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Centro de Trabajo / Faena
              </label>
              <select
                value={centroTrabajoId}
                onChange={(e) => setCentroTrabajoId(e.target.value)}
                disabled={loadingCentros || centros.length === 0}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
              >
                <option value="">{loadingCentros ? "Cargando faenas..." : centros.length === 0 ? "Sin centros (Toda la Empresa)" : "Selecciona faena..."}</option>
                {centros.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rubro Principal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Rubro o Actividad Económica Principal *
            </label>
            <select
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              {RUBROS_CHOICES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Se incluirán automáticamente los requisitos transversales más las normas específicas de este sector.
            </p>
          </div>

          {/* Dotación y Umbrales Legales D.S. 44 / CdT */}
          <div className="bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Dotación Estimada de Trabajadores en Faena
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={dotacionEstimada}
                  onChange={(e) => handleDotacionChange(parseInt(e.target.value) || 0)}
                  className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900 dark:text-white text-right focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-xs text-slate-500">trabajadores</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Ajusta automáticamente los requisitos legales exigibles según los umbrales de la legislación chilena (RIOHS &ge;10, CPHS &ge;25, Depto. Prevención &ge;100).
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${dotacionEstimada >= 10 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {dotacionEstimada >= 10 ? "✓ RIOHS Obligatorio (≥10)" : "RIOHS Voluntario (<10)"}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${dotacionEstimada >= 25 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {dotacionEstimada >= 25 ? "✓ CPHS Obligatorio (≥25)" : "Sin CPHS (<25)"}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${dotacionEstimada >= 100 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {dotacionEstimada >= 100 ? "✓ Depto. Prevención Obligatorio (≥100)" : "Depto. Prevención No Exigible (<100)"}
              </span>
            </div>
          </div>

          {/* Checkboxes de Condiciones en Faena */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Condiciones Operativas de la Faena (Activación de Normas)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              {[
                {
                  id: "mas_100_trabajadores",
                  label: "¿Más de 100 trabajadores en la empresa?",
                  norma: "D.S. 44 Arts. 50 al 56 (Depto. Prevención DPR)",
                },
                {
                  id: "mas_25_trabajadores",
                  label: "¿Más de 25 trabajadores en la faena?",
                  norma: "D.S. 44 Arts. 23 al 49 (Comité Paritario CPHS)",
                },
                {
                  id: "mas_10_trabajadores",
                  label: "¿Más de 10 trabajadores permanentes?",
                  norma: "Art. 153 CdT (Depósito RIOHS en DT)",
                },
                {
                  id: "subcontratacion",
                  label: "¿Régimen de subcontratación en faena?",
                  norma: "D.S. 76 (Sistema de Gestión SST Mandante)",
                },
                {
                  id: "trabajo_altura",
                  label: "¿Trabajos en altura física (> 1.80m)?",
                  norma: "NCh 1258 / NCh 998 (Andamios y SPDC)",
                },
                {
                  id: "sustancias_peligrosas",
                  label: "¿Almacena o manipula sustancias peligrosas?",
                  norma: "D.S. 43 (SUSPEL) / D.S. 148 (RESPEL)",
                },
                {
                  id: "ruido_ocupacional",
                  label: "¿Exposición ocupacional a ruido (>82 dBA)?",
                  norma: "Protocolo PREXOR (Audiometrías SUSESO)",
                },
                {
                  id: "silice_polvo",
                  label: "¿Exposición a polvo con sílice libre?",
                  norma: "Protocolo PLANESI (Cortes húmedos)",
                },
                {
                  id: "espacios_confinados",
                  label: "¿Labores en espacios confinados / subterráneas?",
                  norma: "D.S. 132 / D.S. 594 (Ventilación y monitoreo)",
                },
              ].map((item) => (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    condiciones[item.id]
                      ? "bg-orange-50/80 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800/60 text-slate-900 dark:text-white"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!condiciones[item.id]}
                    onChange={() => toggleCondicion(item.id)}
                    className="mt-0.5 rounded text-orange-600 focus:ring-orange-500 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <div>
                    <span className="font-semibold block">{item.label}</span>
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                      {item.norma}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Observaciones Iniciales de la Auditoría
            </label>
            <textarea
              rows={2}
              value={observacionGeneral}
              onChange={(e) => setObservacionGeneral(e.target.value)}
              placeholder="Ej: Matriz generada para inicio de faena marzo 2026. Auditoría preliminar a presentar a mandante."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Footer de Acciones */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-950/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generando Matriz en 1s...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Generar Matriz Legal Automática</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
