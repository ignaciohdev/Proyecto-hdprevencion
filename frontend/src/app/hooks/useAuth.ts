"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authFetch, clearLegacyTokenStorage, logoutAuth, setAccessToken } from "../utils/api";

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
      const res = await authFetch("/api/usuarios/perfil/", {
        ...({ redirectOnFail: false } as any),
      });
      if (!res.ok) {
        throw new Error("No fue posible cargar el perfil del usuario.");
      }

      const data: UserProfile = await res.json();
      setUser(data);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      if (typeof window !== "undefined") {
        clearLegacyTokenStorage();
        router.push("/ingreso");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPerfil();

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
