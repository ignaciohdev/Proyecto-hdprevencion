"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../utils/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchPerfil = async (token: string) => {
    try {
      const res = await fetch(getApiUrl("/api/usuarios/perfil/"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Token vencido o inválido.");
      const data = await res.json();
      
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(decodeURIComponent(
        window.atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      ));
      
      setUser({
        ...decoded,
        ...data
      });
      setIsAuthenticated(true);
    } catch (e) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setIsAuthenticated(false);
      router.push("/ingreso");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setIsAuthenticated(false);
      router.push("/ingreso");
      return;
    }

    fetchPerfil(token);

    const handleUserChange = () => {
      const refreshedToken = localStorage.getItem("access_token");
      if (refreshedToken) {
        fetchPerfil(refreshedToken);
      }
    };

    window.addEventListener("userPlanChanged", handleUserChange);
    window.addEventListener("userProfileChanged", handleUserChange);
    return () => {
      window.removeEventListener("userPlanChanged", handleUserChange);
      window.removeEventListener("userProfileChanged", handleUserChange);
    };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_info");
    router.push("/ingreso");
  };

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

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col md:flex-row transition-colors duration-300">
      
      {/* 1) MOBILE HEADER (Navbar superior móvil) */}
      <header className="md:hidden bg-slate-950 text-white flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <a href="/" className="flex items-center space-x-2 text-xl font-extrabold text-orange-600">
          <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-6 w-auto" />
          <span>HD Prevención</span>
        </a>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-slate-400 hover:text-white focus:outline-none"
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

      {/* 2) SIDEBAR (Navegación lateral de escritorio/móvil) */}
      <aside
        className={`${
          isMobileMenuOpen ? "block" : "hidden"
        } md:block md:w-64 bg-slate-950 text-white flex flex-col justify-between border-r border-slate-800 md:min-h-screen transition-all`}
      >
        <div className="px-6 py-8">
          {/* Logo en Escritorio */}
          <div className="hidden md:block mb-10 text-center">
            <a href="/" className="flex flex-col items-center space-y-2 group">
              <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-16 w-auto group-hover:scale-105 transition-transform" />
              <div>
                <span className="text-2xl font-extrabold text-orange-600 tracking-wider">
                  HD Prevención
                </span>
                <p className="text-slate-500 text-xs mt-0.5">Gestión de Riesgos SaaS</p>
              </div>
            </a>
          </div>

          {/* Menú de Enlaces */}
          <nav className="space-y-2">
            <a
              href="/panel"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-sm font-semibold">Resumen General</span>
            </a>


            <a
              href="/panel/planes"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-sm font-semibold">Planes de Suscripción</span>
            </a>

            <a
              href="/panel/perfil"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm font-semibold">Mi Perfil</span>
            </a>

            {/* Enlaces de Trabajo del Prevencionista (Fase 1) */}
            <a
              href="/documentos"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-semibold">Formatos y Descargas</span>
            </a>

            <a
              href="/panel/reportes-riesgo"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm font-semibold">Bitácora de Riesgos</span>
            </a>

            <a
              href="/panel/inspecciones"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-sm font-semibold">Inspecciones en Terreno</span>
            </a>

            <a
              href="/panel/accidentes"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-sm font-semibold">Investigación de Accidentes</span>
            </a>

            <a
              href="/panel/capacitaciones"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-sm font-semibold">Plan de Capacitaciones</span>
            </a>

            {/* Panel de Superadministrador (Full Access) */}
            {user?.is_superuser && (
              <a
                href="/panel/superadmin"
                className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
              >
                <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-sm font-semibold">Panel Superadmin</span>
              </a>
            )}

            {/* Panel de Moderador/Editor (is_staff) */}
            {user?.is_staff && (
              <a
                href="/panel/admin-moderador"
                className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group"
              >
                <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 11-4 0 2 2 0 014 0zm-2 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm font-semibold">Panel Moderador</span>
              </a>
            )}

            {/* Mostrar panel de administración de asientos solo si es cuenta corporativa y no es admin global */}
            {user?.tipo_usuario === "CORPORATIVO" && !user?.is_superuser && !user?.is_staff && (
              <a
                href="/panel/consultora"
                className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors group bg-slate-900 border-l-4 border-orange-600"
              >
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm font-semibold">Administrar Asientos</span>
              </a>
            )}
          </nav>
        </div>

        {/* Footer Sidebar (Info Usuario + Cerrar Sesión) */}
        <div className="px-6 py-6 border-t border-slate-900">
          <a
            href="/panel/perfil"
            className="flex items-center space-x-3 mb-4 hover:bg-slate-900 p-2 -mx-2 rounded-xl transition-all block group"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              {user?.foto_perfil ? (
                <img
                  src={user.foto_perfil}
                  alt={user.username}
                  className="w-10 h-10 rounded-full object-cover border-2 border-orange-500 group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold group-hover:scale-105 transition-transform shrink-0">
                  {user?.username?.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate text-white group-hover:text-orange-500 transition-colors">
                  {user?.username}
                </p>
                <p className="text-xs text-slate-450 truncate">{user?.email}</p>
              </div>
            </div>
          </a>
          
          <button
            onClick={handleLogout}
            className="w-full bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-400 font-semibold py-2 px-4 rounded-xl border border-slate-800 hover:border-red-900 transition-all text-sm flex items-center justify-center space-x-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* 3) MAIN CONTENT CONTAINER */}
      <div className="flex-grow flex flex-col">
        
        {/* Navbar superior escritorio */}
        <header className="hidden md:flex bg-white dark:bg-slate-950 px-8 py-4 border-b border-slate-200 dark:border-slate-800 items-center justify-between transition-colors duration-300">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-sm">Dashboard</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-800 dark:text-white text-sm font-semibold capitalize">
              {user?.is_superuser
                ? "Superadmin"
                : user?.is_staff
                ? "Moderador"
                : user?.tipo_usuario === "CORPORATIVO"
                ? "Consultora"
                : "Cliente"}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs font-semibold bg-orange-100 text-orange-600 px-3 py-1 rounded-full capitalize">
              {user?.is_superuser
                ? "Acceso Total"
                : user?.is_staff
                ? "Administrador"
                : user?.suscripcion_activa?.plan_nombre || "Plan Básico"}
            </span>
          </div>
        </header>

        {/* Contenido Dinámico de Páginas Hijas */}
        <main className="flex-grow p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
