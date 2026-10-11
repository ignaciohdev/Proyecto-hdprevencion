"use client";

import { useEffect, useState, useMemo } from "react";
import { getApiUrl } from "../../../utils/api";

// Tipado estricto bajo estándar TypeScript 5.x y serializers de Django REST Framework
export interface ReporteRiesgo {
  id: number;
  tipo: "ACTO" | "CONDICION";
  descripcion: string;
  lugar: string;
  gravedad: "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
  estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO";
  medida_correctiva: string | null;
  fecha_creacion: string;
  username: string;
  reportado_por_externo: boolean;
  nombre_reportante: string | null;
  rut_reportante: string | null;
  contacto_reportante: string | null;
  empresa_faena: string;
  area_puesto: string;
  clasificacion_peligro: "FISICO" | "QUIMICO" | "BIOLOGICO" | "ERGONOMICO" | "PSICOSOCIAL" | "SEGURIDAD";
  norma_infringida: string;
  probabilidad: number;
  severidad: number;
  nivel_riesgo_calculado: string;
  jerarquia_control: "ELIMINACION" | "SUSTITUCION" | "INGENIERIA" | "ADMINISTRATIVO" | "EPP";
  responsable: string;
  fecha_limite: string | null;
  foto_evidencia: string;
  fecha_resolucion: string | null;
}

interface PlantillaHallazgo {
  id: string;
  titulo: string;
  categoria: string;
  tipo: "ACTO" | "CONDICION";
  clasificacion_peligro: "FISICO" | "QUIMICO" | "BIOLOGICO" | "ERGONOMICO" | "PSICOSOCIAL" | "SEGURIDAD";
  norma_infringida: string;
  descripcion: string;
  probabilidad: number;
  severidad: number;
  jerarquia_control: "ELIMINACION" | "SUSTITUCION" | "INGENIERIA" | "ADMINISTRATIVO" | "EPP";
  medida_sugerida: string;
  plazo_dias: number;
}

// Catálogo normativo chileno para levantamiento rápido en terreno (DS 594, DS 76, MINSAL)
const PLANTILLAS_NORMATIVAS: PlantillaHallazgo[] = [
  {
    id: "extintores-ds594",
    titulo: "Extintor Vencido o sin Señalizar",
    categoria: "DS 594 / Protección Contra Incendios",
    tipo: "CONDICION",
    clasificacion_peligro: "SEGURIDAD",
    norma_infringida: "DS 594 Art. 45 / NCh 1430 (Extintores Portátiles)",
    descripcion: "Extintor PQS con carga vencida según etiqueta de servicio técnico y ubicado a más de 1.30 m de altura o sin demarcación reglamentaria de piso.",
    probabilidad: 2,
    severidad: 2,
    jerarquia_control: "ADMINISTRATIVO",
    medida_sugerida: "Enviar a recarga inmediata con mantenedor autorizado (NCh 2056), demarcar zona de seguridad en piso y regularizar altura del soporte.",
    plazo_dias: 3,
  },
  {
    id: "andamio-altura-ds76",
    titulo: "Trabajo en Altura sin Baranda ni Rodapié",
    categoria: "DS 76 Construcción / Trabajo en Altura",
    tipo: "CONDICION",
    clasificacion_peligro: "SEGURIDAD",
    norma_infringida: "DS 76 Art. 14 / NCh 998 / NCh 1258",
    descripcion: "Plataforma de andamio en uso sobre 1.80 m de altura sin rodapié perimetral, sin baranda superior a 1.0 m ni baranda intermedia, con riesgo inminente de caída de personas y objetos.",
    probabilidad: 3,
    severidad: 3,
    jerarquia_control: "INGENIERIA",
    medida_sugerida: "Detener la faena en altura de inmediato. Instalar barandas superior, intermedia y rodapié de 15 cm. Instalar tarjeta verde de inspección antes de reanudar.",
    plazo_dias: 1,
  },
  {
    id: "tablero-electrico-ds594",
    titulo: "Tablero Eléctrico sin Tapa ni Diferencial",
    categoria: "DS 594 / Riesgo Eléctrico",
    tipo: "CONDICION",
    clasificacion_peligro: "SEGURIDAD",
    norma_infringida: "DS 594 Art. 38 / NCh Elec 4/2003",
    descripcion: "Tablero eléctrico de faena con conductores energizados expuestos, sin acrílico de contratapa aislante y carente de disyuntor diferencial de sensibilidad 30 mA.",
    probabilidad: 2,
    severidad: 3,
    jerarquia_control: "INGENIERIA",
    medida_sugerida: "Desenergizar circuito, confinar conexiones en gabinete con llave, instalar protector diferencial reglamentario y señalizar con rótulo de peligro de electrocución.",
    plazo_dias: 1,
  },
  {
    id: "silice-planesi-minsal",
    titulo: "Corte de Concreto sin Abatimiento de Sílice",
    categoria: "Protocolo PLANESI / Salud Ocupacional",
    tipo: "ACTO",
    clasificacion_peligro: "QUIMICO",
    norma_infringida: "Protocolo MINSAL PLANESI / DS 594 Art. 65",
    descripcion: "Operario realizando corte de losa de concreto en seco, generando nube de polvo de sílice libre cristalizada sin sistema de humectación ni protección respiratoria con filtros P100.",
    probabilidad: 3,
    severidad: 3,
    jerarquia_control: "INGENIERIA",
    medida_sugerida: "Implementar corte húmedo continuo obligatorio, conectar extractor con filtro HEPA y dotar al operador de respirador de doble vía con filtros mixtos P100 bajo programa PLANESI.",
    plazo_dias: 1,
  },
  {
    id: "radiacion-uv-ds594",
    titulo: "Falta de Protector Solar y Registro Diario UV",
    categoria: "DS 594 / Radiación UV Solar",
    tipo: "CONDICION",
    clasificacion_peligro: "FISICO",
    norma_infringida: "DS 594 Art. 109a / Guía Técnica Radiación UV Solar MINSAL",
    descripcion: "Trabajadores en terreno expuestos a radiación solar sin dispensador disponible de protector solar FPS 30+ y sin publicación del índice UV diario en pizarra informativa.",
    probabilidad: 3,
    severidad: 1,
    jerarquia_control: "ADMINISTRATIVO",
    medida_sugerida: "Instalar dispensador de protector solar en faena, dotar de cubre-nucas tipo legionario a cascos y publicar diariamente el índice UV pronosticado por la Dirección Meteorológica.",
    plazo_dias: 2,
  },
  {
    id: "manejo-carga-ley20001",
    titulo: "Manejo Manual de Carga Excedido (> 25 kg)",
    categoria: "Ley 20.001 / Ergonomía TMERT",
    tipo: "ACTO",
    clasificacion_peligro: "ERGONOMICO",
    norma_infringida: "Ley 20.001 / DS 594 Art. 95 (Manejo Manual de Carga)",
    descripcion: "Trabajador realizando levantamiento y traslado manual de sacos con peso unitario superior a 25 kg sin apoyo mecánico ni técnica ergonómica adecuada.",
    probabilidad: 3,
    severidad: 2,
    jerarquia_control: "INGENIERIA",
    medida_sugerida: "Fraccionar carga o incorporar carro/transpaleta de apoyo mecánico. Capacitar al trabajador en levantamiento seguro bajo protocolo TMERT.",
    plazo_dias: 3,
  },
  {
    id: "vias-escape-ds594",
    titulo: "Vías de Evacuación Obstruidas con Materiales",
    categoria: "DS 594 / Condiciones Sanitarias y Ambientales",
    tipo: "CONDICION",
    clasificacion_peligro: "SEGURIDAD",
    norma_infringida: "DS 594 Art. 36 y 37 (Pasillos y Salidas de Emergencia)",
    descripcion: "Pasillos de tránsito y puertas de escape hacia zona de seguridad bloqueados con pallets y cajas en desuso, impidiendo una evacuación rápida ante emergencia.",
    probabilidad: 2,
    severidad: 2,
    jerarquia_control: "ADMINISTRATIVO",
    medida_sugerida: "Despejar de forma inmediata toda la franja de circulación peatonal, demarcar pasillo con líneas amarillas de 10 cm y prohibir acopio temporal en rutas de escape.",
    plazo_dias: 1,
  },
  {
    id: "epp-calzado-ley16744",
    titulo: "Personal Operativo sin EPP Reglamentario",
    categoria: "Ley 16.744 / EPP Certificado",
    tipo: "ACTO",
    clasificacion_peligro: "SEGURIDAD",
    norma_infringida: "Ley 16.744 Art. 68 / DS 594 Art. 53",
    descripcion: "Operario circulando en zona de maestranza sin calzado de seguridad con puntera de acero ni chaleco reflectante de alta visibilidad.",
    probabilidad: 2,
    severidad: 2,
    jerarquia_control: "EPP",
    medida_sugerida: "Instruir reingreso obligatorio con EPP certificado completo, registrar advertencia en registro de ODI y verificar entrega formal de equipos.",
    plazo_dias: 1,
  },
];

// Opciones de Clasificación de Peligros Normativos Chilenos
const CLASIFICACIONES_PELIGRO = [
  { valor: "SEGURIDAD", etiqueta: "Seguridad / Mecánico", desc: "Caídas de altura (DS 76), atrapamientos, cortes, eléctrico, choques" },
  { valor: "FISICO", etiqueta: "Físico (MINSAL / PREXOR)", desc: "Ruido ocupacional, radiación UV solar (DS 594 Art. 109a), vibraciones, calor/frío" },
  { valor: "QUIMICO", etiqueta: "Químico (PLANESI)", desc: "Sílice libre cristalizada, solventes, vapores, polvos, sustancias peligrosas" },
  { valor: "ERGONOMICO", etiqueta: "Ergonómico (TMERT / Ley 20.001)", desc: "Manejo manual de carga, movimientos repetitivos, posturas forzadas" },
  { valor: "BIOLOGICO", etiqueta: "Biológico", desc: "Virus, bacterias, hantavirus, hongos, vectores sanitarios" },
  { valor: "PSICOSOCIAL", etiqueta: "Psicosocial (SUSESO / ISTAS 21)", desc: "Carga mental, doble presencia, hostigamiento, turnos extenuantes" },
];

// Opciones de la Jerarquía de Control Legal (ISO 45001 / DS 76)
const JERARQUIA_CONTROLES = [
  { nivel: 1, valor: "ELIMINACION", etiqueta: "1. Eliminación del Peligro", color: "border-red-500 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20" },
  { nivel: 2, valor: "SUSTITUCION", etiqueta: "2. Sustitución", color: "border-orange-500 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20" },
  { nivel: 3, valor: "INGENIERIA", etiqueta: "3. Control de Ingeniería", color: "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20" },
  { nivel: 4, valor: "ADMINISTRATIVO", etiqueta: "4. Control Administrativo / Señalética", color: "border-sky-500 text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20" },
  { nivel: 5, valor: "EPP", etiqueta: "5. Elementos de Protección Personal (EPP)", color: "border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" },
];

// Helper para calcular la matriz Probabilidad x Consecuencia
function calcularMatrizRiesgo(p: number, s: number) {
  const score = p * s;
  if (score <= 2) {
    return {
      score,
      nivel: "BAJO" as const,
      etiqueta: "Bajo (Riesgo Leve / Aceptable)",
      colorBg: "bg-emerald-500",
      colorText: "text-emerald-700 dark:text-emerald-400",
      colorBorder: "border-emerald-400 dark:border-emerald-700",
      colorBadge: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
      accion: "Mantener medidas preventivas operacionales existentes.",
    };
  } else if (score <= 4) {
    return {
      score,
      nivel: "MEDIO" as const,
      etiqueta: "Medio (Riesgo Moderado)",
      colorBg: "bg-amber-500",
      colorText: "text-amber-700 dark:text-amber-400",
      colorBorder: "border-amber-400 dark:border-amber-700",
      colorBadge: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800",
      accion: "Implementar medidas correctivas y verificar plazos de mitigación.",
    };
  } else if (score === 6) {
    return {
      score,
      nivel: "ALTO" as const,
      etiqueta: "Alto (Riesgo Importante)",
      colorBg: "bg-orange-600",
      colorText: "text-orange-700 dark:text-orange-400",
      colorBorder: "border-orange-400 dark:border-orange-700",
      colorBadge: "bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800",
      accion: "Atención prioritaria obligatoria. Asignar responsables directos.",
    };
  } else {
    return {
      score,
      nivel: "CRITICO" as const,
      etiqueta: "Crítico (Intolerable / Detención)",
      colorBg: "bg-red-600",
      colorText: "text-red-700 dark:text-red-400",
      colorBorder: "border-red-400 dark:border-red-700",
      colorBadge: "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse font-bold",
      accion: "Intervención inmediata. Prohibido ejecutar la tarea sin control de ingeniería.",
    };
  }
}

// Helper para calcular estado del plazo legal (Art. 66 Ley 16.744)
function getEstadoPlazoLegal(fechaLimiteStr: string | null, estado: string) {
  if (estado === "RESUELTO") {
    return {
      estado: "RESUELTO",
      etiqueta: "Subsanado / Cerrado",
      badgeClase: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    };
  }
  if (!fechaLimiteStr) {
    return {
      estado: "SIN_PLAZO",
      etiqueta: "Sin plazo fijado",
      badgeClase: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaLimiteStr + "T00:00:00");
  const diffTime = limite.getTime() - hoy.getTime();
  const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    const diasVencido = Math.abs(diffDias);
    return {
      estado: "VENCIDO",
      dias: diasVencido,
      etiqueta: `⚠️ PLAZO VENCIDO (hace ${diasVencido} ${diasVencido === 1 ? "día" : "días"})`,
      badgeClase: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 font-bold animate-pulse",
    };
  } else if (diffDias === 0) {
    return {
      estado: "VENCE_HOY",
      dias: 0,
      etiqueta: "⚠️ VENCE HOY (Urgente)",
      badgeClase: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800 font-bold",
    };
  } else if (diffDias <= 5) {
    return {
      estado: "POR_VENCER",
      dias: diffDias,
      etiqueta: `⏳ Vence en ${diffDias} ${diffDias === 1 ? "día" : "días"}`,
      badgeClase: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-semibold",
    };
  } else {
    return {
      estado: "EN_PLAZO",
      dias: diffDias,
      etiqueta: `🟢 En plazo (${diffDias} días)`,
      badgeClase: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    };
  }
}

// Función para comprimir imagen fotográfica en el cliente (canvas 1200px max)
const comprimirFotoEvidencia = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function InspeccionesHallazgosPage() {
  const [reportes, setReportes] = useState<ReporteRiesgo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPlantillasModalOpen, setIsPlantillasModalOpen] = useState(false);
  const [isReporteVisitaModalOpen, setIsReporteVisitaModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedReporte, setSelectedReporte] = useState<ReporteRiesgo | null>(null);
  const [previewFotoUrl, setPreviewFotoUrl] = useState<string | null>(null);

  // Formulario de creación
  const [formCrear, setFormCrear] = useState({
    empresa_faena: "",
    area_puesto: "",
    lugar: "",
    tipo: "CONDICION" as "ACTO" | "CONDICION",
    clasificacion_peligro: "SEGURIDAD" as "FISICO" | "QUIMICO" | "BIOLOGICO" | "ERGONOMICO" | "PSICOSOCIAL" | "SEGURIDAD",
    norma_infringida: "",
    descripcion: "",
    probabilidad: 2,
    severidad: 2,
    jerarquia_control: "ADMINISTRATIVO" as "ELIMINACION" | "SUSTITUCION" | "INGENIERIA" | "ADMINISTRATIVO" | "EPP",
    medida_correctiva: "",
    responsable: "",
    fecha_limite: "",
    foto_evidencia: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Formulario de resolución
  const [medidaCorrectivaResolucion, setMedidaCorrectivaResolucion] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Formulario de Informe Técnico de Visita
  const [datosInforme, setDatosInforme] = useState({
    empresa_cliente: "Empresa Mandante / Faena Principal",
    faena_lugar: "Instalación Central / Faena",
    nombre_experto: "Prevencionista de Riesgos",
    registro_experto: "SNS / SEREMI Reg. N° RM/I-",
    administrador_faena: "Administrador de Faena / Empleador",
    fecha_visita: new Date().toISOString().split("T")[0],
    observaciones_generales: "Se realiza recorrido de inspección técnica en terreno para dar cumplimiento a las obligaciones legales de la Ley 16.744, DS 594 y DS 76. A continuación, se detallan los hallazgos levantados y las prescripciones técnicas obligatorias.",
  });

  // Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroPeligro, setFiltroPeligro] = useState<string>("TODOS");
  const [filtroGravedad, setFiltroGravedad] = useState<string>("TODOS");
  const [filtroPlazo, setFiltroPlazo] = useState<string>("TODOS");

  const fetchReportes = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(getApiUrl("/api/reportes-riesgo/"), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error("Error al obtener las inspecciones y hallazgos.");
      const data: ReporteRiesgo[] = await res.json();
      setReportes(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar la bitácora de terreno.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportes();
  }, []);

  // Calcular valores en vivo de la matriz en el formulario
  const matrizCalculadaForm = useMemo(() => {
    return calcularMatrizRiesgo(formCrear.probabilidad, formCrear.severidad);
  }, [formCrear.probabilidad, formCrear.severidad]);

  // Aplicar una plantilla precargada
  const handleAplicarPlantilla = (plantilla: PlantillaHallazgo) => {
    const fechaLim = new Date();
    fechaLim.setDate(fechaLim.getDate() + plantilla.plazo_dias);
    const fechaLimStr = fechaLim.toISOString().split("T")[0];

    setFormCrear((prev) => ({
      ...prev,
      tipo: plantilla.tipo,
      clasificacion_peligro: plantilla.clasificacion_peligro,
      norma_infringida: plantilla.norma_infringida,
      descripcion: plantilla.descripcion,
      probabilidad: plantilla.probabilidad,
      severidad: plantilla.severidad,
      jerarquia_control: plantilla.jerarquia_control,
      medida_correctiva: plantilla.medida_sugerida,
      fecha_limite: fechaLimStr,
    }));
    setIsPlantillasModalOpen(false);
    setIsCreateModalOpen(true);
  };

  // Carga de fotografía con compresión
  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const comprimida = await comprimirFotoEvidencia(file);
      setFormCrear((prev) => ({ ...prev, foto_evidencia: comprimida }));
    } catch {
      alert("No se pudo procesar la imagen fotográfica.");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const token = localStorage.getItem("access_token");

    const payload = {
      ...formCrear,
      nivel_riesgo_calculado: matrizCalculadaForm.nivel,
      gravedad: matrizCalculadaForm.nivel,
      fecha_limite: formCrear.fecha_limite || null,
      lugar: formCrear.lugar || formCrear.area_puesto || "Terreno General",
    };

    try {
      const res = await fetch(getApiUrl("/api/reportes-riesgo/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const dataErr = await res.json().catch(() => ({}));
        throw new Error(dataErr.error || "No se pudo registrar el hallazgo técnico. Verifica los campos requeridos.");
      }

      setIsCreateModalOpen(false);
      // Reset form
      setFormCrear({
        empresa_faena: "",
        area_puesto: "",
        lugar: "",
        tipo: "CONDICION",
        clasificacion_peligro: "SEGURIDAD",
        norma_infringida: "",
        descripcion: "",
        probabilidad: 2,
        severidad: 2,
        jerarquia_control: "ADMINISTRATIVO",
        medida_correctiva: "",
        responsable: "",
        fecha_limite: "",
        foto_evidencia: "",
      });
      fetchReportes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar el hallazgo.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReporte) return;
    setResolving(true);
    setResolveError(null);
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(getApiUrl(`/api/reportes-riesgo/${selectedReporte.id}/`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          estado: "RESUELTO",
          medida_correctiva: medidaCorrectivaResolucion,
          fecha_resolucion: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error("No se pudo registrar el cierre del hallazgo.");

      setIsResolveModalOpen(false);
      setMedidaCorrectivaResolucion("");
      setSelectedReporte(null);
      fetchReportes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cerrar el hallazgo.";
      setResolveError(msg);
    } finally {
      setResolving(false);
    }
  };

  // Filtrado de reportes en memoria
  const reportesFiltrados = useMemo(() => {
    return reportes.filter((r) => {
      // Búsqueda textual
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const coincideDesc = r.descripcion.toLowerCase().includes(query);
        const coincideLugar = (r.lugar || "").toLowerCase().includes(query);
        const coincideFaena = (r.empresa_faena || "").toLowerCase().includes(query);
        const coincideArea = (r.area_puesto || "").toLowerCase().includes(query);
        const coincideNorma = (r.norma_infringida || "").toLowerCase().includes(query);
        const coincideResp = (r.responsable || "").toLowerCase().includes(query);
        if (!coincideDesc && !coincideLugar && !coincideFaena && !coincideArea && !coincideNorma && !coincideResp) {
          return false;
        }
      }

      // Filtro tipo
      if (filtroTipo !== "TODOS" && r.tipo !== filtroTipo) return false;

      // Filtro peligro normativo
      if (filtroPeligro !== "TODOS" && r.clasificacion_peligro !== filtroPeligro) return false;

      // Filtro gravedad / criticidad
      if (filtroGravedad !== "TODOS") {
        if (filtroGravedad === "CRITICO" && r.gravedad !== "CRITICO" && r.nivel_riesgo_calculado !== "CRITICO") return false;
        if (filtroGravedad === "ALTO" && r.gravedad !== "ALTO" && r.nivel_riesgo_calculado !== "ALTO") return false;
        if (filtroGravedad === "MEDIO" && r.gravedad !== "MEDIO" && r.nivel_riesgo_calculado !== "MEDIO") return false;
        if (filtroGravedad === "BAJO" && r.gravedad !== "BAJO" && r.nivel_riesgo_calculado !== "BAJO") return false;
      }

      // Filtro plazo
      if (filtroPlazo !== "TODOS") {
        const plazo = getEstadoPlazoLegal(r.fecha_limite, r.estado);
        if (filtroPlazo === "VENCIDO" && plazo.estado !== "VENCIDO") return false;
        if (filtroPlazo === "POR_VENCER" && plazo.estado !== "POR_VENCER" && plazo.estado !== "VENCE_HOY") return false;
        if (filtroPlazo === "EN_PLAZO" && plazo.estado !== "EN_PLAZO") return false;
        if (filtroPlazo === "RESUELTO" && r.estado !== "RESUELTO") return false;
      }

      return true;
    });
  }, [reportes, busqueda, filtroTipo, filtroPeligro, filtroGravedad, filtroPlazo]);

  // Métricas avanzadas
  const metricas = useMemo(() => {
    const total = reportes.length;
    const abiertos = reportes.filter((r) => r.estado !== "RESUELTO").length;
    const resueltos = reportes.filter((r) => r.estado === "RESUELTO").length;
    const criticosOAltos = reportes.filter(
      (r) => (r.gravedad === "CRITICO" || r.gravedad === "ALTO" || r.nivel_riesgo_calculado === "CRITICO" || r.nivel_riesgo_calculado === "ALTO") && r.estado !== "RESUELTO"
    ).length;

    const vencidos = reportes.filter((r) => {
      if (r.estado === "RESUELTO") return false;
      return getEstadoPlazoLegal(r.fecha_limite, r.estado).estado === "VENCIDO";
    }).length;

    return { total, abiertos, resueltos, criticosOAltos, vencidos };
  }, [reportes]);

  // Exportar a formato CSV para Excel
  const exportarCSV = () => {
    if (reportesFiltrados.length === 0) return;
    const encabezados = [
      "ID",
      "Fecha",
      "Tipo Hallazgo",
      "Empresa/Faena",
      "Área/Puesto",
      "Ubicación",
      "Peligro Normativo (DS 594)",
      "Norma Legal Infringida",
      "Descripción",
      "Probabilidad",
      "Severidad",
      "Nivel Riesgo",
      "Jerarquía de Control",
      "Medida Correctiva",
      "Responsable",
      "Plazo Subsanación",
      "Estado",
    ];

    const filas = reportesFiltrados.map((r) => [
      r.id,
      new Date(r.fecha_creacion).toLocaleDateString(),
      r.tipo === "CONDICION" ? "Condición Insegura" : "Acto Inseguro",
      `"${(r.empresa_faena || "").replace(/"/g, '""')}"`,
      `"${(r.area_puesto || "").replace(/"/g, '""')}"`,
      `"${(r.lugar || "").replace(/"/g, '""')}"`,
      r.clasificacion_peligro || "SEGURIDAD",
      `"${(r.norma_infringida || "").replace(/"/g, '""')}"`,
      `"${r.descripcion.replace(/"/g, '""')}"`,
      r.probabilidad || 2,
      r.severidad || 2,
      r.nivel_riesgo_calculado || r.gravedad,
      r.jerarquia_control || "ADMINISTRATIVO",
      `"${(r.medida_correctiva || "").replace(/"/g, '""')}"`,
      `"${(r.responsable || "").replace(/"/g, '""')}"`,
      r.fecha_limite || "Sin plazo",
      r.estado,
    ]);

    const csvContent = "\uFEFF" + [encabezados.join(";"), ...filas.map((e) => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Inspecciones_Hallazgos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO TÉCNICO EJECUTIVO */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl shadow-xl border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <span className="bg-orange-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              SST Normativa Chile (DS 594 - Ley 16.744)
            </span>
            <span className="bg-slate-800 text-slate-300 text-xs font-semibold px-3 py-1 rounded-full border border-slate-700">
              Inspecciones en Terreno
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-3 leading-tight tracking-tight">
            Inspecciones y Hallazgos en Terreno
          </h1>
          <p className="text-slate-400 mt-2 text-xs md:text-sm max-w-2xl leading-relaxed">
            Levantamiento de no conformidades, condiciones y actos subestándar. Evalúa criticidad con la matriz cuantitativa PxS, prescribe jerarquía de control legal y emite el Informe Técnico de Visita en un clic.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap gap-2.5 w-full lg:w-auto">
          <button
            onClick={() => setIsPlantillasModalOpen(true)}
            className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs border border-slate-700 shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center space-x-2 cursor-pointer"
            title="Cargar plantillas predefinidas de DS 594, DS 76 y MINSAL"
          >
            <span>📋</span>
            <span>Plantillas DS 594</span>
          </button>

          <button
            onClick={() => setIsReporteVisitaModalOpen(true)}
            className="flex-1 sm:flex-none bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] flex items-center justify-center space-x-2 cursor-pointer"
            title="Generar e imprimir Informe Técnico de Visita con firma formal"
          >
            <span>📄</span>
            <span>Informe Técnico PDF</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>➕</span>
            <span>Levantar Hallazgo</span>
          </button>
        </div>
      </div>

      {/* 2. PANEL DE MÉTRICAS Y SEMÁFORO LEGAL */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Total Hallazgos</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metricas.total}</p>
          <span className="text-[10px] text-slate-400">Levantados en faena</span>
        </div>

        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Pendientes de Acción</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{metricas.abiertos}</p>
          <span className="text-[10px] text-slate-400">Requieren medidas</span>
        </div>

        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Críticos & Altos</p>
          <p className="text-2xl font-black text-orange-600 mt-1">{metricas.criticosOAltos}</p>
          <span className="text-[10px] text-slate-400">Atención inmediata</span>
        </div>

        <div
          onClick={() => setFiltroPlazo("VENCIDO")}
          className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${
            metricas.vencidos > 0
              ? "bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-900 hover:border-red-500"
              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          }`}
        >
          <p className="text-red-700 dark:text-red-400 text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center space-x-1">
            <span>⚠️ Plazos Vencidos</span>
          </p>
          <p className="text-2xl font-black text-red-600 mt-1">{metricas.vencidos}</p>
          <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
            {metricas.vencidos > 0 ? "¡Riesgo Legal / Multas DT!" : "Sin atrasos en faena"}
          </span>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Subsanados</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{metricas.resueltos}</p>
          <span className="text-[10px] text-slate-400">Condición corregida</span>
        </div>
      </div>

      {/* 3. BARRA DE BÚSQUEDA Y FILTROS TÉCNICOS */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Buscador */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por faena, área, norma (ej. DS 594 Art. 38), responsable o descripción..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={exportarCSV}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2 px-3 rounded-xl text-xs border border-slate-300 dark:border-slate-800 transition-all flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>📥</span>
            <span>Exportar CSV</span>
          </button>
        </div>

        {/* Filtros selectores */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 dark:border-slate-900">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Clasificación</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="CONDICION">🛠️ Condición Insegura</option>
              <option value="ACTO">👤 Acto Inseguro</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Peligro Normativo</label>
            <select
              value={filtroPeligro}
              onChange={(e) => setFiltroPeligro(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todos los peligros</option>
              <option value="SEGURIDAD">Seguridad / Mecánico</option>
              <option value="FISICO">Físico (PREXOR/UV)</option>
              <option value="QUIMICO">Químico (PLANESI)</option>
              <option value="ERGONOMICO">Ergonómico (TMERT)</option>
              <option value="BIOLOGICO">Biológico</option>
              <option value="PSICOSOCIAL">Psicosocial (ISTAS 21)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nivel de Riesgo (PxS)</label>
            <select
              value={filtroGravedad}
              onChange={(e) => setFiltroGravedad(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todas las criticidades</option>
              <option value="CRITICO">🔴 Crítico (Intolerable)</option>
              <option value="ALTO">🟠 Alto (Importante)</option>
              <option value="MEDIO">🟡 Medio (Moderado)</option>
              <option value="BAJO">🟢 Bajo (Leve)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Semáforo de Plazo</label>
            <select
              value={filtroPlazo}
              onChange={(e) => setFiltroPlazo(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="VENCIDO">⚠️ Solo Vencidos</option>
              <option value="POR_VENCER">⏳ Por Vencer (≤ 5 días)</option>
              <option value="EN_PLAZO">🟢 En Plazo</option>
              <option value="RESUELTO">✅ Subsanados</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. LISTADO DE HALLAZGOS Y NO CONFORMIDADES */}
      {loading ? (
        <div className="flex justify-center items-center py-20 flex-col space-y-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-semibold">Cargando inspecciones y hallazgos...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-center">
          <p className="font-bold">Error al cargar la bitácora técnica</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchReportes}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all"
          >
            Reintentar
          </button>
        </div>
      ) : reportesFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
          <span className="text-5xl mb-3">🛡️</span>
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            Sin Hallazgos para los Filtros Seleccionados
          </h3>
          <p className="text-slate-500 text-xs md:text-sm mt-1 max-w-md">
            No se encontraron condiciones o actos subestándar con los criterios actuales. Puedes limpiar los filtros o registrar una nueva no conformidad.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setBusqueda("");
                setFiltroTipo("TODOS");
                setFiltroPeligro("TODOS");
                setFiltroGravedad("TODOS");
                setFiltroPlazo("TODOS");
              }}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2 px-4 rounded-xl text-xs"
            >
              Restablecer Filtros
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-5 rounded-xl text-xs shadow"
            >
              ➕ Levantar Hallazgo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold px-1">
            <span>Mostrando {reportesFiltrados.length} hallazgo(s) técnico(s)</span>
            <span>Estándar Mutualidad & DT</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {reportesFiltrados.map((reporte) => {
              const semaforoPlazo = getEstadoPlazoLegal(reporte.fecha_limite, reporte.estado);
              const criticidad = calcularMatrizRiesgo(reporte.probabilidad || 2, reporte.severidad || 2);
              const jerarquiaObj = JERARQUIA_CONTROLES.find((j) => j.valor === reporte.jerarquia_control);

              return (
                <div
                  key={reporte.id}
                  className={`bg-white dark:bg-slate-950 p-5 md:p-6 rounded-2xl border transition-all shadow-sm hover:shadow-md ${
                    reporte.estado === "RESUELTO"
                      ? "border-slate-200 dark:border-slate-850 opacity-90"
                      : semaforoPlazo.estado === "VENCIDO"
                      ? "border-red-300 dark:border-red-900/60 bg-red-50/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                    {/* Contenido principal */}
                    <div className="space-y-3 flex-1">
                      {/* Fila de Insignias / Badges Legales */}
                      <div className="flex items-center flex-wrap gap-2 text-xs">
                        {/* Clasificación */}
                        <span
                          className={`font-bold px-2.5 py-0.5 rounded-full ${
                            reporte.tipo === "CONDICION"
                              ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                              : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                          }`}
                        >
                          {reporte.tipo === "CONDICION" ? "🛠️ Condición Subestándar" : "👤 Acto Subestándar"}
                        </span>

                        {/* Peligro Normativo */}
                        <span className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800 font-semibold px-2.5 py-0.5 rounded-full">
                          {reporte.clasificacion_peligro || "SEGURIDAD"}
                        </span>

                        {/* Norma Infringida */}
                        {reporte.norma_infringida && (
                          <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold px-2.5 py-0.5 rounded-full">
                            📜 {reporte.norma_infringida}
                          </span>
                        )}

                        {/* Criticidad P x S */}
                        <span className={`font-bold px-2.5 py-0.5 rounded-full border ${criticidad.colorBadge}`}>
                          Criticidad: {criticidad.etiqueta.split(" ")[0]} (PxS: {criticidad.score})
                        </span>

                        {/* Semáforo Plazo */}
                        <span className={`px-2.5 py-0.5 rounded-full border text-[11px] ${semaforoPlazo.badgeClase}`}>
                          {semaforoPlazo.etiqueta}
                        </span>
                      </div>

                      {/* Ubicación y Faena */}
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          📍 {reporte.empresa_faena ? `${reporte.empresa_faena} — ` : ""}
                          {reporte.area_puesto ? `${reporte.area_puesto} ` : ""}
                          <span className="font-normal text-slate-600 dark:text-slate-400">
                            ({reporte.lugar})
                          </span>
                        </p>
                      </div>

                      {/* Descripción del Hallazgo */}
                      <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-line leading-relaxed">
                        {reporte.descripcion}
                      </p>

                      {/* Evidencia Fotográfica y Medida */}
                      <div className="flex flex-col sm:flex-row gap-4 pt-1">
                        {reporte.foto_evidencia && (
                          <div className="shrink-0">
                            <img
                              src={reporte.foto_evidencia}
                              alt="Evidencia fotográfica en terreno"
                              onClick={() => setPreviewFotoUrl(reporte.foto_evidencia)}
                              className="h-24 w-24 object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                              title="Clic para ver foto en tamaño completo"
                            />
                            <span className="text-[10px] text-slate-400 block text-center mt-1 cursor-pointer">
                              🔍 Ampliar foto
                            </span>
                          </div>
                        )}

                        {/* Medida y Jerarquía de Control */}
                        <div className="flex-1 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              📋 Medida Correctiva Prescrita:
                            </span>
                            {jerarquiaObj && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${jerarquiaObj.color}`}>
                                {jerarquiaObj.etiqueta}
                              </span>
                            )}
                          </div>

                          <p className="text-slate-600 dark:text-slate-400 italic">
                            {reporte.medida_correctiva || "Sin prescripción técnica detallada."}
                          </p>

                          {/* Responsable y Plazo Art. 66 */}
                          <div className="flex items-center space-x-4 pt-1 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
                            <span>
                              👤 <strong>Responsable:</strong> {reporte.responsable || "Supervisor de Faena"}
                            </span>
                            <span>
                              📅 <strong>Plazo:</strong> {reporte.fecha_limite || "Inmediato"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Medida Correctiva Aplicada si está resuelto */}
                      {reporte.estado === "RESUELTO" && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs">
                          <span className="font-bold text-emerald-800 dark:text-emerald-400 block">
                            ✅ Subsanación y Cierre Verificado:
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                            {reporte.medida_correctiva}
                          </p>
                          {reporte.fecha_resolucion && (
                            <span className="text-[10px] text-slate-400 block mt-1">
                              Fecha de Cierre: {new Date(reporte.fecha_resolucion).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Notificación QR Trabajador si aplica */}
                      {reporte.reportado_por_externo && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/30 text-[11px] text-amber-800 dark:text-amber-400">
                          🏗️ <strong>Reporte Participativo QR Trabajador:</strong> {reporte.nombre_reportante || "Anónimo"}{" "}
                          {reporte.rut_reportante ? `(${reporte.rut_reportante})` : ""}
                        </div>
                      )}

                      {/* Metadatos inferiores */}
                      <div className="text-[10px] text-slate-400 flex items-center space-x-3 pt-1">
                        <span>Registrado por: {reporte.username || "Prevencionista"}</span>
                        <span>•</span>
                        <span>Fecha: {new Date(reporte.fecha_creacion).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Botón de Acción Lateral */}
                    <div className="self-end lg:self-center shrink-0">
                      {reporte.estado !== "RESUELTO" ? (
                        <button
                          onClick={() => {
                            setSelectedReporte(reporte);
                            setMedidaCorrectivaResolucion(reporte.medida_correctiva || "");
                            setIsResolveModalOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow transition-all hover:scale-[1.02] cursor-pointer flex items-center space-x-1.5"
                        >
                          <span>✓</span>
                          <span>Cerrar Hallazgo</span>
                        </button>
                      ) : (
                        <span className="bg-slate-100 dark:bg-slate-900 text-slate-400 font-semibold py-2 px-3 rounded-xl text-xs border border-slate-200 dark:border-slate-800">
                          Resuelto ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. MODAL: LEVANTAR HALLAZGO EN TERRENO */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-2xl my-8 relative">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
                  Inspección Operativa DS 594 / DS 76
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Levantar Hallazgo en Terreno
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-4 text-xs font-semibold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Sección 1: Ubicación y Faena */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Empresa / Faena / Centro de Trabajo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCrear.empresa_faena}
                    onChange={(e) => setFormCrear({ ...formCrear, empresa_faena: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                    placeholder="ej. Constructora Andina - Obra Torre 2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Área o Puesto de Trabajo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCrear.area_puesto}
                    onChange={(e) => setFormCrear({ ...formCrear, area_puesto: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                    placeholder="ej. Bodega de Químicos / Andamio Fachada Norte"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Ubicación Física Específica
                </label>
                <input
                  type="text"
                  required
                  value={formCrear.lugar}
                  onChange={(e) => setFormCrear({ ...formCrear, lugar: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                  placeholder="ej. Nivel 4, Eje B-12 / Frente a Tablero Eléctrico N° 3"
                />
              </div>

              {/* Sección 2: Clasificación y Peligro Normativo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Clasificación del Hallazgo *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormCrear({ ...formCrear, tipo: "CONDICION" })}
                      className={`py-2 rounded-xl font-bold text-xs border text-center transition-all ${
                        formCrear.tipo === "CONDICION"
                          ? "bg-orange-600 border-transparent text-white shadow"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      🛠️ Condición Insegura
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormCrear({ ...formCrear, tipo: "ACTO" })}
                      className={`py-2 rounded-xl font-bold text-xs border text-center transition-all ${
                        formCrear.tipo === "ACTO"
                          ? "bg-orange-600 border-transparent text-white shadow"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      👤 Acto Inseguro
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Tipificación del Peligro (MINSAL / DS 594) *
                  </label>
                  <select
                    value={formCrear.clasificacion_peligro}
                    onChange={(e) =>
                      setFormCrear({
                        ...formCrear,
                        clasificacion_peligro: e.target.value as "FISICO" | "QUIMICO" | "BIOLOGICO" | "ERGONOMICO" | "PSICOSOCIAL" | "SEGURIDAD",
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white font-semibold"
                  >
                    {CLASIFICACIONES_PELIGRO.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Norma Legal Infringida */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Norma Legal Infringida (DS 594, DS 76, Ley 16.744, NCh)
                </label>
                <input
                  type="text"
                  value={formCrear.norma_infringida}
                  onChange={(e) => setFormCrear({ ...formCrear, norma_infringida: e.target.value })}
                  placeholder="ej. DS 594 Art. 38 (Eléctrico) / DS 76 Art. 14 / NCh 1430"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Descripción Detallada del Hallazgo *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formCrear.descripcion}
                  onChange={(e) => setFormCrear({ ...formCrear, descripcion: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white resize-none leading-relaxed"
                  placeholder="Detalla la condición detectada, factores de riesgo y posibles consecuencias de accidente o enfermedad laboral..."
                />
              </div>

              {/* Evidencia Fotográfica */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Evidencia Fotográfica en Terreno
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFotoUpload}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 dark:file:bg-orange-950 dark:file:text-orange-300 cursor-pointer"
                  />
                  {formCrear.foto_evidencia && (
                    <div className="relative">
                      <img
                        src={formCrear.foto_evidencia}
                        alt="Preview"
                        className="h-10 w-10 object-cover rounded-lg border border-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => setFormCrear({ ...formCrear, foto_evidencia: "" })}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center cursor-pointer"
                        title="Quitar foto"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección 3: Matriz Cuantitativa P x S */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Matriz Cuantitativa de Riesgo (Probabilidad x Consecuencia)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Probabilidad (P)
                    </label>
                    <select
                      value={formCrear.probabilidad}
                      onChange={(e) => setFormCrear({ ...formCrear, probabilidad: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      <option value={1}>1: Baja (Suceso poco frecuente o remoto)</option>
                      <option value={2}>2: Media (Puede ocurrir ocasionalmente)</option>
                      <option value={3}>3: Alta (Ocurre frecuentemente / Inminente)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Severidad / Consecuencia (S)
                    </label>
                    <select
                      value={formCrear.severidad}
                      onChange={(e) => setFormCrear({ ...formCrear, severidad: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      <option value={1}>1: Leve (Primeros auxilios / Sin tiempo perdido)</option>
                      <option value={2}>2: Grave (Lesión con reposo / Incapacidad temporal)</option>
                      <option value={3}>3: Crítica / Fatal (Invalidez permanente o muerte)</option>
                    </select>
                  </div>
                </div>

                {/* Resultado en Vivo de la Matriz */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${matrizCalculadaForm.colorBadge}`}>
                  <div>
                    <span className="font-extrabold text-xs block">
                      Magnitud Evaluada: {matrizCalculadaForm.etiqueta} (PxS = {matrizCalculadaForm.score})
                    </span>
                    <span className="text-[11px] opacity-90">{matrizCalculadaForm.accion}</span>
                  </div>
                </div>
              </div>

              {/* Sección 4: Plan de Acción y Jerarquía de Control Legal */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Jerarquía de Control Legal Obligatoria (ISO 45001 / DS 76) *
                  </label>
                  <select
                    value={formCrear.jerarquia_control}
                    onChange={(e) =>
                      setFormCrear({
                        ...formCrear,
                        jerarquia_control: e.target.value as "ELIMINACION" | "SUSTITUCION" | "INGENIERIA" | "ADMINISTRATIVO" | "EPP",
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white font-bold"
                  >
                    {JERARQUIA_CONTROLES.map((j) => (
                      <option key={j.valor} value={j.valor}>
                        {j.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Medida Correctiva Propuesta (Prescripción Técnica) *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formCrear.medida_correctiva}
                    onChange={(e) => setFormCrear({ ...formCrear, medida_correctiva: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white resize-none"
                    placeholder="Instrucción técnica obligatoria para subsanar el hallazgo..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Responsable en Faena (Art. 66 Ley 16.744) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formCrear.responsable}
                      onChange={(e) => setFormCrear({ ...formCrear, responsable: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                      placeholder="ej. Juan Pérez (Supervisor de Terreno)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Plazo Límite de Subsanación *
                    </label>
                    <input
                      type="date"
                      required
                      value={formCrear.fecha_limite}
                      onChange={(e) => setFormCrear({ ...formCrear, fecha_limite: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs cursor-pointer shadow-lg transition-all"
                >
                  {creating ? "Registrando Hallazgo..." : "Guardar No Conformidad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: PLANTILLAS NORMATIVAS PRECARGADAS */}
      {isPlantillasModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-3xl w-full shadow-2xl my-8 relative">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
                  Ahorro de Tiempo en Faena
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Plantillas Normativas DS 594 & Construcción
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Selecciona una no conformidad frecuente para prellenar la norma, evaluación de riesgo y jerarquía de control con 1 clic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlantillasModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {PLANTILLAS_NORMATIVAS.map((plantilla) => {
                const matrizPlantilla = calcularMatrizRiesgo(plantilla.probabilidad, plantilla.severidad);
                return (
                  <div
                    key={plantilla.id}
                    onClick={() => handleAplicarPlantilla(plantilla)}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-orange-500 hover:bg-orange-50/10 transition-all cursor-pointer space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {plantilla.titulo}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${matrizPlantilla.colorBadge}`}>
                          {matrizPlantilla.nivel}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-1">
                        📜 {plantilla.norma_infringida}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1.5 line-clamp-2 leading-relaxed">
                        {plantilla.descripcion}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Plazo sugerido: {plantilla.plazo_dias} día(s)</span>
                      <span className="text-orange-600 font-bold">Usar Plantilla →</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPlantillasModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer"
              >
                Cerrar Catálogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: GENERADOR DE INFORME TÉCNICO DE VISITA (PDF IMPRIMIBLE) */}
      {isReporteVisitaModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-8 max-w-4xl w-full shadow-2xl my-4 sm:my-8 relative">
            {/* Cabecera modal no imprimible */}
            <div className="no-print flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
                  Estándar Mutualidades (ACHS / Mutual / IST) & Dirección del Trabajo
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Informe Técnico de Visita en Terreno
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-xl text-xs shadow flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Imprimir / Descargar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReporteVisitaModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Configuración rápida de metadatos del informe (no-print) */}
            <div className="no-print bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 space-y-3 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                ⚙️ Datos para el Membrete y Firmas del Informe Técnico:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Empresa Asesorada</label>
                  <input
                    type="text"
                    value={datosInforme.empresa_cliente}
                    onChange={(e) => setDatosInforme({ ...datosInforme, empresa_cliente: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Faena / Instalación</label>
                  <input
                    type="text"
                    value={datosInforme.faena_lugar}
                    onChange={(e) => setDatosInforme({ ...datosInforme, faena_lugar: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Fecha de Inspección</label>
                  <input
                    type="date"
                    value={datosInforme.fecha_visita}
                    onChange={(e) => setDatosInforme({ ...datosInforme, fecha_visita: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Experto en Prevención y Registro SNS</label>
                  <input
                    type="text"
                    value={datosInforme.nombre_experto}
                    onChange={(e) => setDatosInforme({ ...datosInforme, nombre_experto: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
                    placeholder="Nombre del Experto"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">N° Registro SNS / SEREMI</label>
                  <input
                    type="text"
                    value={datosInforme.registro_experto}
                    onChange={(e) => setDatosInforme({ ...datosInforme, registro_experto: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* DOCUMENTO FORMAL IMPRIMIBLE (ESTÁNDAR LEY 16.744) */}
            {/* ============================================================== */}
            <div id="informe-tecnico-imprimible" className="bg-white text-slate-900 p-6 md:p-8 rounded-xl border border-slate-300 text-xs font-sans space-y-6">
              {/* Membrete formal */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-black text-orange-600 tracking-wider">HD PREVENCIÓN</span>
                    <span className="text-slate-400 text-xs font-semibold">| SaaS de Gestión SST</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1 uppercase tracking-tight">
                    INFORME TÉCNICO DE VISITA EN TERRENO
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Levantamiento de No Conformidades y Prescripciones de Medidas Correctivas (Art. 66 Ley 16.744)
                  </p>
                </div>

                <div className="text-right text-[11px] text-slate-700 space-y-0.5">
                  <p><strong>Fecha Visita:</strong> {datosInforme.fecha_visita}</p>
                  <p><strong>N° Documento:</strong> IT-{new Date().getFullYear()}-{reportesFiltrados.length}</p>
                  <p><strong>Estado:</strong> Oficial</p>
                </div>
              </div>

              {/* Antecedentes de la Asesoría */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px]">
                <div>
                  <p><strong>Empresa Asesorada:</strong> {datosInforme.empresa_cliente}</p>
                  <p><strong>Faena / Instalación:</strong> {datosInforme.faena_lugar}</p>
                </div>
                <div>
                  <p><strong>Experto Asesor:</strong> {datosInforme.nombre_experto}</p>
                  <p><strong>Registro SNS / SEREMI:</strong> {datosInforme.registro_experto}</p>
                </div>
              </div>

              {/* Marco Legal */}
              <div className="text-[10px] text-slate-600 bg-slate-50/50 p-2.5 rounded border border-slate-200 italic leading-relaxed">
                <strong>Marco Regulatorio:</strong> En cumplimiento del Art. 66 de la Ley 16.744 y Circular 3333 de la SUSESO, el empleador está obligado a adoptar las medidas de higiene y seguridad prescritas por el Departamento de Prevención de Riesgos. El incumplimiento faculta el recargo de cotización adicional o sanciones de la Autoridad Sanitaria / Inspección del Trabajo.
              </div>

              {/* Resumen Estadístico de Hallazgos */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                  1. Resumen de Hallazgos Levantados
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                  <div className="p-2 border rounded bg-slate-50">
                    <span className="block font-bold text-slate-700">Total Hallazgos</span>
                    <span className="text-base font-extrabold">{reportesFiltrados.length}</span>
                  </div>
                  <div className="p-2 border rounded bg-red-50 text-red-800">
                    <span className="block font-bold">Críticos / Altos</span>
                    <span className="text-base font-extrabold">{metricas.criticosOAltos}</span>
                  </div>
                  <div className="p-2 border rounded bg-amber-50 text-amber-800">
                    <span className="block font-bold">Plazos Vencidos</span>
                    <span className="text-base font-extrabold">{metricas.vencidos}</span>
                  </div>
                  <div className="p-2 border rounded bg-emerald-50 text-emerald-800">
                    <span className="block font-bold">Subsanados</span>
                    <span className="text-base font-extrabold">{metricas.resueltos}</span>
                  </div>
                </div>
              </div>

              {/* Tabla Detallada de Prescripciones */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                  2. Matriz de Hallazgos y Prescripción de Medidas Correctivas
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold">
                        <th className="p-2 border border-slate-700">N°</th>
                        <th className="p-2 border border-slate-700">Ubicación / Puesto</th>
                        <th className="p-2 border border-slate-700">Clasificación & Peligro</th>
                        <th className="p-2 border border-slate-700">Norma Infringida</th>
                        <th className="p-2 border border-slate-700">Descripción del Hallazgo</th>
                        <th className="p-2 border border-slate-700">PxS</th>
                        <th className="p-2 border border-slate-700">Medida Prescrita & Jerarquía</th>
                        <th className="p-2 border border-slate-700">Responsable</th>
                        <th className="p-2 border border-slate-700">Plazo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportesFiltrados.map((rep, idx) => {
                        const crit = calcularMatrizRiesgo(rep.probabilidad || 2, rep.severidad || 2);
                        return (
                          <tr key={rep.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="p-1.5 border border-slate-300 font-bold text-center">{idx + 1}</td>
                            <td className="p-1.5 border border-slate-300 font-semibold">{rep.lugar}</td>
                            <td className="p-1.5 border border-slate-300">
                              <span className="font-bold block">{rep.tipo === "CONDICION" ? "Condición" : "Acto"}</span>
                              <span className="text-slate-500">{rep.clasificacion_peligro}</span>
                            </td>
                            <td className="p-1.5 border border-slate-300 font-semibold text-amber-800">
                              {rep.norma_infringida || "DS 594"}
                            </td>
                            <td className="p-1.5 border border-slate-300 max-w-xs">{rep.descripcion}</td>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">
                              {crit.nivel} ({crit.score})
                            </td>
                            <td className="p-1.5 border border-slate-300">
                              <span className="font-bold block text-slate-700">
                                [{rep.jerarquia_control || "ADMINISTRATIVO"}]
                              </span>
                              {rep.medida_correctiva || "Mitigar condición insegura."}
                            </td>
                            <td className="p-1.5 border border-slate-300">{rep.responsable || "Supervisor"}</td>
                            <td className="p-1.5 border border-slate-300 font-bold whitespace-nowrap">
                              {rep.fecha_limite || "Inmediato"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cuadro de Doble Firma Legal */}
              <div className="pt-10 border-t border-slate-300 mt-8">
                <div className="grid grid-cols-2 gap-12 text-center text-[11px]">
                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-2 w-48 mx-auto font-bold">
                      {datosInforme.nombre_experto}
                    </div>
                    <p className="text-slate-600">Experto en Prevención de Riesgos</p>
                    <p className="text-slate-500 text-[10px]">Reg. SNS: {datosInforme.registro_experto}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-2 w-48 mx-auto font-bold">
                      {datosInforme.administrador_faena}
                    </div>
                    <p className="text-slate-600">Recepción Administrador de Faena / Empresa</p>
                    <p className="text-slate-500 text-[10px]">Toma de Conocimiento (Art. 66 Ley 16.744)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie del modal no imprimible */}
            <div className="no-print flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setIsReporteVisitaModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer"
              >
                Cerrar Previsualización
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-6 rounded-xl text-xs cursor-pointer shadow-lg"
              >
                🖨️ Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: RESOLVER / CERRAR HALLAZGO */}
      {isResolveModalOpen && selectedReporte && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
              Cierre y Subsanación de Hallazgo
            </h2>
            <p className="text-slate-500 text-xs mb-4">
              Registra las acciones y medidas adoptadas para corregir la condición o acto subestándar en{" "}
              <strong>{selectedReporte.lugar}</strong> ({selectedReporte.empresa_faena || "Faena"}).
            </p>

            {resolveError && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-4 text-xs font-semibold">
                {resolveError}
              </div>
            )}

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Medida Correctiva Implementada Efectivamente *
                </label>
                <textarea
                  required
                  rows={4}
                  value={medidaCorrectivaResolucion}
                  onChange={(e) => setMedidaCorrectivaResolucion(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-orange-500 resize-none text-slate-900 dark:text-white"
                  placeholder="ej. Se retiró la herramienta con cable pelado de circulación, se instalaron barandas reglamentarias con rodapié y se verificó tarjeta verde de andamio operativo..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsResolveModalOpen(false);
                    setSelectedReporte(null);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer shadow-md"
                >
                  {resolving ? "Guardando..." : "Subsanar y Cerrar Hallazgo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: VISOR DE FOTO DE EVIDENCIA EN TAMAÑO COMPLETO */}
      {previewFotoUrl && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setPreviewFotoUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewFotoUrl}
              alt="Evidencia fotográfica completa"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-slate-700"
            />
            <button
              onClick={() => setPreviewFotoUrl(null)}
              className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
