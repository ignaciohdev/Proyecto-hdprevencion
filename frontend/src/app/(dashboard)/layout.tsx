"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Mostrar indicador de carga mientras se valida la sesión
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center flex-col space-y-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-semibold">Verificando sesión segura...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isPaidPlan =
    user?.is_superuser ||
    user?.is_staff ||
    (user?.suscripcion_activa &&
      (user.suscripcion_activa.acceso_servicios ||
        user.suscripcion_activa.precio > 0) &&
      user.suscripcion_activa.plan_codigo !== "basico");

  // Función auxiliar para determinar si un enlace está activo
  const isActive = (href: string) => {
    if (href === "/panel") {
      return pathname === "/panel";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const getLinkClasses = (href: string) => {
    const active = isActive(href);
    return `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group text-xs font-semibold ${
      active
        ? "bg-orange-500/10 text-orange-400 font-bold border-l-4 border-orange-500 shadow-sm"
        : "text-slate-300 hover:text-white hover:bg-slate-900/90"
    }`;
  };

  const getIconClasses = (href: string) => {
    const active = isActive(href);
    return `w-4 h-4 shrink-0 transition-colors ${
      active ? "text-orange-500" : "text-slate-400 group-hover:text-orange-500"
    }`;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col md:flex-row transition-colors duration-300">
      
      {/* 1) MOBILE HEADER (Navbar superior móvil) */}
      <header className="md:hidden bg-slate-950 text-white flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 z-50">
        <a href="/" className="flex items-center space-x-2 text-xl font-extrabold text-orange-600">
          <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-7 w-auto" />
          <span>HD Prevención</span>
        </a>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-slate-400 hover:text-white focus:outline-none p-1.5"
          aria-label="Abrir menú de navegación"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* 2) SIDEBAR (Navegación lateral de escritorio/móvil con scroll estilizado) */}
      <aside
        className={`${
          isMobileMenuOpen ? "block" : "hidden"
        } md:block md:w-64 bg-slate-950 text-white flex flex-col justify-between border-r border-slate-800/90 md:min-h-screen md:sticky md:top-0 md:h-screen shrink-0 transition-all z-40`}
      >
        <div className="px-4 py-6 flex flex-col h-full overflow-hidden">
          {/* Logo en Escritorio */}
          <div className="hidden md:block mb-6 px-2 text-center shrink-0">
            <a href="/" className="flex flex-col items-center space-y-1.5 group">
              <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-12 w-auto group-hover:scale-105 transition-transform" />
              <div>
                <span className="text-xl font-extrabold text-orange-600 tracking-wider block">
                  HD Prevención
                </span>
                <p className="text-slate-500 text-[11px]">Gestión de Riesgos SST</p>
              </div>
            </a>
          </div>

          {/* Menú de Enlaces Estructurado en 6 Bloques con Scroll Ergonómico */}
          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] pr-1 custom-scrollbar flex-1 pb-4">
            
            {/* BLOQUE 1: VISTA GENERAL */}
            <div className="space-y-1">
              <a href="/panel" className={getLinkClasses("/panel")}>
                <svg className={getIconClasses("/panel")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Resumen General</span>
              </a>
            </div>

            {/* BLOQUE 2: GESTIÓN & MATRICES (D.S. 44) */}
            <div className="pt-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1">
                GESTIÓN & MATRICES
              </div>

              <a href="/panel/matriz-legal" className={getLinkClasses("/panel/matriz-legal")}>
                <svg className={getIconClasses("/panel/matriz-legal")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <span>Matriz Legal por Rubro</span>
              </a>

              <a href="/panel/matriz-riesgos" className={getLinkClasses("/panel/matriz-riesgos")}>
                <svg className={getIconClasses("/panel/matriz-riesgos")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Matriz de Riesgos (MIPER)</span>
              </a>

              <a href="/panel/comite-paritario" className={getLinkClasses("/panel/comite-paritario")}>
                <svg className={getIconClasses("/panel/comite-paritario")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Comité Paritario (CPHS)</span>
              </a>
            </div>

            {/* BLOQUE 3: OPERACIÓN EN FAENA */}
            <div className="pt-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1">
                OPERACIÓN EN FAENA
              </div>

              <a href="/panel/epp-riohs" className={getLinkClasses("/panel/epp-riohs")}>
                <svg className={getIconClasses("/panel/epp-riohs")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Entrega EPP y RIOHS</span>
              </a>

              <a href="/panel/reportes-riesgo" className={getLinkClasses("/panel/reportes-riesgo")}>
                <svg className={getIconClasses("/panel/reportes-riesgo")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Reportes QR y Hallazgos</span>
              </a>

              <a href="/panel/inspecciones" className={getLinkClasses("/panel/inspecciones")}>
                <svg className={getIconClasses("/panel/inspecciones")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Checklists e Inspecciones</span>
              </a>

              <a href="/panel/capacitaciones" className={getLinkClasses("/panel/capacitaciones")}>
                <svg className={getIconClasses("/panel/capacitaciones")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Capacitaciones y Charlas</span>
              </a>

              <a href="/panel/accidentes" className={getLinkClasses("/panel/accidentes")}>
                <svg className={getIconClasses("/panel/accidentes")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m-4-4h8m-9 7h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Investigación de Accidentes</span>
              </a>

              <a href="/panel/contratistas" className={getLinkClasses("/panel/contratistas")}>
                <svg className={getIconClasses("/panel/contratistas")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Contratistas (Ley 20.123)</span>
              </a>
            </div>

            {/* BLOQUE 4: CANAL FORMAL */}
            <div className="pt-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1">
                CANAL FORMAL
              </div>

              <a href="/panel/buzon-digital" className={getLinkClasses("/panel/buzon-digital")}>
                <svg className={getIconClasses("/panel/buzon-digital")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Canal Ley Karin y Buzón</span>
              </a>
            </div>

            {/* BLOQUE 5: RECURSOS */}
            <div className="pt-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1">
                RECURSOS
              </div>

              <a href="/documentos" className={getLinkClasses("/documentos")}>
                <svg className={getIconClasses("/documentos")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Formatos y Descargas (+370)</span>
              </a>
            </div>

            {/* BLOQUE 6: CONFIGURACIÓN (Borde sutil superior) */}
            <div className="pt-2 mt-2 border-t border-slate-900/90">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1">
                CONFIGURACIÓN
              </div>

              {/* Asesorías y Servicios Exclusivos */}
              {isPaidPlan && (
                <a
                  href="/panel/servicios"
                  className={getLinkClasses("/panel/servicios")}
                >
                  <svg className={getIconClasses("/panel/servicios")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
                  </svg>
                  <div className="flex items-center justify-between flex-grow">
                    <span>Asesorías Premium</span>
                    <span className="text-[9px] bg-orange-600/30 text-orange-400 border border-orange-500/40 px-1.5 py-0.2 rounded font-bold uppercase">
                      PRO
                    </span>
                  </div>
                </a>
              )}

              <a href="/panel/planes" className={getLinkClasses("/panel/planes")}>
                <svg className={getIconClasses("/panel/planes")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Planes de Suscripción</span>
              </a>

              <a href="/panel/perfil" className={getLinkClasses("/panel/perfil")}>
                <svg className={getIconClasses("/panel/perfil")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Mi Perfil</span>
              </a>

              {/* Panel de Superadministrador (Full Access) */}
              {user?.is_superuser && (
                <a href="/panel/superadmin" className={getLinkClasses("/panel/superadmin")}>
                  <svg className={getIconClasses("/panel/superadmin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Panel Superadmin</span>
                </a>
              )}

              {/* Panel de Moderador/Editor (is_staff) */}
              {user?.is_staff && (
                <a href="/panel/admin-moderador" className={getLinkClasses("/panel/admin-moderador")}>
                  <svg className={getIconClasses("/panel/admin-moderador")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 11-4 0 2 2 0 014 0zm-2 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Panel Moderador</span>
                </a>
              )}

              {/* Administrar asientos si es corporativo */}
              {user?.tipo_usuario === "CORPORATIVO" && !user?.is_superuser && !user?.is_staff && (
                <a href="/panel/consultora" className={getLinkClasses("/panel/consultora")}>
                  <svg className={getIconClasses("/panel/consultora")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Administrar Asientos</span>
                </a>
              )}
            </div>
          </nav>
        </div>

        {/* Footer Sidebar (Info Usuario + Cerrar Sesión) */}
        <div className="px-5 py-4 border-t border-slate-900 bg-slate-950 shrink-0">
          <a
            href="/panel/perfil"
            className="flex items-center space-x-3 mb-3 hover:bg-slate-900/80 p-2 -mx-2 rounded-xl transition-all block group"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              {user?.foto_perfil ? (
                <img
                  src={user.foto_perfil}
                  alt={user.username}
                  className="w-9 h-9 rounded-full object-cover border-2 border-orange-500 group-hover:scale-105 transition-transform shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform shrink-0">
                  {user?.username?.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate text-white group-hover:text-orange-500 transition-colors">
                  {user?.username}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
          </a>
          
          <button
            onClick={logout}
            className="w-full bg-slate-900/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 font-semibold py-2 px-3 rounded-xl border border-slate-800 hover:border-red-900/50 transition-all text-xs flex items-center justify-center space-x-2 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* 3) MAIN CONTENT CONTAINER */}
      <div className="flex-grow flex flex-col min-w-0">
        
        {/* Navbar superior escritorio */}
        <header className="hidden md:flex bg-white dark:bg-slate-950 px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 items-center justify-between transition-colors duration-300">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-xs font-medium">Dashboard</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-800 dark:text-white text-xs font-semibold capitalize">
              {user?.is_superuser
                ? "Superadmin"
                : user?.is_staff
                ? "Moderador"
                : user?.tipo_usuario === "CORPORATIVO"
                ? "Consultora"
                : "Cliente"}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span
              className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-full"
              title="HD Prevención PWA: Funciona en faenas y minería sin conexión 4G/5G"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Modo Faena PWA</span>
            </span>
            <span className="text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full capitalize">
              {user?.is_superuser
                ? "Acceso Total"
                : user?.is_staff
                ? "Administrador"
                : user?.suscripcion_activa?.plan_nombre || "Plan Básico"}
            </span>
          </div>
        </header>

        {/* Contenido Dinámico de Páginas Hijas */}
        <main className="flex-grow p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
