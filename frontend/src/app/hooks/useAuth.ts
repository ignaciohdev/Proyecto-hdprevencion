"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authFetch, logoutAuth } from "../utils/api";

export interface UserProfile {
  id: number;
  uuid: string;
  username: string;
  email: string;
  tipo_usuario: "INDIVIDUAL" | "CORPORATIVO";
  cuenta_padre_id: number | null;
  is_superuser: boolean;
  is_staff: boolean;
  foto_perfil?: string | null;
  mfa_enabled?: boolean;
  mfa_obligatorio?: boolean;
  mfa_setup_required?: boolean;
  mfa_enrolled_at?: string | null;
  mfa_backup_codes_remaining?: number;
  suscripcion_activa?: {
    id: number;
    plan_nombre: string;
    plan_codigo: string;
    precio: number;
    acceso_servicios: boolean;
    estado: string;
  } | null;
  [key: string]: any;
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPerfil = useCallback(async () => {
    try {
      const res = await authFetch("/api/usuarios/perfil/");
      if (!res.ok) {
        throw new Error("No fue posible cargar el perfil del usuario.");
      }

      const data: UserProfile = await res.json();
      setUser(data);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_info");
        router.push("/ingreso");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Si no hay token de acceso ni refresh en localStorage y estamos en el cliente,
    // aún así intentamos fetchPerfil por si existe la cookie HttpOnly de sesión
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;

    if (!token && !refreshToken) {
      // Intentar fetchPerfil igualmente para validar si hay cookie HttpOnly cross-domain activa
      fetchPerfil();
    } else {
      fetchPerfil();
    }

    const handleUserChange = () => {
      fetchPerfil();
    };

    window.addEventListener("userPlanChanged", handleUserChange);
    window.addEventListener("userProfileChanged", handleUserChange);
    return () => {
      window.removeEventListener("userPlanChanged", handleUserChange);
      window.removeEventListener("userProfileChanged", handleUserChange);
    };
  }, [fetchPerfil]);

  const logout = useCallback(async () => {
    await logoutAuth();
  }, []);

  return {
    user,
    isAuthenticated,
    loading,
    logout,
    refreshUser: fetchPerfil,
  };
}
