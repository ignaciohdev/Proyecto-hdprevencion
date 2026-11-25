"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser } from "../../utils/api";

export default function ServiciosRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void getSessionUser().then((user) => {
      if (user) {
        router.replace("/panel/servicios");
      }
    });
  }, [router]);

  return (
    <main className="container mx-auto px-4 py-20 max-w-2xl text-center space-y-6 animate-fadeIn">
      <div className="w-20 h-20 bg-orange-100 dark:bg-orange-950/40 text-orange-600 rounded-3xl flex items-center justify-center text-4xl mx-auto border border-orange-200 dark:border-orange-900/50 shadow-inner">
        🔒
      </div>
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-900/50">
          Beneficio Exclusivo de Suscripción
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          Asesorías y Servicios Técnicos en Terreno
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
          Esta sección ahora forma parte exclusiva del panel de control para clientes con planes de suscripción de pago (Profesional, Expert y Consultora).
        </p>
      </div>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
        <a
          href="/planes"
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-8 rounded-xl text-sm shadow-md transition-all hover:scale-[1.02] cursor-pointer"
        >
          Ver Planes de Suscripción →
        </a>
        <a
          href="/ingreso"
          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-3.5 px-6 rounded-xl text-sm transition-all cursor-pointer"
        >
          Iniciar Sesión
        </a>
      </div>
    </main>
  );
}
