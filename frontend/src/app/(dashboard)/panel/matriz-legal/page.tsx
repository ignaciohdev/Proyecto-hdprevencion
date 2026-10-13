"use client";

import { useState, useEffect, useMemo } from "react";
import {
  MatrizLegal,
  ItemMatrizLegal,
  EmpresaSimple,
  ORGANISMOS_CONFIG,
  ESTADO_CONFIG,
} from "./types";
import ModalGenerarMatriz from "./ModalGenerarMatriz";
import ModalEditarItem from "./ModalEditarItem";
import ModalImprimirMatriz from "./ModalImprimirMatriz";
import { getApiUrl, authFetch, parseJsonResponse } from "../../../utils/api";

export default function MatrizLegalPage() {
  const [empresas, setEmpresas] = useState<EmpresaSimple[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [matrices, setMatrices] = useState<MatrizLegal[]>([]);
  const [matrizActual, setMatrizActual] = useState<MatrizLegal | null>(null);
  const [items, setItems] = useState<ItemMatrizLegal[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMatriz, setLoadingMatriz] = useState(false);

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroOrganismo, setFiltroOrganismo] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Modales
  const [modalGenerarOpen, setModalGenerarOpen] = useState(false);
  const [itemEditar, setItemEditar] = useState<ItemMatrizLegal | null>(null);
  const [modalImprimirOpen, setModalImprimirOpen] = useState(false);

  // Cargar lista de empresas
  useEffect(() => {
    const cargarEmpresas = async () => {
      setLoading(true);
      try {
        const res = await authFetch(getApiUrl("/api/empresas/"));
        if (res.ok) {
          const data = await parseJsonResponse<any>(res);
          const list = Array.isArray(data) ? data : data.results || [];
          setEmpresas(list);
          if (list.length > 0) {
            setSelectedEmpresaId(list[0].id);
          }
        }
      } catch (err) {
        console.error("Error cargando empresas:", err);
      } finally {
        setLoading(false);
      }
    };

    cargarEmpresas();
  }, []);

  // Cargar matrices cuando cambia la empresa seleccionada
  useEffect(() => {
    if (!selectedEmpresaId) {
      setMatrices([]);
      setMatrizActual(null);
      setItems([]);
      return;
    }

    const cargarMatricesEmpresa = async () => {
      setLoadingMatriz(true);
      try {
        const res = await authFetch(getApiUrl(`/api/matrices-legales/?empresa=${selectedEmpresaId}`));
        if (res.ok) {
          const data = await parseJsonResponse<any>(res);
          const list: MatrizLegal[] = Array.isArray(data) ? data : data.results || [];
          setMatrices(list);
          if (list.length > 0) {
            cargarDetalleMatriz(list[0].id);
          } else {
            setMatrizActual(null);
            setItems([]);
          }
        }
      } catch (err) {
        console.error("Error cargando matrices:", err);
      } finally {
        setLoadingMatriz(false);
      }
    };

    cargarMatricesEmpresa();
  }, [selectedEmpresaId]);

  // Cargar detalle e items de una matriz específica
  const cargarDetalleMatriz = async (matrizId: number) => {
    setLoadingMatriz(true);
    try {
      const res = await authFetch(getApiUrl(`/api/matrices-legales/${matrizId}/`));
      if (res.ok) {
        const data = await parseJsonResponse<MatrizLegal>(res);
        setMatrizActual(data);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Error al cargar detalle de la matriz:", err);
    } finally {
      setLoadingMatriz(false);
    }
  };

  // Manejador tras generar nueva matriz
  const handleMatrizGenerada = (nuevaMatriz: MatrizLegal) => {
    setMatrices((prev) => [nuevaMatriz, ...prev]);
    setMatrizActual(nuevaMatriz);
    setItems(nuevaMatriz.items || []);
  };

  // Manejador tras editar un item
  const handleItemActualizado = (itemActualizado: ItemMatrizLegal) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemActualizado.id ? itemActualizado : it))
    );
    if (matrizActual) {
      cargarDetalleMatriz(matrizActual.id);
    }
  };

  // Filtrado de items
  const itemsFiltrados = useMemo(() => {
    return items.filter((it) => {
      if (filtroOrganismo !== "TODOS" && it.organismo !== filtroOrganismo) {
        return false;
      }
      if (filtroEstado !== "TODOS" && it.estado !== filtroEstado) {
        return false;
      }
      if (filtroTexto.trim()) {
        const q = filtroTexto.toLowerCase();
        const coincide =
          it.identificacion_norma.toLowerCase().includes(q) ||
          it.articulo.toLowerCase().includes(q) ||
          it.titulo.toLowerCase().includes(q) ||
          it.descripcion_exigencia.toLowerCase().includes(q) ||
          (it.responsable && it.responsable.toLowerCase().includes(q)) ||
          (it.evidencia_cumplimiento && it.evidencia_cumplimiento.toLowerCase().includes(q));
        if (!coincide) return false;
      }
      return true;
    });
  }, [items, filtroOrganismo, filtroEstado, filtroTexto]);

  return (
    <div className="space-y-6">
      {/* Header del Módulo */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
              Automatización de Matriz Legal SST
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              D.S. N° 594 • Ley N° 16.744 • D.S. N° 44 • Ley Karin N° 21.643
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Matriz Legal por Rubro & Auditoría de Brechas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Genera en 1 segundo la matriz normativa personalizada de tu empresa según actividad económica y faena.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalGenerarOpen(true)}
            type="button"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-md text-xs sm:text-sm transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Generar Nueva Matriz</span>
          </button>

          {matrizActual && (
            <button
              onClick={() => setModalImprimirOpen(true)}
              type="button"
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Informe Oficial (DT)</span>
            </button>
          )}
        </div>
      </div>

      {/* Selector de Empresa y Versión de Matriz */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Empresa Evaluada:
          </label>
          <select
            value={selectedEmpresaId || ""}
            onChange={(e) => setSelectedEmpresaId(Number(e.target.value))}
            className="w-full sm:w-72 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social} ({emp.rut})
              </option>
            ))}
          </select>
        </div>

        {matrices.length > 1 && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-slate-500 font-medium">Versión:</span>
            <select
              value={matrizActual?.id || ""}
              onChange={(e) => cargarDetalleMatriz(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
            >
              {matrices.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.rubro_principal_display} ({new Date(m.fecha_actualizacion).toLocaleDateString("es-CL")})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Contenido Principal */}
      {loading || loadingMatriz ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Cargando matriz legal y requisitos normativos...
          </p>
        </div>
      ) : !matrizActual ? (
        /* Estado Vacío: La empresa no tiene matriz aún */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 mx-auto flex items-center justify-center mb-5">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Esta empresa aún no cuenta con una Matriz Legal
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
            Genera automáticamente la matriz con todas las exigencias legales chilenas obligatorias (D.S. 594, Ley 16.744, D.S. 44 y Ley Karin) adaptadas al rubro de la empresa.
          </p>
          <button
            onClick={() => setModalGenerarOpen(true)}
            type="button"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl shadow-md text-sm transition-all transform hover:scale-105 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Generar Matriz Legal en 1 Segundo</span>
          </button>
        </div>
      ) : (
        /* Vista con Matriz Generada */
        <div className="space-y-6">
          {/* 4 TARJETAS KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Porcentaje y Semáforo */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Nivel de Cumplimiento
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {matrizActual.porcentaje_cumplimiento}%
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      matrizActual.estado_semaforo === "OPTIMO"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : matrizActual.estado_semaforo === "REGULAR"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {matrizActual.estado_semaforo}
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    matrizActual.estado_semaforo === "OPTIMO"
                      ? "bg-emerald-500"
                      : matrizActual.estado_semaforo === "REGULAR"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${matrizActual.porcentaje_cumplimiento}%` }}
                />
              </div>
            </div>

            {/* KPI 2: Requisitos Cumplidos */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Requisitos Cumplidos
                </span>
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {matrizActual.cumplidos}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  de {matrizActual.total_requisitos} exigencias
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* KPI 3: En Proceso */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  En Implementación
                </span>
                <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
                  {matrizActual.en_proceso}
                </span>
                <span className="text-xs text-slate-400 block mt-1">Con plazos o compras</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* KPI 4: Brechas Críticas */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider block mb-1">
                  Brechas Críticas (No Cumple)
                </span>
                <span className="text-3xl font-black text-red-600 dark:text-red-400">
                  {matrizActual.brechas_criticas}
                </span>
                <span className="text-xs text-red-500 block mt-1 font-medium">
                  Riesgo multas DT / Seremi
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          {/* BARRA DE FILTROS */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-3">
            {/* Buscador */}
            <div className="relative flex-grow w-full md:w-auto">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por norma, artículo, exigencia o responsable..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Filtro Organismo */}
            <div className="w-full md:w-48">
              <select
                value={filtroOrganismo}
                onChange={(e) => setFiltroOrganismo(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="TODOS">Todos los Organismos</option>
                {Object.entries(ORGANISMOS_CONFIG).map(([key, conf]) => (
                  <option key={key} value={key}>
                    {conf.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Estado */}
            <div className="w-full md:w-44">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="CUMPLE">Cumple Totalmente</option>
                <option value="EN_PROCESO">En Proceso</option>
                <option value="NO_CUMPLE">Brecha Crítica (No Cumple)</option>
                <option value="NO_APLICA">No Aplica</option>
              </select>
            </div>
          </div>

          {/* TABLA INTERACTIVA DE REQUISITOS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4 w-32">Organismo</th>
                    <th className="p-4 w-44">Norma & Artículo</th>
                    <th className="p-4">Materia / Exigencia Obligatoria</th>
                    <th className="p-4 w-40">Estado de Cumplimiento</th>
                    <th className="p-4 w-48">Evidencia / Responsable</th>
                    <th className="p-4 w-24 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {itemsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No se encontraron requisitos que coincidan con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    itemsFiltrados.map((it) => {
                      const orgConf = ORGANISMOS_CONFIG[it.organismo] || {
                        label: it.organismo,
                        badge: "bg-slate-100 text-slate-700",
                      };
                      const estConf = ESTADO_CONFIG[it.estado] || ESTADO_CONFIG.EN_PROCESO;

                      return (
                        <tr
                          key={it.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-4">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${orgConf.badge}`}>
                              {it.organismo}
                            </span>
                          </td>

                          <td className="p-4">
                            <strong className="text-slate-900 dark:text-white block font-bold text-xs">
                              {it.identificacion_norma}
                            </strong>
                            <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                              {it.articulo}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                              {it.titulo}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                              {it.descripcion_exigencia}
                            </p>
                            <span className="text-[10px] text-red-600 dark:text-red-400 block mt-1">
                              Sanción: {it.sancion_multa}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${estConf.badge}`}>
                              <span className={`w-2 h-2 rounded-full ${estConf.dot}`} />
                              <span>{estConf.label}</span>
                            </span>
                          </td>

                          <td className="p-4 text-[11px]">
                            {it.evidencia_cumplimiento ? (
                              <div className="text-slate-800 dark:text-slate-200 line-clamp-2">
                                <span className="font-semibold text-emerald-600">✓ </span>
                                {it.evidencia_cumplimiento}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Sin evidencia</span>
                            )}
                            {it.responsable && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Resp: {it.responsable}
                              </div>
                            )}
                          </td>

                          <td className="p-4 text-right">
                            <button
                              onClick={() => setItemEditar(it)}
                              type="button"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALES */}
      <ModalGenerarMatriz
        isOpen={modalGenerarOpen}
        onClose={() => setModalGenerarOpen(false)}
        empresas={empresas}
        selectedEmpresaId={selectedEmpresaId}
        onMatrizGenerada={handleMatrizGenerada}
      />

      <ModalEditarItem
        isOpen={!!itemEditar}
        onClose={() => setItemEditar(null)}
        item={itemEditar}
        onItemActualizado={handleItemActualizado}
      />

      <ModalImprimirMatriz
        isOpen={modalImprimirOpen}
        onClose={() => setModalImprimirOpen(false)}
        matriz={matrizActual}
        items={items}
      />
    </div>
  );
}
