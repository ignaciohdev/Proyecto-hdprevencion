"use client";

import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../utils/api";
import {
  EntregaEPP,
  EstadisticasEPP,
  EmpresaOption,
  CentroTrabajoOption,
  TrabajadorOption,
} from "./types";
import {
  ModalNuevaEntrega,
  ModalComprobanteImprimible,
} from "./components";

export default function EppRiohsPage() {
  // Datos Maestros
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [centrosTrabajo, setCentrosTrabajo] = useState<CentroTrabajoOption[]>([]);
  const [trabajadores, setTrabajadores] = useState<TrabajadorOption[]>([]);
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("TODAS");

  // Entregas y Estadísticas
  const [entregas, setEntregas] = useState<EntregaEPP[]>([]);
  const [stats, setStats] = useState<EstadisticasEPP | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroRiohs, setFiltroRiohs] = useState<string>("TODOS");

  // Modales
  const [isModalNuevaOpen, setIsModalNuevaOpen] = useState<boolean>(false);
  const [entregaSeleccionada, setEntregaSeleccionada] = useState<EntregaEPP | null>(null);

  // 1. Cargar Empresas, Centros y Trabajadores
  const cargarCatalogos = useCallback(async () => {
    try {
      const [resEmp, resCentros, resTrab] = await Promise.all([
        authFetch("/api/empresas/"),
        authFetch("/api/centros-trabajo/"),
        authFetch("/api/trabajadores/"),
      ]);

      if (resEmp.ok) {
        const data = await resEmp.json();
        setEmpresas(Array.isArray(data) ? data : data.results || []);
      }
      if (resCentros.ok) {
        const data = await resCentros.json();
        setCentrosTrabajo(Array.isArray(data) ? data : data.results || []);
      }
      if (resTrab.ok) {
        const data = await resTrab.json();
        setTrabajadores(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Error al cargar catálogos:", err);
    }
  }, []);

  // 2. Cargar Entregas y Estadísticas
  const cargarEntregasYStats = useCallback(async () => {
    try {
      setLoading(true);
      const queryEmpresa = empresaFiltro !== "TODAS" ? `?empresa=${empresaFiltro}` : "";

      const [resEntregas, resStats] = await Promise.all([
        authFetch(`/api/entregas-epp/${queryEmpresa}`),
        authFetch(`/api/entregas-epp/estadisticas/${queryEmpresa}`),
      ]);

      if (resEntregas.ok) {
        const data = await resEntregas.json();
        setEntregas(Array.isArray(data) ? data : data.results || []);
      }
      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }
    } catch (err) {
      console.error("Error al cargar entregas de EPP:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaFiltro]);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    cargarEntregasYStats();
  }, [cargarEntregasYStats]);

  const handleGuardarEntrega = async (data: Partial<EntregaEPP>) => {
    const res = await authFetch("/api/entregas-epp/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.empresa || err?.trabajador || "Error al registrar la entrega de EPP.");
    }

    const nuevaEntrega: EntregaEPP = await res.json();
    setEntregas((prev) => [nuevaEntrega, ...prev]);
    // Abrir comprobante para impresión si se desea
    setEntregaSeleccionada(nuevaEntrega);
    cargarEntregasYStats();
  };

  // Filtrado reactivo en cliente por búsqueda
  const entregasFiltradas = entregas.filter((e) => {
    if (filtroRiohs === "CON_RIOHS" && !e.entrega_riohs) return false;
    if (filtroRiohs === "SOLO_EPP" && e.entrega_riohs) return false;

    if (!busqueda.trim()) return true;
    const term = busqueda.toLowerCase();
    const nombre = (e.trabajador_nombre_completo || "").toLowerCase();
    const rut = (e.trabajador_rut || "").toLowerCase();
    const cargo = (e.trabajador_cargo || "").toLowerCase();
    const empresa = (e.empresa_nombre || "").toLowerCase();

    return (
      nombre.includes(term) ||
      rut.includes(term) ||
      cargo.includes(term) ||
      empresa.includes(term)
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black tracking-wider uppercase px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              Art. 68 Ley N° 16.744 • Art. 53 D.S. N° 594
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Firma Digitalizada en Pantalla
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            Entrega de EPP y Reglamento Interno (RIOHS)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Registro auditable de entrega de equipos de protección, entrega de RIOHS y constancia de capacitación ante la Dirección del Trabajo.
          </p>
        </div>

        <button
          onClick={() => setIsModalNuevaOpen(true)}
          className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black transition-all shadow-md hover:shadow-orange-500/20 flex items-center justify-center space-x-2 flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Nueva Entrega con Firma en Pantalla</span>
        </button>
      </div>

      {/* 2. TARJETAS MÉTRICAS SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Métrica 1: Entregas del Mes */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Entregas Realizadas ({new Date().toLocaleString("es-CL", { month: "long" })})
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {stats ? stats.entregas_mes : 0}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  firmadas en terreno
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Total histórico acumulado:</span>
            <strong className="text-slate-800 dark:text-slate-200">
              {stats ? stats.total_entregas_historico : 0} entregas
            </strong>
          </div>
        </div>

        {/* Métrica 2: Cobertura de RIOHS Firmado */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Cobertura RIOHS (Código del Trabajo)
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {stats ? stats.trabajadores_con_riohs : 0}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  de {stats ? stats.total_trabajadores : 0} trabajadores
                </span>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                stats && stats.trabajadores_pendientes_riohs === 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              }`}
            >
              {stats && stats.trabajadores_pendientes_riohs === 0
                ? "100% Al Día"
                : `${stats ? stats.trabajadores_pendientes_riohs : 0} Pendientes`}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span>Tasa de Recepción de RIOHS</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {stats ? stats.porcentaje_cumplimiento_riohs : 0}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${stats ? stats.porcentaje_cumplimiento_riohs : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Métrica 3: Total de Equipos Entregados */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Elementos EPP Suministrados
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {stats ? stats.total_items_epp_entregados : 0}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  equipos entregados
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Cumplimiento Legal:</span>
            <strong className="text-emerald-600 dark:text-emerald-400">
              Art. 68 Ley 16.744 (Gratuito)
            </strong>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Buscador */}
        <div className="relative flex-1">
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por trabajador, RUT, cargo o faena..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Filtro Empresa */}
        {empresas.length > 1 && (
          <select
            value={empresaFiltro}
            onChange={(e) => setEmpresaFiltro(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            <option value="TODAS">Todas las Empresas</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social}
              </option>
            ))}
          </select>
        )}

        {/* Filtro RIOHS */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setFiltroRiohs("TODOS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filtroRiohs === "TODOS"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltroRiohs("CON_RIOHS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filtroRiohs === "CON_RIOHS"
                ? "bg-orange-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Con RIOHS
          </button>
          <button
            onClick={() => setFiltroRiohs("SOLO_EPP")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filtroRiohs === "SOLO_EPP"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Solo EPP
          </button>
        </div>
      </div>

      {/* 4. TABLA DE HISTORIAL DE ENTREGAS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold">Cargando registros de entrega...</p>
          </div>
        ) : entregasFiltradas.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No hay entregas registradas
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Realice la primera entrega de EPP en terreno con firma digital en pantalla para generar el comprobante legal.
            </p>
            <button
              onClick={() => setIsModalNuevaOpen(true)}
              className="mt-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-2"
            >
              <span>+ Registrar Primera Entrega</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-extrabold tracking-wider">
                <tr>
                  <th className="p-4 w-20">Folio</th>
                  <th className="p-4">Trabajador Receptor</th>
                  <th className="p-4">Empresa / Faena</th>
                  <th className="p-4">Equipos Entregados</th>
                  <th className="p-4 text-center">RIOHS Entregado</th>
                  <th className="p-4 text-center">Firma Digital</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {entregasFiltradas.map((entrega) => {
                  const fecha = new Date(entrega.fecha_hora_entrega).toLocaleDateString(
                    "es-CL",
                    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
                  );

                  return (
                    <tr
                      key={entrega.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Folio y Fecha */}
                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div>#{entrega.id}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{fecha}</div>
                      </td>

                      {/* Trabajador */}
                      <td className="p-4">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {entrega.trabajador_nombre_completo ||
                            `${entrega.trabajador_nombres} ${entrega.trabajador_apellidos}`}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          RUT: {entrega.trabajador_rut} • {entrega.trabajador_cargo || "Operador"}
                        </div>
                      </td>

                      {/* Empresa / Faena */}
                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {entrega.empresa_nombre}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {entrega.centro_trabajo_nombre || "Casa Matriz"}
                        </div>
                      </td>

                      {/* Equipos */}
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {entrega.items_epp &&
                            entrega.items_epp.map((item, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              >
                                {item.tipo.split(" ")[0]} ({item.cantidad})
                              </span>
                            ))}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {entrega.total_items || 0} unidades en total
                        </span>
                      </td>

                      {/* RIOHS */}
                      <td className="p-4 text-center">
                        {entrega.entrega_riohs ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ✓ Entregado {entrega.version_riohs ? `(${entrega.version_riohs})` : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                            Solo EPP
                          </span>
                        )}
                      </td>

                      {/* Firma */}
                      <td className="p-4 text-center">
                        {entrega.firma_digital ? (
                          <div className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            <span>✓ Firmada</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Sin firma</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setEntregaSeleccionada(entrega)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          <span>Ver / DT</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODALES */}
      <ModalNuevaEntrega
        isOpen={isModalNuevaOpen}
        onClose={() => setIsModalNuevaOpen(false)}
        empresas={empresas}
        centrosTrabajo={centrosTrabajo}
        trabajadores={trabajadores}
        empresaSeleccionadaId={empresaFiltro !== "TODAS" ? Number(empresaFiltro) : undefined}
        onGuardarEntrega={handleGuardarEntrega}
      />

      <ModalComprobanteImprimible
        isOpen={Boolean(entregaSeleccionada)}
        onClose={() => setEntregaSeleccionada(null)}
        entrega={entregaSeleccionada}
      />
    </div>
  );
}
