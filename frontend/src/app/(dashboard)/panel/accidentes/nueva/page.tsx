"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../../../../utils/api";

interface ActionItem {
  medida: string;
  responsable: string;
  fecha_limite: string;
  estado: "PENDIENTE" | "REALIZADO";
}

export default function NuevaInvestigacionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Estados del Formulario
  // Paso 1: Afectado
  const [afectado, setAfectado] = useState({
    nombre_afectado: "",
    rut_afectado: "",
    cargo_afectado: "",
    edad_afectado: "",
    antiguedad_afectado: "",
  });

  // Paso 2: Evento
  const [evento, setEvento] = useState({
    tipo_evento: "TRABAJO",
    fecha_hora_evento: "",
    lugar_evento: "",
    descripcion_evento: "",
    tipo_lesion: "",
    parte_cuerpo_afectada: "",
  });

  // Paso 3: Análisis de Causas
  const [causasInmediatas, setCausasInmediatas] = useState({
    actos_subestandar: "",
    condiciones_subestandar: "",
  });
  const [causasBasicas, setCausasBasicas] = useState({
    factores_personales: "",
    factores_trabajo: "",
  });
  const [porques, setPorques] = useState(["", "", "", "", ""]);

  // Paso 4: Plan de Acción
  const [planAccion, setPlanAccion] = useState<ActionItem[]>([
    { medida: "", responsable: "", fecha_limite: "", estado: "PENDIENTE" }
  ]);

  const handleAddMedida = () => {
    setPlanAccion([
      ...planAccion,
      { medida: "", responsable: "", fecha_limite: "", estado: "PENDIENTE" }
    ]);
  };

  const handleRemoveMedida = (idx: number) => {
    setPlanAccion(planAccion.filter((_, i) => i !== idx));
  };

  const handleMedidaChange = (idx: number, field: keyof ActionItem, value: string) => {
    setPlanAccion(
      planAccion.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handlePorqueChange = (idx: number, value: string) => {
    setPorques(porques.map((p, i) => (i === idx ? value : p)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("Sesión no activa.");
      setLoading(false);
      return;
    }

    const payload = {
      ...afectado,
      edad_afectado: parseInt(afectado.edad_afectado) || 0,
      ...evento,
      causas_inmediatas: causasInmediatas,
      causas_basicas: causasBasicas,
      analisis_5_porques: porques.filter((p) => p.trim() !== ""),
      plan_accion: planAccion.filter((item) => item.medida.trim() !== ""),
    };

    try {
      const res = await fetch(getApiUrl("/api/accidentes/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData) || "Error al guardar el reporte.");
      }

      alert("¡Investigación guardada con éxito!");
      router.push("/panel/accidentes");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            Nueva Investigación de Accidente / Incidente
          </h1>
          <p className="text-slate-400 mt-2 text-xs">
            Paso {step} de 4: {step === 1 ? "Identificación del Afectado" : step === 2 ? "Detalles del Evento" : step === 3 ? "Análisis de Causas (5 Porqués)" : "Plan de Acción Correctiva"}
          </p>
        </div>
        <button
          onClick={() => router.push("/panel/accidentes")}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-750 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
        >
          Volver al Historial
        </button>
      </div>

      {/* Barra de Progreso de Pasos */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                step >= s
                  ? "bg-orange-600 text-white shadow-md shadow-orange-500/20"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-900"
              }`}
            >
              {s}
            </div>
            {s < 4 && (
              <div
                className={`h-1 flex-1 mx-2 rounded transition-all duration-500 ${
                  step > s ? "bg-orange-500" : "bg-slate-100 dark:bg-slate-900"
                }`}
              ></div>
            )}
          </div>
        ))}
      </div>

      {/* Formulario Principal */}
      <div className="bg-white dark:bg-slate-955 p-6 md:p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
        
        {/* PASO 1: AFECTADO */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold border-b pb-2 text-slate-900 dark:text-white border-slate-100 dark:border-slate-900">
              Datos del Trabajador Afectado
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={afectado.nombre_afectado}
                  onChange={(e) => setAfectado({ ...afectado, nombre_afectado: e.target.value })}
                  placeholder="Ej. Pedro Picapiedra"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">RUT del Afectado</label>
                <input
                  type="text"
                  required
                  value={afectado.rut_afectado}
                  onChange={(e) => setAfectado({ ...afectado, rut_afectado: e.target.value })}
                  placeholder="Ej. 12.345.678-9"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Cargo / Puesto de Trabajo</label>
                <input
                  type="text"
                  required
                  value={afectado.cargo_afectado}
                  onChange={(e) => setAfectado({ ...afectado, cargo_afectado: e.target.value })}
                  placeholder="Ej. Operador de Horquilla"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Edad</label>
                  <input
                    type="number"
                    required
                    value={afectado.edad_afectado}
                    onChange={(e) => setAfectado({ ...afectado, edad_afectado: e.target.value })}
                    placeholder="Ej. 34"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Antigüedad</label>
                  <input
                    type="text"
                    required
                    value={afectado.antiguedad_afectado}
                    onChange={(e) => setAfectado({ ...afectado, antiguedad_afectado: e.target.value })}
                    placeholder="Ej. 2 años"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: DETALLES DEL EVENTO */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold border-b pb-2 text-slate-900 dark:text-white border-slate-100 dark:border-slate-900">
              Detalles del Suceso y Evaluación Inicial
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Tipo de Evento</label>
                <select
                  value={evento.tipo_evento}
                  onChange={(e) => setEvento({ ...evento, tipo_evento: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="TRABAJO">Accidente del Trabajo</option>
                  <option value="TRAYECTO">Accidente de Trayecto (In itinere)</option>
                  <option value="INCIDENTE">Incidente / Casi Accidente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Fecha y Hora</label>
                <input
                  type="datetime-local"
                  required
                  value={evento.fecha_hora_evento}
                  onChange={(e) => setEvento({ ...evento, fecha_hora_evento: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1 text-slate-500">Lugar Exacto de los Hechos</label>
                <input
                  type="text"
                  required
                  value={evento.lugar_evento}
                  onChange={(e) => setEvento({ ...evento, lugar_evento: e.target.value })}
                  placeholder="Ej. Bodega Central - Rampa de carga 2"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Tipo de Lesión</label>
                <input
                  type="text"
                  required
                  value={evento.tipo_lesion}
                  onChange={(e) => setEvento({ ...evento, tipo_lesion: e.target.value })}
                  placeholder="Ej. Fractura expuesta, Contusión, Corte superficial"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Parte del Cuerpo Afectada</label>
                <input
                  type="text"
                  required
                  value={evento.parte_cuerpo_afectada}
                  onChange={(e) => setEvento({ ...evento, parte_cuerpo_afectada: e.target.value })}
                  placeholder="Ej. Muñeca derecha, Tobillo izquierdo, Ojo izquierdo"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1 text-slate-500">Relato Cronológico del Evento</label>
                <textarea
                  required
                  value={evento.descripcion_evento}
                  onChange={(e) => setEvento({ ...evento, descripcion_evento: e.target.value })}
                  rows={4}
                  placeholder="Describe qué ocurrió, cómo ocurrió y qué tareas realizaba el trabajador al momento del accidente..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* PASO 3: ANÁLISIS DE CAUSAS Y 5 PORQUÉS */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold border-b pb-2 text-slate-900 dark:text-white border-slate-100 dark:border-slate-900">
              Análisis de Causas Raíz
            </h2>

            {/* Inmediatas y Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3">Causas Inmediatas</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-450 dark:text-slate-400 mb-1">Actos Subestándar (Factores Humanos)</label>
                    <textarea
                      value={causasInmediatas.actos_subestandar}
                      onChange={(e) => setCausasInmediatas({ ...causasInmediatas, actos_subestandar: e.target.value })}
                      placeholder="Ej. No utilizar arnés de seguridad, operar equipo sin autorización..."
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl p-2.5 text-xs focus:outline-none resize-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-450 dark:text-slate-400 mb-1">Condiciones Subestándar (Ambiente/Equipos)</label>
                    <textarea
                      value={causasInmediatas.condiciones_subestandar}
                      onChange={(e) => setCausasInmediatas({ ...causasInmediatas, condiciones_subestandar: e.target.value })}
                      placeholder="Ej. Falta de barandas protectoras, derrame de aceite en el pasillo..."
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl p-2.5 text-xs focus:outline-none resize-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3">Causas Básicas</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-450 dark:text-slate-400 mb-1">Factores Personales</label>
                    <textarea
                      value={causasBasicas.factores_personales}
                      onChange={(e) => setCausasBasicas({ ...causasBasicas, factores_personales: e.target.value })}
                      placeholder="Ej. Falta de capacitación en el procedimiento, fatiga acumulada..."
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl p-2.5 text-xs focus:outline-none resize-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-450 dark:text-slate-400 mb-1">Factores del Trabajo / Organización</label>
                    <textarea
                      value={causasBasicas.factores_trabajo}
                      onChange={(e) => setCausasBasicas({ ...causasBasicas, factores_trabajo: e.target.value })}
                      placeholder="Ej. Falta de inspecciones de seguridad preventivas, herramientas gastadas..."
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl p-2.5 text-xs focus:outline-none resize-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Metodo de los 5 Porqués */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-2 flex items-center space-x-2">
                <span>🤔</span>
                <span>Análisis de los 5 Porqués (Causa Raíz)</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">Pregunta consecutivamente el "porqué" de cada respuesta anterior para llegar a la raíz sistémica del evento.</p>

              <div className="space-y-3">
                {porques.map((p, idx) => (
                  <div key={idx} className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-orange-600 font-mono w-16">Porqué {idx + 1}:</span>
                    <input
                      type="text"
                      value={p}
                      onChange={(e) => handlePorqueChange(idx, e.target.value)}
                      placeholder={idx === 0 ? "¿Por qué ocurrió la caída?" : `¿Por qué sucedió la respuesta del porqué ${idx}?`}
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* PASO 4: PLAN DE ACCIÓN */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-slate-900">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Plan de Acción Correctiva
              </h2>
              <button
                type="button"
                onClick={handleAddMedida}
                className="bg-slate-900 hover:bg-slate-850 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
              >
                + Añadir Medida
              </button>
            </div>

            <div className="space-y-4">
              {planAccion.map((medida, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850 flex flex-col md:flex-row gap-4 items-end"
                >
                  <div className="flex-1 space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Medida de Control Correctiva</label>
                    <input
                      type="text"
                      value={medida.medida}
                      onChange={(e) => handleMedidaChange(idx, "medida", e.target.value)}
                      placeholder="Ej. Instalar barandas perimetrales normalizadas"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="w-full md:w-48 space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Responsable</label>
                    <input
                      type="text"
                      value={medida.responsable}
                      onChange={(e) => handleMedidaChange(idx, "responsable", e.target.value)}
                      placeholder="Ej. Jefe de Mantención"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="w-full md:w-36 space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Plazo Límite</label>
                    <input
                      type="date"
                      value={medida.fecha_limite}
                      onChange={(e) => handleMedidaChange(idx, "fecha_limite", e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  {planAccion.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMedida(idx)}
                      className="text-red-500 hover:text-red-400 font-bold text-sm pb-2 cursor-pointer"
                    >
                      ❌
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>
        )}

        {/* Botones de Navegación del Wizard */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1 || loading}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-6 rounded-xl text-xs cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            Atras
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Investigación"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
