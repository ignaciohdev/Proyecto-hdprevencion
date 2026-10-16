"use client";

import { useState, useEffect, useCallback } from "react";
import {
  contarColaPendiente,
  sincronizarColaConServidor,
} from "../utils/offlineStorage";

export default function BarraConectividad() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [itemsPendientes, setItemsPendientes] = useState<number>(0);
  const [isSincronizando, setIsSincronizando] = useState<boolean>(false);
  const [mensajeReconexion, setMensajeReconexion] = useState<string | null>(null);

  // Actualizar el conteo de ítems en la cola local
  const refrescarConteoCola = useCallback(async () => {
    const conteo = await contarColaPendiente();
    setItemsPendientes(conteo);
  }, []);

  // Manejador de sincronización
  const ejecutarSincronizacion = useCallback(async () => {
    if (!navigator.onLine || isSincronizando) return;
    setIsSincronizando(true);
    setMensajeReconexion("🔄 Sincronizando datos de faena con el servidor central...");

    try {
      const res = await sincronizarColaConServidor();
      if (res.exitosas > 0) {
        setMensajeReconexion(
          `✅ ${res.exitosas} ${res.exitosas === 1 ? "registro sincronizado" : "registros sincronizados"} exitosamente.`
        );
      } else if (res.total === 0) {
        setMensajeReconexion("🟢 Conexión restablecida. Todo está al día.");
      } else if (res.fallidas > 0) {
        setMensajeReconexion(
          `⚠️ ${res.fallidas} registros pendientes por error. Se reintentará en breve.`
        );
      }
    } catch (err) {
      console.error("[BarraConectividad] Error en sincronización:", err);
      setMensajeReconexion("⚠️ Error momentáneo al sincronizar con el servidor.");
    } finally {
      setIsSincronizando(false);
      refrescarConteoCola();
      // Ocultar el mensaje temporal tras 4.5 segundos
      setTimeout(() => {
        setMensajeReconexion(null);
      }, 4500);
    }
  }, [isSincronizando, refrescarConteoCola]);

  useEffect(() => {
    // Estado inicial
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      refrescarConteoCola();
    }

    const handleOnline = () => {
      setIsOnline(true);
      ejecutarSincronizacion();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setMensajeReconexion(null);
      refrescarConteoCola();
    };

    const handleQueueUpdated = () => {
      refrescarConteoCola();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("hdprevencion:queue-updated", handleQueueUpdated);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("hdprevencion:queue-updated", handleQueueUpdated);
    };
  }, [ejecutarSincronizacion, refrescarConteoCola]);

  // Si está en línea y no hay mensajes temporales ni pendientes, no mostramos barra expansiva
  if (isOnline && !mensajeReconexion && itemsPendientes === 0) {
    return null;
  }

  return (
    <div className="w-full z-50 sticky top-0 transition-all duration-300 animate-fadeIn">
      {/* 1. MODO OFFLINE ACTIVO (FAENA SIN SEÑAL) */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 shadow-lg border-b border-orange-500 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <div className="leading-snug">
              <strong className="font-extrabold uppercase tracking-wide">
                📡 Modo Faena Offline (Sin Señal)
              </strong>
              <span className="hidden md:inline ml-1 text-orange-100">
                — Puedes seguir consultando información y registrando actividades; los datos se guardarán localmente y se sincronizarán al recuperar conexión.
              </span>
              <span className="inline md:hidden ml-1 text-orange-100">
                — Operando localmente.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {itemsPendientes > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-black/30 border border-white/20 text-[11px] font-bold">
                📦 {itemsPendientes} {itemsPendientes === 1 ? "cambio guardado" : "cambios guardados"}
              </span>
            )}
            <span className="text-[10px] text-orange-200 uppercase font-mono tracking-wider hidden sm:inline">
              IndexedDB Local
            </span>
          </div>
        </div>
      )}

      {/* 2. MENSAJE TEMPORAL DE RECONEXIÓN O SINCRONIZACIÓN */}
      {isOnline && mensajeReconexion && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-2 shadow-md flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span>{isSincronizando ? "⏳" : "🟢"}</span>
            <span className="font-semibold">{mensajeReconexion}</span>
          </div>
          {itemsPendientes > 0 && !isSincronizando && (
            <button
              type="button"
              onClick={ejecutarSincronizacion}
              className="px-2.5 py-1 rounded bg-black/30 hover:bg-black/50 text-[11px] font-bold border border-white/30 transition-all cursor-pointer"
            >
              🔄 Sincronizar Ahora ({itemsPendientes})
            </button>
          )}
        </div>
      )}

      {/* 3. EN LÍNEA PERO CON ÍTEMS PENDIENTES DE REINTENTO */}
      {isOnline && !mensajeReconexion && itemsPendientes > 0 && (
        <div className="bg-slate-900 border-b border-slate-800 text-slate-200 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">⚠️</span>
            <span>
              Tienes <strong className="text-white">{itemsPendientes}</strong>{" "}
              {itemsPendientes === 1 ? "registro pendiente" : "registros pendientes"} de sincronización con el servidor.
            </span>
          </div>
          <button
            type="button"
            onClick={ejecutarSincronizacion}
            disabled={isSincronizando}
            className="px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>{isSincronizando ? "⏳" : "🔄"}</span>
            <span>{isSincronizando ? "Sincronizando..." : "Sincronizar ahora"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
