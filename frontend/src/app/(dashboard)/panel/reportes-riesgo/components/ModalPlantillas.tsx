"use client";

import { PLANTILLAS_NORMATIVAS, PlantillaHallazgo, calcularMatrizRiesgo } from "../types";

interface ModalPlantillasProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlantilla: (plantilla: PlantillaHallazgo) => void;
}

export function ModalPlantillas({
  isOpen,
  onClose,
  onSelectPlantilla,
}: ModalPlantillasProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-3xl w-full shadow-2xl my-8 relative">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
              Ahorro de Tiempo en Faena
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Plantillas Normativas DS 594 & Construcción
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Selecciona una no conformidad frecuente para prellenar la norma, evaluación de riesgo y jerarquía de control con 1 clic.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {PLANTILLAS_NORMATIVAS.map((plantilla) => {
            const matrizPlantilla = calcularMatrizRiesgo(plantilla.probabilidad, plantilla.severidad);
            return (
              <div
                key={plantilla.id}
                onClick={() => onSelectPlantilla(plantilla)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-orange-500 hover:bg-orange-50/10 transition-all cursor-pointer space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      {plantilla.titulo}
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${matrizPlantilla.colorBadge}`}>
                      {matrizPlantilla.nivel}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-1">
                    📜 {plantilla.norma_infringida}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1.5 line-clamp-2 leading-relaxed">
                    {plantilla.descripcion}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Plazo sugerido: {plantilla.plazo_dias} día(s)</span>
                  <span className="text-orange-600 font-bold">Usar Plantilla →</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer"
          >
            Cerrar Catálogo
          </button>
        </div>
      </div>
    </div>
  );
}
