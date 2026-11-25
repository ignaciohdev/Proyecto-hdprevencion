"use client";

import React, { useState, useEffect } from "react";
import {
  EmpresaOption,
  CentroTrabajoOption,
  TrabajadorOption,
  ItemEPP,
  EPP_PREDEFINIDOS,
  MOTIVOS_ENTREGA,
  EntregaEPP,
} from "../types";
import { SignatureCanvas } from "./SignatureCanvas";

interface ModalNuevaEntregaProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaOption[];
  centrosTrabajo: CentroTrabajoOption[];
  trabajadores: TrabajadorOption[];
  empresaSeleccionadaId?: number;
  onGuardarEntrega: (data: Partial<EntregaEPP>) => Promise<void>;
}

export function ModalNuevaEntrega({
  isOpen,
  onClose,
  empresas,
  centrosTrabajo,
  trabajadores,
  empresaSeleccionadaId,
  onGuardarEntrega,
}: ModalNuevaEntregaProps) {
  const [empresaId, setEmpresaId] = useState<number>(
    empresaSeleccionadaId || (empresas[0]?.id ?? 0)
  );
  const [centroId, setCentroId] = useState<string>("");
  const [trabajadorId, setTrabajadorId] = useState<string>("");

  const [items, setItems] = useState<ItemEPP[]>([
    {
      tipo: "Casco de seguridad con barbiquejo",
      marca_modelo: "MSA V-Gard",
      certificacion: "NCh 461 / Clase A",
      cantidad: 1,
      motivo: "ENTREGA_INICIAL",
    },
    {
      tipo: "Lentes de seguridad con filtro UV",
      marca_modelo: "3M Virtua",
      certificacion: "Art. 109 D.S. 594",
      cantidad: 1,
      motivo: "ENTREGA_INICIAL",
    },
  ]);

  const [entregaRiohs, setEntregaRiohs] = useState<boolean>(true);
  const [versionRiohs, setVersionRiohs] = useState<string>(
    `Versión ${new Date().getFullYear()}.1`
  );
  const [declaracionCapacitacion, setDeclaracionCapacitacion] = useState<boolean>(true);
  const [firmaDigital, setFirmaDigital] = useState<string | null>(null);

  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (empresaSeleccionadaId) {
      setEmpresaId(empresaSeleccionadaId);
    }
  }, [empresaSeleccionadaId]);

  if (!isOpen) return null;

  const centrosFiltrados = centrosTrabajo.filter((c) => c.empresa === Number(empresaId));
  const trabajadoresFiltrados = trabajadores.filter((t) => t.empresa === Number(empresaId));

  const trabajadorActual = trabajadores.find((t) => t.id === Number(trabajadorId));

  const handleSeleccionarTrabajador = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTrabajadorId(val);
    if (val) {
      const trab = trabajadores.find((t) => t.id === Number(val));
      if (trab && trab.centro_trabajo) {
        setCentroId(String(trab.centro_trabajo));
      }
    }
  };

  const agregarPredefinido = (preset: typeof EPP_PREDEFINIDOS[0]) => {
    setItems((prev) => [
      ...prev,
      {
        tipo: preset.tipo,
        marca_modelo: preset.marca_modelo,
        certificacion: preset.certificacion,
        cantidad: 1,
        motivo: preset.motivo,
      },
    ]);
  };

  const agregarFilaPersonalizada = () => {
    setItems((prev) => [
      ...prev,
      {
        tipo: "",
        marca_modelo: "",
        certificacion: "",
        talla: "",
        cantidad: 1,
        motivo: "ENTREGA_INICIAL",
      },
    ]);
  };

  const actualizarItem = (idx: number, campo: keyof ItemEPP, valor: any) => {
    setItems((prev) => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };
      return copia;
    });
  };

  const eliminarItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      setError("Debe seleccionar una empresa.");
      return;
    }
    if (!trabajadorId) {
      setError("Debe seleccionar al trabajador receptor.");
      return;
    }
    if (items.length === 0) {
      setError("Debe registrar al menos un Elemento de Protección Personal.");
      return;
    }
    const itemsValidos = items.filter((it) => it.tipo.trim().length > 0);
    if (itemsValidos.length === 0) {
      setError("Complete la descripción de los elementos de seguridad.");
      return;
    }
    if (!firmaDigital) {
      setError("La firma digital del trabajador es obligatoria para validar la entrega legal.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      await onGuardarEntrega({
        empresa: Number(empresaId),
        centro_trabajo: centroId ? Number(centroId) : null,
        trabajador: Number(trabajadorId),
        items_epp: itemsValidos,
        entrega_riohs: entregaRiohs,
        version_riohs: entregaRiohs ? versionRiohs.trim() : "",
        declaracion_capacitacion: declaracionCapacitacion,
        firma_digital: firmaDigital,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Error al registrar la entrega de EPP.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl my-6 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                Art. 68 Ley N° 16.744 • Art. 53 D.S. N° 594
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">• Suministro Gratuito</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              Nueva Entrega de EPP y RIOHS
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Sección 1: Datos de Empresa y Trabajador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Empresa Empleadora <span className="text-orange-500">*</span>
              </label>
              <select
                value={empresaId}
                onChange={(e) => {
                  setEmpresaId(Number(e.target.value));
                  setTrabajadorId("");
                  setCentroId("");
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500"
              >
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.razon_social} ({emp.rut})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Centro de Trabajo / Faena
              </label>
              <select
                value={centroId}
                onChange={(e) => setCentroId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500"
              >
                <option value="">-- Casa Matriz / Sin faena específica --</option>
                {centrosFiltrados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Trabajador Receptor de Equipos <span className="text-orange-500">*</span>
              </label>
              <select
                value={trabajadorId}
                onChange={handleSeleccionarTrabajador}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              >
                <option value="">-- Seleccionar trabajador de la empresa --</option>
                {trabajadoresFiltrados.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombres} {t.apellidos} • RUT: {t.rut} • {t.cargo}
                  </option>
                ))}
              </select>

              {trabajadorActual && (
                <div className="mt-2 text-xs flex items-center space-x-3 text-slate-500 dark:text-slate-400">
                  <span>
                    RUT: <strong>{trabajadorActual.rut}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Cargo: <strong>{trabajadorActual.cargo}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sección 2: Selección Rápida de EPP Normativos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Atajos Rápidos de EPP (Normas Chilenas Certificadas)
              </label>
              <span className="text-[11px] text-slate-400">Clic para añadir a la entrega</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {EPP_PREDEFINIDOS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => agregarPredefinido(preset)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-500/50 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center space-x-1"
                >
                  <span className="text-orange-500">+</span>
                  <span>{preset.tipo.split(" ")[0]} {preset.tipo.split(" ")[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sección 3: Tabla Dinámica de Elementos a Entregar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Detalle de Elementos de Protección Personal ({items.length})
              </h4>
              <button
                type="button"
                onClick={agregarFilaPersonalizada}
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center space-x-1"
              >
                <span>+ Agregar EPP Personalizado</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 shadow-sm space-y-2 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={item.tipo}
                      onChange={(e) => actualizarItem(idx, "tipo", e.target.value)}
                      placeholder="Tipo de EPP (Ej: Casco, Calzado, Lentes)..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarItem(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 text-base font-bold"
                        title="Eliminar elemento"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={item.marca_modelo || ""}
                      onChange={(e) => actualizarItem(idx, "marca_modelo", e.target.value)}
                      placeholder="Marca / Modelo"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                    />
                    <input
                      type="text"
                      value={item.certificacion || ""}
                      onChange={(e) => actualizarItem(idx, "certificacion", e.target.value)}
                      placeholder="Certificación (NCh / ISP)"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                    />
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={item.talla || ""}
                        onChange={(e) => actualizarItem(idx, "talla", e.target.value)}
                        placeholder="Talla"
                        className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(idx, "cantidad", Number(e.target.value))}
                        className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold"
                      />
                    </div>
                    <select
                      value={item.motivo}
                      onChange={(e) => actualizarItem(idx, "motivo", e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium"
                    >
                      {MOTIVOS_ENTREGA.map((m) => (
                        <option key={m.valor} value={m.valor}>
                          {m.texto}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sección 4: Entrega de RIOHS y Declaración Legal Art. 53 */}
          <div className="p-4 rounded-2xl bg-orange-500/5 dark:bg-orange-950/15 border border-orange-500/20 space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={entregaRiohs}
                onChange={(e) => setEntregaRiohs(e.target.checked)}
                className="mt-0.5 rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  Entrega formal de ejemplar del Reglamento Interno (RIOHS)
                </span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                  Conforme a los Arts. 153 a 157 del Código del Trabajo, el trabajador recibe copia oficial del reglamento vigente.
                </p>
              </div>
            </label>

            {entregaRiohs && (
              <div className="pl-7">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Versión o Año del RIOHS entregado:
                </label>
                <input
                  type="text"
                  value={versionRiohs}
                  onChange={(e) => setVersionRiohs(e.target.value)}
                  placeholder="Ej: Versión 2026.1 / Actualización Ley Karin"
                  className="w-full sm:w-72 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                />
              </div>
            )}

            <label className="flex items-start space-x-3 cursor-pointer pt-2 border-t border-orange-500/20">
              <input
                type="checkbox"
                checked={declaracionCapacitacion}
                onChange={(e) => setDeclaracionCapacitacion(e.target.checked)}
                className="mt-0.5 rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  Declaración de Inducción de Uso y Conservación (Art. 53 D.S. N° 594)
                </span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                  El trabajador declara haber recibido la debida instrucción técnica respecto del uso correcto, ajuste, inspección y mantención de los elementos recibidos.
                </p>
              </div>
            </label>
          </div>

          {/* Sección 5: Firma Digital Táctil */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Firma Digital en Pantalla del Trabajador Receptor <span className="text-orange-500">*</span>
            </label>
            <SignatureCanvas onSignatureChange={(sig) => setFirmaDigital(sig)} />
          </div>

          {/* Aviso Informativo Ley 21.719 (Art. 14 ter y Art. 13 b - deber legal SST sin consentimiento) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            🔒 <strong>Aviso de Privacidad (Ley N° 21.719):</strong> HD Prevención trata el nombre, RUT, firma manuscrita digitalizada e IP de registro del trabajador como Encargado por cuenta del empleador (Responsable), con la única finalidad de acreditar el cumplimiento de la normativa SST (D.S. N° 44, D.S. N° 594 y Art. 68 Ley N° 16.744). Conservación legal mínima: 5 años. Revisa la{" "}
            <a href="/privacidad" target="_blank" className="text-orange-600 dark:text-orange-400 underline font-semibold">
              Política de Privacidad
            </a>{" "}
            y el canal de derechos en{" "}
            <a href="/derechos-arco" target="_blank" className="text-orange-600 dark:text-orange-400 underline font-semibold">
              /derechos-arco
            </a>.
          </div>

          {/* Footer Botones */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 italic">
              Art. 68 Ley 16.744: Suministro gratuito obligatorio.
            </p>

            <div className="flex items-center space-x-3">
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
                disabled={guardando || !firmaDigital}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center space-x-2"
              >
                {guardando ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Guardando Registro...</span>
                  </>
                ) : (
                  <span>Registrar Entrega con Firma</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
