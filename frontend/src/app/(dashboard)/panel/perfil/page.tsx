"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { authFetch, getApiUrl } from "../../../utils/api";

export default function PerfilPanel() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);

  // Formulario y Estados
  const [form, setForm] = useState({
    username: "",
    email: "",
    current_password: "",
    password: "",
    password_confirm: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clearPhoto, setClearPhoto] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados MFA TOTP (P1.2)
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaObligatorio, setMfaObligatorio] = useState(false);
  const [mfaEnrolledAt, setMfaEnrolledAt] = useState<string | null>(null);
  const [mfaBackupRemaining, setMfaBackupRemaining] = useState<number>(0);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[] | null>(null);
  const [mfaActionPassword, setMfaActionPassword] = useState("");
  const [mfaActionCode, setMfaActionCode] = useState("");
  const [mfaShowRegenerate, setMfaShowRegenerate] = useState(false);
  const [mfaShowDisable, setMfaShowDisable] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);

  // Preferencias de comunicaciones SST (Art. 12 Ley 21.719)
  const [marketingNovedades, setMarketingNovedades] = useState(false);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingMsg, setMarketingMsg] = useState<string | null>(null);

  // Cargar perfil inicial
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
        setFotoPerfilUrl(data.foto_perfil);
        setMfaEnabled(Boolean(data.mfa_enabled));
        setMfaObligatorio(Boolean(data.mfa_obligatorio));
        setMfaEnrolledAt(data.mfa_enrolled_at || null);
        setMfaBackupRemaining(Number(data.mfa_backup_codes_remaining || 0));
        setMarketingNovedades(Boolean(data.marketing_novedades));
        setForm({
          username: data.username,
          email: data.email,
          current_password: "",
          password: "",
          password_confirm: "",
        });
      }
    } catch (e) {
      console.error("Error al cargar datos de perfil", e);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Manejo de Archivo/Imagen
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validar tipo de archivo
      if (!file.type.startsWith("image/")) {
        setError("El archivo seleccionado debe ser una imagen.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setClearPhoto(false);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) {
        setError("El archivo seleccionado debe ser una imagen.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setClearPhoto(false);
      setError(null);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFotoPerfilUrl(null);
    setClearPhoto(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Guardar Cambios
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validar contraseña
    if (form.password) {
      if (!form.current_password) {
        setError("Debes ingresar tu contraseña actual para establecer una nueva.");
        setLoading(false);
        return;
      }
      if (form.password !== form.password_confirm) {
        setError("Las contraseñas nuevas no coinciden.");
        setLoading(false);
        return;
      }
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("No se detectó una sesión activa.");
      setLoading(false);
      return;
    }

    // Usar FormData para soportar subida multipart (texto + archivos binarios)
    const formData = new FormData();
    formData.append("username", form.username);
    formData.append("email", form.email);

    if (form.password) {
      formData.append("current_password", form.current_password);
      formData.append("password", form.password);
      formData.append("password_confirm", form.password_confirm);
    }

    if (selectedFile) {
      formData.append("foto_perfil", selectedFile);
    } else if (clearPhoto) {
      // Envía vacío para limpiar en el backend
      formData.append("foto_perfil", "");
    }

    try {
      const res = await fetch(getApiUrl("/api/usuarios/perfil/"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          // NOTA: No seteamos Content-Type para que el navegador configure automáticamente el multipart boundary.
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        let errorMsg = "Error al actualizar el perfil.";
        if (data.current_password) {
          errorMsg = Array.isArray(data.current_password) ? data.current_password[0] : data.current_password;
        } else if (data.password) {
          errorMsg = Array.isArray(data.password) ? data.password[0] : data.password;
        } else if (data.username) errorMsg = `Usuario: ${data.username[0]}`;
        else if (data.email) errorMsg = `Correo: ${data.email[0]}`;
        else if (data.detail) errorMsg = data.detail;
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setSuccess("¡Tu perfil ha sido actualizado con éxito!");
      
      // Actualizar datos del estado
      setUsername(data.username);
      setEmail(data.email);
      setFotoPerfilUrl(data.foto_perfil);
      setPreviewUrl(null);
      setSelectedFile(null);
      setClearPhoto(false);
      setForm((prev) => ({
        ...prev,
        current_password: "",
        password: "",
        password_confirm: "",
      }));

      // Disparar evento para actualizar la barra lateral (Layout) reactivamente
      window.dispatchEvent(new Event("userProfileChanged"));
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado al guardar los cambios.");
    } finally {
      setLoading(false);
    }
  };

  // Handlers MFA TOTP
  const syncMfaFromUser = (u: any) => {
    if (!u) return;
    setMfaEnabled(Boolean(u.mfa_enabled));
    setMfaObligatorio(Boolean(u.mfa_obligatorio));
    setMfaEnrolledAt(u.mfa_enrolled_at || null);
    setMfaBackupRemaining(Number(u.mfa_backup_codes_remaining || 0));
    window.dispatchEvent(new Event("userProfileChanged"));
  };

  const handleMfaIniciar = async () => {
    setMfaLoading(true);
    setMfaError(null);
    setMfaMessage(null);
    setMfaBackupCodes(null);
    try {
      const res = await authFetch("/api/usuarios/mfa/iniciar/", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo iniciar la configuración MFA.");
      setMfaSetupData({ secret: data.secret, otpauth_uri: data.otpauth_uri });
      setMfaCode("");
    } catch (err: any) {
      setMfaError(err.message || "Error al generar secreto MFA.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaLoading(true);
    setMfaError(null);
    try {
      const res = await authFetch("/api/usuarios/mfa/confirmar/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.code) ? data.code[0] : (data.detail || "Código TOTP inválido.");
        throw new Error(msg);
      }
      setMfaSetupData(null);
      setMfaCode("");
      setMfaBackupCodes(data.backup_codes || null);
      setMfaMessage(data.detail || "MFA activado correctamente.");
      syncMfaFromUser(data.user);
    } catch (err: any) {
      setMfaError(err.message || "No se pudo activar MFA.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaRegenerar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaLoading(true);
    setMfaError(null);
    try {
      const res = await authFetch("/api/usuarios/mfa/regenerar-respaldos/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: mfaActionPassword, code: mfaActionCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.current_password)
          ? data.current_password[0]
          : Array.isArray(data.code)
          ? data.code[0]
          : (data.detail || "No se pudieron regenerar los códigos.");
        throw new Error(msg);
      }
      setMfaBackupCodes(data.backup_codes || null);
      setMfaShowRegenerate(false);
      setMfaActionPassword("");
      setMfaActionCode("");
      setMfaMessage(data.detail);
      syncMfaFromUser(data.user);
    } catch (err: any) {
      setMfaError(err.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaDesactivar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaLoading(true);
    setMfaError(null);
    try {
      const res = await authFetch("/api/usuarios/mfa/desactivar/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: mfaActionPassword, code: mfaActionCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.current_password)
          ? data.current_password[0]
          : Array.isArray(data.code)
          ? data.code[0]
          : (data.detail || "No se pudo desactivar MFA.");
        throw new Error(msg);
      }
      setMfaShowDisable(false);
      setMfaBackupCodes(null);
      setMfaActionPassword("");
      setMfaActionCode("");
      setMfaMessage(data.detail);
      syncMfaFromUser(data.user);
    } catch (err: any) {
      setMfaError(err.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDescargarCodigosRespaldo = () => {
    if (!mfaBackupCodes) return;
    const contenido = [
      "HD Prevención - Códigos de Respaldo MFA (un solo uso)",
      `Cuenta: ${username} (${email})`,
      "Guarda estos códigos en un gestor seguro. Cada código solo funciona una vez.",
      "",
      ...mfaBackupCodes,
    ].join("\n");
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hdprevencion-codigos-respaldo-mfa.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleMarketing = async (nuevoEstado: boolean) => {
    setMarketingLoading(true);
    setMarketingMsg(null);
    try {
      const res = await authFetch("/api/usuarios/consentimiento-comunicaciones/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otorgado: nuevoEstado }),
      });
      const data = await res.json();
      if (res.ok) {
        setMarketingNovedades(Boolean(data.otorgado));
        setMarketingMsg(
          data.otorgado
            ? "Consentimiento registrado para novedades normativas SST."
            : "Consentimiento revocado gratuitamente. No enviaremos novedades promocionales."
        );
      }
    } finally {
      setMarketingLoading(false);
    }
  };

  // Iniciales fallback
  const getInitials = () => {
    return username ? username.substring(0, 2).toUpperCase() : "U";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Encabezado */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800">
        <h1 className="text-3xl font-extrabold text-white leading-tight">
          Configuración de <span className="text-orange-500">Mi Perfil</span>
        </h1>
        <p className="text-slate-400 mt-2 text-sm max-w-xl">
          Actualiza tus credenciales de acceso, cambia tu correo electrónico o sube tu foto de perfil para personalizar tu cuenta en HD Prevención.
        </p>
      </div>

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-250 p-4 rounded-xl text-sm font-semibold flex items-center space-x-3 shadow-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-250 p-4 rounded-xl text-sm font-medium flex items-center space-x-3 shadow-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938-4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Foto de Perfil / Avatar */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 w-full text-left">Foto de Perfil</h3>

          {/* Círculo del Avatar */}
          <div className="relative group w-32 h-32 mb-6">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Vista previa"
                className="w-full h-full rounded-full object-cover border-4 border-orange-500 shadow-md"
              />
            ) : fotoPerfilUrl ? (
              <img
                src={fotoPerfilUrl}
                alt="Foto de perfil"
                className="w-full h-full rounded-full object-cover border-4 border-orange-500 shadow-md"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 flex items-center justify-center font-bold text-4xl border-4 border-slate-200 dark:border-slate-800 shadow-inner">
                {getInitials()}
              </div>
            )}
            
            {/* Overlay interactivo en Hover */}
            <div 
              onClick={triggerFileInput}
              className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
            >
              <svg className="w-6 h-6 mb-1 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-wider">Cambiar Foto</span>
            </div>
          </div>

          {/* Zona de Drop & Seleccionar */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="w-full border-2 border-dashed border-slate-200 dark:border-slate-850 hover:border-orange-500 rounded-xl p-4 transition-colors cursor-pointer mb-4"
            onClick={triggerFileInput}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Arrastra una imagen aquí o <span className="text-orange-500 font-bold">búscala</span>.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Botón para remover foto */}
          {(fotoPerfilUrl || previewUrl) && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-xs text-red-500 hover:text-red-650 hover:underline font-semibold flex items-center space-x-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Eliminar foto actual</span>
            </button>
          )}
        </div>

        {/* Columna Derecha / Central: Formulario de Datos */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Card Datos de Cuenta */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6">Datos Personales / Razón Social</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-500 dark:text-slate-400">Nombre de Usuario (Razón Social)</label>
                <input
                  type="text"
                  name="username"
                  required
                  value={form.username}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-500 dark:text-slate-400">Correo Electrónico</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Card Seguridad / Contraseña */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-100 dark:border-slate-900 pb-3 mb-6">
              <h3 className="font-bold text-slate-900 dark:text-white">Cambiar Contraseña</h3>
              <p className="text-xs text-slate-400 mt-1">Completa estos campos únicamente si deseas actualizar tu contraseña de acceso.</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2 text-slate-500 dark:text-slate-400">Contraseña Actual (requerida al cambiar clave)</label>
              <input
                type="password"
                name="current_password"
                value={form.current_password}
                onChange={handleChange}
                placeholder="Ingresa tu contraseña actual"
                autoComplete="current-password"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-500 dark:text-slate-400">Nueva Contraseña</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-500 dark:text-slate-400">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  name="password_confirm"
                  value={form.password_confirm}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl shadow-md text-sm transition-all hover:scale-[1.02] disabled:scale-100 flex items-center space-x-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando cambios...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>

        </div>

      </form>

      {/* Card Autenticación Multifactor MFA TOTP (P1.2) */}
      <section
        id="seguridad-mfa"
        className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-900 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🔐 Autenticación en Dos Pasos (MFA / TOTP)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Protege tu cuenta con códigos temporales de 6 dígitos (Google Authenticator, Authy o gestor TOTP compatible).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mfaEnabled ? (
              <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-3 py-1 rounded-full">
                Activo
              </span>
            ) : mfaObligatorio ? (
              <span className="text-xs font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-3 py-1 rounded-full">
                Pendiente (Obligatorio)
              </span>
            ) : (
              <span className="text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 px-3 py-1 rounded-full">
                Opcional (Inactivo)
              </span>
            )}
          </div>
        </div>

        {mfaError && (
          <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl text-xs font-medium">
            {mfaError}
          </div>
        )}

        {mfaMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-xs font-semibold">
            {mfaMessage}
          </div>
        )}

        {mfaBackupCodes && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Guarda tus códigos de respaldo de un solo uso (se muestran por única vez):
              </p>
              <button
                type="button"
                onClick={handleDescargarCodigosRespaldo}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Descargar .txt
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {mfaBackupCodes.map((c) => (
                <code
                  key={c}
                  className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-center font-mono text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {c}
                </code>
              ))}
            </div>
          </div>
        )}

        {!mfaSetupData ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              {mfaEnabled ? (
                <>
                  <p>
                    MFA habilitado{mfaEnrolledAt ? ` desde ${new Date(mfaEnrolledAt).toLocaleDateString("es-CL")}` : ""}.
                  </p>
                  <p>
                    Códigos de respaldo disponibles: <strong className="text-slate-800 dark:text-slate-200">{mfaBackupRemaining}</strong>
                  </p>
                </>
              ) : (
                <p>
                  {mfaObligatorio
                    ? "Tu perfil de administración o consultora corporativa requiere configurar MFA TOTP antes de operar módulos sensibles en producción."
                    : "Añade una capa extra de protección exigiendo un código temporal al iniciar sesión."}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!mfaEnabled && (
                <button
                  type="button"
                  onClick={handleMfaIniciar}
                  disabled={mfaLoading}
                  className="bg-slate-900 dark:bg-orange-600 hover:bg-slate-800 dark:hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {mfaLoading ? "Generando..." : "Activar MFA con App Autenticadora"}
                </button>
              )}
              {mfaEnabled && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMfaShowRegenerate((v) => !v);
                      setMfaShowDisable(false);
                      setMfaError(null);
                    }}
                    className="bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-3.5 rounded-xl text-xs cursor-pointer"
                  >
                    Regenerar códigos de respaldo
                  </button>
                  {!mfaObligatorio && (
                    <button
                      type="button"
                      onClick={() => {
                        setMfaShowDisable((v) => !v);
                        setMfaShowRegenerate(false);
                        setMfaError(null);
                      }}
                      className="bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-semibold py-2 px-3.5 rounded-xl text-xs cursor-pointer"
                    >
                      Desactivar MFA
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleMfaConfirmar} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-slate-50 dark:bg-slate-900/60 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-white p-3 rounded-xl shadow-sm">
                <QRCodeSVG value={mfaSetupData.otpauth_uri} size={172} />
              </div>
              <div className="text-center">
                <p className="text-[11px] text-slate-500">Clave manual (Base32):</p>
                <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 select-all">
                  {mfaSetupData.secret}
                </code>
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <p className="font-bold">1. Escanea el código QR con Google Authenticator o Authy.</p>
                <p>2. Ingresa el código de 6 dígitos que aparece en la app para confirmar:</p>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={mfaLoading}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {mfaLoading ? "Confirmando..." : "Confirmar y Activar MFA"}
                </button>
                <button
                  type="button"
                  onClick={() => setMfaSetupData(null)}
                  className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        {(mfaShowRegenerate || mfaShowDisable) && (
          <form
            onSubmit={mfaShowRegenerate ? handleMfaRegenerar : handleMfaDesactivar}
            className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
          >
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {mfaShowRegenerate
                ? "Confirmar regeneración de códigos de respaldo"
                : "Confirmar desactivación de MFA"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="password"
                required
                value={mfaActionPassword}
                onChange={(e) => setMfaActionPassword(e.target.value)}
                placeholder="Contraseña actual"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs"
              />
              <input
                type="text"
                required
                value={mfaActionCode}
                onChange={(e) => setMfaActionCode(e.target.value)}
                placeholder="Código TOTP de 6 dígitos"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={mfaLoading}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {mfaLoading ? "Procesando..." : mfaShowRegenerate ? "Generar nuevos códigos" : "Desactivar MFA"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMfaShowRegenerate(false);
                  setMfaShowDisable(false);
                }}
                className="text-xs text-slate-500 underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Preferencias de Privacidad y Comunicaciones (Art. 12 Ley 21.719) */}
      <section className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              Privacidad y Comunicaciones Normativas (Ley N° 21.719)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Administra o revoca gratuitamente tu consentimiento opcional para recibir novedades SST y consulta tus derechos ARCO-POL.
            </p>
          </div>
          <label className="inline-flex items-center gap-2.5 cursor-pointer shrink-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl">
            <input
              type="checkbox"
              checked={marketingNovedades}
              disabled={marketingLoading}
              onChange={(e) => handleToggleMarketing(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {marketingLoading ? "Guardando..." : "Recibir novedades SST"}
            </span>
          </label>
        </div>

        {marketingMsg && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {marketingMsg}
          </p>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-900 flex flex-wrap gap-4 text-xs">
          <a href="/privacidad" target="_blank" className="text-orange-600 hover:underline font-semibold">
            Ver Política de Privacidad (v1.0)
          </a>
          <a href="/derechos-arco" target="_blank" className="text-orange-600 hover:underline font-semibold">
            Ejercer Derechos ARCO-POL (/derechos-arco)
          </a>
        </div>
      </section>

    </div>
  );
}
