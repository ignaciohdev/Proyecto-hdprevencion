"use client";

import { useEffect, useState } from "react";
import { ensureAccessToken, getTokenPayload } from "../../../utils/api";

export default function ConsultoraPanel() {
  const [username, setUsername] = useState("");

  useEffect(() => {
    const load = async () => {
      await ensureAccessToken();
      const payload = getTokenPayload();
      if (payload?.username) {
        setUsername(payload.username);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            Consultora: <span className="text-orange-500">{username || "Administrador"}</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            Panel de administración de suscripción corporativa. Gestiona los asientos de tus prevencionistas de riesgo asociados y supervisa sus documentos activos.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-4">
          <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-center">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Asientos Ocupados</p>
            <p className="text-2xl font-extrabold text-orange-500 mt-1">3 / 5</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-center">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Límite Descargas</p>
            <p className="text-2xl font-extrabold text-orange-500 mt-1">Ilimitado</p>
          </div>
        </div>
      </div>

      {/* Grid de Resumen Estadístico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Métrica 1 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center space-x-4">
          <div className="text-4xl bg-orange-100 dark:bg-orange-950/30 p-3 rounded-xl">👤</div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Prevencionistas Activos</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">2 Asientos</p>
          </div>
        </div>

        {/* Métrica 2 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center space-x-4">
          <div className="text-4xl bg-orange-100 dark:bg-orange-950/30 p-3 rounded-xl">📁</div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Documentos del Equipo</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">18 Guardados</p>
          </div>
        </div>

        {/* Métrica 3 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center space-x-4">
          <div className="text-4xl bg-orange-100 dark:bg-orange-950/30 p-3 rounded-xl">🔥</div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Accidentabilidad del Equipo</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">0.0% (Meta)</p>
          </div>
        </div>
      </div>

      {/* Sección Gestión de Equipo */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Equipo de Prevención (Asientos Hijos)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Miembros de tu consultora con acceso a descarga y edición bajo tu suscripción.</p>
          </div>
          <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-all cursor-pointer">
            + Invitar Prevencionista
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3">Usuario / Email</th>
                <th className="px-6 py-3">Rol</th>
                <th className="px-6 py-3">Último Acceso</th>
                <th className="px-6 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <tr>
                <td className="px-6 py-4 font-semibold">
                  <div>pedro.campos</div>
                  <div className="text-xs text-slate-500 font-normal">pedro.campos@consultora.cl</div>
                </td>
                <td className="px-6 py-4">Prevencionista en Terreno</td>
                <td className="px-6 py-4">Hace 2 horas</td>
                <td className="px-6 py-4 text-right">
                  <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold">
                    Activo
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-semibold">
                  <div>maria.valenzuela</div>
                  <div className="text-xs text-slate-500 font-normal">maria.valenzuela@consultora.cl</div>
                </td>
                <td className="px-6 py-4">Auditor de Seguridad</td>
                <td className="px-6 py-4">Ayer a las 18:30</td>
                <td className="px-6 py-4 text-right">
                  <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold">
                    Activo
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
