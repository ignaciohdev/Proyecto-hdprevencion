"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PanelRouter() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/ingreso");
      return;
    }

    try {
      // Decodificar el payload del token JWT
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const decoded = JSON.parse(jsonPayload);

      // Redirección inteligente basada en rol / permisos
      if (decoded.is_superuser) {
        router.push("/panel/superadmin");
      } else if (decoded.is_staff) {
        router.push("/panel/admin-moderador");
      } else if (decoded.tipo_usuario === "CORPORATIVO") {
        router.push("/panel/consultora");
      } else {
        router.push("/panel/cliente");
      }
    } catch (e) {
      router.push("/ingreso");
    }
  }, [router]);

  return (
    <div className="min-h-full flex items-center justify-center flex-col space-y-4">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">
        Cargando tu espacio de trabajo personalizado...
      </p>
    </div>
  );
}
