"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "../../../../utils/api";

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
  causas_inmediatas: {
    actos_subestandar?: string;
    condiciones_subestandar?: string;
  };
  causas_basicas: {
    factores_personales?: string;
    factores_trabajo?: string;
  };
  analisis_5_porques: string[];
  plan_accion: ActionItem[];
  // Compliance Legal
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

export default function DetalleAccidentePage() {
  const params = useParams();
  const router = useRouter();
  const accId = params.id as string;

  const [record, setRecord] = useState<AccidentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Cargar el registro del accidente
        const res = await authFetch(getApiUrl(`/api/accidentes/${accId}/`));
        if (!res.ok) throw new Error("No se pudo obtener el expediente de investigación.");
        const data = await res.json();
        setRecord(data);

        // 2. Cargar perfil para ver marca de agua / marca blanca
        const resUser = await authFetch(getApiUrl("/api/usuarios/perfil/"));
        if (resUser.ok) {
          const userData = await resUser.json();
          setUserPlan(userData.suscripcion_activa);
        }
      } catch (err: any) {
        setError(err.message || "Error al cargar la información.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-semibold">Generando expediente de investigación...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border border-red-200 p-4 rounded-xl text-sm text-center font-semibold max-w-xl mx-auto">
        {error || "Expediente no encontrado."}
      </div>
    );
  }

  const getTipoLabel = (type: "TRABAJO" | "TRAYECTO" | "INCIDENTE") => {
    switch (type) {
      case "TRABAJO":
        return "Accidente del Trabajo (Ley 16.744)";
      case "TRAYECTO":
        return "Accidente de Trayecto (In itinere)";
      case "INCIDENTE":
        return "Incidente / Casi Accidente (Sin Lesión)";
    }
  };

  const hasWatermark = userPlan ? userPlan.marca_agua : true;
  const isWhiteLabel = userPlan ? userPlan.marca_blanca : false;

  return (
    <div className="space-y-6 print:space-y-0 print:p-0">
      
      {/* Barra de herramientas superior - Se oculta al imprimir */}
      <div className="flex justify-between items-center print:hidden bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => router.push("/panel/accidentes")}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold text-sm flex items-center space-x-1 cursor-pointer"
        >
          <span>← Volver al Historial</span>
        </button>

        <div className="flex space-x-3">
          <button
            onClick={() => window.print()}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-md"
          >
            <span>🖨️</span>
            <span>Imprimir / Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* EXPEDIENTE IMPRIMIBLE - TAMAÑO A4 / CARTA */}
      <div className="relative bg-white text-slate-900 p-8 md:p-12 rounded-2xl shadow-xl border border-slate-200 max-w-4xl mx-auto print:shadow-none print:border-none print:p-0 print:m-0 print:text-black">
        
        {/* CAPA DE MARCA DE AGUA (Si el plan lo exige) */}
        {hasWatermark && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10 opacity-10">
            <div className="text-red-650 font-black text-6xl md:text-8xl tracking-widest uppercase select-none pointer-events-none transform -rotate-45 whitespace-nowrap">
              HD PREVENCIÓN • HD PREVENCIÓN
            </div>
          </div>
        )}

        {/* CABECERA OFICIAL */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            {!isWhiteLabel ? (
              <div className="text-orange-600 font-extrabold text-lg tracking-wider mb-1">
                HD PREVENCIÓN
              </div>
            ) : (
              <div className="text-slate-400 text-xs italic mb-1">[Marca Blanca Activa]</div>
            )}
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Departamento de Prevención de Riesgos
            </div>
          </div>
          <div className="text-center md:text-right">
            <h1 className="text-xl font-black text-slate-900 uppercase">Ficha de Investigación</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Expediente ID: #{record.id}</p>
          </div>
        </div>

        {/* TÍTULO DEL INFORME */}
        <div className="text-center bg-slate-100 p-3 rounded-lg mb-6 border border-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            INFORME OFICIAL DE INVESTIGACIÓN DE SINIESTROS
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-semibold">{getTipoLabel(record.tipo_evento)}</p>
        </div>

        {/* SECCIÓN A: IDENTIFICACIÓN DEL AFECTADO */}
        <div className="space-y-3 mb-6 break-inside-avoid">
          <h3 className="text-xs font-black uppercase text-slate-900 bg-slate-50 px-2 py-1 rounded border-l-4 border-slate-900">
            A. Datos del Afectado
          </h3>
          <table className="w-full text-xs border border-slate-200 text-left">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200 w-1/4">Nombre Completo:</td>
                <td className="p-2 border-r border-slate-200 w-1/4">{record.nombre_afectado}</td>
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200 w-1/4">RUT / ID:</td>
                <td className="p-2">{record.rut_afectado}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200">Cargo / Puesto:</td>
                <td className="p-2 border-r border-slate-200">{record.cargo_afectado}</td>
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200">Edad Afectado:</td>
                <td className="p-2">{record.edad_afectado} años</td>
              </tr>
              <tr>
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200">Antigüedad:</td>
                <td className="p-2 border-r border-slate-200" colSpan={3}>{record.antiguedad_afectado}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECCIÓN B: DETALLES DEL EVENTO */}
        <div className="space-y-3 mb-6 break-inside-avoid">
          <h3 className="text-xs font-black uppercase text-slate-900 bg-slate-50 px-2 py-1 rounded border-l-4 border-slate-900">
            B. Detalles del Siniestro y Diagnóstico Inicial
          </h3>
          <table className="w-full text-xs border border-slate-200 text-left">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200 w-1/4">Fecha y Hora Evento:</td>
                <td className="p-2 border-r border-slate-200 w-1/4">
                  {new Date(record.fecha_hora_evento).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })} hrs
                </td>
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200 w-1/4">Lugar Físico:</td>
                <td className="p-2">{record.lugar_evento}</td>
              </tr>
              <tr>
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200">Lesión Presentada:</td>
                <td className="p-2 border-r border-slate-200">{record.tipo_lesion}</td>
                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200">Parte Afectada:</td>
                <td className="p-2">{record.parte_cuerpo_afectada}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECCIÓN C: RELATO CRONOLÓGICO */}
        <div className="space-y-3 mb-6 break-inside-avoid">
          <h3 className="text-xs font-black uppercase text-slate-900 bg-slate-50 px-2 py-1 rounded border-l-4 border-slate-900">
            C. Descripción e Historia del Accidente
          </h3>
          <div className="p-3 border border-slate-200 rounded text-xs leading-relaxed text-justify whitespace-pre-line">
            {record.descripcion_evento}
          </div>
        </div>

        {/* SECCIÓN D: ANÁLISIS DE CAUSAS */}
        <div className="space-y-4 mb-6 break-inside-avoid">
          <h3 className="text-xs font-black uppercase text-slate-900 bg-slate-50 px-2 py-1 rounded border-l-4 border-slate-900">
            D. Análisis de Causas y Desglose Sistémico
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inmediatas */}
            <div className="border border-slate-200 rounded p-3 space-y-2">
              <h4 className="font-bold text-xs text-slate-800 uppercase border-b pb-1">Causas Inmediatas</h4>
              <p className="text-xs text-slate-500"><strong className="text-slate-800">Actos Subestándar:</strong> {record.causas_inmediatas?.actos_subestandar || "No reporta."}</p>
              <p className="text-xs text-slate-500"><strong className="text-slate-800">Condiciones Subestándar:</strong> {record.causas_inmediatas?.condiciones_subestandar || "No reporta."}</p>
            </div>
            
            {/* Básicas */}
            <div className="border border-slate-200 rounded p-3 space-y-2">
              <h4 className="font-bold text-xs text-slate-800 uppercase border-b pb-1">Causas Básicas</h4>
              <p className="text-xs text-slate-500"><strong className="text-slate-800">Factores Personales:</strong> {record.causas_basicas?.factores_personales || "No reporta."}</p>
              <p className="text-xs text-slate-500"><strong className="text-slate-800">Factores del Trabajo:</strong> {record.causas_basicas?.factores_trabajo || "No reporta."}</p>
            </div>
          </div>

          {/* 5 Porqués */}
          {record.analisis_5_porques && record.analisis_5_porques.length > 0 && (
            <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800 uppercase border-b pb-2 mb-2 flex items-center gap-1.5">
                <span>🔍</span> Análisis de Causa Raíz (5 Porqués)
              </h4>
              <div className="space-y-2 font-mono text-[11px]">
                {record.analisis_5_porques.map((p, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="font-bold text-orange-600">Porqué {idx + 1}:</span>
                    <span className="text-slate-700">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN E: PLAN DE ACCIÓN */}
        <div className="space-y-3 mb-6 break-inside-avoid">
          <h3 className="text-xs font-black uppercase text-slate-900 bg-slate-50 px-2 py-1 rounded border-l-4 border-slate-900">
            E. Plan de Acción y Medidas Correctivas Acordadas
          </h3>
          <table className="w-full text-xs border border-slate-200 text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 font-bold border-b border-slate-200">
                <th className="p-2 border-r border-slate-200">Medida Correctiva</th>
                <th className="p-2 border-r border-slate-200 w-1/4">Responsable</th>
                <th className="p-2 border-r border-slate-200 w-1/6">Plazo Límite</th>
                <th className="p-2 w-1/6 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {record.plan_accion && record.plan_accion.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400">
                    No se registraron medidas correctivas inmediatas en el expediente.
                  </td>
                </tr>
              ) : (
                record.plan_accion.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200">{item.medida}</td>
                    <td className="p-2 border-r border-slate-200">{item.responsable}</td>
                    <td className="p-2 border-r border-slate-200">
                      {new Date(item.fecha_limite).toLocaleDateString()}
                    </td>
                    <td className="p-2 text-center font-bold">
                      <span className={item.estado === "REALIZADO" ? "text-emerald-600" : "text-red-500"}>
                        {item.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SECCIÓN F: TRAMITACIÓN LEGAL Y PROTOCOLO NORMATIVO (LEY 16.744 / CIRCULAR 3336) */}
        <div className="mb-6 border border-slate-200 rounded-lg p-3 bg-slate-50/50 break-inside-avoid">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 mb-2.5 flex items-center justify-between">
            <span>F. Tramitación Legal y Protocolo Normativo (SUSESO / D.S. 44)</span>
            {record.es_grave_o_fatal && (
              <span className="text-[10px] font-black uppercase text-red-600 bg-red-100 px-2 py-0.5 rounded">
                ⚠️ Protocolo Accidente Grave Activado
              </span>
            )}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Estado DIAT</span>
              <span className={`font-bold ${record.diat_presentada ? "text-emerald-700" : "text-amber-700"}`}>
                {record.diat_presentada ? "✓ DIAT Formalizada" : "Pendiente de Presentación"}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Folio DIAT Mutual</span>
              <span className="font-mono font-bold text-slate-800">
                {record.diat_folio || "S/F"}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Días Perdidos (Reposo)</span>
              <span className="font-bold text-slate-800">
                {record.dias_perdidos} {record.dias_perdidos === 1 ? "día" : "días"}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Alta Médica</span>
              <span className="font-medium text-slate-700">
                {record.alta_medica ? "Emitida por Mutualidad" : "En Tratamiento"}
              </span>
            </div>
          </div>

          {record.es_grave_o_fatal && (
            <div className="mt-3 pt-2.5 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Criterio Circular 3336</span>
                <span className="font-semibold text-slate-800">
                  {record.tipo_accidente_grave_display || record.tipo_accidente_grave || "Crítico"}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Auto-suspensión de Faenas</span>
                <span className={`font-bold ${record.faena_suspendida ? "text-emerald-700" : "text-red-600"}`}>
                  {record.faena_suspendida ? "🛑 Faena Auto-Suspendida" : "⚠️ No Suspendida"}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Aviso a DT / Seremi</span>
                <span className="font-medium text-slate-800">
                  {record.aviso_autoridades_realizado
                    ? `✓ Folio: ${record.aviso_autoridades_folio || "Realizado"}`
                    : "Pendiente"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN G: FIRMAS DE RESPONSABILIDAD */}
        <div className="border-t border-slate-200 pt-8 mt-12 break-inside-avoid">
          <div className="grid grid-cols-3 gap-6 text-center text-[10px]">
            {/* Firma 1 */}
            <div className="flex flex-col justify-between h-24">
              <div className="border-b border-slate-900 mx-4"></div>
              <div>
                <p className="font-bold text-slate-900 uppercase">Firma Prevencionista</p>
                <p className="text-slate-500 mt-0.5">Autor de la Investigación</p>
                <p className="text-slate-400 text-[8px] mt-0.5">Nombre: {record.username}</p>
              </div>
            </div>

            {/* Firma 2 */}
            <div className="flex flex-col justify-between h-24">
              <div className="border-b border-slate-900 mx-4"></div>
              <div>
                <p className="font-bold text-slate-900 uppercase">Firma Comité Paritario</p>
                <p className="text-slate-500 mt-0.5">Representante de Trabajadores</p>
                <p className="text-slate-400 text-[8px] mt-0.5">RUT: _________________</p>
              </div>
            </div>

            {/* Firma 3 */}
            <div className="flex flex-col justify-between h-24">
              <div className="border-b border-slate-900 mx-4"></div>
              <div>
                <p className="font-bold text-slate-900 uppercase">Firma Empleador</p>
                <p className="text-slate-500 mt-0.5">Gerencia / Representante Legal</p>
                <p className="text-slate-400 text-[8px] mt-0.5">RUT: _________________</p>
              </div>
            </div>
          </div>
        </div>

        {/* BRANDING AL PIE (Si el plan no es marca blanca) */}
        {!isWhiteLabel && (
          <div className="text-center mt-12 pt-4 border-t border-slate-100 text-[9px] text-slate-400 italic print:text-black">
            Documento generado a través de HD Prevención • www.hdprevencion.cl
          </div>
        )}

      </div>
    </div>
  );
}
