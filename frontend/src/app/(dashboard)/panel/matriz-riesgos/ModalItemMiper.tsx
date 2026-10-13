"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ItemMatrizRiesgo,
  TipoActividad,
  ClasificacionPeligro,
  EstadoControl,
  ClasificacionRiesgo,
  ESCALA_PROBABILIDAD,
  ESCALA_SEVERIDAD,
  CLASIFICACIONES_RIESGO,
  getClasificacionColor,
  getClasificacionSolidBg,
} from "./types";
import { getApiUrl, authFetch, parseJsonResponse } from "../../../utils/api";

interface ModalItemMiperProps {
  isOpen: boolean;
  onClose: () => void;
  matrizId: number;
  itemToEdit?: ItemMatrizRiesgo | null;
  onItemGuardado: (item: ItemMatrizRiesgo, isEdit: boolean) => void;
}

export default function ModalItemMiper({
  isOpen,
  onClose,
  matrizId,
  itemToEdit,
  onItemGuardado,
}: ModalItemMiperProps) {
  const isEditing = Boolean(itemToEdit);

  // Campos básicos
  const [proceso, setProceso] = useState("");
  const [actividad, setActividad] = useState("");
  const [tipoActividad, setTipoActividad] = useState<TipoActividad>("RUTINARIA");
  const [puestoTrabajo, setPuestoTrabajo] = useState("");
  const [peligro, setPeligro] = useState("");
  const [clasificacionPeligro, setClasificacionPeligro] = useState<ClasificacionPeligro>("SEGURIDAD");
  const [riesgoConsecuencia, setRiesgoConsecuencia] = useState("");

  // Evaluación Riesgo Puro
  const [probabilidadPura, setProbabilidadPura] = useState<number>(3);
  const [severidadPura, setSeveridadPura] = useState<number>(3);

  // Jerarquía de Controles del ISP
  const [controlEliminacion, setControlEliminacion] = useState("");
  const [controlSustitucion, setControlSustitucion] = useState("");
  const [controlIngenieria, setControlIngenieria] = useState("");
  const [controlAdministrativo, setControlAdministrativo] = useState("");
  const [controlEpp, setControlEpp] = useState("");

  // Evaluación Riesgo Residual
  const [probabilidadResidual, setProbabilidadResidual] = useState<number>(2);
  const [severidadResidual, setSeveridadResidual] = useState<number>(2);

  // Gestión
  const [responsable, setResponsable] = useState("");
  const [plazoImplementacion, setPlazoImplementacion] = useState("");
  const [estadoControl, setEstadoControl] = useState<EstadoControl>("IMPLEMENTADO");
  const [orden, setOrden] = useState<number>(10);

  const [acordeonAbierto, setAcordeonAbierto] = useState<string>("ingenieria");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar estado al abrir o cambiar de ítem
  useEffect(() => {
    if (itemToEdit) {
      setProceso(itemToEdit.proceso || "");
      setActividad(itemToEdit.actividad || "");
      setTipoActividad(itemToEdit.tipo_actividad || "RUTINARIA");
      setPuestoTrabajo(itemToEdit.puesto_trabajo || "");
      setPeligro(itemToEdit.peligro || "");
      setClasificacionPeligro(itemToEdit.clasificacion_peligro || "SEGURIDAD");
      setRiesgoConsecuencia(itemToEdit.riesgo_consecuencia || "");

      setProbabilidadPura(itemToEdit.probabilidad_pura || 3);
      setSeveridadPura(itemToEdit.severidad_pura || 3);

      setControlEliminacion(itemToEdit.control_eliminacion || "");
      setControlSustitucion(itemToEdit.control_sustitucion || "");
      setControlIngenieria(itemToEdit.control_ingenieria || "");
      setControlAdministrativo(itemToEdit.control_administrativo || "");
      setControlEpp(itemToEdit.control_epp || "");

      setProbabilidadResidual(itemToEdit.probabilidad_residual || 2);
      setSeveridadResidual(itemToEdit.severidad_residual || 2);

      setResponsable(itemToEdit.responsable || "");
      setPlazoImplementacion(itemToEdit.plazo_implementacion || "");
      setEstadoControl(itemToEdit.estado_control || "IMPLEMENTADO");
      setOrden(itemToEdit.orden || 10);
    } else {
      setProceso("");
      setActividad("");
      setTipoActividad("RUTINARIA");
      setPuestoTrabajo("");
      setPeligro("");
      setClasificacionPeligro("SEGURIDAD");
      setRiesgoConsecuencia("");

      setProbabilidadPura(3);
      setSeveridadPura(3);

      setControlEliminacion("");
      setControlSustitucion("");
      setControlIngenieria("");
      setControlAdministrativo("");
      setControlEpp("");

      setProbabilidadResidual(2);
      setSeveridadResidual(2);

      setResponsable("");
      setPlazoImplementacion("");
      setEstadoControl("IMPLEMENTADO");
      setOrden(10);
    }
    setErrorMsg(null);
  }, [itemToEdit, isOpen]);

  // Cálculos reactivos
  const magnitudPura = useMemo(() => probabilidadPura * severidadPura, [probabilidadPura, severidadPura]);
  const clasificacionPura: ClasificacionRiesgo = useMemo(() => {
    if (magnitudPura >= 17) return "CRITICO";
    if (magnitudPura >= 10) return "ALTO";
    if (magnitudPura >= 5) return "MEDIO";
    return "BAJO";
  }, [magnitudPura]);

  const magnitudResidual = useMemo(
    () => probabilidadResidual * severidadResidual,
    [probabilidadResidual, severidadResidual]
  );
  const clasificacionResidual: ClasificacionRiesgo = useMemo(() => {
    if (magnitudResidual >= 17) return "CRITICO";
    if (magnitudResidual >= 10) return "ALTO";
    if (magnitudResidual >= 5) return "MEDIO";
    return "BAJO";
  }, [magnitudResidual]);

  const reduccionPorcentual = useMemo(() => {
    if (magnitudPura <= 0) return 0;
    const red = ((magnitudPura - magnitudResidual) / magnitudPura) * 100;
    return Math.max(0, Math.round(red));
  }, [magnitudPura, magnitudResidual]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proceso.trim() || !actividad.trim() || !puestoTrabajo.trim()) {
      setErrorMsg("Debe completar el Proceso, la Actividad y el Puesto de Trabajo.");
      return;
    }
    if (!peligro.trim() || !riesgoConsecuencia.trim()) {
      setErrorMsg("Debe detallar el Peligro y su Riesgo / Consecuencia.");
      return;
    }

    setGuardando(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        matriz: matrizId,
        proceso: proceso.trim(),
        actividad: actividad.trim(),
        tipo_actividad: tipoActividad,
        puesto_trabajo: puestoTrabajo.trim(),
        peligro: peligro.trim(),
        clasificacion_peligro: clasificacionPeligro,
        riesgo_consecuencia: riesgoConsecuencia.trim(),

        probabilidad_pura: Number(probabilidadPura),
        severidad_pura: Number(severidadPura),

        control_eliminacion: controlEliminacion.trim(),
        control_sustitucion: controlSustitucion.trim(),
        control_ingenieria: controlIngenieria.trim(),
        control_administrativo: controlAdministrativo.trim(),
        control_epp: controlEpp.trim(),

        probabilidad_residual: Number(probabilidadResidual),
        severidad_residual: Number(severidadResidual),

        responsable: responsable.trim(),
        estado_control: estadoControl,
        orden: Number(orden) || 10,
      };

      if (plazoImplementacion) {
        payload.plazo_implementacion = plazoImplementacion;
      } else {
        payload.plazo_implementacion = null;
      }

      const url = isEditing
        ? getApiUrl(`/api/items-matriz-riesgo/${itemToEdit!.id}/`)
        : getApiUrl("/api/items-matriz-riesgo/");
      const method = isEditing ? "PATCH" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await parseJsonResponse<any>(res);
        throw new Error(
          errData?.detail ||
            errData?.error ||
            errData?.peligro?.[0] ||
            "Error al guardar el ítem de la matriz."
        );
      }

      const itemGuardado = await parseJsonResponse<ItemMatrizRiesgo>(res);
      onItemGuardado(itemGuardado, isEditing);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la solicitud.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 font-bold text-sm">
                {isEditing ? "✏️" : "➕"}
              </span>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? "Editar Peligro y Controles" : "Identificar Nuevo Peligro (MIPER)"}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Escala ISP (1 a 5) • Jerarquía Legal de Mitigación • Metodología D.S. N° 44
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* SECCIÓN 1: Contexto de Trabajo */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span>1. Contexto Operativo y Actividad</span>
              <div className="h-px bg-slate-800 flex-1"></div>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Proceso <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={proceso}
                  onChange={(e) => setProceso(e.target.value)}
                  placeholder="Ej. Movimiento de Tierras / Hormigonado"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Actividad o Tarea <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={actividad}
                  onChange={(e) => setActividad(e.target.value)}
                  placeholder="Ej. Excavación profunda de zanjas y perfilado"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tipo de Actividad <span className="text-red-400">*</span>
                </label>
                <select
                  value={tipoActividad}
                  onChange={(e) => setTipoActividad(e.target.value as TipoActividad)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="RUTINARIA">Rutinaria (Operación Habitual)</option>
                  <option value="NO_RUTINARIA">No Rutinaria (Mantenimiento / Esporádica)</option>
                  <option value="EMERGENCIA">Emergencia / Contingencia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Puesto de Trabajo Expuesto <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={puestoTrabajo}
                  onChange={(e) => setPuestoTrabajo(e.target.value)}
                  placeholder="Ej. Jornalero / Operador Retroexcavadora"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Identificación del Peligro */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span>2. Peligro y Riesgo Consecuente</span>
              <div className="h-px bg-slate-800 flex-1"></div>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción del Peligro Identificado <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={peligro}
                  onChange={(e) => setPeligro(e.target.value)}
                  placeholder="Ej. Taludes sin entibar con riesgo de desprendimiento de terreno o caída de bloques."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Clasificación del Peligro <span className="text-red-400">*</span>
                </label>
                <select
                  value={clasificacionPeligro}
                  onChange={(e) => setClasificacionPeligro(e.target.value as ClasificacionPeligro)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="SEGURIDAD">Seguridad (Mecánico / Caídas / Atrapamiento)</option>
                  <option value="FISICO">Físico (Ruido, Vibraciones, Radiación)</option>
                  <option value="QUIMICO">Químico (Sílice, Polvos, Gases, Solventes)</option>
                  <option value="BIOLOGICO">Biológico (Virus, Bacterias, Hantavirus)</option>
                  <option value="ERGONOMICO">Ergonómico (Manejo Manual de Carga / TMERT)</option>
                  <option value="PSICOSOCIAL">Psicosocial (Estrés, Violencia / Ley Karin)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Evento No Deseado y Consecuencia (Riesgo Puro) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={riesgoConsecuencia}
                onChange={(e) => setRiesgoConsecuencia(e.target.value)}
                placeholder="Ej. Atrapamiento por derrumbe: Asfixia, traumatismos múltiples o lesiones fatales."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                required
              />
            </div>
          </div>

          {/* SECCIÓN 3: Evaluación de Riesgo Puro */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔥 Evaluación Riesgo Puro (Sin Controles)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Magnitud evaluada en ausencia de medidas preventivas en faena.
                </p>
              </div>

              {/* Badge de Magnitud Pura en Vivo */}
              <div
                className={`px-3 py-1 rounded-xl border flex items-center gap-2 ${getClasificacionColor(
                  clasificacionPura
                )}`}
              >
                <span className="text-xs font-mono font-bold">
                  MR = {magnitudPura} ({probabilidadPura} × {severidadPura})
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${getClasificacionSolidBg(
                    clasificacionPura
                  )}`}
                >
                  {clasificacionPura}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Probabilidad Pura */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Probabilidad Pura (P: 1 a 5)
                </label>
                <select
                  value={probabilidadPura}
                  onChange={(e) => setProbabilidadPura(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <option key={val} value={val}>
                      {ESCALA_PROBABILIDAD[val]?.etiqueta} - {ESCALA_PROBABILIDAD[val]?.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severidad Pura */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Severidad Pura (S: 1 a 5)
                </label>
                <select
                  value={severidadPura}
                  onChange={(e) => setSeveridadPura(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <option key={val} value={val}>
                      {ESCALA_SEVERIDAD[val]?.etiqueta} - {ESCALA_SEVERIDAD[val]?.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Jerarquía Legal de Controles (Guía Técnica ISP) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span>3. Jerarquía Legal de Controles del ISP (ISO 45001)</span>
              </h3>
              <span className="text-[11px] text-orange-400 font-medium">
                De mayor a menor efectividad preventiva ↓
              </span>
            </div>

            <div className="space-y-2 border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
              {/* 1. Eliminación */}
              <div className="border-b border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setAcordeonAbierto(acordeonAbierto === "eliminacion" ? "" : "eliminacion")}
                  className="w-full p-3 text-left flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-bold text-white">Eliminación del Peligro</span>
                    {controlEliminacion && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                        Definido
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{acordeonAbierto === "eliminacion" ? "▲" : "▼"}</span>
                </button>
                {acordeonAbierto === "eliminacion" && (
                  <div className="p-3 bg-slate-900/40">
                    <input
                      type="text"
                      value={controlEliminacion}
                      onChange={(e) => setControlEliminacion(e.target.value)}
                      placeholder="Ej. Rediseñar el trazado para suprimir la necesidad de excavación en zona inestable."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* 2. Sustitución */}
              <div className="border-b border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setAcordeonAbierto(acordeonAbierto === "sustitucion" ? "" : "sustitucion")}
                  className="w-full p-3 text-left flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs font-bold text-white">Sustitución</span>
                    {controlSustitucion && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                        Definido
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{acordeonAbierto === "sustitucion" ? "▲" : "▼"}</span>
                </button>
                {acordeonAbierto === "sustitucion" && (
                  <div className="p-3 bg-slate-900/40">
                    <input
                      type="text"
                      value={controlSustitucion}
                      onChange={(e) => setControlSustitucion(e.target.value)}
                      placeholder="Ej. Sustituir excavación manual por hincado mecanizado con control remoto."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* 3. Controles de Ingeniería */}
              <div className="border-b border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setAcordeonAbierto(acordeonAbierto === "ingenieria" ? "" : "ingenieria")}
                  className="w-full p-3 text-left flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="text-xs font-bold text-white">Controles de Ingeniería (Barreras Duras)</span>
                    {controlIngenieria && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                        Definido
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{acordeonAbierto === "ingenieria" ? "▲" : "▼"}</span>
                </button>
                {acordeonAbierto === "ingenieria" && (
                  <div className="p-3 bg-slate-900/40">
                    <input
                      type="text"
                      value={controlIngenieria}
                      onChange={(e) => setControlIngenieria(e.target.value)}
                      placeholder="Ej. Entibaciones metálicas continuas normalizadas según NCh 349 y barreras perimetrales rígidas."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* 4. Controles Administrativos */}
              <div className="border-b border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setAcordeonAbierto(acordeonAbierto === "administrativo" ? "" : "administrativo")}
                  className="w-full p-3 text-left flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="text-xs font-bold text-white">Controles Administrativos y Señalización</span>
                    {controlAdministrativo && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                        Definido
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{acordeonAbierto === "administrativo" ? "▲" : "▼"}</span>
                </button>
                {acordeonAbierto === "administrativo" && (
                  <div className="p-3 bg-slate-900/40">
                    <input
                      type="text"
                      value={controlAdministrativo}
                      onChange={(e) => setControlAdministrativo(e.target.value)}
                      placeholder="Ej. Procedimiento de Trabajo Seguro (PTS), charla de 5 minutos, señalética de peligro y delimitación de faena."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* 5. Elementos de Protección Personal (EPP) */}
              <div>
                <button
                  type="button"
                  onClick={() => setAcordeonAbierto(acordeonAbierto === "epp" ? "" : "epp")}
                  className="w-full p-3 text-left flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="text-xs font-bold text-white">Elementos de Protección Personal (EPP Certificado)</span>
                    {controlEpp && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                        Definido
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{acordeonAbierto === "epp" ? "▲" : "▼"}</span>
                </button>
                {acordeonAbierto === "epp" && (
                  <div className="p-3 bg-slate-900/40">
                    <input
                      type="text"
                      value={controlEpp}
                      onChange={(e) => setControlEpp(e.target.value)}
                      placeholder="Ej. Casco con barbiquejo, calzado de seguridad NCh 772, chaleco reflectante alta visibilidad."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN 5: Evaluación de Riesgo Residual (con Controles) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🛡️ Evaluación Riesgo Residual (Con Controles Implementados)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Magnitud final esperada al verificar la aplicación efectiva de los controles.
                </p>
              </div>

              {/* Badge de Magnitud Residual en Vivo con % de Reducción */}
              <div className="flex items-center gap-2">
                <div
                  className={`px-3 py-1 rounded-xl border flex items-center gap-2 ${getClasificacionColor(
                    clasificacionResidual
                  )}`}
                >
                  <span className="text-xs font-mono font-bold">
                    MR = {magnitudResidual} ({probabilidadResidual} × {severidadResidual})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${getClasificacionSolidBg(
                      clasificacionResidual
                    )}`}
                  >
                    {clasificacionResidual}
                  </span>
                </div>

                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ↓ {reduccionPorcentual}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Probabilidad Residual */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Probabilidad Residual (Pr: 1 a 5)
                </label>
                <select
                  value={probabilidadResidual}
                  onChange={(e) => setProbabilidadResidual(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <option key={val} value={val}>
                      {ESCALA_PROBABILIDAD[val]?.etiqueta} - {ESCALA_PROBABILIDAD[val]?.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severidad Residual */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Severidad Residual (Sr: 1 a 5)
                </label>
                <select
                  value={severidadResidual}
                  onChange={(e) => setSeveridadResidual(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <option key={val} value={val}>
                      {ESCALA_SEVERIDAD[val]?.etiqueta} - {ESCALA_SEVERIDAD[val]?.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 6: Responsable, Plazo y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Responsable del Control
              </label>
              <input
                type="text"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Ej. Jefe de Terreno / Supervisor"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Plazo de Implementación
              </label>
              <input
                type="date"
                value={plazoImplementacion}
                onChange={(e) => setPlazoImplementacion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estado del Control
              </label>
              <select
                value={estadoControl}
                onChange={(e) => setEstadoControl(e.target.value as EstadoControl)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                <option value="IMPLEMENTADO">Implementado y Verificado</option>
                <option value="EN_PROCESO">En Proceso de Implementación</option>
                <option value="PENDIENTE">Pendiente de Presupuesto</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Orden de visualización:</span>
              <input
                type="number"
                value={orden}
                onChange={(e) => setOrden(Number(e.target.value))}
                className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-center text-xs text-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
              >
                {guardando ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Guardando...
                  </>
                ) : isEditing ? (
                  "Actualizar Peligro"
                ) : (
                  "Guardar Peligro en Matriz"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
