"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../../utils/api";

interface DescargaLog {
  id: number;
  nombre: string;
  formato: string;
  fecha: string;
}

export default function ClientePanel() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [descargasSemanales, setDescargasSemanales] = useState(0);
  const [descargasLimite, setDescargasLimite] = useState(5);

  // Descargas simuladas para el log (pueden ser extendidas/cargadas del backend en el futuro)
  const [descargasLog, setDescargasLog] = useState<DescargaLog[]>([
    { id: 1, nombre: "Matriz_IPER_Obras_Constructora.xlsx", formato: "XLSX", fecha: "27/05/2026 15:42" },
    { id: 2, nombre: "Plan_Emergencia_Oficinas_Providencia.pdf", formato: "PDF", fecha: "26/05/2026 11:20" },
  ]);

  const loadUserData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const res = await fetch(getApiUrl("/api/usuarios/perfil/"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUsername(data.username);
        setEmail(data.email);
        if (data.contador_descargas) {
          setDescargasSemanales(data.contador_descargas.descargas_semanales);
        }
        if (data.suscripcion_activa) {
          setDescargasLimite(data.suscripcion_activa.limite_semanal);
        }
      } else {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        setUsername(payload.username);
        setEmail(payload.email);
      }
    } catch (e) {
      const payload = JSON.parse(window.atob(token.split(".")[1]));
      setUsername(payload.username);
      setEmail(payload.email);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800">
        <h1 className="text-3xl font-extrabold text-white leading-tight">
          ¡Hola, <span className="text-orange-500">{username || "Cliente"}</span>!
        </h1>
        <p className="text-slate-400 mt-2 text-sm max-w-xl">
          Bienvenido a tu panel privado de control en HD Prevención. Revisa tu cupo de descargas semanales y visualiza tu registro histórico.
        </p>
      </div>

      <div className="space-y-6">
        {/* Card de Capacidad */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Capacidad de Documentos</h3>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-450 font-semibold">Descargas Disponibles (Semana Actual)</span>
              <span className="font-bold text-orange-500">
                {descargasLimite > 10000
                  ? `${descargasSemanales} descargas (Ilimitadas)`
                  : `${descargasSemanales} de ${descargasLimite} descargas`}
              </span>
            </div>
            {/* Barra de progreso */}
            <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3.5 overflow-hidden">
              <div
                className="bg-orange-500 h-full rounded-full transition-all"
                style={{ width: `${descargasLimite > 10000 ? 0.1 : (descargasSemanales / descargasLimite) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400">
              Tu cupo se restablece de forma automática todos los días lunes a las 00:00 hrs.
            </p>
          </div>
        </div>

        {/* Historial de Descargas */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">Registro de Descargas Recientes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-450 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3">Nombre del Archivo</th>
                  <th className="px-6 py-3 text-center">Formato</th>
                  <th className="px-6 py-3">Fecha y Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {descargasLog.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{log.nombre}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${log.formato === 'XLSX' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-755'}`}>
                        {log.formato}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{log.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
