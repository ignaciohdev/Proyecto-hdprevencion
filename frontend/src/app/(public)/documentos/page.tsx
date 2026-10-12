"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../../utils/api";

export interface PlantillaMaestra {
  id: number;
  nombre: string;
  tipo_archivo: string;
  fecha_ultima_actualizacion: string;
  archivo_fuente?: string;
  categoria?: string;
  rubro?: string;
}

export interface DocumentoUsuario {
  id: number;
  username: string;
  plantilla_maestra: number;
  plantilla_maestra_detalle: PlantillaMaestra;
  datos_guardados: Record<string, unknown>;
  fecha_ultimo_guardado: string;
  esta_desactualizado: boolean;
}

export interface InferenciaDocumento {
  rubro: string;
  tipoDocumento: string;
  formato: "XLSX" | "DOCX" | "PDF";
}

export interface UsuarioPerfil {
  id?: number;
  username?: string;
  email?: string;
  suscripcion_activa?: {
    edicion_nube?: boolean;
    limite_semanal?: number;
  };
  contador_descargas?: {
    descargas_semanales?: number;
  };
}

// Estructuras de previsualización tipadas
export interface DocxPart {
  type: "text" | "image" | string;
  value: string;
}

export interface DocxCell {
  parts?: DocxPart[];
}

export interface DocxElement {
  type: string;
  rows?: DocxCell[][];
  parts?: DocxPart[];
}

export interface PreviewData {
  tipo: "XLSX" | "DOCX" | "PDF" | string;
  data: {
    rows?: (string | number | boolean | null)[][];
    header?: DocxElement[];
    body?: DocxElement[];
    footer?: DocxElement[];
    url?: string;
  };
}

// Opciones Oficiales de Filtros
export const RUBROS_DISPONIBLES = [
  "Todos",
  "Minería",
  "Construcción",
  "Metalmecánica",
  "Salud",
  "Transporte",
  "Forestal",
  "Agropecuaria",
  "Retail / Comercio",
  "Industrial",
  "Otros",
] as const;

export const TIPOS_DOCUMENTO_DISPONIBLES = [
  "Todos",
  "Matrices IPER / MIPER",
  "Planes de Emergencia",
  "Comités Paritarios (COPASST)",
  "Capacitaciones y Charlas",
  "Protocolos Sanitarios (DS 594 / TMERT)",
] as const;

export const FORMATOS_DISPONIBLES = [
  "Todos",
  "Excel (XLSX)",
  "Word (DOCX)",
  "Adobe PDF",
] as const;

// Helper para normalizar texto (sin tildes, minúsculas, sin espacios superfluos)
export function normalizarTexto(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Función helper inteligente para clasificar en tiempo de ejecución
export function inferirCategoriaYRubro(nombre: string, tipoArchivoExistente?: string): InferenciaDocumento {
  const norm = normalizarTexto(nombre);

  // 1. Detección de Rubro / Industria
  let rubro = "Otros";
  if (norm.match(/mineri|minero|minera|mina|rajo|subterrane|relave|tranque|codelco|chuquicamata|chancado|yacimiento|faena min/)) {
    rubro = "Minería";
  } else if (norm.match(/construc|obra|edificac|andamio|excavac|faena vial|hormigon|albanil|demolicion|enfierrad|faena civil/)) {
    rubro = "Construcción";
  } else if (norm.match(/metalmecanic|soldadur|soldador|esmeril|torno|oxicorte|mecanizad|taller mecanico|caldereria|metalurg/)) {
    rubro = "Metalmecánica";
  } else if (norm.match(/salud|clinic|hospital|bioseguridad|enfermer|medico|paciente|farmac|reas|laboratorio clinico|agente biologico/)) {
    rubro = "Salud";
  } else if (norm.match(/transport|flota|conductor|camion|chofer|vehiculo|carga|ruta|transito|vial|logistica terrestre/)) {
    rubro = "Transporte";
  } else if (norm.match(/forestal|tala|motosierra|silvicult|aserrader|madera|troza|cosecha forestal|bosque/)) {
    rubro = "Forestal";
  } else if (norm.match(/agro|agricol|plaguicida|pesticida|campo|riego|ganader|cosecha|fruticol|predio|fumigac/)) {
    rubro = "Agropecuaria";
  } else if (norm.match(/retail|comercio|supermercad|bodega|cajero|tienda|reponedor|punto de venta|almacen/)) {
    rubro = "Retail / Comercio";
  } else if (norm.match(/industri|planta|manufactur|quimic|subestacion|electric|caldera|loto|bloqueo|fabrica|sustancias peligrosas/)) {
    rubro = "Industrial";
  }

  // 2. Detección de Tipo de Documento
  let tipoDocumento = "Otros";
  if (norm.match(/iper|miper|matriz|peligro|riesgo|evaluacion de riesgo|identificacion de peligro/)) {
    tipoDocumento = "Matrices IPER / MIPER";
  } else if (norm.match(/emergenc|evacuac|sismo|incendio|contingenc|simulacr|brigad|rescate|primeros auxilios/)) {
    tipoDocumento = "Planes de Emergencia";
  } else if (norm.match(/comite paritario|cphs|copasst|paritario|acta|sesion mensual/)) {
    tipoDocumento = "Comités Paritarios (COPASST)";
  } else if (norm.match(/charla|capacitac|induccion|5 minuto|odi|derecho a saber|entrenamiento|charlas de seguridad/)) {
    tipoDocumento = "Capacitaciones y Charlas";
  } else if (norm.match(/tmert|ds 594|ds594|sanitari|planesi|prexor|ruido|silice|radiacion uv|psicosocial|ergonom|reas/)) {
    tipoDocumento = "Protocolos Sanitarios (DS 594 / TMERT)";
  }

  // 3. Detección de Formato
  let formato: "XLSX" | "DOCX" | "PDF" = "XLSX";
  const rawTipo = (tipoArchivoExistente || "").toUpperCase();
  if (rawTipo.includes("DOC") || norm.endsWith(".docx") || norm.endsWith(".doc")) {
    formato = "DOCX";
  } else if (rawTipo.includes("PDF") || norm.endsWith(".pdf")) {
    formato = "PDF";
  } else if (rawTipo.includes("XLS") || norm.endsWith(".xlsx") || norm.endsWith(".xls")) {
    formato = "XLSX";
  } else {
    if (tipoDocumento === "Matrices IPER / MIPER") {
      formato = "XLSX";
    } else if (tipoDocumento === "Planes de Emergencia") {
      formato = "PDF";
    } else {
      formato = "DOCX";
    }
  }

  return { rubro, tipoDocumento, formato };
}

// Catálogo enriquecido de respaldo (Fallback SaaS oficial chileno)
const MOCK_FALLBACK_PLANTILLAS: PlantillaMaestra[] = [
  { id: 1, nombre: "Matriz IPER Minería Subterránea y Rajo Abierto (DS 132)", tipo_archivo: "XLSX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 2, nombre: "Protocolo TMERT Paso a Paso y Ergonomía Física en Salud", tipo_archivo: "DOCX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 3, nombre: "Plan de Emergencia, Evacuación e Incendios en Edificación (DS 594)", tipo_archivo: "PDF", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 4, nombre: "Matriz IPER Obras de Construcción y Trabajos en Altura", tipo_archivo: "XLSX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 5, nombre: "Acta de Constitución y Sesión Mensual CPHS (Comité Paritario)", tipo_archivo: "DOCX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 6, nombre: "Programa de Inducción ODI y Charlas de Seguridad de 5 Minutos", tipo_archivo: "DOCX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 7, nombre: "Matriz IPER Taller Metalmecánico, Soldadura y Oxicorte", tipo_archivo: "XLSX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 8, nombre: "Plan de Contingencia y Seguridad Vial en Flotas de Transporte", tipo_archivo: "PDF", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 9, nombre: "Protocolo de Manejo de Sustancias Químicas y DS 594 en Planta Industrial", tipo_archivo: "PDF", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 10, nombre: "Matriz IPER Aplicación de Plaguicidas y Faenas Agropecuarias", tipo_archivo: "XLSX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 11, nombre: "Matriz MIPER Cosecha Forestal y Operación con Motosierra", tipo_archivo: "XLSX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 12, nombre: "Plan de Emergencia y Evacuación en Bodegas y Tiendas de Retail", tipo_archivo: "PDF", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 13, nombre: "Procedimiento de Bloqueo y Aislación LOTO en Subestaciones Industriales", tipo_archivo: "DOCX", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 14, nombre: "Protocolo de Bioseguridad y Manejo de Residuos REAS en Salud", tipo_archivo: "PDF", fecha_ultima_actualizacion: new Date().toISOString() },
  { id: 15, nombre: "Registro de Capacitación Práctica en Uso de Extintores Portátiles", tipo_archivo: "DOCX", fecha_ultima_actualizacion: new Date().toISOString() },
];

export default function DocumentosPage() {
  const router = useRouter();

  // Estados de datos principales
  const [plantillas, setPlantillas] = useState<PlantillaMaestra[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<UsuarioPerfil | null>(null);

  // Estados de Búsqueda y Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRubro, setSelectedRubro] = useState<string>("Todos");
  const [selectedTipoDoc, setSelectedTipoDoc] = useState<string>("Todos");
  const [selectedFormato, setSelectedFormato] = useState<string>("Todos");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Modal de Subida (Admins)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    nombre: "",
    tipo_archivo: "XLSX",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Modal de Previsualización (Ejemplo con Marca de Agua)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PlantillaMaestra | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      router.push("/ingreso");
      return;
    }

    try {
      // 1. Obtener plantillas
      const resPlantillas = await fetch(getApiUrl("/api/plantillas-maestras/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      let dataPlantillas: PlantillaMaestra[] = [];
      if (resPlantillas.ok) {
        dataPlantillas = await resPlantillas.json();
      }

      if (!Array.isArray(dataPlantillas) || dataPlantillas.length === 0) {
        dataPlantillas = MOCK_FALLBACK_PLANTILLAS;
      }
      setPlantillas(dataPlantillas);

      // Decodificar permisos admin
      try {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        setIsAdmin(Boolean(payload.is_superuser || payload.is_staff));
      } catch {
        setIsAdmin(false);
      }

      // 2. Obtener documentos guardados
      const resDocs = await fetch(getApiUrl("/api/documentos-usuario/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resDocs.ok) {
        const dataDocs = await resDocs.json();
        setDocumentos(dataDocs);
      }

      // 3. Obtener perfil del usuario
      const resUser = await fetch(getApiUrl("/api/usuarios/perfil/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resUser.ok) {
        const dataUser = await resUser.json();
        setUser(dataUser);
      }
    } catch {
      setPlantillas((prev) => (prev.length === 0 ? MOCK_FALLBACK_PLANTILLAS : prev));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Plantillas procesadas con inferencia de datos
  const plantillasConInferencia = useMemo(() => {
    return plantillas.map((plantilla) => {
      const inferencia = inferirCategoriaYRubro(plantilla.nombre, plantilla.tipo_archivo);
      return {
        ...plantilla,
        rubroInferido: plantilla.rubro || inferencia.rubro,
        tipoDocInferido: plantilla.categoria || inferencia.tipoDocumento,
        formatoNormalizado: inferencia.formato,
      };
    });
  }, [plantillas]);

  // Contadores por Rubro para Badges
  const conteoPorRubro = useMemo(() => {
    const counts: Record<string, number> = { Todos: plantillasConInferencia.length };
    plantillasConInferencia.forEach((p) => {
      counts[p.rubroInferido] = (counts[p.rubroInferido] || 0) + 1;
    });
    return counts;
  }, [plantillasConInferencia]);

  // Contadores por Tipo de Documento
  const conteoPorTipoDoc = useMemo(() => {
    const counts: Record<string, number> = { Todos: plantillasConInferencia.length };
    plantillasConInferencia.forEach((p) => {
      counts[p.tipoDocInferido] = (counts[p.tipoDocInferido] || 0) + 1;
    });
    return counts;
  }, [plantillasConInferencia]);

  // Contadores por Formato
  const conteoPorFormato = useMemo(() => {
    const counts: Record<string, number> = { Todos: plantillasConInferencia.length };
    plantillasConInferencia.forEach((p) => {
      const key =
        p.formatoNormalizado === "XLSX"
          ? "Excel (XLSX)"
          : p.formatoNormalizado === "DOCX"
          ? "Word (DOCX)"
          : "Adobe PDF";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [plantillasConInferencia]);

  // Filtrado reactivo en tiempo real
  const plantillasFiltradas = useMemo(() => {
    const queryNorm = normalizarTexto(searchQuery);

    return plantillasConInferencia.filter((p) => {
      // 1. Filtro por Rubro
      if (selectedRubro !== "Todos" && p.rubroInferido !== selectedRubro) {
        return false;
      }

      // 2. Filtro por Tipo de Documento
      if (selectedTipoDoc !== "Todos" && p.tipoDocInferido !== selectedTipoDoc) {
        return false;
      }

      // 3. Filtro por Formato de Archivo
      if (selectedFormato !== "Todos") {
        if (selectedFormato === "Excel (XLSX)" && p.formatoNormalizado !== "XLSX") return false;
        if (selectedFormato === "Word (DOCX)" && p.formatoNormalizado !== "DOCX") return false;
        if (selectedFormato === "Adobe PDF" && p.formatoNormalizado !== "PDF") return false;
      }

      // 4. Búsqueda por texto (insensible a mayúsculas y tildes)
      if (queryNorm) {
        const nombreNorm = normalizarTexto(p.nombre);
        const rubroNorm = normalizarTexto(p.rubroInferido);
        const tipoNorm = normalizarTexto(p.tipoDocInferido);
        const formatoNorm = normalizarTexto(p.formatoNormalizado);

        const coincide =
          nombreNorm.includes(queryNorm) ||
          rubroNorm.includes(queryNorm) ||
          tipoNorm.includes(queryNorm) ||
          formatoNorm.includes(queryNorm);

        if (!coincide) return false;
      }

      return true;
    });
  }, [plantillasConInferencia, searchQuery, selectedRubro, selectedTipoDoc, selectedFormato]);

  // Paginación
  const totalPages = Math.ceil(plantillasFiltradas.length / ITEMS_PER_PAGE) || 1;
  const clampedPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (clampedPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, plantillasFiltradas.length);
  const plantillasPaginadas = plantillasFiltradas.slice(startIndex, endIndex);

  // Manejadores de Filtros (resetean la página a 1)
  const handleSearchChange = (texto: string) => {
    setSearchQuery(texto);
    setCurrentPage(1);
  };

  const handleSelectRubro = (rubro: string) => {
    setSelectedRubro(rubro);
    setCurrentPage(1);
  };

  const handleSelectTipoDoc = (tipo: string) => {
    setSelectedTipoDoc(tipo);
    setCurrentPage(1);
  };

  const handleSelectFormato = (formato: string) => {
    setSelectedFormato(formato);
    setCurrentPage(1);
  };

  const handleRestablecerFiltros = () => {
    setSearchQuery("");
    setSelectedRubro("Todos");
    setSelectedTipoDoc("Todos");
    setSelectedFormato("Todos");
    setCurrentPage(1);
  };

  // Creación y edición interactiva
  const handleCrearDocumento = async (plantilla: PlantillaMaestra) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    if (user && user.suscripcion_activa && !user.suscripcion_activa.edicion_nube) {
      alert(
        "Tu plan actual (Básico) no permite la creación o edición de documentos en la nube. Por favor, adquiere un plan Profesional, Expert o Consultora."
      );
      return;
    }

    let datos_inicial = {};
    if (plantilla.id === 1 || plantilla.nombre.includes("IPER")) {
      datos_inicial = { filas: [] };
    } else if (plantilla.id === 2 || plantilla.nombre.includes("TMERT")) {
      datos_inicial = { repetitividad: "BAJO", fuerza: "BAJO", postura: "BAJO", conclusiones: "" };
    } else {
      datos_inicial = { empresa: "", rut: "", direccion: "", brigadistas: "", zonas_seguridad: "" };
    }

    try {
      const res = await fetch(getApiUrl("/api/documentos-usuario/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plantilla_maestra: plantilla.id,
          datos_guardados: datos_inicial,
        }),
      });

      if (!res.ok) throw new Error("Error al inicializar el documento.");
      const data = await res.json();
      router.push(`/documentos/editar/${data.id}`);
    } catch {
      const mockId = Math.floor(Math.random() * 1000) + 1000;
      router.push(`/documentos/editar/${mockId}?mock=true&plantilla=${plantilla.id}`);
    }
  };

  // Subida de nueva plantilla maestra (Admins)
  const handleUploadTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Por favor selecciona un archivo.");
      return;
    }

    setUploading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const formData = new FormData();
    formData.append("nombre", uploadForm.nombre);
    formData.append("tipo_archivo", uploadForm.tipo_archivo);
    formData.append("archivo_fuente", selectedFile);

    try {
      const res = await fetch(getApiUrl("/api/plantillas-maestras/"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Error al subir el documento.");

      alert("¡Plantilla Maestra subida con éxito!");
      setIsUploadModalOpen(false);
      setUploadForm({ nombre: "", tipo_archivo: "XLSX" });
      setSelectedFile(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido al subir el archivo.";
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  // Eliminación de copias guardadas
  const handleEliminar = async (id: number) => {
    if (!confirm("¿Deseas eliminar esta copia guardada? Esta acción no se puede deshacer.")) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    try {
      const res = await fetch(getApiUrl(`/api/documentos-usuario/${id}/`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar el documento.");
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar el documento.";
      alert(msg);
    }
  };

  // Descarga de archivo XLSX / DOCX
  const handleDescargarArchivo = async (id: number, type: "XLSX" | "DOCX", docName: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const endpoint = type === "XLSX" ? "descargar-excel" : "descargar-docx";
    const url = getApiUrl(`/api/documentos-usuario/${id}/${endpoint}/`);

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Error al descargar el archivo");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;

      const cleanName = docName.replace(/[^a-zA-Z0-9_\-]/g, "_");
      link.setAttribute("download", `${cleanName}_${id}.${type.toLowerCase()}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido al descargar.";
      alert("No se pudo descargar el archivo: " + msg);
    }
  };

  // Previsualización con Marca de Agua
  const handleOpenPreview = async (plantilla: PlantillaMaestra) => {
    setPreviewTemplate(plantilla);
    setIsPreviewModalOpen(true);
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewData(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    try {
      const res = await fetch(getApiUrl(`/api/plantillas-maestras/${plantilla.id}/preview/`), {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error("No se pudo obtener la vista previa del archivo.");
      const data: PreviewData = await res.json();
      setPreviewData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar vista previa.";
      setPreviewError(msg);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Helper para renderizar badge de formato
  const renderBadgeFormato = (formato: "XLSX" | "DOCX" | "PDF" | string) => {
    const fmt = formato.toUpperCase();
    if (fmt === "XLSX" || fmt === "EXCEL") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v18H3V3zm6 4v10m6-10v10M3 9h18M3 15h18" />
          </svg>
          XLSX
        </span>
      );
    }
    if (fmt === "DOCX" || fmt === "WORD") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800/80">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          DOCX
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        PDF
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <main className="container mx-auto px-4 py-8 space-y-8">
        
        {/* BANNER PRINCIPAL: Biblioteca Documental SaaS */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-800">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-orange-600 text-white text-xs font-extrabold uppercase px-3 py-1 rounded-full shadow-sm tracking-wide">
                  HD Prevención Cloud SaaS
                </span>
                <span className="bg-slate-800 text-slate-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-700">
                  Normativa Chilena DS 594 • ISO 45001
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                Biblioteca Oficial de Formatos y Matrices IPER
              </h1>
              <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
                Catálogo inteligente de prevención de riesgos laborales. Búsqueda en tiempo real, matrices listas para editar en la nube y previsualización oficial con marca de agua.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-orange-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Subir Plantilla (Admin)</span>
              </button>
            )}
          </div>
        </div>

        {/* CONTADORES DE CUPO Y ALMACENAMIENTO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Capacidad de Descargas */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1.5 flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <span>Cupo de Descargas Semanales</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Descargas consumidas en la semana en curso</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Descargas Utilizadas</span>
                <span className="text-orange-600 dark:text-orange-500 font-bold font-mono text-sm">
                  {(user?.suscripcion_activa?.limite_semanal ?? 5) > 10000
                    ? `${user?.contador_descargas?.descargas_semanales || 0} descargas (Ilimitadas)`
                    : `${user?.contador_descargas?.descargas_semanales || 0} de ${user?.suscripcion_activa?.limite_semanal || 5} descargas`}
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-orange-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      (user?.suscripcion_activa?.limite_semanal ?? 5) > 10000
                        ? 2
                        : Math.min(
                            ((user?.contador_descargas?.descargas_semanales || 0) /
                              (user?.suscripcion_activa?.limite_semanal || 5)) *
                              100,
                            100
                          )
                    }%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Tu cupo se restablece de forma automática todos los días lunes a las 00:00 hrs.
              </p>
            </div>
          </div>

          {/* Card: Almacenamiento de Copias */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1.5 flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 5.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                    />
                  </svg>
                </div>
                <span>Almacenamiento de Copias</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Documentos persistidos en tu cuenta de HD Prevención</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Espacio de Almacenamiento</span>
                <span
                  className={`font-bold font-mono text-sm ${
                    documentos.length >= 5
                      ? "text-red-500"
                      : documentos.length >= 4
                      ? "text-orange-500"
                      : "text-emerald-600 dark:text-emerald-500"
                  }`}
                >
                  {documentos.length} de 5 copias guardadas
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    documentos.length >= 5
                      ? "bg-red-500"
                      : documentos.length >= 4
                      ? "bg-orange-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min((documentos.length / 5) * 100, 100)}%` }}
                />
              </div>

              <p
                className={`text-[11px] ${
                  documentos.length >= 5
                    ? "text-red-500 dark:text-red-400 font-semibold"
                    : "text-slate-400"
                }`}
              >
                {documentos.length >= 5
                  ? "⚠️ Límite de 5 copias alcanzado. Si creas una nueva copia, la más antigua se eliminará automáticamente."
                  : "Puedes guardar hasta 5 copias. Si superas el límite, se auto-eliminará la más antigua."}
              </p>
            </div>
          </div>
        </div>

        {/* SECCIÓN PRINCIPAL: FORMATOS OFICIALES DISPONIBLES */}
        <section className="space-y-6">
          
          {/* Header de la sección + Barra de Búsqueda y Switcher de Vista */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                  <span className="text-orange-600">📋</span>
                  <span>Formatos Oficiales Disponibles</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                    {plantillasFiltradas.length} {plantillasFiltradas.length === 1 ? "formato" : "formatos"}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Explora, filtra por rubro y formato, o edita directamente en tu navegador.
                </p>
              </div>

              {/* Controles Superiores: Motor de Búsqueda y Toggle Grid/Table */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                
                {/* A. Motor de Búsqueda Reactivo en Tiempo Real */}
                <div className="relative flex-1 sm:w-80">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar por nombre, rubro, IPER..."
                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs md:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearchChange("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* C. Conmutador de Vistas (Grid vs Tabla) */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 self-end sm:self-auto">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "grid"
                        ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                    title="Vista en Tarjetas"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Tarjetas</span>
                  </button>

                  <button
                    onClick={() => setViewMode("table")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "table"
                        ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                    title="Vista en Tabla"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span className="hidden sm:inline">Tabla</span>
                  </button>
                </div>
              </div>
            </div>

            {/* B. Sistema de Filtros por Categoría, Rubro y Formato */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              
              {/* 1. Filtro por Rubro / Industria */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Filtrar por Rubro / Industria:
                  </span>
                  {(selectedRubro !== "Todos" || selectedTipoDoc !== "Todos" || selectedFormato !== "Todos" || searchQuery) && (
                    <button
                      onClick={handleRestablecerFiltros}
                      className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
                    >
                      Restablecer todos los filtros
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {RUBROS_DISPONIBLES.map((rubro) => {
                    const isSelected = selectedRubro === rubro;
                    const count = conteoPorRubro[rubro] || 0;
                    return (
                      <button
                        key={rubro}
                        onClick={() => handleSelectRubro(rubro)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-orange-600 text-white shadow-md shadow-orange-600/20 scale-[1.02]"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <span>{rubro}</span>
                        {count > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Filtro por Tipo de Documento y Formato (Fila dual) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Tipo de Documento */}
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Tipo de Documento:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {TIPOS_DOCUMENTO_DISPONIBLES.map((tipo) => {
                      const isSelected = selectedTipoDoc === tipo;
                      const count = conteoPorTipoDoc[tipo] || 0;
                      return (
                        <button
                          key={tipo}
                          onClick={() => handleSelectTipoDoc(tipo)}
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-sm"
                              : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          <span>{tipo}</span>
                          {count > 0 && (
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                isSelected
                                  ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                                  : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Formato de Archivo */}
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Formato de Archivo:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FORMATOS_DISPONIBLES.map((formato) => {
                      const isSelected = selectedFormato === formato;
                      const count = conteoPorFormato[formato] || 0;
                      return (
                        <button
                          key={formato}
                          onClick={() => handleSelectFormato(formato)}
                          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-sm"
                              : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          {formato.includes("XLSX") && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                          {formato.includes("DOCX") && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                          {formato.includes("PDF") && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                          <span>{formato}</span>
                          {count > 0 && (
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                isSelected
                                  ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                                  : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ESTADO DE CARGA */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-400">Cargando biblioteca de formatos...</p>
            </div>
          ) : plantillasFiltradas.length === 0 ? (
            
            /* E. ESTADO VACÍO (EMPTY STATE) */
            <div className="bg-white dark:bg-slate-950 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                No se encontraron formatos con ese criterio
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                No existen plantillas oficiales que coincidan con la búsqueda o combinación de filtros actual. Prueba cambiando los términos o restableciendo los parámetros.
              </p>
              <button
                onClick={handleRestablecerFiltros}
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Restablecer filtros</span>
              </button>
            </div>
          ) : (
            
            /* CATÁLOGO: VISTA EN GRID O EN TABLA */
            <div className="space-y-6">
              
              {/* VISTA 1: GRID VIEW (Tarjetas Modernas de 3 Columnas) */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plantillasPaginadas.map((plantilla) => (
                    <div
                      key={plantilla.id}
                      className="group bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 dark:border-slate-800 hover:border-orange-500/40 dark:hover:border-orange-500/40 transition-all duration-300 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Badges superiores: Formato y Rubro */}
                        <div className="flex items-center justify-between gap-2">
                          {renderBadgeFormato(plantilla.formatoNormalizado)}
                          <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                            {plantilla.rubroInferido}
                          </span>
                        </div>

                        {/* Título de la Plantilla */}
                        <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 leading-snug">
                          {plantilla.nombre}
                        </h3>

                        {/* Tipo de Documento y Detalle */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
                          <span className="truncate">{plantilla.tipoDocInferido}</span>
                        </div>

                        {/* Fecha de Actualización */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Actualizado:</span>
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            {new Date(plantilla.fecha_ultima_actualizacion).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-900 flex items-center gap-3">
                        <button
                          onClick={() => handleOpenPreview(plantilla)}
                          className="w-1/2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer text-center"
                        >
                          Ver Ejemplo
                        </button>
                        <button
                          onClick={() => handleCrearDocumento(plantilla)}
                          className="w-1/2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer text-center shadow-md shadow-orange-600/20"
                        >
                          Editar en Nube
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                
                /* VISTA 2: TABLE VIEW (Tabla Compacta Moderna) */
                <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs md:text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-3.5">Formato</th>
                          <th className="px-6 py-3.5">Nombre de la Plantilla</th>
                          <th className="px-6 py-3.5">Rubro Detectado</th>
                          <th className="px-6 py-3.5">Tipo de Documento</th>
                          <th className="px-6 py-3.5">Última Actualización</th>
                          <th className="px-6 py-3.5 text-right">Acciones Rápidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {plantillasPaginadas.map((plantilla) => (
                          <tr
                            key={plantilla.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              {renderBadgeFormato(plantilla.formatoNormalizado)}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white max-w-xs md:max-w-md">
                              <span className="line-clamp-2">{plantilla.nombre}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                                {plantilla.rubroInferido}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                              {plantilla.tipoDocInferido}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-xs">
                              {new Date(plantilla.fecha_ultima_actualizacion).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                              <button
                                onClick={() => handleOpenPreview(plantilla)}
                                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Ver Ejemplo
                              </button>
                              <button
                                onClick={() => handleCrearDocumento(plantilla)}
                                className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
                              >
                                Editar en Nube
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* D. PAGINACIÓN / CONTADOR DE RESULTADOS */}
              <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* Selector / Contador de Resultados */}
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Mostrando{" "}
                  <span className="font-bold text-slate-900 dark:text-white">{startIndex + 1}</span> a{" "}
                  <span className="font-bold text-slate-900 dark:text-white">{endIndex}</span> de{" "}
                  <span className="font-bold text-slate-900 dark:text-white">{plantillasFiltradas.length}</span> plantillas encontradas
                </div>

                {/* Botones de Páginas */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    {/* Botón Anterior */}
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={clampedPage === 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      ← Anterior
                    </button>

                    {/* Números de página */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
                      const isActive = num === clampedPage;
                      return (
                        <button
                          key={num}
                          onClick={() => setCurrentPage(num)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? "bg-orange-600 text-white shadow-sm"
                              : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}

                    {/* Botón Siguiente */}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={clampedPage === totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}

              </div>

            </div>
          )}
        </section>

        {/* SECCIÓN 2: MIS COPIAS Y EDICIONES GUARDADAS */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <span>💾</span>
              <span>Mis Copias y Ediciones Guardadas</span>
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {documentos.length} de 5 copias
            </span>
          </div>

          <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {documentos.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm space-y-2">
                <p className="font-semibold text-slate-500 dark:text-slate-300">
                  Aún no tienes copias guardadas en la nube.
                </p>
                <p className="text-xs">
                  Selecciona una plantilla oficial en el catálogo superior y haz clic en &ldquo;Editar en Nube&rdquo; para comenzar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-3.5">Documento</th>
                      <th className="px-6 py-3.5">Último Guardado</th>
                      <th className="px-6 py-3.5">Vigencia</th>
                      <th className="px-6 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {documentos.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {doc.plantilla_maestra_detalle?.nombre || "Documento Personalizado"}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {new Date(doc.fecha_ultimo_guardado).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {doc.esta_desactualizado ? (
                            <span className="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                              Desactualizado
                            </span>
                          ) : (
                            <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                              Al Día
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => {
                              if (user && user.suscripcion_activa && !user.suscripcion_activa.edicion_nube) {
                                alert(
                                  "Tu plan actual (Básico) no permite la edición de documentos en la nube. Por favor, actualiza tu plan en la sección de Planes de Suscripción."
                                );
                                return;
                              }
                              router.push(`/documentos/editar/${doc.id}`);
                            }}
                            className="text-orange-600 hover:text-orange-500 font-semibold cursor-pointer"
                          >
                            Editar
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          {doc.plantilla_maestra_detalle?.tipo_archivo === "DOCX" ? (
                            <button
                              onClick={() =>
                                handleDescargarArchivo(
                                  doc.id,
                                  "DOCX",
                                  doc.plantilla_maestra_detalle.nombre
                                )
                              }
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold cursor-pointer"
                            >
                              Word
                            </button>
                          ) : doc.plantilla_maestra_detalle?.tipo_archivo === "XLSX" ? (
                            <button
                              onClick={() =>
                                handleDescargarArchivo(
                                  doc.id,
                                  "XLSX",
                                  doc.plantilla_maestra_detalle.nombre
                                )
                              }
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold cursor-pointer"
                            >
                              Excel
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (user && user.suscripcion_activa && !user.suscripcion_activa.edicion_nube) {
                                  alert(
                                    "Tu plan actual (Básico) no permite la edición/visualización de documentos en la nube. Por favor, actualiza tu plan en la sección de Planes de Suscripción."
                                  );
                                  return;
                                }
                                router.push(`/documentos/editar/${doc.id}?print=true`);
                              }}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold cursor-pointer"
                            >
                              PDF
                            </button>
                          )}
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            onClick={() => handleEliminar(doc.id)}
                            className="text-red-500 hover:text-red-400 font-semibold cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* MODAL 1: SUBIDA DE PLANTILLA MAESTRA (ADMINS) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              Subir Nueva Plantilla Oficial
            </h2>

            <form onSubmit={handleUploadTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre del Formato</label>
                <input
                  type="text"
                  required
                  value={uploadForm.nombre}
                  onChange={(e) => setUploadForm({ ...uploadForm, nombre: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ej. Matriz IPER Trabajos en Altura"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Tipo de Formato</label>
                <select
                  value={uploadForm.tipo_archivo}
                  onChange={(e) => setUploadForm({ ...uploadForm, tipo_archivo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="XLSX">Microsoft Excel (XLSX)</option>
                  <option value="DOCX">Microsoft Word (DOCX)</option>
                  <option value="PDF">Adobe PDF (PDF)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Archivo Fuente</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {uploading ? "Subiendo..." : "Subir Archivo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PREVISUALIZACIÓN DE EJEMPLO CON MARCA DE AGUA */}
      {isPreviewModalOpen && previewTemplate && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative">
            
            {/* Header del Modal */}
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
              <div>
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  Vista Previa Protegida
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {previewTemplate.nombre}
                </h2>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* CUERPO DEL DOCUMENTO CON MARCA DE AGUA */}
            <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50 dark:bg-slate-900/20 select-none">
              
              {/* CAPA DE MARCA DE AGUA */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10 opacity-15">
                <div className="text-red-600 dark:text-red-400 font-black text-6xl md:text-8xl tracking-widest uppercase select-none pointer-events-none transform -rotate-45 whitespace-nowrap">
                  EJEMPLO • EJEMPLO • EJEMPLO
                </div>
              </div>

              {/* Contenido Dinámico de Vista Previa */}
              {loadingPreview ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-400 font-semibold">Procesando archivo para vista previa...</span>
                </div>
              ) : previewError || !previewData ? (
                <div className="space-y-4">
                  {previewError && (
                    <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs font-semibold mb-4">
                      ⚠ Nota: Vista previa oficial simulada ({previewError}).
                    </div>
                  )}

                  {/* Fallback de ejemplo estático tradicional */}
                  {previewTemplate.id === 1 || previewTemplate.nombre.includes("IPER") ? (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA DE MATRIZ IPER</p>
                      <table className="w-full text-left border-collapse text-[10px] min-w-[700px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-800">
                            <th className="p-2 border-r border-slate-200 dark:border-slate-800">Actividad / Tarea</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-800">Peligro</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-800">Riesgo</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">P</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">S</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">Riesgo</th>
                            <th className="p-2">Medidas de Control</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-medium">Trabajo en Altura (Fachadas)</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800">Caída de distinto nivel</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800">Fracturas, traumatismo grave, muerte</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">3</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">5</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold bg-red-50 text-red-700">15 (Crítico)</td>
                            <td className="p-2">Arnés de seguridad, línea de vida, barandas perimetrales y andamios certificados.</td>
                          </tr>
                          <tr>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-medium">Operación de Esmeril Angular</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800">Proyección de partículas incandescentes</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800">Corte, lesiones oculares graves</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">2</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">4</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold bg-amber-50 text-amber-700">8 (Medio)</td>
                            <td className="p-2">Uso obligatorio de antiparras de seguridad y careta facial completa. Pantallas de protección.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : previewTemplate.id === 2 || previewTemplate.nombre.includes("TMERT") ? (
                    <div className="space-y-4 bg-white dark:bg-slate-950 p-4 rounded-lg">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA DE EVALUACIÓN TMERT</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><strong>Empresa de Ejemplo:</strong> Comercializadora Metalúrgica Ltda.</div>
                        <div><strong>RUT:</strong> 77.777.777-7</div>
                        <div className="col-span-2"><strong>Dirección:</strong> Av. Industrial 500, Maipú</div>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2 text-xs">
                        <div className="flex justify-between border-b pb-1.5">
                          <span><strong>Repetitividad de Movimiento:</strong></span>
                          <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">ALTO (Crítico)</span>
                        </div>
                        <div className="flex justify-between border-b pb-1.5">
                          <span><strong>Uso de Fuerza Física:</strong></span>
                          <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">MEDIO (Precaución)</span>
                        </div>
                        <div className="flex justify-between">
                          <span><strong>Postura Corporal Crítica:</strong></span>
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">BAJO (Controlado)</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 bg-white dark:bg-slate-950 p-4 rounded-lg">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA DE PLAN DE EMERGENCIA Y EVACUACIÓN</p>
                      <div className="space-y-2 text-xs">
                        <p><strong>Razón Social:</strong> Logística Central S.A.</p>
                        <p><strong>Ubicación de Extintores:</strong> 2 extintores PQS de 6kg en pasillo de oficinas, 1 de CO2 en sala de servidores.</p>
                        <p><strong>Líder de Evacuación:</strong> Supervisor de Prevención de Turno.</p>
                        <p><strong>Zonas de Seguridad / Puntos de Encuentro:</strong> Zona demarcada con pintura amarilla en el estacionamiento frontal exterior.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full">
                  {previewData.tipo === "XLSX" && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA REAL DEL DOCUMENTO EXCEL (MUESTRA DE FILAS)</p>
                      <div className="overflow-x-auto max-h-[500px] border border-slate-200 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-left border-collapse text-[11px] min-w-[800px] bg-white dark:bg-slate-950">
                          <tbody>
                            {previewData.data.rows?.map((row, rIdx) => {
                              const isHeader = rIdx === 0 || (rIdx === 3 && row.some((c) => c && c.toString().includes("Peligro")));
                              return (
                                <tr
                                  key={rIdx}
                                  className={
                                    isHeader
                                      ? "bg-slate-100 dark:bg-slate-900 font-bold border-b border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                                      : "border-b border-slate-100 dark:border-slate-900"
                                  }
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`p-2 border-r border-slate-200 dark:border-slate-800 max-w-[200px] truncate ${
                                        isHeader ? "font-semibold text-slate-900 dark:text-white" : ""
                                      }`}
                                    >
                                      {cell !== null && cell !== undefined ? String(cell) : ""}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {previewData.tipo === "DOCX" && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA REAL DEL DOCUMENTO WORD (TABLAS Y PÁRRAFOS ORIGINALES)</p>
                      
                      {/* Página de papel simulada */}
                      <div className="bg-white dark:bg-slate-950 p-6 md:p-10 rounded-2xl shadow-xl max-h-[600px] overflow-y-auto font-sans leading-relaxed text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-800 max-w-3xl mx-auto text-left relative">
                        
                        {/* 1. SECCIÓN CABECERA */}
                        {previewData.data.header && previewData.data.header.length > 0 && (
                          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                            {previewData.data.header.map((el, elIdx) => {
                              if (el.type === "table" && el.rows) {
                                return (
                                  <table key={elIdx} className="w-full border-collapse border border-slate-300 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950">
                                    <tbody>
                                      {el.rows.map((row: DocxCell[], rIdx: number) => (
                                        <tr key={rIdx} className="border-b border-slate-200 dark:border-slate-800">
                                          {row.map((cell: DocxCell, cIdx: number) => (
                                            <td key={cIdx} className="border border-slate-300 dark:border-slate-800 p-2 text-center align-middle font-medium bg-slate-50/10 dark:bg-slate-900/10">
                                              {cell.parts && cell.parts.length > 0
                                                ? cell.parts.map((part: DocxPart, pIdx: number) => {
                                                    if (part.type === "image") {
                                                      /* eslint-disable-next-line @next/next/no-img-element */
                                                      return <img key={pIdx} src={part.value} className="max-h-12 max-w-full object-contain mx-auto" alt="logo header" />;
                                                    }
                                                    return <span key={pIdx}>{part.value}</span>;
                                                  })
                                                : ""}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              } else {
                                return (
                                  <p key={elIdx} className="text-center text-[10px] text-slate-400 mt-1">
                                    {el.parts?.map((p: DocxPart) => p.value).join("")}
                                  </p>
                                );
                              }
                            })}
                          </div>
                        )}

                        {/* 2. SECCIÓN CUERPO */}
                        <div className="space-y-4">
                          {previewData.data.body &&
                            previewData.data.body.map((el, elIdx) => {
                              if (el.type === "table" && el.rows) {
                                return (
                                  <table key={elIdx} className="w-full border-collapse border border-slate-300 dark:border-slate-800 text-xs bg-white dark:bg-slate-950">
                                    <tbody>
                                      {el.rows.map((row: DocxCell[], rIdx: number) => (
                                        <tr key={rIdx} className="border-b border-slate-200 dark:border-slate-800">
                                          {row.map((cell: DocxCell, cIdx: number) => (
                                            <td key={cIdx} className="border border-slate-300 dark:border-slate-800 p-2 text-left align-middle bg-slate-50/5 dark:bg-slate-900/5">
                                              {cell.parts &&
                                                cell.parts.map((part: DocxPart, pIdx: number) => {
                                                  if (part.type === "image") {
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    return <img key={pIdx} src={part.value} className="max-h-16 max-w-full object-contain mx-auto" alt="body image" />;
                                                  }
                                                  return (
                                                    <span key={pIdx}>
                                                      {part.value
                                                        .replace("{{EMPRESA}}", "[Nombre de la Empresa]")
                                                        .replace("{{REPRESENTANTE_LEGAL}}", "[Nombre del Representante Legal]")
                                                        .replace("{{DIA}}", "[Día]")
                                                        .replace("{{MES}}", "[Mes]")
                                                        .replace("{{ANIO}}", "[Año]")}
                                                    </span>
                                                  );
                                                })}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              } else {
                                const fullText = el.parts?.map((p: DocxPart) => p.value).join("") || "";
                                const isTitle = fullText.toUpperCase() === fullText && fullText.length > 5 && fullText.length < 150;
                                return (
                                  <p
                                    key={elIdx}
                                    className={
                                      isTitle
                                        ? "text-center font-extrabold text-base text-slate-950 dark:text-white border-b pb-2 mb-4 tracking-wide"
                                        : "text-sm text-justify leading-relaxed whitespace-pre-wrap"
                                    }
                                  >
                                    {el.parts?.map((part: DocxPart, pIdx: number) => {
                                      if (part.type === "image") {
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        return <img key={pIdx} src={part.value} className="max-h-16 inline-block mx-2" alt="body inline img" />;
                                      }
                                      return (
                                        <span key={pIdx}>
                                          {part.value
                                            .replace("{{EMPRESA}}", "[Nombre de la Empresa]")
                                            .replace("{{REPRESENTANTE_LEGAL}}", "[Nombre del Representante Legal]")
                                            .replace("{{DIA}}", "[Día]")
                                            .replace("{{MES}}", "[Mes]")
                                            .replace("{{ANIO}}", "[Año]")}
                                        </span>
                                      );
                                    })}
                                  </p>
                                );
                              }
                            })}
                        </div>

                        {/* 3. SECCIÓN PIE DE PÁGINA */}
                        {previewData.data.footer && previewData.data.footer.length > 0 && (
                          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-8">
                            {previewData.data.footer.map((el, elIdx) => {
                              if (el.type === "table" && el.rows) {
                                return (
                                  <table key={elIdx} className="w-full border-collapse border border-slate-300 dark:border-slate-800 text-[10px] text-slate-500 bg-white dark:bg-slate-950">
                                    <tbody>
                                      {el.rows.map((row: DocxCell[], rIdx: number) => (
                                        <tr key={rIdx} className="border-b border-slate-200 dark:border-slate-800">
                                          {row.map((cell: DocxCell, cIdx: number) => (
                                            <td key={cIdx} className="border border-slate-300 dark:border-slate-800 p-2 text-left align-middle font-medium bg-slate-50/5 dark:bg-slate-900/5">
                                              {cell.parts &&
                                                cell.parts.length > 0
                                                ? cell.parts.map((part: DocxPart, pIdx: number) => {
                                                    if (part.type === "image") {
                                                      /* eslint-disable-next-line @next/next/no-img-element */
                                                      return <img key={pIdx} src={part.value} className="max-h-8 object-contain" alt="logo footer" />;
                                                    }
                                                    return <span key={pIdx}>{part.value}</span>;
                                                  })
                                                : ""}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              } else {
                                return (
                                  <p key={elIdx} className="text-left text-[10px] text-slate-400 mt-1">
                                    {el.parts?.map((p: DocxPart) => p.value).join("")}
                                  </p>
                                );
                              }
                            })}
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                  {previewData.tipo === "PDF" && previewData.data.url && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA REAL DEL DOCUMENTO PDF (NATIVO)</p>
                      <div className="w-full h-[600px] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white">
                        <iframe src={`${previewData.data.url}#toolbar=0`} className="w-full h-full border-none" />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer del Modal */}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-xs cursor-pointer shadow-md"
              >
                Cerrar Previsualización
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
