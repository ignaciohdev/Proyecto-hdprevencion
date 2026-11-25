"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "../../../utils/api";

// ==========================================
// INTERFACES Y MODELOS DE DATOS
// ==========================================

interface PreguntaEvaluacion {
  id: number;
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
}

interface TemaCapacitacion {
  id: number;
  titulo: string;
  categoria: string;
  categoria_display?: string;
  duracion_minutos: number;
  descripcion: string;
  contenido_clave: string[];
  es_conferencia_grabada?: boolean;
  precio_clp?: number;
  video_url?: string;
  normativa_legal_vigente?: string;
  organismo_exigente?: string;
  requiere_evaluacion?: boolean;
  porcentaje_aprobacion?: number;
  preguntas_evaluacion?: PreguntaEvaluacion[];
  relator_predeterminado?: string;
  fecha_creacion?: string;
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
  evaluacion_comprension_aplicada?: boolean;
  porcentaje_aprobacion_minimo?: number;
  entidad_capacitadora?: string;
  codigo_sence?: string;
  certificado_emitido?: boolean;
}

interface SolicitudCapacitacion {
  id: number;
  empresa: string;
  rut_empresa: string;
  contacto_nombre: string;
  contacto_cargo?: string;
  contacto_email: string;
  contacto_telefono: string;
  tipo_capacitacion: string;
  tipo_capacitacion_display?: string;
  tema?: number | null;
  tema_titulo?: string;
  perfil_relator?: string;
  modalidad: "PRESENCIAL" | "ONLINE" | "MIXTA";
  modalidad_display?: string;
  region_comuna: string;
  cantidad_trabajadores: number;
  fecha_tentativa?: string | null;
  mensaje_adicional?: string;
  estado: "PENDIENTE" | "CONTACTADO" | "COTIZADO" | "COORDINADO" | "FINALIZADO" | "CANCELADO";
  estado_display?: string;
  fecha_creacion: string;
}

export default function CapacitacionesDashboardPage() {
  const router = useRouter();

  // Pestaña Activa
  const [activeTab, setActiveTab] = useState<"FAENA" | "ACADEMIA" | "RELATOR">("FAENA");

  // Estados Submódulo A: Mis Capacitaciones
  const [capacitaciones, setCapacitaciones] = useState<RegistroCapacitacion[]>([]);
  const [loadingCapacitaciones, setLoadingCapacitaciones] = useState(true);
  const [errorCapacitaciones, setErrorCapacitaciones] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODOS");

  // Estados Submódulo B: Academia HD
  const [temasAcademia, setTemasAcademia] = useState<TemaCapacitacion[]>([]);
  const [loadingAcademia, setLoadingAcademia] = useState(true);
  const [errorAcademia, setErrorAcademia] = useState<string | null>(null);
  const [filtroOrganismo, setFiltroOrganismo] = useState<string>("TODOS");
  const [busquedaAcademia, setBusquedaAcademia] = useState<string>("");

  // Modal / Reproductor de Conferencia On-Demand
  const [conferenciaSeleccionada, setConferenciaSeleccionada] = useState<TemaCapacitacion | null>(null);
  const [modalTab, setModalTab] = useState<"VIDEO" | "EVALUACION" | "CERTIFICADO">("VIDEO");
  const [videoProgreso, setVideoProgreso] = useState<number>(0);
  const [videoReproduciendo, setVideoReproduciendo] = useState<boolean>(false);
  
  // Respuestas del Examen
  const [respuestasUsuario, setRespuestasUsuario] = useState<{ [preguntaId: number]: number }>({});
  const [examenCalificado, setExamenCalificado] = useState<boolean>(false);
  const [puntajeExamen, setPuntajeExamen] = useState<{ correctas: number; total: number; porcentaje: number }>({ correctas: 0, total: 0, porcentaje: 0 });
  const [nombreCertificado, setNombreCertificado] = useState<string>("Ignacio Hernández");
  const [rutCertificado, setRutCertificado] = useState<string>("18.765.432-1");
  const [empresaCertificado, setEmpresaCertificado] = useState<string>("Constructora & Servicios Mineros Austral SpA");

  // Estados Submódulo C: Solicitud de Relator Externo
  const [solicitudes, setSolicitudes] = useState<SolicitudCapacitacion[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [formSolicitud, setFormSolicitud] = useState({
    empresa: "",
    rut_empresa: "",
    contacto_nombre: "",
    contacto_cargo: "",
    contacto_email: "",
    contacto_telefono: "",
    tipo_capacitacion: "LEY_KARIN",
    temaId: "" as string,
    perfil_relator: "Ingeniero en Prevención de Riesgos (Registro SEREMI / SNS)",
    modalidad: "PRESENCIAL" as "PRESENCIAL" | "ONLINE" | "MIXTA",
    region_comuna: "",
    cantidad_trabajadores: 15,
    fecha_tentativa: "",
    mensaje_adicional: "",
  });
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [solicitudExitosa, setSolicitudExitosa] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);

  // ==========================================
  // CARGA DE DATOS DESDE LA API
  // ==========================================

  const fetchCapacitaciones = async () => {
    setLoadingCapacitaciones(true);
    try {
      const res = await authFetch(getApiUrl("/api/registro-capacitacion/"));
      if (!res.ok) throw new Error("Error al obtener el plan de capacitaciones.");
      const data = await res.json();
      setCapacitaciones(data);
      setErrorCapacitaciones(null);
    } catch (err: any) {
      setErrorCapacitaciones(err.message || "Error al cargar las capacitaciones.");
    } finally {
      setLoadingCapacitaciones(false);
    }
  };

  const fetchTemasAcademia = async () => {
    setLoadingAcademia(true);
    try {
      const res = await authFetch(getApiUrl("/api/temas-capacitacion/"));
      if (!res.ok) throw new Error("Error al cargar el catálogo de conferencias.");
      const data: TemaCapacitacion[] = await res.json();
      // Filtrar o priorizar las conferencias grabadas
      const conferencias = data.filter((t) => t.es_conferencia_grabada || t.normativa_legal_vigente);
      setTemasAcademia(conferencias.length > 0 ? conferencias : data);
      setErrorAcademia(null);
    } catch (err: any) {
      setErrorAcademia(err.message || "Error al cargar conferencias on-demand.");
    } finally {
      setLoadingAcademia(false);
    }
  };

  const fetchSolicitudes = async () => {
    setLoadingSolicitudes(true);
    try {
      const res = await authFetch(getApiUrl("/api/solicitudes-capacitacion/"));
      if (!res.ok) return;
      const data = await res.json();
      setSolicitudes(Array.isArray(data) ? data : data.results || []);
    } catch {
      // Silencioso si no hay solicitudes aún
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  useEffect(() => {
    fetchCapacitaciones();
    fetchTemasAcademia();
    fetchSolicitudes();
  }, []);

  // ==========================================
  // FILTRADO DE CONFERENCIAS ACADEMIA HD
  // ==========================================

  const conferenciasFiltradas = useMemo(() => {
    return temasAcademia.filter((c) => {
      // Filtro por Organismo
      if (filtroOrganismo !== "TODOS") {
        const org = (c.organismo_exigente || "").toUpperCase();
        if (!org.includes(filtroOrganismo)) return false;
      }
      // Filtro por Texto de Búsqueda
      if (busquedaAcademia.trim()) {
        const query = busquedaAcademia.toLowerCase();
        const titulo = c.titulo.toLowerCase();
        const desc = (c.descripcion || "").toLowerCase();
        const norma = (c.normativa_legal_vigente || "").toLowerCase();
        const relator = (c.relator_predeterminado || "").toLowerCase();
        return titulo.includes(query) || desc.includes(query) || norma.includes(query) || relator.includes(query);
      }
      return true;
    });
  }, [temasAcademia, filtroOrganismo, busquedaAcademia]);

  // ==========================================
  // FILTRADO DE CAPACITACIONES EN FAENA
  // ==========================================

  const capacitacionesFiltradas = useMemo(() => {
    return capacitaciones.filter((cap) => {
      const matchEstado = filtroEstado === "TODOS" || cap.estado === filtroEstado;
      if (!matchEstado) return false;

      if (filtroCategoria === "TODOS") return true;
      if (filtroCategoria === "CURSOS_FORMALES") {
        const cat = cap.tema_detalle?.categoria;
        return cat === "CURSO_8H_GENERO" || cat === "CURSO_20H_CPHS" || cat === "CURSO_1H_EPP";
      }
      return cap.tema_detalle && cap.tema_detalle.categoria === filtroCategoria;
    });
  }, [capacitaciones, filtroEstado, filtroCategoria]);

  // KPIs
  const total = capacitaciones.length;
  const realizadas = capacitaciones.filter((c) => c.estado === "REALIZADA").length;
  const pendientes = capacitaciones.filter((c) => c.estado === "PROGRAMADA").length;
  const totalAsistentes = capacitaciones.reduce((acc, c) => acc + (c.estado === "REALIZADA" ? c.asistentes.length : 0), 0);
  const cumplimientoPAC = total > 0 ? Math.round((realizadas / total) * 100) : 0;

  // ==========================================
  // HANDLERS DEL MODAL DE CONFERENCIA
  // ==========================================

  const abrirConferencia = (conf: TemaCapacitacion) => {
    setConferenciaSeleccionada(conf);
    setModalTab("VIDEO");
    setVideoProgreso(25);
    setVideoReproduciendo(false);
    setRespuestasUsuario({});
    setExamenCalificado(false);
    setPuntajeExamen({ correctas: 0, total: 0, porcentaje: 0 });
  };

  const calificarExamen = () => {
    if (!conferenciaSeleccionada || !conferenciaSeleccionada.preguntas_evaluacion) return;
    const preguntas = conferenciaSeleccionada.preguntas_evaluacion;
    let correctas = 0;
    preguntas.forEach((p) => {
      if (respuestasUsuario[p.id] === p.correcta) {
        correctas++;
      }
    });
    const totalP = preguntas.length;
    const porcentaje = totalP > 0 ? Math.round((correctas / totalP) * 100) : 100;
    setPuntajeExamen({ correctas, total: totalP, porcentaje });
    setExamenCalificado(true);
    if (porcentaje >= (conferenciaSeleccionada.porcentaje_aprobacion || 75)) {
      setModalTab("CERTIFICADO");
    }
  };

  const descargarGuiaEstudio = (conf: TemaCapacitacion) => {
    const contenido = `# GUÍA TÉCNICA Y RESUMEN LEGAL: ${conf.titulo}
HD Prevención - Academia SST Oficial (Chile 2026)

## 1. MARCO NORMATIVO APLICABLE
- Marco Legal Vigente: ${conf.normativa_legal_vigente}
- Organismo Fiscalizador: ${conf.organismo_exigente}
- Duración Legal Exigible: ${conf.duracion_minutos} minutos (${(conf.duracion_minutos / 60).toFixed(1)} Horas Cronológicas)
- Perfil Relator Acreditado: ${conf.relator_predeterminado}

## 2. DESCRIPCIÓN DEL PROGRAMA
${conf.descripcion}

## 3. PUNTOS CLAVE Y CONTENIDOS EXIGIDOS
${conf.contenido_clave.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}

## 4. OBLIGATORIEDAD Y SANCIONES
El presente programa responde a las exigencias vigentes de fiscalización en Chile bajo la Dirección del Trabajo (DT), Ministerio de Salud (MINSAL) y Superintendencia de Seguridad Social (SUSESO).
Cumplimiento normativo auditado bajo la Ley N° 16.744, D.S. N° 44, Ley N° 21.643 y D.S. N° 594.
`;
    const blob = new Blob([contenido], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Guia_Legal_${conf.titulo.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // HANDLERS DEL FORMULARIO DE RELATOR
  // ==========================================

  const handleSeleccionarTemaRelator = (temaIdStr: string) => {
    const temaId = parseInt(temaIdStr);
    const tema = temasAcademia.find((t) => t.id === temaId);
    if (tema) {
      setFormSolicitud((prev) => ({
        ...prev,
        temaId: temaIdStr,
        perfil_relator: tema.relator_predeterminado || "Ingeniero en Prevención de Riesgos (Registro SEREMI / SNS)",
        tipo_capacitacion: tema.categoria || prev.tipo_capacitacion,
      }));
    } else {
      setFormSolicitud((prev) => ({
        ...prev,
        temaId: "",
        perfil_relator: "Ingeniero en Prevención de Riesgos (Registro SEREMI / SNS)",
      }));
    }
  };

  const handleEnviarSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoSolicitud(true);
    setErrorSolicitud(null);
    setSolicitudExitosa(false);

    const payload = {
      empresa: formSolicitud.empresa,
      rut_empresa: formSolicitud.rut_empresa,
      contacto_nombre: formSolicitud.contacto_nombre,
      contacto_cargo: formSolicitud.contacto_cargo,
      contacto_email: formSolicitud.contacto_email,
      contacto_telefono: formSolicitud.contacto_telefono,
      tipo_capacitacion: formSolicitud.tipo_capacitacion,
      tema: formSolicitud.temaId ? parseInt(formSolicitud.temaId) : null,
      perfil_relator: formSolicitud.perfil_relator,
      modalidad: formSolicitud.modalidad,
      region_comuna: formSolicitud.region_comuna,
      cantidad_trabajadores: Number(formSolicitud.cantidad_trabajadores) || 10,
      fecha_tentativa: formSolicitud.fecha_tentativa || null,
      mensaje_adicional: formSolicitud.mensaje_adicional,
    };

    try {
      const res = await authFetch(getApiUrl("/api/solicitudes-capacitacion/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || "Error al procesar la solicitud de relator.");
      }

      setSolicitudExitosa(true);
      fetchSolicitudes();
      setFormSolicitud({
        empresa: "",
        rut_empresa: "",
        contacto_nombre: "",
        contacto_cargo: "",
        contacto_email: "",
        contacto_telefono: "",
        tipo_capacitacion: "LEY_KARIN",
        temaId: "",
        perfil_relator: "Ingeniero en Prevención de Riesgos (Registro SEREMI / SNS)",
        modalidad: "PRESENCIAL",
        region_comuna: "",
        cantidad_trabajadores: 15,
        fecha_tentativa: "",
        mensaje_adicional: "",
      });
    } catch (err: any) {
      setErrorSolicitud(err.message || "Error al enviar la solicitud.");
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const abrirWhatsAppPrioritario = () => {
    const temaTexto = formSolicitud.temaId
      ? temasAcademia.find((t) => t.id === parseInt(formSolicitud.temaId))?.titulo
      : "Capacitación a Medida";
    const msg = encodeURIComponent(
      `Hola equipo HD Prevención, requiero cotización y coordinación prioritaria de un Relator Especializado (${formSolicitud.perfil_relator}) para la temática: "${temaTexto}" en modalidad ${formSolicitud.modalidad} para ${formSolicitud.cantidad_trabajadores} trabajadores en la ubicación: ${formSolicitud.region_comuna || "Terreno"}. Empresa: ${formSolicitud.empresa || "Cliente HD"}.`
    );
    window.open(`https://wa.me/56999999999?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* ========================================================
          ENCABEZADO GENERAL DEL MÓDULO CON SISTEMA DE PESTAÑAS
      ======================================================== */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-orange-500/20 via-amber-600/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-orange-600 text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                Plataforma Integral SST 2026
              </span>
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold px-3 py-1 rounded-full">
                Vigencia: D.S. N° 44 • Ley Karin • D.S. 594 • SUSESO
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white mt-3 tracking-tight">
              Capacitaciones, Conferencias & Relatorías
            </h1>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
              Gestiona actas digitales de firmas en faena, accede al catálogo oficial de conferencias on-demand con evaluación y certificado Ley 19.799, o solicita relatores externos acreditados (SEREMI / Kinesiólogos / Psicólogos) para tus centros de trabajo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab("RELATOR")}
              className="bg-slate-800 hover:bg-slate-700 text-orange-400 border border-slate-700 hover:border-orange-500/50 font-bold py-3 px-5 rounded-2xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <span>👷</span>
              <span>Solicitar Relator en Faena</span>
            </button>
            <button
              onClick={() => router.push("/panel/capacitaciones/nueva")}
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-orange-600/30 transition-all flex items-center gap-2 text-xs cursor-pointer hover:scale-[1.02]"
            >
              <span>🗓️</span>
              <span>Programar Sesión Interna</span>
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN DE SUBMÓDULOS (TABS ERGONÓMICAS) */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap gap-3 z-10 relative">
          <button
            onClick={() => setActiveTab("FAENA")}
            className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === "FAENA"
                ? "bg-orange-600 text-white shadow-lg shadow-orange-600/30 ring-2 ring-orange-400/30"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            }`}
          >
            <span className="text-base">📋</span>
            <span>[Submódulo A] Mis Capacitaciones & Registros en Faena</span>
            <span className="ml-1 bg-black/30 px-2 py-0.5 rounded-full text-[10px] font-mono">
              {capacitaciones.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ACADEMIA")}
            className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === "ACADEMIA"
                ? "bg-orange-600 text-white shadow-lg shadow-orange-600/30 ring-2 ring-orange-400/30"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            }`}
          >
            <span className="text-base">🎓</span>
            <span>[Submódulo B] Academia HD: Conferencias Grabadas On-Demand</span>
            <span className="ml-1 bg-black/30 px-2 py-0.5 rounded-full text-[10px] font-mono">
              {temasAcademia.length} Cursos
            </span>
          </button>

          <button
            onClick={() => setActiveTab("RELATOR")}
            className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === "RELATOR"
                ? "bg-orange-600 text-white shadow-lg shadow-orange-600/30 ring-2 ring-orange-400/30"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            }`}
          >
            <span className="text-base">👷</span>
            <span>[Submódulo C] Solicitar Relator Externo Especializado</span>
            {solicitudes.length > 0 && (
              <span className="ml-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {solicitudes.length} sol.
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================
          SUBMÓDULO A: MIS CAPACITACIONES & REGISTROS EN FAENA
      ======================================================== */}
      {activeTab === "FAENA" && (
        <div className="space-y-6">
          {/* Tarjetas KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Cumplimiento del PAC</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-orange-600">{cumplimientoPAC}%</span>
                <span className="text-xs text-slate-400">meta anual 100%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-orange-600 h-1.5 rounded-full transition-all" style={{ width: `${cumplimientoPAC}%` }}></div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Sesiones Ejecutadas</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-emerald-600">{realizadas}</span>
                <span className="text-xs text-slate-400">de {total} programadas</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-2">
                ✓ Actas cerradas con firmas digitales
              </span>
            </div>

            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Sesiones Pendientes</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-amber-500">{pendientes}</span>
                <span className="text-xs text-slate-400">por ejecutar</span>
              </div>
              <span className="text-[11px] text-amber-500 font-semibold block mt-2">
                ⏳ Dentro del cronograma mensual
              </span>
            </div>

            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Trabajadores Alcanzados</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalAsistentes}</span>
                <span className="text-xs text-slate-400">firmas únicas</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium block mt-2">
                Registro probatorio para DT / SEREMI
              </span>
            </div>
          </div>

          {/* Banner de Cruce con la Academia HD y Relatorías */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-orange-950/30 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-2xl shrink-0">
                🎓
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>¿Prefieres capacitar a tus trabajadores con conferencias on-demand con examen y certificado?</span>
                  <span className="text-[10px] bg-orange-600 text-white font-bold px-2 py-0.5 rounded-full">
                    Nuevo
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Accede a los 13 programas oficiales deducidos de las normas de DT, MINSAL y SUSESO en la Academia HD con emisión de diplomas con QR bajo la Ley N° 19.799.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("ACADEMIA")}
              className="shrink-0 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all cursor-pointer shadow-md"
            >
              Explorar Academia HD →
            </button>
          </div>

          {/* Barra de Filtros */}
          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between shadow-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700 dark:text-slate-300"
                >
                  <option value="TODOS">Todos los Estados</option>
                  <option value="PROGRAMADA">Programadas (Pendientes)</option>
                  <option value="REALIZADA">Realizadas (Finalizadas con Firmas)</option>
                  <option value="CANCELADA">Canceladas</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Categoría Normativa</label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700 dark:text-slate-300"
                >
                  <option value="TODOS">Todas las Categorías</option>
                  <option value="CURSOS_FORMALES">🎓 Submódulo Cursos Formales D.S. N° 44 (8h / 20h / 1h)</option>
                  <option value="CURSO_8H_GENERO">Curso Bienal 8h Género (Art. 16 D.S. N° 44)</option>
                  <option value="CURSO_20H_CPHS">Curso 20h CPHS (Mutualidad / D.S. N° 44)</option>
                  <option value="CURSO_1H_EPP">Capacitación Obligatoria EPP 1h (D.S. N° 44)</option>
                  <option value="INDUCCION_ODI">Inducción de riesgos laborales (Art. 15 D.S. N° 44)</option>
                  <option value="LEY_KARIN">Prevención Ley Karin (Ley 21.643)</option>
                  <option value="CHARLA_5_MIN">Charla Operativa de 5 Minutos</option>
                  <option value="CURSO_TEORICO">Capacitación Teórica General</option>
                  <option value="CURSO_PRACTICO">Capacitación Práctica / Simulacro</option>
                </select>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              Mostrando {capacitacionesFiltradas.length} sesiones registradas
            </span>
          </div>

          {/* Listado de Sesiones de Terreno */}
          {loadingCapacitaciones ? (
            <div className="flex justify-center items-center py-24 flex-col space-y-3">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-xs font-bold">Cargando registros de faena...</p>
            </div>
          ) : errorCapacitaciones ? (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center">
              <p className="font-bold text-sm">Error al Cargar Registros</p>
              <p className="text-xs mt-1">{errorCapacitaciones}</p>
              <button
                onClick={fetchCapacitaciones}
                className="mt-4 bg-red-600 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-red-700"
              >
                Reintentar
              </button>
            </div>
          ) : capacitacionesFiltradas.length === 0 ? (
            <div className="bg-white dark:bg-slate-950 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
              <span className="text-5xl mb-3">📢</span>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Sin Capacitaciones en Faena</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-md">
                No tienes sesiones que coincidan con los filtros aplicados. Puedes programar una nueva capacitación o impartir las conferencias de la Academia HD.
              </p>
              <button
                onClick={() => router.push("/panel/capacitaciones/nueva")}
                className="mt-6 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                + Programar Primera Charla de Faena
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {capacitacionesFiltradas.map((cap) => {
                const esCursoFormal =
                  cap.tema_detalle?.categoria === "CURSO_8H_GENERO" ||
                  cap.tema_detalle?.categoria === "CURSO_20H_CPHS" ||
                  cap.tema_detalle?.categoria === "CURSO_1H_EPP" ||
                  cap.tema_detalle?.categoria === "LEY_KARIN";

                return (
                  <div
                    key={cap.id}
                    className={`bg-white dark:bg-slate-950 p-6 rounded-2xl border ${
                      esCursoFormal
                        ? "border-emerald-300 dark:border-emerald-800/80 shadow-md shadow-emerald-950/5"
                        : "border-slate-200 dark:border-slate-800 shadow-sm"
                    } hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}
                  >
                    <div className="space-y-2 flex-grow max-w-3xl">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            cap.estado === "REALIZADA"
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                              : cap.estado === "PROGRAMADA"
                              ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                              : "bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50"
                          }`}
                        >
                          {cap.estado === "REALIZADA"
                            ? "✔ Ejecutada / Firmada"
                            : cap.estado === "PROGRAMADA"
                            ? "⏳ Programada / Pendiente"
                            : "✖ Cancelada"}
                        </span>

                        {cap.tema_detalle && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                            {cap.tema_detalle.categoria_display || cap.tema_detalle.categoria}
                          </span>
                        )}

                        {cap.tema_detalle && (
                          <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-mono">
                            ⏱️ {cap.tema_detalle.duracion_minutos} Minutos
                          </span>
                        )}

                        {esCursoFormal && (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            🎓 Programa Formal Regulado D.S. N° 44
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {cap.tema_titulo}
                      </h3>

                      {esCursoFormal && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                          <span>✓ Exige Evaluación de Comprensión (Aprobación &ge; 75%)</span>
                          <span>• Validez Oficial SG-SST</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <span>📅</span>
                          <span>Prog: {new Date(cap.fecha_programada + "T00:00:00").toLocaleDateString()}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span>📍</span>
                          <span className="truncate">Lugar: {cap.lugar}</span>
                        </span>
                        {cap.estado === "REALIZADA" ? (
                          <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                            <span>👥</span>
                            <span>Asistieron: {cap.asistentes.length} trabajadores</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <span>👤</span>
                            <span>Relator: {cap.username}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex space-x-2 w-full md:w-auto justify-end">
                      {cap.estado === "PROGRAMADA" ? (
                        <button
                          onClick={() => router.push(`/panel/capacitaciones/${cap.id}`)}
                          className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
                        >
                          Dictar y Firmar en Terreno →
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/panel/capacitaciones/${cap.id}`)}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs border border-slate-200 dark:border-slate-800 cursor-pointer whitespace-nowrap flex items-center space-x-1.5"
                        >
                          <span>🖨️</span>
                          <span>Ver Acta & Firmas</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUBMÓDULO B: ACADEMIA HD: CONFERENCIAS GRABADAS ON-DEMAND
      ======================================================== */}
      {activeTab === "ACADEMIA" && (
        <div className="space-y-6">
          {/* Banner de Presentación Academia HD */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 p-8 rounded-3xl border border-slate-800 relative overflow-hidden shadow-xl">
            <div className="absolute right-0 top-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 max-w-3xl">
              <span className="bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-black uppercase px-3 py-1 rounded-full">
                🎬 Catálogo de Conferencias Reguladas On-Demand
              </span>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white mt-3">
                Academia HD: Cumplimiento Normativo 2025 / 2026
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Cada conferencia cubre el temario técnico y las horas cronológicas obligatorias exigidas por la Dirección del Trabajo (D.S. N° 44), el Ministerio de Salud (D.S. 594 y Protocolos) y la SUSESO. Incluye evaluación obligatoria (&ge; 75%) y diploma digital con código QR verificable bajo la Ley N° 19.799.
              </p>
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase mr-2">Organismo:</span>
              {[
                { label: "Todos", value: "TODOS" },
                { label: "DT (Dirección del Trabajo)", value: "DT" },
                { label: "MINSAL / SEREMI", value: "MINSAL" },
                { label: "SUSESO", value: "SUSESO" },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setFiltroOrganismo(btn.value)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filtroOrganismo === btn.value
                      ? "bg-orange-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Buscar por curso, ley o relator..."
                value={busquedaAcademia}
                onChange={(e) => setBusquedaAcademia(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 pl-9"
              />
              <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
            </div>
          </div>

          {/* Grid de Conferencias */}
          {loadingAcademia ? (
            <div className="flex justify-center items-center py-24 flex-col space-y-3">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-xs font-bold">Cargando catálogo oficial de conferencias...</p>
            </div>
          ) : errorAcademia ? (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center">
              <p className="font-bold text-sm">Error al Cargar Academia</p>
              <p className="text-xs mt-1">{errorAcademia}</p>
              <button
                onClick={fetchTemasAcademia}
                className="mt-4 bg-red-600 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-red-700"
              >
                Reintentar
              </button>
            </div>
          ) : conferenciasFiltradas.length === 0 ? (
            <div className="bg-white dark:bg-slate-950 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-4xl">🔍</span>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mt-2">
                No se encontraron conferencias con los filtros seleccionados
              </h3>
              <p className="text-slate-500 text-xs mt-1">Prueba seleccionando otro organismo o limpiando el texto de búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {conferenciasFiltradas.map((conf) => {
                const horas = (conf.duracion_minutos / 60).toFixed(1).replace(".0", "");
                const esGratisPlan = !conf.precio_clp || conf.precio_clp === 0;

                return (
                  <div
                    key={conf.id}
                    className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group hover:border-orange-500/50"
                  >
                    {/* Header de la Tarjeta */}
                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <span>🎬</span>
                          <span>Conferencia On-Demand</span>
                        </span>

                        <span className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                          ⏱️ {conf.duracion_minutos} min ({horas}h)
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug group-hover:text-orange-500 transition-colors">
                        {conf.titulo}
                      </h3>

                      {/* Badge Normativa Legal Vigente (Cita doc_agents) */}
                      <div className="bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                            ⚖️ Base Legal Vigente
                          </span>
                          <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                            {conf.organismo_exigente || "DT / MINSAL"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium line-clamp-2">
                          {conf.normativa_legal_vigente}
                        </p>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                        {conf.descripcion}
                      </p>

                      {/* Garantías de Aprobación y QR */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>✓</span>
                          <span>Evaluación Obligatoria (&ge; {conf.porcentaje_aprobacion || 75}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>📜</span>
                          <span>Certificado Digital con QR bajo Ley N° 19.799</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 italic">
                          <span>👤</span>
                          <span className="truncate">{conf.relator_predeterminado}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer y Acciones de la Tarjeta */}
                    <div className="p-6 pt-0 space-y-3">
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-900">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Acceso Corporativo</span>
                          {esGratisPlan ? (
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                              ✓ Incluido en Plan HD
                            </span>
                          ) : (
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              ${conf.precio_clp?.toLocaleString("es-CL")} CLP
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => descargarGuiaEstudio(conf)}
                          title="Descargar Guía y Resumen Legal Oficial"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
                        >
                          📥 Resumen
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => abrirConferencia(conf)}
                          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-md shadow-orange-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>▶ Ver Conferencia</span>
                        </button>
                        <button
                          onClick={() => {
                            setFormSolicitud((prev) => ({
                              ...prev,
                              temaId: conf.id.toString(),
                              perfil_relator: conf.relator_predeterminado || prev.perfil_relator,
                              tipo_capacitacion: conf.categoria || prev.tipo_capacitacion,
                            }));
                            setActiveTab("RELATOR");
                          }}
                          className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>👷 Pedir en Faena</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUBMÓDULO C: SOLICITAR RELATOR EXTERNO ESPECIALIZADO
      ======================================================== */}
      {activeTab === "RELATOR" && (
        <div className="space-y-8">
          {/* Banner de Presentación Relatorías */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/30 p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 max-w-3xl">
              <span className="bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-black uppercase px-3 py-1 rounded-full">
                👷 Relatorías en Faena & Sincrónicas en Vivo
              </span>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white mt-3">
                Profesionales Acreditados con Registro SEREMI / SNS
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Si tu empresa requiere relatores en terreno o conferencias interactivas por videollamada para cumplimiento obligatorio (Ley Karin, TMERT, Extintores, Altura o CPHS), cotiza aquí la asignación de nuestros especialistas.
              </p>
            </div>
          </div>

          {/* Formulario y Tarjeta de WhatsApp */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Columna Izquierda / Centro: Formulario de Solicitud */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span>📝</span>
                <span>Formulario de Requerimiento de Relator</span>
              </h3>

              {solicitudExitosa && (
                <div className="mb-6 p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>✔</span>
                    <span>¡Solicitud Ingresada Exitosamente!</span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed">
                    Hemos registrado tu requerimiento en estado <strong>PENDIENTE</strong>. Nuestro equipo de coordinación técnica te contactará dentro de las próximas 2 horas hábiles con la cotización formal y propuesta de relator.
                  </p>
                  <button
                    onClick={abrirWhatsAppPrioritario}
                    className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
                  >
                    <span>💬</span>
                    <span>Agilizar por WhatsApp Directo</span>
                  </button>
                </div>
              )}

              {errorSolicitud && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-650 dark:text-red-400 text-xs font-semibold">
                  {errorSolicitud}
                </div>
              )}

              <form onSubmit={handleEnviarSolicitud} className="space-y-6">
                {/* Selector de Temática Vinculada a Cursos Deducidos */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                    Temática o Conferencia Requerida *
                  </label>
                  <select
                    value={formSolicitud.temaId}
                    onChange={(e) => handleSeleccionarTemaRelator(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Seleccionar del Catálogo Oficial o a Medida --</option>
                    {temasAcademia.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titulo} ({t.organismo_exigente}) - Duración: {t.duracion_minutos} min
                      </option>
                    ))}
                  </select>
                </div>

                {/* Perfil del Relator */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                    Perfil del Relator Especializado *
                  </label>
                  <select
                    value={formSolicitud.perfil_relator}
                    onChange={(e) => setFormSolicitud({ ...formSolicitud, perfil_relator: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="Ingeniero en Prevención de Riesgos (Registro SEREMI / SNS)">
                      Ingeniero en Prevención de Riesgos (Registro SEREMI / SNS)
                    </option>
                    <option value="Psicólogo Laboral (Especialista Ley Karin / CEAL-SM)">
                      Psicólogo Laboral (Especialista Ley Karin / CEAL-SM)
                    </option>
                    <option value="Kinesiólogo / Ergónomo Ocupacional (TMERT / Ley 20.949)">
                      Kinesiólogo / Ergónomo Ocupacional (TMERT / Ley 20.949)
                    </option>
                    <option value="Instructor Especialista en Fuego y Emergencias (Extintores)">
                      Instructor Especialista en Fuego y Emergencias (Extintores)
                    </option>
                    <option value="Higienista Industrial (Ruido PREXOR / Sílice / Químicos)">
                      Higienista Industrial (Ruido PREXOR / Sílice / Químicos)
                    </option>
                  </select>
                </div>

                {/* Modalidad de Relatoría */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                    Modalidad Deseada *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: "PRESENCIAL", label: "Presencial en Terreno / Faena", icon: "👷" },
                      { id: "ONLINE", label: "Sincrónica Online (En Vivo)", icon: "💻" },
                      { id: "MIXTA", label: "Modalidad Híbrida", icon: "🔄" },
                    ].map((mod) => (
                      <button
                        type="button"
                        key={mod.id}
                        onClick={() => setFormSolicitud({ ...formSolicitud, modalidad: mod.id as any })}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          formSolicitud.modalidad === mod.id
                            ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 ring-2 ring-orange-500/20"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-2xl">{mod.icon}</span>
                        <span className="text-xs font-bold mt-2">{mod.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ubicación y Dotación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Ubicación / Faena / Comuna *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Faena Minera Los Bronces, Colina"
                      value={formSolicitud.region_comuna}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, region_comuna: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Dotación Estimada de Trabajadores *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="Ej: 25"
                      value={formSolicitud.cantidad_trabajadores}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, cantidad_trabajadores: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Fecha Tentativa */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Fecha y Horario Tentativo Deseado
                  </label>
                  <input
                    type="date"
                    value={formSolicitud.fecha_tentativa}
                    onChange={(e) => setFormSolicitud({ ...formSolicitud, fecha_tentativa: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Datos de Contacto de la Empresa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-900">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Razón Social Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Constructora Andina SpA"
                      value={formSolicitud.empresa}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, empresa: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      RUT Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="76.123.456-7"
                      value={formSolicitud.rut_empresa}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, rut_empresa: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Nombre Contacto *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Claudia Morales"
                      value={formSolicitud.contacto_nombre}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, contacto_nombre: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+56 9 8765 4321"
                      value={formSolicitud.contacto_telefono}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, contacto_telefono: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Correo Electrónico de Contacto *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="prevencion@empresa.cl"
                      value={formSolicitud.contacto_email}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, contacto_email: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Observaciones o Requerimientos de Terreno (Opcional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ej: Se requiere equipo de protección para ingreso a faena, inducción previa al relator, etc."
                      value={formSolicitud.mensaje_adicional}
                      onChange={(e) => setFormSolicitud({ ...formSolicitud, mensaje_adicional: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    ></textarea>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={enviandoSolicitud}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 px-6 rounded-2xl text-xs transition-all shadow-lg shadow-orange-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {enviandoSolicitud ? "Enviando Solicitud..." : "Enviar Solicitud a la Plataforma"}
                  </button>

                  <button
                    type="button"
                    onClick={abrirWhatsAppPrioritario}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>💬</span>
                    <span>Contactar por WhatsApp</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Columna Derecha: Beneficios y Seguimiento de Solicitudes */}
            <div className="space-y-6">
              {/* Tarjeta Informativa de Confianza */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 space-y-4">
                <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  Garantía HD Prevención
                </span>
                <h4 className="text-base font-extrabold text-white">
                  ¿Por qué contratar relatores externos con nosotros?
                </h4>
                <ul className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">✓</span>
                    <span><strong>Acreditación SEREMI / SNS:</strong> Todos los ingenieros cuentan con registro sanitario vigente.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">✓</span>
                    <span><strong>Actas y Diplomas:</strong> Emisión de certificados digitales con QR para respaldo de auditoría laboral.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">✓</span>
                    <span><strong>Cobertura Nacional:</strong> Atención en faenas mineras, forestales, constructoras y oficinas corporativas.</span>
                  </li>
                </ul>
              </div>

              {/* Historial / Seguimiento de Solicitudes Realizadas */}
              <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📋</span>
                    <span>Mis Solicitudes de Relator</span>
                  </h4>
                  <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-slate-500">
                    {solicitudes.length} registros
                  </span>
                </div>

                {loadingSolicitudes ? (
                  <p className="text-xs text-slate-400 italic">Cargando solicitudes...</p>
                ) : solicitudes.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No registras solicitudes previas de relator.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {solicitudes.map((sol) => (
                      <div
                        key={sol.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sol.estado === "FINALIZADO"
                                ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                : sol.estado === "COORDINADO"
                                ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                                : sol.estado === "COTIZADO"
                                ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                                : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {sol.estado_display || sol.estado}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(sol.fecha_creacion).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {sol.tema_titulo || sol.tipo_capacitacion_display || sol.tipo_capacitacion}
                        </p>
                        <div className="text-[10px] text-slate-500 space-y-0.5">
                          <p>📍 Faena: {sol.region_comuna}</p>
                          <p>👥 Dotación: {sol.cantidad_trabajadores} trabajadores ({sol.modalidad_display || sol.modalidad})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL INTERACTIVO: REPRODUCTOR, EVALUACIÓN Y CERTIFICADO
      ======================================================== */}
      {conferenciaSeleccionada && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
            {/* Header del Modal */}
            <div className="bg-slate-900 text-white p-6 flex items-start justify-between border-b border-slate-800 shrink-0">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-orange-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                    Conferencia Grabada On-Demand
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {conferenciaSeleccionada.organismo_exigente}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white leading-tight">
                  {conferenciaSeleccionada.titulo}
                </h3>
                <p className="text-xs text-orange-400 font-medium">
                  ⚖️ Base Legal: {conferenciaSeleccionada.normativa_legal_vigente}
                </p>
              </div>

              <button
                onClick={() => setConferenciaSeleccionada(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer text-xl"
              >
                ✕
              </button>
            </div>

            {/* Pestañas del Modal */}
            <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2 flex gap-2 shrink-0">
              <button
                onClick={() => setModalTab("VIDEO")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === "VIDEO"
                    ? "bg-white dark:bg-slate-950 text-orange-600 shadow-sm border border-slate-200 dark:border-slate-800"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>📺</span>
                <span>Reproductor & Temario</span>
              </button>

              <button
                onClick={() => setModalTab("EVALUACION")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === "EVALUACION"
                    ? "bg-white dark:bg-slate-950 text-orange-600 shadow-sm border border-slate-200 dark:border-slate-800"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>📝</span>
                <span>Evaluación de Comprensión (&ge; 75%)</span>
                {examenCalificado && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      puntajeExamen.porcentaje >= (conferenciaSeleccionada.porcentaje_aprobacion || 75)
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {puntajeExamen.porcentaje}%
                  </span>
                )}
              </button>

              <button
                onClick={() => setModalTab("CERTIFICADO")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === "CERTIFICADO"
                    ? "bg-white dark:bg-slate-950 text-orange-600 shadow-sm border border-slate-200 dark:border-slate-800"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>🏆</span>
                <span>Certificado Digital Oficial</span>
                {examenCalificado && puntajeExamen.porcentaje >= (conferenciaSeleccionada.porcentaje_aprobacion || 75) && (
                  <span className="ml-1 text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                    Aprobado
                  </span>
                )}
              </button>
            </div>

            {/* Contenido del Modal Scrollable */}
            <div className="p-6 overflow-y-auto flex-grow space-y-6">
              {/* TAB 1: REPRODUCTOR DE VIDEO Y TEMARIO */}
              {modalTab === "VIDEO" && (
                <div className="space-y-6">
                  {/* Reproductor de Video Interactivo Simulado con Controles */}
                  <div className="bg-black rounded-2xl overflow-hidden shadow-xl aspect-video relative flex flex-col justify-end group">
                    <video
                      src={conferenciaSeleccionada.video_url || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
                      controls
                      className="w-full h-full object-contain"
                      onPlay={() => setVideoReproduciendo(true)}
                      onPause={() => setVideoReproduciendo(false)}
                      onTimeUpdate={(e) => {
                        const target = e.currentTarget;
                        if (target.duration) {
                          setVideoProgreso(Math.round((target.currentTime / target.duration) * 100));
                        }
                      }}
                    />
                  </div>

                  {/* Barra de Progreso de Capacitación */}
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="space-y-1 flex-grow">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-slate-300">Avance de la Conferencia Grabada</span>
                        <span className="text-orange-600">{videoProgreso}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${videoProgreso}%` }}
                        ></div>
                      </div>
                    </div>

                    <button
                      onClick={() => setModalTab("EVALUACION")}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shadow-sm"
                    >
                      Ir a Evaluación →
                    </button>
                  </div>

                  {/* Temario Paso a Paso y Contenidos Clave */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>📚</span>
                        <span>Temario y Contenidos Exigidos por la Norma</span>
                      </h4>
                      <button
                        onClick={() => descargarGuiaEstudio(conferenciaSeleccionada)}
                        className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>📥</span>
                        <span>Descargar Guía en PDF / Markdown</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {conferenciaSeleccionada.contenido_clave.map((punto, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <span className="bg-orange-600 text-white w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-snug">{punto}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EVALUACIÓN DE COMPRENSIÓN OBLIGATORIA */}
              {modalTab === "EVALUACION" && (
                <div className="space-y-6">
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-5 rounded-2xl border border-orange-200 dark:border-orange-900/40 space-y-1">
                    <h4 className="text-sm font-black text-orange-800 dark:text-orange-300 flex items-center gap-2">
                      <span>⚖️</span>
                      <span>Exigencia Reglamentaria de Comprensión (Aprobación &ge; {conferenciaSeleccionada.porcentaje_aprobacion || 75}%)</span>
                    </h4>
                    <p className="text-xs text-orange-700/80 dark:text-orange-400/80 leading-relaxed">
                      Conforme al D.S. N° 44 (Art. 13 y 16) y directrices de los organismos fiscalizadores, es obligatorio verificar el aprendizaje de los participantes para certificar legalmente la capacitación.
                    </p>
                  </div>

                  {/* Preguntas de Evaluación */}
                  <div className="space-y-6">
                    {conferenciaSeleccionada.preguntas_evaluacion?.map((pregunta, index) => {
                      const seleccionada = respuestasUsuario[pregunta.id];
                      const esCorrecta = seleccionada === pregunta.correcta;

                      return (
                        <div
                          key={pregunta.id}
                          className={`p-5 rounded-2xl border transition-all ${
                            examenCalificado
                              ? esCorrecta
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                                : "bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-800"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <p className="text-xs font-black text-slate-900 dark:text-white mb-3">
                            {index + 1}. {pregunta.pregunta}
                          </p>

                          <div className="space-y-2">
                            {pregunta.opciones.map((opcion, opcIndex) => {
                              const estaElegida = seleccionada === opcIndex;
                              const esOpcionCorrecta = pregunta.correcta === opcIndex;

                              let estiloOpcion =
                                "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300";
                              if (examenCalificado) {
                                if (esOpcionCorrecta) {
                                  estiloOpcion =
                                    "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold";
                                } else if (estaElegida && !esCorrecta) {
                                  estiloOpcion =
                                    "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-200";
                                }
                              } else if (estaElegida) {
                                estiloOpcion =
                                  "bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-600 dark:text-orange-400 font-bold ring-2 ring-orange-500/20";
                              }

                              return (
                                <button
                                  type="button"
                                  key={opcIndex}
                                  onClick={() => {
                                    if (!examenCalificado) {
                                      setRespuestasUsuario({ ...respuestasUsuario, [pregunta.id]: opcIndex });
                                    }
                                  }}
                                  className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${estiloOpcion}`}
                                >
                                  <span>{opcion}</span>
                                  {estaElegida && !examenCalificado && <span>✓</span>}
                                  {examenCalificado && esOpcionCorrecta && <span className="text-emerald-600 font-bold">✔ Correcta</span>}
                                </button>
                              );
                            })}
                          </div>

                          {examenCalificado && (
                            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                              💡 <strong>Fundamento Normativo:</strong> {pregunta.explicacion}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Botón de Calificación o Reinicio */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      {examenCalificado && (
                        <div className="text-xs">
                          <span className="font-bold">Resultado Final: </span>
                          <span
                            className={`font-black ${
                              puntajeExamen.porcentaje >= (conferenciaSeleccionada.porcentaje_aprobacion || 75)
                                ? "text-emerald-600"
                                : "text-red-650"
                            }`}
                          >
                            {puntajeExamen.correctas} de {puntajeExamen.total} correctas ({puntajeExamen.porcentaje}%)
                          </span>
                          <span className="text-slate-400 ml-2">
                            {puntajeExamen.porcentaje >= (conferenciaSeleccionada.porcentaje_aprobacion || 75)
                              ? "— ¡Aprobado! Certificado desbloqueado"
                              : "— No alcanza el 75%. Repasa y reintenta."}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {examenCalificado ? (
                        <>
                          <button
                            onClick={() => {
                              setExamenCalificado(false);
                              setRespuestasUsuario({});
                            }}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            Reintentar Examen
                          </button>
                          {puntajeExamen.porcentaje >= (conferenciaSeleccionada.porcentaje_aprobacion || 75) && (
                            <button
                              onClick={() => setModalTab("CERTIFICADO")}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                            >
                              Ver Certificado Oficial →
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={calificarExamen}
                          disabled={
                            Object.keys(respuestasUsuario).length <
                            (conferenciaSeleccionada.preguntas_evaluacion?.length || 0)
                          }
                          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                        >
                          Calificar Evaluación de Comprensión
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CERTIFICADO DIGITAL OFICIAL LEY 19.799 */}
              {modalTab === "CERTIFICADO" && (
                <div className="space-y-6">
                  {/* Formulario rápido para personalizar nombre en diploma */}
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Trabajador / Participante</label>
                      <input
                        type="text"
                        value={nombreCertificado}
                        onChange={(e) => setNombreCertificado(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RUT Trabajador</label>
                      <input
                        type="text"
                        value={rutCertificado}
                        onChange={(e) => setRutCertificado(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Empresa / Empleador</label>
                      <input
                        type="text"
                        value={empresaCertificado}
                        onChange={(e) => setEmpresaCertificado(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Diploma Visual Oficial Imprimible */}
                  <div
                    id="diploma-imprimible"
                    className="bg-gradient-to-b from-amber-50/40 via-white to-amber-50/30 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 p-10 rounded-3xl border-4 border-double border-amber-600/40 shadow-2xl relative text-center space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-amber-600/20 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">🛡️</span>
                        <div className="text-left">
                          <h4 className="font-black text-sm tracking-widest text-slate-900 dark:text-white uppercase">HD Prevención SpA</h4>
                          <span className="text-[10px] text-slate-400 font-semibold">Organismo Técnico de Asesoría en Seguridad & Salud en el Trabajo</span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-600 border border-amber-600/30 px-3 py-1 rounded-full bg-amber-500/10">
                        N° REGISTRO: HDP-{conferenciaSeleccionada.id}-{Date.now().toString().slice(-6)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                        Certificado Oficial de Aprobación & Capacitación
                      </span>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif">
                        {nombreCertificado || "Trabajador Acreditado"}
                      </h2>
                      <p className="text-xs text-slate-500">
                        RUT: <strong className="text-slate-700 dark:text-slate-300">{rutCertificado}</strong> • Empresa: <strong className="text-slate-700 dark:text-slate-300">{empresaCertificado}</strong>
                      </p>
                    </div>

                    <div className="max-w-xl mx-auto space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      <p>
                        Ha aprobado satisfactoriamente los contenidos y la evaluación reglamentaria del programa oficial:
                      </p>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white py-1">
                        "{conferenciaSeleccionada.titulo}"
                      </h3>
                      <p>
                        Con una duración académica de <strong>{conferenciaSeleccionada.duracion_minutos} minutos cronológicos ({(conferenciaSeleccionada.duracion_minutos / 60).toFixed(1)} Horas)</strong>, bajo la estricta vigencia legal de:
                      </p>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-amber-600/30 font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                        {conferenciaSeleccionada.normativa_legal_vigente}
                      </div>
                    </div>

                    {/* Footer con Sellos, QR y Firmas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-amber-600/20 items-center">
                      {/* Firma Relator */}
                      <div className="space-y-1 text-center">
                        <div className="w-36 h-0.5 bg-slate-400 mx-auto"></div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{conferenciaSeleccionada.relator_predeterminado}</p>
                        <p className="text-[10px] text-slate-400">Relator Oficial HD Prevención</p>
                      </div>

                      {/* Código QR Verificable SVG */}
                      <div className="flex flex-col items-center space-y-1">
                        <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-300 shadow-sm flex items-center justify-center">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <rect width="100" height="100" fill="#ffffff" />
                            <rect x="10" y="10" width="25" height="25" fill="#000000" />
                            <rect x="15" y="15" width="15" height="15" fill="#ffffff" />
                            <rect x="18" y="18" width="9" height="9" fill="#000000" />
                            <rect x="65" y="10" width="25" height="25" fill="#000000" />
                            <rect x="70" y="15" width="15" height="15" fill="#ffffff" />
                            <rect x="73" y="18" width="9" height="9" fill="#000000" />
                            <rect x="10" y="65" width="25" height="25" fill="#000000" />
                            <rect x="15" y="70" width="15" height="15" fill="#ffffff" />
                            <rect x="18" y="73" width="9" height="9" fill="#000000" />
                            <rect x="45" y="20" width="10" height="10" fill="#000000" />
                            <rect x="40" y="45" width="20" height="20" fill="#000000" />
                            <rect x="65" y="45" width="10" height="10" fill="#000000" />
                            <rect x="45" y="70" width="15" height="15" fill="#000000" />
                            <rect x="70" y="70" width="20" height="20" fill="#000000" />
                          </svg>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400">Verificación Ley 19.799</span>
                      </div>

                      {/* Firma Dirección Técnica */}
                      <div className="space-y-1 text-center">
                        <div className="w-36 h-0.5 bg-slate-400 mx-auto"></div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Dirección Técnica y Auditoría</p>
                        <p className="text-[10px] text-slate-400">HD Prevención SpA • Chile</p>
                      </div>
                    </div>

                    <p className="text-[9px] text-slate-400 font-mono pt-2">
                      Emitido el {new Date().toLocaleDateString("es-CL")} • Validez Legal Oficial para Inspección del Trabajo (DT) y SEREMI de Salud.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => window.print()}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-2xl text-xs transition-all shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <span>🖨️</span>
                      <span>Imprimir / Guardar en PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
