"use client";

import React, { useState, useEffect } from "react";
import { MiembroCPHS, TrabajadorItem, validarRutChileno, formatearRutChileno } from "../types";

interface ModalMiembroCPHSProps {
  isOpen: boolean;
  onClose: () => void;
  comiteId: number;
  trabajadores: TrabajadorItem[];
  miembroEditar?: MiembroCPHS | null;
  estamentoInicial?: "EMPRESA" | "TRABAJADORES";
  tipoInicial?: "TITULAR" | "SUPLENTE";
  onGuardar: (data: Partial<MiembroCPHS>) => Promise<void>;
}

export function ModalMiembroCPHS({
  isOpen,
  onClose,
  comiteId,
  trabajadores,
  miembroEditar,
  estamentoInicial = "EMPRESA",
  tipoInicial = "TITULAR",
  onGuardar,
}: ModalMiembroCPHSProps) {
  const [trabajadorId, setTrabajadorId] = useState<string>("");
  const [nombre, setNombre] = useState<string>("");
  const [rut, setRut] = useState<string>("");
  const [estamento, setEstamento] = useState<"EMPRESA" | "TRABAJADORES">(estamentoInicial);
  const [tipoRepresentacion, setTipoRepresentacion] = useState<"TITULAR" | "SUPLENTE">(tipoInicial);
  const [cargo, setCargo] = useState<"PRESIDENTE" | "SECRETARIO" | "VOCAL">("VOCAL");
  const [fechaDesignacion, setFechaDesignacion] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (miembroEditar) {
      setTrabajadorId(miembroEditar.trabajador ? String(miembroEditar.trabajador) : "");
      setNombre(miembroEditar.nombre);
      setRut(miembroEditar.rut);
      setEstamento(miembroEditar.estamento);
      setTipoRepresentacion(miembroEditar.tipo_representacion);
      setCargo(miembroEditar.cargo);
      setFechaDesignacion(
        miembroEditar.fecha_designacion || new Date().toISOString().split("T")[0]
      );
    } else {
      setTrabajadorId("");
      setNombre("");
      setRut("");
      setEstamento(estamentoInicial);
      setTipoRepresentacion(tipoInicial);
      setCargo("VOCAL");
      setFechaDesignacion(new Date().toISOString().split("T")[0]);
    }
    setError(null);
  }, [miembroEditar, estamentoInicial, tipoInicial, isOpen]);

  if (!isOpen) return null;

  const handleSeleccionarTrabajador = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idStr = e.target.value;
    setTrabajadorId(idStr);
    if (idStr) {
      const trab = trabajadores.find((t) => t.id === Number(idStr));
      if (trab) {
        setNombre(`${trab.nombres} ${trab.apellidos}`);
        setRut(trab.rut);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("Debe ingresar el nombre del integrante.");
      return;
    }
    if (!rut.trim() || !validarRutChileno(rut)) {
      setError("El RUT ingresado no es válido o tiene formato incorrecto.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      await onGuardar({
        comite: comiteId,
        trabajador: trabajadorId ? Number(trabajadorId) : null,
        nombre: nombre.trim(),
        rut: formatearRutChileno(rut),
        estamento,
        tipo_representacion: tipoRepresentacion,
        cargo,
        fecha_designacion: fechaDesignacion || null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Error al guardar el integrante del CPHS.");
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
              {miembroEditar ? "Actualizar Registro" : "Designación / Elección D.S. 44"}
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {miembroEditar ? "Editar Integrante del CPHS" : "Designar Integrante del CPHS"}
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

          {/* Selector de Trabajador Existente */}
          {trabajadores.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Vincular Ficha de Trabajador (Opcional)
              </label>
              <select
                value={trabajadorId}
                onChange={handleSeleccionarTrabajador}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">-- Ingresar datos manualmente o seleccionar --</option>
                {trabajadores.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombres} {t.apellidos} ({t.rut}) - {t.cargo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nombre y Apellidos <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Marcelo Díaz Valenzuela"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* RUT */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              RUT del Integrante <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="Ej: 12.345.678-5"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {rut && !validarRutChileno(rut) && (
              <p className="text-[11px] text-rose-500 font-medium mt-1">
                RUT inválido según algoritmo Módulo 11
              </p>
            )}
          </div>

          {/* Estamento y Tipo de Representación */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Estamento Representado
              </label>
              <select
                value={estamento}
                onChange={(e) => setEstamento(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="EMPRESA">Representante del Empleador</option>
                <option value="TRABAJADORES">Representante de los Trabajadores</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo de Representación
              </label>
              <select
                value={tipoRepresentacion}
                onChange={(e) => setTipoRepresentacion(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="TITULAR">Miembro Titular (Voto)</option>
                <option value="SUPLENTE">Miembro Suplente</option>
              </select>
            </div>
          </div>

          {/* Cargo en el Comité */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Cargo Directivo en el CPHS (D.S. 44)
            </label>
            <select
              value={cargo}
              onChange={(e) => setCargo(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="VOCAL">Vocal / Integrante</option>
              <option value="PRESIDENTE">Presidente del Comité</option>
              <option value="SECRETARIO">Secretario del Comité</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              * Nota: Si se selecciona Presidente o Secretario, se reasignará automáticamente dicho rol si ya existía otro.
            </p>
          </div>

          {/* Fecha Designación */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Fecha de Elección / Designación
            </label>
            <input
              type="date"
              value={fechaDesignacion}
              onChange={(e) => setFechaDesignacion(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
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
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{miembroEditar ? "Guardar Cambios" : "Designar Integrante"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
