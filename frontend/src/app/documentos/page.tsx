"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";

interface PlantillaMaestra {
  id: number;
  nombre: string;
  tipo_archivo: string;
  fecha_ultima_actualizacion: string;
  archivo_fuente?: string;
}

interface DocumentoUsuario {
  id: number;
  username: string;
  plantilla_maestra: number;
  plantilla_maestra_detalle: PlantillaMaestra;
  datos_guardados: any;
  fecha_ultimo_guardado: string;
  esta_desactualizado: boolean;
}

export default function DocumentosPage() {
  const router = useRouter();
  const [plantillas, setPlantillas] = useState<PlantillaMaestra[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Modal de Subida (Admins)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    nombre: "",
    tipo_archivo: "XLSX",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Modal de Previsualización (Ejemplo con Marca de Agua)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PlantillaMaestra | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    try {
      // 1. Obtener plantillas
      const resPlantillas = await fetch("http://localhost:8000/api/plantillas-maestras/", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      let dataPlantillas = [];
      if (resPlantillas.ok) {
        dataPlantillas = await resPlantillas.json();
      }

      // Fallbacks mock si está vacía
      if (dataPlantillas.length === 0) {
        dataPlantillas = [
          { id: 1, nombre: "Matriz IPER General", tipo_archivo: "XLSX", fecha_ultima_actualizacion: new Date().toISOString() },
          { id: 2, nombre: "Protocolo TMERT Paso a Paso", tipo_archivo: "DOCX", fecha_ultima_actualizacion: new Date().toISOString() },
          { id: 3, nombre: "Plan de Emergencia Pyme", tipo_archivo: "PDF", fecha_ultima_actualizacion: new Date().toISOString() },
        ];
      }
      setPlantillas(dataPlantillas);

      // 2. Obtener documentos guardados
      if (token) {
        const resDocs = await fetch("http://localhost:8000/api/documentos-usuario/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resDocs.ok) {
          const dataDocs = await resDocs.json();
          setDocumentos(dataDocs);
        }
      }

      // 3. Obtener perfil del usuario
      if (token) {
        const resUser = await fetch("http://localhost:8000/api/usuarios/perfil/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resUser.ok) {
          const dataUser = await resUser.json();
          setUser(dataUser);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/ingreso");
      return;
    }
    try {
      const payload = JSON.parse(window.atob(token.split(".")[1]));
      setIsAdmin(payload.is_superuser || payload.is_staff);
    } catch (e) {}
    fetchData();
  }, []);

  const handleCrearDocumento = async (plantilla: PlantillaMaestra) => {
    const token = localStorage.getItem("access_token");
    
    if (user && user.suscripcion_activa && !user.suscripcion_activa.edicion_nube) {
      alert("Tu plan actual (Básico) no permite la creación o edición de documentos en la nube. Por favor, adquiere un plan Profesional, Expert o Consultora.");
      return;
    }
    
    let datos_inicial = {};
    if (plantilla.id === 1 || plantilla.nombre.includes("IPER")) {
      datos_inicial = { filas: [] };
    } else if (plantilla.id === 2 || plantilla.nombre.includes("TMERT")) {
      datos_inicial = { repetitividad: "BAJO", fuerza: "BAJO", postura: "BAJO", conclusiones: "" };
    } else {
      datos_inicial = { empresa: "", rut: "", direccion: "", brigadistas: "", zonas_seguridad: "" };
    }

    try {
      const res = await fetch("http://localhost:8000/api/documentos-usuario/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plantilla_maestra: plantilla.id,
          datos_guardados: datos_inicial,
        }),
      });

      if (!res.ok) throw new Error("Error al inicializar el documento.");
      const data = await res.json();
      router.push(`/documentos/editar/${data.id}`);
    } catch (err: any) {
      const mockId = Math.floor(Math.random() * 1000) + 1000;
      router.push(`/documentos/editar/${mockId}?mock=true&plantilla=${plantilla.id}`);
    }
  };

  const handleUploadTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Por favor selecciona un archivo.");
      return;
    }

    setUploading(true);
    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    formData.append("nombre", uploadForm.nombre);
    formData.append("tipo_archivo", uploadForm.tipo_archivo);
    formData.append("archivo_fuente", selectedFile);

    try {
      const res = await fetch("http://localhost:8000/api/plantillas-maestras/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Error al subir el documento.");
      
      alert("¡Plantilla Maestra subida con éxito!");
      setIsUploadModalOpen(false);
      setUploadForm({ nombre: "", tipo_archivo: "XLSX" });
      setSelectedFile(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm("¿Deseas eliminar esta copia guardada? Esta acción no se puede deshacer.")) return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`http://localhost:8000/api/documentos-usuario/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar el documento.");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDescargarArchivo = async (id: number, type: "XLSX" | "DOCX", docName: string) => {
    const token = localStorage.getItem("access_token");
    const endpoint = type === 'XLSX' ? 'descargar-excel' : 'descargar-docx';
    const url = `http://localhost:8000/api/documentos-usuario/${id}/${endpoint}/`;
    
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Error al descargar el archivo");
      
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      
      const cleanName = docName.replace(/[^a-zA-Z0-9_\-]/g, "_");
      link.setAttribute("download", `${cleanName}_${id}.${type.toLowerCase()}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      alert("No se pudo descargar el archivo: " + error.message);
    }
  };

  const handleOpenPreview = async (plantilla: PlantillaMaestra) => {
    setPreviewTemplate(plantilla);
    setIsPreviewModalOpen(true);
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewData(null);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`http://localhost:8000/api/plantillas-maestras/${plantilla.id}/preview/`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error("No se pudo obtener la vista previa del archivo.");
      const data = await res.json();
      setPreviewData(data);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Encabezado */}
        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
              Documentación en la Nube
            </span>
            <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
              Gestor de Formatos y Matriz IPER
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xl">
              Selecciona una plantilla oficial para iniciar una edición interactiva en la nube o visualiza ejemplos oficiales protegidos con marca de agua.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-4 md:mt-0 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              + Subir Plantilla (Admin)
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Grid de Contadores de Capacidad y Copias */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Card de Capacidad de Descargas */}
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Cupo de Descargas Semanales</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Descargas consumidas en la semana en curso</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Descargas Utilizadas</span>
                    <span className="text-orange-600 dark:text-orange-500 font-bold font-mono">
                      {user?.suscripcion_activa?.limite_semanal > 10000 
                        ? `${user?.contador_descargas?.descargas_semanales || 0} descargas (Ilimitadas)`
                        : `${user?.contador_descargas?.descargas_semanales || 0} de ${user?.suscripcion_activa?.limite_semanal || 5} descargas`}
                    </span>
                  </div>
                  
                  {/* Barra de progreso */}
                  <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-orange-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          user?.suscripcion_activa?.limite_semanal > 10000
                            ? 0.1
                            : ((user?.contador_descargas?.descargas_semanales || 0) / (user?.suscripcion_activa?.limite_semanal || 5)) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tu cupo se restablece de forma automática todos los días lunes a las 00:00 hrs.
                  </p>
                </div>
              </div>

              {/* Card de Almacenamiento de Copias */}
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 5.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                    <span>Almacenamiento de Copias</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Documentos persistidos en tu cuenta de HD Prevención</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Espacio de Almacenamiento</span>
                    <span className={`font-bold font-mono ${documentos.length >= 5 ? 'text-red-500' : documentos.length >= 4 ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
                      {documentos.length} de 5 copias guardadas
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        documentos.length >= 5
                          ? 'bg-red-500'
                          : documentos.length >= 4
                          ? 'bg-orange-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((documentos.length / 5) * 100, 100)}%` }}
                    ></div>
                  </div>
                  
                  <p className={`text-[10px] ${documentos.length >= 5 ? 'text-red-550 dark:text-red-400 font-semibold' : 'text-slate-405 dark:text-slate-400'}`}>
                    {documentos.length >= 5 
                      ? '⚠️ Límite de 5 copias alcanzado. Si creas una nueva copia, la más antigua se eliminará automáticamente.' 
                      : 'Puedes guardar hasta 5 copias. Si superas el límite, se auto-eliminará la más antigua.'}
                  </p>
                </div>
              </div>

            </div>

            {/* SECCIÓN 1: Catálogo de Plantillas */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                <span>📋</span>
                <span>Formatos Oficiales Disponibles</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plantillas.map((plantilla) => (
                  <div
                    key={plantilla.id}
                    className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-lg transition-all duration-300"
                  >
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${plantilla.tipo_archivo === 'XLSX' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {plantilla.tipo_archivo}
                      </span>
                      <h3 className="text-lg font-bold mt-2 text-slate-900 dark:text-white">
                        {plantilla.nombre}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Última actualización: {new Date(plantilla.fecha_ultima_actualizacion).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="mt-6 flex space-x-3">
                      <button
                        onClick={() => handleOpenPreview(plantilla)}
                        className="w-1/2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer text-center"
                      >
                        Ver Ejemplo
                      </button>
                      <button
                        onClick={() => handleCrearDocumento(plantilla)}
                        className="w-1/2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer text-center shadow-md"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 2: Mis Documentos Guardados */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                <span>💾</span>
                <span>Mis Copias y Ediciones Guardadas</span>
              </h2>
              <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                {documentos.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Aún no tienes copias guardadas en la nube. Selecciona una plantilla superior para empezar.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-3">Documento</th>
                          <th className="px-6 py-3">Último Guardado</th>
                          <th className="px-6 py-3">Vigencia</th>
                          <th className="px-6 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {documentos.map((doc) => (
                          <tr key={doc.id}>
                            <td className="px-6 py-4 font-semibold">
                              {doc.plantilla_maestra_detalle?.nombre || "Documento Personalizado"}
                            </td>
                            <td className="px-6 py-4">
                              {new Date(doc.fecha_ultimo_guardado).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              {doc.esta_desactualizado ? (
                                <span className="bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                  Desactualizado
                                </span>
                              ) : (
                                <span className="bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                  Al Día
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => {
                                  if (user && user.suscripcion_activa && !user.suscripcion_activa.edicion_nube) {
                                    alert("Tu plan actual (Básico) no permite la edición de documentos en la nube. Por favor, actualiza tu plan en la sección de Planes de Suscripción.");
                                    return;
                                  }
                                  router.push(`/documentos/editar/${doc.id}`);
                                }}
                                className="text-orange-655 hover:text-orange-500 font-semibold cursor-pointer"
                              >
                                Editar
                              </button>
                              <span className="text-slate-300">|</span>
                              {doc.plantilla_maestra_detalle?.tipo_archivo === "DOCX" ? (
                                <button
                                  onClick={() => handleDescargarArchivo(doc.id, "DOCX", doc.plantilla_maestra_detalle.nombre)}
                                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold cursor-pointer"
                                >
                                  Word
                                </button>
                              ) : doc.plantilla_maestra_detalle?.tipo_archivo === "XLSX" ? (
                                <button
                                  onClick={() => handleDescargarArchivo(doc.id, "XLSX", doc.plantilla_maestra_detalle.nombre)}
                                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold cursor-pointer"
                                >
                                  Excel
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (user && user.suscripcion_activa && !user.suscripcion_activa.edicion_nube) {
                                      alert("Tu plan actual (Básico) no permite la edición/visualización de documentos en la nube. Por favor, actualiza tu plan en la sección de Planes de Suscripción.");
                                      return;
                                    }
                                    router.push(`/documentos/editar/${doc.id}?print=true`);
                                  }}
                                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-350 font-semibold cursor-pointer"
                                >
                                  PDF
                                </button>
                              )}
                              <span className="text-slate-300">|</span>
                              <button
                                onClick={() => handleEliminar(doc.id)}
                                className="text-red-500 hover:text-red-450 font-semibold cursor-pointer"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* MODAL 1: Subida de Plantilla Maestra (Admins) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              Subir Nueva Plantilla Oficial
            </h2>

            <form onSubmit={handleUploadTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre del Formato</label>
                <input
                  type="text"
                  required
                  value={uploadForm.nombre}
                  onChange={(e) => setUploadForm({ ...uploadForm, nombre: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ej. Checklist de Herramientas Eléctricas"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Tipo de Formato</label>
                  <select
                    value={uploadForm.tipo_archivo}
                    onChange={(e) => setUploadForm({ ...uploadForm, tipo_archivo: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="XLSX">Microsoft Excel (XLSX)</option>
                    <option value="DOCX">Microsoft Word (DOCX)</option>
                    <option value="PDF">Adobe PDF (PDF)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Archivo Fuente</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {uploading ? "Subiendo..." : "Subir Archivo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Previsualización de Ejemplo con Marca de Agua */}
      {isPreviewModalOpen && previewTemplate && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative">
            
            {/* Header del Modal */}
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Previsualización de Ejemplo: {previewTemplate.nombre}
              </h2>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg cursor-pointer"
              >
                ❌
              </button>
            </div>

            {/* CUERPO DEL DOCUMENTO CON MARCA DE AGUA */}
            <div className="relative border border-slate-200 dark:border-slate-850 rounded-xl p-6 bg-slate-50 dark:bg-slate-900/20 select-none">
              
              {/* CAPA DE MARCA DE AGUA */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10 opacity-15">
                <div className="text-red-650 dark:text-red-400 font-black text-6xl md:text-8xl tracking-widest uppercase select-none pointer-events-none transform -rotate-45 whitespace-nowrap">
                  EJEMPLO • EJEMPLO • EJEMPLO
                </div>
              </div>

              {/* Contenido Dinámico de Vista Previa */}
              {loadingPreview ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-slate-400 font-semibold">Procesando archivo para vista previa...</span>
                </div>
              ) : previewError || !previewData ? (
                <div className="space-y-4">
                  {previewError && (
                    <div className="bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 p-3 rounded-lg text-xs font-semibold mb-4">
                      ⚠ Nota: No se pudo obtener la vista previa real ({previewError}). Mostrando plantilla de ejemplo simulada.
                    </div>
                  )}
                  {/* Fallback de ejemplo estático tradicional */}
                  {(previewTemplate.id === 1 || previewTemplate.nombre.includes("IPER")) ? (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA DE MATRIZ IPER</p>
                      <table className="w-full text-left border-collapse text-[10px] min-w-[700px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-850">
                            <th className="p-2 border-r border-slate-200 dark:border-slate-850">Actividad / Tarea</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-850">Peligro</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-850">Riesgo</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-850 text-center">P</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-850 text-center">S</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-850 text-center">Riesgo</th>
                            <th className="p-2">Medidas de Control</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100 dark:border-slate-850">
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850 font-medium">Trabajo en Altura (Fachadas)</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850">Caída de distinto nivel</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850">Fracturas, traumatismo grave, muerte</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850 text-center">3</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850 text-center">5</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850 text-center font-bold bg-red-50 text-red-700">15 (Crítico)</td>
                            <td className="p-2">Arnés de seguridad, línea de vida, barandas perimetrales y andamios certificados.</td>
                          </tr>
                          <tr>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850 font-medium">Operación de Esmeril Angular</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850">Proyección de partículas incandescentes</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850">Corte, lesiones oculares graves</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850 text-center">2</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850 text-center">4</td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-850 text-center font-bold bg-amber-50 text-amber-700">8 (Medio)</td>
                            <td className="p-2">Uso obligatorio de antiparras de seguridad y careta facial completa. Pantallas de protección.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (previewTemplate.id === 2 || previewTemplate.nombre.includes("TMERT")) ? (
                    <div className="space-y-4 bg-white dark:bg-slate-950 p-4 rounded-lg">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA DE EVALUACIÓN TMERT</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><strong>Empresa de Ejemplo:</strong> Comercializadora Metalúrgica Ltda.</div>
                        <div><strong>RUT:</strong> 77.777.777-7</div>
                        <div className="col-span-2"><strong>Dirección:</strong> Av. Industrial 500, Maipú</div>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-850 pt-3 space-y-2 text-xs">
                        <div className="flex justify-between border-b pb-1.5">
                          <span><strong>Repetitividad de Movimiento:</strong></span>
                          <span className="font-bold text-red-650 bg-red-50 px-2 py-0.5 rounded">ALTO (Crítico)</span>
                        </div>
                        <div className="flex justify-between border-b pb-1.5">
                          <span><strong>Uso de Fuerza Física:</strong></span>
                          <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">MEDIO (Precaución)</span>
                        </div>
                        <div className="flex justify-between">
                          <span><strong>Postura Corporal Crítica:</strong></span>
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">BAJO (Controlado)</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 bg-white dark:bg-slate-950 p-4 rounded-lg">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA DE PLAN DE EMERGENCIA Y EVACUACIÓN</p>
                      <div className="space-y-2 text-xs">
                        <p><strong>Razón Social:</strong> Logística Central S.A.</p>
                        <p><strong>Ubicación de Extintores:</strong> 2 extintores PQS de 6kg en pasillo de oficinas, 1 de CO2 en sala de servidores.</p>
                        <p><strong>Líder de Evacuación:</strong> Supervisor de Prevención de Turno.</p>
                        <p><strong>Zonas de Seguridad / Puntos de Encuentro:</strong> Zona demarcada con pintura amarilla en el estacionamiento frontal exterior.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full">
                  {previewData.tipo === 'XLSX' && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA REAL DEL DOCUMENTO EXCEL (MUESTRA DE 20 FILAS)</p>
                      <div className="overflow-x-auto max-h-[500px] border border-slate-200 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-left border-collapse text-[11px] min-w-[800px] bg-white dark:bg-slate-950">
                          <tbody>
                            {previewData.data.rows.map((row: any[], rIdx: number) => {
                              const isHeader = rIdx === 0 || (rIdx === 3 && row.some(c => c && c.toString().includes("Peligro")));
                              return (
                                <tr key={rIdx} className={isHeader ? "bg-slate-100 dark:bg-slate-900 font-bold border-b border-slate-350 dark:border-slate-800 text-slate-800 dark:text-slate-200" : "border-b border-slate-150 dark:border-slate-900"}>
                                  {row.map((cell: any, cIdx: number) => (
                                    <td key={cIdx} className={`p-2 border-r border-slate-200 dark:border-slate-850 max-w-[200px] truncate ${isHeader ? "font-semibold text-slate-900 dark:text-white" : ""}`}>
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {previewData.tipo === 'DOCX' && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA REAL DEL DOCUMENTO WORD (TABLAS Y PÁRRAFOS ORIGINALES)</p>
                      
                      {/* Pagina de papel simulada */}
                      <div className="bg-white dark:bg-slate-950 p-6 md:p-10 rounded-2xl shadow-xl max-h-[600px] overflow-y-auto font-sans leading-relaxed text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-850 max-w-3xl mx-auto text-left relative">
                        
                        {/* 1. SECCION CABECERA */}
                        {previewData.data.header && previewData.data.header.length > 0 && (
                          <div className="border-b border-slate-250 dark:border-slate-800 pb-4 mb-6">
                            {previewData.data.header.map((el: any, elIdx: number) => {
                              if (el.type === 'table') {
                                return (
                                  <table key={elIdx} className="w-full border-collapse border border-slate-300 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950">
                                    <tbody>
                                      {el.rows.map((row: any[], rIdx: number) => (
                                        <tr key={rIdx} className="border-b border-slate-200 dark:border-slate-800">
                                          {row.map((cell: any, cIdx: number) => (
                                            <td key={cIdx} className="border border-slate-300 dark:border-slate-800 p-2 text-center align-middle font-medium bg-slate-50/10 dark:bg-slate-900/10">
                                              {cell.parts && cell.parts.length > 0 ? (
                                                cell.parts.map((part: any, pIdx: number) => {
                                                  if (part.type === 'image') {
                                                    return <img key={pIdx} src={part.value} className="max-h-12 max-w-full object-contain mx-auto" alt="logo header" />;
                                                  }
                                                  return <span key={pIdx}>{part.value}</span>;
                                                })
                                              ) : ""}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              } else {
                                return (
                                  <p key={elIdx} className="text-center text-[10px] text-slate-400 mt-1">
                                    {el.parts.map((p: any, pIdx: number) => p.value).join("")}
                                  </p>
                                );
                              }
                            })}
                          </div>
                        )}

                        {/* 2. SECCION CUERPO */}
                        <div className="space-y-4">
                          {previewData.data.body && previewData.data.body.map((el: any, elIdx: number) => {
                            if (el.type === 'table') {
                              return (
                                <table key={elIdx} className="w-full border-collapse border border-slate-300 dark:border-slate-800 text-xs bg-white dark:bg-slate-950">
                                  <tbody>
                                    {el.rows.map((row: any[], rIdx: number) => (
                                      <tr key={rIdx} className="border-b border-slate-200 dark:border-slate-800">
                                        {row.map((cell: any, cIdx: number) => (
                                          <td key={cIdx} className="border border-slate-300 dark:border-slate-800 p-2 text-left align-middle bg-slate-50/5 dark:bg-slate-900/5">
                                            {cell.parts && cell.parts.map((part: any, pIdx: number) => {
                                              if (part.type === 'image') {
                                                return <img key={pIdx} src={part.value} className="max-h-16 max-w-full object-contain mx-auto" alt="body image" />;
                                              }
                                              return (
                                                <span key={pIdx}>
                                                  {part.value
                                                    .replace("{{EMPRESA}}", "[Nombre de la Empresa]")
                                                    .replace("{{REPRESENTANTE_LEGAL}}", "[Nombre del Representante Legal]")
                                                    .replace("{{DIA}}", "[Día]")
                                                    .replace("{{MES}}", "[Mes]")
                                                    .replace("{{ANIO}}", "[Año]")
                                                  }
                                                </span>
                                              );
                                            })}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              );
                            } else {
                              const fullText = el.parts.map((p: any) => p.value).join("");
                              const isTitle = fullText.toUpperCase() === fullText && fullText.length > 5 && fullText.length < 150;
                              return (
                                <p key={elIdx} className={isTitle ? "text-center font-extrabold text-base text-slate-950 dark:text-white border-b pb-2 mb-4 tracking-wide" : "text-sm text-justify leading-relaxed whitespace-pre-wrap"}>
                                  {el.parts.map((part: any, pIdx: number) => {
                                    if (part.type === 'image') {
                                      return <img key={pIdx} src={part.value} className="max-h-16 inline-block mx-2" alt="body inline img" />;
                                    }
                                    return (
                                      <span key={pIdx}>
                                        {part.value
                                          .replace("{{EMPRESA}}", "[Nombre de la Empresa]")
                                          .replace("{{REPRESENTANTE_LEGAL}}", "[Nombre del Representante Legal]")
                                          .replace("{{DIA}}", "[Día]")
                                          .replace("{{MES}}", "[Mes]")
                                          .replace("{{ANIO}}", "[Año]")
                                        }
                                      </span>
                                    );
                                  })}
                                </p>
                              );
                            }
                          })}
                        </div>

                        {/* 3. SECCION PIE DE PAGINA */}
                        {previewData.data.footer && previewData.data.footer.length > 0 && (
                          <div className="border-t border-slate-250 dark:border-slate-800 pt-4 mt-8">
                            {previewData.data.footer.map((el: any, elIdx: number) => {
                              if (el.type === 'table') {
                                return (
                                  <table key={elIdx} className="w-full border-collapse border border-slate-300 dark:border-slate-800 text-[10px] text-slate-500 bg-white dark:bg-slate-950">
                                    <tbody>
                                      {el.rows.map((row: any[], rIdx: number) => (
                                        <tr key={rIdx} className="border-b border-slate-200 dark:border-slate-800">
                                          {row.map((cell: any, cIdx: number) => (
                                            <td key={cIdx} className="border border-slate-300 dark:border-slate-800 p-2 text-left align-middle font-medium bg-slate-50/5 dark:bg-slate-900/5">
                                              {cell.parts && cell.parts.length > 0 ? (
                                                cell.parts.map((part: any, pIdx: number) => {
                                                  if (part.type === 'image') {
                                                    return <img key={pIdx} src={part.value} className="max-h-8 object-contain" alt="logo footer" />;
                                                  }
                                                  return <span key={pIdx}>{part.value}</span>;
                                                })
                                              ) : ""}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              } else {
                                return (
                                  <p key={elIdx} className="text-left text-[10px] text-slate-400 mt-1">
                                    {el.parts.map((p: any, pIdx: number) => p.value).join("")}
                                  </p>
                                );
                              }
                            })}
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                  {previewData.tipo === 'PDF' && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400">VISTA PREVIA REAL DEL DOCUMENTO PDF (NATIVO)</p>
                      <div className="w-full h-[600px] border border-slate-250 dark:border-slate-800 rounded-lg overflow-hidden bg-white">
                        <iframe src={`${previewData.data.url}#toolbar=0`} className="w-full h-full border-none" />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer del Modal */}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-6 rounded-xl text-xs cursor-pointer shadow-md"
              >
                Cerrar Previsualización
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
