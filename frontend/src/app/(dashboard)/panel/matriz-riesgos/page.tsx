"use client";

import { useState, useEffect, useMemo } from "react";
import {
  MatrizRiesgoMiper,
  ItemMatrizRiesgo,
  EmpresaSimple,
  MatrizCalorData,
  ClasificacionPeligro,
  ClasificacionRiesgo,
  getClasificacionColor,
  getClasificacionSolidBg,
} from "./types";
import MatrizCalorWidget from "./MatrizCalorWidget";
import ModalCrearMatriz from "./ModalCrearMatriz";
import ModalItemMiper from "./ModalItemMiper";
import ModalImprimirMiper from "./ModalImprimirMiper";
import { getApiUrl, authFetch, parseJsonResponse } from "../../../utils/api";

export default function MatrizRiesgosPage() {
  const [empresas, setEmpresas] = useState<EmpresaSimple[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [matrices, setMatrices] = useState<MatrizRiesgoMiper[]>([]);
  const [matrizActual, setMatrizActual] = useState<MatrizRiesgoMiper | null>(null);
  const [items, setItems] = useState<ItemMatrizRiesgo[]>([]);
  const [calorData, setCalorData] = useState<MatrizCalorData | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMatriz, setLoadingMatriz] = useState(false);
  const [loadingCalor, setLoadingCalor] = useState(false);

  // Pestaña activa: "tabla" o "calor"
  const [tabActiva, setTabActiva] = useState<"tabla" | "calor">("tabla");

  // Filtros de búsqueda en tabla
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroPeligro, setFiltroPeligro] = useState<string>("TODOS");
  const [filtroNivelResidual, setFiltroNivelResidual] = useState<string>("TODOS");
  const [filtroEstadoControl, setFiltroEstadoControl] = useState<string>("TODOS");

  // Modales
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [modalItemOpen, setModalItemOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<ItemMatrizRiesgo | null>(null);
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

    const cargarMatrices = async () => {
      setLoadingMatriz(true);
      try {
        const res = await authFetch(
          getApiUrl(`/api/matrices-riesgo-miper/?empresa=${selectedEmpresaId}`)
        );
        if (res.ok) {
          const data = await parseJsonResponse<any>(res);
          const list: MatrizRiesgoMiper[] = Array.isArray(data) ? data : data.results || [];
          setMatrices(list);
          if (list.length > 0) {
            cargarDetalleMatriz(list[0].id);
          } else {
            setMatrizActual(null);
            setItems([]);
            setCalorData(null);
          }
        }
      } catch (err) {
        console.error("Error cargando matrices MIPER:", err);
      } finally {
        setLoadingMatriz(false);
      }
    };

    cargarMatrices();
  }, [selectedEmpresaId]);

  // Cargar detalle completo de la matriz seleccionada (incluyendo sus ítems)
  const cargarDetalleMatriz = async (matrizId: number) => {
    setLoadingMatriz(true);
    try {
      const res = await authFetch(getApiUrl(`/api/matrices-riesgo-miper/${matrizId}/`));
      if (res.ok) {
        const data = await parseJsonResponse<MatrizRiesgoMiper>(res);
        setMatrizActual(data);
        setItems(data.items || []);
        // Si la pestaña de calor está activa o se necesita, cargar heatmap
        cargarMatrizCalor(matrizId);
      }
    } catch (err) {
      console.error("Error cargando detalle de matriz:", err);
    } finally {
      setLoadingMatriz(false);
    }
  };

  // Cargar datos de la Matriz de Calor 5x5
  const cargarMatrizCalor = async (matrizId: number) => {
    setLoadingCalor(true);
    try {
      const res = await authFetch(
        getApiUrl(`/api/matrices-riesgo-miper/${matrizId}/matriz-calor/`)
      );
      if (res.ok) {
        const data = await parseJsonResponse<MatrizCalorData>(res);
        setCalorData(data);
      }
    } catch (err) {
      console.error("Error cargando mapa de calor 5x5:", err);
    } finally {
      setLoadingCalor(false);
    }
  };

  // Callback cuando se crea una nueva matriz
  const handleMatrizCreada = (nuevaMatriz: MatrizRiesgoMiper) => {
    setMatrices((prev) => [nuevaMatriz, ...prev]);
    cargarDetalleMatriz(nuevaMatriz.id);
  };

  // Callback cuando se guarda un ítem (crear o editar)
  const handleItemGuardado = (itemGuardado: ItemMatrizRiesgo, isEdit: boolean) => {
    if (matrizActual) {
      // Recargar la matriz para actualizar métricas globales calculadas
      cargarDetalleMatriz(matrizActual.id);
    }
  };

  // Eliminar un ítem con confirmación
  const handleEliminarItem = async (itemId: number) => {
    if (!confirm("¿Está seguro de que desea eliminar este peligro de la matriz MIPER?")) {
      return;
    }
    try {
      const res = await authFetch(getApiUrl(`/api/items-matriz-riesgo/${itemId}/`), {
        method: "DELETE",
      });
      if (res.ok && matrizActual) {
        cargarDetalleMatriz(matrizActual.id);
      }
    } catch (err) {
      console.error("Error eliminando ítem:", err);
      alert("No se pudo eliminar el ítem.");
    }
  };

  // Filtrado de ítems en cliente para reactividad instantánea
  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (filtroTexto.trim()) {
        const q = filtroTexto.toLowerCase();
        const match =
          item.proceso.toLowerCase().includes(q) ||
          item.actividad.toLowerCase().includes(q) ||
          item.puesto_trabajo.toLowerCase().includes(q) ||
          item.peligro.toLowerCase().includes(q) ||
          item.riesgo_consecuencia.toLowerCase().includes(q) ||
          item.responsable.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (filtroPeligro !== "TODOS" && item.clasificacion_peligro !== filtroPeligro) {
        return false;
      }

      if (filtroNivelResidual !== "TODOS" && item.clasificacion_residual !== filtroNivelResidual) {
        return false;
      }

      if (filtroEstadoControl !== "TODOS" && item.estado_control !== filtroEstadoControl) {
        return false;
      }

      return true;
    });
  }, [items, filtroTexto, filtroPeligro, filtroNivelResidual, filtroEstadoControl]);

  // Controles pendientes de implementación
  const controlesPendientes = useMemo(() => {
    return items.filter((it) => it.estado_control !== "IMPLEMENTADO").length;
  }, [items]);

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO Y SELECTORES */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Guía Técnica ISP • D.S. N° 44 • NCh-ISO 45001
            </span>
            <span className="text-xs text-slate-400">
              Matriz Interactiva de Peligros y Riesgos Residuales
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
            Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER)
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Evalúa riesgos puros, aplica la jerarquía técnica de controles del ISP y monitorea la mitigación en tiempo real.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setModalCrearOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕</span>
            <span>Nueva Matriz</span>
          </button>

          {matrizActual && (
            <>
              <button
                type="button"
                onClick={() => {
                  setItemToEdit(null);
                  setModalItemOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span>
                <span>Agregar Peligro</span>
              </button>

              <button
                type="button"
                onClick={() => setModalImprimirOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>🖨️</span>
                <span>Exportar Oficial (ISP)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. SELECTORES REACTIVOS DE EMPRESA Y MATRIZ */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Selector de Empresa */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Empresa Evaluada
          </label>
          <select
            value={selectedEmpresaId || ""}
            onChange={(e) => setSelectedEmpresaId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            disabled={loading}
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social} ({emp.rut})
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Matriz MIPER de la Empresa */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Matriz MIPER Activa
          </label>
          <select
            value={matrizActual?.id || ""}
            onChange={(e) => {
              if (e.target.value) {
                cargarDetalleMatriz(Number(e.target.value));
              }
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            disabled={matrices.length === 0 || loadingMatriz}
          >
            {matrices.length === 0 ? (
              <option value="">No hay matrices MIPER registradas</option>
            ) : (
              matrices.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} (v{m.version} - {m.estado_display || m.estado})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Estado vacío si no hay matrices */}
      {matrices.length === 0 && !loadingMatriz ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-400 text-3xl flex items-center justify-center mx-auto border border-orange-500/20">
            🛡️
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              No hay Matrices MIPER creadas para esta empresa
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Crea tu primera Matriz de Identificación de Peligros para comenzar a evaluar los riesgos puros y jerarquizar los controles del ISP según el D.S. N° 44.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalCrearOpen(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <span>➕</span>
            <span>Crear Primera Matriz MIPER</span>
          </button>
        </div>
      ) : matrizActual ? (
        <>
          {/* 3. LAS 4 TARJETAS MÉTRICAS SUPERIORES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tarjeta 1: Total Peligros */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Total Peligros</span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 text-sm font-bold">
                  📋
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {matrizActual.total_peligros}
                </span>
                <span className="text-xs text-slate-400">identificados</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2 truncate">
                Faena: {matrizActual.centro_trabajo_nombre || "General"}
              </div>
            </div>

            {/* Tarjeta 2: Peligros Críticos Mitigados */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Peligros Críticos</span>
                <span className="p-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold">
                  🔥
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-red-400">
                  {matrizActual.criticos_puros}
                </span>
                <span className="text-xs text-slate-400">puros →</span>
                <span className="text-2xl font-black text-emerald-400">
                  {matrizActual.criticos_residuales}
                </span>
                <span className="text-xs text-slate-400">residuales</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-2 font-medium">
                {matrizActual.criticos_puros - matrizActual.criticos_residuales} críticos controlados
              </div>
            </div>

            {/* Tarjeta 3: Reducción Global de Riesgo */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Reducción de Riesgo</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-bold">
                  🛡️
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">
                  {matrizActual.porcentaje_reduccion_riesgo}%
                </span>
                <span className="text-xs text-slate-400">promedio</span>
              </div>
              {/* Barra de progreso esmeralda */}
              <div className="w-full bg-slate-950 rounded-full h-2 mt-3 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, matrizActual.porcentaje_reduccion_riesgo))}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Tarjeta 4: Controles Pendientes */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Controles Pendientes</span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 text-sm font-bold">
                  ⏳
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">
                  {controlesPendientes}
                </span>
                <span className="text-xs text-slate-400">por implementar</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {items.length - controlesPendientes} controles 100% implementados
              </div>
            </div>
          </div>

          {/* 4. PESTAÑAS: PLANILLA VS MATRIZ DE CALOR 5X5 */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setTabActiva("tabla")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                tabActiva === "tabla"
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span>📊</span>
              <span>Planilla de Riesgos MIPER ({items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTabActiva("calor");
                if (matrizActual) cargarMatrizCalor(matrizActual.id);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                tabActiva === "calor"
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span>🔥</span>
              <span>Matriz de Calor 5x5 (ISP)</span>
            </button>
          </div>

          {/* 5. CONTENIDO SEGÚN PESTAÑA */}
          {tabActiva === "calor" ? (
            <MatrizCalorWidget data={calorData} loading={loadingCalor} />
          ) : (
            /* Vista de Planilla Interactiva */
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Búsqueda por texto */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Búsqueda Rápida
                  </label>
                  <input
                    type="text"
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    placeholder="Buscar peligro, actividad..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Filtro Clasificación Peligro */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Clasificación Peligro
                  </label>
                  <select
                    value={filtroPeligro}
                    onChange={(e) => setFiltroPeligro(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="TODOS">Todos los tipos</option>
                    <option value="SEGURIDAD">Seguridad</option>
                    <option value="FISICO">Físico</option>
                    <option value="QUIMICO">Químico</option>
                    <option value="BIOLOGICO">Biológico</option>
                    <option value="ERGONOMICO">Ergonómico</option>
                    <option value="PSICOSOCIAL">Psicosocial</option>
                  </select>
                </div>

                {/* Filtro Riesgo Residual */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Riesgo Residual
                  </label>
                  <select
                    value={filtroNivelResidual}
                    onChange={(e) => setFiltroNivelResidual(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="TODOS">Todos los niveles</option>
                    <option value="CRITICO">Crítico (17-25)</option>
                    <option value="ALTO">Alto (10-16)</option>
                    <option value="MEDIO">Medio (5-9)</option>
                    <option value="BAJO">Bajo (1-4)</option>
                  </select>
                </div>

                {/* Filtro Estado Control */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Estado del Control
                  </label>
                  <select
                    value={filtroEstadoControl}
                    onChange={(e) => setFiltroEstadoControl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="TODOS">Todos los estados</option>
                    <option value="IMPLEMENTADO">Implementado</option>
                    <option value="EN_PROCESO">En Proceso</option>
                    <option value="PENDIENTE">Pendiente</option>
                  </select>
                </div>
              </div>

              {/* Tabla de Peligros */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4 min-w-[160px]">Proceso / Actividad</th>
                        <th className="py-3 px-4 min-w-[200px]">Peligro / Riesgo</th>
                        <th className="py-3 px-4 text-center min-w-[100px]">Riesgo Puro</th>
                        <th className="py-3 px-4 min-w-[200px]">Controles Clave (ISP)</th>
                        <th className="py-3 px-4 text-center min-w-[100px]">Riesgo Residual</th>
                        <th className="py-3 px-4 min-w-[140px]">Responsable / Estado</th>
                        <th className="py-3 px-4 text-right w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {itemsFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            {items.length === 0
                              ? "No hay peligros agregados aún a esta matriz. Haz clic en 'Agregar Peligro'."
                              : "No se encontraron peligros con los filtros seleccionados."}
                          </td>
                        </tr>
                      ) : (
                        itemsFiltrados.map((item, idx) => (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-3 px-4 text-center font-mono text-slate-500">
                              {idx + 1}
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-bold text-white">{item.proceso}</div>
                              <div className="text-[11px] text-slate-400">{item.actividad}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {item.puesto_trabajo} • {item.tipo_actividad}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-200">{item.peligro}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                ↳ {item.riesgo_consecuencia}
                              </div>
                              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {item.clasificacion_peligro}
                              </span>
                            </td>

                            {/* Riesgo Puro */}
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex flex-col items-center px-2.5 py-1 rounded-xl border ${getClasificacionColor(
                                  item.clasificacion_pura
                                )}`}
                              >
                                <span className="font-mono font-bold text-xs">
                                  MR = {item.magnitud_pura}
                                </span>
                                <span className="text-[9px] uppercase font-bold tracking-wider">
                                  {item.clasificacion_pura} ({item.probabilidad_pura}×{item.severidad_pura})
                                </span>
                              </span>
                            </td>

                            {/* Jerarquía de Controles */}
                            <td className="py-3 px-4">
                              <div className="space-y-1 text-[11px]">
                                {item.control_ingenieria && (
                                  <div>
                                    <strong className="text-amber-400">Ingeniería:</strong>{" "}
                                    <span className="text-slate-300">{item.control_ingenieria}</span>
                                  </div>
                                )}
                                {item.control_administrativo && (
                                  <div>
                                    <strong className="text-blue-400">Admin:</strong>{" "}
                                    <span className="text-slate-300">{item.control_administrativo}</span>
                                  </div>
                                )}
                                {item.control_epp && (
                                  <div>
                                    <strong className="text-emerald-400">EPP:</strong>{" "}
                                    <span className="text-slate-300">{item.control_epp}</span>
                                  </div>
                                )}
                                {!item.control_ingenieria &&
                                  !item.control_administrativo &&
                                  !item.control_epp &&
                                  (item.control_eliminacion || item.control_sustitucion ? (
                                    <div className="text-emerald-400">
                                      Eliminación / Sustitución definida
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 italic">Sin controles registrados</span>
                                  ))}
                              </div>
                            </td>

                            {/* Riesgo Residual */}
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex flex-col items-center px-2.5 py-1 rounded-xl border ${getClasificacionColor(
                                  item.clasificacion_residual
                                )}`}
                              >
                                <span className="font-mono font-bold text-xs">
                                  MR = {item.magnitud_residual}
                                </span>
                                <span className="text-[9px] uppercase font-bold tracking-wider">
                                  {item.clasificacion_residual} ({item.probabilidad_residual}×{item.severidad_residual})
                                </span>
                              </span>
                            </td>

                            {/* Responsable & Estado */}
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-300">
                                {item.responsable || "Sin asignar"}
                              </div>
                              <span
                                className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.estado_control === "IMPLEMENTADO"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : item.estado_control === "EN_PROCESO"
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}
                              >
                                {item.estado_control === "IMPLEMENTADO"
                                  ? "Implementado"
                                  : item.estado_control === "EN_PROCESO"
                                  ? "En Proceso"
                                  : "Pendiente"}
                              </span>
                            </td>

                            {/* Acciones */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemToEdit(item);
                                    setModalItemOpen(true);
                                  }}
                                  title="Editar peligro y controles"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEliminarItem(item.id)}
                                  title="Eliminar de la matriz"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* MODAL CREAR MATRIZ */}
      <ModalCrearMatriz
        isOpen={modalCrearOpen}
        onClose={() => setModalCrearOpen(false)}
        empresas={empresas}
        initialEmpresaId={selectedEmpresaId}
        onMatrizCreada={handleMatrizCreada}
      />

      {/* MODAL ITEM MIPER (CREAR / EDITAR) */}
      {matrizActual && (
        <ModalItemMiper
          isOpen={modalItemOpen}
          onClose={() => {
            setModalItemOpen(false);
            setItemToEdit(null);
          }}
          matrizId={matrizActual.id}
          itemToEdit={itemToEdit}
          onItemGuardado={handleItemGuardado}
        />
      )}

      {/* MODAL IMPRIMIR OFICIAL */}
      {matrizActual && (
        <ModalImprimirMiper
          isOpen={modalImprimirOpen}
          onClose={() => setModalImprimirOpen(false)}
          matriz={matrizActual}
          items={items}
        />
      )}
    </div>
  );
}
