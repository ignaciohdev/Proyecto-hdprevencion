"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../../../utils/api";

interface TemaCapacitacion {
  id: number;
  titulo: string;
  categoria: string;
  duracion_minutos: number;
}

interface Asistente {
  nombre: string;
  rut: string;
  firma: string;
}

interface RegistroCapacitacion {
  id: number;
  tema_titulo: string;
  tema_detalle: TemaCapacitacion;
  estado: "PROGRAMADA" | "REALIZADA" | "CANCELADA";
  fecha_programada: string;
  fecha_realizacion: string | null;
  lugar: string;
  asistentes: Asistente[];
  observaciones: string | null;
  username: string;
}

export default function CapacitacionesPage() {
  const router = useRouter();
  const [capacitaciones, setCapacitaciones] = useState<RegistroCapacitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODOS");

  const fetchCapacitaciones = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(getApiUrl("/api/registro-capacitacion/"), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error("Error al obtener el plan de capacitaciones.");
      const data = await res.json();
      setCapacitaciones(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Error al cargar las capacitaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacitaciones();
  }, []);

  const getCategoriaLabel = (cat: string) => {
    switch (cat) {
      case "CHARLA_5_MIN":
        return "Charla de 5 Minutos";
      case "INDUCCION_ODI":
        return "Inducción ODI / DAS";
      case "CURSO_TEORICO":
        return "Capacitación Teórica";
      case "CURSO_PRACTICO":
        return "Capacitación Práctica";
      default:
        return cat;
    }
  };

  const getCategoriaBadgeColor = (cat: string) => {
    switch (cat) {
      case "CHARLA_5_MIN":
        return "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-450 border border-sky-100 dark:border-sky-900/40";
      case "INDUCCION_ODI":
        return "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-450 border border-purple-100 dark:border-purple-900/40";
      case "CURSO_TEORICO":
        return "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-450 border border-indigo-100 dark:border-indigo-900/40";
      case "CURSO_PRACTICO":
        return "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-450 border border-pink-100 dark:border-pink-900/40";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
    }
  };

  // Filtrado de capacitaciones
  const capacitacionesFiltradas = capacitaciones.filter((cap) => {
    const matchEstado = filtroEstado === "TODOS" || cap.estado === filtroEstado;
    const matchCategoria =
      filtroCategoria === "TODOS" ||
      (cap.tema_detalle && cap.tema_detalle.categoria === filtroCategoria);
    return matchEstado && matchCategoria;
  });

  // Métricas
  const total = capacitaciones.length;
  const realizadas = capacitaciones.filter((c) => c.estado === "REALIZADA").length;
  const pendientes = capacitaciones.filter((c) => c.estado === "PROGRAMADA").length;
  const totalAsistentes = capacitaciones.reduce((acc, c) => acc + (c.estado === "REALIZADA" ? c.asistentes.length : 0), 0);
  const cumplimientoPAC = total > 0 ? Math.round((realizadas / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
            Programa Anual de Capacitaciones (PAC)
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
            Gestión de Capacitaciones y Charlas
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            Programa, dicta y firma actas de capacitaciones de seguridad legalmente exigibles, y lleva el registro digital de firmas.
          </p>
        </div>
        <button
          onClick={() => router.push("/panel/capacitaciones/nueva")}
          className="mt-6 md:mt-0 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer flex items-center space-x-2 text-sm z-10"
        >
          <span>🗓️</span>
          <span>Programar Sesión</span>
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Cumplimiento del PAC</p>
          <p className="text-3xl font-extrabold text-orange-600 mt-1">{cumplimientoPAC}%</p>
          <span className="text-xs text-slate-400">Tasa de charlas ejecutadas</span>
        </div>
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Sesiones Ejecutadas</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-1">{realizadas} de {total}</p>
          <span className="text-xs text-slate-400">Charlas finalizadas con firmas</span>
        </div>
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Sesiones Pendientes</p>
          <p className="text-3xl font-extrabold text-amber-500 mt-1">{pendientes}</p>
          <span className="text-xs text-slate-400">Por dictar en terreno</span>
        </div>
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Trabajadores Alcanzados</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{totalAsistentes}</p>
          <span className="text-xs text-slate-400">Firmas de asistencia recopiladas</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todos</option>
              <option value="PROGRAMADA">Programadas (Pendientes)</option>
              <option value="REALIZADA">Realizadas (Finalizadas)</option>
              <option value="CANCELADA">Canceladas</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todas</option>
              <option value="CHARLA_5_MIN">Charla de 5 Minutos</option>
              <option value="INDUCCION_ODI">Inducción ODI / DAS</option>
              <option value="CURSO_TEORICO">Capacitación Teórica</option>
              <option value="CURSO_PRACTICO">Capacitación Práctica</option>
            </select>
          </div>
        </div>

        <span className="text-xs font-bold text-slate-500">
          Mostrando {capacitacionesFiltradas.length} sesiones
        </span>
      </div>

      {/* Listado / Cards */}
      {loading ? (
        <div className="flex justify-center items-center py-20 flex-col space-y-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-semibold">Cargando cronograma...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center">
          <p className="font-bold">Error al Cargar</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={fetchCapacitaciones} className="mt-4 bg-red-600 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-red-700">Reintentar</button>
        </div>
      ) : capacitacionesFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
          <span className="text-5xl mb-4">📢</span>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Sin Capacitaciones Planificadas</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            No tienes capacitaciones registradas que coincidan con los filtros seleccionados.
          </p>
          <button
            onClick={() => router.push("/panel/capacitaciones/nueva")}
            className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow transition-all cursor-pointer"
          >
            Programar mi primera charla
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {capacitacionesFiltradas.map((cap) => (
            <div
              key={cap.id}
              className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-2 flex-grow max-w-3xl">
                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      cap.estado === "REALIZADA"
                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/40"
                        : cap.estado === "PROGRAMADA"
                        ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 border border-amber-100 dark:border-amber-900/40"
                        : "bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-450 border border-red-100 dark:border-red-900/40"
                    }`}
                  >
                    {cap.estado === "REALIZADA"
                      ? "✔ Ejecutada / Realizada"
                      : cap.estado === "PROGRAMADA"
                      ? "⏳ Programada / Pendiente"
                      : "✖ Cancelada"}
                  </span>
                  
                  {cap.tema_detalle && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoriaBadgeColor(cap.tema_detalle.categoria)}`}>
                      {getCategoriaLabel(cap.tema_detalle.categoria)}
                    </span>
                  )}

                  {cap.tema_detalle && (
                    <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-mono">
                      ⏱️ {cap.tema_detalle.duracion_minutos} Min.
                    </span>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {cap.tema_titulo}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center space-x-1">
                    <span>📅</span>
                    <span>Prog: {new Date(cap.fecha_programada + "T00:00:00").toLocaleDateString()}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span>📍</span>
                    <span className="truncate">Lugar: {cap.lugar}</span>
                  </span>
                  {cap.estado === "REALIZADA" ? (
                    <span className="flex items-center space-x-1 font-semibold text-emerald-600 dark:text-emerald-450">
                      <span>👥</span>
                      <span>Asistieron: {cap.asistentes.length} trabajadores</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1">
                      <span>👤</span>
                      <span>Relator: {cap.username}</span>
                    </span>
                  )}
                </div>

                {cap.estado === "REALIZADA" && cap.observaciones && (
                  <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-900 mt-2 truncate">
                    Observación: {cap.observaciones}
                  </p>
                )}
              </div>

              <div className="shrink-0 flex space-x-2 w-full md:w-auto justify-end">
                {cap.estado === "PROGRAMADA" ? (
                  <button
                    onClick={() => router.push(`/panel/capacitaciones/${cap.id}`)}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow hover:scale-[1.02] transition-all cursor-pointer whitespace-nowrap"
                  >
                    Dictar Charla ✓
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/panel/capacitaciones/${cap.id}`)}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs border border-slate-200 dark:border-slate-800 cursor-pointer whitespace-nowrap flex items-center space-x-1"
                  >
                    <span>🖨️</span>
                    <span>Ver Acta</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
