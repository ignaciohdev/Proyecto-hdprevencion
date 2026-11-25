"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { EmpresaOption, CentroTrabajoOption, TrabajadorOption } from "../types";

interface ModalQRFirmaMovilEPPProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaOption[];
  centrosTrabajo: CentroTrabajoOption[];
  trabajadores: TrabajadorOption[];
  empresaInicialId?: number;
}

export function ModalQRFirmaMovilEPP({
  isOpen,
  onClose,
  empresas,
  centrosTrabajo,
  trabajadores,
  empresaInicialId,
}: ModalQRFirmaMovilEPPProps) {
  const [empresaId, setEmpresaId] = useState<string>(
    empresaInicialId ? String(empresaInicialId) : empresas.length > 0 ? String(empresas[0].id) : ""
  );
  const [centroId, setCentroId] = useState<string>("");
  const [trabajadorId, setTrabajadorId] = useState<string>("");
  const [copiado, setCopiado] = useState<boolean>(false);
  const [origenUrl, setOrigenUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigenUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (empresaInicialId) {
      setEmpresaId(String(empresaInicialId));
    } else if (empresas.length > 0 && !empresaId) {
      setEmpresaId(String(empresas[0].id));
    }
  }, [empresaInicialId, empresas]);

  if (!isOpen) return null;

  // Filtrar centros y trabajadores por empresa
  const centrosFiltrados = centrosTrabajo.filter(
    (c) => !empresaId || c.empresa === Number(empresaId)
  );
  const trabajadoresFiltrados = trabajadores.filter(
    (t) => !empresaId || t.empresa === Number(empresaId)
  );

  const queryParams = new URLSearchParams();
  if (empresaId) queryParams.set("empresa", empresaId);
  if (centroId) queryParams.set("centro", centroId);
  if (trabajadorId) queryParams.set("trabajador", trabajadorId);

  const urlFirmaMovil = `${origenUrl}/participacion/firma-epp?${queryParams.toString()}`;

  const copiarEnlace = () => {
    navigator.clipboard.writeText(urlFirmaMovil);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Firma Remota Móvil de EPP en Terreno
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ley N° 19.799 (Firma Electrónica Simple) • Circular N° 3.336 SUSESO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Parámetros de la Entrega */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Empresa *
              </label>
              <select
                value={empresaId}
                onChange={(e) => {
                  setEmpresaId(e.target.value);
                  setCentroId("");
                  setTrabajadorId("");
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 font-medium"
              >
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.razon_social}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Centro / Faena
              </label>
              <select
                value={centroId}
                onChange={(e) => setCentroId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 font-medium"
              >
                <option value="">Todas las faenas</option>
                {centrosFiltrados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Trabajador Específico (Opcional)
            </label>
            <select
              value={trabajadorId}
              onChange={(e) => setTrabajadorId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 font-medium"
            >
              <option value="">Recepción Abierta en Terreno (Cualquier Trabajador)</option>
              {trabajadoresFiltrados.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombres} {t.apellidos} - {t.rut} ({t.cargo})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Si seleccionas un trabajador, el formulario móvil se prellenará exclusivamente con sus datos para firma directa.
            </p>
          </div>

          {/* QR Card */}
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
              <QRCodeSVG
                value={urlFirmaMovil}
                size={144}
                level="M"
              />
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ✓ Válido para Fiscalización DT / SUSESO
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Escaneo Inmediato en Smartphone o Tablet
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                El trabajador escanea el código en terreno, revisa los elementos entregados y estampa su firma con el dedo en pantalla táctil sin necesidad de instalar apps.
              </p>
              <div className="pt-1 flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={copiarEnlace}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-sm"
                >
                  {copiado ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>¡Enlace Copiado!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      <span>Copiar Enlace WhatsApp / SMS</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Blindaje Legal */}
          <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-xl p-3.5 space-y-1.5">
            <h5 className="text-xs font-bold text-orange-950 dark:text-orange-300 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Validez Probatoria y Respaldo Legal
            </h5>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Conforme al Art. 68 de la Ley N° 16.744 y Art. 53 del D.S. N° 594, los EPP deben proporcionarse libres de costo y con constancia de recepción e instrucción de uso. La firma capturada en dispositivo móvil cumple plenamente con la Ley N° 19.799 de Firma Electrónica Simple.
            </p>
          </div>

          {/* Aviso Informativo Breve Ley 21.719 (data-info) */}
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            🔒 <strong>Aviso de Privacidad (Art. 14 ter Ley N° 21.719):</strong> Al capturar firma del trabajador vía enlace QR, HD Prevención actúa como Encargado por cuenta de la empresa empleadora (Responsable) para acreditar entrega de EPP/RIOHS (base legal SST, conservación mínima 5 años). Más info en{" "}
            <a href="/privacidad" target="_blank" className="text-orange-600 dark:text-orange-400 underline font-semibold">
              /privacidad
            </a>{" "}
            y derechos ARCO-POL en{" "}
            <a href="/derechos-arco" target="_blank" className="text-orange-600 dark:text-orange-400 underline font-semibold">
              /derechos-arco
            </a>.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
