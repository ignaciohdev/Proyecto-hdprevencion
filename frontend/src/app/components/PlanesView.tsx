"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../utils/api";

interface PlanInfo {
  id: number;
  nombre: string;
  codigo: string;
  precio: string;
  edicion_nube: boolean;
  marca_agua: boolean;
  marca_blanca: boolean;
  limite_semanal: number;
  asientos: number;
  acceso_servicios?: boolean;
}

export default function PlanesView() {
  const router = useRouter();
  const [planes, setPlanes] = useState<PlanInfo[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [descargasSemanales, setDescargasSemanales] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPlanesYUsuario = async () => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    try {
      // 1. Cargar planes disponibles
      const resPlanes = await fetch(getApiUrl("/api/planes/"));
      if (!resPlanes.ok) throw new Error("Error al cargar los planes.");
      const dataPlanes = await resPlanes.json();
      setPlanes(dataPlanes);

      // 2. Cargar perfil de usuario actual (si está autenticado)
      if (token) {
        const resUser = await fetch(getApiUrl("/api/usuarios/perfil/"), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resUser.ok) {
          const dataUser = await resUser.json();
          setCurrentPlan(dataUser.suscripcion_activa);
          if (dataUser.contador_descargas) {
            setDescargasSemanales(dataUser.contador_descargas.descargas_semanales);
          }
        }
      }
    } catch (error: any) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanesYUsuario();
  }, []);

  const handleCambiarPlan = async (planCodigo: string) => {
    setMessage(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    
    // Si no está autenticado, redirigir al login
    if (!token) {
      router.push(`/ingreso?next=/panel/planes`);
      return;
    }

    setActionLoading(planCodigo);
    try {
      const res = await fetch(getApiUrl("/api/usuarios/cambiar-plan/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan_codigo: planCodigo })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "No se pudo cambiar el plan.");
      }

      const data = await res.json();
      setMessage({
        type: "success",
        text: data.message || `Te has suscrito con éxito al plan.`
      });

      // Disparar evento para actualizar el DashboardLayout (Sidebar y Headers)
      window.dispatchEvent(new Event("userPlanChanged"));
      
      // Recargar datos
      await fetchPlanesYUsuario();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Ayudante para formatear precios en CLP
  const formatPrecio = (precio: string | number) => {
    const val = typeof precio === "string" ? parseFloat(precio) : precio;
    if (val === 0) return "Gratis";
    return `$${val.toLocaleString("es-CL")} CLP / mes`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Cargando planes de suscripción...</p>
      </div>
    );
  }

  // Estilos de color para las tarjetas según el código de plan
  const getCardStyle = (codigo: string, isActive: boolean) => {
    const base = "relative p-6 rounded-3xl shadow-xl border flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl ";
    if (isActive) {
      return base + "bg-white dark:bg-slate-950 border-orange-500 ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-slate-900";
    }
    switch (codigo) {
      case "basico":
        return base + "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800";
      case "profesional":
        return base + "bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/10 dark:to-slate-950 border-emerald-200 dark:border-emerald-900";
      case "expert":
        return base + "bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/10 dark:to-slate-950 border-indigo-200 dark:border-indigo-900";
      case "consultora":
        return base + "bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/10 dark:to-slate-950 border-amber-250 dark:border-amber-900";
      default:
        return base + "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800";
    }
  };

  const getPlanBadge = (codigo: string) => {
    switch (codigo) {
      case "basico":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350";
      case "profesional":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-450";
      case "expert":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-450";
      case "consultora":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getButtonClass = (codigo: string, isActive: boolean) => {
    if (isActive) {
      return "w-full bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600 font-bold py-3 px-4 rounded-2xl text-xs cursor-default text-center";
    }
    switch (codigo) {
      case "basico":
        return "w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all text-center cursor-pointer";
      case "profesional":
        return "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all text-center cursor-pointer shadow-md";
      case "expert":
        return "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all text-center cursor-pointer shadow-md";
      case "consultora":
        return "w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all text-center cursor-pointer shadow-md";
      default:
        return "w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all text-center cursor-pointer";
    }
  };

  return (
    <div className="space-y-8">
      {/* Cabecera / Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-850 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight">Planes de Suscripción</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Elige el plan ideal para automatizar y gestionar la prevención de riesgos en tu empresa.
            Obtén edición en la nube ilimitada, marca blanca y múltiples asientos de usuario según tu nivel.
          </p>
        </div>
      </div>

      {/* Alertas */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold text-center max-w-xl mx-auto shadow-md ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-250"
              : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-250"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Resumen del Plan Activo (Solo si está autenticado y tiene plan activo) */}
      {currentPlan && (
        <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl shadow-md border border-slate-200 dark:border-slate-800 max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1 text-center md:text-left">
            <p className="text-xs font-bold text-slate-450 uppercase tracking-widest">Tu plan activo actual</p>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-center md:justify-start gap-2">
              {currentPlan.plan_nombre}
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-655 dark:bg-orange-950/30 dark:text-orange-400">
                Activo
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Límite de descargas semanales:{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {currentPlan.limite_semanal > 10000 ? "Ilimitado" : currentPlan.limite_semanal}
              </span>
            </p>
          </div>

          {/* Barra de progreso de descargas */}
          <div className="w-full md:w-80 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400">Descargas Utilizadas</span>
              <span className="text-orange-555">
                {currentPlan.limite_semanal > 10000 
                  ? `${descargasSemanales} descargas` 
                  : `${descargasSemanales} de ${currentPlan.limite_semanal}`}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-200/50 dark:border-slate-800">
              <div
                className="bg-orange-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${currentPlan.limite_semanal > 10000 ? 0.1 : (descargasSemanales / currentPlan.limite_semanal) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Tarjetas de Planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto pt-4">
        {planes.map((plan) => {
          const isActive = currentPlan ? currentPlan.plan_codigo === plan.codigo : false;
          return (
            <div key={plan.id} className={getCardStyle(plan.codigo, isActive)}>
              {/* Badge superior */}
              {isActive && (
                <div className="absolute -top-3 right-6 bg-orange-600 text-white font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                  Plan Actual
                </div>
              )}

              {/* Contenido Superior */}
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getPlanBadge(plan.codigo)}`}>
                    {plan.codigo}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">{plan.nombre}</h3>
                  <p className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-2">
                    {formatPrecio(plan.precio)}
                  </p>
                </div>

                {/* Lista de características */}
                <ul className="space-y-2.5 pt-4 text-slate-600 dark:text-slate-450 text-xs border-t border-slate-100 dark:border-slate-850">
                  <li className="flex items-center space-x-2">
                    <span className="text-orange-500 font-bold">✔</span>
                    <span>
                      {plan.limite_semanal > 10000 
                        ? "Descargas semanales ilimitadas" 
                        : `${plan.limite_semanal} descargas semanales`}
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-orange-500 font-bold">✔</span>
                    <span>{plan.asientos === 1 ? "1 Asiento de usuario" : `${plan.asientos} Asientos (Multi-usuario)`}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={plan.edicion_nube ? "text-orange-500 font-bold" : "text-slate-350 dark:text-slate-700 font-bold"}>
                      {plan.edicion_nube ? "✔" : "❌"}
                    </span>
                    <span className={plan.edicion_nube ? "" : "text-slate-400 line-through dark:text-slate-600"}>
                      Edición de archivos en la nube
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={!plan.marca_agua ? "text-orange-500 font-bold" : "text-slate-350 dark:text-slate-700 font-bold"}>
                      {!plan.marca_agua ? "✔" : "❌"}
                    </span>
                    <span className={!plan.marca_agua ? "" : "text-slate-400 dark:text-slate-600"}>
                      {plan.marca_agua ? "Lleva marca de agua visible" : "Descargas limpias sin marca de agua"}
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={plan.marca_blanca ? "text-orange-500 font-bold" : "text-slate-350 dark:text-slate-700 font-bold"}>
                      {plan.marca_blanca ? "✔" : "❌"}
                    </span>
                    <span className={plan.marca_blanca ? "" : "text-slate-400 line-through dark:text-slate-600"}>
                      Marca Blanca (quitar logos del pie)
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={plan.codigo !== "basico" ? "text-orange-500 font-bold" : "text-slate-350 dark:text-slate-700 font-bold"}>
                      {plan.codigo !== "basico" ? "✔" : "❌"}
                    </span>
                    <span className={plan.codigo !== "basico" ? "font-semibold text-orange-600 dark:text-orange-400" : "text-slate-400 line-through dark:text-slate-600"}>
                      Asesorías Técnicas en Terreno
                    </span>
                  </li>
                </ul>
              </div>

              {/* Botón de acción inferior */}
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-850">
                <button
                  onClick={() => !isActive && handleCambiarPlan(plan.codigo)}
                  disabled={isActive || actionLoading !== null}
                  className={getButtonClass(plan.codigo, isActive)}
                >
                  {actionLoading === plan.codigo ? (
                    <span className="flex items-center justify-center space-x-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Activando...</span>
                    </span>
                  ) : isActive ? (
                    "Plan Actual Activo"
                  ) : (
                    "Adquirir Plan"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
