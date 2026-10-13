export interface RequisitoLegalBase {
  id: number;
  organismo: string;
  organismo_display: string;
  tipo_norma: string;
  tipo_norma_display: string;
  identificacion_norma: string;
  articulo: string;
  titulo: string;
  descripcion_exigencia: string;
  sancion_multa: string;
  rubro_aplicable: string;
  rubro_display: string;
  condicion_activacion: string;
  orden: number;
  activo: boolean;
}

export interface ItemMatrizLegal {
  id: number;
  matriz: number;
  requisito_base: number | null;
  organismo: string;
  tipo_norma: string;
  identificacion_norma: string;
  articulo: string;
  titulo: string;
  descripcion_exigencia: string;
  sancion_multa: string;
  estado: "CUMPLE" | "EN_PROCESO" | "NO_CUMPLE" | "NO_APLICA";
  estado_display: string;
  evidencia_cumplimiento: string;
  responsable: string;
  fecha_compromiso: string | null;
  fecha_verificacion: string | null;
  observaciones: string;
  orden: number;
}

export interface MatrizLegal {
  id: number;
  empresa: number;
  empresa_nombre: string;
  empresa_rut: string;
  empresa_mutualidad: string;
  empresa_giro: string;
  centro_trabajo: number | null;
  centro_trabajo_nombre: string | null;
  prevencionista: number;
  prevencionista_nombre: string;
  rubro_principal: string;
  rubro_principal_display: string;
  condiciones_faena: Record<string, boolean>;
  observacion_general: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  total_requisitos: number;
  cumplidos: number;
  en_proceso: number;
  brechas_criticas: number;
  porcentaje_cumplimiento: number;
  estado_semaforo: "OPTIMO" | "REGULAR" | "CRITICO";
  items?: ItemMatrizLegal[];
}

export interface DesgloseOrganismo {
  organismo_nombre: string;
  total: number;
  cumplidos: number;
  en_proceso: number;
  brechas_criticas: number;
  porcentaje_cumplimiento: number;
}

export interface EstadisticasMatrizLegal {
  matriz_id: number;
  empresa_nombre: string;
  rubro: string;
  total_requisitos: number;
  cumplidos: number;
  en_proceso: number;
  brechas_criticas: number;
  porcentaje_cumplimiento: number;
  estado_semaforo: "OPTIMO" | "REGULAR" | "CRITICO";
  desglose_organismo: Record<string, DesgloseOrganismo>;
}

export interface EmpresaSimple {
  id: number;
  razon_social: string;
  rut: string;
  mutualidad?: string;
  giro?: string;
}

export interface CentroTrabajoSimple {
  id: number;
  nombre: string;
  direccion?: string;
}

export const RUBROS_CHOICES = [
  { id: "TRANSVERSAL", nombre: "Transversal (Estándar Multisectorial)" },
  { id: "CONSTRUCCION", nombre: "Construcción y Obras Civiles" },
  { id: "MINERIA", nombre: "Minería y Sondajes" },
  { id: "INDUSTRIA", nombre: "Industria Manufacturera y Metalmecánica" },
  { id: "AGRICOLA", nombre: "Agrícola y Forestal" },
  { id: "TRANSPORTE", nombre: "Transporte y Logística" },
  { id: "SALUD", nombre: "Salud y Clínicas" },
  { id: "COMERCIO", nombre: "Comercio y Retail" },
  { id: "QUIMICA", nombre: "Química y Bodegas de Sustancias Peligrosas" },
  { id: "ALIMENTOS", nombre: "Alimentos y Gastronomía" },
];

export const ORGANISMOS_CONFIG: Record<string, { label: string; badge: string }> = {
  DT: {
    label: "Dirección del Trabajo (DT)",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  },
  SEREMI: {
    label: "Seremi de Salud / MINSAL",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  SUSESO: {
    label: "SUSESO",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300 dark:border-purple-800",
  },
  SERNAGEOMIN: {
    label: "Sernageomin (Minería)",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border-orange-300 dark:border-orange-800",
  },
  SAG: {
    label: "SAG (Agrícola)",
    badge: "bg-lime-100 text-lime-800 dark:bg-lime-950/70 dark:text-lime-300 border-lime-300 dark:border-lime-800",
  },
  SEC: {
    label: "SEC (Electricidad)",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  },
  DIRECTEMAR: {
    label: "Directemar (Armada)",
    badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800",
  },
  SMA: {
    label: "Medio Ambiente (SMA)",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border-teal-300 dark:border-teal-800",
  },
};

export const ESTADO_CONFIG = {
  CUMPLE: {
    label: "Cumple Totalmente",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  EN_PROCESO: {
    label: "En Proceso",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  NO_CUMPLE: {
    label: "Brecha Crítica (No Cumple)",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800",
    dot: "bg-red-500",
  },
  NO_APLICA: {
    label: "No Aplica",
    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800",
    dot: "bg-slate-400",
  },
};
