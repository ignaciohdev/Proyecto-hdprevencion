export interface EmpresaItem {
  id: number;
  razon_social: string;
  rut: string;
  centros_trabajo?: Array<{ id: number; nombre: string }>;
}

export interface CentroTrabajoItem {
  id: number;
  nombre: string;
  empresa: number;
}

export interface TrabajadorItem {
  id: number;
  nombres: string;
  apellidos: string;
  rut: string;
  cargo: string;
  empresa: number;
}

export interface MiembroCPHS {
  id: number;
  comite: number;
  trabajador?: number | null;
  nombre: string;
  rut: string;
  estamento: "EMPRESA" | "TRABAJADORES";
  estamento_display?: string;
  tipo_representacion: "TITULAR" | "SUPLENTE";
  tipo_representacion_display?: string;
  cargo: "PRESIDENTE" | "SECRETARIO" | "VOCAL";
  cargo_display?: string;
  activo: boolean;
  fecha_designacion?: string | null;
  fecha_creacion?: string;
}

export interface AcuerdoSesion {
  acuerdo: string;
  responsable: string;
  plazo: string;
  cumplido: boolean;
  fecha_cumplimiento?: string;
}

export interface ActaSesionCPHS {
  id: number;
  comite: number;
  comite_nombre?: string;
  numero_acta: number;
  tipo_sesion: "ORDINARIA" | "EXTRAORDINARIA";
  tipo_sesion_display?: string;
  fecha_hora_sesion: string;
  lugar: string;
  asistentes: string[];
  tabla_temas: string;
  acuerdos: AcuerdoSesion[];
  fecha_creacion?: string;
  total_acuerdos?: number;
  acuerdos_cumplidos?: number;
}

export interface ComiteParitario {
  id: number;
  empresa: number;
  empresa_nombre?: string;
  centro_trabajo?: number | null;
  centro_trabajo_nombre?: string | null;
  nombre: string;
  fecha_constitucion: string;
  fecha_vencimiento_mandato?: string | null;
  estado: "VIGENTE" | "POR_VENCER" | "VENCIDO" | "EN_ELECCION";
  estado_display?: string;
  dias_restantes_mandato: number;
  miembros?: MiembroCPHS[];
  total_miembros?: number;
  total_actas?: number;
  fecha_creacion?: string;
}

export interface EstadisticasCPHS {
  comite_id: number;
  comite_nombre: string;
  empresa_nombre: string;
  fecha_constitucion: string;
  fecha_vencimiento_mandato: string | null;
  dias_restantes_mandato: number;
  estado_mandato: string;
  estado_mandato_display: string;
  sesiones_ordinarias_ano: number;
  meta_legal_anual: number;
  porcentaje_cumplimiento_sesiones: number;
  total_actas: number;
  total_acuerdos: number;
  acuerdos_cumplidos: number;
  acuerdos_pendientes: number;
  tasa_cumplimiento_acuerdos: number;
  total_miembros: number;
  titulares_empresa: number;
  titulares_trabajadores: number;
  suplentes_empresa: number;
  suplentes_trabajadores: number;
  tiene_presidente: boolean;
  tiene_secretario: boolean;
  presidente_nombre: string | null;
  secretario_nombre: string | null;
  paridad_completa: boolean;
}

/**
 * Validador client-side de RUT chileno con Módulo 11
 */
export function validarRutChileno(rutRaw: string): boolean {
  if (!rutRaw) return false;
  const limpio = rutRaw.trim().toUpperCase().replace(/\./g, "").replace(/-/g, "").replace(/\s/g, "");
  if (limpio.length < 2) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i), 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  const esperadoNum = 11 - (suma % 11);
  const esperadoDV = esperadoNum === 11 ? "0" : esperadoNum === 10 ? "K" : esperadoNum.toString();

  return dv === esperadoDV;
}

/**
 * Formateador de RUT chileno a formato XX.XXX.XXX-X
 */
export function formatearRutChileno(rutRaw: string): string {
  if (!rutRaw) return "";
  const limpio = rutRaw.trim().toUpperCase().replace(/\./g, "").replace(/-/g, "").replace(/\s/g, "");
  if (limpio.length < 2) return limpio;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const formateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formateado}-${dv}`;
}
