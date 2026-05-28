"use client";

import { useEffect, useState } from "react";

export default function ModeradorPanel() {
  const [username, setUsername] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        setUsername(payload.username);
      } catch (e) {}
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <span className="bg-blue-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
            Editor de Contenidos
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
            Moderador: <span className="text-orange-500">{username || "Administrador"}</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            Este panel simplificado está diseñado para la gestión diaria del portal. Aquí puedes subir nuevos formatos de prevención de riesgos oficiales y redactar/editar las noticias que ven los clientes.
          </p>
        </div>
      </div>

      {/* Grid de Secciones de Control */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Sección 1: Formatos de Prevención (Plantillas Maestras) */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-55 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>📁</span>
                <span>Formatos Oficiales (Plantillas Maestras)</span>
              </h3>
              <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition-all cursor-pointer">
                + Subir Formato
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              {/* Item 1 */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <p className="font-bold text-sm">Matriz IPER General</p>
                  <p className="text-xs text-slate-500">Tipo: XLSX | Actualizado: Hace 3 días</p>
                </div>
                <button className="text-orange-600 hover:text-orange-500 font-semibold text-xs cursor-pointer">Actualizar</button>
              </div>

              {/* Item 2 */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <p className="font-bold text-sm">Protocolo TMERT Paso a Paso</p>
                  <p className="text-xs text-slate-500">Tipo: DOCX | Actualizado: Hace 1 semana</p>
                </div>
                <button className="text-orange-600 hover:text-orange-500 font-semibold text-xs cursor-pointer">Actualizar</button>
              </div>

              {/* Item 3 */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <p className="font-bold text-sm">Plan de Emergencia Pyme</p>
                  <p className="text-xs text-slate-500">Tipo: PDF | Actualizado: 26/05/2026</p>
                </div>
                <button className="text-orange-600 hover:text-orange-500 font-semibold text-xs cursor-pointer">Actualizar</button>
              </div>
            </div>
          </div>
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-900 text-center">
            <a href="http://localhost:8000/admin/modulo_prevencion/plantillamaestra/" target="_blank" className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-350 underline">Ver todas en Django Admin</a>
          </div>
        </div>

        {/* Sección 2: Noticias del Sector */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-55 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>📰</span>
                <span>Noticias Publicadas</span>
              </h3>
              <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition-all cursor-pointer">
                + Redactar Noticia
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Noticia 1 */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="overflow-hidden mr-4">
                  <p className="font-bold text-sm truncate">Tecnología Wearable en Seguridad Laboral</p>
                  <p className="text-xs text-slate-500">Estado: Activo | Autor: Hermano Admin</p>
                </div>
                <div className="flex space-x-2 text-xs">
                  <button className="text-orange-600 hover:text-orange-500 font-semibold cursor-pointer">Editar</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-red-500 hover:text-red-400 cursor-pointer">Bajar</button>
                </div>
              </div>

              {/* Noticia 2 */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="overflow-hidden mr-4">
                  <p className="font-bold text-sm truncate">Prevención Verde: El Futuro ESG</p>
                  <p className="text-xs text-slate-500">Estado: Activo | Autor: Hermano Admin</p>
                </div>
                <div className="flex space-x-2 text-xs">
                  <button className="text-orange-600 hover:text-orange-500 font-semibold cursor-pointer">Editar</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-red-500 hover:text-red-400 cursor-pointer">Bajar</button>
                </div>
              </div>

              {/* Noticia 3 */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="overflow-hidden mr-4">
                  <p className="font-bold text-sm truncate">Impacto de la Ley REP en Empresas</p>
                  <p className="text-xs text-slate-500">Estado: Borrador | Autor: Hermano Admin</p>
                </div>
                <div className="flex space-x-2 text-xs">
                  <button className="text-orange-600 hover:text-orange-500 font-semibold cursor-pointer">Publicar</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-slate-500 hover:text-slate-700 cursor-pointer">Editar</button>
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-900 text-center">
            <span className="text-xs text-slate-400">Total artículos publicados: 3 (1 borrador)</span>
          </div>
        </div>

      </div>
    </div>
  );
}
