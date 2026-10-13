import { useState, useEffect, useMemo, useCallback } from "react";
import { authFetch } from "../../../../utils/api";
import {
  ReporteRiesgo,
  FormCrearReporte,
  MetricasReportes,
  calcularMatrizRiesgo,
  getEstadoPlazoLegal,
} from "../types";

export function useReportesRiesgo() {
  const [reportes, setReportes] = useState<ReporteRiesgo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroPeligro, setFiltroPeligro] = useState<string>("TODOS");
  const [filtroGravedad, setFiltroGravedad] = useState<string>("TODOS");
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroPlazo, setFiltroPlazo] = useState<string>("TODOS");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("TODAS");
  const [filtroFaena, setFiltroFaena] = useState<string>("TODAS");

  // Ordenamiento y Paginación
  const [orden, setOrden] = useState<"FECHA_DESC" | "FECHA_ASC" | "CRITICIDAD_DESC">("FECHA_DESC");
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(12);

  // Carga de reportes desde el backend vía authFetch
  const fetchReportes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/reportes-riesgo/");
      if (!res.ok) throw new Error("Error al obtener la bitácora de inspecciones y hallazgos.");
      const data: ReporteRiesgo[] = await res.json();
      setReportes(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar los hallazgos en terreno.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportes();
  }, [fetchReportes]);

  // Empresas y Faenas únicas extraídas de los datos para selectores
  const empresasUnicas = useMemo(() => {
    const set = new Set<string>();
    reportes.forEach((r) => {
      if (r.empresa_faena) set.add(r.empresa_faena.trim());
    });
    return Array.from(set).sort();
  }, [reportes]);

  const faenasUnicas = useMemo(() => {
    const set = new Set<string>();
    reportes.forEach((r) => {
      if (r.area_puesto) set.add(r.area_puesto.trim());
    });
    return Array.from(set).sort();
  }, [reportes]);

  // Filtrado reactivo en memoria
  const reportesFiltrados = useMemo(() => {
    let result = reportes.filter((r) => {
      // 1. Búsqueda por texto libre
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

      // 2. Filtro Tipo (CONDICION / ACTO)
      if (filtroTipo !== "TODOS" && r.tipo !== filtroTipo) return false;

      // 3. Filtro Peligro Normativo
      if (filtroPeligro !== "TODOS" && r.clasificacion_peligro !== filtroPeligro) return false;

      // 4. Filtro Gravedad / Nivel de Riesgo
      if (filtroGravedad !== "TODOS") {
        if (filtroGravedad === "CRITICO" && r.gravedad !== "CRITICO" && r.nivel_riesgo_calculado !== "CRITICO") return false;
        if (filtroGravedad === "ALTO" && r.gravedad !== "ALTO" && r.nivel_riesgo_calculado !== "ALTO") return false;
        if (filtroGravedad === "MEDIO" && r.gravedad !== "MEDIO" && r.nivel_riesgo_calculado !== "MEDIO") return false;
        if (filtroGravedad === "BAJO" && r.gravedad !== "BAJO" && r.nivel_riesgo_calculado !== "BAJO") return false;
      }

      // 5. Filtro Estado (ABIERTO / EN_PROCESO / RESUELTO)
      if (filtroEstado !== "TODOS" && r.estado !== filtroEstado) return false;

      // 6. Filtro Semáforo de Plazo Legal
      if (filtroPlazo !== "TODOS") {
        const plazo = getEstadoPlazoLegal(r.fecha_limite, r.estado);
        if (filtroPlazo === "VENCIDO" && plazo.estado !== "VENCIDO") return false;
        if (filtroPlazo === "POR_VENCER" && plazo.estado !== "POR_VENCER" && plazo.estado !== "VENCE_HOY") return false;
        if (filtroPlazo === "EN_PLAZO" && plazo.estado !== "EN_PLAZO") return false;
        if (filtroPlazo === "RESUELTO" && r.estado !== "RESUELTO") return false;
      }

      // 7. Filtro Empresa
      if (filtroEmpresa !== "TODAS" && (r.empresa_faena || "").trim() !== filtroEmpresa) return false;

      // 8. Filtro Faena / Área
      if (filtroFaena !== "TODAS" && (r.area_puesto || "").trim() !== filtroFaena) return false;

      return true;
    });

    // Ordenamiento
    result = [...result].sort((a, b) => {
      if (orden === "FECHA_ASC") {
        return new Date(a.fecha_creacion).getTime() - new Date(b.fecha_creacion).getTime();
      }
      if (orden === "CRITICIDAD_DESC") {
        const scoreA = (a.probabilidad || 2) * (a.severidad || 2);
        const scoreB = (b.probabilidad || 2) * (b.severidad || 2);
        return scoreB - scoreA;
      }
      // Default: FECHA_DESC
      return new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime();
    });

    return result;
  }, [
    reportes,
    busqueda,
    filtroTipo,
    filtroPeligro,
    filtroGravedad,
    filtroEstado,
    filtroPlazo,
    filtroEmpresa,
    filtroFaena,
    orden,
  ]);

  // Paginación
  const totalPaginas = Math.ceil(reportesFiltrados.length / itemsPorPagina) || 1;
  const reportesPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    return reportesFiltrados.slice(inicio, inicio + itemsPorPagina);
  }, [reportesFiltrados, paginaActual, itemsPorPagina]);

  const cambiarPagina = (pagina: number) => {
    if (pagina >= 1 && pagina <= totalPaginas) {
      setPaginaActual(pagina);
    }
  };

  // Reset de página al cambiar filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroTipo, filtroPeligro, filtroGravedad, filtroEstado, filtroPlazo, filtroEmpresa, filtroFaena]);

  // Cálculo de estadísticas resumidas
  const metricas: MetricasReportes = useMemo(() => {
    const total = reportes.length;
    const abiertos = reportes.filter((r) => r.estado !== "RESUELTO").length;
    const resueltos = reportes.filter((r) => r.estado === "RESUELTO").length;
    const criticosOAltos = reportes.filter(
      (r) =>
        (r.gravedad === "CRITICO" ||
          r.gravedad === "ALTO" ||
          r.nivel_riesgo_calculado === "CRITICO" ||
          r.nivel_riesgo_calculado === "ALTO") &&
        r.estado !== "RESUELTO"
    ).length;

    const vencidos = reportes.filter((r) => {
      if (r.estado === "RESUELTO") return false;
      return getEstadoPlazoLegal(r.fecha_limite, r.estado).estado === "VENCIDO";
    }).length;

    // Resueltos en el mes actual
    const mesActual = new Date().getMonth();
    const añoActual = new Date().getFullYear();
    const resueltosMes = reportes.filter((r) => {
      if (r.estado !== "RESUELTO" || !r.fecha_resolucion) return false;
      const f = new Date(r.fecha_resolucion);
      return f.getMonth() === mesActual && f.getFullYear() === añoActual;
    }).length;

    return { total, abiertos, resueltos, criticosOAltos, vencidos, resueltosMes };
  }, [reportes]);

  // 1. Mutación: Crear Reporte
  const crearReporte = async (form: FormCrearReporte): Promise<{ success: boolean; error?: string }> => {
    const matriz = calcularMatrizRiesgo(form.probabilidad, form.severidad);
    const payload = {
      ...form,
      nivel_riesgo_calculado: matriz.nivel,
      gravedad: matriz.nivel,
      fecha_limite: form.fecha_limite || null,
      lugar: form.lugar || form.area_puesto || "Terreno General",
    };

    try {
      const res = await authFetch("/api/reportes-riesgo/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "No se pudo registrar el hallazgo técnico en el servidor.");
      }

      await fetchReportes();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar el reporte.";
      return { success: false, error: msg };
    }
  };

  // 2. Mutación: Resolver / Cerrar Reporte
  const resolverReporte = async (
    id: number,
    medidaCorrectiva: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/reportes-riesgo/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "RESUELTO",
          medida_correctiva: medidaCorrectiva,
          fecha_resolucion: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error("No se pudo registrar la subsanación del hallazgo.");

      await fetchReportes();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cerrar el hallazgo.";
      return { success: false, error: msg };
    }
  };

  // 3. Mutación: Eliminar Reporte
  const eliminarReporte = async (id: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/reportes-riesgo/${id}/`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("No se pudo eliminar el reporte.");

      await fetchReportes();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar el reporte.";
      return { success: false, error: msg };
    }
  };

  // Restablecer filtros a valores iniciales
  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroTipo("TODOS");
    setFiltroPeligro("TODOS");
    setFiltroGravedad("TODOS");
    setFiltroEstado("TODOS");
    setFiltroPlazo("TODOS");
    setFiltroEmpresa("TODAS");
    setFiltroFaena("TODAS");
    setPaginaActual(1);
  };

  return {
    reportes,
    reportesFiltrados,
    reportesPaginados,
    loading,
    error,
    metricas,
    empresasUnicas,
    faenasUnicas,
    // Estados de filtros
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    filtroPeligro,
    setFiltroPeligro,
    filtroGravedad,
    setFiltroGravedad,
    filtroEstado,
    setFiltroEstado,
    filtroPlazo,
    setFiltroPlazo,
    filtroEmpresa,
    setFiltroEmpresa,
    filtroFaena,
    setFiltroFaena,
    orden,
    setOrden,
    limpiarFiltros,
    // Paginación
    paginaActual,
    totalPaginas,
    itemsPorPagina,
    setItemsPorPagina,
    cambiarPagina,
    // Mutaciones
    fetchReportes,
    crearReporte,
    resolverReporte,
    eliminarReporte,
  };
}
