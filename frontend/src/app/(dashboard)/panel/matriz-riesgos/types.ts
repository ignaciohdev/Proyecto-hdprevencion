export type ClasificacionRiesgo = "CRITICO" | "ALTO" | "MEDIO" | "BAJO";

export type TipoActividad = "RUTINARIA" | "NO_RUTINARIA" | "EMERGENCIA";

export type EstadoControl = "IMPLEMENTADO" | "EN_PROCESO" | "PENDIENTE";

export type EstadoMatriz = "BORRADOR" | "VIGENTE" | "EN_REVISION";

export type ClasificacionPeligro =
  | "FISICO"
  | "QUIMICO"
  | "BIOLOGICO"
  | "ERGONOMICO"
  | "PSICOSOCIAL"
  | "SEGURIDAD";

export interface ItemMatrizRiesgo {
  id: number;
  matriz: number;
  proceso: string;
  actividad: string;
  tipo_actividad: TipoActividad;
  tipo_actividad_display?: string;
  puesto_trabajo: string;
  peligro: string;
  clasificacion_peligro: ClasificacionPeligro;
  clasificacion_peligro_display?: string;
  riesgo_consecuencia: string;

  // Evaluación Riesgo Puro
  probabilidad_pura: number;
  severidad_pura: number;
  magnitud_pura: number;
  clasificacion_pura: ClasificacionRiesgo;

  // Jerarquía Legal de Controles del ISP
  control_eliminacion: string;
  control_sustitucion: string;
  control_ingenieria: string;
  control_administrativo: string;
  control_epp: string;

  // Evaluación Riesgo Residual
  probabilidad_residual: number;
  severidad_residual: number;
  magnitud_residual: number;
  clasificacion_residual: ClasificacionRiesgo;

  responsable: string;
  plazo_implementacion: string | null;
  estado_control: EstadoControl;
  estado_control_display?: string;
  orden: number;
}

export interface MatrizRiesgoMiper {
  id: number;
  empresa: number;
  empresa_nombre: string;
  empresa_rut: string;
  empresa_giro: string;
  centro_trabajo: number | null;
  centro_trabajo_nombre: string | null;
  prevencionista: number;
  prevencionista_nombre: string;
  nombre: string;
  proceso_area: string;
  version: number;
  estado: EstadoMatriz;
  estado_display: string;
  fecha_aprobacion: string | null;
  fecha_proxima_revision: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;

  total_peligros: number;
  criticos_puros: number;
  altos_puros: number;
  criticos_residuales: number;
  altos_residuales: number;
  medios_residuales: number;
  bajos_residuales: number;
  porcentaje_reduccion_riesgo: number;

  items?: ItemMatrizRiesgo[];
}

export interface CeldaCalor {
  probabilidad: number;
  severidad: number;
  magnitud: number;
  clasificacion: ClasificacionRiesgo;
  count_puro: number;
  count_residual: number;
}

export interface MatrizCalorData {
  matriz_id: number;
  matriz_nombre: string;
  total_peligros: number;
  porcentaje_reduccion_riesgo: number;
  totales: {
    puro: {
      critico: number;
      alto: number;
      medio: number;
      bajo: number;
    };
    residual: {
      critico: number;
      alto: number;
      medio: number;
      bajo: number;
    };
  };
  grid: CeldaCalor[];
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
  comuna?: string;
  empresa: number;
}

// Escalas oficiales ISP y D.S. N° 44
export const ESCALA_PROBABILIDAD: Record<number, { etiqueta: string; descripcion: string }> = {
  1: { etiqueta: "1 - Rara vez", descripcion: "Ocurre en circunstancias excepcionales (Improbable en el año)" },
  2: { etiqueta: "2 - Improbable", descripcion: "Poco común, no ha ocurrido recientemente pero podría suceder" },
  3: { etiqueta: "3 - Posible", descripcion: "Podría ocurrir en algún momento durante el ciclo operativo" },
  4: { etiqueta: "4 - Probable", descripcion: "Ocurre con regularidad en faena o faenas similares" },
  5: { etiqueta: "5 - Casi seguro", descripcion: "Se espera que ocurra en la mayoría de las circunstancias" },
};

export const ESCALA_SEVERIDAD: Record<number, { etiqueta: string; descripcion: string }> = {
  1: { etiqueta: "1 - Insignificante", descripcion: "Primeros auxilios menores en faena, sin tiempo perdido" },
  2: { etiqueta: "2 - Menor", descripcion: "Lesión leve con tiempo perdido ambulatorio (< 7 días)" },
  3: { etiqueta: "3 - Moderado", descripcion: "Incapacidad temporal relevante (> 7 días), daño material mediano" },
  4: { etiqueta: "4 - Mayor", descripcion: "Lesión grave (amputación, fractura grave), invalidez parcial" },
  5: { etiqueta: "5 - Catastrófico", descripcion: "Muerte individual o múltiple, incapacidad permanente total" },
};

export const CLASIFICACIONES_RIESGO: Record<
  ClasificacionRiesgo,
  {
    nombre: string;
    rango: string;
    colorBadge: string;
    colorSolid: string;
    colorBorde: string;
    colorTexto: string;
    accionRequerida: string;
  }
> = {
  CRITICO: {
    nombre: "Crítico / No Aceptable",
    rango: "17 - 25",
    colorBadge: "bg-red-500/10 text-red-400 border-red-500/30",
    colorSolid: "bg-red-600 text-white",
    colorBorde: "border-red-500",
    colorTexto: "text-red-400",
    accionRequerida: "Detener faena inmediatamente hasta implementar controles duros de eliminación o ingeniería.",
  },
  ALTO: {
    nombre: "Alto / Importante",
    rango: "10 - 16",
    colorBadge: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    colorSolid: "bg-orange-600 text-white",
    colorBorde: "border-orange-500",
    colorTexto: "text-orange-400",
    accionRequerida: "No iniciar sin controles de ingeniería y permisos especiales de trabajo seguro (PTS).",
  },
  MEDIO: {
    nombre: "Medio / Moderado",
    rango: "5 - 9",
    colorBadge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    colorSolid: "bg-amber-500 text-slate-950",
    colorBorde: "border-amber-500",
    colorTexto: "text-amber-400",
    accionRequerida: "Requiere procedimientos documentados, capacitación y uso mandatorio de EPP certificado.",
  },
  BAJO: {
    nombre: "Bajo / Aceptable",
    rango: "1 - 4",
    colorBadge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    colorSolid: "bg-emerald-600 text-white",
    colorBorde: "border-emerald-500",
    colorTexto: "text-emerald-400",
    accionRequerida: "Riesgo aceptable bajo supervisión habitual y cumplimiento de normas estándar.",
  },
};

export function getClasificacionColor(clasificacion: ClasificacionRiesgo | string): string {
  switch (clasificacion) {
    case "CRITICO":
      return "bg-red-500/10 text-red-400 border-red-500/30";
    case "ALTO":
      return "bg-orange-500/10 text-orange-400 border-orange-500/30";
    case "MEDIO":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "BAJO":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/30";
  }
}

export function getClasificacionSolidBg(clasificacion: ClasificacionRiesgo | string): string {
  switch (clasificacion) {
    case "CRITICO":
      return "bg-red-600 text-white";
    case "ALTO":
      return "bg-orange-600 text-white";
    case "MEDIO":
      return "bg-amber-500 text-slate-950 font-bold";
    case "BAJO":
      return "bg-emerald-600 text-white";
    default:
      return "bg-slate-700 text-slate-200";
  }
}
