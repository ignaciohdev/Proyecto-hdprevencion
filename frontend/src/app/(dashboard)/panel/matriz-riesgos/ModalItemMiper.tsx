"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ItemMatrizRiesgo,
  TipoActividad,
  ClasificacionPeligro,
  EstadoControl,
  ClasificacionRiesgo,
  ESCALA_PROBABILIDAD,
  ESCALA_SEVERIDAD,
  CLASIFICACIONES_RIESGO,
  getClasificacionColor,
  getClasificacionSolidBg,
} from "./types";
import { getApiUrl, authFetch, parseJsonResponse } from "../../../utils/api";
import type { ClimaUvData } from "../../../components/ClimaUvWidget";
import { guardarEnCola } from "../../../utils/offlineStorage";

interface ModalItemMiperProps {
  isOpen: boolean;
  onClose: () => void;
  matrizId: number;
  itemToEdit?: ItemMatrizRiesgo | null;
  climaData?: ClimaUvData | null;
  prefillClima?: boolean;
  onItemGuardado: (item: ItemMatrizRiesgo, isEdit: boolean) => void;
}

export default function ModalItemMiper({
  isOpen,
  onClose,
  matrizId,
  itemToEdit,
  climaData,
  prefillClima,
  onItemGuardado,
}: ModalItemMiperProps) {
  const isEditing = Boolean(itemToEdit);

  // Navegación en 5 Pasos IPERC
  const [pasoActivo, setPasoActivo] = useState<number>(1);

  // Paso 1: Identificación del Peligro
  const [proceso, setProceso] = useState("");
  const [actividad, setActividad] = useState("");
  const [tipoActividad, setTipoActividad] = useState<TipoActividad>("RUTINARIA");
  const [puestoTrabajo, setPuestoTrabajo] = useState("");
  const [peligro, setPeligro] = useState("");
  const [clasificacionPeligro, setClasificacionPeligro] = useState<ClasificacionPeligro>("SEGURIDAD");

  // Paso 2: Identificación del Riesgo
  const [riesgoConsecuencia, setRiesgoConsecuencia] = useState("");
  const [esAccidenteGraveFatal, setEsAccidenteGraveFatal] = useState<boolean>(false);
  const [trabajadorSensible, setTrabajadorSensible] = useState("");

  // Paso 3: Evaluación Riesgo Puro
  const [probabilidadPura, setProbabilidadPura] = useState<number>(3);
  const [severidadPura, setSeveridadPura] = useState<number>(3);

  // Paso 4: Controles Existentes (Implementados en terreno)
  const [controlesExistentes, setControlesExistentes] = useState("");

  // Paso 5: Controles Requeridos y Jerarquía de 5 Niveles
  const [controlesRequeridos, setControlesRequeridos] = useState("");
  const [controlEliminacion, setControlEliminacion] = useState("");
  const [controlSustitucion, setControlSustitucion] = useState("");
  const [controlIngenieria, setControlIngenieria] = useState("");
  const [controlAdministrativo, setControlAdministrativo] = useState("");
  const [controlEpp, setControlEpp] = useState("");

  // Evaluación Riesgo Residual
  const [probabilidadResidual, setProbabilidadResidual] = useState<number>(2);
  const [severidadResidual, setSeveridadResidual] = useState<number>(2);

  // Gestión Operativa
  const [responsable, setResponsable] = useState("");
  const [plazoImplementacion, setPlazoImplementacion] = useState("");
  const [estadoControl, setEstadoControl] = useState<EstadoControl>("IMPLEMENTADO");
  const [orden, setOrden] = useState<number>(10);

  const [acordeonAbierto, setAcordeonAbierto] = useState<string>("ingenieria");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar datos al abrir o editar
  useEffect(() => {
    if (itemToEdit) {
      setProceso(itemToEdit.proceso || "");
      setActividad(itemToEdit.actividad || "");
      setTipoActividad(itemToEdit.tipo_actividad || "RUTINARIA");
      setPuestoTrabajo(itemToEdit.puesto_trabajo || "");
      setPeligro(itemToEdit.peligro || "");
      setClasificacionPeligro(itemToEdit.clasificacion_peligro || "SEGURIDAD");

      setRiesgoConsecuencia(itemToEdit.riesgo_consecuencia || "");
      setEsAccidenteGraveFatal(Boolean(itemToEdit.es_accidente_grave_fatal));
      setTrabajadorSensible(itemToEdit.trabajador_sensible || "");

      setProbabilidadPura(itemToEdit.probabilidad_pura || 3);
      setSeveridadPura(itemToEdit.severidad_pura || 3);

      setControlesExistentes(itemToEdit.controles_existentes || "");

      setControlesRequeridos(itemToEdit.controles_requeridos || "");
      setControlEliminacion(itemToEdit.control_eliminacion || "");
      setControlSustitucion(itemToEdit.control_sustitucion || "");
      setControlIngenieria(itemToEdit.control_ingenieria || "");
      setControlAdministrativo(itemToEdit.control_administrativo || "");
      setControlEpp(itemToEdit.control_epp || "");

      setProbabilidadResidual(itemToEdit.probabilidad_residual || 2);
      setSeveridadResidual(itemToEdit.severidad_residual || 2);

      setResponsable(itemToEdit.responsable || "");
      setPlazoImplementacion(itemToEdit.plazo_implementacion || "");
      setEstadoControl(itemToEdit.estado_control || "IMPLEMENTADO");
      setOrden(itemToEdit.orden || 10);
    } else {
      setProceso("");
      setActividad("");
      setTipoActividad("RUTINARIA");
      setPuestoTrabajo("");
      setPeligro("");
      setClasificacionPeligro("SEGURIDAD");

      setRiesgoConsecuencia("");
      setEsAccidenteGraveFatal(false);
      setTrabajadorSensible("");

      setProbabilidadPura(3);
      setSeveridadPura(3);

      setControlesExistentes("");

      setControlesRequeridos("");
      setControlEliminacion("");
      setControlSustitucion("");
      setControlIngenieria("");
      setControlAdministrativo("");
      setControlEpp("");

      setProbabilidadResidual(2);
      setSeveridadResidual(2);

      setResponsable("");
      setPlazoImplementacion("");
      setEstadoControl("IMPLEMENTADO");
      setOrden(10);

      if (prefillClima) {
        autocompletarClima();
      }
    }
    setPasoActivo(1);
    setErrorMsg(null);
  }, [itemToEdit, isOpen, prefillClima]);

  // Autocompletado inteligente con datos meteorológicos D.S. 594 Art. 109 & Enmienda ISO 2024
  const autocompletarClima = () => {
    const uvActual = climaData?.uv_actual ?? 6.0;
    const uvMax = climaData?.uv_max_dia ?? 8.5;
    const nivelDisplay = climaData?.nivel_uv_display ?? "Alto";
    const sensacion = climaData?.sensacion_termica ?? 32.0;

    // Paso 1: Identificación del Peligro
    setProceso("Operaciones generales y actividades en terreno / intemperie");
    setActividad("Trabajos en exterior con exposición a radiación solar y condiciones ambientales");
    setPuestoTrabajo("Cuadrillas operativas, supervisores y trabajadores en terreno");
    setTipoActividad("RUTINARIA");
    setClasificacionPeligro("CLIMATICO");
    setPeligro(
      `Exposición a Radiación Solar Ultravioleta (Índice UV: ${uvActual} / Proyección máx: ${uvMax} - Nivel ${nivelDisplay}) y Estrés Térmico por Calor (Sensación térmica: ${sensacion}°C).`
    );

    // Paso 2: Identificación del Riesgo
    setRiesgoConsecuencia(
      "Estrés térmico por calor, deshidratación severa, síncope o golpe de calor, fatiga extrema, fotoenvejecimiento cutáneo, eritema solar agudo y daño actínico acumulativo a la salud (D.S. N° 594 Art. 109, Guía Técnica ISP Radiación UV y Enmienda ISO 2024)."
    );
    setEsAccidenteGraveFatal(sensacion >= 38.0);
    setTrabajadorSensible(
      "Personas con hipertensión, trabajadoras embarazadas o en tratamiento fotosensibilizante (Art. 11 D.S. N° 44)."
    );

    // Paso 3: Evaluación Riesgo Puro
    setProbabilidadPura(4); // Exposición diaria habitual
    setSeveridadPura(uvMax >= 11 || sensacion >= 34 ? 4 : 3);

    // Paso 4: Controles Existentes
    setControlesExistentes("Disponibilidad básica de agua potable en faena y uso de gorro común.");

    // Paso 5: Controles Requeridos y Jerarquía
    const medidasLegales =
      climaData?.medidas_legales_ds594 && climaData.medidas_legales_ds594.length > 0
        ? climaData.medidas_legales_ds594.map((m) => `• ${m}`).join("\n")
        : "• Publicación diaria del índice UV en cartel mural visible.\n• Disposición de agua potable fresca para hidratación continua.\n• Uso obligatorio de elementos de protección personal con filtro UV certificado.\n• Implementación de pausas y sombras de descanso en faena.";

    setControlesRequeridos(
      `Cumplimiento obligatorio de medidas preventivas D.S. 594 y Enmienda ISO 2024:\n${medidasLegales}`
    );
    setControlEliminacion("");
    setControlSustitucion("");
    setControlIngenieria(
      "Habilitación de zonas de descanso con sombra artificial (mallas o toldos UV). Puntos de hidratación refrigerada a menos de 50m de los frentes de trabajo."
    );
    setControlAdministrativo(
      "Pausas activas de hidratación de 1 vaso de agua fresca cada 15-20 minutos. Rotación periódica de personal. Prohibición de faenas de alto esfuerzo físico al sol directo entre 11:00 y 16:00 hrs. Publicación diaria del Índice UV en panel mural visible."
    );
    setControlEpp(
      "Ropa de trabajo manga larga de trama tupida con protección UPF 50+, cubre nuca tipo legionario, gafas de seguridad certificadas con filtro UV 400 y protector solar FPS 50+ con reaplicación obligatoria cada 2 horas."
    );

    setProbabilidadResidual(2);
    setSeveridadResidual(2);
    setResponsable("Supervisor de Terreno / Prevencionista");
    setEstadoControl("IMPLEMENTADO");
  };

  // Cálculos de Magnitud y Clasificación Pura
  const magnitudPura = useMemo(() => probabilidadPura * severidadPura, [probabilidadPura, severidadPura]);
  const clasificacionPura: ClasificacionRiesgo = useMemo(() => {
    if (magnitudPura >= 17) return "CRITICO";
    if (magnitudPura >= 10) return "ALTO";
    if (magnitudPura >= 5) return "MEDIO";
    return "BAJO";
  }, [magnitudPura]);

  // Cálculos de Magnitud y Clasificación Residual
  const magnitudResidual = useMemo(
    () => probabilidadResidual * severidadResidual,
    [probabilidadResidual, severidadResidual]
  );
  const clasificacionResidual: ClasificacionRiesgo = useMemo(() => {
    if (magnitudResidual >= 17) return "CRITICO";
    if (magnitudResidual >= 10) return "ALTO";
    if (magnitudResidual >= 5) return "MEDIO";
    return "BAJO";
  }, [magnitudResidual]);

  const reduccionPorcentual = useMemo(() => {
    if (magnitudPura <= 0) return 0;
    const red = ((magnitudPura - magnitudResidual) / magnitudPura) * 100;
    return Math.max(0, Math.round(red));
  }, [magnitudPura, magnitudResidual]);

  const tieneControlesRegistrados = useMemo(() => {
    return Boolean(
      controlesRequeridos.trim() ||
      controlEliminacion.trim() ||
      controlSustitucion.trim() ||
      controlIngenieria.trim() ||
      controlAdministrativo.trim() ||
      controlEpp.trim()
    );
  }, [controlesRequeridos, controlEliminacion, controlSustitucion, controlIngenieria, controlAdministrativo, controlEpp]);

  const reduccionIlegal = magnitudResidual < magnitudPura && !tieneControlesRegistrados;
  const infraccionCircular3336 = esAccidenteGraveFatal && (severidadPura < 4 && magnitudPura < 17);

  if (!isOpen) return null;

  const PASOS = [
    { num: 1, titulo: "Identificar Peligros", sub: "Actividad y Entorno" },
    { num: 2, titulo: "Identificar Riesgos", sub: "Evento y Daño Potencial" },
    { num: 3, titulo: "Evaluar Riesgo", sub: "Probabilidad × Consecuencia" },
    { num: 4, titulo: "Controles Existentes", sub: "Medidas en Terreno" },
    { num: 5, titulo: "Controles Requeridos", sub: "Jerarquía y Residual" },
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!proceso.trim() || !actividad.trim() || !puestoTrabajo.trim()) {
      setErrorMsg("Paso 1 Incompleto: Debe indicar el Proceso, la Actividad y el Puesto de Trabajo.");
      setPasoActivo(1);
      return;
    }
    if (!peligro.trim()) {
      setErrorMsg("Paso 1 Incompleto: Debe detallar el Peligro Identificado.");
      setPasoActivo(1);
      return;
    }
    if (!riesgoConsecuencia.trim()) {
      setErrorMsg("Paso 2 Incompleto: Debe describir el Riesgo / Evento No Deseado y Consecuencia.");
      setPasoActivo(2);
      return;
    }

    if (infraccionCircular3336) {
      setErrorMsg(
        "Infracción Circular SUSESO N° 3336 / Art. 184 bis Código del Trabajo: Los peligros con potencial de accidente grave o fatal deben evaluarse con Severidad mayor o igual a 4 o Magnitud Pura en rango Crítico (17-25)."
      );
      setPasoActivo(3);
      return;
    }

    if (reduccionIlegal) {
      setErrorMsg(
        "Infracción Arts. 9 y 10 D.S. N° 44: No es legal registrar una reducción de riesgo (Riesgo Residual menor al Puro) sin registrar al menos una medida en Controles Requeridos o en la Jerarquía Legal (Eliminación, Sustitución, Ingeniería, Administrativo o EPP)."
      );
      setPasoActivo(5);
      return;
    }

    setGuardando(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        matriz: matrizId,
        proceso: proceso.trim(),
        actividad: actividad.trim(),
        tipo_actividad: tipoActividad,
        puesto_trabajo: puestoTrabajo.trim(),
        peligro: peligro.trim(),
        clasificacion_peligro: clasificacionPeligro,

        riesgo_consecuencia: riesgoConsecuencia.trim(),
        es_accidente_grave_fatal: esAccidenteGraveFatal,
        trabajador_sensible: trabajadorSensible.trim(),

        probabilidad_pura: Number(probabilidadPura),
        severidad_pura: Number(severidadPura),

        controles_existentes: controlesExistentes.trim(),

        controles_requeridos: controlesRequeridos.trim(),
        control_eliminacion: controlEliminacion.trim(),
        control_sustitucion: controlSustitucion.trim(),
        control_ingenieria: controlIngenieria.trim(),
        control_administrativo: controlAdministrativo.trim(),
        control_epp: controlEpp.trim(),

        probabilidad_residual: Number(probabilidadResidual),
        severidad_residual: Number(severidadResidual),

        responsable: responsable.trim(),
        estado_control: estadoControl,
        orden: Number(orden) || 10,
      };

      if (plazoImplementacion) {
        payload.plazo_implementacion = plazoImplementacion;
      } else {
        payload.plazo_implementacion = null;
      }

      const url = isEditing
        ? getApiUrl(`/api/items-matriz-riesgo/${itemToEdit!.id}/`)
        : getApiUrl("/api/items-matriz-riesgo/");
      const method = isEditing ? "PATCH" : "POST";

      // Verificación previa de conexión en faena
      if (typeof window !== "undefined" && !navigator.onLine) {
        await guardarEnCola(
          isEditing ? `/api/items-matriz-riesgo/${itemToEdit!.id}/` : "/api/items-matriz-riesgo/",
          method,
          payload,
          `Peligro IPERC: ${peligro.substring(0, 32)}...`
        );
        const itemLocal: ItemMatrizRiesgo = {
          id: itemToEdit?.id || Date.now(),
          ...payload,
          magnitud_pura: magnitudPura,
          clasificacion_pura: clasificacionPura,
          magnitud_residual: magnitudResidual,
          clasificacion_residual: clasificacionResidual,
        };
        onItemGuardado(itemLocal, isEditing);
        onClose();
        alert("📡 Guardado localmente en Modo Faena Offline (Sin Señal). Se sincronizará automáticamente al recuperar conexión.");
        return;
      }

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await parseJsonResponse<any>(res);
        throw new Error(
          errData?.detail ||
            errData?.error ||
            errData?.es_accidente_grave_fatal?.[0] ||
            errData?.non_field_errors?.[0] ||
            "Error al guardar el ítem en la matriz IPERC."
        );
      }

      const itemGuardado = await parseJsonResponse<ItemMatrizRiesgo>(res);
      onItemGuardado(itemGuardado, isEditing);
      onClose();
    } catch (err: any) {
      // Captura de corte abrupto de red durante la petición
      if (
        typeof window !== "undefined" &&
        (!navigator.onLine ||
          err.message?.toLowerCase().includes("fetch") ||
          err.message?.toLowerCase().includes("network"))
      ) {
        try {
          const method = isEditing ? "PATCH" : "POST";
          const path = isEditing ? `/api/items-matriz-riesgo/${itemToEdit!.id}/` : "/api/items-matriz-riesgo/";
          const payloadOffline: any = {
            matriz: matrizId,
            proceso: proceso.trim(),
            actividad: actividad.trim(),
            tipo_actividad: tipoActividad,
            puesto_trabajo: puestoTrabajo.trim(),
            peligro: peligro.trim(),
            clasificacion_peligro: clasificacionPeligro,
            riesgo_consecuencia: riesgoConsecuencia.trim(),
            es_accidente_grave_fatal: esAccidenteGraveFatal,
            trabajador_sensible: trabajadorSensible.trim(),
            probabilidad_pura: Number(probabilidadPura),
            severidad_pura: Number(severidadPura),
            controles_existentes: controlesExistentes.trim(),
            controles_requeridos: controlesRequeridos.trim(),
            control_eliminacion: controlEliminacion.trim(),
            control_sustitucion: controlSustitucion.trim(),
            control_ingenieria: controlIngenieria.trim(),
            control_administrativo: controlAdministrativo.trim(),
            control_epp: controlEpp.trim(),
            probabilidad_residual: Number(probabilidadResidual),
            severidad_residual: Number(severidadResidual),
            responsable: responsable.trim(),
            estado_control: estadoControl,
            orden: Number(orden) || 10,
            plazo_implementacion: plazoImplementacion || null,
          };
          await guardarEnCola(path, method, payloadOffline, `Peligro IPERC: ${peligro.substring(0, 32)}...`);
          const itemLocal: ItemMatrizRiesgo = {
            id: itemToEdit?.id || Date.now(),
            ...payloadOffline,
            magnitud_pura: magnitudPura,
            clasificacion_pura: clasificacionPura,
            magnitud_residual: magnitudResidual,
            clasificacion_residual: clasificacionResidual,
          };
          onItemGuardado(itemLocal, isEditing);
          onClose();
          alert("📡 Señal perdida en faena: El peligro se guardó en almacenamiento local (IndexedDB) y se transmitirá al recuperar cobertura.");
          return;
        } catch (queueErr) {
          console.error("Error al encolar offline:", queueErr);
        }
      }
      setErrorMsg(err.message || "Error al procesar la solicitud.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header con Título y Cerrar */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 font-bold text-sm">
                {isEditing ? "✏️" : "➕"}
              </span>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? "Editar Peligro y Controles IPERC" : "Asistente Metodológico IPERC: 5 Pasos"}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Conforme a Guía Técnica ISP • D.S. N° 44 (MINTRAB) • ISO 45001:2018 Cláusula 6.1.2 • Circular SUSESO N° 3336
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Wizard Stepper (1 a 5) */}
        <div className="grid grid-cols-5 border-b border-slate-800 bg-slate-950/70 p-2 gap-1 text-xs">
          {PASOS.map((p) => {
            const isActive = pasoActivo === p.num;
            const isCompleted = pasoActivo > p.num;
            return (
              <button
                key={p.num}
                type="button"
                onClick={() => setPasoActivo(p.num)}
                className={`p-2 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-orange-500/15 border border-orange-500/40 text-orange-400 shadow-sm"
                    : isCompleted
                    ? "bg-slate-900/60 text-slate-300 hover:bg-slate-800/50"
                    : "text-slate-500 hover:text-slate-400 hover:bg-slate-900/40"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isActive
                        ? "bg-orange-500 text-slate-950"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isCompleted ? "✓" : p.num}
                  </span>
                  <span className="truncate">{p.titulo}</span>
                </div>
                <div className="text-[10px] opacity-75 truncate mt-0.5 hidden sm:block">
                  {p.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* Form Body con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-400 hover:text-white text-xs ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* PASO 1: Identificación del Peligro */}
          {pasoActivo === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Paso 1: Identificar Peligros (ISO 45001 Cláusula 6.1.2.1)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Analiza las actividades, áreas de trabajo, equipos, materiales y entorno operacional.
                  </p>
                </div>
              </div>

              {/* Banner Inteligente de Autocompletado Climático D.S. 594 / ISO 2024 */}
              {(clasificacionPeligro === "CLIMATICO" || prefillClima) && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-orange-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center text-xl shrink-0">
                      ☀️
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-bold text-white">
                          Peligro Climático D.S. N° 594 Art. 109 & Enmienda ISO 2024
                        </h4>
                        {climaData && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-950 uppercase"
                            style={{ backgroundColor: climaData.color_hex }}
                          >
                            UV {climaData.uv_actual} • {climaData.nivel_uv_display}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {climaData
                          ? `Faena: ${climaData.faena_nombre || climaData.ciudad} • Temp: ${climaData.temperatura}°C • Sensación: ${climaData.sensacion_termica}°C`
                          : "Monitoreo meteorológico en faena y directrices preventivas oficiales."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={autocompletarClima}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>☀️</span>
                    <span>Autocompletar con Datos del Semáforo UV y D.S. 594 de esta Faena</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Proceso / Área <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={proceso}
                    onChange={(e) => setProceso(e.target.value)}
                    placeholder="Ej. Movimiento de Tierras / Montaje Industrial"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Actividad / Tarea <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={actividad}
                    onChange={(e) => setActividad(e.target.value)}
                    placeholder="Ej. Vaciado de hormigón en losa de piso"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipo de Actividad <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={tipoActividad}
                    onChange={(e) => setTipoActividad(e.target.value as TipoActividad)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="RUTINARIA">Rutinaria (Operación Habitual)</option>
                    <option value="NO_RUTINARIA">No Rutinaria (Mantenimiento / Esporádica)</option>
                    <option value="EMERGENCIA">Emergencia / Contingencia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Puesto de Trabajo / Ocupación Expuesta <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={puestoTrabajo}
                    onChange={(e) => setPuestoTrabajo(e.target.value)}
                    placeholder="Ej. Jornal / Enfierrador / Operador de Maquinaria"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Descripción del Peligro Identificado <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={peligro}
                    onChange={(e) => setPeligro(e.target.value)}
                    placeholder="Describe la fuente, situación o acto con potencial de causar daño (ej. Trabajo sobre andamios a más de 1.8m de altura sin barandas perimetrales completas)."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Clasificación del Agente / Peligro <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={clasificacionPeligro}
                    onChange={(e) => setClasificacionPeligro(e.target.value as ClasificacionPeligro)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="SEGURIDAD">Seguridad (Caídas, atrapamiento, corte, eléctrico)</option>
                    <option value="FISICO">Físico (Ruido - PREXOR, vibración, iluminación)</option>
                    <option value="QUIMICO">Químico (Sílice - PLANESI, gases, solventes)</option>
                    <option value="BIOLOGICO">Biológico (Virus, bacterias, hantavirus)</option>
                    <option value="ERGONOMICO">Ergonómico (TMERT-EESS, manejo manual cargas)</option>
                    <option value="PSICOSOCIAL">Psicosocial (CEAL-SM, Ley Karin N° 21.643)</option>
                    <option value="CLIMATICO">Climático / Ambiental (Estrés térmico, UV solar ISO 2024)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Clasificación oficial conforme a D.S. N° 594 y Enmienda ISO 2024.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Identificación del Riesgo */}
          {pasoActivo === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Paso 2: Identificar Riesgos (¿Qué puede suceder y qué daño puede causar?)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Determina cómo afecta a personas, equipos, procesos o medio ambiente según normativa chilena.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Evento No Deseado y Consecuencia Potencial <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={riesgoConsecuencia}
                  onChange={(e) => setRiesgoConsecuencia(e.target.value)}
                  placeholder="Ej. Caída de distinto nivel: Traumatismo encéfalo craneano grave, fracturas múltiples o fatalidad."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              {/* Criterio Circular SUSESO N° 3336 */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  esAccidenteGraveFatal
                    ? "bg-red-500/10 border-red-500/40 text-red-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-300"
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={esAccidenteGraveFatal}
                    onChange={(e) => setEsAccidenteGraveFatal(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-700 bg-slate-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      ⚠️ Aplica Criterio de Accidente Grave o Fatal (Circular SUSESO N° 3336)
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Involucra: Caída de altura &gt;1.80m, atrapamiento, amputación traumática, intoxicación aguda, asfixia o maniobras de rescate.
                    </span>
                    {esAccidenteGraveFatal && (
                      <div className="mt-2 text-[11px] p-2 rounded bg-red-950/60 border border-red-800/80 text-red-200">
                        <strong>Mandato Legal Art. 184 bis Código del Trabajo:</strong> En caso de ocurrir o detectarse este peligro sin controles suficientes, procede la <em>suspensión inmediata de faenas</em>. En la evaluación pura debe calificarse con Severidad $\ge 4$ o Nivel Crítico (17-25).
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Art. 11 D.S. N° 44: Trabajador Especialmente Sensible */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Condición de Trabajador Especialmente Sensible (Art. 11 D.S. N° 44)
                </label>
                <input
                  type="text"
                  value={trabajadorSensible}
                  onChange={(e) => setTrabajadorSensible(e.target.value)}
                  placeholder="Ej. Trabajador con discapacidad, mujer embarazada, periodo de lactancia, adulto mayor o adolescente"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
                <p className="text-[11px] text-slate-400">
                  Opcional. Permite registrar medidas adaptadas y verificar que las condiciones no afecten la salud diferenciada del trabajador.
                </p>
              </div>
            </div>
          )}

          {/* PASO 3: Evaluación del Riesgo Puro */}
          {pasoActivo === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Paso 3: Evaluar el Riesgo Puro (Nivel = Probabilidad × Consecuencia)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Evalúa la magnitud del peligro en estado puro (sin considerar las medidas de mitigación adicionales).
                  </p>
                </div>
              </div>

              {/* Badge Dinámico de Magnitud Pura */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${getClasificacionColor(
                  clasificacionPura
                )}`}
              >
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">
                    Nivel de Riesgo Puro Calculado
                  </div>
                  <div className="text-xl font-black mt-0.5 flex items-center gap-2">
                    <span>Nivel = {magnitudPura}</span>
                    <span className="text-xs font-mono opacity-80">({probabilidadPura} × {severidadPura})</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${getClasificacionSolidBg(
                        clasificacionPura
                      )}`}
                    >
                      {clasificacionPura}
                    </span>
                  </div>
                </div>
                <div className="text-xs sm:text-right max-w-sm font-medium">
                  {CLASIFICACIONES_RIESGO[clasificacionPura].accionRequerida}
                </div>
              </div>

              {/* Selectores Interactivos de P y C */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Probabilidad Pura */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Probabilidad Pura (P: 1 a 5)
                  </label>
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const isSel = probabilidadPura === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setProbabilidadPura(val)}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                            isSel
                              ? "bg-orange-500/20 border-orange-500 text-white font-bold shadow-md"
                              : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            <span className="font-mono mr-1.5">{val} -</span>
                            <span>{ESCALA_PROBABILIDAD[val]?.etiqueta.replace(/^\d+ - /, "")}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 hidden sm:inline truncate max-w-[160px]">
                            {ESCALA_PROBABILIDAD[val]?.descripcion}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Severidad / Consecuencia Pura */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Consecuencia / Severidad Pura (C: 1 a 5)
                  </label>
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const isSel = severidadPura === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSeveridadPura(val)}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                            isSel
                              ? "bg-orange-500/20 border-orange-500 text-white font-bold shadow-md"
                              : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            <span className="font-mono mr-1.5">{val} -</span>
                            <span>{ESCALA_SEVERIDAD[val]?.etiqueta.replace(/^\d+ - /, "")}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 hidden sm:inline truncate max-w-[160px]">
                            {ESCALA_SEVERIDAD[val]?.descripcion}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 4: Controles Existentes */}
          {pasoActivo === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Paso 4: Determinar Controles Existentes (ISO 45001 Cláusula 6.1.2.2)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Identifica las medidas y defensas preventivas que ya están implementadas actualmente en la faena.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Medidas de Control Actualmente Implementadas en Terreno
                </label>
                <textarea
                  rows={5}
                  value={controlesExistentes}
                  onChange={(e) => setControlesExistentes(e.target.value)}
                  placeholder="Ej. Uso obligatorio de arnés de seguridad básico de 3 argollas, charla operacional diaria de 5 minutos, demarcación perimetral con cinta de peligro en zanja."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-2">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                  <span>💡 Directriz de Evaluación de Eficacia (ISO 45001 / D.S. N° 44)</span>
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Registrar los controles existentes permite a los auditores y al Comité Paritario verificar si el riesgo persiste por falta de cumplimiento de las medidas ya existentes o si se requiere diseñar nuevas barreras de ingeniería (Paso 5).
                </p>
              </div>
            </div>
          )}

          {/* PASO 5: Controles Requeridos y Reevaluación Residual */}
          {pasoActivo === 5 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center">
                  5
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Paso 5: Definir Controles Requeridos y Reevaluar Riesgo Residual
                  </h3>
                  <p className="text-xs text-slate-400">
                    Establece acciones adicionales según la jerarquía legal de 5 niveles (ISO 45001 Cláusula 8.1.2 y Arts. 9 y 12 D.S. N° 44).
                  </p>
                </div>
              </div>

              {/* Campo General Controles Requeridos */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Controles Requeridos (Acciones Adicionales Propuestas)
                </label>
                <textarea
                  rows={2}
                  value={controlesRequeridos}
                  onChange={(e) => setControlesRequeridos(e.target.value)}
                  placeholder="Resumen de acciones adicionales a implementar para mitigar el riesgo puro."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Acordeón de la Jerarquía Legal de 5 Niveles */}
              <div className="space-y-2 border border-slate-800 rounded-2xl p-4 bg-slate-950/60">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Desglose por Jerarquía de Controles (De más a menos efectivo)
                </h4>

                {[
                  {
                    id: "eliminacion",
                    nivel: "1. Eliminación",
                    color: "border-red-500/40 text-red-400",
                    val: controlEliminacion,
                    setter: setControlEliminacion,
                    ph: "Eliminar físicamente el peligro (ej. Automatizar tarea, suspender proceso peligroso)",
                  },
                  {
                    id: "sustitucion",
                    nivel: "2. Sustitución",
                    color: "border-orange-500/40 text-orange-400",
                    val: controlSustitucion,
                    setter: setControlSustitucion,
                    ph: "Reemplazar el material o energía por uno de menor peligrosidad (ej. Pintura en base a agua)",
                  },
                  {
                    id: "ingenieria",
                    nivel: "3. Controles de Ingeniería y Protección Colectiva",
                    color: "border-amber-500/40 text-amber-400",
                    val: controlIngenieria,
                    setter: setControlIngenieria,
                    ph: "Aislar a las personas del peligro (ej. Barandas perimetrales, entibaciones, extractores)",
                  },
                  {
                    id: "administrativo",
                    nivel: "4. Controles Administrativos y Procedimientos",
                    color: "border-cyan-500/40 text-cyan-400",
                    val: controlAdministrativo,
                    setter: setControlAdministrativo,
                    ph: "Procedimiento de Trabajo Seguro (PTS), permisos especiales, señalización y capacitación",
                  },
                  {
                    id: "epp",
                    nivel: "5. Elementos de Protección Personal (EPP)",
                    color: "border-blue-500/40 text-blue-400",
                    val: controlEpp,
                    setter: setControlEpp,
                    ph: "EPP específico certificado ante el Instituto de Salud Pública - ISP (Art. 13 D.S. N° 44)",
                  },
                ].map((item) => (
                  <div key={item.id} className="border border-slate-800/80 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAcordeonAbierto(acordeonAbierto === item.id ? "" : item.id)}
                      className="w-full px-3.5 py-2.5 bg-slate-900/80 hover:bg-slate-900 flex items-center justify-between text-xs font-bold text-left cursor-pointer"
                    >
                      <span className={item.color}>{item.nivel}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {item.val.trim() ? "✓ Completado" : acordeonAbierto === item.id ? "▲" : "▼"}
                      </span>
                    </button>
                    {acordeonAbierto === item.id && (
                      <div className="p-3 bg-slate-950">
                        <textarea
                          rows={2}
                          value={item.val}
                          onChange={(e) => item.setter(e.target.value)}
                          placeholder={item.ph}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Reevaluación del Riesgo Residual */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      🛡️ Evaluación del Riesgo Residual (Con Controles Implementados)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Riesgo resultante tras la adopción efectiva de las medidas preventivas.
                    </p>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${getClasificacionColor(
                      clasificacionResidual
                    )}`}
                  >
                    <span className="text-xs font-mono font-bold">
                      Residual = {magnitudResidual} ({probabilidadResidual} × {severidadResidual})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${getClasificacionSolidBg(
                        clasificacionResidual
                      )}`}
                    >
                      {clasificacionResidual}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 ml-1">
                      -{reduccionPorcentual}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Probabilidad Residual (Pr: 1 a 5)
                    </label>
                    <select
                      value={probabilidadResidual}
                      onChange={(e) => setProbabilidadResidual(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                    >
                      {[1, 2, 3, 4, 5].map((val) => (
                        <option key={val} value={val}>
                          {ESCALA_PROBABILIDAD[val]?.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Consecuencia / Severidad Residual (Sr: 1 a 5)
                    </label>
                    <select
                      value={severidadResidual}
                      onChange={(e) => setSeveridadResidual(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                    >
                      {[1, 2, 3, 4, 5].map((val) => (
                        <option key={val} value={val}>
                          {ESCALA_SEVERIDAD[val]?.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Asignación y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Responsable de Implementación
                  </label>
                  <input
                    type="text"
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    placeholder="Ej. Capataz / Administrador de Obra"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Plazo de Implementación
                  </label>
                  <input
                    type="date"
                    value={plazoImplementacion}
                    onChange={(e) => setPlazoImplementacion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estado del Control
                  </label>
                  <select
                    value={estadoControl}
                    onChange={(e) => setEstadoControl(e.target.value as EstadoControl)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="IMPLEMENTADO">Control Implementado y Verificado</option>
                    <option value="EN_PROCESO">En Proceso de Implementación</option>
                    <option value="PENDIENTE">Pendiente de Presupuesto / Adquisición</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con Navegación de Pasos y Botón Guardar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <div>
            {pasoActivo > 1 && (
              <button
                type="button"
                onClick={() => setPasoActivo((prev) => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ← Anterior
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pasoActivo < 5 ? (
              <button
                type="button"
                onClick={() => setPasoActivo((prev) => Math.min(5, prev + 1))}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow cursor-pointer"
              >
                Siguiente Paso →
              </button>
            ) : null}

            <button
              type="button"
              disabled={guardando}
              onClick={() => handleSubmit()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 cursor-pointer"
            >
              {guardando ? "Guardando en MIPER..." : isEditing ? "Actualizar Peligro" : "Guardar Peligro en Matriz"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
