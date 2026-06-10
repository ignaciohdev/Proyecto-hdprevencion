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
  fecha_creacion: string;
}

export default function AccidentesPage() {
  const router = useRouter();
  const [records, setRecords] = useState<AccidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const res = await fetch(getApiUrl("/api/accidentes/"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Error al obtener el historial de investigaciones.");
      const data = await res.json();
      setRecords(data);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta investigación? Esta acción no se puede deshacer.")) return;
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(getApiUrl(`/api/accidentes/${id}/`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Error al eliminar la investigación.");
      fetchRecords();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtrado de registros
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.nombre_afectado.toLowerCase().includes(search.toLowerCase()) ||
      r.rut_afectado.toLowerCase().includes(search.toLowerCase()) ||
      r.lugar_evento.toLowerCase().includes(search.toLowerCase()) ||
      r.tipo_lesion.toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType === "ALL" || r.tipo_evento === filterType;

    return matchesSearch && matchesType;
  });

  // Métricas
  const totalCases = records.length;
  const trabajoCount = records.filter((r) => r.tipo_evento === "TRABAJO").length;
  const trayectoCount = records.filter((r) => r.tipo_evento === "TRAYECTO").length;
  const incidentesCount = records.filter((r) => r.tipo_evento === "INCIDENTE").length;

  const getBadgeStyle = (type: "TRABAJO" | "TRAYECTO" | "INCIDENTE") => {
    switch (type) {
      case "TRABAJO":
        return "bg-red-100 text-red-750 dark:bg-red-950/35 dark:text-red-400 border-red-200";
      case "TRAYECTO":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950/35 dark:text-amber-400 border-amber-200";
      case "INCIDENTE":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/35 dark:text-blue-400 border-blue-200";
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
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
            Ley 16.744 - Registro Legal
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
            Investigación de Accidentes e Incidentes
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            Realiza el análisis de causas mediante la técnica de los 5 Porqués y gestiona las medidas correctivas inmediatas para mitigar la siniestralidad.
          </p>
        </div>
        <button
          onClick={() => router.push("/panel/accidentes/nueva")}
          className="mt-4 md:mt-0 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer"
        >
          + Iniciar Investigación
        </button>
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Casos</span>
          <span className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">{totalCases}</span>
        </div>

        {/* Trabajo */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Acc. Trabajo</span>
          <span className="text-3xl font-extrabold text-red-500 mt-2">{trabajoCount}</span>
        </div>

        {/* Trayecto */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Acc. Trayecto</span>
          <span className="text-3xl font-extrabold text-amber-500 mt-2">{trayectoCount}</span>
        </div>

        {/* Incidentes */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Incidentes</span>
          <span className="text-3xl font-extrabold text-blue-500 mt-2">{incidentesCount}</span>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-96 relative">
          <input
            type="text"
            placeholder="Buscar por afectado, RUT, sucursal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex space-x-2 w-full md:w-auto justify-end">
          {["ALL", "TRABAJO", "TRAYECTO", "INCIDENTE"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                filterType === type
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-550 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
              }`}
            >
              {type === "ALL" ? "Todos" : type === "TRABAJO" ? "Trabajo" : type === "TRAYECTO" ? "Trayecto" : "Incidentes"}
            </button>
          ))}
        </div>
      </div>

      {/* Listado / Historial */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border border-red-200 p-4 rounded-xl text-sm text-center font-semibold">
          {error}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800/80 text-slate-400 text-sm">
          No hay investigaciones registradas que coincidan con los filtros de búsqueda.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800/60">
                  <th className="px-6 py-3">Afectado / RUT</th>
                  <th className="px-6 py-3">Clasificación</th>
                  <th className="px-6 py-3">Fecha Suceso</th>
                  <th className="px-6 py-3">Ubicación</th>
                  <th className="px-6 py-3">Lesión / Gravedad</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800/60">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{r.nombre_afectado}</div>
                      <div className="text-xs text-slate-500">{r.rut_afectado} | {r.cargo_afectado}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${getBadgeStyle(r.tipo_evento)}`}>
                        {getTipoLabel(r.tipo_evento)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>{new Date(r.fecha_hora_evento).toLocaleDateString()}</div>
                      <div className="text-xs text-slate-500">{new Date(r.fecha_hora_evento).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hrs</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                      {r.lugar_evento}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{r.tipo_lesion}</div>
                      <div className="text-xs text-slate-500">Zonas: {r.parte_cuerpo_afectada}</div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => router.push(`/panel/accidentes/${r.id}`)}
                        className="text-orange-655 hover:text-orange-500 font-semibold cursor-pointer"
                      >
                        Ver Ficha
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-500 hover:text-red-450 font-semibold cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
