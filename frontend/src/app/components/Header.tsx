"use client";

import { useEffect, useState } from "react";

export default function Header() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

    setIsLoggedIn(!!localStorage.getItem("access_token"));
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
    <header className="bg-slate-950 text-white shadow-lg print:hidden">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center space-x-2 text-2xl font-bold text-orange-650 hover:text-orange-500 transition-colors">
          <img src="/logo_dark.png" alt="HD Prevención Logo" className="h-8 w-auto" />
          <span>HD Prevención</span>
        </a>
        <div className="flex items-center space-x-6">
          <div className="hidden md:flex items-center space-x-6">
            <a href="/" className="hover:text-orange-600 transition-colors duration-300">
              Inicio
            </a>
            <a href="/servicios" className="hover:text-orange-600 transition-colors duration-300">
              Servicios
            </a>
            <a href="/capacitaciones" className="hover:text-orange-600 transition-colors duration-300">
              Capacitaciones
            </a>
            <a href="/documentos" className="hover:text-orange-600 transition-colors duration-300">
              Documentos
            </a>
            <a href="/planes" className="hover:text-orange-600 transition-colors duration-300">
              Planes
            </a>
            <a href="/noticias" className="hover:text-orange-600 transition-colors duration-300">
              Noticias
            </a>
            <a href="/contacto" className="hover:text-orange-600 transition-colors duration-300">
              Contacto
            </a>
          </div>
          {/* Toggle de Modo Oscuro */}
          <button
            id="theme-toggle"
            type="button"
            onClick={toggleTheme}
            className="text-slate-400 hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-300 font-medium rounded-lg text-sm p-2.5 flex items-center justify-center cursor-pointer"
          >
            {theme === "dark" ? (
              <svg
                id="theme-toggle-light-icon"
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.071 14.929a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 011.414-1.414l.707.707zm1.414-10.607a1 1 0 011.414 0L7.707 4.343a1 1 0 01-1.414-1.414L5.071 3.657a1 1 0 010 1.414zM3 11a1 1 0 100-2H2a1 1 0 000 2h1z" />
              </svg>
            ) : theme === "light" ? (
              <svg
                id="theme-toggle-dark-icon"
                className="w-5 h-5"
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
          {isLoggedIn ? (
            <a
              href="/panel"
              className="bg-orange-655 hover:bg-orange-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors duration-300"
            >
              Ir al Panel
            </a>
          ) : (
            <a
              href="/ingreso"
              className="bg-orange-655 hover:bg-orange-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors duration-300"
            >
              Ingresar
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}
