"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { authFetch, getApiUrl } from "../../../utils/api";

interface SugerenciaLaboral {
  id: number;
  uuid: string;
  empresa: number;
  empresa_nombre: string;
  mensaje: string;
  tipo: "MEJORA_PROCESO" | "CLIMA_LABORAL" | "SEGURIDAD_GENERAL" | "OTRO";
  tipo_display: string;
  es_anonimo: boolean;
  nombre_remitente: string | null;
  contacto_remitente: string | null;
  estado: "NUEVA" | "REVISADA" | "APLICADA";
  estado_display: string;
  respuesta: string | null;
  fecha_creacion: string;
}

interface AuditLog {
  id: number;
  usuario_nombre: string;
  fecha_hora: string;
  ip_origen: string;
  accion: string;
}

interface EmpresaItem {
  id: number;
  razon_social: string;
  rut: string;
}

interface DenunciaLeyKarin {
  id: number;
  uuid: string;
  codigo_seguimiento?: string;
  empresa: number;
  empresa_nombre: string;
  centro_trabajo: number | null;
  centro_trabajo_nombre: string | null;
  tipo_afectacion: "ACOSO_SEXUAL" | "ACOSO_LABORAL" | "VIOLENCIA_EXTERNA";
  tipo_afectacion_display: string;
  rut_denunciante?: string;
  nombre_denunciante?: string;
  correo_denunciante?: string;
  telefono_denunciante?: string;
  nombre_denunciado?: string;
  cargo_area_denunciado?: string;
  descripcion_circunstanciada?: string;
  testigos_o_evidencias?: string | null;
  fecha_hora_ingreso: string;
  plazo_limite_derivacion_dt: string | null;
  plazo_limite_informe_mutualidad_5d?: string | null;
  dias_restantes_mutualidad?: number;
  derivada_mutualidad?: boolean;
  fecha_derivacion_mutualidad?: string | null;
  folio_mutualidad?: string | null;
  comprobante_anexo_67?: string | null;
  atencion_psicologica_ofrecida?: boolean;
  fecha_ofrecimiento_psicologico?: string | null;
  estado_tramite:
    | "RECEPCIONADA"
    | "MEDIDAS_RESGUARDO_APLICADAS"
    | "DERIVADA_A_DT"
    | "INVESTIGACION_INTERNA"
    | "FINALIZADA";
  estado_tramite_display: string;
  medidas_resguardo_detalle: string | null;
  derivada_inspeccion_trabajo: boolean;
  folio_dt: string | null;
  horas_restantes: number;
  semaforo: "VERDE" | "AMARILLO" | "ROJO" | "DERIVADA";
  es_detalle_confidencial?: boolean;
  accesos_auditoria?: AuditLog[];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BuzonDigitalPage() {
  const [tab, setTab] = useState<"sugerencias" | "karin">("karin");

  // Sugerencias State
  const [sugerencias, setSugerencias] = useState<SugerenciaLaboral[]>([]);
  const [selectedSug, setSelectedSug] = useState<SugerenciaLaboral | null>(null);
  const [respuestaSug, setRespuestaSug] = useState("");
  const [estadoSug, setEstadoSug] = useState<string>("REVISADA");
  const [filtroTipoSug, setFiltroTipoSug] = useState<string>("TODOS");
  const [filtroEstadoSug, setFiltroEstadoSug] = useState<string>("TODOS");

  // Ley Karin State
  const [denuncias, setDenuncias] = useState<DenunciaLeyKarin[]>([]);
  const [selectedKarin, setSelectedKarin] = useState<DenunciaLeyKarin | null>(null);
  const [filtroEstadoKarin, setFiltroEstadoKarin] = useState<string>("TODOS");

  // Modals Ley Karin
  const [showMedidasModal, setShowMedidasModal] = useState(false);
  const [medidasTexto, setMedidasTexto] = useState("");
  const [showDtModal, setShowDtModal] = useState(false);
  const [folioDtTexto, setFolioDtTexto] = useState("");
  const [showMutualidadModal, setShowMutualidadModal] = useState(false);
  const [folioMutualidadTexto, setFolioMutualidadTexto] = useState("");
  const [atencionPsicologicaCheck, setAtencionPsicologicaCheck] = useState(false);
  const [archivoAnexo67, setArchivoAnexo67] = useState<File | null>(null);

  // Empresas para QR aislado
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [selectedEmpresaQr, setSelectedEmpresaQr] = useState<string>("");

  // Loading & General State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QR Modal
  const [uid, setUid] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 0. Fetch empresas para contexto de prevencionista
      const resEmp = await authFetch(getApiUrl("/api/empresas/"));
      if (resEmp.ok) {
        const dataEmp = await resEmp.json();
        const empList = Array.isArray(dataEmp) ? dataEmp : dataEmp.results || [];
        setEmpresas(empList);
        if (empList.length > 0) {
          setSelectedEmpresaQr((prev) => prev || String(empList[0].id));
        }
      }

      // 1. Fetch sugerencias laborales
      const resSug = await authFetch(getApiUrl("/api/sugerencias-laborales/"));
      if (resSug.ok) {
        const dataSug = await resSug.json();
        setSugerencias(Array.isArray(dataSug) ? dataSug : dataSug.results || []);
      } else {
        // Fallback al endpoint legacy si existiera
        const resLegacy = await authFetch(getApiUrl("/api/buzon/"));
        if (resLegacy.ok) {
          const dataLegacy = await resLegacy.json();
          setSugerencias(Array.isArray(dataLegacy) ? dataLegacy : dataLegacy.results || []);
        }
      }

      // 2. Fetch denuncias Ley Karin
      const resKarin = await authFetch(getApiUrl("/api/denuncias-ley-karin/"));
      if (resKarin.ok) {
        const dataKarin = await resKarin.json();
        setDenuncias(Array.isArray(dataKarin) ? dataKarin : dataKarin.results || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los registros.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Prevencionista Profile for QR URL
  const fetchUid = useCallback(async () => {
    try {
      const res = await authFetch(getApiUrl("/api/usuarios/perfil/"));
      if (res.ok) {
        const data = await res.json();
        setUid(data.uuid ? String(data.uuid) : String(data.id));
      }
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchUid();
  }, [fetchData, fetchUid]);

  // Selección de Denuncia Ley Karin con trazabilidad y auditoría
  const handleSelectKarin = async (item: DenunciaLeyKarin) => {
    try {
      // Al consultar el detalle vía GET, el backend registra el AuditLogAccesoDenuncia inmutable
      const res = await authFetch(getApiUrl(`/api/denuncias-ley-karin/${item.id}/`));
      if (res.ok) {
        const fullDetail = await res.json();
        setSelectedKarin(fullDetail);
      } else {
        setSelectedKarin(item);
      }
    } catch {
      setSelectedKarin(item);
    }
  };

  // Guardar Respuesta a Sugerencia
  const handleResponderSugerencia = async () => {
    if (!selectedSug) return;
    setSaving(true);
    try {
      const res = await authFetch(
        getApiUrl(`/api/sugerencias-laborales/${selectedSug.id}/responder/`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            respuesta: respuestaSug,
            estado: estadoSug,
          }),
        }
      );
      if (!res.ok) throw new Error("No se pudo guardar la respuesta de la sugerencia.");
      const updated = await res.json();
      setSugerencias((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSelectedSug(updated);
      alert("Respuesta guardada exitosamente.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar respuesta.");
    } finally {
      setSaving(false);
    }
  };

  // Registrar Medidas de Resguardo Cautelar
  const handleGuardarMedidas = async () => {
    if (!selectedKarin || !medidasTexto.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch(
        getApiUrl(`/api/denuncias-ley-karin/${selectedKarin.id}/registrar-medidas/`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ medidas_resguardo_detalle: medidasTexto }),
        }
      );
      if (!res.ok) throw new Error("Error al registrar medidas de resguardo.");
      const updated = await res.json();
      setSelectedKarin(updated);
      setDenuncias((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setShowMedidasModal(false);
      setMedidasTexto("");
      alert("Medidas cautelares de resguardo registradas y auditadas exitosamente.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar medidas.");
    } finally {
      setSaving(false);
    }
  };

  // Registrar Derivación a la Inspección del Trabajo
  const handleDerivarDt = async () => {
    if (!selectedKarin) return;
    setSaving(true);
    try {
      const res = await authFetch(
        getApiUrl(`/api/denuncias-ley-karin/${selectedKarin.id}/derivar-dt/`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ folio_dt: folioDtTexto }),
        }
      );
      if (!res.ok) throw new Error("Error al derivar denuncia a la DT.");
      const updated = await res.json();
      setSelectedKarin(updated);
      setDenuncias((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setShowDtModal(false);
      setFolioDtTexto("");
      alert("Derivación a la Inspección del Trabajo registrada con folio y auditoría.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al derivar denuncia.");
    } finally {
      setSaving(false);
    }
  };

  // Registrar Derivación a la Mutualidad (Compendio SUSESO Libro IV - Anexo 67 y 5 días hábiles)
  const handleDerivarMutualidad = async () => {
    if (!selectedKarin) return;
    setSaving(true);
    try {
      const formData = new FormData();
      if (folioMutualidadTexto.trim()) {
        formData.append("folio_mutualidad", folioMutualidadTexto.trim());
      }
      formData.append("atencion_psicologica_ofrecida", atencionPsicologicaCheck ? "true" : "false");
      if (archivoAnexo67) {
        formData.append("comprobante_anexo_67", archivoAnexo67);
      }

      const res = await authFetch(
        getApiUrl(`/api/denuncias-ley-karin/${selectedKarin.id}/derivar-mutualidad/`),
        {
          method: "POST",
          body: formData,
        }
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Error al registrar derivación a mutualidad.");
      }
      const updated = await res.json();
      setSelectedKarin(updated);
      setDenuncias((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setShowMutualidadModal(false);
      setFolioMutualidadTexto("");
      setArchivoAnexo67(null);
      alert("Derivación a Organismo Administrador (Mutualidad) y Anexo 67 registrados exitosamente.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar.");
    } finally {
      setSaving(false);
    }
  };

  // Filtros Sugerencias
  const sugerenciasFiltradas = sugerencias.filter((s) => {
    if (filtroTipoSug !== "TODOS" && s.tipo !== filtroTipoSug) return false;
    if (filtroEstadoSug !== "TODOS" && s.estado !== filtroEstadoSug) return false;
    return true;
  });

  // Filtros Ley Karin
  const denunciasFiltradas = denuncias.filter((d) => {
    if (filtroEstadoKarin !== "TODOS" && d.estado_tramite !== filtroEstadoKarin) return false;
    return true;
  });

  // Conteo de alertas Ley Karin
  const karinCriticas = denuncias.filter((d) => d.semaforo === "ROJO").length;
  const sugerenciasNuevas = sugerencias.filter((s) => s.estado === "NUEVA").length;

  const publicPortalUrl = uid
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/participacion/${uid}/buzon${
        selectedEmpresaQr ? `?empresa=${selectedEmpresaQr}` : ""
      }`
    : "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* ── Encabezado Principal ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚖️</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Buzón Digital & Canal Ley Karin
                {karinCriticas > 0 && (
                  <span className="text-xs bg-rose-600/30 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                    {karinCriticas} plazo{karinCriticas > 1 ? "s" : ""} urgente{karinCriticas > 1 ? "s" : ""}
                  </span>
                )}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Gestión confidencial de denuncias (Ley N° 21.643) y canal abierto de sugerencias para empresas asesoradas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQrModal(true)}
            id="btn-ver-qr-buzon"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
          >
            <span>📱</span>
            <span>Ver Portal QR Trabajadores</span>
          </button>
          <button
            onClick={fetchData}
            title="Actualizar datos"
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition-colors cursor-pointer"
          >
            🔄
          </button>
        </div>
      </div>

      {/* ── Pestañas de Navegación (Tabs) ── */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => {
            setTab("karin");
            setSelectedSug(null);
          }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            tab === "karin"
              ? "border-rose-500 text-rose-400 bg-rose-500/10 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>⚖️</span>
          <span>Canal Protegido Ley Karin (Confidencial)</span>
          {denuncias.length > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                karinCriticas > 0 ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              {denuncias.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setTab("sugerencias");
            setSelectedKarin(null);
          }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            tab === "sugerencias"
              ? "border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>💡</span>
          <span>Sugerencias & Clima Laboral</span>
          {sugerenciasNuevas > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {sugerenciasNuevas} nuevas
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span>Cargando registros confidenciales y sugerencias...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-sm">
          ⚠️ {error}
        </div>
      ) : tab === "karin" ? (
        /* ══════════════════════════════════════════════════════════════
           TAB 2: CANAL PROTEGIDO LEY KARIN (CONFIDENCIAL)
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Banner de Cumplimiento Legal */}
          <div className="bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900 border border-rose-500/20 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🛡️</span>
              <div>
                <h2 className="text-sm font-bold text-rose-300">
                  Marco Regulatorio Ley Karin (Ley N° 21.643 - Circular SUSESO / Dictámenes DT)
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-4xl leading-relaxed">
                  El empleador cuenta con un <strong>plazo legal estricto de 72 horas</strong> desde la recepción de la denuncia para
                  adoptar medidas de resguardo cautelar inmediatas y/o remitir los antecedentes a la Inspección del Trabajo. Cada visualización de este expediente genera trazabilidad de auditoría inmutable.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-center">
              <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
                Semáforo DT Activo
              </span>
            </div>
          </div>

          {/* Filtros Ley Karin */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado Trámite:</span>
            {[
              { id: "TODOS", label: "Todos" },
              { id: "RECEPCIONADA", label: "Recepcionadas" },
              { id: "MEDIDAS_RESGUARDO_APLICADAS", label: "Con Medidas Cautelares" },
              { id: "DERIVADA_A_DT", label: "Derivadas a DT" },
              { id: "INVESTIGACION_INTERNA", label: "Investigación Interna" },
              { id: "FINALIZADA", label: "Finalizadas" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroEstadoKarin(f.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filtroEstadoKarin === f.id
                    ? "bg-rose-600 text-white font-bold"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Contenedor Principal en 2 Columnas: Lista y Detalle */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Lista de Denuncias (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              {denunciasFiltradas.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                  <span className="text-4xl block mb-2">🕊️</span>
                  <p className="text-sm font-medium">No hay denuncias en este estado.</p>
                  <p className="text-xs text-slate-600 mt-1">Los ingresos vía código QR aparecerán aquí con aviso de tiempo.</p>
                </div>
              ) : (
                denunciasFiltradas.map((d) => {
                  const isSelected = selectedKarin?.id === d.id;
                  const isCritical = d.semaforo === "ROJO";
                  const isWarning = d.semaforo === "AMARILLO";
                  const isDerived = d.semaforo === "DERIVADA";

                  return (
                    <div
                      key={d.id}
                      onClick={() => handleSelectKarin(d)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 border-rose-500/80 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/50"
                          : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {/* Tipo de Afectación Badge */}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            d.tipo_afectacion === "ACOSO_SEXUAL"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : d.tipo_afectacion === "ACOSO_LABORAL"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {d.tipo_afectacion_display}
                        </span>

                        {/* Semáforo Plazo 72h Badge */}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 ${
                            isDerived
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : isCritical
                              ? "bg-rose-600 text-white animate-pulse"
                              : isWarning
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          <span>{isDerived ? "🏛️" : isCritical ? "🚨" : isWarning ? "⏳" : "🟢"}</span>
                          <span>
                            {isDerived
                              ? "Derivada DT"
                              : `${d.horas_restantes > 0 ? d.horas_restantes : 0}h restantes`}
                          </span>
                        </span>
                      </div>

                      {/* Código Seguro y Estado de Protección Ley Karin */}
                      <div className="flex items-center justify-between text-xs my-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                            Código Seguro
                          </span>
                          <span className="font-mono font-bold text-amber-400">
                            {d.codigo_seguimiento || `KARIN-2026-${d.id}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                          🔒 Identidad Protegida
                        </span>
                      </div>

                      {/* Notificación Mutualidad (5 días hábiles - Anexo 67) */}
                      <div className="flex items-center justify-between text-[11px] mb-2 px-1">
                        <span className="text-slate-400">Plazo Mutualidad (5d):</span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded ${
                            d.derivada_mutualidad
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-blue-500/20 text-blue-300"
                          }`}
                        >
                          {d.derivada_mutualidad
                            ? `✓ Derivada (${d.folio_mutualidad || "Anexo 67"})`
                            : `${d.dias_restantes_mutualidad !== undefined ? d.dias_restantes_mutualidad : 5}d hábiles`}
                        </span>
                      </div>

                      {/* Botón para Abrir Expediente Auditado */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectKarin(d);
                        }}
                        className="w-full py-2 px-3 bg-gradient-to-r from-slate-800 to-slate-850 hover:from-rose-900/40 hover:to-slate-800 text-slate-200 hover:text-white text-xs font-bold rounded-lg border border-slate-700/80 hover:border-rose-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <span>📂</span>
                        <span>Ver Expediente Confidencial</span>
                      </button>

                      {/* Bottom Meta */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-800/50">
                        <span>🏢 {d.empresa_nombre}</span>
                        <span>{formatDate(d.fecha_hora_ingreso)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Columna Derecha: Expediente Confidencial de la Denuncia (7 cols) */}
            <div className="lg:col-span-7">
              {selectedKarin ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 sticky top-6 shadow-2xl">
                  {/* Header Expediente */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          FOLIO INTERNO #{selectedKarin.id}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            selectedKarin.tipo_afectacion === "ACOSO_SEXUAL"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : selectedKarin.tipo_afectacion === "ACOSO_LABORAL"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {selectedKarin.tipo_afectacion_display}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-white mt-1">
                        Expediente Confidencial Ley Karin
                      </h3>
                      <p className="text-xs text-slate-400">
                        Empresa: {selectedKarin.empresa_nombre}{" "}
                        {selectedKarin.centro_trabajo_nombre && `• Faena: ${selectedKarin.centro_trabajo_nombre}`}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedKarin(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Panel Semáforo de Plazo 72 Horas */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                      selectedKarin.semaforo === "DERIVADA"
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                        : selectedKarin.semaforo === "ROJO"
                        ? "bg-rose-500/15 border-rose-500/40 text-rose-200"
                        : selectedKarin.semaforo === "AMARILLO"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span>⏱️ Plazo Legal 72h (Dictamen DT / Ley Karin)</span>
                      </div>
                      <div className="text-sm font-semibold mt-0.5">
                        Límite: {formatDate(selectedKarin.plazo_limite_derivacion_dt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono">
                        {selectedKarin.derivada_inspeccion_trabajo
                          ? "DERIVADA"
                          : `${selectedKarin.horas_restantes > 0 ? selectedKarin.horas_restantes : 0}h`}
                      </div>
                      <div className="text-[11px] opacity-80">
                        {selectedKarin.derivada_inspeccion_trabajo
                          ? `Folio: ${selectedKarin.folio_dt || "S/N"}`
                          : "Tiempo Restante"}
                      </div>
                    </div>
                  </div>

                  {/* Datos del Denunciante y Denunciado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        👤 Denunciante (Protección Legal)
                      </span>
                      <p className="text-sm font-bold text-white">{selectedKarin.nombre_denunciante}</p>
                      <p className="text-xs text-slate-300 font-mono">RUT: {selectedKarin.rut_denunciante}</p>
                      <p className="text-xs text-slate-400 mt-1">📧 {selectedKarin.correo_denunciante}</p>
                      <p className="text-xs text-slate-400">📞 {selectedKarin.telefono_denunciante || "No registra"}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        🎯 Persona Denunciada
                      </span>
                      <p className="text-sm font-bold text-rose-300">{selectedKarin.nombre_denunciado}</p>
                      <p className="text-xs text-slate-300">
                        Cargo / Área: {selectedKarin.cargo_area_denunciado || "No especificado"}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        Estado Actual: <span className="font-bold text-white">{selectedKarin.estado_tramite_display}</span>
                      </p>
                    </div>
                  </div>

                  {/* Relato de los Hechos */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      📝 Descripción Circunstanciada de los Hechos
                    </h4>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                      {selectedKarin.descripcion_circunstanciada}
                    </div>
                  </div>

                  {/* Testigos o Evidencias */}
                  {selectedKarin.testigos_o_evidencias && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        👥 Testigos o Evidencias Aportadas
                      </h4>
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                        {selectedKarin.testigos_o_evidencias}
                      </div>
                    </div>
                  )}

                  {/* Medidas de Resguardo Cautelar Registradas */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>🛡️ Medidas de Resguardo Cautelar Inmediatas</span>
                      <button
                        onClick={() => {
                          setMedidasTexto(selectedKarin.medidas_resguardo_detalle || "");
                          setShowMedidasModal(true);
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
                      >
                        {selectedKarin.medidas_resguardo_detalle ? "Editar Medidas" : "+ Registrar Medidas"}
                      </button>
                    </h4>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                      {selectedKarin.medidas_resguardo_detalle ? (
                        <p className="text-emerald-300 leading-relaxed">
                          {selectedKarin.medidas_resguardo_detalle}
                        </p>
                      ) : (
                        <p className="text-slate-500 italic">
                          Aún no se han registrado medidas cautelares de separación física, psicológica o de jornada.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Derivación Obligatoria a Mutualidad (Compendio SUSESO Libro IV - Anexo 67 y 5 días hábiles) */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏥</span>
                        <div>
                          <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                            Organismo Administrador / Mutualidad (Plazo Legal 5 Días Hábiles)
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Límite informe mutualidad: {formatDate(selectedKarin.plazo_limite_informe_mutualidad_5d)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                          selectedKarin.derivada_mutualidad
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        }`}
                      >
                        {selectedKarin.derivada_mutualidad ? "✓ Notificada a Mutualidad" : "Pendiente Derivación"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Folio Mutualidad / DIAT:</span>
                        <span className="font-mono font-bold text-white">
                          {selectedKarin.folio_mutualidad || "Sin folio registrado"}
                        </span>
                        {selectedKarin.comprobante_anexo_67 && (
                          <a
                            href={selectedKarin.comprobante_anexo_67}
                            target="_blank"
                            rel="noreferrer"
                            className="text-orange-400 hover:underline block text-[11px] mt-1"
                          >
                            📎 Ver Comprobante Anexo 67
                          </a>
                        )}
                      </div>
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Atención Psicológica Temprana:</span>
                        <span
                          className={`font-bold ${
                            selectedKarin.atencion_psicologica_ofrecida ? "text-emerald-400" : "text-slate-400"
                          }`}
                        >
                          {selectedKarin.atencion_psicologica_ofrecida
                            ? "✓ Ofrecida al denunciante"
                            : "No registrada"}
                        </span>
                        {selectedKarin.fecha_ofrecimiento_psicologico && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Fecha: {formatDate(selectedKarin.fecha_ofrecimiento_psicologico)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones Obligatorias de Gestión Legal */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setMedidasTexto(selectedKarin.medidas_resguardo_detalle || "");
                        setShowMedidasModal(true);
                      }}
                      className="flex-1 min-w-[140px] py-2.5 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      🛡️ Medidas Resguardo
                    </button>

                    <button
                      onClick={() => {
                        setFolioMutualidadTexto(selectedKarin.folio_mutualidad || "");
                        setAtencionPsicologicaCheck(Boolean(selectedKarin.atencion_psicologica_ofrecida));
                        setArchivoAnexo67(null);
                        setShowMutualidadModal(true);
                      }}
                      className="flex-1 min-w-[140px] py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      🏥 Notificar Mutualidad (Anexo 67)
                    </button>

                    <button
                      onClick={() => {
                        setFolioDtTexto(selectedKarin.folio_dt || "");
                        setShowDtModal(true);
                      }}
                      className="flex-1 min-w-[140px] py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition-all cursor-pointer text-center"
                    >
                      🏛️ Derivación DT
                    </button>
                  </div>

                  {/* Registro de Auditoría Inmutable */}
                  {selectedKarin.accesos_auditoria && selectedKarin.accesos_auditoria.length > 0 && (
                    <div className="pt-4 border-t border-slate-800/80">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span>🔒 Auditoría de Accesos Inmutables (Confidencialidad)</span>
                      </h4>
                      <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-36 overflow-y-auto divide-y divide-slate-800/50">
                        {selectedKarin.accesos_auditoria.map((log) => (
                          <div key={log.id} className="p-2 text-[11px] flex items-center justify-between text-slate-400">
                            <span>
                              <strong className="text-slate-200">{log.usuario_nombre}</strong> — {log.accion}
                            </span>
                            <span className="font-mono text-slate-500">
                              IP: {log.ip_origen} • {formatDate(log.fecha_hora)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center">
                  <span className="text-5xl block mb-3">📂</span>
                  <p className="text-base font-bold text-slate-300">Selecciona una denuncia para abrir el expediente</p>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Cada apertura quedará debidamente registrada con tu usuario, fecha y dirección IP para estricto cumplimiento de confidencialidad.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
           TAB 1: SUGERENCIAS & CLIMA LABORAL (CANAL ABIERTO)
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Filtros Sugerencias */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo:</span>
              {[
                { id: "TODOS", label: "Todos" },
                { id: "MEJORA_PROCESO", label: "Mejoras" },
                { id: "CLIMA_LABORAL", label: "Clima" },
                { id: "SEGURIDAD_GENERAL", label: "Seguridad" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroTipoSug(f.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    filtroTipoSug === f.id
                      ? "bg-amber-600 text-white font-bold"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado:</span>
              {[
                { id: "TODOS", label: "Todos" },
                { id: "NUEVA", label: "Nuevas" },
                { id: "REVISADA", label: "Revisadas" },
                { id: "APLICADA", label: "Aplicadas" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroEstadoSug(f.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    filtroEstadoSug === f.id
                      ? "bg-emerald-600 text-white font-bold"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Sugerencias */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              {sugerenciasFiltradas.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                  <span className="text-4xl block mb-2">💡</span>
                  <p className="text-sm font-medium">No hay sugerencias en este filtro.</p>
                </div>
              ) : (
                sugerenciasFiltradas.map((s) => {
                  const isSelected = selectedSug?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSug(s);
                        setRespuestaSug(s.respuesta || "");
                        setEstadoSug(s.estado);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/50"
                          : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {s.tipo_display || s.tipo}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            s.estado === "NUEVA"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : s.estado === "APLICADA"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {s.estado_display || s.estado}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-3 mb-3 leading-relaxed">
                        {s.mensaje}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                        <span>
                          {s.es_anonimo ? "🕵️ Anónimo" : `👤 ${s.nombre_remitente || "Identificado"}`}
                        </span>
                        <span>{formatDate(s.fecha_creacion)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Detalle Sugerencia */}
            <div className="lg:col-span-7">
              {selectedSug ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 sticky top-6 shadow-2xl">
                  <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                    <div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {selectedSug.tipo_display || selectedSug.tipo}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">
                        Sugerencia #{selectedSug.id}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Empresa: {selectedSug.empresa_nombre || "Empresa vinculada"} • {formatDate(selectedSug.fecha_creacion)}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedSug(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Mensaje del Trabajador
                    </h4>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                      {selectedSug.mensaje}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-400">
                    <span className="font-bold text-slate-300">Remitente: </span>
                    {selectedSug.es_anonimo
                      ? "Enviado anónimamente"
                      : `${selectedSug.nombre_remitente || "Sin nombre"} (Contacto: ${selectedSug.contacto_remitente || "No especificado"})`}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Respuesta o Medida Preventiva Adoptada
                    </h4>
                    <textarea
                      rows={4}
                      value={respuestaSug}
                      onChange={(e) => setRespuestaSug(e.target.value)}
                      placeholder="Registra la retroalimentación, acuerdo de comité o medida adoptada..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 font-bold">Estado:</label>
                        <select
                          value={estadoSug}
                          onChange={(e) => setEstadoSug(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-2 focus:outline-none focus:border-amber-500"
                        >
                          <option value="NUEVA">Nueva</option>
                          <option value="REVISADA">Revisada</option>
                          <option value="APLICADA">Aplicada / Implementada</option>
                        </select>
                      </div>

                      <button
                        onClick={handleResponderSugerencia}
                        disabled={saving}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "Guardando..." : "Guardar Respuesta"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center">
                  <span className="text-4xl block mb-2">💡</span>
                  <p className="text-sm font-bold text-slate-300">Selecciona una sugerencia para ver el detalle y responder</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Registrar Medidas de Resguardo Inmediatas ── */}
      {showMedidasModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🛡️</span> Medidas de Resguardo Cautelar Inmediatas
              </h3>
              <button
                onClick={() => setShowMedidasModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              De acuerdo al Art. 211-B del Código del Trabajo (Ley Karin), el empleador debe disponer de forma inmediata medidas como la separación de los espacios físicos de trabajo, la redistribución del tiempo de la jornada, o la atención psicológica temprana.
            </p>

            <textarea
              rows={5}
              value={medidasTexto}
              onChange={(e) => setMedidasTexto(e.target.value)}
              placeholder="Ej: Se dispone la separación física de puestos de trabajo entre el denunciante y el denunciado, reasignando al denunciado a turno B a contar de esta fecha. Se ofrece apoyo y derivación a organismo administrador..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowMedidasModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarMedidas}
                disabled={saving || !medidasTexto.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Confirmar Medidas Cautelares"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Registrar Derivación a la Inspección del Trabajo ── */}
      {showDtModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🏛️</span> Derivación a la Inspección del Trabajo (DT)
              </h3>
              <button
                onClick={() => setShowDtModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              El empleador puede derivar la investigación a la Inspección del Trabajo respectiva dentro de las 72 horas legales siguientes a la recepción de la denuncia.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Número de Folio o Comprobante de Ingreso en la DT (Opcional):
              </label>
              <input
                type="text"
                value={folioDtTexto}
                onChange={(e) => setFolioDtTexto(e.target.value)}
                placeholder="Ej: DT-2026-987654"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDtModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDerivarDt}
                disabled={saving}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Confirmar Derivación a DT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Registrar Derivación a la Mutualidad (Compendio SUSESO Libro IV) ── */}
      {showMutualidadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🏥</span> Derivación a Mutualidad (Anexo 67 SUSESO)
              </h3>
              <button
                onClick={() => setShowMutualidadModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 leading-relaxed">
              <strong>Plazo Legal Estricto: 5 días hábiles</strong> desde la recepción de la denuncia para remitir los antecedentes al organismo administrador de la Ley 16.744 y activar el protocolo de apoyo psicológico temprano (Compendio SUSESO Libro IV).
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Número de Folio o DIAT de Ingreso en Mutualidad:
                </label>
                <input
                  type="text"
                  value={folioMutualidadTexto}
                  onChange={(e) => setFolioMutualidadTexto(e.target.value)}
                  placeholder="Ej. MUT-2026-004589"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Adjuntar Comprobante Anexo N° 67 (PDF o Imagen):
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setArchivoAnexo67(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    checked={atencionPsicologicaCheck}
                    onChange={(e) => setAtencionPsicologicaCheck(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-200 block">
                      Atención psicológica temprana ofrecida formalmente
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Se deja constancia que la entidad empleadora puso a disposición del denunciante la atención y orientación psicológica que otorga la mutualidad.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowMutualidadModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDerivarMutualidad}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Registrar Derivación Mutualidad"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Código QR y Enlace Público ── */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📱</span> Portal QR de Participación & Ley Karin
              </h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Imprime o comparte este código QR en faenas, comedores y murales informativos para que los trabajadores envíen sugerencias o denuncias formales confidenciales sin requerir credenciales de acceso.
            </p>

            {empresas.length > 0 && (
              <div className="text-left bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  🏢 Empresa Mandante para este QR:
                </label>
                <select
                  value={selectedEmpresaQr}
                  onChange={(e) => setSelectedEmpresaQr(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.razon_social} ({emp.rut})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  El QR generado fija esta empresa exclusivamente, resguardando el secreto empresarial y la confidencialidad de la información.
                </p>
              </div>
            )}

            {publicPortalUrl ? (
              <div className="flex flex-col items-center justify-center py-2 space-y-3">
                <div className="p-3 bg-white rounded-2xl shadow-xl inline-block">
                  <QRCodeSVG
                    value={publicPortalUrl}
                    size={180}
                    level="M"
                  />
                </div>

                <a
                  href={publicPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-orange-400 hover:text-orange-300 font-mono break-all underline"
                >
                  {publicPortalUrl}
                </a>
              </div>
            ) : (
              <p className="text-xs text-rose-400">No se pudo generar la URL del prevencionista.</p>
            )}

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
