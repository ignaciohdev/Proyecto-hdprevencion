"use client";

import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../utils/api";
import {
  ComiteParitario,
  MiembroCPHS,
  ActaSesionCPHS,
  EstadisticasCPHS,
  EmpresaItem,
  CentroTrabajoItem,
  TrabajadorItem,
} from "./types";
import {
  ResumenLegalStats,
  EstructuraMiembrosTab,
  LibroActasTab,
  ModalConstituirCPHS,
  ModalMiembroCPHS,
  ModalCrearActa,
  ModalImprimirActa,
} from "./components";

export default function ComiteParitarioPage() {
  // Estado de Datos Maestros
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [centrosTrabajo, setCentrosTrabajo] = useState<CentroTrabajoItem[]>([]);
  const [trabajadores, setTrabajadores] = useState<TrabajadorItem[]>([]);
  const [empresaSeleccionadaId, setEmpresaSeleccionadaId] = useState<number | null>(null);

  // Estado del Comité y sus elementos
  const [comites, setComites] = useState<ComiteParitario[]>([]);
  const [comiteActual, setComiteActual] = useState<ComiteParitario | null>(null);
  const [miembros, setMiembros] = useState<MiembroCPHS[]>([]);
  const [actas, setActas] = useState<ActaSesionCPHS[]>([]);
  const [stats, setStats] = useState<EstadisticasCPHS | null>(null);

  // Estado de UI
  const [tabActiva, setTabActiva] = useState<"MIEMBROS" | "ACTAS">("MIEMBROS");
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Modales
  const [isModalConstituirOpen, setIsModalConstituirOpen] = useState<boolean>(false);
  const [isModalMiembroOpen, setIsModalMiembroOpen] = useState<boolean>(false);
  const [miembroAEditar, setMiembroAEditar] = useState<MiembroCPHS | null>(null);
  const [slotEstamento, setSlotEstamento] = useState<"EMPRESA" | "TRABAJADORES">("EMPRESA");
  const [slotTipo, setSlotTipo] = useState<"TITULAR" | "SUPLENTE">("TITULAR");
  const [isModalCrearActaOpen, setIsModalCrearActaOpen] = useState<boolean>(false);
  const [actaParaImprimir, setActaParaImprimir] = useState<ActaSesionCPHS | null>(null);

  // 1. Cargar Empresas, Centros de Trabajo y Trabajadores iniciales
  const cargarCatalogos = useCallback(async () => {
    try {
      const [resEmpresas, resCentros, resTrabajadores] = await Promise.all([
        authFetch("/api/empresas/"),
        authFetch("/api/centros-trabajo/"),
        authFetch("/api/trabajadores/"),
      ]);

      if (resEmpresas.ok) {
        const data = await resEmpresas.json();
        const items = Array.isArray(data) ? data : data.results || [];
        setEmpresas(items);
        if (items.length > 0 && !empresaSeleccionadaId) {
          setEmpresaSeleccionadaId(items[0].id);
        }
      }

      if (resCentros.ok) {
        const data = await resCentros.json();
        setCentrosTrabajo(Array.isArray(data) ? data : data.results || []);
      }

      if (resTrabajadores.ok) {
        const data = await resTrabajadores.json();
        setTrabajadores(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Error al cargar empresas o centros:", err);
    }
  }, [empresaSeleccionadaId]);

  // 2. Cargar Comités de la Empresa seleccionada
  const cargarComites = useCallback(async (empresaId: number) => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/comites-paritarios/?empresa=${empresaId}`);
      if (res.ok) {
        const data = await res.json();
        const items: ComiteParitario[] = Array.isArray(data) ? data : data.results || [];
        setComites(items);
        if (items.length > 0) {
          setComiteActual(items[0]);
        } else {
          setComiteActual(null);
          setMiembros([]);
          setActas([]);
          setStats(null);
        }
      }
    } catch (err) {
      console.error("Error al cargar comités:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. Cargar Miembros, Actas y Estadísticas del Comité activo
  const cargarDetalleComite = useCallback(async (comiteId: number) => {
    try {
      setLoadingStats(true);
      const [resMiembros, resActas, resStats] = await Promise.all([
        authFetch(`/api/miembros-cphs/?comite=${comiteId}`),
        authFetch(`/api/actas-cphs/?comite=${comiteId}`),
        authFetch(`/api/comites-paritarios/${comiteId}/estadisticas/`),
      ]);

      if (resMiembros.ok) {
        const data = await resMiembros.json();
        setMiembros(Array.isArray(data) ? data : data.results || []);
      }

      if (resActas.ok) {
        const data = await resActas.json();
        setActas(Array.isArray(data) ? data : data.results || []);
      }

      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error al cargar detalles de CPHS:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    if (empresaSeleccionadaId) {
      cargarComites(empresaSeleccionadaId);
    }
  }, [empresaSeleccionadaId, cargarComites]);

  useEffect(() => {
    if (comiteActual) {
      cargarDetalleComite(comiteActual.id);
    }
  }, [comiteActual, cargarDetalleComite]);

  // Manejadores de Mutaciones
  const handleCrearComite = async (data: {
    empresa: number;
    centro_trabajo?: number | null;
    nombre: string;
    fecha_constitucion: string;
  }) => {
    const res = await authFetch("/api/comites-paritarios/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.empresa || err?.nombre || "No se pudo constituir el CPHS.");
    }
    const nuevo = await res.json();
    setComites((prev) => [nuevo, ...prev]);
    setComiteActual(nuevo);
  };

  const handleGuardarMiembro = async (data: Partial<MiembroCPHS>) => {
    if (!comiteActual) return;
    const isEdit = Boolean(miembroAEditar?.id);
    const url = isEdit ? `/api/miembros-cphs/${miembroAEditar?.id}/` : "/api/miembros-cphs/";
    const method = isEdit ? "PATCH" : "POST";

    const res = await authFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, comite: comiteActual.id }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.rut || err?.nombre || err?.comite || "Error al guardar integrante.");
    }

    await cargarDetalleComite(comiteActual.id);
  };

  const handleEliminarMiembro = async (miembroId: number) => {
    if (!confirm("¿Confirma dar de baja a este integrante del Comité Paritario?")) return;
    const res = await authFetch(`/api/miembros-cphs/${miembroId}/`, {
      method: "DELETE",
    });
    if (res.ok && comiteActual) {
      await cargarDetalleComite(comiteActual.id);
    }
  };

  const handleCrearActa = async (data: Partial<ActaSesionCPHS>) => {
    if (!comiteActual) return;
    const res = await authFetch("/api/actas-cphs/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.numero_acta || err?.lugar || "Error al emitir el acta.");
    }

    await cargarDetalleComite(comiteActual.id);
  };

  const handleToggleAcuerdo = async (actaId: number, index: number, cumplido: boolean) => {
    const res = await authFetch(`/api/actas-cphs/${actaId}/cambiar-estado-acuerdo/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indice_acuerdo: index, cumplido }),
    });

    if (res.ok && comiteActual) {
      await cargarDetalleComite(comiteActual.id);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* 1. HEADER Y SELECTORES DE CONTEXTO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black tracking-wider uppercase px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              D.S. N° 44 • Ley N° 16.744
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Mandato Legal de 2 Años
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            Comité Paritario de Higiene y Seguridad (CPHS)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestión bilateral de paridad laboral-patronal, Libro Digital de Actas y seguimiento preventivo.
          </p>
        </div>

        {/* Selectores y Botón de Constitución */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Empresa */}
          {empresas.length > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Empresa Asesorada
              </span>
              <select
                value={empresaSeleccionadaId || ""}
                onChange={(e) => setEmpresaSeleccionadaId(Number(e.target.value))}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
              >
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.razon_social}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selector de Comité si la empresa tiene varios */}
          {comites.length > 1 && (
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Comité de Faena
              </span>
              <select
                value={comiteActual?.id || ""}
                onChange={(e) => {
                  const c = comites.find((x) => x.id === Number(e.target.value));
                  if (c) setComiteActual(c);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
              >
                {comites.map((com) => (
                  <option key={com.id} value={com.id}>
                    {com.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end self-end">
            <button
              onClick={() => setIsModalConstituirOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5"
            >
              <span>+ Constituir CPHS</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SI NO EXISTE COMITÉ EN ESTA EMPRESA */}
      {!loading && comites.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            Esta empresa no tiene un Comité Paritario registrado
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            De acuerdo con el Artículo 66 de la Ley N° 16.744 y el D.S. N° 44, toda empresa, faena, sucursal o agencia en que trabajen más de 25 personas debe contar con uno o más Comités Paritarios.
          </p>
          <button
            onClick={() => setIsModalConstituirOpen(true)}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-extrabold transition-all shadow-md inline-flex items-center space-x-2"
          >
            <span>Constituir Comité Paritario Ahora</span>
          </button>
        </div>
      )}

      {/* 3. SI HAY COMITÉ CONSTITUIDO */}
      {comiteActual && (
        <>
          {/* TARJETAS RESUMEN LEGAL */}
          <ResumenLegalStats stats={stats} loading={loadingStats} />

          {/* BARRA DE PESTAÑAS */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center space-x-6">
            <button
              onClick={() => setTabActiva("MIEMBROS")}
              className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
                tabActiva === "MIEMBROS"
                  ? "border-orange-500 text-orange-600 dark:text-orange-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Estructura y Miembros del CPHS</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {miembros.length}
              </span>
            </button>

            <button
              onClick={() => setTabActiva("ACTAS")}
              className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
                tabActiva === "ACTAS"
                  ? "border-orange-500 text-orange-600 dark:text-orange-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Libro Digital de Actas</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {actas.length}
              </span>
            </button>
          </div>

          {/* CONTENIDO DE PESTAÑA */}
          {tabActiva === "MIEMBROS" ? (
            <EstructuraMiembrosTab
              comite={comiteActual}
              miembros={miembros}
              onAgregarMiembro={(estamento, tipo) => {
                setMiembroAEditar(null);
                setSlotEstamento(estamento || "EMPRESA");
                setSlotTipo(tipo || "TITULAR");
                setIsModalMiembroOpen(true);
              }}
              onEditarMiembro={(m) => {
                setMiembroAEditar(m);
                setIsModalMiembroOpen(true);
              }}
              onEliminarMiembro={handleEliminarMiembro}
            />
          ) : (
            <LibroActasTab
              comite={comiteActual}
              actas={actas}
              loading={loadingStats}
              onCrearActa={() => setIsModalCrearActaOpen(true)}
              onVerActaImprimible={(acta) => setActaParaImprimir(acta)}
              onToggleAcuerdo={handleToggleAcuerdo}
            />
          )}
        </>
      )}

      {/* 4. MODALES */}
      <ModalConstituirCPHS
        isOpen={isModalConstituirOpen}
        onClose={() => setIsModalConstituirOpen(false)}
        empresas={empresas}
        centrosTrabajo={centrosTrabajo}
        empresaSeleccionadaId={empresaSeleccionadaId || undefined}
        onCrear={handleCrearComite}
      />

      {comiteActual && (
        <>
          <ModalMiembroCPHS
            isOpen={isModalMiembroOpen}
            onClose={() => setIsModalMiembroOpen(false)}
            comiteId={comiteActual.id}
            trabajadores={trabajadores.filter((t) => t.empresa === comiteActual.empresa)}
            miembroEditar={miembroAEditar}
            estamentoInicial={slotEstamento}
            tipoInicial={slotTipo}
            onGuardar={handleGuardarMiembro}
          />

          <ModalCrearActa
            isOpen={isModalCrearActaOpen}
            onClose={() => setIsModalCrearActaOpen(false)}
            comiteId={comiteActual.id}
            miembros={miembros}
            siguienteNumeroActa={actas.length + 1}
            onCrearActa={handleCrearActa}
          />

          <ModalImprimirActa
            isOpen={Boolean(actaParaImprimir)}
            onClose={() => setActaParaImprimir(null)}
            acta={actaParaImprimir}
            comite={comiteActual}
            miembros={miembros}
          />
        </>
      )}
    </div>
  );
}
