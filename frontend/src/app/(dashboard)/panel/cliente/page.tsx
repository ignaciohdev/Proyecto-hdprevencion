"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../../utils/api";

interface RiskStats {
  total: number;
  abiertos: number;
  proceso: number;
  resueltos: number;
  bajo: number;
  medio: number;
  alto: number;
  acto: number;
  condicion: number;
}

interface InspectionHist {
  id: number;
  plantilla_nombre: string;
  fecha: string;
  porcentaje: number;
  inspector: string;
}

interface InspectionStats {
  total: number;
  promedio_cumplimiento: number;
  historial: InspectionHist[];
}

interface AccidentHist {
  id: number;
  nombre_afectado: string;
  tipo_evento: "TRABAJO" | "TRAYECTO" | "INCIDENTE";
  fecha: string;
  lugar: string;
  lesion: string;
}

interface AccidentStats {
  total: number;
  trabajo: number;
  trayecto: number;
  incidente: number;
  historial: AccidentHist[];
}

interface DownloadStats {
  utilizadas: number;
  limite: number;
  plan_nombre: string;
}

interface CapacitacionHist {
  id: number;
  tema_titulo: string;
  estado: "PROGRAMADA" | "REALIZADA" | "CANCELADA";
  fecha_programada: string;
  lugar: string;
  asistentes_count: number;
}

interface CapacitacionStats {
  total: number;
  realizadas: number;
  programadas: number;
  asistentes_alcanzados: number;
  cumplimiento_pac: number;
  historial: CapacitacionHist[];
}

interface DashboardData {
  riesgos: RiskStats;
  inspecciones: InspectionStats;
  accidentes: AccidentStats;
  descargas: DownloadStats;
  capacitaciones: CapacitacionStats;
}

export default function ClientePanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  // Estados interactivos para los gráficos SVG (Tooltips)
  const [hoveredGravedad, setHoveredGravedad] = useState<string | null>(null);
  const [hoveredBarra, setHoveredBarra] = useState<string | null>(null);
  const [hoveredPunto, setHoveredPunto] = useState<number | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const res = await fetch(getApiUrl("/api/dashboard/stats/"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Error al obtener los indicadores de analítica.");
      const stats = await res.json();
      setData(stats);
    } catch (err: any) {
      setError(err.message || "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        setUsername(payload.username || "");
      } catch (e) {}
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Cargando dashboard analítico...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border border-red-200 p-4 rounded-xl text-sm text-center font-semibold max-w-xl mx-auto">
        {error || "Expediente no encontrado."}
      </div>
    );
  }

  // --- CÁLCULOS PARA GRÁFICOS SVG ---
  
  // 1. Donut Chart (Gravedad de Riesgos: Bajo, Medio, Alto)
  const rTotal = data.riesgos.bajo + data.riesgos.medio + data.riesgos.alto;
  const pctBajo = rTotal > 0 ? (data.riesgos.bajo / rTotal) * 100 : 0;
  const pctMedio = rTotal > 0 ? (data.riesgos.medio / rTotal) * 100 : 0;
  const pctAlto = rTotal > 0 ? (data.riesgos.alto / rTotal) * 100 : 0;

  // Parámetros de círculos para Donut (circunferencia = 2 * PI * r = 251.32 para r=40)
  const radius = 40;
  const circ = 2 * Math.PI * radius; // 251.32
  
  const strokeBajo = (pctBajo / 100) * circ;
  const strokeMedio = (pctMedio / 100) * circ;
  const strokeAlto = (pctAlto / 100) * circ;

  const offsetBajo = 0;
  const offsetMedio = strokeBajo;
  const offsetAlto = strokeBajo + strokeMedio;

  // 2. Bar Chart (Tipos de Accidentes: Trabajo, Trayecto, Incidente)
  const maxAccidentes = Math.max(data.accidentes.trabajo, data.accidentes.trayecto, data.accidentes.incidente, 1);
  const hMax = 120; // Altura máxima en px
  
  const barTrabajo = (data.accidentes.trabajo / maxAccidentes) * hMax;
  const barTrayecto = (data.accidentes.trayecto / maxAccidentes) * hMax;
  const barIncidente = (data.accidentes.incidente / maxAccidentes) * hMax;

  // 3. Line Chart (Tendencia de Inspecciones)
  // Invertimos el historial para mostrarlo cronológicamente (antiguo a reciente)
  const historialOrdenado = [...data.inspecciones.historial].reverse();
  const widthLine = 340;
  const heightLine = 120;
  
  const getPointsString = () => {
    if (historialOrdenado.length === 0) return "";
    const xStep = widthLine / Math.max(historialOrdenado.length - 1, 1);
    return historialOrdenado
      .map((item, idx) => {
        const x = idx * xStep;
        // El origen de coordenadas en SVG empieza en la esquina superior izquierda
        const y = heightLine - (item.porcentaje / 100) * heightLine;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const pointsStr = getPointsString();

  const getAreaPointsString = () => {
    if (historialOrdenado.length === 0) return "";
    const xStep = widthLine / Math.max(historialOrdenado.length - 1, 1);
    const points = historialOrdenado.map((item, idx) => {
      const x = idx * xStep;
      const y = heightLine - (item.porcentaje / 100) * heightLine;
      return `${x},${y}`;
    });
    // Cerramos el polígono al fondo del gráfico
    const startX = 0;
    const startY = heightLine;
    const endX = (historialOrdenado.length - 1) * xStep;
    const endY = heightLine;
    return `${startX},${startY} ${points.join(" ")} ${endX},${endY}`;
  };

  const areaPointsStr = getAreaPointsString();

  return (
    <div className="space-y-6">
      
      {/* Banner de Bienvenida */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-850 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight">
            ¡Hola, <span className="text-orange-500">{username || "Cliente"}</span>!
          </h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            Bienvenido al Dashboard Analítico de HD Prevención. Revisa de un vistazo la siniestralidad, efectividad de auditorías en terreno y hallazgos registrados.
          </p>
        </div>
      </div>

      {/* Grid de Tarjetas de Indicadores Clave (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* KPI 1: Accidentes */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between transition-all transform hover:scale-[1.02] hover:shadow-md">
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">Accidentabilidad</span>
            <h3 className={`text-3xl font-black mt-2 ${data.accidentes.total > 0 ? "text-red-500" : "text-slate-800 dark:text-white"}`}>
              {data.accidentes.total} Casos
            </h3>
            <p className="text-xs text-slate-450 mt-1">Siniestros totales registrados</p>
          </div>
          <div className={`text-3xl p-3 rounded-2xl ${data.accidentes.total > 0 ? "bg-red-50 dark:bg-red-950/20 text-red-500" : "bg-slate-50 dark:bg-slate-900/60 text-slate-400"}`}>
            🤕
          </div>
        </div>

        {/* KPI 2: Cumplimiento de Inspecciones */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between transition-all transform hover:scale-[1.02] hover:shadow-md">
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">Cumplimiento Promedio</span>
            <h3 className={`text-3xl font-black mt-2 ${
              data.inspecciones.promedio_cumplimiento >= 85 ? "text-emerald-500" : data.inspecciones.promedio_cumplimiento >= 70 ? "text-amber-500" : "text-red-500"
            }`}>
              {data.inspecciones.promedio_cumplimiento}%
            </h3>
            <p className="text-xs text-slate-450 mt-1">Efectividad de inspecciones</p>
          </div>
          <div className={`text-3xl p-3 rounded-2xl ${
            data.inspecciones.promedio_cumplimiento >= 85 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500" : data.inspecciones.promedio_cumplimiento >= 70 ? "bg-amber-50 dark:bg-amber-950/20 text-amber-500" : "bg-red-50 dark:bg-red-950/20 text-red-500"
          }`}>
            📊
          </div>
        </div>

        {/* KPI 3: Riesgos Activos */}
        <div className="bg-white dark:bg-slate-955 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between transition-all transform hover:scale-[1.02] hover:shadow-md">
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">Peligros Activos</span>
            <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2">
              {data.riesgos.abiertos + data.riesgos.proceso}
            </h3>
            <p className="text-xs text-slate-450 mt-1 font-semibold">Riesgos abiertos/en proceso</p>
          </div>
          <div className="text-3xl bg-slate-50 dark:bg-slate-900/60 text-slate-400 p-3 rounded-2xl">
            ⚠️
          </div>
        </div>

        {/* KPI 4: Capacitaciones (PAC) */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between transition-all transform hover:scale-[1.02] hover:shadow-md">
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">Cumplimiento PAC</span>
            <h3 className={`text-3xl font-black mt-2 ${
              data.capacitaciones.cumplimiento_pac >= 85 ? "text-emerald-500" : data.capacitaciones.cumplimiento_pac >= 50 ? "text-amber-500" : "text-red-500"
            }`}>
              {data.capacitaciones.cumplimiento_pac}%
            </h3>
            <p className="text-xs text-slate-450 mt-1 font-semibold">Avance charlas del año</p>
          </div>
          <div className={`text-3xl p-3 rounded-2xl ${
            data.capacitaciones.cumplimiento_pac >= 85 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500" : data.capacitaciones.cumplimiento_pac >= 50 ? "bg-amber-50 dark:bg-amber-950/20 text-amber-500" : "bg-red-50 dark:bg-red-950/20 text-red-500"
          }`}>
            🎓
          </div>
        </div>

        {/* KPI 5: Descargas del Plan */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between transition-all transform hover:scale-[1.02] hover:shadow-md">
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">Cupo de Descargas</span>
            <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2">
              {data.descargas.limite > 10000 
                ? `${data.descargas.utilizadas} / ∞`
                : `${data.descargas.utilizadas} de ${data.descargas.limite}`}
            </h3>
            <p className="text-xs text-slate-450 mt-1 font-semibold">Consumido en la semana</p>
          </div>
          <div className="text-3xl bg-slate-50 dark:bg-slate-900/60 text-slate-400 p-3 rounded-2xl">
            💾
          </div>
        </div>

      </div>

      {/* SECCIÓN GRÁFICOS ANALÍTICOS (SVG nativos interactivos) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO 1: Donut (Riesgos por Gravedad) */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between relative">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Gravedad de Riesgos Reportados</h3>
            <p className="text-xs text-slate-400 mt-1">Distribución de hallazgos por severidad</p>
          </div>

          <div className="flex items-center justify-center py-6 relative">
            {rTotal === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400 italic">
                Sin datos de riesgos registrados.
              </div>
            ) : (
              <div className="relative w-44 h-44">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Círculo base gris */}
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="10" />

                  {/* Segmento Bajo (Verde) */}
                  {strokeBajo > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#10B981"
                      strokeWidth={hoveredGravedad === "bajo" ? "14" : "10"}
                      strokeDasharray={`${strokeBajo} ${circ - strokeBajo}`}
                      strokeDashoffset={-offsetBajo}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredGravedad("bajo")}
                      onMouseLeave={() => setHoveredGravedad(null)}
                    />
                  )}

                  {/* Segmento Medio (Naranja) */}
                  {strokeMedio > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#F59E0B"
                      strokeWidth={hoveredGravedad === "medio" ? "14" : "10"}
                      strokeDasharray={`${strokeMedio} ${circ - strokeMedio}`}
                      strokeDashoffset={-offsetMedio}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredGravedad("medio")}
                      onMouseLeave={() => setHoveredGravedad(null)}
                    />
                  )}

                  {/* Segmento Alto (Rojo) */}
                  {strokeAlto > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#EF4444"
                      strokeWidth={hoveredGravedad === "alto" ? "14" : "10"}
                      strokeDasharray={`${strokeAlto} ${circ - strokeAlto}`}
                      strokeDashoffset={-offsetAlto}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredGravedad("alto")}
                      onMouseLeave={() => setHoveredGravedad(null)}
                    />
                  )}
                </svg>

                {/* Texto central interactivo */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  {hoveredGravedad ? (
                    <>
                      <span className="text-xs font-bold text-slate-500 uppercase">{hoveredGravedad}</span>
                      <span className="text-xl font-black text-slate-800 dark:text-white">
                        {hoveredGravedad === "bajo" ? data.riesgos.bajo : hoveredGravedad === "medio" ? data.riesgos.medio : data.riesgos.alto}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-450 uppercase">Riesgos</span>
                      <span className="text-2xl font-black text-slate-850 dark:text-white">{rTotal}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Leyenda */}
          {rTotal > 0 && (
            <div className="flex justify-around text-xs font-semibold pt-2 border-t border-slate-100 dark:border-slate-900">
              <span className="flex items-center space-x-1.5 cursor-default" onMouseEnter={() => setHoveredGravedad("bajo")} onMouseLeave={() => setHoveredGravedad(null)}>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Bajo ({data.riesgos.bajo})</span>
              </span>
              <span className="flex items-center space-x-1.5 cursor-default" onMouseEnter={() => setHoveredGravedad("medio")} onMouseLeave={() => setHoveredGravedad(null)}>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Medio ({data.riesgos.medio})</span>
              </span>
              <span className="flex items-center space-x-1.5 cursor-default" onMouseEnter={() => setHoveredGravedad("alto")} onMouseLeave={() => setHoveredGravedad(null)}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span>Alto ({data.riesgos.alto})</span>
              </span>
            </div>
          )}
        </div>

        {/* GRÁFICO 2: Barras (Tipos de Accidentes e Incidentes) */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Siniestralidad por Tipología</h3>
            <p className="text-xs text-slate-400 mt-1">Comparativa de accidentes e incidentes</p>
          </div>

          <div className="flex items-end justify-center py-6 h-48 relative">
            {data.accidentes.total === 0 ? (
              <div className="text-xs text-slate-450 italic">
                Sin accidentes registrados en el historial.
              </div>
            ) : (
              <div className="relative w-full max-w-[280px] h-[140px] flex justify-around items-end border-b border-slate-200 dark:border-slate-800">
                {/* Barra Trabajo (Rojo) */}
                <div className="flex flex-col items-center group relative w-12">
                  {hoveredBarra === "trabajo" && (
                    <div className="absolute -top-10 bg-slate-900 text-white text-[10px] py-1 px-2 rounded font-bold shadow z-20">
                      {data.accidentes.trabajo} Casos
                    </div>
                  )}
                  <div
                    className="w-10 bg-red-500 rounded-t-lg transition-all duration-300 cursor-pointer hover:bg-red-650"
                    style={{ height: `${barTrabajo}px` }}
                    onMouseEnter={() => setHoveredBarra("trabajo")}
                    onMouseLeave={() => setHoveredBarra(null)}
                  ></div>
                  <span className="text-[10px] text-slate-450 font-bold mt-2 truncate max-w-full">Trabajo</span>
                </div>

                {/* Barra Trayecto (Naranja) */}
                <div className="flex flex-col items-center group relative w-12">
                  {hoveredBarra === "trayecto" && (
                    <div className="absolute -top-10 bg-slate-900 text-white text-[10px] py-1 px-2 rounded font-bold shadow z-20">
                      {data.accidentes.trayecto} Casos
                    </div>
                  )}
                  <div
                    className="w-10 bg-amber-500 rounded-t-lg transition-all duration-300 cursor-pointer hover:bg-amber-600"
                    style={{ height: `${barTrayecto}px` }}
                    onMouseEnter={() => setHoveredBarra("trayecto")}
                    onMouseLeave={() => setHoveredBarra(null)}
                  ></div>
                  <span className="text-[10px] text-slate-450 font-bold mt-2 truncate max-w-full">Trayecto</span>
                </div>

                {/* Barra Incidente (Azul) */}
                <div className="flex flex-col items-center group relative w-12">
                  {hoveredBarra === "incidente" && (
                    <div className="absolute -top-10 bg-slate-900 text-white text-[10px] py-1 px-2 rounded font-bold shadow z-20">
                      {data.accidentes.incidente} Casos
                    </div>
                  )}
                  <div
                    className="w-10 bg-blue-500 rounded-t-lg transition-all duration-300 cursor-pointer hover:bg-blue-650"
                    style={{ height: `${barIncidente}px` }}
                    onMouseEnter={() => setHoveredBarra("incidente")}
                    onMouseLeave={() => setHoveredBarra(null)}
                  ></div>
                  <span className="text-[10px] text-slate-450 font-bold mt-2 truncate max-w-full">Incidente</span>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-center italic mt-2 border-t border-slate-100 dark:border-slate-900 pt-2">
            Tipos definidos bajo la circular legal de la SUSESO.
          </div>
        </div>

        {/* GRÁFICO 3: Línea de Tendencia (Evolución de Inspecciones) */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Tendencia de Cumplimiento</h3>
            <p className="text-xs text-slate-400 mt-1">Evolución de auditorías (Últimas 5 realizadas)</p>
          </div>

          <div className="flex items-center justify-center py-4 relative h-48">
            {historialOrdenado.length === 0 ? (
              <div className="text-xs text-slate-400 italic">
                Sin inspecciones suficientes para graficar.
              </div>
            ) : (
              <div className="w-full relative h-[120px]">
                <svg className="w-full h-full" viewBox={`0 0 ${widthLine} ${heightLine}`} preserveAspectRatio="none">
                  {/* Gradiente lineal para el relleno del área */}
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Líneas horizontales de guía */}
                  <line x1="0" y1="0" x2={widthLine} y2="0" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1={heightLine / 2} x2={widthLine} y2={heightLine / 2} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1={heightLine} x2={widthLine} y2={heightLine} stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1" />

                  {/* Relleno del área bajo la curva */}
                  {areaPointsStr && <polygon points={areaPointsStr} fill="url(#areaGrad)" />}

                  {/* Trazado de la Línea */}
                  {pointsStr && (
                    <polyline
                      fill="none"
                      stroke="#EA580C"
                      strokeWidth="3.5"
                      points={pointsStr}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Puntos interactivos */}
                  {historialOrdenado.map((item, idx) => {
                    const xStep = widthLine / Math.max(historialOrdenado.length - 1, 1);
                    const x = idx * xStep;
                    const y = heightLine - (item.porcentaje / 100) * heightLine;
                    return (
                      <g key={item.id} className="cursor-pointer group">
                        <circle
                          cx={x}
                          cy={y}
                          r={hoveredPunto === item.id ? "7" : "5"}
                          fill="#EA580C"
                          stroke="#FFFFFF"
                          strokeWidth="2.5"
                          className="transition-all duration-200"
                          onMouseEnter={() => setHoveredPunto(item.id)}
                          onMouseLeave={() => setHoveredPunto(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Tooltip flotante */}
                {hoveredPunto && (() => {
                  const activeItem = historialOrdenado.find((item) => item.id === hoveredPunto);
                  if (!activeItem) return null;
                  const idx = historialOrdenado.indexOf(activeItem);
                  const xStep = widthLine / Math.max(historialOrdenado.length - 1, 1);
                  const leftPos = (idx * xStep) / widthLine * 100;

                  return (
                    <div
                      className="absolute bg-slate-900 text-white p-2 rounded-xl text-[10px] z-30 shadow-lg border border-slate-800 flex flex-col font-bold min-w-32 transition-all duration-200 -top-8 pointer-events-none"
                      style={{
                        left: `${leftPos}%`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <span className="text-orange-500 truncate">{activeItem.plantilla_nombre}</span>
                      <span className="text-[11px] font-mono mt-0.5">{activeItem.porcentaje}% Cumplimiento</span>
                      <span className="text-[9px] text-slate-400 font-normal">{new Date(activeItem.fecha).toLocaleDateString()}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-center italic border-t border-slate-100 dark:border-slate-900 pt-2">
            La meta establecida de cumplimiento de auditorías es del 85%.
          </div>
        </div>

      </div>

      {/* SECCIÓN DOCUMENTOS RECIENTES Y ACTIVIDAD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Historial de Inspecciones */}
        <div className="bg-white dark:bg-slate-955 rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Últimas Auditorías Realizadas</h3>
            <a href="/panel/inspecciones" className="text-xs font-semibold text-orange-655 hover:underline">Ver todas →</a>
          </div>
          
          <div className="divide-y divide-slate-150 dark:divide-slate-850">
            {data.inspecciones.historial.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-450 italic">
                Aún no has registrado ninguna inspección.
              </div>
            ) : (
              data.inspecciones.historial.map((insp) => (
                <div key={insp.id} className="p-4 flex justify-between items-center hover:bg-slate-50/20 dark:hover:bg-slate-900/10 transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-850 dark:text-white">{insp.plantilla_nombre}</p>
                    <p className="text-[10px] text-slate-455">Inspector: {insp.inspector} | {new Date(insp.fecha).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full font-mono ${
                    insp.porcentaje >= 85 
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450" 
                      : insp.porcentaje >= 70 
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-450" 
                      : "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-450"
                  }`}>
                    {insp.porcentaje}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Historial de Accidentes */}
        <div className="bg-white dark:bg-slate-955 rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Últimos Casos Reportados</h3>
            <a href="/panel/accidentes" className="text-xs font-semibold text-orange-655 hover:underline">Ver todos →</a>
          </div>

          <div className="divide-y divide-slate-150 dark:divide-slate-850">
            {data.accidentes.historial.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-450 italic">
                No hay accidentes ni incidentes reportados recientemente.
              </div>
            ) : (
              data.accidentes.historial.map((acc) => (
                <div key={acc.id} className="p-4 flex justify-between items-center hover:bg-slate-50/20 dark:hover:bg-slate-900/10 transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-850 dark:text-white">{acc.nombre_afectado}</p>
                    <p className="text-[10px] text-slate-455">Lugar: {acc.lugar} | Lesión: {acc.lesion}</p>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase font-mono ${
                    acc.tipo_evento === "TRABAJO" 
                      ? "bg-red-100 text-red-750 dark:bg-red-950/20 dark:text-red-450 border-red-200" 
                      : acc.tipo_evento === "TRAYECTO" 
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450 border-amber-200" 
                      : "bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-450 border-blue-200"
                  }`}>
                    {acc.tipo_evento === "TRABAJO" ? "Trabajo" : acc.tipo_evento === "TRAYECTO" ? "Trayecto" : "Incidente"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Historial de Capacitaciones (PAC) */}
        <div className="bg-white dark:bg-slate-955 rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Capacitaciones Recientes</h3>
            <a href="/panel/capacitaciones" className="text-xs font-semibold text-orange-655 hover:underline">Ver todas →</a>
          </div>

          <div className="divide-y divide-slate-150 dark:divide-slate-850">
            {data.capacitaciones.historial.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-450 italic">
                No hay capacitaciones programadas ni ejecutadas.
              </div>
            ) : (
              data.capacitaciones.historial.map((cap) => (
                <div key={cap.id} className="p-4 flex justify-between items-center hover:bg-slate-50/20 dark:hover:bg-slate-900/10 transition-colors">
                  <div className="space-y-1 overflow-hidden mr-2">
                    <p className="text-xs font-bold text-slate-850 dark:text-white truncate">{cap.tema_titulo}</p>
                    <p className="text-[10px] text-slate-455 truncate">Lugar: {cap.lugar} | Fecha: {new Date(cap.fecha_programada + "T00:00:00").toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase font-mono shrink-0 ${
                    cap.estado === "REALIZADA" 
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450 border-emerald-250" 
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-450 border-amber-250"
                  }`}>
                    {cap.estado === "REALIZADA" ? `Realizada (${cap.asistentes_count})` : "Pendiente"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
