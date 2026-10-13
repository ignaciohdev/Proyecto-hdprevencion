"use client";

import { useState } from "react";
import { useReportesRiesgo } from "./hooks/useReportesRiesgo";
import {
  ReportesHeaderStats,
  ReportesFiltrosBar,
  ReportesListado,
  ModalCrearReporte,
  ModalResolverReporte,
  ModalPlantillas,
  ModalInformeVisita,
  ModalFotoPreview,
} from "./components";
import { ReporteRiesgo, PlantillaHallazgo, FormCrearReporte, exportarCSV } from "./types";

export default function InspeccionesHallazgosPage() {
  const {
    reportesFiltrados, reportesPaginados, loading, error, metricas,
    empresasUnicas, faenasUnicas, busqueda, setBusqueda,
    filtroTipo, setFiltroTipo, filtroPeligro, setFiltroPeligro,
    filtroGravedad, setFiltroGravedad, filtroEstado, setFiltroEstado,
    filtroPlazo, setFiltroPlazo, filtroEmpresa, setFiltroEmpresa,
    filtroFaena, setFiltroFaena, orden, setOrden, limpiarFiltros,
    paginaActual, totalPaginas, cambiarPagina, fetchReportes,
    crearReporte, resolverReporte, eliminarReporte,
  } = useReportesRiesgo();

  // Estados de Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPlantillasOpen, setIsPlantillasOpen] = useState(false);
  const [isInformeOpen, setIsInformeOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [selectedReporte, setSelectedReporte] = useState<ReporteRiesgo | null>(null);
  const [previewFotoUrl, setPreviewFotoUrl] = useState<string | null>(null);
  const [templateValues, setTemplateValues] = useState<Partial<FormCrearReporte> | null>(null);

  const handleSelectPlantilla = (p: PlantillaHallazgo) => {
    const fechaLim = new Date();
    fechaLim.setDate(fechaLim.getDate() + p.plazo_dias);
    setTemplateValues({
      tipo: p.tipo,
      clasificacion_peligro: p.clasificacion_peligro,
      norma_infringida: p.norma_infringida,
      descripcion: p.descripcion,
      probabilidad: p.probabilidad,
      severidad: p.severidad,
      jerarquia_control: p.jerarquia_control,
      medida_correctiva: p.medida_sugerida,
      fecha_limite: fechaLim.toISOString().split("T")[0],
    });
    setIsPlantillasOpen(false);
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con Métricas y Botones de Acción */}
      <ReportesHeaderStats
        metricas={metricas}
        onOpenPlantillas={() => setIsPlantillasOpen(true)}
        onOpenInforme={() => setIsInformeOpen(true)}
        onOpenCrear={() => { setTemplateValues(null); setIsCreateOpen(true); }}
        onFilterVencidos={() => setFiltroPlazo("VENCIDO")}
      />

      {/* 2. Barra de Búsqueda y Filtros Técnicos */}
      <ReportesFiltrosBar
        busqueda={busqueda} setBusqueda={setBusqueda}
        filtroTipo={filtroTipo} setFiltroTipo={setFiltroTipo}
        filtroPeligro={filtroPeligro} setFiltroPeligro={setFiltroPeligro}
        filtroGravedad={filtroGravedad} setFiltroGravedad={setFiltroGravedad}
        filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado}
        filtroPlazo={filtroPlazo} setFiltroPlazo={setFiltroPlazo}
        filtroEmpresa={filtroEmpresa} setFiltroEmpresa={setFiltroEmpresa}
        filtroFaena={filtroFaena} setFiltroFaena={setFiltroFaena}
        empresasUnicas={empresasUnicas} faenasUnicas={faenasUnicas}
        orden={orden} setOrden={setOrden}
        onExportarCSV={() => exportarCSV(reportesFiltrados)}
        onLimpiarFiltros={limpiarFiltros}
      />

      {/* 3. Listado de Hallazgos y Paginación */}
      <ReportesListado
        loading={loading} error={error}
        reportesFiltrados={reportesFiltrados} reportesPaginados={reportesPaginados}
        paginaActual={paginaActual} totalPaginas={totalPaginas}
        onCambiarPagina={cambiarPagina} onRetry={fetchReportes}
        onLimpiarFiltros={limpiarFiltros}
        onOpenCrear={() => { setTemplateValues(null); setIsCreateOpen(true); }}
        onResolve={(r) => { setSelectedReporte(r); setIsResolveOpen(true); }}
        onDelete={eliminarReporte} onPreviewFoto={setPreviewFotoUrl}
      />

      {/* 4. Modales Modulares */}
      <ModalCrearReporte
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={crearReporte}
        initialValues={templateValues}
      />

      <ModalResolverReporte
        isOpen={isResolveOpen}
        reporte={selectedReporte}
        onClose={() => { setIsResolveOpen(false); setSelectedReporte(null); }}
        onSubmit={resolverReporte}
      />

      <ModalPlantillas
        isOpen={isPlantillasOpen}
        onClose={() => setIsPlantillasOpen(false)}
        onSelectPlantilla={handleSelectPlantilla}
      />

      <ModalInformeVisita
        isOpen={isInformeOpen}
        onClose={() => setIsInformeOpen(false)}
        reportes={reportesFiltrados}
        metricas={metricas}
      />

      <ModalFotoPreview
        url={previewFotoUrl}
        onClose={() => setPreviewFotoUrl(null)}
      />
    </div>
  );
}
