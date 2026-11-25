"use client";

import { useEffect, useState } from "react";
import { getSessionUser } from "../utils/api";

export default function Header() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      root.classList.contains("dark") ||
      localStorage.getItem("color-theme") === "dark" ||
      (!("color-theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
      setTheme("dark");
    } else {
      root.classList.remove("dark");
      setTheme("light");
    }

    void getSessionUser().then((user) => {
      setIsLoggedIn(Boolean(user));
    });
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      localStorage.setItem("color-theme", "light");
      setTheme("light");
    } else {
      root.classList.add("dark");
      localStorage.setItem("color-theme", "dark");
      setTheme("dark");
    }
  };

  return (
    <header className="bg-slate-950 text-white shadow-lg print:hidden sticky top-0 z-40 border-b border-slate-800/80 backdrop-blur-md bg-slate-950/95">
      <nav className="container mx-auto px-4 py-3.5 flex items-center justify-between">
        {/* Logo de HD Prevención */}
        <a
          href="/"
          className="flex items-center space-x-2 text-xl sm:text-2xl font-bold text-orange-600 hover:text-orange-500 transition-colors"
        >
          <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-8 w-auto" />
          <span className="font-extrabold tracking-tight">HD Prevención</span>
        </a>

        {/* Enlaces Centrales de Navegación (Orden Ergonómico del Prevencionista) */}
        <div className="hidden lg:flex items-center space-x-7 text-sm font-semibold text-slate-300">
          <a
            href="/"
            className="hover:text-orange-500 transition-colors duration-200"
          >
            Inicio
          </a>
          <a
            href="/documentos"
            className="hover:text-orange-500 transition-colors duration-200"
          >
            Formatos y Matrices
          </a>
          <a
            href="/noticias"
            className="hover:text-orange-500 transition-colors duration-200"
          >
            Actualidad Normativa
          </a>
          <a
            href="/planes"
            className="hover:text-orange-500 transition-colors duration-200"
          >
            Planes y Precios
          </a>
          <a
            href="/contacto"
            className="hover:text-orange-500 transition-colors duration-200"
          >
            Contacto
          </a>
        </div>

        {/* Acciones de Usuario + Toggle Tema */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Toggle de Modo Oscuro/Claro */}
          <button
            id="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema claro y oscuro"
            className="text-slate-400 hover:text-white hover:bg-slate-800/80 focus:outline-none font-medium rounded-xl text-sm p-2 flex items-center justify-center transition-colors cursor-pointer"
          >
            {theme === "dark" ? (
              <svg
                id="theme-toggle-light-icon"
                className="w-5 h-5 text-amber-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.071 14.929a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 011.414-1.414l.707.707zm1.414-10.607a1 1 0 011.414 0L7.707 4.343a1 1 0 01-1.414-1.414L5.071 3.657a1 1 0 010 1.414zM3 11a1 1 0 100-2H2a1 1 0 000 2h1z" />
              </svg>
            ) : theme === "light" ? (
              <svg
                id="theme-toggle-dark-icon"
                className="w-5 h-5 text-slate-300"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <div className="w-5 h-5" />
            )}
          </button>

          {/* Botones Condicionales de Sesión */}
          {isLoggedIn ? (
            <a
              href="/panel"
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 sm:px-5 rounded-xl shadow-md shadow-orange-600/20 transition-all hover:scale-[1.02] text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>Ir a mi Panel</span>
              <span>→</span>
            </a>
          ) : (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <a
                href="/ingreso"
                className="text-slate-300 hover:text-white font-semibold text-xs sm:text-sm transition-colors py-2 px-2.5 sm:px-3 rounded-lg hover:bg-slate-900"
              >
                Iniciar Sesión
              </a>
              <a
                href="/registro"
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-3.5 sm:px-4.5 rounded-xl shadow-md shadow-orange-600/20 transition-all hover:scale-[1.02] text-xs sm:text-sm cursor-pointer whitespace-nowrap"
              >
                Comenzar Gratis
              </a>
            </div>
          )}

          {/* Botón Menú Móvil */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-900"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Menú Desplegable Móvil */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-slate-950 border-t border-slate-800 px-4 py-4 space-y-2 text-sm font-semibold">
          <a
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 px-3 rounded-lg hover:bg-slate-900 text-slate-200 hover:text-orange-500"
          >
            Inicio
          </a>
          <a
            href="/documentos"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 px-3 rounded-lg hover:bg-slate-900 text-slate-200 hover:text-orange-500"
          >
            Formatos y Matrices
          </a>
          <a
            href="/noticias"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 px-3 rounded-lg hover:bg-slate-900 text-slate-200 hover:text-orange-500"
          >
            Actualidad Normativa
          </a>
          <a
            href="/planes"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 px-3 rounded-lg hover:bg-slate-900 text-slate-200 hover:text-orange-500"
          >
            Planes y Precios
          </a>
          <a
            href="/contacto"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 px-3 rounded-lg hover:bg-slate-900 text-slate-200 hover:text-orange-500"
          >
            Contacto
          </a>
        </div>
      )}
    </header>
  );
}
