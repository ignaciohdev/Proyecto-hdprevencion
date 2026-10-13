"use client";

import React, { useState, useEffect } from "react";
import { MiembroCPHS, AcuerdoSesion, ActaSesionCPHS } from "../types";

interface ModalCrearActaProps {
  isOpen: boolean;
  onClose: () => void;
  comiteId: number;
  miembros: MiembroCPHS[];
  siguienteNumeroActa: number;
  onCrearActa: (data: Partial<ActaSesionCPHS>) => Promise<void>;
}

export function ModalCrearActa({
  isOpen,
  onClose,
  comiteId,
  miembros,
  siguienteNumeroActa,
  onCrearActa,
}: ModalCrearActaProps) {
  const [numeroActa, setNumeroActa] = useState<number>(siguienteNumeroActa || 1);
  const [tipoSesion, setTipoSesion] = useState<"ORDINARIA" | "EXTRAORDINARIA">("ORDINARIA");
  const [fechaHoraSesion, setFechaHoraSesion] = useState<string>("");
  const [lugar, setLugar] = useState<string>("Sala de Reuniones de Faena");
  const [asistentesSeleccionados, setAsistentesSeleccionados] = useState<string[]>([]);
  const [tablaTemas, setTablaTemas] = useState<string>(
    "1. Revisión de compromisos del acta anterior.\n2. Análisis de accidentes, incidentes e inspecciones del mes.\n3. Medidas preventivas acordadas y evaluación de condiciones de trabajo."
  );
  const [acuerdos, setAcuerdos] = useState<AcuerdoSesion[]>([
    {
      acuerdo: "Realizar inspección conjunta de extintores y vías de evacuación.",
      responsable: "Presidente CPHS / Experto Prevención",
      plazo: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      cumplido: false,
    },
  ]);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNumeroActa(siguienteNumeroActa || 1);
      // Fecha y hora actual en formato YYYY-MM-DDTHH:mm
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setFechaHoraSesion(now.toISOString().slice(0, 16));
      // Preseleccionar todos los titulares
      const titularesNombres = miembros
        .filter((m) => m.activo && m.tipo_representacion === "TITULAR")
        .map((m) => `${m.nombre} (${m.cargo_display || m.cargo})`);
      setAsistentesSeleccionados(titularesNombres);
      setError(null);
    }
  }, [isOpen, siguienteNumeroActa, miembros]);

  if (!isOpen) return null;

  // Verificación de Quorum Legal según D.S. N° 44 Art. 16
  // Se requiere al menos un representante del empleador y uno de los trabajadores
  const hayAsistenteEmpresa = miembros.some(
    (m) =>
      m.activo &&
      m.estamento === "EMPRESA" &&
      asistentesSeleccionados.some((asistente) => asistente.includes(m.nombre))
  );
  const hayAsistenteTrabajador = miembros.some(
    (m) =>
      m.activo &&
      m.estamento === "TRABAJADORES" &&
      asistentesSeleccionados.some((asistente) => asistente.includes(m.nombre))
  );
  const tieneQuorumLegal = hayAsistenteEmpresa && hayAsistenteTrabajador;

  const toggleAsistente = (nombreCargo: string) => {
    setAsistentesSeleccionados((prev) =>
      prev.includes(nombreCargo)
        ? prev.filter((n) => n !== nombreCargo)
        : [...prev, nombreCargo]
    );
  };

  const handleAddAcuerdo = () => {
    setAcuerdos((prev) => [
      ...prev,
      {
        acuerdo: "",
        responsable: "",
        plazo: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        cumplido: false,
      },
    ]);
  };

  const handleUpdateAcuerdo = (index: number, campo: keyof AcuerdoSesion, valor: any) => {
    setAcuerdos((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], [campo]: valor };
      return copia;
    });
  };

  const handleRemoveAcuerdo = (index: number) => {
    setAcuerdos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lugar.trim()) {
      setError("Debe especificar el lugar o modalidad de la sesión.");
      return;
    }
    if (!fechaHoraSesion) {
      setError("Debe especificar fecha y hora de la reunión.");
      return;
    }
    if (!tablaTemas.trim()) {
      setError("Debe detallar los puntos tratados en la tabla.");
      return;
    }

    const acuerdosValidos = acuerdos.filter((a) => a.acuerdo.trim().length > 0);

    try {
      setGuardando(true);
      setError(null);
      await onCrearActa({
        comite: comiteId,
        numero_acta: Number(numeroActa),
        tipo_sesion: tipoSesion,
        fecha_hora_sesion: new Date(fechaHoraSesion).toISOString(),
        lugar: lugar.trim(),
        asistentes: asistentesSeleccionados,
        tabla_temas: tablaTemas.trim(),
        acuerdos: acuerdosValidos,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Error al registrar el acta.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
              Libro Digital de Actas • D.S. N° 44 Arts. 39, 40 y 42
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Registrar Acta de Sesión CPHS
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Fila 1: Número y Tipo de Sesión */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                N° Correlativo de Acta
              </label>
              <input
                type="number"
                min="1"
                value={numeroActa}
                onChange={(e) => setNumeroActa(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo de Sesión
              </label>
              <select
                value={tipoSesion}
                onChange={(e) => setTipoSesion(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="ORDINARIA">Sesión Ordinaria Mensual</option>
                <option value="EXTRAORDINARIA">Sesión Extraordinaria (Accidente Grave / Urgencia)</option>
              </select>
            </div>
          </div>

          {/* Fila 2: Fecha/Hora y Lugar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Fecha y Hora de la Sesión <span className="text-orange-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={fechaHoraSesion}
                onChange={(e) => setFechaHoraSesion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Lugar o Modalidad <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="Ej: Sala de Capacitaciones, Teams, etc."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Quorum y Asistencia */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Verificación de Asistencia y Quorum Legal
              </label>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  tieneQuorumLegal
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                }`}
              >
                {tieneQuorumLegal
                  ? "✓ Quorum Legal Válido (Art. 40 D.S. 44)"
                  : "⚠ Sin Quorum Legal"}
              </span>
            </div>

            {!tieneQuorumLegal && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>⚖️</span>
                  <span>Infracción al Art. 40 del D.S. N° 44 (Comité Paritario)</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Para que la sesión sea jurídicamente válida y pueda emitirse el acta, es obligatoria la asistencia concurrente de al menos un (1) representante de la empresa y un (1) representante de los trabajadores. El guardado se encuentra bloqueado hasta cumplir el quórum legal mínimo.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {miembros.map((m) => {
                const label = `${m.nombre} (${m.cargo_display || m.cargo} - ${m.estamento === "EMPRESA" ? "Empresa" : "Trabajadores"})`;
                const isSelected = asistentesSeleccionados.includes(label);

                return (
                  <label
                    key={m.id}
                    className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-orange-500/10 border-orange-500/30 text-slate-900 dark:text-white font-semibold"
                        : "border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAsistente(label)}
                      className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span className="truncate">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Puntos Tratados en la Tabla */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Puntos Tratados en la Tabla / Agenda de Reunión <span className="text-orange-500">*</span>
            </label>
            <textarea
              rows={4}
              value={tablaTemas}
              onChange={(e) => setTablaTemas(e.target.value)}
              placeholder="Describa los temas revisados en la sesión..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Acuerdos Preventivos Dinámicos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Acuerdos Preventivos y Medidas Correctivas Adoptadas
              </label>
              <button
                type="button"
                onClick={handleAddAcuerdo}
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center space-x-1"
              >
                <span>+ Agregar Fila</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {acuerdos.map((acuerdo, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 space-y-2 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={acuerdo.acuerdo}
                      onChange={(e) => handleUpdateAcuerdo(idx, "acuerdo", e.target.value)}
                      placeholder="Medida o acuerdo preventivo..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
                    />
                    {acuerdos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAcuerdo(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                        title="Eliminar acuerdo"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={acuerdo.responsable}
                      onChange={(e) => handleUpdateAcuerdo(idx, "responsable", e.target.value)}
                      placeholder="Responsable de ejecución..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
                    />
                    <input
                      type="date"
                      value={acuerdo.plazo}
                      onChange={(e) => handleUpdateAcuerdo(idx, "plazo", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
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
              disabled={guardando || !tieneQuorumLegal}
              title={!tieneQuorumLegal ? "Bloqueado: Se requiere quórum de ambos estamentos (Art. 40 D.S. 44)" : undefined}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2 ${
                !tieneQuorumLegal
                  ? "bg-slate-400 dark:bg-slate-700 text-slate-200 cursor-not-allowed opacity-60"
                  : "bg-orange-600 hover:bg-orange-500 text-white cursor-pointer"
              }`}
            >
              {guardando ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando Acta...</span>
                </>
              ) : !tieneQuorumLegal ? (
                <span>⚠️ Bloqueado por Falta de Quórum</span>
              ) : (
                <span>Guardar y Emitir Acta</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
