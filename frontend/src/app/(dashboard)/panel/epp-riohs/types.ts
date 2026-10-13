export interface ItemEPP {
  tipo: string;
  marca_modelo?: string;
  certificacion?: string;
  talla?: string;
  cantidad: number;
  motivo: "ENTREGA_INICIAL" | "RECAMBIO_DESGASTE" | "DETERIORO" | "PERDIDA" | string;
}

export interface EntregaEPP {
  id: number;
  empresa: number;
  empresa_nombre?: string;
  empresa_rut?: string;
  centro_trabajo?: number | null;
  centro_trabajo_nombre?: string | null;
  trabajador: number;
  trabajador_nombres?: string;
  trabajador_apellidos?: string;
  trabajador_nombre_completo?: string;
  trabajador_rut?: string;
  trabajador_cargo?: string;
  responsable_entrega: number;
  responsable_nombre?: string;
  items_epp: ItemEPP[];
  entrega_riohs: boolean;
  version_riohs?: string;
  declaracion_capacitacion: boolean;
  firma_digital: string;
  ip_registro?: string | null;
  fecha_hora_entrega: string;
  total_items?: number;
}

export interface EstadisticasEPP {
  entregas_mes: number;
  total_trabajadores: number;
  trabajadores_con_riohs: number;
  trabajadores_pendientes_riohs: number;
  porcentaje_cumplimiento_riohs: number;
  total_entregas_historico: number;
  total_items_epp_entregados: number;
}

export interface EmpresaOption {
  id: number;
  razon_social: string;
  rut: string;
}

export interface CentroTrabajoOption {
  id: number;
  nombre: string;
  empresa: number;
}

export interface TrabajadorOption {
  id: number;
  nombres: string;
  apellidos: string;
  rut: string;
  cargo: string;
  empresa: number;
  centro_trabajo?: number | null;
}

export const EPP_PREDEFINIDOS = [
  {
    tipo: "Casco de seguridad con barbiquejo",
    certificacion: "NCh 461 / Clase A y B",
    marca_modelo: "MSA V-Gard / Tridente",
    motivo: "ENTREGA_INICIAL",
  },
  {
    tipo: "Calzado con puntera y plantilla de seguridad",
    certificacion: "NCh 772 / D.S. 594",
    marca_modelo: "Norseg / Bilsing",
    motivo: "ENTREGA_INICIAL",
  },
  {
    tipo: "Lentes de seguridad con protección UV",
    certificacion: "Art. 109 D.S. 594 / ANSI Z87.1",
    marca_modelo: "3M Virtua / Steelpro",
    motivo: "ENTREGA_INICIAL",
  },
  {
    tipo: "Protector auditivo tipo fono / tapón reutilizable",
    certificacion: "Protocolo PREXOR / NCh 1331",
    marca_modelo: "3M Peltor / Howard Leight",
    motivo: "ENTREGA_INICIAL",
  },
  {
    tipo: "Guantes de protección mecánica (Cabritilla / Nitrilo)",
    certificacion: "NCh 1115 / EN 388",
    marca_modelo: "Steelpro / Ansell HyFlex",
    motivo: "ENTREGA_INICIAL",
  },
  {
    tipo: "Arnés de cuerpo completo con doble cabo de vida",
    certificacion: "NCh 1258 / Guía Técnica ISP",
    marca_modelo: "MSA Workman / Delta",
    motivo: "ENTREGA_INICIAL",
  },
  {
    tipo: "Chaleco reflectante de alta visibilidad",
    certificacion: "NCh 3254 / Clase 2",
    marca_modelo: "Norma Vial",
    motivo: "ENTREGA_INICIAL",
  },
  {
    tipo: "Respirador medio rostro con filtros para polvo/humo",
    certificacion: "NCh 1284 / Protocolo PLANESI",
    marca_modelo: "3M Serie 6200 + Filtros 2097",
    motivo: "ENTREGA_INICIAL",
  },
];

export const MOTIVOS_ENTREGA = [
  { valor: "ENTREGA_INICIAL", texto: "Entrega Inicial / Ingreso a Faena" },
  { valor: "RECAMBIO_DESGASTE", texto: "Recambio por Desgaste Normal" },
  { valor: "DETERIORO", texto: "Deterioro o Daño Accidental" },
  { valor: "PERDIDA", texto: "Reposición por Extravío" },
];
