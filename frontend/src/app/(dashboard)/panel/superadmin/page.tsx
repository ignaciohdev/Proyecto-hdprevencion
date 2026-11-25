"use client";

import { useEffect, useState } from "react";
import { ensureAccessToken, getAdminUrl, getTokenPayload } from "../../../utils/api";

export default function SuperadminPanel() {
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
      <div className="bg-slate-950 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
            Acceso Root
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
            Bienvenido, <span className="text-orange-500">{username || "Superusuario"}</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            Este es tu panel de administración global. Tienes privilegios para auditar base de datos, configurar planes, suspender cuentas y monitorear la salud técnica del servidor.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2.5">
          <a
            href={getAdminUrl("")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-5 rounded-xl shadow-md transition-all inline-block text-sm cursor-pointer"
          >
            Abrir Django Admin 🛠️
          </a>
          <a
            href={getAdminUrl("modulo_prevencion/solicitudderechoarco/")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl transition-all inline-block text-xs cursor-pointer"
          >
            ⚖️ Solicitudes ARCO-POL
          </a>
          <a
            href={getAdminUrl("modulo_prevencion/registrobrechaseguridad/")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl transition-all inline-block text-xs cursor-pointer"
          >
            🛡️ Brechas Art. 14 sexies
          </a>
        </div>
      </div>

      {/* Grid de Métricas de Negocio */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Ingresos Mensuales (MRR)</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">$1.450.000 CLP</p>
          <span className="text-xs text-emerald-500 font-semibold">▲ +12.4% este mes</span>
        </div>

        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Usuarios Registrados</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">342 Usuarios</p>
          <span className="text-xs text-slate-500 font-semibold">14 activos hoy</span>
        </div>

        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Suscripciones Activas</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">84 Cuentas</p>
          <span className="text-xs text-slate-500 font-semibold">22 Consultoras, 62 Indiv.</span>
        </div>

        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Base de Datos</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-1 flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
            <span>PostgreSQL</span>
          </p>
          <span className="text-xs text-slate-500 font-semibold">Puerto 5432 (Local)</span>
        </div>
      </div>

      {/* Auditoría de Usuarios */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 dark:text-white">Auditoría y Gestión de Cuentas</h3>
          <span className="text-xs font-semibold text-slate-500">Últimos registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3">Nombre de Usuario</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Rol / Permisos</th>
                <th className="px-6 py-3">Suscripción</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <tr>
                <td className="px-6 py-4 font-semibold">ignacio_admin</td>
                <td className="px-6 py-4">ignacio@prevencionhd.cl</td>
                <td className="px-6 py-4">
                  <span className="bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs px-2.5 py-1 rounded-full font-bold">
                    Superadmin
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-slate-400">—</td>
                <td className="px-6 py-4 text-right">
                  <a href={getAdminUrl("modulo_prevencion/usuario/")} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-500 font-semibold">Editar</a>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-semibold">hermano_moderador</td>
                <td className="px-6 py-4">moderador@prevencionhd.cl</td>
                <td className="px-6 py-4">
                  <span className="bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1 rounded-full font-bold">
                    Moderador
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-slate-400">—</td>
                <td className="px-6 py-4 text-right">
                  <a href={getAdminUrl("modulo_prevencion/usuario/")} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-500 font-semibold">Editar</a>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-semibold">prevencion_santiago</td>
                <td className="px-6 py-4">contacto@santiagoprevencion.cl</td>
                <td className="px-6 py-4">Socio Corporativo</td>
                <td className="px-6 py-4">
                  <span className="text-emerald-600 font-semibold">Activa (Consultora)</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <a href={getAdminUrl("modulo_prevencion/suscripcion/")} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-500 font-semibold">Ver Suscr.</a>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-semibold">prevencionista_indiv</td>
                <td className="px-6 py-4">prevencionista.carlos@gmail.com</td>
                <td className="px-6 py-4">Individual</td>
                <td className="px-6 py-4">
                  <span className="text-emerald-600 font-semibold">Activa (Básico)</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <a href={getAdminUrl("modulo_prevencion/suscripcion/")} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-500 font-semibold">Ver Suscr.</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
