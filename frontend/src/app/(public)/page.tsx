"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<"prevencionistas" | "empresas">("prevencionistas");

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("access_token"));
  }, []);

  const industrias = [
    { nombre: "Minería & Faenas", count: "48 formatos", icon: "⛏️" },
    { nombre: "Construcción Civil", count: "62 formatos", icon: "🏗️" },
    { nombre: "Transporte & Logística", count: "35 formatos", icon: "🚛" },
    { nombre: "Metalmecánica & Taller", count: "29 formatos", icon: "⚙️" },
    { nombre: "Agropecuaria & Frutícola", count: "41 formatos", icon: "🌱" },
    { nombre: "Salud & Clínicas", count: "33 formatos", icon: "🏥" },
    { nombre: "Forestal & Maderera", count: "27 formatos", icon: "🌲" },
    { nombre: "Retail & Comercio", count: "38 formatos", icon: "🏬" },
    { nombre: "Acuícola & Pesca", count: "24 formatos", icon: "🐟" },
    { nombre: "Energía & Eléctrico", count: "31 formatos", icon: "⚡" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* ========================================================= */}
      {/* A. HERO PRINCIPAL: IMPACTO COMERCIAL INMEDIATO           */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white pt-20 pb-24 md:pt-28 md:pb-32 border-b border-slate-800">
        {/* Glows de fondo con gradientes sutiles */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10 text-center max-w-5xl">
          {/* Badge superior pulsante */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 shadow-inner mb-8">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs md:text-sm font-semibold tracking-wide text-slate-300">
              Plataforma SaaS de Prevención de Riesgos • <span className="text-emerald-400 font-bold">Chile 2026</span>
            </span>
          </div>

          {/* Titular Principal */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6 text-white">
            El Software B2B de <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 bg-clip-text text-transparent">Prevención de Riesgos</span> diseñado para la normativa chilena
          </h1>

          {/* Subtítulo enfocado en valor real */}
          <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Digitaliza la seguridad laboral en terreno <strong className="text-white font-semibold">sin descargar aplicaciones</strong>: firmas de inducción por QR, actas de Comité Paritario (D.S. 44), canal protegido Ley Karin en 72 horas y entrega de EPP con firma digital.
          </p>

          {/* Botones de Llamada a la Acción (CTA) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            {isLoggedIn ? (
              <Link
                href="/panel"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-4 px-9 rounded-xl shadow-lg shadow-orange-950/50 hover:shadow-orange-600/30 text-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Ir a mi Panel de Control</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            ) : (
              <>
                <Link
                  href="/registro"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-4 px-9 rounded-xl shadow-lg shadow-orange-950/50 hover:shadow-orange-600/30 text-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Comenzar Gratis (Sin Tarjeta)</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
                <Link
                  href="/documentos"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold py-4 px-8 rounded-xl border border-slate-700 hover:border-slate-600 text-lg transition-all transform hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Explorar +370 Formatos y Matrices</span>
                </Link>
              </>
            )}
          </div>

          {/* Cintillo de Cumplimiento Legal (Social Proof Normativo) */}
          <div className="pt-6 border-t border-slate-800/80">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Blindaje Normativo Total con Fiscalizaciones de la DT, SUSESO y Seremi de Salud
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {[
                { ley: "D.S. N° 44 Vigente", desc: "Comités Paritarios & Quorum" },
                { ley: "Ley Karin N° 21.643", desc: "Canal Protegido 72h DT" },
                { ley: "Ley N° 16.744", desc: "Accidentes & DIAT Mutual" },
                { ley: "D.S. 594 Art. 53", desc: "Entrega de EPP Certificados" },
                { ley: "Código del Trabajo Art. 153", desc: "RIOHS con Firma Digital" },
              ].map((norma, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-850/80 bg-slate-900 border border-slate-700/80 text-xs text-slate-300 shadow-sm"
                >
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <strong className="text-white font-medium">{norma.ley}</strong>
                  <span className="hidden sm:inline text-slate-400">• {norma.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* B. EL GRAN DIFERENCIADOR: OPERACIÓN POR QR (CERO APPS)   */}
      {/* ========================================================= */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/60 px-3 py-1 rounded-full mb-3">
              Tecnología de Terreno Inteligente
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Operación en Faena por Código QR <span className="text-orange-600">(Cero Apps, Cero Papel)</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Olvida las carpetas de papel mojadas en obra o las apps que los trabajadores no pueden instalar por falta de memoria.
            </p>
          </div>

          {/* Pasos del Flujo en Terreno */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: "01",
                titulo: "Genera el QR de Faena",
                desc: "Desde tu panel imprimes un cartel plastificado o abres el código en tu tablet en la entrada de la faena o sala de charlas.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                ),
                color: "from-orange-500 to-amber-500",
              },
              {
                num: "02",
                titulo: "Escaneo Directo",
                desc: "El trabajador apunta con la cámara de su celular personal o de la empresa. No requiere descargar nada ni crear contraseñas.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                ),
                color: "from-blue-500 to-cyan-500",
              },
              {
                num: "03",
                titulo: "Firma con el Dedo",
                desc: "Ingresa su RUT chileno (validado con dígito verificador), revisa el contenido de la charla, ODI o EPP y firma directo en su pantalla táctil.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                ),
                color: "from-emerald-500 to-teal-500",
              },
              {
                num: "04",
                titulo: "Respaldo Inmediato",
                desc: "El sistema sella la asistencia con fecha, hora exacta e IP del dispositivo, compilando un PDF fiscalizable con folio para la DT y mutuales.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                ),
                color: "from-purple-500 to-indigo-500",
              },
            ].map((step, idx) => (
              <div
                key={idx}
                className="relative bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/80 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl font-black text-slate-300 dark:text-slate-700 tracking-tighter">
                      {step.num}
                    </span>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-md`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {step.icon}
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {step.titulo}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center text-xs font-semibold text-emerald-600 dark:emerald-400">
                  <span className="mr-1.5">✓</span> Cumplimiento Art. 15 D.S. N° 44
                </div>
              </div>
            ))}
          </div>

          {/* Callout de Terreno */}
          <div className="mt-12 bg-gradient-to-r from-orange-600/10 via-amber-500/10 to-orange-600/10 border border-orange-500/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  ¿Tienes faenas remotas sin señal continua?
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
                  Nuestro módulo almacena temporalmente las firmas offline en el dispositivo del supervisor y sincroniza automáticamente las evidencias al recuperar conectividad celular.
                </p>
              </div>
            </div>
            <Link
              href="/capacitaciones"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold shadow-md transition-all whitespace-nowrap"
            >
              Ver Módulo de Asistencia QR
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* C. LOS 4 PILARES DE CUMPLIMIENTO NORMATIVO CHILENO        */}
      {/* ========================================================= */}
      <section className="py-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full mb-3">
              Auditoría Legal Rigurosa
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Los 4 Pilares Críticos de la Normativa Laboral
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Automatización de plazos perentorios y protocolos legales donde los errores se traducen en multas millonarias de la DT y la Seremi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 1. Ley Karin */}
            <div className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    Plazo DT: 72 Horas
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ley N° 21.643</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <span>Canal Formal Ley Karin</span>
                  <span className="text-purple-600 text-sm font-semibold">🔒 Protegido</span>
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Canal confidencial con folio encriptado para acoso laboral, acoso sexual y violencia en el trabajo. Separa sugerencias laborales comunes de denuncias legales vinculantes.
                </p>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Semáforo legal con cuenta regresiva fatal de 72 horas para remisión a la Inspección del Trabajo.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Activación inmediata de medidas de resguardo (separación de espacios, cambio de jornada).
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Log de auditoría inmutable: registra quién, cuándo y por qué abrió el expediente.
                  </li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Módulo Buzón Digital & Denuncias</span>
                <Link href={isLoggedIn ? "/panel/buzon-digital" : "/registro"} className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                  Gestionar Canal <span>→</span>
                </Link>
              </div>
            </div>

            {/* 2. CPHS D.S. 44 */}
            <div className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Meta 12 Sesiones / Año
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">D.S. N° 44 • Art. 14</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <span>Comité Paritario (CPHS)</span>
                  <span className="text-blue-600 text-sm font-semibold">🏛️ Bilateral</span>
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Administración de comités para faenas con más de 25 trabajadores. Padrón oficial de 6 miembros de la empresa y 6 representantes de los trabajadores (titulares y suplentes).
                </p>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Comprobador de Quorum Legal en vivo antes de abrir la sesión paritaria.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Libro Digital de Actas con folio correlativo y registro de acuerdos con responsables.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Generación de Acta Oficial con doble firma (Presidente y Secretario) imprimible para la DT.
                  </li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Módulo Comités Paritarios</span>
                <Link href={isLoggedIn ? "/panel/comite-paritario" : "/registro"} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                  Ver Libro de Actas <span>→</span>
                </Link>
              </div>
            </div>

            {/* 3. Investigación Accidentes & DIAT */}
            <div className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 hover:border-red-500/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Alerta Mutual: 24 Horas
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ley N° 16.744 • SUSESO</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <span>Investigación de Accidentes & DIAT</span>
                  <span className="text-red-600 text-sm font-semibold">🚨 Fatal/Grave</span>
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Protocolo exhaustivo de siniestros laborales y de trayecto. Análisis de causalidad con método de los 5 Porqués y árbol de causas integrado.
                </p>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Alerta perentoria de 24 horas para formalizar DIAT/DIEP ante ACHS, Mutual de Seguridad o IST.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Protocolo de Accidente Grave/Fatal (Circular 3336 SUSESO): suspensión inmediata de faena.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Estadísticas automáticas de Siniestralidad: Tasa de Frecuencia (IF) y Gravedad (IG).
                  </li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Módulo Investigación y DIAT</span>
                <Link href={isLoggedIn ? "/panel/investigaciones" : "/registro"} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1">
                  Explorar Protocolo <span>→</span>
                </Link>
              </div>
            </div>

            {/* 4. Entrega de EPP y RIOHS con Firma Digital */}
            <div className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Comprobante DT Inmediato
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Art. 68 Ley 16.744</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <span>Entrega de EPP & RIOHS Digital</span>
                  <span className="text-emerald-600 text-sm font-semibold">✍️ Firma Táctil</span>
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Registro digital in situ de entrega de Elementos de Protección Personal certificados y ejemplar del Reglamento Interno de Orden, Higiene y Seguridad.
                </p>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Firma digital táctil del trabajador directo en el celular o tablet en terreno.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Cláusula legal de gratuidad obligatoria (Art. 68) y compromiso expreso de cuidado.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Comprobante imprimible con formato oficial exigido en fiscalizaciones de la Dirección del Trabajo.
                  </li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Módulo EPP y RIOHS</span>
                <Link href={isLoggedIn ? "/panel/epp-riohs" : "/registro"} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                  Ver Comprobantes <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* D. BIBLIOTECA DE FORMATOS Y MATRICES (+370 ARCHIVOS)     */}
      {/* ========================================================= */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-2xl relative overflow-hidden text-white">
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-3xl">
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-orange-400 bg-orange-950/80 border border-orange-800/80 px-3 py-1 rounded-full mb-4">
                Catálogo Profesional Descargable
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
                Biblioteca con más de <span className="text-orange-500">+370 Formatos,</span> Matrices IPER y Planes
              </h2>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8">
                Documentos 100% editables en Word (.docx) y Excel adaptados minuciosamente a la legislación chilena vigente para más de 42 sectores productivos.
              </p>

              {/* Chips de Industrias */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-10">
                {industrias.map((ind, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-3 text-left transition-all hover:scale-105"
                  >
                    <div className="text-xl mb-1">{ind.icon}</div>
                    <div className="text-xs font-bold text-white truncate">{ind.nombre}</div>
                    <div className="text-[10px] text-slate-400">{ind.count}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href="/documentos"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-orange-950 transition-all cursor-pointer"
                >
                  <span>Explorar Catálogo Completo</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
                <span className="text-xs text-slate-400">
                  Incluye Matrices IPER, Procedimientos PTS, Protocolos TMERT, Prexor y Planes de Emergencia.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* E. SEGMENTACIÓN: PREVENCIONISTAS VS EMPRESAS             */}
      {/* ========================================================= */}
      <section className="py-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/60 px-3 py-1 rounded-full mb-3">
              Solución a Tu Medida
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Diseñado tanto para Prevencionistas como para Empresas
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300">
              HD Prevención se adapta a tu modelo operativo, ya seas un asesor independiente o una gerencia de seguridad y salud ocupacional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Columna 1: Prevencionistas y Consultoras */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-lg relative flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-orange-600/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Para Prevencionistas y Consultoras
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                  Deja de gestionar tus clientes con carpetas en Google Drive o cuadernos de terreno. Centraliza tu cartera profesional en una sola consola con aislamiento multi-empresa.
                </p>

                <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 mb-8">
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span><strong>Múltiples Clientes en un solo lugar:</strong> Administra empresas, diferentes centros de trabajo y trabajadores sin mezclar datos.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span><strong>Reportes Profesionales con tu Marca:</strong> Genera informes de inspección con fotos y estadísticas exportables en PDF.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span><strong>Ahorro de hasta 15 horas semanales:</strong> Cero digitación de firmas manuales de asistencia o actas paritarias.</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/registro"
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-md transition-all"
              >
                Comenzar como Prevencionista
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            {/* Columna 2: Empresas y Mandantes */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-lg relative flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Para Empresas y Mandantes
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                  Protege legalmente a tu organización ante la Dirección del Trabajo (DT) y mutualidades con trazabilidad documental ante accidentes y juicios laborales.
                </p>

                <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 mb-8">
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span><strong>Blindaje ante Demandas Laborales:</strong> Prueba de cumplimiento con firmas de entrega de EPP, RIOHS y capacitaciones ODI.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span><strong>Reducción de Cotización Adicional (D.S. 67):</strong> Baja tu tasa de accidentabilidad demostrando gestión preventiva efectiva.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span><strong>Multi-Asiento Corporativo:</strong> Asigna supervisores de terreno, jefes de faena y prevencionistas bajo un mismo contrato.</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/contacto"
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-sm shadow-md transition-all border border-slate-700"
              >
                Solicitar Demostración Corporativa
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* F. LLAMADO A LA ACCIÓN FINAL (BANNER DE ALTA CONVERSIÓN) */}
      {/* ========================================================= */}
      <section className="py-20 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white relative overflow-hidden border-t border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-orange-400 bg-orange-950/80 border border-orange-800/80 px-3.5 py-1.5 rounded-full mb-6">
            Pruébalo sin compromiso
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-6">
            Moderniza la prevención de riesgos en tu empresa hoy mismo
          </h2>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Comienza gratis en menos de 2 minutos. Crea tus empresas, genera tus primeros códigos QR de faena y descarga formatos normativos de inmediato.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/registro"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-extrabold py-4 px-10 rounded-xl shadow-xl shadow-orange-950 text-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Crear Cuenta Gratis</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <Link
              href="/contacto"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold py-4 px-8 rounded-xl border border-slate-700 text-lg transition-all"
            >
              <span>Hablar con un Especialista</span>
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span> Sin tarjeta de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span> Configuración en 2 minutos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span> Soporte en Chile
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* FOOTER CORPORATIVO                                        */}
      {/* ========================================================= */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900 text-sm">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Columna Marca */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 text-xl font-bold text-orange-500 mb-3">
                <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-7 w-auto" />
                <span>HD Prevención</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Plataforma integral de gestión preventiva y cumplimiento legal para empresas y consultores en Chile.
              </p>
              <span className="text-xs text-slate-400">Santiago, Chile • 2026</span>
            </div>

            {/* Módulos */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Cumplimiento Legal</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href={isLoggedIn ? "/panel/buzon-digital" : "/registro"} className="hover:text-orange-400 transition-colors">Canal Ley Karin 72h</Link></li>
                <li><Link href={isLoggedIn ? "/panel/comite-paritario" : "/registro"} className="hover:text-orange-400 transition-colors">Comité Paritario (CPHS)</Link></li>
                <li><Link href={isLoggedIn ? "/panel/investigaciones" : "/registro"} className="hover:text-orange-400 transition-colors">Investigación DIAT 24h</Link></li>
                <li><Link href={isLoggedIn ? "/panel/epp-riohs" : "/registro"} className="hover:text-orange-400 transition-colors">Entrega de EPP & RIOHS</Link></li>
              </ul>
            </div>

            {/* Recursos */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Recursos</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/documentos" className="hover:text-orange-400 transition-colors">Biblioteca de Formatos (+370)</Link></li>
                <li><Link href="/capacitaciones" className="hover:text-orange-400 transition-colors">Capacitaciones y Charlas</Link></li>
                <li><Link href="/planes" className="hover:text-orange-400 transition-colors">Planes y Precios</Link></li>
                <li><Link href="/noticias" className="hover:text-orange-400 transition-colors">Actualizaciones Normativas</Link></li>
              </ul>
            </div>

            {/* Acceso */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Acceso</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/ingreso" className="hover:text-orange-400 transition-colors">Iniciar Sesión</Link></li>
                <li><Link href="/registro" className="hover:text-orange-400 transition-colors">Crear Cuenta Gratuita</Link></li>
                <li><Link href="/contacto" className="hover:text-orange-400 transition-colors">Contacto Comercial</Link></li>
                <li><Link href={isLoggedIn ? "/panel" : "/ingreso"} className="hover:text-orange-400 transition-colors">Panel de Prevención</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>&copy; {new Date().getFullYear()} HD Prevención SpA. Todos los derechos reservados. Desarrollado para la normativa chilena.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/privacidad" className="hover:text-orange-400 transition-colors">Privacidad</Link>
              <span>•</span>
              <Link href="/derechos-arco" className="hover:text-orange-400 transition-colors">Derechos ARCO-POL</Link>
              <span>•</span>
              <Link href="/terminos" className="hover:text-orange-400 transition-colors">Términos del Servicio</Link>
              <span>•</span>
              <Link href="/contacto" className="hover:text-orange-400 transition-colors">Soporte</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
