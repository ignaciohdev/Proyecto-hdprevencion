"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureAccessToken, getTokenPayload } from "../../utils/api";

export default function PanelRouter() {
  const router = useRouter();

  useEffect(() => {
    const resolvePanel = async () => {
      const token = await ensureAccessToken();
      if (!token) {
        router.push("/ingreso");
        return;
      }

      const decoded = getTokenPayload();
      if (!decoded) {
        router.push("/ingreso");
        return;
      }

      if (decoded.is_superuser) {
        router.push("/panel/superadmin");
      } else if (decoded.is_staff) {
        router.push("/panel/admin-moderador");
      } else if (decoded.tipo_usuario === "CORPORATIVO") {
        router.push("/panel/consultora");
      } else {
        router.push("/panel/cliente");
      }
    };

    void resolvePanel();
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
