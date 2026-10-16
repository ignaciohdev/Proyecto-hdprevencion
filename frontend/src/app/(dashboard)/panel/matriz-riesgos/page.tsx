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

  // Modo de evaluación en la tabla: "ambos", "puro" o "residual"
  const [modoEvaluacionTabla, setModoEvaluacionTabla] = useState<"ambos" | "puro" | "residual">("ambos");

  // Filtros de búsqueda en tabla
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroPeligro, setFiltroPeligro] = useState<string>("TODOS");
  const [filtroNivelResidual, setFiltroNivelResidual] = useState<string>("TODOS");
  const [filtroEstadoControl, setFiltroEstadoControl] = useState<string>("TODOS");

  // Paso interactivo del banner 1 a 5 (seleccionable)
  const [pasoExplicado, setPasoExplicado] = useState<number | null>(null);

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
        console.error("Error cargando matrices IPERC:", err);
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
  const handleItemGuardado = () => {
    if (matrizActual) {
      cargarDetalleMatriz(matrizActual.id);
    }
  };

  // Eliminar un ítem con confirmación
  const handleEliminarItem = async (itemId: number) => {
    if (!confirm("¿Está seguro de que desea eliminar este peligro de la matriz IPERC?")) {
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

  // Filtrado reactivo de ítems
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
          item.controles_existentes?.toLowerCase().includes(q) ||
          item.controles_requeridos?.toLowerCase().includes(q) ||
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

  // 5 Pasos Metodológicos IPERC
  const PASOS_IPERC = [
    {
      num: 1,
      titulo: "1. Identificar Peligros",
      icono: "🔎",
      sub: "Actividades, áreas, equipos, materiales y entorno operacional.",
      detalle: "Revisa procesos rutinarios, no rutinarios y emergencias. Identifica agentes físicos, químicos, biológicos, ergonómicos, psicosociales, mecánicos y climáticos (Enmienda ISO 2024 / D.S. N° 594).",
    },
    {
      num: 2,
      titulo: "2. Identificar Riesgos",
      icono: "⚠️",
      sub: "¿Qué puede suceder y cómo afecta a personas o procesos?",
      detalle: "Determina el evento no deseado y la consecuencia en la integridad física o salud. Aplica el filtro estricto de la Circular SUSESO N° 3336 (Accidentes Graves y Fatales) y trabajadores sensibles (Art. 11 D.S. N° 44).",
    },
    {
      num: 3,
      titulo: "3. Evaluar el Riesgo",
      icono: "📐",
      sub: "Asigna Probabilidad (1-5) y Consecuencia (1-5). Nivel = P × C.",
      detalle: "Obtén la magnitud pura según la escala técnica del ISP: Crítico (17-25), Alto (10-16), Medio (5-9) o Bajo (1-4). Define el nivel de intolerabilidad previo a aplicar nuevas mitigaciones.",
    },
    {
      num: 4,
      titulo: "4. Controles Existentes",
      icono: "🛡️",
      sub: "Identifica medidas ya implementadas y operativas en faena.",
      detalle: "Registra qué protecciones colectivas, procedimientos o EPP se están utilizando actualmente en terreno para ponderar su eficacia real (ISO 45001 Cláusula 6.1.2.2).",
    },
    {
      num: 5,
      titulo: "5. Controles Requeridos",
      icono: "🎯",
      sub: "Acciones adicionales según jerarquía legal y reevalúa residual.",
      detalle: "Aplica la jerarquía de 5 niveles (Eliminación, Sustitución, Ingeniería, Administrativo, EPP ISP). Calcula el riesgo residual resultante ($P_r \\times C_r$) y asigna responsable y plazo.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO Y ACCIONES PRINCIPALES */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Metodología IPERC • D.S. N° 44 • ISO 45001:2018
            </span>
            <span className="text-xs text-slate-400">
              Identificación de Peligros, Evaluación y Control de Riesgos
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
            Matriz de Riesgos IPERC (Gestión Integral SST)
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Flujo guiado de 5 pasos, mapa de calor 5x5 ISP y jerarquía de mitigación legal chilena.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setModalCrearOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>➕</span>
            <span>Nueva Matriz IPERC</span>
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
                <span>Identificar Peligro (5 Pasos)</span>
              </button>

              <button
                type="button"
                onClick={() => setModalImprimirOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>🖨️</span>
                <span>Informe Técnico Imprimible</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. BANNER METODOLÓGICO SUPERIOR: LOS 5 PASOS IPERC */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 shadow-xl backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-black">
              IPERC
            </span>
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
              Metodología Práctica IPERC: 5 Pasos para Identificar, Evaluar y Controlar Riesgos
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Haz clic en cualquier paso para ver las directrices operativas
          </span>
        </div>

        {/* Stepper horizontal de 5 pasos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {PASOS_IPERC.map((paso) => {
            const isSelected = pasoExplicado === paso.num;
            return (
              <button
                key={paso.num}
                type="button"
                onClick={() => setPasoExplicado(isSelected ? null : paso.num)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-orange-500/15 border-orange-500 text-white shadow-md shadow-orange-500/10 ring-1 ring-orange-500/50"
                    : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-950"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">{paso.icono}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-orange-400 font-bold">
                      Paso {paso.num}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white leading-tight">
                    {paso.titulo.replace(/^\d+\.\s*/, "")}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {paso.sub}
                  </div>
                </div>
                <div className="text-[10px] text-orange-400 font-semibold mt-2 flex items-center justify-between">
                  <span>{isSelected ? "▲ Ocultar" : "▼ Directriz"}</span>
                  <span className="text-slate-500 text-[9px]">ISP / D.S. 44</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detalle expandible del paso seleccionado */}
        {pasoExplicado !== null && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-orange-500/30 text-xs space-y-1 animate-fadeIn">
            <div className="flex items-center justify-between">
              <strong className="text-orange-400 font-bold">
                {PASOS_IPERC[pasoExplicado - 1].titulo} — Directriz Técnica Oficial
              </strong>
              <button
                type="button"
                onClick={() => setPasoExplicado(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {PASOS_IPERC[pasoExplicado - 1].detalle}
            </p>
          </div>
        )}
      </div>

      {/* 3. SELECTORES REACTIVOS DE EMPRESA Y MATRIZ */}
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

        {/* Selector de Matriz IPERC de la Empresa */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Matriz IPERC Activa
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
              <option value="">No hay matrices IPERC registradas para esta empresa</option>
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
              No hay Matrices IPERC creadas para esta empresa
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Crea tu primera Matriz IPERC para comenzar a registrar los peligros, evaluar los riesgos puros y jerarquizar los controles conforme al D.S. N° 44.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalCrearOpen(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <span>➕</span>
            <span>Crear Primera Matriz IPERC</span>
          </button>
        </div>
      ) : matrizActual ? (
        <>
          {/* 4. TARJETAS MÉTRICAS SUPERIORES */}
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

            {/* Tarjeta 2: Peligros Críticos */}
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
                {matrizActual.criticos_puros - matrizActual.criticos_residuales} críticos mitigados
              </div>
            </div>

            {/* Tarjeta 3: Reducción Global de Riesgo */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Eficacia de Mitigación</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-bold">
                  🛡️
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">
                  {matrizActual.porcentaje_reduccion_riesgo}%
                </span>
                <span className="text-xs text-slate-400">reducción global</span>
              </div>
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

          {/* 5. PESTAÑAS: PLANILLA INDUSTRIAL VS MATRIZ DE CALOR 5X5 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
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
                <span>Tabla de Aplicación Industrial IPERC ({items.length})</span>
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
                <span>Matriz de Calor 5x5 (P × C)</span>
              </button>
            </div>

            {/* Alternador de visualización para la tabla (Puro vs Residual vs Ambos) */}
            {tabActiva === "tabla" && (
              <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setModoEvaluacionTabla("ambos")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    modoEvaluacionTabla === "ambos"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Puro + Residual
                </button>
                <button
                  type="button"
                  onClick={() => setModoEvaluacionTabla("puro")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    modoEvaluacionTabla === "puro"
                      ? "bg-red-600/80 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sólo Puro
                </button>
                <button
                  type="button"
                  onClick={() => setModoEvaluacionTabla("residual")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    modoEvaluacionTabla === "residual"
                      ? "bg-emerald-600/80 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sólo Residual
                </button>
              </div>
            )}
          </div>

          {/* 6. CONTENIDO SEGÚN PESTAÑA */}
          {tabActiva === "calor" ? (
            <MatrizCalorWidget data={calorData} loading={loadingCalor} />
          ) : (
            /* Vista de Tabla de Aplicación Industrial IPERC */
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Búsqueda rápida */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Búsqueda Rápida
                  </label>
                  <input
                    type="text"
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    placeholder="Peligro, tarea, control, responsable..."
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
                    <option value="TODOS">Todos los agentes</option>
                    <option value="SEGURIDAD">Seguridad / Mecánico</option>
                    <option value="FISICO">Físico (Ruido PREXOR, etc.)</option>
                    <option value="QUIMICO">Químico (Sílice PLANESI, etc.)</option>
                    <option value="BIOLOGICO">Biológico</option>
                    <option value="ERGONOMICO">Ergonómico (TMERT)</option>
                    <option value="PSICOSOCIAL">Psicosocial (Ley Karin)</option>
                    <option value="CLIMATICO">Climático (ISO 2024)</option>
                  </select>
                </div>

                {/* Filtro Riesgo Residual */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Nivel Residual
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
                    <option value="IMPLEMENTADO">Implementado y Verificado</option>
                    <option value="EN_PROCESO">En Proceso</option>
                    <option value="PENDIENTE">Pendiente</option>
                  </select>
                </div>
              </div>

              {/* Tabla de Aplicación Industrial IPERC */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 w-10 text-center">#</th>
                        <th className="py-3 px-3.5 min-w-[170px]">Actividad / Puesto</th>
                        <th className="py-3 px-3.5 min-w-[190px]">Peligro</th>
                        <th className="py-3 px-3.5 min-w-[200px]">Riesgo (qué puede pasar)</th>
                        {modoEvaluacionTabla !== "residual" && (
                          <th className="py-3 px-3 text-center min-w-[95px] bg-red-950/20">
                            Eval. Pura (P×C)
                          </th>
                        )}
                        <th className="py-3 px-3.5 min-w-[180px] bg-slate-950/40">
                          Paso 4: Controles Existentes
                        </th>
                        <th className="py-3 px-3.5 min-w-[220px]">
                          Paso 5: Controles Requeridos
                        </th>
                        {modoEvaluacionTabla !== "puro" && (
                          <th className="py-3 px-3 text-center min-w-[95px] bg-emerald-950/20">
                            Eval. Residual
                          </th>
                        )}
                        <th className="py-3 px-3.5 min-w-[140px]">Estado & Responsable</th>
                        <th className="py-3 px-3.5 text-right w-20">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {itemsFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-slate-500">
                            {items.length === 0
                              ? "No hay peligros agregados aún a esta matriz IPERC. Haz clic en 'Identificar Peligro (5 Pasos)'."
                              : "No se encontraron peligros con los filtros seleccionados."}
                          </td>
                        </tr>
                      ) : (
                        itemsFiltrados.map((item, idx) => (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-3 px-3.5 text-center font-mono text-slate-500">
                              {idx + 1}
                            </td>

                            {/* Columna 1: Actividad */}
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-white">{item.actividad}</div>
                              <div className="text-[11px] text-slate-400">{item.proceso}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {item.puesto_trabajo} • <span className="text-orange-400 font-semibold">{item.tipo_actividad}</span>
                              </div>
                            </td>

                            {/* Columna 2: Peligro */}
                            <td className="py-3 px-3.5">
                              <div className="font-medium text-slate-200">{item.peligro}</div>
                              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {item.clasificacion_peligro}
                              </span>
                            </td>

                            {/* Columna 3: Riesgo (qué puede pasar) */}
                            <td className="py-3 px-3.5">
                              <div className="text-slate-300">{item.riesgo_consecuencia}</div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.es_accidente_grave_fatal && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                                    ⚠️ Grave/Fatal (Circ. 3336)
                                  </span>
                                )}
                                {item.trabajador_sensible && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                    Art. 11 D.S. 44: {item.trabajador_sensible}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Columna 4: Evaluación Pura */}
                            {modoEvaluacionTabla !== "residual" && (
                              <td className="py-3 px-3 text-center bg-red-950/10">
                                <span
                                  className={`inline-flex flex-col items-center px-2 py-1 rounded-xl border ${getClasificacionColor(
                                    item.clasificacion_pura
                                  )}`}
                                >
                                  <span className="font-mono font-black text-xs">
                                    {item.magnitud_pura}
                                  </span>
                                  <span className="text-[8px] uppercase font-bold tracking-wider">
                                    {item.clasificacion_pura}
                                  </span>
                                  <span className="text-[8px] opacity-75 font-mono">
                                    {item.probabilidad_pura}×{item.severidad_pura}
                                  </span>
                                </span>
                              </td>
                            )}

                            {/* Columna 5: Controles Existentes (Paso 4) */}
                            <td className="py-3 px-3.5 bg-slate-950/30 text-[11px]">
                              {item.controles_existentes ? (
                                <p className="text-slate-300 leading-snug">
                                  {item.controles_existentes}
                                </p>
                              ) : (
                                <span className="text-slate-500 italic">Sin controles registrados</span>
                              )}
                            </td>

                            {/* Columna 6: Controles Requeridos (Paso 5) con Chips de Jerarquía */}
                            <td className="py-3 px-3.5 text-[11px]">
                              {item.controles_requeridos && (
                                <p className="text-white font-medium mb-1">
                                  {item.controles_requeridos}
                                </p>
                              )}
                              <div className="space-y-1 mt-1 text-[10px]">
                                {item.control_eliminacion && (
                                  <div className="text-red-400">
                                    <strong>Eliminación:</strong> {item.control_eliminacion}
                                  </div>
                                )}
                                {item.control_sustitucion && (
                                  <div className="text-orange-400">
                                    <strong>Sustitución:</strong> {item.control_sustitucion}
                                  </div>
                                )}
                                {item.control_ingenieria && (
                                  <div className="text-amber-400">
                                    <strong>Ingeniería:</strong> {item.control_ingenieria}
                                  </div>
                                )}
                                {item.control_administrativo && (
                                  <div className="text-cyan-400">
                                    <strong>Admin/PTS:</strong> {item.control_administrativo}
                                  </div>
                                )}
                                {item.control_epp && (
                                  <div className="text-blue-400">
                                    <strong>EPP ISP:</strong> {item.control_epp}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Columna 7: Evaluación Residual */}
                            {modoEvaluacionTabla !== "puro" && (
                              <td className="py-3 px-3 text-center bg-emerald-950/10">
                                <span
                                  className={`inline-flex flex-col items-center px-2 py-1 rounded-xl border ${getClasificacionColor(
                                    item.clasificacion_residual
                                  )}`}
                                >
                                  <span className="font-mono font-black text-xs">
                                    {item.magnitud_residual}
                                  </span>
                                  <span className="text-[8px] uppercase font-bold tracking-wider">
                                    {item.clasificacion_residual}
                                  </span>
                                  <span className="text-[8px] opacity-75 font-mono">
                                    {item.probabilidad_residual}×{item.severidad_residual}
                                  </span>
                                </span>
                              </td>
                            )}

                            {/* Columna 8: Estado & Responsable */}
                            <td className="py-3 px-3.5">
                              <div className="font-medium text-slate-200">
                                {item.responsable || "Sin asignar"}
                              </div>
                              {item.plazo_implementacion && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  Plazo: {item.plazo_implementacion}
                                </div>
                              )}
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

                            {/* Columna 9: Acciones */}
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemToEdit(item);
                                    setModalItemOpen(true);
                                  }}
                                  title="Editar peligro y controles IPERC"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEliminarItem(item.id)}
                                  title="Eliminar peligro de la matriz"
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

          {/* 7. WIDGET VISUAL: JERARQUÍA DE CONTROLES (5 NIVELES) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                  Prelación Legal Obligatoria (Arts. 9 y 12 D.S. N° 44 • ISO 45001 Cláusula 8.1.2)
                </span>
                <h3 className="text-base font-extrabold text-white mt-0.5">
                  Jerarquía de Controles de Mitigación (De más a menos efectivo)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Preferencia estricta por medidas de control en la fuente y protección colectiva
              </span>
            </div>

            {/* Pirámide / Escalera visual invertida de 5 niveles */}
            <div className="space-y-2">
              {[
                {
                  nivel: 1,
                  nombre: "1. Eliminación",
                  efectividad: "Más Efectivo",
                  colorBar: "bg-red-600",
                  colorBg: "bg-red-500/10 border-red-500/30 text-red-300",
                  desc: "Suprimir físicamente el peligro (diseño de procesos seguros, robotización, no realizar actividades de alto riesgo sin necesidad).",
                },
                {
                  nivel: 2,
                  nombre: "2. Sustitución",
                  efectividad: "Altamente Efectivo",
                  colorBar: "bg-orange-600",
                  colorBg: "bg-orange-500/10 border-orange-500/30 text-orange-300",
                  desc: "Reemplazar materiales, energías o equipos por otros de menor peligrosidad (ej. Solventes por soluciones acuosas, herramientas de bajo voltaje).",
                },
                {
                  nivel: 3,
                  nombre: "3. Controles de Ingeniería y Protección Colectiva",
                  efectividad: "Moderadamente Efectivo",
                  colorBar: "bg-amber-500",
                  colorBg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
                  desc: "Aislar a las personas del peligro mediante defensas físicas (barandas rígidas, entibación de zanjas, sistemas de extracción localizada, encerramientos acústicos).",
                },
                {
                  nivel: 4,
                  nombre: "4. Controles Administrativos y Procedimientos de Trabajo Seguro (PTS)",
                  efectividad: "Efectividad Dependiente del Factor Humano",
                  colorBar: "bg-cyan-600",
                  colorBg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
                  desc: "Reglamentar y capacitar sobre la forma de realizar el trabajo (PTS para máquinas peligrosas Art. 10 D.S. 44, permisos de trabajo en altura, señalética, rotación de personal ante calor o ruido).",
                },
                {
                  nivel: 5,
                  nombre: "5. Elementos de Protección Personal (EPP con Registro ISP)",
                  efectividad: "Menos Efectivo (Última Barrera)",
                  colorBar: "bg-blue-600",
                  colorBg: "bg-blue-500/10 border-blue-500/30 text-blue-300",
                  desc: "Protección individual ante el riesgo residual no mitigado en la fuente. Obligatoriedad de certificación ISP y capacitación formal registrada (Art. 13 D.S. N° 44).",
                },
              ].map((item) => (
                <div
                  key={item.nivel}
                  className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all ${item.colorBg}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${item.colorBar}`}></span>
                    <div>
                      <div className="font-extrabold text-white text-xs">{item.nombre}</div>
                      <p className="text-[11px] opacity-90 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 px-2 py-1 rounded bg-slate-900/50">
                    {item.efectividad}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 8. SECCIÓN: BUENAS PRÁCTICAS PARA UNA IPERC EFECTIVA */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="border-b border-slate-800/80 pb-3">
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                Pilares Operativos en Terreno
              </span>
              <h3 className="text-base font-extrabold text-white mt-0.5">
                Buenas Prácticas para una IPERC Efectiva
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tarjeta 1: Revisión Periódica */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-2xl">🔄</div>
                <h4 className="text-xs font-bold text-white">Revisión Periódica y Dinámica</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Actualización obligatoria anual, ante accidentes graves/fatales o cada vez que ocurran modificaciones en procesos, maquinarias o condiciones ambientales (Art. 7 D.S. N° 44).
                </p>
              </div>

              {/* Tarjeta 2: Participación de Trabajadores */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-2xl">👥</div>
                <h4 className="text-xs font-bold text-white">Participación y Visado CPHS</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Consulta activa y validación técnica con los representantes del Comité Paritario de Higiene y Seguridad y trabajadores expuestos (Art. 66 Ley 16.744 e ISO 45001 Cl. 5.4).
                </p>
              </div>

              {/* Tarjeta 3: Datos Reales de Terreno */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-2xl">🔍</div>
                <h4 className="text-xs font-bold text-white">Datos Reales de Terreno</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Levantamiento de peligros in situ mediante inspecciones operativas y entrevistas a las cuadrillas de faena, evitando matrices genéricas de escritorio.
                </p>
              </div>

              {/* Tarjeta 4: Seguimiento de Eficacia */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-2xl">📈</div>
                <h4 className="text-xs font-bold text-white">Seguimiento de Eficacia</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Auditoría continua de cumplimiento de los controles implementados para garantizar que el riesgo residual permanezca efectivamente en niveles tolerables.
                </p>
              </div>
            </div>
          </div>

          {/* 9. PIE DE PÁGINA NORMATIVO OFICIAL CHILENO */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-slate-300">Marco Normativo Oficial:</span>
              <span className="text-[11px] text-slate-400">
                ISO 45001:2018 (Cláusula 6.1.2) • D.S. N° 44 (MINTRAB) • D.S. N° 594 (MINSAL) • Ley N° 16.744 • Circular SUSESO N° 3336 • Guía Técnica ISP
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              HDPrevención SST SaaS • Sistema Conforme a Legislación Chilena
            </div>
          </div>
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

      {/* MODAL ITEM IPERC (CREAR / EDITAR) */}
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
