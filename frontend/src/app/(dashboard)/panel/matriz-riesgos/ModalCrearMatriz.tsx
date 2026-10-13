"use client";

import { useState, useEffect } from "react";
import { EmpresaSimple, CentroTrabajoSimple, MatrizRiesgoMiper } from "./types";
import { getApiUrl, authFetch, parseJsonResponse } from "../../../utils/api";

interface ModalCrearMatrizProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaSimple[];
  initialEmpresaId?: number | null;
  onMatrizCreada: (matriz: MatrizRiesgoMiper) => void;
}

export default function ModalCrearMatriz({
  isOpen,
  onClose,
  empresas,
  initialEmpresaId,
  onMatrizCreada,
}: ModalCrearMatrizProps) {
  const [empresaId, setEmpresaId] = useState<number | "">("");
  const [centros, setCentros] = useState<CentroTrabajoSimple[]>([]);
  const [centroTrabajoId, setCentroTrabajoId] = useState<number | "">("");
  const [nombre, setNombre] = useState("");
  const [procesoArea, setProcesoArea] = useState("");
  const [version, setVersion] = useState(1);
  const [estado, setEstado] = useState<"BORRADOR" | "VIGENTE" | "EN_REVISION">("VIGENTE");
  const [fechaAprobacion, setFechaAprobacion] = useState("");
  const [fechaProximaRevision, setFechaProximaRevision] = useState("");

  const [loadingCentros, setLoadingCentros] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar empresa seleccionada
  useEffect(() => {
    if (initialEmpresaId) {
      setEmpresaId(initialEmpresaId);
    } else if (empresas.length > 0) {
      setEmpresaId(empresas[0].id);
    }
  }, [initialEmpresaId, empresas]);

  // Cargar centros de trabajo de la empresa seleccionada
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
          const data = await parseJsonResponse<any>(res);
          const list = Array.isArray(data) ? data : data.results || [];
          setCentros(list);
          if (list.length > 0) {
            setCentroTrabajoId(list[0].id);
          } else {
            setCentroTrabajoId("");
          }
        }
      } catch (err) {
        console.error("Error al cargar faenas:", err);
      } finally {
        setLoadingCentros(false);
      }
    };

    cargarCentros();
  }, [empresaId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      setErrorMsg("Debe seleccionar una empresa.");
      return;
    }
    if (!nombre.trim()) {
      setErrorMsg("Debe ingresar el nombre de la Matriz MIPER.");
      return;
    }
    if (!procesoArea.trim()) {
      setErrorMsg("Debe especificar el área o proceso general.");
      return;
    }

    setGuardando(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        empresa: empresaId,
        nombre: nombre.trim(),
        proceso_area: procesoArea.trim(),
        version: Number(version) || 1,
        estado: estado,
      };

      if (centroTrabajoId) {
        payload.centro_trabajo = centroTrabajoId;
      }
      if (fechaAprobacion) {
        payload.fecha_aprobacion = fechaAprobacion;
      }
      if (fechaProximaRevision) {
        payload.fecha_proxima_revision = fechaProximaRevision;
      }

      const res = await authFetch(getApiUrl("/api/matrices-riesgo-miper/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await parseJsonResponse<any>(res);
        throw new Error(
          errData?.detail ||
            errData?.error ||
            errData?.nombre?.[0] ||
            "Error al crear la matriz MIPER."
        );
      }

      const nuevaMatriz = await parseJsonResponse<MatrizRiesgoMiper>(res);
      onMatrizCreada(nuevaMatriz);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                ⚡
              </span>
              <h2 className="text-lg font-bold text-white">
                Nueva Matriz de Riesgos MIPER
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Guía Técnica ISP • Metodología D.S. N° 44 • NCh-ISO 45001
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Selector de Empresa */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Empresa Titular <span className="text-red-400">*</span>
            </label>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              required
            >
              <option value="">Seleccione una empresa...</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.razon_social} ({emp.rut})
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Centro de Trabajo */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Centro de Trabajo / Faena Operativa (Opcional)
            </label>
            <select
              value={centroTrabajoId}
              onChange={(e) =>
                setCentroTrabajoId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={loadingCentros || centros.length === 0}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 disabled:opacity-50"
            >
              <option value="">
                {centros.length === 0
                  ? "(Toda la empresa / Sin faena específica)"
                  : "Seleccione faena o centro..."}
              </option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.comuna ? `(${c.comuna})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Nombre de la Matriz */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre de la Matriz IPER <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Matriz IPER Faena Obras Civiles y Excavaciones"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              required
            />
          </div>

          {/* Proceso / Área */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Área o Macrogrupo de Procesos <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={procesoArea}
              onChange={(e) => setProcesoArea(e.target.value)}
              placeholder="Ej. Operaciones en Terreno / Movimiento de Tierras"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              required
            />
          </div>

          {/* Versión y Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Versión
              </label>
              <input
                type="number"
                min={1}
                value={version}
                onChange={(e) => setVersion(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Estado Inicial
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                <option value="VIGENTE">Vigente y Aprobada</option>
                <option value="BORRADOR">Borrador en Elaboración</option>
                <option value="EN_REVISION">En Revisión Periódica</option>
              </select>
            </div>
          </div>

          {/* Fechas de Aprobación y Próxima Revisión */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Fecha de Aprobación
              </label>
              <input
                type="date"
                value={fechaAprobacion}
                onChange={(e) => setFechaAprobacion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Fecha Próxima Revisión
              </label>
              <input
                type="date"
                value={fechaProximaRevision}
                onChange={(e) => setFechaProximaRevision(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
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
                  Creando Matriz...
                </>
              ) : (
                "Guardar Matriz"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
