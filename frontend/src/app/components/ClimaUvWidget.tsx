"use client";

import React, { useEffect, useState, useId } from "react";
import { getApiUrl } from "../utils/api";

export interface ClimaUvData {
  ciudad: string;
  faena_nombre?: string | null;
  empresa_nombre?: string | null;
  fecha: string;
  hora_consulta: string;
  uv_actual: number;
  uv_max_dia: number;
  nivel_uv: "BAJO" | "MODERADO" | "ALTO" | "MUY_ALTO" | "EXTREMO";
  nivel_uv_display: string;
  color_hex: string;
  temperatura: number;
  sensacion_termica: number;
  humedad: number;
  estres_termico_alerta: boolean;
  medidas_legales_ds594: string[];
  hora_inicio_peligro: string;
  hora_fin_peligro: string;
}

interface ClimaUvWidgetProps {
  centroTrabajoId?: number | null;
  comunaInicial?: string;
  nombreFaena?: string;
  nombreEmpresa?: string;
  className?: string;
}

const CIUDADES_PREDETERMINADAS = [
  "Santiago",
  "Antofagasta",
  "Calama",
  "Concepción",
  "Valparaíso",
  "Puerto Montt",
  "Iquique",
  "Copiapó",
  "Rancagua",
  "La Serena"
];

export function ClimaUvWidget({
  centroTrabajoId,
  comunaInicial = "Santiago",
  nombreFaena,
  nombreEmpresa,
  className = ""
}: ClimaUvWidgetProps) {
  const [data, setData] = useState<ClimaUvData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCiudad, setSelectedCiudad] = useState<string>(comunaInicial);
  const [showMuralModal, setShowMuralModal] = useState<boolean>(false);
  const gradientId = useId();

  const fetchClima = async (comuna: string, centroId?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      let url = getApiUrl("/api/clima/radiacion-uv/");
      const params = new URLSearchParams();
      if (centroId) {
        params.append("centro_trabajo_id", centroId.toString());
      } else if (comuna) {
        params.append("comuna", comuna);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo obtener los datos meteorológicos.`);
      }
      const json: ClimaUvData = await res.json();
      if (nombreFaena && !json.faena_nombre) json.faena_nombre = nombreFaena;
      if (nombreEmpresa && !json.empresa_nombre) json.empresa_nombre = nombreEmpresa;
      setData(json);
    } catch (err: any) {
      setError(err.message || "Error al conectar con la estación meteorológica.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClima(selectedCiudad, centroTrabajoId);
  }, [selectedCiudad, centroTrabajoId]);

  // Cálculos visuales del Tacómetro UV (0 a 14)
  const maxScale = 14;
  const uvValue = data ? Math.min(Math.max(data.uv_max_dia, 0), maxScale) : 0;
  const arcLength = Math.PI * 60; // r=60 -> aprox 188.5
  const strokeOffset = arcLength - (uvValue / maxScale) * arcLength;

  return (
    <>
      {/* ========================================================================= */}
      {/* TARJETA PRINCIPAL DEL WIDGET CLIMA Y RADIACIÓN UV (D.S. 594)              */}
      {/* ========================================================================= */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 shadow-xl text-white transition-all hover:border-slate-700 ${className}`}
      >
        {/* Glow dinámico de fondo con el color del nivel UV */}
        <div
          className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700"
          style={{ backgroundColor: data?.color_hex || "#eab308" }}
        />

        {/* Encabezado del Widget */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">☀️</span>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                Semáforo Radiación Solar UV
              </span>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                D.S. 594 Art. 109
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white mt-1">
              Monitoreo Meteorológico y Estrés Térmico
            </h3>
          </div>

          {/* Selector de Faena / Ciudad */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCiudad}
              onChange={(e) => setSelectedCiudad(e.target.value)}
              className="bg-slate-950/80 text-xs font-bold text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {CIUDADES_PREDETERMINADAS.map((c) => (
                <option key={c} value={c} className="bg-slate-900 text-white">
                  📍 {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contenido Dinámico */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Sincronizando con estación satelital Open-Meteo...</p>
          </div>
        ) : error || !data ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs text-rose-400 font-semibold">{error || "No se obtuvieron datos."}</p>
            <button
              onClick={() => fetchClima(selectedCiudad, centroTrabajoId)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg transition-colors"
            >
              Reintentar sincronización
            </button>
          </div>
        ) : (
          <div className="relative z-10 pt-5 space-y-5">
            {/* Fila Central: Dial Tacómetro UV + Medidores Ambientales */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              
              {/* Dial UV */}
              <div className="md:col-span-6 flex flex-col items-center justify-center p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                <div className="relative w-44 h-24 flex items-end justify-center overflow-hidden">
                  <svg className="w-44 h-44 -rotate-180" viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      stroke="currentColor"
                      className="text-slate-800"
                      strokeWidth="12"
                      strokeDasharray={`${arcLength} ${arcLength}`}
                      fill="transparent"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      stroke={data.color_hex}
                      strokeWidth="12"
                      strokeDasharray={`${arcLength} ${arcLength}`}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>

                  {/* Valor Central */}
                  <div className="absolute bottom-1 flex flex-col items-center text-center">
                    <span className="text-3xl font-black font-mono tracking-tight text-white leading-none">
                      {data.uv_max_dia.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">
                      Índice UV Máx
                    </span>
                  </div>
                </div>

                {/* Badge Nivel UV */}
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-md"
                    style={{
                      backgroundColor: `${data.color_hex}25`,
                      color: data.color_hex,
                      border: `1px solid ${data.color_hex}50`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full animate-ping"
                      style={{ backgroundColor: data.color_hex }}
                    />
                    Nivel {data.nivel_uv_display}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    (Actual: {data.uv_actual.toFixed(1)})
                  </span>
                </div>
              </div>

              {/* Parámetros Ambientales + Horario */}
              <div className="md:col-span-6 grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <span>🌡️</span> Temperatura
                  </span>
                  <div className="text-xl font-mono font-extrabold text-white mt-1">
                    {data.temperatura}°C
                  </div>
                  <span className="text-[10px] text-slate-500">Aire a 2m</span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <span>🔥</span> Sensación Térmica
                  </span>
                  <div
                    className={`text-xl font-mono font-extrabold mt-1 ${
                      data.sensacion_termica >= 32 ? "text-rose-400" : "text-white"
                    }`}
                  >
                    {data.sensacion_termica}°C
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {data.sensacion_termica >= 32 ? "Estrés Térmico Activo" : "Normal"}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <span>💧</span> Humedad Relativa
                  </span>
                  <div className="text-xl font-mono font-extrabold text-white mt-1">
                    {data.humedad}%
                  </div>
                  <span className="text-[10px] text-slate-500">Ambiente laboral</span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                    <span>⏰</span> Horario Crítico
                  </span>
                  <div className="text-xs font-mono font-black text-amber-300 mt-1">
                    {data.hora_inicio_peligro} - {data.hora_fin_peligro}
                  </div>
                  <span className="text-[10px] text-slate-500">Mayor radiación</span>
                </div>
              </div>
            </div>

            {/* Alerta de Estrés Térmico ISO 2024 (si aplica) */}
            {data.estres_termico_alerta && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/50 rounded-2xl flex items-start gap-3 shadow-lg shadow-rose-950/30">
                <span className="text-xl shrink-0 animate-bounce">🚨</span>
                <div className="text-xs text-rose-200">
                  <strong className="text-white uppercase font-extrabold tracking-wide">
                    Alerta de Estrés Térmico por Calor (Enmienda Oficial ISO 2024):
                  </strong>{" "}
                  Sensación térmica superó los 32°C. Es mandatorio habilitar puntos de hidratación
                  con consumo de 1 vaso de agua fresca cada 15-20 minutos y proveer zonas de sombra
                  o descanso climatizadas.
                </div>
              </div>
            )}

            {/* Medidas de Protección D.S. 594 Activas */}
            <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>🛡️</span> Medidas Preventivas Obligatorias de la Faena (D.S. 594):
              </span>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                {data.medidas_legales_ds594.map((medida, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✓</span>
                    <span>{medida}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Botón de Acción Principal: Imprimir Cartel Mural */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Actualizado hoy a las {data.hora_consulta} hrs • {data.ciudad}, Chile
              </span>

              <button
                type="button"
                onClick={() => setShowMuralModal(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🖨️</span>
                <span>Generar Cartel Mural D.S. 594</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL PRINTABLE: CARTEL MURAL OFICIAL D.S. N° 594                        */}
      {/* ========================================================================= */}
      {showMuralModal && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
          <div className="bg-white text-slate-900 border border-slate-300 rounded-3xl max-w-4xl w-full shadow-2xl my-6 overflow-hidden print:border-none print:shadow-none print:rounded-none print:max-w-none print:m-0">
            
            {/* Barra superior de herramientas (oculta al imprimir) */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Cartel Mural Oficial D.S. 594 Art. 109
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  • Formato Legal Imprimible MINSAL / Dirección del Trabajo
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 rounded-xl text-xs font-black transition-all shadow-sm flex items-center space-x-2 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Imprimir Cartel Mural / Guardar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMuralModal(false)}
                  className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
                  aria-label="Cerrar"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* CUERPO DEL CARTEL MURAL (OPTIMIZADO PARA PAPEL CARTA / A4) */}
            <div className="p-8 sm:p-10 space-y-6 bg-white text-slate-900 print:p-8">
              
              {/* Encabezado Oficial Institucional */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    República de Chile • Ministerio de Salud • Dirección del Trabajo
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight mt-0.5">
                    Cartel Mural Diario: Radiación Solar Ultravioleta (UV)
                  </h1>
                  <p className="text-xs text-slate-600 font-semibold mt-0.5">
                    Exhibición diaria obligatoria en faena conforme al Artículo 109 del D.S. N° 594 y Ley N° 20.096.
                  </p>
                </div>
                <div className="text-right sm:border-l sm:border-slate-300 sm:pl-6 shrink-0">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Fecha de Publicación</div>
                  <div className="text-base font-black font-mono text-slate-950">{data.fecha}</div>
                  <div className="text-[10px] text-slate-600 font-medium">Hora de Emisión: {data.hora_consulta} hrs</div>
                </div>
              </div>

              {/* Ficha de Identificación de Faena */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Empresa</span>
                  <span className="font-bold text-slate-900">{data.empresa_nombre || "Empresa Principal"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Centro / Faena</span>
                  <span className="font-bold text-slate-900">{data.faena_nombre || data.ciudad}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Comuna / Región</span>
                  <span className="font-bold text-slate-900">{data.ciudad}, Chile</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Horario Mayor Exposición</span>
                  <span className="font-bold text-rose-700">{data.hora_inicio_peligro} a {data.hora_fin_peligro} hrs</span>
                </div>
              </div>

              {/* SEMÁFORO GRÁFICO OFICIAL D.S. 594 */}
              <div className="space-y-3">
                <div className="text-center text-xs font-black uppercase tracking-wider text-slate-700">
                  Escala Legal de Riesgo D.S. 594 (Semáforo de Radiación UV)
                </div>

                <div className="grid grid-cols-5 gap-2 text-center">
                  {/* Nivel 1: Bajo */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      data.nivel_uv === "BAJO"
                        ? "bg-emerald-500 text-white border-emerald-600 ring-4 ring-emerald-300 font-black shadow-md scale-105"
                        : "bg-emerald-50 text-emerald-950 border-emerald-200 opacity-60"
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-tight">1 - 2</div>
                    <div className="text-xs font-extrabold uppercase mt-0.5">Bajo</div>
                    <div className="text-[9px] mt-1 leading-tight hidden sm:block">Sin riesgo</div>
                  </div>

                  {/* Nivel 2: Moderado */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      data.nivel_uv === "MODERADO"
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-4 ring-amber-300 font-black shadow-md scale-105"
                        : "bg-amber-50 text-amber-950 border-amber-200 opacity-60"
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-tight">3 - 5</div>
                    <div className="text-xs font-extrabold uppercase mt-0.5">Moderado</div>
                    <div className="text-[9px] mt-1 leading-tight hidden sm:block">FPS 30+</div>
                  </div>

                  {/* Nivel 3: Alto */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      data.nivel_uv === "ALTO"
                        ? "bg-orange-500 text-white border-orange-600 ring-4 ring-orange-300 font-black shadow-md scale-105"
                        : "bg-orange-50 text-orange-950 border-orange-200 opacity-60"
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-tight">6 - 7</div>
                    <div className="text-xs font-extrabold uppercase mt-0.5">Alto</div>
                    <div className="text-[9px] mt-1 leading-tight hidden sm:block">FPS 50+ Cubrenuca</div>
                  </div>

                  {/* Nivel 4: Muy Alto */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      data.nivel_uv === "MUY_ALTO"
                        ? "bg-rose-600 text-white border-rose-700 ring-4 ring-rose-300 font-black shadow-md scale-105"
                        : "bg-rose-50 text-rose-950 border-rose-200 opacity-60"
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-tight">8 - 10</div>
                    <div className="text-xs font-extrabold uppercase mt-0.5">Muy Alto</div>
                    <div className="text-[9px] mt-1 leading-tight hidden sm:block">Pausas en Sombra</div>
                  </div>

                  {/* Nivel 5: Extremo */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      data.nivel_uv === "EXTREMO"
                        ? "bg-purple-700 text-white border-purple-800 ring-4 ring-purple-300 font-black shadow-md scale-105"
                        : "bg-purple-50 text-purple-950 border-purple-200 opacity-60"
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-tight">11+</div>
                    <div className="text-xs font-extrabold uppercase mt-0.5">Extremo</div>
                    <div className="text-[9px] mt-1 leading-tight hidden sm:block">Alerta Crítica</div>
                  </div>
                </div>
              </div>

              {/* BLOQUE DESTACADO DEL VALOR DEL DÍA */}
              <div
                className="p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
                style={{
                  backgroundColor: `${data.color_hex}15`,
                  borderColor: data.color_hex,
                }}
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Proyección Oficial para la Jornada
                  </span>
                  <div className="text-3xl font-black text-slate-950">
                    Índice UV Máximo: <span style={{ color: data.color_hex }}>{data.uv_max_dia.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium mt-1">
                    Clasificación de Exposición Legal: <strong className="uppercase">{data.nivel_uv_display}</strong>
                  </p>
                </div>

                <div className="text-right sm:border-l sm:border-slate-300 sm:pl-6 shrink-0">
                  <div className="text-[11px] text-slate-600 font-semibold">Condiciones Ambientales:</div>
                  <div className="text-sm font-black font-mono text-slate-950">
                    {data.temperatura}°C • Sensación {data.sensacion_termica}°C
                  </div>
                  <div className="text-[11px] text-slate-600">Humedad: {data.humedad}%</div>
                </div>
              </div>

              {/* Alerta de Estrés Térmico (ISO 2024) */}
              {data.estres_termico_alerta && (
                <div className="p-3 bg-rose-100 border border-rose-400 rounded-xl text-xs text-rose-950 flex items-start gap-2">
                  <span className="text-base font-bold text-rose-700 shrink-0">⚠️</span>
                  <div>
                    <strong className="uppercase">Alerta de Estrés Térmico Activa (Enmienda Oficial ISO 2024):</strong>{" "}
                    Sensación térmica superior a 32°C. Es obligatorio implementar rondas de hidratación
                    de 1 vaso de agua fresca (10-15°C) cada 15 a 20 minutos y disponer de áreas de descanso
                    climatizadas o sombreadas.
                  </div>
                </div>
              )}

              {/* Medidas de Protección Legal Obligatoria para Trabajadores */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b pb-1">
                  Medidas de Protección Personal y Colectiva Obligatorias:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-800">
                  {data.medidas_legales_ds594.map((medida, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2">
                      <span className="text-amber-600 font-bold">▶</span>
                      <span>{medida}</span>
                    </div>
                  ))}
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2">
                    <span className="text-amber-600 font-bold">▶</span>
                    <span>Consumo libre y continuo de agua potable fresca para todo el personal.</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2">
                    <span className="text-amber-600 font-bold">▶</span>
                    <span>Informar inmediatamente al jefe directo o prevencionista ante síntomas de mareo o calambres.</span>
                  </div>
                </div>
              </div>

              {/* BLOQUE DE FIRMA Y RESPONSABILIDAD TÉCNICA */}
              <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-b border-dashed border-slate-400 pb-12 mb-2"></div>
                  <span className="block font-black text-slate-900 uppercase">
                    Firma Prevencionista de Riesgos
                  </span>
                  <span className="block text-[10px] text-slate-600">
                    Registro SNS / SEREMI de Salud • D.S. N° 594
                  </span>
                </div>

                <div>
                  <div className="border-b border-dashed border-slate-400 pb-12 mb-2"></div>
                  <span className="block font-black text-slate-900 uppercase">
                    Representante CPHS / Supervisor de Faena
                  </span>
                  <span className="block text-[10px] text-slate-600">
                    Constancia de Publicación Diaria en Faena
                  </span>
                </div>
              </div>

              {/* Pie Legal */}
              <div className="text-[9px] text-slate-500 text-center pt-2">
                Documento generado por HD Prevención conforme al Art. 109 del D.S. 594 del Ministerio de Salud
                y la Enmienda ISO 2024 sobre factores climáticos y estrés térmico en el trabajo.
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ClimaUvWidget;
