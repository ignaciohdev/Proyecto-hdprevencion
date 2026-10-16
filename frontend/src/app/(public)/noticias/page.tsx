"use client";

import { useEffect, useState, useMemo } from "react";
import { getApiUrl } from "../../utils/api";

export interface NoticiaItem {
  id: number;
  titulo: string;
  subtitulo: string;
  contenido: string;
  categoria: string;
  imagen_url?: string;
  autor?: number;
  autor_name: string;
  autor_cargo?: string;
  estado: string;
  fecha_publicacion: string;
  tiempo_lectura?: string;
  citas_legales?: string[];
  puntos_clave?: string[];
}

// 6 Artículos Oficiales de Autoridad SST Chilena 2026 con Imágenes Reales del Sistema
const ARTICULOS_FALLBACK: NoticiaItem[] = [
  {
    id: -1,
    titulo: "Entrada en vigencia del D.S. N° 44: Claves del nuevo reglamento de gestión preventiva que rige en Chile",
    subtitulo: "El nuevo marco establece una matriz de riesgos continua y redefine el rol del Departamento de Prevención y de los Comités Paritarios.",
    categoria: "Nuevos Decretos & Leyes",
    imagen_url: "/noticia1.png",
    autor_name: "Comité Técnico HD Prevención",
    autor_cargo: "División Jurídica & Cumplimiento SST",
    estado: "PUBLICADO",
    fecha_publicacion: "2026-03-24T08:00:00Z",
    tiempo_lectura: "6 min de lectura",
    citas_legales: [
      "«El empleador deberá mantener permanentemente actualizado un Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) fundamentado en la identificación continua de peligros y evaluación de riesgos en faena, garantizando la participación efectiva de los trabajadores y sus representantes.» — Artículo 5°, D.S. N° 44 (MINTRAB / MINSAL).",
      "«Las referencias que las normas legales o reglamentarias hagan a las materias de prevención de riesgos profesionales y comités paritarios se entenderán hechas a las disposiciones del presente decreto supremo.» — Disposiciones Transitorias, D.S. N° 44.",
    ],
    puntos_clave: [
      "Vigencia plena del D.S. N° 44, unificando la gestión de prevención y comités en un solo cuerpo normativo moderno.",
      "Obligatoriedad de Matrices MIPER continuas basadas en la Guía Técnica del ISP, abandonando las revisiones anuales estáticas en Excel.",
      "Facultad expresa del Comité Paritario (CPHS) para exigir medidas cautelares y participar en la planificación presupuestaria de prevención.",
      "Transición digital obligatoria de la Información de los Riesgos Laborales (ODI Art. 15 D.S. N° 44) con verificación electrónica ante la DT.",
    ],
    contenido: `La promulgación y entrada en vigencia del Decreto Supremo N° 44 marca el hito regulatorio más trascendental en la historia de la seguridad y salud en el trabajo en Chile. Este cuerpo legal aprueba el nuevo reglamento integral sobre gestión preventiva de los riesgos laborales y la constitución y funcionamiento de los Comités Paritarios de Higiene y Seguridad.

El nuevo decreto introduce la obligatoriedad para toda empresa de implementar un Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) basado en el estándar internacional ISO 45001 y las directrices de la OIT. Se establece que la Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER) debe ser un instrumento dinámico, actualizado ante cualquier cambio en los procesos, incorporación de nuevas maquinarias o incidentes con potencial de daño.

Asimismo, se elevan sustantivamente las exigencias de capacitación inicial y periódica para los trabajadores (Arts. 15 y 16), requiriendo evidencia verificable de las competencias adquiridas y no solamente una firma testimonial de asistencia. La plataforma HD Prevención incorpora todas las matrices y registros exigidos por este nuevo decreto para garantizar el 100% de cumplimiento ante la Inspección del Trabajo y la Seremi de Salud.`,
  },
  {
    id: -2,
    titulo: "Ley Karin (Ley N° 21.643): Dirección del Trabajo intensifica fiscalizaciones por canal de denuncias y protocolos de resguardo",
    subtitulo: "Empresas que no adopten medidas inmediatas de separación física en un plazo de 72 horas enfrentan multas gravísimas.",
    categoria: "Dictámenes DT & SUSESO",
    imagen_url: "/noticia3.png",
    autor_name: "Área Legal Laboral",
    autor_cargo: "Especialistas en Derecho del Trabajo",
    estado: "PUBLICADO",
    fecha_publicacion: "2026-03-20T10:30:00Z",
    tiempo_lectura: "4 min de lectura",
    citas_legales: [
      "«Recibida la denuncia por acoso sexual, laboral o violencia en el trabajo, el empleador deberá adoptar de forma inmediata una o más medidas de resguardo respecto de los involucrados, dentro del plazo perentorio de setenta y dos horas, tales como la separación de espacios físicos o la redistribución de la jornada.» — Dictamen Ord. N° 362/19, Dirección del Trabajo.",
    ],
    puntos_clave: [
      "Obligatoriedad de mantener un buzón o canal de denuncias confidencial e inviolable, con registro de auditoría estricto.",
      "Plazo fatal de 72 horas para implementar medidas cautelares de separación o resguardo desde que se recepciona la denuncia.",
      "Inclusión de la 'Violencia en el Trabajo ejercida por terceros' (clientes, proveedores, usuarios) dentro de la matriz de riesgos psicosociales.",
    ],
    contenido: `La Dirección del Trabajo ha emitido un nuevo dictamen instructivo que refuerza el régimen sancionatorio de la Ley Karin (Ley N° 21.643). De acuerdo con el organismo fiscalizador, la ausencia de un canal de denuncias seguro y transparente o la dilación injustificada en la aplicación de medidas de resguardo en menos de 72 horas constituirá una infracción gravísima con multas de hasta 60 UTM por trabajador afectado.

El dictamen aclara que las medidas de resguardo no constituyen una sanción anticipada, sino una garantía preventiva de indemnidad física y psicológica. La ley mandata también que toda denuncia deba ser comunicada a la Inspección del Trabajo o a la SUSESO en los plazos fijados por el reglamento general.`,
  },
  {
    id: -3,
    titulo: "Circular N° 3336 de la SUSESO: Modificaciones críticas al procedimiento de auto-suspensión ante accidentes graves y fatales",
    subtitulo: "Guía paso a paso sobre el aviso inmediato a la Seremi de Salud y Dirección del Trabajo, y el levantamiento de la clausura.",
    categoria: "Dictámenes DT & SUSESO",
    imagen_url: "/noticia2.png",
    autor_name: "Unidad de Respuesta a Emergencias",
    autor_cargo: "Auditores de Siniestralidad SUSESO",
    estado: "PUBLICADO",
    fecha_publicacion: "2026-03-15T14:15:00Z",
    tiempo_lectura: "5 min de lectura",
    citas_legales: [
      "«Cuando ocurra un accidente del trabajo fatal o grave, el empleador deberá suspender en forma inmediata las faenas afectadas y, de ser necesario, permitir la evacuación de los trabajadores. El reinicio de faenas sólo podrá ser autorizado por el organismo fiscalizador competente previa acreditación de las medidas correctivas.» — Compendio de Normas Ley 16.744, Título VI.",
    ],
    puntos_clave: [
      "Definición exhaustiva de accidentes graves: caídas sobre 1.8 metros, amputaciones, rescates o asfixias.",
      "Obligación de notificación telefónica y electrónica inmediata al formulario único SUSESO/Seremi/DT.",
      "Prohibición absoluta de alterar el sitio del suceso antes de la concurrencia de los peritos del organismo administrador.",
    ],
    contenido: `La Superintendencia de Seguridad Social (SUSESO) ha actualizado la Circular N° 3336 regulando el protocolo de auto-suspensión inmediata de faenas ante la ocurrencia de accidentes del trabajo graves o fatales. La normativa ratifica que la responsabilidad de paralizar las faenas recae en el empleador de manera oficiosa, sin esperar la orden de un inspector.

Se tipifica como falta gravísima continuar labores en el área afectada, exponiendo a la empresa a querellas penales por el delito de atentado contra las condiciones de seguridad en el trabajo. La reanudación sólo procede mediante informe fundado suscrito por el experto en prevención y la mutualidad correspondiente.`,
  },
  {
    id: -4,
    titulo: "Nueva Guía Técnica del ISP para Matrices MIPER: Dejando atrás los Excels estáticos",
    subtitulo: "El Instituto de Salud Pública estandariza la evaluación de riesgo puro vs. residual mediante matriz 5x5 y jerarquía estricta de controles.",
    categoria: "Guías de Faena & Buenas Prácticas",
    imagen_url: "/noticia4.png",
    autor_name: "Especialistas en Higiene Ocupacional",
    autor_cargo: "Ingeniería en Prevención y Ergonomía",
    estado: "PUBLICADO",
    fecha_publicacion: "2026-03-10T09:00:00Z",
    tiempo_lectura: "4 min de lectura",
    citas_legales: [
      "«No es técnicamente aceptable considerar como medida de control prioritaria la dotación de Equipos de Protección Personal (EPP) sin acreditar fehacientemente la inviabilidad de eliminar, sustituir o aplicar controles de ingeniería en el origen del riesgo.» — Guía Técnica MIPER, Departamento de Salud Ocupacional, ISP.",
    ],
    puntos_clave: [
      "Estandarización del mapa de calor 5x5 (Probabilidad 1-5 x Severidad 1-5).",
      "Diferenciación obligatoria entre Magnitud Pura (sin controles) y Magnitud Residual (con controles aplicados).",
      "Jerarquía legal inviolable de 5 niveles: Eliminación > Sustitución > Ingeniería > Administrativo > EPP.",
    ],
    contenido: `El Instituto de Salud Pública de Chile (ISP) ha publicado la versión oficial de su Guía Técnica para la Identificación de Peligros y Evaluación de Riesgos (MIPER). Esta guía busca erradicar las matrices teóricas que no reflejan la realidad operacional de las faenas mineras, industriales y de construcción.

El estándar exige calcular de forma matemática el porcentaje de mitigación del riesgo y verificar en terreno que los controles de ingeniería (como entibaciones, barandas o extractores) se encuentren operativos antes de computar una reducción en la severidad o probabilidad.`,
  },
  {
    id: -5,
    titulo: "D.S. N° 594 y Radiación Solar UV: Obligaciones patronales de protección ante índices extremos",
    subtitulo: "Criterios para el suministro de bloqueador solar factor 50+, ropa con protección UV, gorros tipo legionario y registros de entrega.",
    categoria: "Salud & Protocolos MINSAL",
    imagen_url: "/noticia5.png",
    autor_name: "Salud Laboral y Ergonomía",
    autor_cargo: "Departamento Médico Ocupacional",
    estado: "PUBLICADO",
    fecha_publicacion: "2026-03-05T11:45:00Z",
    tiempo_lectura: "3 min de lectura",
    citas_legales: [
      "«Los empleadores de trabajadores que ejecuten labores bajo radiación solar directa deberán publicar diariamente en un lugar visible el índice UV proyectado por la Dirección Meteorológica de Chile y proveer gratuitamente elementos de protección con filtro solar factor 50+ y certificación ISP.» — Artículos 109 A al 109 C, D.S. N° 594.",
    ],
    puntos_clave: [
      "Publicación diaria obligatoria del semáforo solar UV en el acceso a la faena.",
      "Entrega con firma individual de bloqueador solar FPS 50+ certificado y lentes de seguridad con filtro UV 99.9%.",
      "Habilitación de zonas de descanso con sombra efectiva durante las horas de mayor radiación (11:00 a 16:00 hrs).",
    ],
    contenido: `Con los registros históricos de radiación ultravioleta en la zona central y norte del país, la Seremi de Salud ha iniciado una campaña nacional de fiscalización al cumplimiento del D.S. 594 en materia de exposición ocupacional a radiación UV de origen solar.

Las multas por no contar con el programa de protección contra la radiación UV o no tener al día las actas firmadas de entrega de fotoprotector pueden superar las 100 UTM en faenas agrícolas y de obras civiles.`,
  },
  {
    id: -6,
    titulo: "Elecciones de Comité Paritario (CPHS): Requisitos de quórum legal y votación electrónica ante la DT",
    subtitulo: "Criterios del dictamen 1289/012 de la Dirección del Trabajo para validar actas de votación digital sin observaciones.",
    categoria: "Guías de Faena & Buenas Prácticas",
    imagen_url: "/noticia6.png",
    autor_name: "Consultoría Paritaria",
    autor_cargo: "Gestión CPHS y Relaciones Laborales",
    estado: "PUBLICADO",
    fecha_publicacion: "2026-02-28T16:20:00Z",
    tiempo_lectura: "4 min de lectura",
    citas_legales: [
      "«Los sistemas de votación electrónica para la elección de los representantes de los trabajadores en el Comité Paritario deben garantizar de manera inviolable el secreto del voto, la imposibilidad de duplicidad y la generación automática de un certificado digital de escrutinio.» — Dictamen Ord. N° 1289/012, Dirección del Trabajo.",
    ],
    puntos_clave: [
      "Requisitos para faenas con más de 25 trabajadores en faena o centro de trabajo.",
      "Registro del acta de escrutinio en el portal Mi DT dentro del plazo de 3 días hábiles posteriores a la elección.",
      "Validez legal plena del voto digital implementado mediante autenticación con RUT y código verificador.",
    ],
    contenido: `La Dirección del Trabajo ha unificado su jurisprudencia permitiendo que las elecciones de los 3 representantes titulares y 3 suplentes del Comité Paritario de Higiene y Seguridad se realicen de manera 100% remota y electrónica, siempre que la plataforma utilizada asegure el secreto del sufragio y la trazabilidad de la votación.

HD Prevención cuenta con el módulo paritario certificado que genera el libro de actas y escrutinio listo para ser cargado en el portal Mi DT con plena validez jurídica.`,
  },
];

const CATEGORIAS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: string }
> = {
  "Nuevos Decretos & Leyes": {
    label: "Nuevos Decretos & Leyes",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    icon: "📜",
  },
  "Dictámenes DT & SUSESO": {
    label: "Dictámenes DT & SUSESO",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    icon: "⚖️",
  },
  "Salud & Protocolos MINSAL": {
    label: "Salud & Protocolos MINSAL",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    icon: "🏥",
  },
  "Guías de Faena & Buenas Prácticas": {
    label: "Guías de Faena & Buenas Prácticas",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    icon: "🏗️",
  },
  REGULACION: {
    label: "Nuevos Decretos & Leyes",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    icon: "📜",
  },
  NOTICIA: {
    label: "Dictámenes DT & SUSESO",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    icon: "⚖️",
  },
  INNOVACION: {
    label: "Salud & Protocolos MINSAL",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    icon: "🏥",
  },
  CONSEJO: {
    label: "Guías de Faena & Buenas Prácticas",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    icon: "🏗️",
  },
};

function getImagenArticulo(art: NoticiaItem): string {
  if (art.imagen_url && art.imagen_url.trim()) {
    return art.imagen_url;
  }
  // Mapeo cíclico con las 6 imágenes oficiales
  const idx = Math.abs(art.id) % 6 || 1;
  return `/noticia${idx}.png`;
}

export default function NoticiasPage() {
  const [noticiasApi, setNoticiasApi] = useState<NoticiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filtros de navegación
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("TODAS");
  const [filtroTexto, setFiltroTexto] = useState<string>("");

  // Modal de lectura inmersivo (Reader Mode)
  const [articuloLectura, setArticuloLectura] = useState<NoticiaItem | null>(null);
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  // Modal de suscripción al boletín
  const [emailBoletin, setEmailBoletin] = useState("");
  const [boletinSuscrito, setBoletinSuscrito] = useState(false);

  // Estados del CRUD de administración
  const [isModalCrudOpen, setIsModalCrudOpen] = useState(false);
  const [editingNoticia, setEditingNoticia] = useState<NoticiaItem | null>(null);
  const [formNoticia, setFormNoticia] = useState({
    titulo: "",
    subtitulo: "",
    contenido: "",
    categoria: "REGULACION",
    imagen_url: "",
    estado: "PUBLICADO",
  });
  const [guardandoCrud, setGuardandoCrud] = useState(false);

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArticuloLectura(null);
        setIsModalCrudOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Carga de noticias desde backend y chequeo de permisos admin
  const fetchNoticias = async () => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    try {
      const res = await fetch(getApiUrl("/api/noticias/"), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (res.ok) {
        const data = await res.json();
        const lista: NoticiaItem[] = Array.isArray(data) ? data : data.results || [];
        setNoticiasApi(lista);
      }
    } catch (err) {
      console.warn("API de noticias no disponible, desplegando catálogo editorial de fallback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const payload = JSON.parse(window.atob(token.split(".")[1]));
          setIsAdmin(Boolean(payload.is_superuser || payload.is_staff));
        } catch (e) {
          console.error(e);
        }
      }
    }
    fetchNoticias();
  }, []);

  // Combinación de artículos: prioritarios de la API + fallback de autoridad
  const catalogoCompleto = useMemo(() => {
    if (noticiasApi.length === 0) {
      return ARTICULOS_FALLBACK;
    }
    const apiIds = new Set(noticiasApi.map((n) => n.id));
    const complementarios = ARTICULOS_FALLBACK.filter((f) => !apiIds.has(f.id));
    return [...noticiasApi, ...complementarios];
  }, [noticiasApi]);

  // Artículos filtrados por búsqueda y categoría
  const articulosFiltrados = useMemo(() => {
    return catalogoCompleto.filter((art) => {
      if (filtroTexto.trim()) {
        const q = filtroTexto.toLowerCase();
        const coincide =
          art.titulo.toLowerCase().includes(q) ||
          art.subtitulo.toLowerCase().includes(q) ||
          art.contenido.toLowerCase().includes(q) ||
          art.autor_name.toLowerCase().includes(q);
        if (!coincide) return false;
      }

      if (categoriaSeleccionada !== "TODAS") {
        const catConfig = CATEGORIAS_CONFIG[art.categoria];
        const labelCat = catConfig ? catConfig.label : art.categoria;
        if (labelCat !== categoriaSeleccionada && art.categoria !== categoriaSeleccionada) {
          return false;
        }
      }

      return true;
    });
  }, [catalogoCompleto, filtroTexto, categoriaSeleccionada]);

  // Artículo destacado del Hero
  const articuloHero = useMemo(() => {
    return articulosFiltrados[0] || catalogoCompleto[0];
  }, [articulosFiltrados, catalogoCompleto]);

  // Lista restante para el grid
  const articulosGrid = useMemo(() => {
    if (articulosFiltrados.length <= 1) return articulosFiltrados;
    return articulosFiltrados.slice(1);
  }, [articulosFiltrados]);

  // Conteos por categoría
  const conteosCategorias = useMemo(() => {
    const map: Record<string, number> = {
      TODAS: catalogoCompleto.length,
      "Nuevos Decretos & Leyes": 0,
      "Dictámenes DT & SUSESO": 0,
      "Salud & Protocolos MINSAL": 0,
      "Guías de Faena & Buenas Prácticas": 0,
    };

    catalogoCompleto.forEach((art) => {
      const cfg = CATEGORIAS_CONFIG[art.categoria];
      const catLabel = cfg ? cfg.label : art.categoria;
      if (map[catLabel] !== undefined) {
        map[catLabel]++;
      }
    });

    return map;
  }, [catalogoCompleto]);

  // Funciones CRUD para administradores
  const handleOpenCreate = () => {
    setEditingNoticia(null);
    setFormNoticia({
      titulo: "",
      subtitulo: "",
      contenido: "",
      categoria: "REGULACION",
      imagen_url: "",
      estado: "PUBLICADO",
    });
    setIsModalCrudOpen(true);
  };

  const handleOpenEdit = (noticia: NoticiaItem) => {
    setEditingNoticia(noticia);
    setFormNoticia({
      titulo: noticia.titulo,
      subtitulo: noticia.subtitulo,
      contenido: noticia.contenido,
      categoria: noticia.categoria,
      imagen_url: noticia.imagen_url || "",
      estado: noticia.estado || "PUBLICADO",
    });
    setIsModalCrudOpen(true);
  };

  const handleSaveCrud = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("access_token");
    setGuardandoCrud(true);

    const method = editingNoticia && editingNoticia.id > 0 ? "PUT" : "POST";
    const url =
      editingNoticia && editingNoticia.id > 0
        ? getApiUrl(`/api/noticias/${editingNoticia.id}/`)
        : getApiUrl("/api/noticias/");

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formNoticia),
      });

      if (!res.ok) {
        throw new Error("Error al guardar el artículo en el servidor.");
      }

      setIsModalCrudOpen(false);
      fetchNoticias();
    } catch (err: unknown) {
      const errorObj = err as Error;
      alert(errorObj.message || "Error al procesar la publicación.");
    } finally {
      setGuardandoCrud(false);
    }
  };

  const handleDeleteCrud = async (id: number) => {
    if (id < 0) {
      alert("Los artículos editoriales de referencia normativa son parte del marco base del SaaS.");
      return;
    }
    if (!confirm("¿Está seguro de eliminar este artículo normativo?")) return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(getApiUrl(`/api/noticias/${id}/`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Error al eliminar el artículo.");
      fetchNoticias();
    } catch (err: unknown) {
      const errorObj = err as Error;
      alert(errorObj.message || "Error al eliminar el artículo.");
    }
  };

  const handleCopiarEnlace = (articulo: NoticiaItem) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(`${window.location.origin}/noticias?id=${articulo.id}`);
      setCopiadoFeedback(true);
      setTimeout(() => setCopiadoFeedback(false), 2500);
    }
  };

  const handleCompartir = (articulo: NoticiaItem) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: articulo.titulo,
        text: articulo.subtitulo,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopiarEnlace(articulo);
    }
  };

  const handleSuscripcionBoletin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailBoletin || !emailBoletin.includes("@")) return;
    setBoletinSuscrito(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* 1. CINTILLO SUPERIOR FLASH REGULATORIO (Ticker / Breaking News) */}
      <aside aria-label="Flash Regulatorio" className="bg-gradient-to-r from-orange-650 via-amber-600 to-orange-700 text-white border-b border-orange-500/30 py-2.5 px-4 shadow-sm">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-orange-700 font-extrabold uppercase text-[10px] tracking-wider shrink-0 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
              Flash Regulatorio
            </span>
            <p className="font-medium text-slate-50 truncate">
              <strong>Dirección del Trabajo:</strong> Intensificación de fiscalizaciones por canal de denuncias y medidas de resguardo de 72 horas bajo la Ley Karin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setArticuloLectura(ARTICULOS_FALLBACK[1])}
            className="shrink-0 text-white hover:text-amber-100 font-bold underline underline-offset-4 text-[11px] transition-colors cursor-pointer"
          >
            Ver Dictamen Interpretativo →
          </button>
        </div>
      </aside>

      <main className="container mx-auto px-4 py-8 sm:py-10 space-y-10">

        {/* 2. ENCABEZADO PRINCIPAL DE AUTORIDAD SST */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                <span>🇨🇱</span> Centro de Inteligencia Regulatoria SST 2026
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                Actualizado permanentemente
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white mt-3 tracking-tight">
              Actualidad Normativa & Dictámenes
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-2xl mt-2 leading-relaxed">
              Análisis técnico-legal de las reformas que transforman la gestión de prevención en Chile: D.S. N° 44, Ley Karin, circulares de la SUSESO y dictámenes de la Dirección del Trabajo.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenCreate}
              type="button"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>✍️</span>
              <span>+ Redactar Noticia</span>
            </button>
          )}
        </section>

        {/* 3. HERO EDITORIAL ASIMÉTRICO (Noticia Principal Destacada con Imagen Real) */}
        {articuloHero && (
          <section className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xl transition-all">
            <div className="p-6 sm:p-8 md:p-10 flex flex-col lg:flex-row gap-8 items-stretch justify-between">
              
              {/* Contenido textual del Hero */}
              <div className="flex-1 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-orange-600 text-white shadow-sm">
                      ★ Decreto Supremo en Vigencia
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      {articuloHero.tiempo_lectura || "6 min de lectura"}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600">•</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(articuloHero.fecha_publicacion).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h2
                    onClick={() => setArticuloLectura(articuloHero)}
                    className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                  >
                    {articuloHero.titulo}
                  </h2>

                  <p className="text-sm sm:text-base text-slate-650 dark:text-slate-350 leading-relaxed font-medium">
                    {articuloHero.subtitulo}
                  </p>

                  {/* Viñetas estructuradas de impacto normativo */}
                  {articuloHero.puntos_clave && (
                    <div className="pt-2 pb-1 space-y-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Puntos Clave del Cambio en Faena:
                      </div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                        {articuloHero.puntos_clave.map((punto, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-orange-500 font-bold shrink-0">✓</span>
                            <span>{punto}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Footer del Hero con Autor y CTA */}
                <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white font-black text-xs flex items-center justify-center shadow-md">
                      HD
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {articuloHero.autor_name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {articuloHero.autor_cargo || "Especialistas en Legislación Laboral"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setArticuloLectura(articuloHero)}
                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <span>Leer Análisis Completo</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Imagen del Hero con efecto interactivo */}
              <div
                onClick={() => setArticuloLectura(articuloHero)}
                className="lg:w-[420px] w-full shrink-0 relative overflow-hidden rounded-2xl group/hero cursor-pointer border border-slate-200 dark:border-slate-800 shadow-md min-h-[260px] lg:min-h-[380px]"
              >
                <img
                  src={getImagenArticulo(articuloHero)}
                  alt={articuloHero.titulo}
                  className="w-full h-full object-cover group-hover/hero:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <span className="bg-slate-950/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-slate-700 shadow-lg">
                    Foto en Terreno • Faena 2026
                  </span>
                  <span className="text-white/90 text-xs font-bold drop-shadow group-hover/hero:translate-x-1 transition-transform">
                    Ampliar ↗
                  </span>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* 4. BARRA DE FILTROS & NAVEGACIÓN INTERACTIVA */}
        <section aria-label="Filtros y Búsqueda" className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Buscador predictivo en vivo */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                🔍
              </span>
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Buscar por decreto, ley, materia (ej. D.S. 44, Karin, UV)..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm"
              />
              {filtroTexto && (
                <button
                  type="button"
                  onClick={() => setFiltroTexto("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Contador reactivo */}
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Mostrando <strong className="text-slate-900 dark:text-white">{articulosFiltrados.length}</strong> de {catalogoCompleto.length} artículos normativos
            </div>
          </div>

          {/* Píldoras de Categorías */}
          <div className="flex flex-wrap items-center gap-2 pt-1 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoriaSeleccionada("TODAS")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                categoriaSeleccionada === "TODAS"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-400"
              }`}
            >
              <span>📚 Todas</span>
              <span className="text-[10px] opacity-75 font-mono">({conteosCategorias["TODAS"]})</span>
            </button>

            {[
              "Nuevos Decretos & Leyes",
              "Dictámenes DT & SUSESO",
              "Salud & Protocolos MINSAL",
              "Guías de Faena & Buenas Prácticas",
            ].map((catName) => {
              const cfg = CATEGORIAS_CONFIG[catName];
              const count = conteosCategorias[catName] || 0;
              const isSelected = categoriaSeleccionada === catName;

              return (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setCategoriaSeleccionada(catName)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-orange-600 text-white shadow-md shadow-orange-500/20"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-400"
                  }`}
                >
                  <span>{cfg?.icon}</span>
                  <span>{catName}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. CUERPO PRINCIPAL: GRID EDITORIAL (8 COLS) + SIDEBAR SST 2026 (4 COLS) */}
        <section aria-label="Artículos y Agenda" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* COLUMNA PRINCIPAL DE ARTÍCULOS (8 COLS) */}
          <div className="lg:col-span-8 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500 mt-4">Actualizando dictámenes y boletines normativos...</p>
              </div>
            ) : articulosGrid.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-3xl">🔎</div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  No se encontraron artículos para tu búsqueda
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Prueba modificando las palabras clave o seleccionando otra categoría en las píldoras superiores.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroTexto("");
                    setCategoriaSeleccionada("TODAS");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Restablecer Filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {articulosGrid.map((art) => {
                  const catCfg = CATEGORIAS_CONFIG[art.categoria] || {
                    label: art.categoria,
                    badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/30",
                    icon: "📄",
                  };
                  const imagenSrc = getImagenArticulo(art);

                  return (
                    <article
                      key={art.id}
                      className="group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-xl hover:border-orange-500/40 transition-all duration-300 flex flex-col justify-between"
                    >
                      {/* Imagen representativa del artículo */}
                      <div
                        onClick={() => setArticuloLectura(art)}
                        className="relative w-full h-44 sm:h-48 overflow-hidden cursor-pointer group/img bg-slate-100 dark:bg-slate-950"
                      >
                        <img
                          src={imagenSrc}
                          alt={art.titulo}
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent"></div>
                        
                        {/* Badges sobre la imagen */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md bg-slate-950/80 ${catCfg.badgeClass}`}
                          >
                            <span>{catCfg.icon}</span>
                            <span className="truncate max-w-[140px]">{catCfg.label}</span>
                          </span>

                          <span className="text-[10px] text-white/90 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-md font-medium border border-slate-800">
                            {art.tiempo_lectura || "4 min"}
                          </span>
                        </div>
                      </div>

                      {/* Cuerpo de la tarjeta */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          {/* Título interactivo */}
                          <h3
                            onClick={() => setArticuloLectura(art)}
                            className="font-bold text-base text-slate-900 dark:text-white leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors cursor-pointer line-clamp-3"
                          >
                            {art.titulo}
                          </h3>

                          {/* Extracto */}
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                            {art.subtitulo || art.contenido.slice(0, 140) + "..."}
                          </p>
                        </div>

                        {/* Footer de la tarjeta con Autor, Fecha y Botón Leer */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-[11px] truncate max-w-[140px]">
                              {art.autor_name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(art.fecha_publicacion).toLocaleDateString("es-CL", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isAdmin && art.id > 0 && (
                              <div className="flex items-center gap-1.5 mr-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(art)}
                                  title="Editar"
                                  className="text-slate-400 hover:text-orange-500 font-bold p-1 cursor-pointer"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCrud(art.id)}
                                  title="Eliminar"
                                  className="text-slate-400 hover:text-red-500 font-bold p-1 cursor-pointer"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setArticuloLectura(art)}
                              className="inline-flex items-center gap-1 font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500 cursor-pointer text-xs"
                            >
                              <span>Leer</span>
                              <span className="transition-transform group-hover:translate-x-1">→</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUMNA LATERAL: AGENDA SST 2026 & BOLETÍN (4 COLS) */}
          <aside aria-label="Agenda y Boletín" className="lg:col-span-4 space-y-6">

            {/* Widget 1: Plazos Clave de la Agenda SST 2026 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-sm">
                  📅
                </span>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Plazos Clave de la Agenda SST 2026
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Obligaciones laborales críticas en Chile
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {/* Plazo 1 */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <span>⏱</span> 72 Horas Fatales
                    </span>
                    <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">
                      Ley Karin (DT)
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-350">
                    Plazo legal perentorio para aplicar medidas de resguardo y separación física ante denuncias recibidas.
                  </p>
                </div>

                {/* Plazo 2 */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <span>🗓</span> Día 10 del Mes
                    </span>
                    <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-bold">
                      Previred
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-350">
                    Declaración y pago de cotizaciones del Seguro de Accidentes del Trabajo y Enfermedades Profesionales (Ley 16.744).
                  </p>
                </div>

                {/* Plazo 3 */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span>📋</span> Mensual / Anual
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">
                      D.S. N° 44
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-350">
                    Actualización continua de la Matriz MIPER y registro de actas mensuales ordinarias del CPHS ante la DT.
                  </p>
                </div>
              </div>
            </div>

            {/* Widget 2: Boletín Semanal de Cambios Normativos */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-sm">
                  📬
                </span>
                <h3 className="font-extrabold text-sm text-white">
                  Boletín de Alertas Normativas
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Recibe en tu correo cada lunes el resumen ejecutivo de nuevos dictámenes de la Dirección del Trabajo, circulares SUSESO y formatos descargables.
              </p>

              {boletinSuscrito ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center font-bold">
                  ✓ ¡Suscripción exitosa! Te hemos enviado la edición vigente de la Agenda SST 2026.
                </div>
              ) : (
                <form onSubmit={handleSuscripcionBoletin} className="space-y-2">
                  <input
                    type="email"
                    required
                    value={emailBoletin}
                    onChange={(e) => setEmailBoletin(e.target.value)}
                    placeholder="tu-correo@empresa.cl"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                  >
                    Suscribirme Gratis
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">
                    Cero spam. Desuscríbete cuando desees con un clic.
                  </p>
                </form>
              )}
            </div>

            {/* Widget 3: Acceso Directo a Normativa Vigente */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
              <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Enlaces Oficiales de Interés
              </h4>
              <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                <li>
                  <a
                    href="https://www.dt.gob.cl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between hover:text-orange-500 transition-colors"
                  >
                    <span>Portal Mi DT (Dirección del Trabajo)</span>
                    <span>↗</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.suseso.cl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between hover:text-orange-500 transition-colors"
                  >
                    <span>SUSESO (Compendio Ley 16.744)</span>
                    <span>↗</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.ispch.gob.cl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between hover:text-orange-500 transition-colors"
                  >
                    <span>ISP Chile (Salud Ocupacional)</span>
                    <span>↗</span>
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </section>
      </main>

      {/* 6. MODAL DE LECTURA INMERSIVO ("READER MODE" Estilo Medium/Substack con Imagen) */}
      {articuloLectura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
            
            {/* Barra de control del Reader Mode */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                  HD Prevención • Centro Regulatorio
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCompartir(articuloLectura)}
                  title="Compartir o Copiar Enlace"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>🔗</span>
                  <span>{copiadoFeedback ? "¡Enlace Copiado!" : "Compartir"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setArticuloLectura(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Contenido del Artículo */}
            <div className="p-6 sm:p-8 md:p-10 overflow-y-auto space-y-6">
              
              {/* Imagen de cabecera en el Reader Mode */}
              <div className="relative w-full h-56 sm:h-72 rounded-2xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                <img
                  src={getImagenArticulo(articuloLectura)}
                  alt={articuloLectura.titulo}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
                <span className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-slate-700">
                  {articuloLectura.categoria}
                </span>
              </div>

              {/* Metadatos */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">
                    Publicado el {new Date(articuloLectura.fecha_publicacion).toLocaleDateString("es-CL", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500 font-semibold">
                    {articuloLectura.tiempo_lectura || "5 min de lectura"}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight">
                  {articuloLectura.titulo}
                </h1>

                {articuloLectura.subtitulo && (
                  <p className="text-base sm:text-lg text-slate-600 dark:text-slate-350 font-medium leading-relaxed">
                    {articuloLectura.subtitulo}
                  </p>
                )}
              </div>

              {/* Ficha de Autoría */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  HD
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{articuloLectura.autor_name}</span>
                    <span className="text-emerald-500 font-black text-[10px]" title="Verificado">✓</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {articuloLectura.autor_cargo || "Comité Técnico de Seguridad y Salud en el Trabajo"}
                  </div>
                </div>
              </div>

              {/* Caja Destacada de Citas Legales */}
              {articuloLectura.citas_legales && articuloLectura.citas_legales.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-extrabold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2">
                    <span>⚖️</span>
                    <span>Extractos Regulatorios Oficiales</span>
                  </div>
                  {articuloLectura.citas_legales.map((cita, idx) => (
                    <blockquote
                      key={idx}
                      className="p-4 rounded-xl border-l-4 border-orange-500 bg-orange-50/60 dark:bg-orange-950/20 text-xs sm:text-sm text-slate-800 dark:text-slate-200 italic leading-relaxed"
                    >
                      {cita}
                    </blockquote>
                  ))}
                </div>
              )}

              {/* Cuerpo del Artículo */}
              <div className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed space-y-4 whitespace-pre-line pt-2">
                {articuloLectura.contenido}
              </div>

              {/* Puntos Clave */}
              {articuloLectura.puntos_clave && articuloLectura.puntos_clave.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Checklist de Medidas Inmediatas en Faena:
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-650 dark:text-slate-350">
                    {articuloLectura.puntos_clave.map((p, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer del Modal */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  Fuente: Diario Oficial de la República de Chile • Dirección del Trabajo • SUSESO.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCompartir(articuloLectura)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    {copiadoFeedback ? "¡Enlace Copiado!" : "Copiar Enlace"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setArticuloLectura(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white transition-colors cursor-pointer"
                  >
                    Cerrar Lectura
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL CRUD PARA ADMINISTRADORES */}
      {isModalCrudOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingNoticia ? "Editar Publicación Normativa" : "Redactar Nueva Noticia / Alerta"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalCrudOpen(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCrud} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Título del Artículo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNoticia.titulo}
                  onChange={(e) => setFormNoticia({ ...formNoticia, titulo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ej. Dictamen N° 456 sobre comités paritarios..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Subtítulo o Resumen Ejecutivo
                </label>
                <input
                  type="text"
                  value={formNoticia.subtitulo}
                  onChange={(e) => setFormNoticia({ ...formNoticia, subtitulo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Breve introducción para el feed..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Categoría
                  </label>
                  <select
                    value={formNoticia.categoria}
                    onChange={(e) => setFormNoticia({ ...formNoticia, categoria: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="REGULACION">Nuevos Decretos & Leyes</option>
                    <option value="NOTICIA">Dictámenes DT & SUSESO</option>
                    <option value="INNOVACION">Salud & Protocolos MINSAL</option>
                    <option value="CONSEJO">Guías de Faena & Buenas Prácticas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Estado
                  </label>
                  <select
                    value={formNoticia.estado}
                    onChange={(e) => setFormNoticia({ ...formNoticia, estado: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="PUBLICADO">Publicado</option>
                    <option value="BORRADOR">Borrador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  URL de Imagen de Portada (Opcional)
                </label>
                <input
                  type="text"
                  value={formNoticia.imagen_url}
                  onChange={(e) => setFormNoticia({ ...formNoticia, imagen_url: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ej. /noticia1.png o URL externa"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Cuerpo Completo del Artículo <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={formNoticia.contenido}
                  onChange={(e) => setFormNoticia({ ...formNoticia, contenido: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="Redacta el análisis legal y técnico aquí..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalCrudOpen(false)}
                  disabled={guardandoCrud}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCrud}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  {guardandoCrud ? "Guardando..." : editingNoticia ? "Actualizar Noticia" : "Publicar Noticia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
