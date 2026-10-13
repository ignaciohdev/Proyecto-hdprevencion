// Tipos y utilidades normativas SST (DS 594, DS 76, Ley 16.744, MINSAL)

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

export interface PlantillaHallazgo {
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

export interface FormCrearReporte {
  empresa_faena: string;
  area_puesto: string;
  lugar: string;
  tipo: "ACTO" | "CONDICION";
  clasificacion_peligro: "FISICO" | "QUIMICO" | "BIOLOGICO" | "ERGONOMICO" | "PSICOSOCIAL" | "SEGURIDAD";
  norma_infringida: string;
  descripcion: string;
  probabilidad: number;
  severidad: number;
  jerarquia_control: "ELIMINACION" | "SUSTITUCION" | "INGENIERIA" | "ADMINISTRATIVO" | "EPP";
  medida_correctiva: string;
  responsable: string;
  fecha_limite: string;
  foto_evidencia: string;
}

export interface DatosInformeVisita {
  empresa_cliente: string;
  faena_lugar: string;
  nombre_experto: string;
  registro_experto: string;
  administrador_faena: string;
  fecha_visita: string;
  observaciones_generales: string;
}

export interface MetricasReportes {
  total: number;
  abiertos: number;
  resueltos: number;
  criticosOAltos: number;
  vencidos: number;
  resueltosMes: number;
}

// Catálogo normativo chileno para levantamiento rápido en terreno (DS 594, DS 76, MINSAL)
export const PLANTILLAS_NORMATIVAS: PlantillaHallazgo[] = [
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
export const CLASIFICACIONES_PELIGRO = [
  { valor: "SEGURIDAD", etiqueta: "Seguridad / Mecánico", desc: "Caídas de altura (DS 76), atrapamientos, cortes, eléctrico, choques" },
  { valor: "FISICO", etiqueta: "Físico (MINSAL / PREXOR)", desc: "Ruido ocupacional, radiación UV solar (DS 594 Art. 109a), vibraciones, calor/frío" },
  { valor: "QUIMICO", etiqueta: "Químico (PLANESI)", desc: "Sílice libre cristalizada, solventes, vapores, polvos, sustancias peligrosas" },
  { valor: "ERGONOMICO", etiqueta: "Ergonómico (TMERT / Ley 20.001)", desc: "Manejo manual de carga, movimientos repetitivos, posturas forzadas" },
  { valor: "BIOLOGICO", etiqueta: "Biológico", desc: "Virus, bacterias, hantavirus, hongos, vectores sanitarios" },
  { valor: "PSICOSOCIAL", etiqueta: "Psicosocial (SUSESO / ISTAS 21)", desc: "Carga mental, doble presencia, hostigamiento, turnos extenuantes" },
];

// Opciones de la Jerarquía de Control Legal (ISO 45001 / DS 76)
export const JERARQUIA_CONTROLES = [
  { nivel: 1, valor: "ELIMINACION", etiqueta: "1. Eliminación del Peligro", color: "border-red-500 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20" },
  { nivel: 2, valor: "SUSTITUCION", etiqueta: "2. Sustitución", color: "border-orange-500 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20" },
  { nivel: 3, valor: "INGENIERIA", etiqueta: "3. Control de Ingeniería", color: "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20" },
  { nivel: 4, valor: "ADMINISTRATIVO", etiqueta: "4. Control Administrativo / Señalética", color: "border-sky-500 text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20" },
  { nivel: 5, valor: "EPP", etiqueta: "5. Elementos de Protección Personal (EPP)", color: "border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" },
];

// Helper para calcular la matriz Probabilidad x Consecuencia
export function calcularMatrizRiesgo(p: number, s: number) {
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
export function getEstadoPlazoLegal(fechaLimiteStr: string | null, estado: string) {
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
export const comprimirFotoEvidencia = (file: File): Promise<string> => {
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

// Exportar a formato CSV para Excel
export const exportarCSV = (reportesFiltrados: ReporteRiesgo[]) => {
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
