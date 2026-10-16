"use client";

import { useState, useEffect } from "react";

export default function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Registro del Service Worker nativo
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[PWA] Service Worker registrado exitosamente con scope:", registration.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Fallo en el registro del Service Worker:", err);
          });
      });
    }

    // 2. Verificar si ya está instalada como Standalone PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 3. Detección de dispositivos iOS / iPadOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // 4. Captura del evento de instalación en Chrome / Android / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // 5. Escucha cuando la app fue instalada con éxito
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log("[PWA] HD Prevención instalada correctamente en el dispositivo.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (!deferredPrompt) {
      alert("Para instalar HD Prevención en tu dispositivo, abre el menú de opciones de tu navegador (⋮) y selecciona 'Instalar aplicación' o 'Agregar a la pantalla principal'.");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Respuesta del usuario a la instalación: ${outcome}`);
    if (outcome === "accepted") {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  // Si ya está instalada, no mostramos el botón
  if (isInstalled) {
    return null;
  }

  // Mostramos el botón si es instalable vía evento o en iOS
  return (
    <>
      {(isInstallable || isIos) && (
        <div className="fixed bottom-4 right-4 z-40 animate-bounce">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-4 py-2.5 rounded-full bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-2xl shadow-orange-600/40 border border-orange-400/40 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
            title="Instalar HD Prevención en tu teléfono o tablet para operar sin internet en faena"
          >
            <span className="text-base">📱</span>
            <span>Instalar App en Faena</span>
          </button>
        </div>
      )}

      {/* Modal Instructivo para iOS / iPadOS */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/15 text-orange-400 flex items-center justify-center text-3xl mx-auto border border-orange-500/30">
              📲
            </div>

            <h3 className="text-base font-bold text-white">
              Instalar HD Prevención en iPhone / iPad
            </h3>

            <div className="text-xs text-slate-300 space-y-2.5 text-left bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="flex items-start gap-2">
                <span className="font-bold text-orange-400 shrink-0">1.</span>
                <span>En la barra de Safari, presiona el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba ⎋).</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-orange-400 shrink-0">2.</span>
                <span>Desplázate hacia abajo y selecciona <strong>&quot;Agregar a inicio&quot;</strong> (icono ➕).</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-orange-400 shrink-0">3.</span>
                <span>Presiona <strong>&quot;Agregar&quot;</strong> en la esquina superior derecha.</span>
              </p>
            </div>

            <p className="text-[11px] text-slate-400">
              ¡Listo! Podrás acceder a tus matrices IPERC y firmas directamente desde la pantalla de inicio, incluso sin cobertura 4G/5G en faena.
            </p>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
