"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FormCrearReporte,
  CLASIFICACIONES_PELIGRO,
  JERARQUIA_CONTROLES,
  calcularMatrizRiesgo,
  comprimirFotoEvidencia,
} from "../types";

interface ModalCrearReporteProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: FormCrearReporte) => Promise<{ success: boolean; error?: string }>;
  initialValues?: Partial<FormCrearReporte> | null;
}

export function ModalCrearReporte({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
}: ModalCrearReporteProps) {
  const [form, setForm] = useState<FormCrearReporte>({
    empresa_faena: "",
    area_puesto: "",
    lugar: "",
    tipo: "CONDICION",
    clasificacion_peligro: "SEGURIDAD",
    norma_infringida: "",
    descripcion: "",
    probabilidad: 2,
    severidad: 2,
    jerarquia_control: "ADMINISTRATIVO",
    medida_correctiva: "",
    responsable: "",
    fecha_limite: "",
    foto_evidencia: "",
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialValues) {
      setForm((prev) => ({
        ...prev,
        ...initialValues,
      }));
    }
  }, [initialValues]);

  // Cálculo en vivo de la matriz de riesgo
  const matrizCalculada = useMemo(() => {
    return calcularMatrizRiesgo(form.probabilidad, form.severidad);
  }, [form.probabilidad, form.severidad]);

  if (!isOpen) return null;

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const comprimida = await comprimirFotoEvidencia(file);
      setForm((prev) => ({ ...prev, foto_evidencia: comprimida }));
    } catch {
      alert("No se pudo procesar la imagen fotográfica.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const res = await onSubmit(form);
    if (res.success) {
      // Reset form
      setForm({
        empresa_faena: "",
        area_puesto: "",
        lugar: "",
        tipo: "CONDICION",
        clasificacion_peligro: "SEGURIDAD",
        norma_infringida: "",
        descripcion: "",
        probabilidad: 2,
        severidad: 2,
        jerarquia_control: "ADMINISTRATIVO",
        medida_correctiva: "",
        responsable: "",
        fecha_limite: "",
        foto_evidencia: "",
      });
      onClose();
    } else {
      setError(res.error || "Ocurrió un error al guardar el reporte.");
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-2xl my-8 relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
              Inspección Operativa DS 594 / DS 76
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Levantar Hallazgo en Terreno
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-4 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sección 1: Ubicación y Faena */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Empresa / Faena / Centro de Trabajo *
              </label>
              <input
                type="text"
                required
                value={form.empresa_faena}
                onChange={(e) => setForm({ ...form, empresa_faena: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                placeholder="ej. Constructora Andina - Obra Torre 2"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Área o Puesto de Trabajo *
              </label>
              <input
                type="text"
                required
                value={form.area_puesto}
                onChange={(e) => setForm({ ...form, area_puesto: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                placeholder="ej. Bodega de Químicos / Andamio Fachada Norte"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Ubicación Física Específica
            </label>
            <input
              type="text"
              required
              value={form.lugar}
              onChange={(e) => setForm({ ...form, lugar: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
              placeholder="ej. Nivel 4, Eje B-12 / Frente a Tablero Eléctrico N° 3"
            />
          </div>

          {/* Sección 2: Clasificación y Peligro Normativo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Clasificación del Hallazgo *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, tipo: "CONDICION" })}
                  className={`py-2 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                    form.tipo === "CONDICION"
                      ? "bg-orange-600 border-transparent text-white shadow"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  🛠️ Condición Insegura
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, tipo: "ACTO" })}
                  className={`py-2 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                    form.tipo === "ACTO"
                      ? "bg-orange-600 border-transparent text-white shadow"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  👤 Acto Inseguro
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Tipificación del Peligro (MINSAL / DS 594) *
              </label>
              <select
                value={form.clasificacion_peligro}
                onChange={(e) =>
                  setForm({
                    ...form,
                    clasificacion_peligro: e.target.value as "FISICO" | "QUIMICO" | "BIOLOGICO" | "ERGONOMICO" | "PSICOSOCIAL" | "SEGURIDAD",
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white font-semibold cursor-pointer"
              >
                {CLASIFICACIONES_PELIGRO.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Norma Legal Infringida */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Norma Legal Infringida (DS 594, DS 76, Ley 16.744, NCh)
            </label>
            <input
              type="text"
              value={form.norma_infringida}
              onChange={(e) => setForm({ ...form, norma_infringida: e.target.value })}
              placeholder="ej. DS 594 Art. 38 (Eléctrico) / DS 76 Art. 14 / NCh 1430"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Descripción Detallada del Hallazgo *
            </label>
            <textarea
              required
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white resize-none leading-relaxed"
              placeholder="Detalla la condición detectada, factores de riesgo y posibles consecuencias de accidente o enfermedad laboral..."
            />
          </div>

          {/* Evidencia Fotográfica */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Evidencia Fotográfica en Terreno
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleFotoUpload}
                className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 dark:file:bg-orange-950 dark:file:text-orange-300 cursor-pointer"
              />
              {form.foto_evidencia && (
                <div className="relative">
                  <img
                    src={form.foto_evidencia}
                    alt="Preview"
                    className="h-10 w-10 object-cover rounded-lg border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, foto_evidencia: "" })}
                    className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center cursor-pointer"
                    title="Quitar foto"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sección 3: Matriz Cuantitativa P x S */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Matriz Cuantitativa de Riesgo (Probabilidad x Consecuencia)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Probabilidad (P)
                </label>
                <select
                  value={form.probabilidad}
                  onChange={(e) => setForm({ ...form, probabilidad: parseInt(e.target.value) })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  <option value={1}>1: Baja (Suceso poco frecuente o remoto)</option>
                  <option value={2}>2: Media (Puede ocurrir ocasionalmente)</option>
                  <option value={3}>3: Alta (Ocurre frecuentemente / Inminente)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Severidad / Consecuencia (S)
                </label>
                <select
                  value={form.severidad}
                  onChange={(e) => setForm({ ...form, severidad: parseInt(e.target.value) })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  <option value={1}>1: Leve (Primeros auxilios / Sin tiempo perdido)</option>
                  <option value={2}>2: Grave (Lesión con reposo / Incapacidad temporal)</option>
                  <option value={3}>3: Crítica / Fatal (Invalidez permanente o muerte)</option>
                </select>
              </div>
            </div>

            {/* Resultado en Vivo de la Matriz */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${matrizCalculada.colorBadge}`}>
              <div>
                <span className="font-extrabold text-xs block">
                  Magnitud Evaluada: {matrizCalculada.etiqueta} (PxS = {matrizCalculada.score})
                </span>
                <span className="text-[11px] opacity-90">{matrizCalculada.accion}</span>
              </div>
            </div>
          </div>

          {/* Sección 4: Plan de Acción y Jerarquía de Control Legal */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Jerarquía de Control Legal Obligatoria (ISO 45001 / DS 76) *
              </label>
              <select
                value={form.jerarquia_control}
                onChange={(e) =>
                  setForm({
                    ...form,
                    jerarquia_control: e.target.value as "ELIMINACION" | "SUSTITUCION" | "INGENIERIA" | "ADMINISTRATIVO" | "EPP",
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white font-bold cursor-pointer"
              >
                {JERARQUIA_CONTROLES.map((j) => (
                  <option key={j.valor} value={j.valor}>
                    {j.etiqueta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Medida Correctiva Propuesta (Prescripción Técnica) *
              </label>
              <textarea
                required
                rows={2}
                value={form.medida_correctiva}
                onChange={(e) => setForm({ ...form, medida_correctiva: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white resize-none"
                placeholder="Instrucción técnica obligatoria para subsanar el hallazgo..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Responsable en Faena (Art. 66 Ley 16.744) *
                </label>
                <input
                  type="text"
                  required
                  value={form.responsable}
                  onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                  placeholder="ej. Juan Pérez (Supervisor de Terreno)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Plazo Límite de Subsanación *
                </label>
                <input
                  type="date"
                  required
                  value={form.fecha_limite}
                  onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white font-semibold cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs cursor-pointer shadow-lg transition-all disabled:opacity-50"
            >
              {creating ? "Registrando Hallazgo..." : "Guardar No Conformidad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
