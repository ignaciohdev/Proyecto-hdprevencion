"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import { getApiUrl } from "../utils/api";

interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string;
  activo: boolean;
}

export default function ServiciosPage() {
  const router = useRouter();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServicios = async () => {
      const token = localStorage.getItem("access_token");
      try {
        const res = await fetch(getApiUrl("/api/servicios/"), {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        if (!res.ok) throw new Error("Error al cargar los servicios.");
        const data = await res.json();
        setServicios(data);
      } catch (err: any) {
        setError(err.message);
        setServicios([
          {
            id: 1,
            nombre: "Evaluación Ergónomica de Puestos de Trabajo",
            descripcion: "Estudio detallado de las condiciones ergonómicas en oficinas y faenas industriales para prevenir lesiones músculo-esqueléticas bajo la norma técnica TMERT.",
            icono: "activity",
            activo: true,
          },
          {
            id: 2,
            nombre: "Asesoría en Constitución de Comité Paritario",
            descripcion: "Guía legal completa y acompañamiento para la constitución y correcto funcionamiento del Comité Paritario de Higiene y Seguridad (DS 54).",
            icono: "users",
            activo: true,
          },
          {
            id: 3,
            nombre: "Auditoría de Sistemas de Gestión (Suso / ISO 45001)",
            descripcion: "Evaluación del sistema de gestión de seguridad y salud en el trabajo para identificar brechas de cumplimiento respecto al estándar internacional ISO 45001.",
            icono: "clipboard-list",
            activo: true,
          },
          {
            id: 4,
            nombre: "Capacitaciones Obligatorias de Seguridad (ODI)",
            descripcion: "Diseño y realización de la Obligación de Informar (ODI / DAS) para el personal de su empresa, asegurando el cumplimiento legal ante fiscalizaciones.",
            icono: "book-open",
            activo: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchServicios();
  }, []);

  const handleSolicitar = (servicioNombre: string) => {
    router.push(`/contacto?asunto=Solicitud de servicio: ${encodeURIComponent(servicioNombre)}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Encabezado */}
        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800">
          <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
            Servicios Premium
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
            Asesorías y Servicios de Prevención
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl">
            Como cliente de HD Prevención, tienes acceso a tarifas preferenciales y soporte prioritario para auditorías oficiales, evaluaciones técnicas y capacitaciones certificadas.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {servicios.map((servicio) => (
              <div
                key={servicio.id}
                className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-lg transition-all duration-300"
              >
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 rounded-xl text-xl font-bold">
                      {servicio.icono === "users" ? "👥" : servicio.icono === "activity" ? "⚡" : servicio.icono === "book-open" ? "📖" : "📋"}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                      {servicio.nombre}
                    </h3>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                    {servicio.descripcion}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-900">
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                    Disponible
                  </span>
                  <button
                    onClick={() => handleSolicitar(servicio.nombre)}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    Solicitar Cotización
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
