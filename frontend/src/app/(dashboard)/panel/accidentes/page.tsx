"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../../../utils/api";

interface ActionItem {
  medida: string;
  responsable: string;
  fecha_limite: string;
  estado: "PENDIENTE" | "REALIZADO";
}

interface AccidentRecord {
  id: number;
  usuario: number;
  username: string;
  empresa?: number;
  empresa_nombre?: string;
  trabajador?: number;
  trabajador_nombre?: string;
  nombre_afectado: string;
  rut_afectado: string;
  cargo_afectado: string;
  edad_afectado: number;
  antiguedad_afectado: string;
  tipo_evento: "TRABAJO" | "TRAYECTO" | "INCIDENTE";
  fecha_hora_evento: string;
  lugar_evento: string;
  descripcion_evento: string;
  tipo_lesion: string;
  parte_cuerpo_afectada: string;
  causas_inmediatas: any;
  causas_basicas: any;
  analisis_5_porques: string[];
  plan_accion: ActionItem[];
  // Cumplimiento Legal y Normativo (Ley 16.744 / SUSESO)
  diat_presentada: boolean;
  diat_folio?: string | null;
  diat_fecha_presentacion?: string | null;
  plazo_limite_diat_24h?: string | null;
  horas_restantes_diat: number;
  diat_vencida: boolean;
  semaforo_diat: "PRESENTADA" | "EN_PLAZO" | "VENCIDA";
  es_grave_o_fatal: boolean;
  tipo_accidente_grave?: string | null;
  tipo_accidente_grave_display?: string | null;
  faena_suspendida: boolean;
  aviso_autoridades_realizado: boolean;
  aviso_autoridades_folio?: string | null;
  aviso_autoridades_fecha?: string | null;
  dias_perdidos: number;
  alta_medica: boolean;
  fecha_creacion: string;
}

interface EstadisticasSiniestralidad {
  total_accidentes: number;
  total_dias_perdidos: number;
  accidentes_con_tiempo_perdido: number;
  horas_trabajadas_estimadas: number;
  tasa_frecuencia_if: number;
  tasa_gravedad_ig: number;
  graves_o_fatales_count: number;
  diat_pendientes_count: number;
  diat_vencidas_count: number;
  total_eventos: number;
}

export default function AccidentesPage() {
  const router = useRouter();
  const [records, setRecords] = useState<AccidentRecord[]>([]);
  const [stats, setStats] = useState<EstadisticasSiniestralidad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterGrave, setFilterGrave] = useState<boolean>(false);

  // Estado para Modal DIAT
  const [diatModalAccident, setDiatModalAccident] = useState<AccidentRecord | null>(null);
  const [diatFolioInput, setDiatFolioInput] = useState("");
  const [diatFechaInput, setDiatFechaInput] = useState("");
  const [savingDiat, setSavingDiat] = useState(false);

  // Estado para Modal Protocolo Accidente Grave (Circular 3336)
  const [protocoloModalAccident, setProtocoloModalAccident] = useState<AccidentRecord | null>(null);
  const [protoFaenaSuspendida, setProtoFaenaSuspendida] = useState(false);
  const [protoAvisoRealizado, setProtoAvisoRealizado] = useState(false);
  const [protoAvisoFolio, setProtoAvisoFolio] = useState("");
  const [protoTipoGrave, setProtoTipoGrave] = useState<string>("OTRO_GRAVE");
  const [protoEsGrave, setProtoEsGrave] = useState(true);
  const [protoDiasPerdidos, setProtoDiasPerdidos] = useState(0);
  const [protoAltaMedica, setProtoAltaMedica] = useState(false);
  const [savingProtocolo, setSavingProtocolo] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      // 1. Obtener listado de investigaciones
      const resRecords = await fetch(getApiUrl("/api/accidentes/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resRecords.ok) throw new Error("Error al obtener el historial de investigaciones.");
      const dataRecords = await resRecords.json();
      setRecords(dataRecords);

      // 2. Obtener estadísticas de siniestralidad (IF, IG, días perdidos)
      const resStats = await fetch(getApiUrl("/api/accidentes/estadisticas/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta investigación? Esta acción no se puede deshacer.")) return;
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(getApiUrl(`/api/accidentes/${id}/`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Error al eliminar la investigación.");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Abrir Modal de DIAT
  const handleOpenDiatModal = (acc: AccidentRecord) => {
    setDiatModalAccident(acc);
    setDiatFolioInput(acc.diat_folio || "");
    const nowIso = new Date().toISOString().slice(0, 16);
    setDiatFechaInput(acc.diat_fecha_presentacion ? acc.diat_fecha_presentacion.slice(0, 16) : nowIso);
  };

  // Guardar DIAT
  const handleSaveDiat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diatModalAccident) return;
    if (!diatFolioInput.trim()) {
      alert("Por favor ingresa el folio oficial de la DIAT emitido por la mutualidad.");
      return;
    }

    setSavingDiat(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(getApiUrl(`/api/accidentes/${diatModalAccident.id}/registrar-diat/`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diat_folio: diatFolioInput.trim(),
          diat_fecha_presentacion: diatFechaInput ? new Date(diatFechaInput).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "No se pudo registrar la DIAT.");
      }

      setDiatModalAccident(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingDiat(false);
    }
  };

  // Abrir Modal Protocolo Circular 3336
  const handleOpenProtocoloModal = (acc: AccidentRecord) => {
    setProtocoloModalAccident(acc);
    setProtoEsGrave(acc.es_grave_o_fatal);
    setProtoTipoGrave(acc.tipo_accidente_grave || "OTRO_GRAVE");
    setProtoFaenaSuspendida(acc.faena_suspendida);
    setProtoAvisoRealizado(acc.aviso_autoridades_realizado);
    setProtoAvisoFolio(acc.aviso_autoridades_folio || "");
    setProtoDiasPerdidos(acc.dias_perdidos || 0);
    setProtoAltaMedica(acc.alta_medica || false);
  };

  // Guardar Protocolo
  const handleSaveProtocolo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protocoloModalAccident) return;

    setSavingProtocolo(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(getApiUrl(`/api/accidentes/${protocoloModalAccident.id}/protocolo-grave-fatal/`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          es_grave_o_fatal: protoEsGrave,
          tipo_accidente_grave: protoTipoGrave,
          faena_suspendida: protoFaenaSuspendida,
          aviso_autoridades_realizado: protoAvisoRealizado,
          aviso_autoridades_folio: protoAvisoFolio.trim() || undefined,
          dias_perdidos: protoDiasPerdidos,
          alta_medica: protoAltaMedica,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "No se pudo actualizar el protocolo legal.");
      }

      setProtocoloModalAccident(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingProtocolo(false);
    }
  };

  // Filtrado de registros
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.nombre_afectado.toLowerCase().includes(search.toLowerCase()) ||
      r.rut_afectado.toLowerCase().includes(search.toLowerCase()) ||
      r.lugar_evento.toLowerCase().includes(search.toLowerCase()) ||
      r.tipo_lesion.toLowerCase().includes(search.toLowerCase()) ||
      (r.diat_folio && r.diat_folio.toLowerCase().includes(search.toLowerCase()));

    const matchesType = filterType === "ALL" || r.tipo_evento === filterType;
    const matchesGrave = !filterGrave || r.es_grave_o_fatal;

    return matchesSearch && matchesType && matchesGrave;
  });

  const getBadgeStyle = (type: "TRABAJO" | "TRAYECTO" | "INCIDENTE") => {
    switch (type) {
      case "TRABAJO":
        return "bg-red-100 text-red-750 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900";
      case "TRAYECTO":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900";
      case "INCIDENTE":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900";
    }
  };

  const getTipoLabel = (type: "TRABAJO" | "TRAYECTO" | "INCIDENTE") => {
    switch (type) {
      case "TRABAJO":
        return "Acc. Trabajo";
      case "TRAYECTO":
        return "Acc. Trayecto";
      case "INCIDENTE":
        return "Incidente / Casi";
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
              Ley 16.744 - Registro Legal
            </span>
            <span className="bg-slate-800 text-slate-300 text-xs font-semibold px-3 py-1 rounded-full border border-slate-700">
              Circular 3336 SUSESO
            </span>
            <span className="bg-emerald-950 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-800">
              D.S. N° 44 Mutualidades
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
            Investigación de Accidentes y Control Legal DIAT
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
            Gestión integral de siniestros laborales, control perentorio del plazo de 24 horas para la presentación de la DIAT ante mutualidades, activación del protocolo de accidentes graves/fatales y cálculo de índices oficiales de siniestralidad.
          </p>
        </div>
        <button
          onClick={() => router.push("/panel/accidentes/nueva")}
          className="mt-5 md:mt-0 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-orange-600/30 transition-all hover:scale-[1.02] cursor-pointer flex items-center gap-2 shrink-0"
        >
          <span className="text-lg leading-none">+</span> Iniciar Investigación
        </button>
      </div>

      {/* 4 TARJETAS DE MÉTRICAS DE SINIESTRALIDAD (AUDITORÍA NOR-03) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Accidentes Totales (Año Actual) */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              Accidentes Totales
            </span>
            <span className="p-2 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl text-lg">
              🚨
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {stats?.total_accidentes ?? records.filter((r) => r.tipo_evento === "TRABAJO").length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Eventos laborales directos (TRABAJO)</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Total incidentes y trayecto:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {stats?.total_eventos ?? records.length}
            </span>
          </div>
        </div>

        {/* 2. Días Perdidos Totales */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              Días Perdidos Totales
            </span>
            <span className="p-2 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl text-lg">
              📅
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {stats?.total_dias_perdidos ?? records.reduce((acc, r) => acc + (r.dias_perdidos || 0), 0)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>Jornadas de reposo médico acumuladas</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Con tiempo perdido (CTP):</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {stats?.accidentes_con_tiempo_perdido ?? records.filter((r) => r.dias_perdidos > 0).length} casos
            </span>
          </div>
        </div>

        {/* 3. Tasa de Frecuencia (IF) */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block">
                Tasa de Frecuencia (IF)
              </span>
              <span className="text-[10px] font-mono text-slate-400">Fórmula: (CTP × 10⁶) / HHT</span>
            </div>
            <span className="p-2 bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl text-lg">
              📊
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
              {stats?.tasa_frecuencia_if !== undefined ? stats.tasa_frecuencia_if : "0.00"}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Accidentes por millón de horas persona trabajadas
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Base de cálculo HHT:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {stats?.horas_trabajadas_estimadas ? stats.horas_trabajadas_estimadas.toLocaleString() : "200,000"} hrs
            </span>
          </div>
        </div>

        {/* 4. Tasa de Gravedad (IG) */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block">
                Tasa de Gravedad (IG)
              </span>
              <span className="text-[10px] font-mono text-slate-400">Fórmula: (Días Perdidos × 10⁶) / HHT</span>
            </div>
            <span className="p-2 bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl text-lg">
              ⚖️
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-purple-600 dark:text-purple-400">
              {stats?.tasa_gravedad_ig !== undefined ? stats.tasa_gravedad_ig : "0.00"}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Jornadas perdidas por millón de horas trabajadas
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Eventos Graves / Fatales:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded ${
                (stats?.graves_o_fatales_count || 0) > 0
                  ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {stats?.graves_o_fatales_count ?? 0} críticos
            </span>
          </div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="w-full lg:w-96 relative">
          <input
            type="text"
            placeholder="Buscar por afectado, RUT, lugar, folio DIAT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={() => setFilterGrave(!filterGrave)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              filterGrave
                ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20"
                : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
            }`}
          >
            <span>⚠️</span> Solo Graves / Fatales
          </button>

          {["ALL", "TRABAJO", "TRAYECTO", "INCIDENTE"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                filterType === type
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
              }`}
            >
              {type === "ALL" ? "Todos" : type === "TRABAJO" ? "Trabajo" : type === "TRAYECTO" ? "Trayecto" : "Incidentes"}
            </button>
          ))}
        </div>
      </div>

      {/* Listado / Historial con Semáforo DIAT y Protocolo Grave */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 p-4 rounded-xl text-sm text-center font-semibold">
          {error}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 p-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
          No hay investigaciones registradas que coincidan con los filtros aplicados.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3.5">Afectado / RUT</th>
                  <th className="px-6 py-3.5">Clasificación & Gravedad</th>
                  <th className="px-6 py-3.5">Semáforo DIAT (24 Horas)</th>
                  <th className="px-6 py-3.5">Fecha Suceso / Plazo</th>
                  <th className="px-6 py-3.5">Días Perdidos</th>
                  <th className="px-6 py-3.5 text-right">Acciones de Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800/60">
                {filteredRecords.map((r) => {
                  const isGrave = r.es_grave_o_fatal;

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors ${
                        isGrave ? "bg-red-50/20 dark:bg-red-950/10" : ""
                      }`}
                    >
                      {/* Afectado */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {r.nombre_afectado}
                          {isGrave && (
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping" title="Caso Crítico" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {r.rut_afectado} • {r.cargo_afectado}
                        </div>
                        {r.empresa_nombre && (
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                            🏢 {r.empresa_nombre}
                          </div>
                        )}
                      </td>

                      {/* Clasificación y Badge Grave/Fatal */}
                      <td className="px-6 py-4 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${getBadgeStyle(r.tipo_evento)}`}>
                            {getTipoLabel(r.tipo_evento)}
                          </span>
                        </div>

                        {/* BADGE VISUAL ROJO PARPADEANTE SI ES GRAVE / FATAL */}
                        {isGrave && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide bg-red-600 text-white animate-pulse shadow-sm shadow-red-600/30">
                              <span>⚠️</span> ACCIDENTE GRAVE / FATAL
                            </span>

                            <div className="flex flex-col gap-0.5 text-[11px]">
                              {r.faena_suspendida ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                  <span>🛑</span> Faena Auto-Suspendida
                                </span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                                  <span>⚠️</span> Faena NO Suspendida
                                </span>
                              )}

                              {r.aviso_autoridades_realizado ? (
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                  ✓ Aviso DT: {r.aviso_autoridades_folio || "Realizado"}
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  🚨 Aviso a Autoridades Pendiente
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* SEMÁFORO DE 24 HORAS PARA PRESENTACIÓN DE LA DIAT */}
                      <td className="px-6 py-4">
                        {r.diat_presentada ? (
                          /* 🟢 DIAT Presentada */
                          <div className="inline-flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              DIAT Formalizada
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5 pl-1">
                              Folio: {r.diat_folio || "Sin folio"}
                            </span>
                          </div>
                        ) : r.diat_vencida ? (
                          /* 🔴 DIAT Vencida (> 24h) */
                          <div className="inline-flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                              DIAT Vencida (&gt;24h)
                            </span>
                            <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold pl-1">
                              Riesgo multa Art. 76 Ley 16.744
                            </span>
                          </div>
                        ) : (
                          /* 🟡 Tiempo Restante (< 24h) */
                          <div className="inline-flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              En Plazo: {r.horas_restantes_diat > 0 ? `${r.horas_restantes_diat}h rest.` : "&lt; 24h"}
                            </span>
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 pl-1">
                              Formalizar ante Mutual
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Fecha Evento y Plazo Límite */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {new Date(r.fecha_hora_evento).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(r.fecha_hora_evento).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} hrs
                        </div>
                        {r.plazo_limite_diat_24h && (
                          <div className="text-[11px] text-slate-400 mt-1 font-mono">
                            Plazo: {new Date(r.plazo_limite_diat_24h).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </td>

                      {/* Días Perdidos / Licencia */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {r.dias_perdidos} {r.dias_perdidos === 1 ? "día" : "días"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.alta_medica ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Alta Médica</span>
                          ) : (
                            <span>En reposo laboral</span>
                          )}
                        </div>
                      </td>

                      {/* Acciones de Compliance */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Botón rápido DIAT */}
                          <button
                            onClick={() => handleOpenDiatModal(r)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              r.diat_presentada
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            }`}
                            title="Registrar o editar Folio DIAT"
                          >
                            {r.diat_presentada ? "Ver DIAT" : "Registrar DIAT"}
                          </button>

                          {/* Botón rápido Protocolo Circular 3336 */}
                          <button
                            onClick={() => handleOpenProtocoloModal(r)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isGrave
                                ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                            }`}
                            title="Protocolo Accidente Grave (Circular 3336)"
                          >
                            Protocolo
                          </button>

                          {/* Ver Ficha Detallada */}
                          <button
                            onClick={() => router.push(`/panel/accidentes/${r.id}`)}
                            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 font-semibold text-xs px-2 py-1.5 cursor-pointer"
                          >
                            Ficha
                          </button>

                          {/* Eliminar */}
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-red-500 hover:text-red-700 text-xs px-1.5 py-1.5 cursor-pointer"
                            title="Eliminar registro"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTRAR FOLIO DIAT (PLAZO LEGAL 24H) */}
      {diatModalAccident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                  D.S. N° 44 • Plazo 24 Horas
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  Formalizar DIAT ante Mutualidad
                </h3>
              </div>
              <button
                onClick={() => setDiatModalAccident(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl text-xs space-y-1.5 border border-slate-200 dark:border-slate-800">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Afectado: <span className="font-normal">{diatModalAccident.nombre_afectado} ({diatModalAccident.rut_afectado})</span>
              </div>
              <div className="text-slate-500">
                Fecha del Accidente:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {new Date(diatModalAccident.fecha_hora_evento).toLocaleString()}
                </span>
              </div>
              {diatModalAccident.plazo_limite_diat_24h && (
                <div className="text-slate-500">
                  Plazo Límite Legal (24h):{" "}
                  <span className="font-mono text-orange-600 dark:text-orange-400 font-bold">
                    {new Date(diatModalAccident.plazo_limite_diat_24h).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveDiat} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Folio DIAT Emitido por la Mutualidad *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ACHS-2026-98124, MUTUAL-88412..."
                  value={diatFolioInput}
                  onChange={(e) => setDiatFolioInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Número de folio o comprobante emitido en la plataforma web de la mutual administradora.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Fecha y Hora de Presentación Formal
                </label>
                <input
                  type="datetime-local"
                  value={diatFechaInput}
                  onChange={(e) => setDiatFechaInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDiatModalAccident(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDiat}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  {savingDiat ? "Guardando..." : "Guardar DIAT"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROTOCOLO ACCIDENTE GRAVE O FATAL (CIRCULAR 3336 SUSESO / ART. 76 LEY 16.744) */}
      {protocoloModalAccident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                  Art. 76 Ley 16.744 • Circular 3336
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  Protocolo Accidente Grave o Fatal
                </h3>
              </div>
              <button
                onClick={() => setProtocoloModalAccident(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-red-50 dark:bg-red-950/20 p-3.5 rounded-xl border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 space-y-1">
              <div className="font-bold">⚠️ Obligaciones Legales Inmediatas del Empleador:</div>
              <div>1. Suspender de forma inmediata la faena o puesto de trabajo afectado.</div>
              <div>2. Evacuar a los trabajadores si existe riesgo residual.</div>
              <div>3. Dar aviso inmediato a la Inspección del Trabajo y Seremi de Salud.</div>
            </div>

            <form onSubmit={handleSaveProtocolo} className="space-y-4">
              {/* Es Grave o Fatal */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">
                    Clasificar como Accidente Grave / Fatal
                  </span>
                  <span className="text-xs text-slate-500">
                    Activa la trazabilidad especial y auditoría Circular 3336.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={protoEsGrave}
                  onChange={(e) => setProtoEsGrave(e.target.checked)}
                  className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                />
              </div>

              {/* Tipo de Accidente Grave */}
              {protoEsGrave && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Criterio de Gravedad (Circular 3336 SUSESO)
                  </label>
                  <select
                    value={protoTipoGrave}
                    onChange={(e) => setProtoTipoGrave(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="CAIDA_ALTURA">Caída de distinto nivel (sobre 1.8 metros)</option>
                    <option value="AMPUTACION">Amputación o pérdida traumática de parte del cuerpo</option>
                    <option value="ATRAPAMIENTO_ASFIXIA">Atrapamiento, asfixia o inmersión</option>
                    <option value="MANIOBRAS_REANIMACION">Accidente que requirió maniobras de RCP / Resucitación</option>
                    <option value="FALLECIMIENTO">Accidente con consecuencia fatal inmediata</option>
                    <option value="OTRO_GRAVE">Otro evento de gravedad crítica con compromiso vital</option>
                  </select>
                </div>
              )}

              {/* Checklist de Auto-suspensión de Faena */}
              <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <input
                  type="checkbox"
                  id="chk-faena"
                  checked={protoFaenaSuspendida}
                  onChange={(e) => setProtoFaenaSuspendida(e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-red-600 rounded cursor-pointer"
                />
                <label htmlFor="chk-faena" className="cursor-pointer text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    🛑 Auto-suspensión inmediata obligatoria de faena ejecutada
                  </span>
                  <span className="text-slate-500">
                    El empleador detuvo las labores en el área afectada para resguardar la vida y salud de los trabajadores.
                  </span>
                </label>
              </div>

              {/* Checklist de Notificación a Autoridades */}
              <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <input
                  type="checkbox"
                  id="chk-aviso"
                  checked={protoAvisoRealizado}
                  onChange={(e) => setProtoAvisoRealizado(e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-red-600 rounded cursor-pointer"
                />
                <label htmlFor="chk-aviso" className="cursor-pointer text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    📢 Aviso formal inmediato a Inspección del Trabajo y Seremi de Salud
                  </span>
                  <span className="text-slate-500">
                    Notificación cursada vía portal DT / Seremi o teléfono de emergencias SUSESO.
                  </span>
                </label>
              </div>

              {/* Folio de Aviso a Autoridades */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Folio o Código de Notificación (DT / Seremi)
                </label>
                <input
                  type="text"
                  placeholder="Ej: NOTIF-DT-884920, SEREMI-VAL-2026..."
                  value={protoAvisoFolio}
                  onChange={(e) => setProtoAvisoFolio(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Días Perdidos y Alta Médica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Días de Reposo / Licencia Médica
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={protoDiasPerdidos}
                    onChange={(e) => setProtoDiasPerdidos(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Impacta la Tasa de Gravedad (IG).</p>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer pt-4 sm:pt-0">
                    <input
                      type="checkbox"
                      checked={protoAltaMedica}
                      onChange={(e) => setProtoAltaMedica(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Alta Médica Emitida por Mutualidad
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setProtocoloModalAccident(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProtocolo}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  {savingProtocolo ? "Guardando..." : "Guardar Protocolo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
