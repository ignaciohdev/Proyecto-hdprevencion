"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getApiUrl } from "../../../utils/api";
import { ClimaUvWidget } from "../../../components/ClimaUvWidget";

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

interface CphsStats {
  tiene_comite: boolean;
  dias_restantes_mandato: number | null;
  en_periodo_eleccionario: boolean;
  sesiones_ordinarias_anio: number;
  meta_sesiones_anual: number;
  cumplimiento_sesiones_pct: number;
  sesiones_meses?: boolean[];
}

interface LeyKarinStats {
  total_activas: number;
  alertas_72h_criticas: number;
  alertas_5d_mutual: number;
}

interface EppHist {
  id: number;
  trabajador: string;
  rut: string;
  fecha: string;
  firmado: boolean;
  entrega_riohs: boolean;
  items_count: number;
}

interface EppRiohsStats {
  total_entregas: number;
  porcentaje_firmados: number;
  constancias_riohs_firmadas: number;
  historial?: EppHist[];
}

interface ContratistasStats {
  total_empresas: number;
  acreditadas_al_dia: number;
  porcentaje_cumplimiento: number;
}

interface AlertaPerentoria {
  tipo: "CRITICA" | "ADVERTENCIA";
  titulo: string;
  descripcion: string;
  enlace: string;
}

interface DashboardData {
  riesgos: RiskStats;
  inspecciones: InspectionStats;
  accidentes: AccidentStats;
  descargas: DownloadStats;
  capacitaciones: CapacitacionStats;
  cphs: CphsStats;
  ley_karin: LeyKarinStats;
  epp_riohs: EppRiohsStats;
  contratistas: ContratistasStats;
  alertas_perentorias: AlertaPerentoria[];
}

const NOMBRES_MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

// Mini-componente de Anillo Radial SVG
function MiniRadialProgress({
  value,
  color,
  size = 68,
  stroke = 7,
  icon,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  icon?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          className="text-slate-800"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {icon ? (
          <span className="text-sm">{icon}</span>
        ) : (
          <span className="text-[11px] font-black font-mono text-white leading-none">
            {Math.round(pct)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default function ClientePanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  // Estados interactivos para gráficos y visuales
  const [hoveredGravedad, setHoveredGravedad] = useState<string | null>(null);
  const [hoveredBarra, setHoveredBarra] = useState<string | null>(null);
  const [hoveredPunto, setHoveredPunto] = useState<number | null>(null);
  const [hoveredMesCphs, setHoveredMesCphs] = useState<number | null>(null);
  const [hoveredNivelPiramide, setHoveredNivelPiramide] = useState<string | null>(null);
  const [activeTabHistorial, setActiveTabHistorial] = useState<"todas" | "inspecciones" | "accidentes" | "epp" | "capacitaciones">("todas");

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(getApiUrl("/api/dashboard/stats/"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Error al obtener los indicadores de analítica SST.");
      const stats: DashboardData = await res.json();
      setData(stats);
    } catch (err: any) {
      setError(err.message || "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const payload = JSON.parse(window.atob(token.split(".")[1]));
          setUsername(payload.username || "");
        } catch (e) {}
      }
    }
    loadDashboardData();
  }, []);

  // --- CÁLCULO DEL SCORE GLOBAL DE BLINDAJE PREVENTIVO SST ---
  const scoreSST = useMemo(() => {
    if (!data) return 0;
    const scoreInsp = Math.min(100, (data.inspecciones.promedio_cumplimiento / 85) * 100);
    const scoreCphs = data.cphs.tiene_comite ? data.cphs.cumplimiento_sesiones_pct : 35;
    const scoreEpp = data.epp_riohs.porcentaje_firmados;
    const scoreContr = data.contratistas.porcentaje_cumplimiento;
    const scorePac = data.capacitaciones.cumplimiento_pac;
    const criticasCount = data.alertas_perentorias?.filter((a) => a.tipo === "CRITICA").length || 0;
    const penalizacion = criticasCount * 12;

    const base = scoreInsp * 0.25 + scoreCphs * 0.2 + scoreEpp * 0.2 + scoreContr * 0.15 + scorePac * 0.2;
    return Math.max(0, Math.min(100, Math.round(base - penalizacion)));
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-orange-500">
            SST
          </div>
        </div>
        <p className="text-slate-400 text-sm font-medium tracking-wide animate-pulse">
          Cargando Centro de Control y Gestión Preventiva SST 2026...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-950/20 text-rose-400 border border-rose-800/40 p-6 rounded-3xl text-sm text-center font-semibold max-w-xl mx-auto my-12 shadow-2xl">
        <p className="text-base font-bold text-rose-300 mb-2">⚠️ Error de Expediente Normativo</p>
        <p>{error || "No se pudo recuperar la telemetría de seguridad del cliente."}</p>
        <button
          onClick={loadDashboardData}
          className="mt-4 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-bold transition-all shadow-md"
        >
          Reintentar Sincronización
        </button>
      </div>
    );
  }

  // --- CÁLCULOS GRÁFICOS SVG ---
  
  // 1. Donut Chart (Gravedad de Riesgos)
  const rTotal = data.riesgos.bajo + data.riesgos.medio + data.riesgos.alto;
  const pctBajo = rTotal > 0 ? (data.riesgos.bajo / rTotal) * 100 : 0;
  const pctMedio = rTotal > 0 ? (data.riesgos.medio / rTotal) * 100 : 0;
  const pctAlto = rTotal > 0 ? (data.riesgos.alto / rTotal) * 100 : 0;

  const radiusDonut = 42;
  const circDonut = 2 * Math.PI * radiusDonut;
  const strokeBajo = (pctBajo / 100) * circDonut;
  const strokeMedio = (pctMedio / 100) * circDonut;
  const strokeAlto = (pctAlto / 100) * circDonut;
  const offsetBajo = 0;
  const offsetMedio = strokeBajo;
  const offsetAlto = strokeBajo + strokeMedio;

  // 2. Bar Chart (Siniestralidad SUSESO)
  const maxAccidentes = Math.max(data.accidentes.trabajo, data.accidentes.trayecto, data.accidentes.incidente, 1);
  const hMaxBar = 110;
  const barTrabajo = (data.accidentes.trabajo / maxAccidentes) * hMaxBar;
  const barTrayecto = (data.accidentes.trayecto / maxAccidentes) * hMaxBar;
  const barIncidente = (data.accidentes.incidente / maxAccidentes) * hMaxBar;

  // 3. Line Chart (Tendencia de Inspecciones)
  const historialOrdenado = [...data.inspecciones.historial].reverse();
  const widthLine = 340;
  const heightLine = 120;
  
  const getPointsString = () => {
    if (historialOrdenado.length === 0) return "";
    const xStep = widthLine / Math.max(historialOrdenado.length - 1, 1);
    return historialOrdenado
      .map((item, idx) => {
        const x = idx * xStep;
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
    return `0,${heightLine} ${points.join(" ")} ${(historialOrdenado.length - 1) * xStep},${heightLine}`;
  };

  const areaPointsStr = getAreaPointsString();

  // 4. Pirámide de Control de Pérdidas de Frank Bird / Heinrich
  const totalEventosPiramide =
    data.accidentes.trabajo + data.accidentes.trayecto + data.accidentes.incidente + data.riesgos.total;

  // 5. Tacómetro de Blindaje Semicircular
  // Semicírculo de r=64 -> Longitud de arco = PI * 64 ≈ 201
  const rGauge = 64;
  const arcGauge = Math.PI * rGauge;
  const offsetGauge = arcGauge - (scoreSST / 100) * arcGauge;

  const alertasCriticas = data.alertas_perentorias?.filter((a) => a.tipo === "CRITICA") || [];
  const alertasAdvertencia = data.alertas_perentorias?.filter((a) => a.tipo === "ADVERTENCIA") || [];
  const totalAlertas = (data.alertas_perentorias || []).length;
  const mesActualIndex = new Date().getMonth();

  // Desglose de Actos vs Condiciones
  const totalActosCondiciones = (data.riesgos.acto + data.riesgos.condicion) || 1;
  const pctActos = Math.round((data.riesgos.acto / totalActosCondiciones) * 100);
  const pctCondiciones = 100 - pctActos;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* ========================================================================= */}
      {/* 1. HERO CABECERA: VELOCÍMETRO SST + ESTADO NORMATIVO                     */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/3 -bottom-24 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Lado Izquierdo: Saludo y Resumen Ejecutivo */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                🛡️ Plataforma Integral SST 2026
              </span>
              <span className="text-xs text-slate-400 font-mono">
                D.S. 44 • Ley Karin • D.S. 76 • D.S. 594
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Panel de Prevención: <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">{username || "Prevencionista"}</span>
            </h1>

            <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-xl">
              Bienvenido a tu centro de mando en Seguridad y Salud en el Trabajo.
              Visualiza de forma gráfica el estatus legal de la faena, control de plazos fatales,
              sesiones paritarias y acreditación documental de contratistas.
            </p>

            {/* Micro-pills de Estado Rápido */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-slate-300 font-medium">Auditorías:</span>
                <span className="font-mono font-bold text-white">{data.inspecciones.promedio_cumplimiento}%</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className={`w-2 h-2 rounded-full ${data.cphs.tiene_comite ? "bg-blue-400" : "bg-amber-400"}`}></span>
                <span className="text-slate-300 font-medium">CPHS:</span>
                <span className="font-mono font-bold text-white">
                  {data.cphs.tiene_comite ? `${data.cphs.sesiones_ordinarias_anio}/12 Actas` : "Sin Comité"}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span className="text-slate-300 font-medium">Contratistas:</span>
                <span className="font-mono font-bold text-white">{data.contratistas.porcentaje_cumplimiento}% al día</span>
              </div>
            </div>
          </div>

          {/* Lado Derecho: Tacómetro / Gauge Visual del Blindaje SST */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-end justify-center">
            <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col items-center w-full max-w-xs text-center relative backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Índice Global de Blindaje SST
              </span>

              {/* Semicírculo SVG Tacómetro */}
              <div className="relative w-48 h-28 flex items-end justify-center overflow-hidden my-1">
                <svg className="w-48 h-48 -rotate-180" viewBox="0 0 160 160">
                  <circle
                    cx="80"
                    cy="80"
                    r={rGauge}
                    stroke="currentColor"
                    className="text-slate-800"
                    strokeWidth="14"
                    strokeDasharray={`${arcGauge} ${arcGauge}`}
                    fill="transparent"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r={rGauge}
                    stroke={scoreSST >= 85 ? "#10B981" : scoreSST >= 70 ? "#F59E0B" : "#EF4444"}
                    strokeWidth="14"
                    strokeDasharray={`${arcGauge} ${arcGauge}`}
                    strokeDashoffset={offsetGauge}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>

                {/* Valor Central */}
                <div className="absolute bottom-2 flex flex-col items-center">
                  <span className="text-3xl font-black font-mono text-white tracking-tight">
                    {scoreSST}%
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    scoreSST >= 85
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : scoreSST >= 70
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}>
                    {scoreSST >= 85 ? "Blindaje Activo" : scoreSST >= 70 ? "Alerta Operativa" : "Riesgo Legal"}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 leading-tight">
                Ponderado según auditorías D.S. 594, sesiones CPHS, firmas EPP y F30 de contratistas.
              </p>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* CINTA DE ALERTAS PERENTORIAS Y SEMÁFORO LEGAL                             */}
        {/* ========================================================================= */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          {totalAlertas > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
                  <span className="text-base animate-bounce">🚨</span> Radar de Plazos Fatales SST (Requiere Atención Inmediata):
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {totalAlertas} {totalAlertas === 1 ? "obligación pendiente" : "obligaciones pendientes"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.alertas_perentorias.map((alerta, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      alerta.tipo === "CRITICA"
                        ? "bg-rose-950/40 border-rose-500/50 hover:border-rose-500 shadow-lg shadow-rose-950/20"
                        : "bg-amber-950/40 border-amber-500/50 hover:border-amber-500 shadow-lg shadow-amber-950/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            alerta.tipo === "CRITICA"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {alerta.tipo === "CRITICA" ? "🔴 Plazo Fatal Crítico" : "🟡 Aviso Preventivo"}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mb-1">{alerta.titulo}</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{alerta.descripcion}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-end">
                      <Link
                        href={alerta.enlace}
                        className={`text-xs font-extrabold flex items-center gap-1 transition-transform hover:translate-x-1 ${
                          alerta.tipo === "CRITICA"
                            ? "text-rose-400 hover:text-rose-300"
                            : "text-amber-400 hover:text-amber-300"
                        }`}
                      >
                        Gestionar Ahora →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl gap-3">
              <div className="flex items-center gap-3 text-xs text-emerald-300 font-semibold">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg shrink-0">
                  ✓
                </div>
                <div>
                  <div className="text-white font-bold">Faena Blindada: Sin Incumplimientos Fatales</div>
                  <div className="text-emerald-400/80 text-[11px] font-normal">
                    Los plazos de DIAT (24h), Ley Karin (72h), comités paritarios y contratistas están al día.
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30 shrink-0">
                100% Blindaje Activo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEMÁFORO CLIMA, RADIACIÓN UV SOLAR (D.S. 594) Y ESTRÉS TÉRMICO (ISO 2024)   */}
      {/* ========================================================================= */}
      <ClimaUvWidget className="shadow-xl" />

      {/* ========================================================================= */}
      {/* 2. DASHBOARD DE ANILLOS VISUALES DE SALUD PREVENTIVA (4 ANILLOS)           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Anillo 1: Auditorías D.S. 594 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-all shadow-md">
          <div className="space-y-1 pr-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Efectividad D.S. 594
            </span>
            <div className="text-xl font-black text-white">
              {data.inspecciones.promedio_cumplimiento}%
            </div>
            <p className="text-[11px] text-slate-400">
              {data.inspecciones.total} inspecciones en faena
            </p>
            <div className="text-[10px] text-emerald-400 font-mono font-semibold pt-1">
              Meta Legal: 85%
            </div>
          </div>
          <MiniRadialProgress
            value={data.inspecciones.promedio_cumplimiento}
            color={data.inspecciones.promedio_cumplimiento >= 85 ? "#10B981" : data.inspecciones.promedio_cumplimiento >= 70 ? "#F59E0B" : "#EF4444"}
          />
        </div>

        {/* Anillo 2: Firmas Digitales EPP & RIOHS (Ley 19.799) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-all shadow-md">
          <div className="space-y-1 pr-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Firmas Ley 19.799
            </span>
            <div className="text-xl font-black text-emerald-400">
              {data.epp_riohs.porcentaje_firmados}%
            </div>
            <p className="text-[11px] text-slate-400">
              {data.epp_riohs.total_entregas} entregas auditables
            </p>
            <div className="text-[10px] text-cyan-400 font-mono font-semibold pt-1">
              {data.epp_riohs.constancias_riohs_firmadas} RIOHS firmados
            </div>
          </div>
          <MiniRadialProgress
            value={data.epp_riohs.porcentaje_firmados}
            color="#10B981"
          />
        </div>

        {/* Anillo 3: Contratistas Acreditadas (D.S. 76) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-all shadow-md">
          <div className="space-y-1 pr-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Contratistas D.S. 76
            </span>
            <div className={`text-xl font-black ${
              data.contratistas.porcentaje_cumplimiento >= 90 ? "text-emerald-400" : "text-amber-400"
            }`}>
              {data.contratistas.porcentaje_cumplimiento}%
            </div>
            <p className="text-[11px] text-slate-400">
              {data.contratistas.acreditadas_al_dia} de {data.contratistas.total_empresas} con F30/F30-1
            </p>
            <div className="text-[10px] text-indigo-400 font-mono font-semibold pt-1">
              Ley Subcontratación
            </div>
          </div>
          <MiniRadialProgress
            value={data.contratistas.porcentaje_cumplimiento}
            color={data.contratistas.porcentaje_cumplimiento >= 85 ? "#10B981" : "#F59E0B"}
          />
        </div>

        {/* Anillo 4: Avance Charlas PAC (D.S. 44) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-all shadow-md">
          <div className="space-y-1 pr-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Avance PAC Anual
            </span>
            <div className="text-xl font-black text-white">
              {data.capacitaciones.cumplimiento_pac}%
            </div>
            <p className="text-[11px] text-slate-400">
              {data.capacitaciones.realizadas} de {data.capacitaciones.total} capacitaciones
            </p>
            <div className="text-[10px] text-orange-400 font-mono font-semibold pt-1">
              {data.capacitaciones.asistentes_alcanzados} asistentes
            </div>
          </div>
          <MiniRadialProgress
            value={data.capacitaciones.cumplimiento_pac}
            color="#EA580C"
          />
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. VISUALIZACIÓN PREVENTIVA: PIRÁMIDE DE BIRD + BALANZA MIPER             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* PIRÁMIDE DE CONTROL DE PÉRDIDAS (HEINRICH / FRANK BIRD) - 7 COLS */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔺</span>
                <h3 className="font-extrabold text-sm md:text-base text-white">
                  Pirámide Preventiva de Control de Pérdidas (Bird / SUSESO)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                Modelo Causal
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Visualización jerárquica de la siniestralidad. Prevenir incidentes y reportar condiciones en la base evita accidentes en la cúspide.
            </p>
          </div>

          {/* Pirámide Estilizada Interactiva */}
          <div className="flex flex-col items-center justify-center space-y-2 py-4 my-auto">
            
            {/* Nivel 1: Cúspide - Accidentes del Trabajo */}
            <div
              className={`w-44 transition-all duration-300 cursor-pointer rounded-xl p-2.5 text-center border ${
                hoveredNivelPiramide === "trabajo"
                  ? "bg-rose-600 text-white scale-105 shadow-xl shadow-rose-950/50 border-rose-400"
                  : "bg-rose-950/40 border-rose-500/50 text-rose-200 hover:bg-rose-900/50"
              }`}
              onMouseEnter={() => setHoveredNivelPiramide("trabajo")}
              onMouseLeave={() => setHoveredNivelPiramide(null)}
            >
              <div className="text-[10px] font-black uppercase tracking-wider">Accidentes del Trabajo</div>
              <div className="text-lg font-black font-mono">{data.accidentes.trabajo} Casos</div>
              <div className="text-[9px] text-rose-300/80">Plazo DIAT: 24 Horas</div>
            </div>

            {/* Nivel 2: Medio - Accidentes de Trayecto */}
            <div
              className={`w-64 transition-all duration-300 cursor-pointer rounded-xl p-2.5 text-center border ${
                hoveredNivelPiramide === "trayecto"
                  ? "bg-amber-600 text-white scale-105 shadow-xl shadow-amber-950/50 border-amber-400"
                  : "bg-amber-950/40 border-amber-500/50 text-amber-200 hover:bg-amber-900/50"
              }`}
              onMouseEnter={() => setHoveredNivelPiramide("trayecto")}
              onMouseLeave={() => setHoveredNivelPiramide(null)}
            >
              <div className="text-[10px] font-black uppercase tracking-wider">Accidentes de Trayecto</div>
              <div className="text-lg font-black font-mono">{data.accidentes.trayecto} Casos</div>
              <div className="text-[9px] text-amber-300/80">Comprobación de ruta habitual</div>
            </div>

            {/* Nivel 3: Base Directa - Incidentes / Casi Accidentes */}
            <div
              className={`w-80 transition-all duration-300 cursor-pointer rounded-xl p-2.5 text-center border ${
                hoveredNivelPiramide === "incidente"
                  ? "bg-blue-600 text-white scale-105 shadow-xl shadow-blue-950/50 border-blue-400"
                  : "bg-blue-950/40 border-blue-500/50 text-blue-200 hover:bg-blue-900/50"
              }`}
              onMouseEnter={() => setHoveredNivelPiramide("incidente")}
              onMouseLeave={() => setHoveredNivelPiramide(null)}
            >
              <div className="text-[10px] font-black uppercase tracking-wider">Incidentes / Casi-Accidentes</div>
              <div className="text-lg font-black font-mono">{data.accidentes.incidente} Casi-Accidentes</div>
              <div className="text-[9px] text-blue-300/80">Sin lesión con potencial de daño</div>
            </div>

            {/* Nivel 4: Cimientos - Reporte de Peligros y Condiciones MIPER */}
            <div
              className={`w-full max-w-md transition-all duration-300 cursor-pointer rounded-xl p-2.5 text-center border ${
                hoveredNivelPiramide === "peligros"
                  ? "bg-emerald-600 text-white scale-105 shadow-xl shadow-emerald-950/50 border-emerald-400"
                  : "bg-emerald-950/30 border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/40"
              }`}
              onMouseEnter={() => setHoveredNivelPiramide("peligros")}
              onMouseLeave={() => setHoveredNivelPiramide(null)}
            >
              <div className="text-[10px] font-black uppercase tracking-wider">Base Proactiva: Hallazgos MIPER</div>
              <div className="text-lg font-black font-mono">
                {data.riesgos.total} Reportes ({data.riesgos.resueltos} Subsanados)
              </div>
              <div className="text-[9px] text-emerald-300/80">Detección oportuna antes de la materialización</div>
            </div>

          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Principio de Bird: Controlar la base reduce drásticamente eventos mayores.</span>
            <Link href="/panel/accidentes" className="text-orange-400 hover:text-orange-300 font-bold">
              Ir a Investigaciones →
            </Link>
          </div>
        </div>

        {/* BALANZA MIPER: ACTOS VS CONDICIONES + SEVERIDAD - 5 COLS */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚖️</span>
                <h3 className="font-extrabold text-sm md:text-base text-white">
                  Balanza MIPER: Factor Humano vs Entorno
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                D.S. 44
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Proporción de peligros generados por conductas subestándar (actos) frente a fallas de infraestructura (condiciones).
            </p>
          </div>

          {/* Barra Bicolor Visual Actos vs Condiciones */}
          <div className="space-y-4 my-auto">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-amber-400 flex items-center gap-1.5">
                  <span>👤</span> Actos Inseguros ({pctActos}%)
                </span>
                <span className="text-cyan-400 flex items-center gap-1.5">
                  <span>🏗️</span> Condiciones ({pctCondiciones}%)
                </span>
              </div>

              {/* Barra Proporcional */}
              <div className="h-5 w-full bg-slate-800 rounded-xl overflow-hidden flex border border-slate-700/60 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-l-lg transition-all duration-500"
                  style={{ width: `${pctActos}%` }}
                ></div>
                <div
                  className="h-full bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-r-lg transition-all duration-500"
                  style={{ width: `${pctCondiciones}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>{data.riesgos.acto} conductas observadas</span>
                <span>{data.riesgos.condicion} fallas físicas</span>
              </div>
            </div>

            {/* Termómetros de Severidad MIPER */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Nivel de Gravedad de Riesgos
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-xl text-center">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase">Bajo</div>
                  <div className="text-lg font-black text-white font-mono">{data.riesgos.bajo}</div>
                  <div className="text-[9px] text-slate-400">Aceptable</div>
                </div>

                <div className="bg-amber-950/30 border border-amber-500/30 p-2.5 rounded-xl text-center">
                  <div className="text-[10px] text-amber-400 font-bold uppercase">Medio</div>
                  <div className="text-lg font-black text-white font-mono">{data.riesgos.medio}</div>
                  <div className="text-[9px] text-slate-400">Controlable</div>
                </div>

                <div className="bg-rose-950/30 border border-rose-500/30 p-2.5 rounded-xl text-center">
                  <div className="text-[10px] text-rose-400 font-bold uppercase">Alto</div>
                  <div className="text-lg font-black text-white font-mono">{data.riesgos.alto}</div>
                  <div className="text-[9px] text-rose-300 font-bold">Crítico</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{data.riesgos.abiertos + data.riesgos.proceso} requieren medidas correctivas</span>
            <Link href="/panel/reportes-riesgo" className="text-orange-400 hover:text-orange-300 font-bold">
              Ver Matriz →
            </Link>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. SECCIÓN DE GRÁFICOS SVG NATIVOS INTERACTIVOS (4 WIDGETS)               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* GRÁFICO 1: Donut (Riesgos por Severidad) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Donut de Severidad</h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                D.S. 44
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Concentración de peligros por impacto</p>
          </div>

          <div className="flex items-center justify-center py-4 relative">
            {rTotal === 0 ? (
              <div className="h-36 flex items-center justify-center text-xs text-slate-500 italic">
                Sin riesgos registrados en faena.
              </div>
            ) : (
              <div className="relative w-36 h-36">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={radiusDonut} fill="transparent" stroke="currentColor" className="text-slate-800" strokeWidth="10" />

                  {strokeBajo > 0 && (
                    <circle
                      cx="50" cy="50" r={radiusDonut} fill="transparent" stroke="#10B981"
                      strokeWidth={hoveredGravedad === "bajo" ? "14" : "10"}
                      strokeDasharray={`${strokeBajo} ${circDonut - strokeBajo}`}
                      strokeDashoffset={-offsetBajo}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredGravedad("bajo")}
                      onMouseLeave={() => setHoveredGravedad(null)}
                    />
                  )}

                  {strokeMedio > 0 && (
                    <circle
                      cx="50" cy="50" r={radiusDonut} fill="transparent" stroke="#F59E0B"
                      strokeWidth={hoveredGravedad === "medio" ? "14" : "10"}
                      strokeDasharray={`${strokeMedio} ${circDonut - strokeMedio}`}
                      strokeDashoffset={-offsetMedio}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredGravedad("medio")}
                      onMouseLeave={() => setHoveredGravedad(null)}
                    />
                  )}

                  {strokeAlto > 0 && (
                    <circle
                      cx="50" cy="50" r={radiusDonut} fill="transparent" stroke="#EF4444"
                      strokeWidth={hoveredGravedad === "alto" ? "14" : "10"}
                      strokeDasharray={`${strokeAlto} ${circDonut - strokeAlto}`}
                      strokeDashoffset={-offsetAlto}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredGravedad("alto")}
                      onMouseLeave={() => setHoveredGravedad(null)}
                    />
                  )}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  {hoveredGravedad ? (
                    <>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{hoveredGravedad}</span>
                      <span className="text-lg font-black text-white">
                        {hoveredGravedad === "bajo" ? data.riesgos.bajo : hoveredGravedad === "medio" ? data.riesgos.medio : data.riesgos.alto}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Peligros</span>
                      <span className="text-xl font-black text-white">{rTotal}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-around text-xs font-semibold pt-2 border-t border-slate-800 text-slate-400">
            <span className="flex items-center gap-1.5 cursor-pointer" onMouseEnter={() => setHoveredGravedad("bajo")} onMouseLeave={() => setHoveredGravedad(null)}>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Bajo ({data.riesgos.bajo})</span>
            </span>
            <span className="flex items-center gap-1.5 cursor-pointer" onMouseEnter={() => setHoveredGravedad("medio")} onMouseLeave={() => setHoveredGravedad(null)}>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Medio ({data.riesgos.medio})</span>
            </span>
            <span className="flex items-center gap-1.5 cursor-pointer" onMouseEnter={() => setHoveredGravedad("alto")} onMouseLeave={() => setHoveredGravedad(null)}>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Alto ({data.riesgos.alto})</span>
            </span>
          </div>
        </div>

        {/* GRÁFICO 2: Barras (Tipología SUSESO) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Siniestralidad SUSESO</h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                Circular 3336
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Comparativa Trabajo vs Trayecto</p>
          </div>

          <div className="flex items-end justify-center py-4 h-40 relative">
            {data.accidentes.total === 0 ? (
              <div className="text-xs text-slate-500 italic">
                Sin accidentes registrados.
              </div>
            ) : (
              <div className="relative w-full max-w-[220px] h-[120px] flex justify-around items-end border-b border-slate-800">
                <div className="flex flex-col items-center group relative w-12">
                  {hoveredBarra === "trabajo" && (
                    <div className="absolute -top-9 bg-slate-950 text-white text-[10px] py-1 px-2 rounded font-bold shadow-xl border border-slate-800 z-20 whitespace-nowrap">
                      {data.accidentes.trabajo} Trabajo
                    </div>
                  )}
                  <div
                    className="w-8 bg-rose-500 rounded-t-lg transition-all duration-300 cursor-pointer hover:bg-rose-600"
                    style={{ height: `${barTrabajo}px` }}
                    onMouseEnter={() => setHoveredBarra("trabajo")}
                    onMouseLeave={() => setHoveredBarra(null)}
                  ></div>
                  <span className="text-[10px] text-slate-400 font-bold mt-1.5">Trabajo</span>
                </div>

                <div className="flex flex-col items-center group relative w-12">
                  {hoveredBarra === "trayecto" && (
                    <div className="absolute -top-9 bg-slate-950 text-white text-[10px] py-1 px-2 rounded font-bold shadow-xl border border-slate-800 z-20 whitespace-nowrap">
                      {data.accidentes.trayecto} Trayecto
                    </div>
                  )}
                  <div
                    className="w-8 bg-amber-500 rounded-t-lg transition-all duration-300 cursor-pointer hover:bg-amber-600"
                    style={{ height: `${barTrayecto}px` }}
                    onMouseEnter={() => setHoveredBarra("trayecto")}
                    onMouseLeave={() => setHoveredBarra(null)}
                  ></div>
                  <span className="text-[10px] text-slate-400 font-bold mt-1.5">Trayecto</span>
                </div>

                <div className="flex flex-col items-center group relative w-12">
                  {hoveredBarra === "incidente" && (
                    <div className="absolute -top-9 bg-slate-950 text-white text-[10px] py-1 px-2 rounded font-bold shadow-xl border border-slate-800 z-20 whitespace-nowrap">
                      {data.accidentes.incidente} Incidentes
                    </div>
                  )}
                  <div
                    className="w-8 bg-blue-500 rounded-t-lg transition-all duration-300 cursor-pointer hover:bg-blue-600"
                    style={{ height: `${barIncidente}px` }}
                    onMouseEnter={() => setHoveredBarra("incidente")}
                    onMouseLeave={() => setHoveredBarra(null)}
                  ></div>
                  <span className="text-[10px] text-slate-400 font-bold mt-1.5">Incidente</span>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 text-center italic border-t border-slate-800 pt-2">
            Notificación formal DIAT según Ley 16.744
          </div>
        </div>

        {/* GRÁFICO 3: Línea de Tendencia (Evolución de Inspecciones) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Evolución de Auditorías</h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                D.S. 594
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Tendencia de las últimas 5 inspecciones</p>
          </div>

          <div className="flex items-center justify-center py-2 relative h-40">
            {historialOrdenado.length === 0 ? (
              <div className="text-xs text-slate-500 italic">
                Sin auditorías registradas.
              </div>
            ) : (
              <div className="w-full relative h-[110px]">
                <svg className="w-full h-full" viewBox={`0 0 ${widthLine} ${heightLine}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  <line x1="0" y1="0" x2={widthLine} y2="0" stroke="currentColor" className="text-slate-800" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1={heightLine * 0.15} x2={widthLine} y2={heightLine * 0.15} stroke="#10B981" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
                  <line x1="0" y1={heightLine} x2={widthLine} y2={heightLine} stroke="currentColor" className="text-slate-800" strokeWidth="1" />

                  {areaPointsStr && <polygon points={areaPointsStr} fill="url(#areaGrad)" />}
                  {pointsStr && (
                    <polyline
                      fill="none"
                      stroke="#EA580C"
                      strokeWidth="3"
                      points={pointsStr}
                      strokeLinecap="round"
                    />
                  )}

                  {historialOrdenado.map((item, idx) => {
                    const xStep = widthLine / Math.max(historialOrdenado.length - 1, 1);
                    const x = idx * xStep;
                    const y = heightLine - (item.porcentaje / 100) * heightLine;
                    return (
                      <g key={item.id} className="cursor-pointer">
                        <circle
                          cx={x} cy={y}
                          r={hoveredPunto === item.id ? "7" : "5"}
                          fill="#EA580C" stroke="#FFFFFF" strokeWidth="2"
                          className="transition-all duration-200"
                          onMouseEnter={() => setHoveredPunto(item.id)}
                          onMouseLeave={() => setHoveredPunto(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {hoveredPunto && (() => {
                  const activeItem = historialOrdenado.find((item) => item.id === hoveredPunto);
                  if (!activeItem) return null;
                  const idx = historialOrdenado.indexOf(activeItem);
                  const xStep = widthLine / Math.max(historialOrdenado.length - 1, 1);
                  const leftPos = (idx * xStep) / widthLine * 100;

                  return (
                    <div
                      className="absolute bg-slate-950 text-white p-2 rounded-xl text-[10px] z-30 shadow-xl border border-slate-800 flex flex-col font-bold min-w-32 transition-all -top-8 pointer-events-none"
                      style={{ left: `${leftPos}%`, transform: "translateX(-50%)" }}
                    >
                      <span className="text-orange-400 truncate">{activeItem.plantilla_nombre}</span>
                      <span className="text-[11px] font-mono mt-0.5 text-white">{activeItem.porcentaje}% Cumplimiento</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 text-center italic border-t border-slate-800 pt-2">
            Línea verde superior: Meta de excelencia (85%)
          </div>
        </div>

        {/* GRÁFICO 4: Widget de Sesiones CPHS (Art. 39 D.S. 44) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Sesiones CPHS (Art. 39)</h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                D.S. 44
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">12 reuniones mensuales obligatorias</p>
          </div>

          <div className="py-2 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-300">
                  {data.cphs.sesiones_ordinarias_anio} de 12 Actas
                </span>
                <span className="text-orange-400 font-mono">
                  {data.cphs.cumplimiento_sesiones_pct}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.cphs.cumplimiento_sesiones_pct)}%` }}
                ></div>
              </div>
            </div>

            {/* Malla de 12 Meses */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {NOMBRES_MESES.map((mes, idx) => {
                const realizado = Boolean(data.cphs.sesiones_meses?.[idx]);
                const esMesActual = idx === mesActualIndex;
                const esMesPasado = idx < mesActualIndex;

                let badgeClase = "bg-slate-800/40 text-slate-500 border-slate-800";
                let icono = "—";
                let tooltip = `${mes}: Sesión por realizar`;

                if (realizado) {
                  badgeClase = "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
                  icono = "✓";
                  tooltip = `${mes}: Sesión ordinaria realizada`;
                } else if (esMesActual) {
                  badgeClase = "bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse";
                  icono = "⏱";
                  tooltip = `${mes} (Mes en curso): Pendiente de acta`;
                } else if (esMesPasado) {
                  badgeClase = "bg-rose-500/15 text-rose-300/80 border-rose-500/30";
                  icono = "✕";
                  tooltip = `${mes}: Sin acta registrada`;
                }

                return (
                  <div
                    key={idx}
                    className={`relative p-1.5 rounded-lg border text-center transition-all cursor-pointer ${badgeClase} hover:scale-105`}
                    onMouseEnter={() => setHoveredMesCphs(idx)}
                    onMouseLeave={() => setHoveredMesCphs(null)}
                  >
                    <div className="text-[10px] font-bold leading-none">{mes}</div>
                    <div className="text-[9px] font-mono mt-0.5 font-extrabold">{icono}</div>

                    {hoveredMesCphs === idx && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] py-1 px-2 rounded-lg font-medium shadow-2xl border border-slate-800 z-30 whitespace-nowrap pointer-events-none">
                        {tooltip}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 text-center italic border-t border-slate-800 pt-2">
            Vigencia: {data.cphs.tiene_comite ? `${data.cphs.dias_restantes_mandato ?? 0} días restantes` : "Sin Comité"}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. CENTRO DE VIGILANCIA DOCUMENTAL Y EXPEDIENTES EN 4 COLUMNAS           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* COLUMNA 1: Auditorías en Terreno */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>📋</span> Auditorías Realizadas
              </h3>
              <Link href="/panel/inspecciones" className="text-[11px] font-bold text-orange-400 hover:text-orange-300">
                Ver todas →
              </Link>
            </div>
            
            <div className="divide-y divide-slate-800/60">
              {data.inspecciones.historial.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic">
                  Sin inspecciones en el período.
                </div>
              ) : (
                data.inspecciones.historial.map((insp) => (
                  <div key={insp.id} className="p-3.5 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-0.5 overflow-hidden pr-2">
                      <p className="text-xs font-bold text-white truncate">{insp.plantilla_nombre}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {insp.inspector} • {new Date(insp.fecha).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg font-mono shrink-0 ${
                      insp.porcentaje >= 85 
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" 
                        : insp.porcentaje >= 70 
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/30" 
                        : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                    }`}>
                      {insp.porcentaje}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950/30 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
            Ponderación global D.S. N° 594
          </div>
        </div>

        {/* COLUMNA 2: Casos Siniestrales */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🚨</span> Casos Siniestrales
              </h3>
              <Link href="/panel/accidentes" className="text-[11px] font-bold text-orange-400 hover:text-orange-300">
                Ver todos →
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60">
              {data.accidentes.historial.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic">
                  Sin accidentes reportados.
                </div>
              ) : (
                data.accidentes.historial.map((acc) => (
                  <div key={acc.id} className="p-3.5 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-0.5 overflow-hidden pr-2">
                      <p className="text-xs font-bold text-white truncate">{acc.nombre_afectado}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {acc.lugar} • {acc.lesion}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase font-mono shrink-0 ${
                      acc.tipo_evento === "TRABAJO" 
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30" 
                        : acc.tipo_evento === "TRAYECTO" 
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30" 
                        : "bg-blue-500/15 text-blue-300 border-blue-500/30"
                    }`}>
                      {acc.tipo_evento === "TRABAJO" ? "Trabajo" : acc.tipo_evento === "TRAYECTO" ? "Trayecto" : "Incidente"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950/30 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
            Plazo DIAT: 24h desde ocurrencia
          </div>
        </div>

        {/* COLUMNA 3: Monitoreo de Firmas EPP y RIOHS */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>✍️</span> Firmas EPP & RIOHS
              </h3>
              <Link href="/panel/epp-riohs" className="text-[11px] font-bold text-orange-400 hover:text-orange-300">
                Ver actas →
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60">
              {!data.epp_riohs.historial || data.epp_riohs.historial.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic">
                  Sin entregas de EPP registradas.
                </div>
              ) : (
                data.epp_riohs.historial.map((epp) => (
                  <div key={epp.id} className="p-3.5 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-0.5 overflow-hidden pr-2">
                      <p className="text-xs font-bold text-white truncate">{epp.trabajador}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {epp.rut || "Sin RUT"} • {new Date(epp.fecha).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono ${
                        epp.firmado
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      }`}>
                        {epp.firmado ? "✓ Firma Ley 19.799" : "Pendiente"}
                      </span>
                      {epp.entrega_riohs && (
                        <span className="text-[9px] font-mono text-cyan-300 bg-cyan-500/10 px-1 rounded border border-cyan-500/20">
                          + RIOHS
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950/30 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
            Validez legal Ley 19.799 / Circular 3336
          </div>
        </div>

        {/* COLUMNA 4: Capacitaciones Recientes (PAC) */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🎓</span> Charlas PAC Realizadas
              </h3>
              <Link href="/panel/capacitaciones" className="text-[11px] font-bold text-orange-400 hover:text-orange-300">
                Ver todas →
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60">
              {data.capacitaciones.historial.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic">
                  Sin capacitaciones registradas.
                </div>
              ) : (
                data.capacitaciones.historial.map((cap) => (
                  <div key={cap.id} className="p-3.5 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-0.5 overflow-hidden pr-2">
                      <p className="text-xs font-bold text-white truncate">{cap.tema_titulo}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {cap.lugar} • {new Date(cap.fecha_programada + "T00:00:00").toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase font-mono shrink-0 ${
                      cap.estado === "REALIZADA" 
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" 
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}>
                      {cap.estado === "REALIZADA" ? `Realizada (${cap.asistentes_count})` : "Pendiente"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950/30 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
            Programa de Capacitaciones D.S. N° 44 (Arts. 15 y 16)
          </div>
        </div>

      </div>

    </div>
  );
}
