"use client";

import { useEffect, useState, useRef } from "react";

export default function PerfilPanel() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);

  // Formulario y Estados
  const [form, setForm] = useState({
    username: "",
    email: "",
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

  // Cargar perfil inicial
  const loadUserData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const res = await fetch("http://localhost:8000/api/usuarios/perfil/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUsername(data.username);
        setEmail(data.email);
        setFotoPerfilUrl(data.foto_perfil);
        setForm({
          username: data.username,
          email: data.email,
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
    if (form.password && form.password !== form.password_confirm) {
      setError("Las contraseñas nuevas no coinciden.");
      setLoading(false);
      return;
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
      formData.append("password", form.password);
    }

    if (selectedFile) {
      formData.append("foto_perfil", selectedFile);
    } else if (clearPhoto) {
      // Envía vacío para limpiar en el backend
      formData.append("foto_perfil", "");
    }

    try {
      const res = await fetch("http://localhost:8000/api/usuarios/perfil/", {
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
        if (data.username) errorMsg = `Usuario: ${data.username[0]}`;
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
                <label className="block text-xs font-semibold mb-2 text-slate-550 dark:text-slate-400">Nombre de Usuario (Razón Social)</label>
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
                <label className="block text-xs font-semibold mb-2 text-slate-550 dark:text-slate-400">Correo Electrónico</label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-550 dark:text-slate-400">Nueva Contraseña</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-550 dark:text-slate-400">Confirmar Nueva Contraseña</label>
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

    </div>
  );
}
