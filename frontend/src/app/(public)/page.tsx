"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function Home() {
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

    // Detectar si el usuario está autenticado
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
    <>

      {/* 2) Hero principal con frase de impacto */}
      <section className="bg-slate-200 dark:bg-slate-800 py-16 md:py-24 text-center border-b border-slate-300 dark:border-slate-700 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-950 dark:text-white leading-tight mb-6 transition-colors duration-300">
            Liderando la <span className="text-orange-600">Prevención de Riesgos</span> con Innovación
          </h1>
          <p className="text-lg md:text-xl text-slate-700 dark:text-slate-300 max-w-3xl mx-auto mb-8 transition-colors duration-300">
            Soluciones expertas y herramientas digitales para una gestión de seguridad eficiente, cumpliendo y
            superando la normativa chilena.
          </p>
          {isLoggedIn ? (
            <a
              href="/panel"
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded-lg shadow-xl text-lg transition-colors duration-300 transform hover:scale-105 inline-block"
            >
              Ir a mi Panel
            </a>
          ) : (
            <a
              href="/registro"
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded-lg shadow-xl text-lg transition-colors duration-300 transform hover:scale-105 inline-block"
            >
              Comienza Hoy
            </a>
          )}
        </div>
      </section>

      {/* 3) Sección de Alertas y Cambios Normativos en Chile */}
      <section className="bg-white dark:bg-slate-900 py-12 md:py-20 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-950 dark:text-white text-center mb-12 transition-colors duration-300">
            Alertas y Novedades Normativas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Alerta 1 */}
            <article className="bg-slate-100 dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
              <span className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Actualización
              </span>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Nueva Ley de Subcontratación
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 transition-colors duration-300">
                Descubre los cambios clave en la normativa de subcontratación y cómo afectan a tu empresa.
              </p>
              <a href="#" className="text-orange-600 hover:text-orange-700 font-semibold flex items-center">
                Leer más
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </article>
            {/* Alerta 2 */}
            <article className="bg-slate-100 dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
              <span className="inline-block bg-blue-100 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Noticia
              </span>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Fiscalización en Obras de Construcción
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 transition-colors duration-300">
                Refuerzo de fiscalizaciones por la Dirección del Trabajo en seguridad laboral.
              </p>
              <a href="#" className="text-orange-600 hover:text-orange-700 font-semibold flex items-center">
                Leer más
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </article>
            {/* Alerta 3 */}
            <article className="bg-slate-100 dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
              <span className="inline-block bg-green-100 text-green-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Consejo
              </span>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Protocolos COVID-19 Actualizados
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 transition-colors duration-300">
                Guía práctica para mantener tu espacio de trabajo seguro y cumplir con la ley.
              </p>
              <a href="#" className="text-orange-600 hover:text-orange-700 font-semibold flex items-center">
                Leer más
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* 4) Catálogo de formatos de documentos con botón de descarga bloqueado */}
      <section className="bg-slate-200 dark:bg-slate-900 py-12 md:py-20 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-950 dark:text-white text-center mb-12 transition-colors duration-300">
            Descarga de Formatos y Guías
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Documento 1 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-300 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300 flex flex-col items-center text-center">
              <div className="text-6xl text-orange-600 mb-4">📄</div>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Matriz IPER
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 flex-grow transition-colors duration-300">
                Formato editable para la Identificación de Peligros y Evaluación de Riesgos.
              </p>
              <a
                href="/registro?doc=iper"
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors duration-300"
              >
                Descargar (Requiere Registro)
              </a>
            </div>
            {/* Documento 2 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-300 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300 flex flex-col items-center text-center">
              <div className="text-6xl text-orange-600 mb-4">📝</div>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Protocolo TMERT
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 flex-grow transition-colors duration-300">
                Guía completa para la aplicación del Protocolo de Trastornos Músculo Esqueléticos de
                Extremidades Superiores.
              </p>
              <a
                href="/registro?doc=tmert"
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors duration-300"
              >
                Descargar (Requiere Registro)
              </a>
            </div>
            {/* Documento 3 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-300 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300 flex flex-col items-center text-center">
              <div className="text-6xl text-orange-600 mb-4">📋</div>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Plan de Emergencia
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 flex-grow transition-colors duration-300">
                Modelo de plan de emergencia y evacuación adaptado a normativas chilenas.
              </p>
              <a
                href="/registro?doc=emergencia"
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors duration-300"
              >
                Descargar (Requiere Registro)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 5) Bloque de noticias con imágenes de alta calidad generadas por IA */}
      <section className="bg-white dark:bg-slate-900 py-12 md:py-20 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-950 dark:text-white text-center mb-12 transition-colors duration-300">
            Últimas Noticias del Sector
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Noticia 1 */}
            <article className="bg-slate-100 dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
              <div className="relative w-full h-[200px] mb-4 overflow-hidden rounded-lg">
                <Image
                  src="/noticia1.png"
                  alt="Tecnología Wearable en Seguridad Laboral"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  priority
                />
              </div>
              <span className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Innovación
              </span>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Tecnología Wearable en Seguridad Laboral
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 transition-colors duration-300">
                Cómo los dispositivos inteligentes están revolucionando la prevención de accidentes.
              </p>
              <a href="#" className="text-orange-600 hover:text-orange-700 font-semibold flex items-center">
                Leer más
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </article>
            {/* Noticia 2 */}
            <article className="bg-slate-100 dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
              <div className="relative w-full h-[200px] mb-4 overflow-hidden rounded-lg">
                <Image
                  src="/noticia2.png"
                  alt="Prevención Verde: El Futuro ESG"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <span className="inline-block bg-green-100 text-green-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Sustentabilidad
              </span>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Prevención Verde: El Futuro ESG
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 transition-colors duration-300">
                Integrando la seguridad y salud ocupacional con la sostenibilidad ambiental.
              </p>
              <a href="#" className="text-orange-600 hover:text-orange-700 font-semibold flex items-center">
                Leer más
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </article>
            {/* Noticia 3 */}
            <article className="bg-slate-100 dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
              <div className="relative w-full h-[200px] mb-4 overflow-hidden rounded-lg">
                <Image
                  src="/noticia3.png"
                  alt="Impacto de la Ley REP en Empresas"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <span className="inline-block bg-blue-100 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Regulación
              </span>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-3 transition-colors duration-300">
                Impacto de la Ley REP en Empresas
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4 transition-colors duration-300">
                Análisis de cómo la Ley de Responsabilidad Extendida del Productor afecta a la seguridad.
              </p>
              <a href="#" className="text-orange-600 hover:text-orange-700 font-semibold flex items-center">
                Leer más
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* 6) Sección de nuestra historia */}
      <section className="bg-slate-200 dark:bg-slate-900 py-12 md:py-20 transition-colors duration-300">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-950 dark:text-white mb-12 transition-colors duration-300">
            Nuestra Trayectoria en Prevención
          </h2>
          <div className="max-w-4xl mx-auto text-left bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-300 dark:border-slate-700 transition-colors duration-300">
            <p className="text-lg text-slate-700 dark:text-slate-300 mb-6 leading-relaxed transition-colors duration-300">
              En HD Prevención, contamos con{" "}
              <span className="font-bold text-orange-600">más de 15 años de experiencia</span> dedicados a la
              seguridad y salud ocupacional en Chile. Hemos sido testigos y partícipes de la evolución de la
              normativa, adaptando y perfeccionando nuestras metodologías para ofrecer soluciones que no solo cumplen
              con la ley, sino que superan las expectativas.
            </p>
            <p className="text-lg text-slate-700 dark:text-slate-300 mb-6 leading-relaxed transition-colors duration-300">
              Nuestro equipo está conformado por{" "}
              <span className="font-bold text-orange-600">expertos certificados</span> en diversas áreas de la
              prevención de riesgos, desde ingenieros en prevención hasta psicólogos laborales, lo que nos permite
              abordar los desafíos de manera integral y humana. Entendemos que cada empresa es única, por lo que
              ofrecemos un acompañamiento personalizado, centrado en las necesidades específicas de nuestros clientes.
            </p>
            <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed transition-colors duration-300">
              Hemos trabajado con industrias de diversos rubros, desde la minería y construcción hasta el sector
              servicios, implementando sistemas de gestión que han{" "}
              <span className="font-bold text-orange-600">reduciendo significativamente las tasas de accidentabilidad</span>{" "}
              y mejorado la cultura de seguridad. Nuestra historia se construye día a día con el compromiso de crear
              ambientes de trabajo más seguros y saludables para todos.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} HD Prevención. Todos los derechos reservados.</p>
          <div className="flex justify-center space-x-4 mt-4">
            <a href="#" className="hover:text-orange-600 transition-colors duration-300">
              Privacidad
            </a>
            <span className="text-slate-600">|</span>
            <a href="#" className="hover:text-orange-600 transition-colors duration-300">
              Términos
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
