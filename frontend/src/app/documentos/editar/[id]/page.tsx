"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "../../../components/Header";
import { getApiUrl } from "../../../utils/api";

interface FilaIPER {
  id: number;
  actividad: string;
  peligro: string;
  riesgo: string;
  probabilidad: number;
  severidad: number;
  medidas_control: string;
}

function DocumentoEditorInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const docId = params.id as string;
  const isMock = searchParams.get("mock") === "true";
  const templateTypeParam = searchParams.get("plantilla") || "1";
  const autoPrint = searchParams.get("print") === "true";

  const [docName, setDocName] = useState("Cargando documento...");
  const [templateId, setTemplateId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Estados de datos
  const [filasIPER, setFilasIPER] = useState<FilaIPER[]>([]);
  const [datosTMERT, setDatosTMERT] = useState({
    empresa: "",
    rut: "",
    direccion: "",
    repetitividad: "BAJO",
    fuerza: "BAJO",
    postura: "BAJO",
    conclusiones: "",
  });
  const [datosPlan, setDatosPlan] = useState({
    empresa: "",
    rut: "",
    direccion: "",
    trabajadores: "1",
    lider: "",
    extintores: "",
    punto_encuentro: "",
  });
  const [datosPolitica, setDatosPolitica] = useState({
    empresa: "",
    representante_legal: "",
    dia: "",
    mes: "",
    anio: "",
  });

  useEffect(() => {
    const fetchDocumento = async () => {
      setLoading(true);
      const token = localStorage.getItem("access_token");

      if (isMock) {
        const tid = parseInt(templateTypeParam);
        setTemplateId(tid);
        if (tid === 1) {
          setDocName("Matriz IPER General (Edición)");
          setFilasIPER([
            { id: 1, actividad: "Trabajos en Altura", peligro: "Caída de distinto nivel", riesgo: "Fracturas o muerte", probabilidad: 3, severidad: 5, medidas_control: "Uso de arnés de seguridad de 3 puntas, línea de vida y andamio certificado." },
            { id: 2, actividad: "Uso de Herramientas Eléctricas", peligro: "Contacto con energía eléctrica", riesgo: "Electrocución / quemaduras", probabilidad: 2, severidad: 4, medidas_control: "Revisión de cables y enchufes previo al uso, guantes dieléctricos y protector visual." }
          ]);
        } else if (tid === 2) {
          setDocName("Protocolo TMERT Paso a Paso (Edición)");
          setDatosTMERT({
            empresa: "Constructora Alfa S.A.",
            rut: "76.543.210-K",
            direccion: "Av. Providencia 1234, Santiago",
            repetitividad: "MEDIO",
            fuerza: "BAJO",
            postura: "MEDIO",
            conclusiones: "Se recomienda realizar pausas activas de 5 minutos cada 1 hora de trabajo repetitivo.",
          });
        } else if (tid === 4) {
          setDocName("Política de Seguridad y Salud en el Trabajo (Edición)");
          setDatosPolitica({
            empresa: "Constructora Alfa S.A.",
            representante_legal: "Juan Pérez García",
            dia: "28",
            mes: "Mayo",
            anio: "2026",
          });
        } else {
          setDocName("Plan de Emergencia Pyme (Edición)");
          setDatosPlan({
            empresa: "Comercializadora Beta Ltda.",
            rut: "88.888.888-8",
            direccion: "Av. Las Condes 9900, Las Condes",
            trabajadores: "15",
            lider: "Juan Pérez",
            extintores: "3 extintores PQS de 6kg vigentes",
            punto_encuentro: "Estacionamiento principal exterior",
          });
        }
        setLoading(false);
        return;
      }

      try {
        // Verificar si el plan del usuario permite la edición en la nube
        const resUser = await fetch(getApiUrl("/api/usuarios/perfil/"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resUser.ok) {
          const dataUser = await resUser.json();
          if (dataUser.suscripcion_activa && !dataUser.suscripcion_activa.edicion_nube) {
            alert("Tu plan actual (Básico) no permite la edición de documentos en la nube. Serás redirigido a la sección de Planes de Suscripción.");
            router.push("/panel/planes");
            return;
          }
        }

        const res = await fetch(getApiUrl(`/api/documentos-usuario/${docId}/`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Error al obtener el documento.");
        const data = await res.json();

        setDocName(data.plantilla_maestra_detalle?.nombre || "Edición de Documento");
        const tid = data.plantilla_maestra;
        setTemplateId(tid);

        const guardados = data.datos_guardados || {};
        if (tid === 1 || data.plantilla_maestra_detalle?.nombre?.includes("IPER")) {
          setFilasIPER(guardados.filas || []);
        } else if (tid === 2 || data.plantilla_maestra_detalle?.nombre?.includes("TMERT")) {
          setDatosTMERT({
            empresa: guardados.empresa || "",
            rut: guardados.rut || "",
            direccion: guardados.direccion || "",
            repetitividad: guardados.repetitividad || "BAJO",
            fuerza: guardados.fuerza || "BAJO",
            postura: guardados.postura || "BAJO",
            conclusiones: guardados.conclusiones || "",
          });
        } else if (tid === 4 || data.plantilla_maestra_detalle?.nombre?.toLowerCase().includes("política") || data.plantilla_maestra_detalle?.nombre?.toLowerCase().includes("politica")) {
          setDatosPolitica({
            empresa: guardados.empresa || "",
            representante_legal: guardados.representante_legal || "",
            dia: guardados.dia || "",
            mes: guardados.mes || "",
            anio: guardados.anio || "",
          });
        } else {
          setDatosPlan({
            empresa: guardados.empresa || "",
            rut: guardados.rut || "",
            direccion: guardados.direccion || "",
            trabajadores: guardados.trabajadores || "1",
            lider: guardados.lider || "",
            extintores: guardados.extintores || "",
            punto_encuentro: guardados.punto_encuentro || "",
          });
        }
      } catch (err: any) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocumento();
  }, [docId, isMock, templateTypeParam]);

  // Manejo de auto-print
  useEffect(() => {
    if (!loading && autoPrint) {
      setTimeout(() => {
        window.print();
      }, 1000);
    }
  }, [loading, autoPrint]);

  const handleAddFilaIPER = () => {
    const newId = filasIPER.length > 0 ? Math.max(...filasIPER.map(f => f.id)) + 1 : 1;
    setFilasIPER([
      ...filasIPER,
      {
        id: newId,
        actividad: "",
        peligro: "",
        riesgo: "",
        probabilidad: 1,
        severidad: 1,
        medidas_control: "",
      }
    ]);
  };

  const handleRemoveFilaIPER = (id: number) => {
    setFilasIPER(filasIPER.filter(f => f.id !== id));
  };

  const handleFilaIPERChange = (id: number, field: keyof FilaIPER, value: any) => {
    setFilasIPER(filasIPER.map(f => {
      if (f.id === id) {
        return { ...f, [field]: value };
      }
      return f;
    }));
  };

  const getRiesgoEstilo = (prob: number, sev: number) => {
    const score = prob * sev;
    if (score >= 15) return { bg: "bg-red-100 text-red-750 border-red-200 dark:bg-red-950/20 dark:text-red-400", label: "Crítico" };
    if (score >= 5) return { bg: "bg-amber-100 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400", label: "Medio" };
    return { bg: "bg-emerald-100 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400", label: "Bajo" };
  };

  const guardarCambios = async () => {
    const token = localStorage.getItem("access_token");

    let payloadData = {};
    if (templateId === 1 || docName.includes("IPER")) {
      payloadData = { filas: filasIPER };
    } else if (templateId === 2 || docName.includes("TMERT")) {
      payloadData = datosTMERT;
    } else if (templateId === 4 || docName.toLowerCase().includes("política") || docName.toLowerCase().includes("politica")) {
      payloadData = datosPolitica;
    } else {
      payloadData = datosPlan;
    }

    if (isMock) {
      return true;
    }

    const res = await fetch(getApiUrl(`/api/documentos-usuario/${docId}/`), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        plantilla_maestra: templateId,
        datos_guardados: payloadData,
      }),
    });

    if (!res.ok) throw new Error("Error al guardar los cambios.");
    return true;
  };

  const handleGuardar = async () => {
    setSaving(true);
    try {
      if (isMock) {
        alert("Flujo de desarrollo local: Cambios guardados correctamente en simulador.");
        router.push("/documentos");
        return;
      }
      await guardarCambios();
      alert("¡Documento guardado con éxito!");
      router.push("/documentos");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDescargarWord = async () => {
    setDownloading(true);
    try {
      // Guardar cambios primero para que el documento descargado tenga la última información del formulario
      await guardarCambios();

      if (isMock) {
        alert("Flujo de desarrollo local: Descargando archivo simulado.");
        return;
      }

      const token = localStorage.getItem("access_token");
      const url = getApiUrl(`/api/documentos-usuario/${docId}/descargar-docx/`);
      
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
      link.setAttribute("download", `${cleanName}_${docId}.docx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      alert("No se pudo descargar el archivo: " + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const isIper = templateId === 1 || docName.includes("IPER");
  const isTmert = templateId === 2 || docName.includes("TMERT");
  const isPlan = templateId === 3 || docName.includes("Plan");
  const isPolitica = templateId === 4 || docName.toLowerCase().includes("política") || docName.toLowerCase().includes("politica");

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300 print:p-0 print:m-0">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Botones de acción superior - Se ocultan al imprimir */}
        <div className="flex justify-between items-center print:hidden bg-white dark:bg-slate-955 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => router.push("/documentos")}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold text-sm flex items-center space-x-1 cursor-pointer"
          >
            <span>← Volver a Documentos</span>
          </button>

          <div className="flex space-x-3">
            {isPolitica && (
              <button
                onClick={handleDescargarWord}
                disabled={downloading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <span>📥</span>
                <span>{downloading ? "Generando..." : "Descargar Word (.docx)"}</span>
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-5 rounded-xl text-xs flex items-center space-x-2 transition-all cursor-pointer"
            >
              <span>🖨️</span>
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              {saving ? "Guardando..." : "Guardar en la Nube"}
            </button>
          </div>
        </div>

        {/* ÁREA DE TRABAJO DEL DOCUMENTO */}
        <div className="bg-white dark:bg-slate-950 p-6 md:p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:p-0">
          
          <div className="border-b border-slate-200 dark:border-slate-800 pb-6 mb-6 text-center md:text-left flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {docName}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                HD Prevención • Herramienta de Edición y Previsualización Dinámica
              </p>
            </div>
            <div className="mt-4 md:mt-0 font-bold text-orange-655 tracking-wider text-sm">
              EDICIÓN ACTIVA
            </div>
          </div>

          {/* RENDER IPER */}
          {isIper && (
            <div className="space-y-6">
              <div className="flex justify-between items-center print:hidden">
                <h2 className="text-lg font-bold text-slate-850 dark:text-white">Filas de la Matriz</h2>
                <button
                  onClick={handleAddFilaIPER}
                  className="bg-slate-900 hover:bg-slate-850 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
                >
                  + Agregar Fila / Riesgo
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[900px] border border-slate-200 dark:border-slate-800">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-slate-850 dark:text-slate-200 font-bold border-b border-slate-250 dark:border-slate-850">
                      <th className="px-3 py-3 border-r border-slate-200 dark:border-slate-800 w-[20%]">Actividad / Tarea</th>
                      <th className="px-3 py-3 border-r border-slate-200 dark:border-slate-800 w-[20%]">Peligro</th>
                      <th className="px-3 py-3 border-r border-slate-200 dark:border-slate-800 w-[18%]">Riesgo</th>
                      <th className="px-2 py-3 border-r border-slate-200 dark:border-slate-800 text-center w-[7%]">P (1-5)</th>
                      <th className="px-2 py-3 border-r border-slate-200 dark:border-slate-800 text-center w-[7%]">S (1-5)</th>
                      <th className="px-2 py-3 border-r border-slate-200 dark:border-slate-800 text-center w-[8%]">Riesgo</th>
                      <th className="px-3 py-3 w-[20%]">Medidas de Control</th>
                      <th className="px-2 py-3 text-center print:hidden w-[5%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filasIPER.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 text-sm">
                          No hay registros en la matriz. Haz clic en "Agregar Fila" para comenzar.
                        </td>
                      </tr>
                    ) : (
                      filasIPER.map((fila) => {
                        const riesgo = getRiesgoEstilo(fila.probabilidad, fila.severidad);
                        return (
                          <tr key={fila.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                              <textarea
                                value={fila.actividad}
                                onChange={(e) => handleFilaIPERChange(fila.id, "actividad", e.target.value)}
                                rows={2}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 focus:outline-none print:bg-transparent print:border-none resize-none"
                                placeholder="Ej. Excavaciones"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                              <textarea
                                value={fila.peligro}
                                onChange={(e) => handleFilaIPERChange(fila.id, "peligro", e.target.value)}
                                rows={2}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 focus:outline-none print:bg-transparent print:border-none resize-none"
                                placeholder="Ej. Terreno inestable"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                              <textarea
                                value={fila.riesgo}
                                onChange={(e) => handleFilaIPERChange(fila.id, "riesgo", e.target.value)}
                                rows={2}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 focus:outline-none print:bg-transparent print:border-none resize-none"
                                placeholder="Ej. Derrumbe"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                              <select
                                value={fila.probabilidad}
                                onChange={(e) => handleFilaIPERChange(fila.id, "probabilidad", parseInt(e.target.value))}
                                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 focus:outline-none print:appearance-none print:bg-transparent print:border-none"
                              >
                                {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </td>
                            <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                              <select
                                value={fila.severidad}
                                onChange={(e) => handleFilaIPERChange(fila.id, "severidad", parseInt(e.target.value))}
                                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 focus:outline-none print:appearance-none print:bg-transparent print:border-none"
                              >
                                {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </td>
                            <td className={`p-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold`}>
                              <div className={`py-1.5 px-2 rounded border ${riesgo.bg}`}>
                                {fila.probabilidad * fila.severidad} ({riesgo.label})
                              </div>
                            </td>
                            <td className="p-2">
                              <textarea
                                value={fila.medidas_control}
                                onChange={(e) => handleFilaIPERChange(fila.id, "medidas_control", e.target.value)}
                                rows={2}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 focus:outline-none print:bg-transparent print:border-none resize-none"
                                placeholder="Ej. Entibación"
                              />
                            </td>
                            <td className="p-2 text-center print:hidden">
                              <button
                                onClick={() => handleRemoveFilaIPER(fila.id)}
                                className="text-red-500 hover:text-red-400 font-semibold"
                              >
                                ❌
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RENDER TMERT */}
          {isTmert && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold border-b border-slate-100 pb-2 dark:border-slate-900">Identificación de Empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre de la Empresa</label>
                  <input
                    type="text"
                    value={datosTMERT.empresa}
                    onChange={(e) => setDatosTMERT({ ...datosTMERT, empresa: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">RUT Empresa</label>
                  <input
                    type="text"
                    value={datosTMERT.rut}
                    onChange={(e) => setDatosTMERT({ ...datosTMERT, rut: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Dirección</label>
                  <input
                    type="text"
                    value={datosTMERT.direccion}
                    onChange={(e) => setDatosTMERT({ ...datosTMERT, direccion: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
              </div>

              <h2 className="text-lg font-bold border-b border-slate-100 pb-2 mt-8 dark:border-slate-900">Evaluación de Factores de Riesgo (TMERT)</h2>
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">Repetitividad de Movimiento</p>
                    <p className="text-xs text-slate-500 mt-0.5">Ciclos de trabajo que duran menos de 30 segundos o repetición de los mismos movimientos durante el 50% de la jornada.</p>
                  </div>
                  <select
                    value={datosTMERT.repetitividad}
                    onChange={(e) => setDatosTMERT({ ...datosTMERT, repetitividad: e.target.value })}
                    className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-2 text-sm focus:outline-none"
                  >
                    <option value="BAJO">Bajo (Verde)</option>
                    <option value="MEDIO">Medio (Amarillo)</option>
                    <option value="ALTO">Alto (Rojo)</option>
                  </select>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">Uso de Fuerza Física</p>
                    <p className="text-xs text-slate-500 mt-0.5">Esfuerzo físico extenuante percibido por el trabajador o manipulación de herramientas pesadas.</p>
                  </div>
                  <select
                    value={datosTMERT.fuerza}
                    onChange={(e) => setDatosTMERT({ ...datosTMERT, fuerza: e.target.value })}
                    className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-2 text-sm focus:outline-none"
                  >
                    <option value="BAJO">Bajo (Verde)</option>
                    <option value="MEDIO">Medio (Amarillo)</option>
                    <option value="ALTO">Alto (Rojo)</option>
                  </select>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">Postura Corporal Crítica</p>
                    <p className="text-xs text-slate-500 mt-0.5">Desviación de posturas neutras (brazos por sobre la cabeza, flexión extrema de muñecas).</p>
                  </div>
                  <select
                    value={datosTMERT.postura}
                    onChange={(e) => setDatosTMERT({ ...datosTMERT, postura: e.target.value })}
                    className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-2 text-sm focus:outline-none"
                  >
                    <option value="BAJO">Bajo (Verde)</option>
                    <option value="MEDIO">Medio (Amarillo)</option>
                    <option value="ALTO">Alto (Rojo)</option>
                  </select>
                </div>
              </div>

              <h2 className="text-lg font-bold border-b border-slate-100 pb-2 mt-8 dark:border-slate-900">Conclusiones y Medidas de Control</h2>
              <div>
                <textarea
                  value={datosTMERT.conclusiones}
                  onChange={(e) => setDatosTMERT({ ...datosTMERT, conclusiones: e.target.value })}
                  rows={5}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-3 text-sm focus:outline-none resize-none print:bg-transparent print:border-none"
                  placeholder="Medidas recomendadas y responsables..."
                />
              </div>
            </div>
          )}

          {/* RENDER PLAN */}
          {isPlan && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold border-b border-slate-100 pb-2 dark:border-slate-900">Datos Generales</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre de la Empresa</label>
                  <input
                    type="text"
                    value={datosPlan.empresa}
                    onChange={(e) => setDatosPlan({ ...datosPlan, empresa: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">RUT Empresa</label>
                  <input
                    type="text"
                    value={datosPlan.rut}
                    onChange={(e) => setDatosPlan({ ...datosPlan, rut: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Dirección de la Sucursal</label>
                  <input
                    type="text"
                    value={datosPlan.direccion}
                    onChange={(e) => setDatosPlan({ ...datosPlan, direccion: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
              </div>

              <h2 className="text-lg font-bold border-b border-slate-100 pb-2 mt-8 dark:border-slate-900">Capacidad e Instalaciones</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Número de Trabajadores Expuestos</label>
                  <input
                    type="number"
                    value={datosPlan.trabajadores}
                    onChange={(e) => setDatosPlan({ ...datosPlan, trabajadores: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Ubicación de Extintores de Incendio</label>
                  <input
                    type="text"
                    value={datosPlan.extintores}
                    onChange={(e) => setDatosPlan({ ...datosPlan, extintores: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
              </div>

              <h2 className="text-lg font-bold border-b border-slate-100 pb-2 mt-8 dark:border-slate-900">Roles y Evacuación</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Líder o Coordinador de Emergencia</label>
                  <input
                    type="text"
                    value={datosPlan.lider}
                    onChange={(e) => setDatosPlan({ ...datosPlan, lider: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Punto de Encuentro de Seguridad</label>
                  <input
                    type="text"
                    value={datosPlan.punto_encuentro}
                    onChange={(e) => setDatosPlan({ ...datosPlan, punto_encuentro: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* RENDER POLÍTICA DE SEGURIDAD */}
          {isPolitica && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold border-b border-slate-100 pb-2 dark:border-slate-900">Datos de la Política de Seguridad</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre de la Empresa (Razón Social)</label>
                  <input
                    type="text"
                    value={datosPolitica.empresa}
                    onChange={(e) => setDatosPolitica({ ...datosPolitica, empresa: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                    placeholder="Ej. Mi Empresa Ltda."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Representante Legal</label>
                  <input
                    type="text"
                    value={datosPolitica.representante_legal}
                    onChange={(e) => setDatosPolitica({ ...datosPolitica, representante_legal: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                    placeholder="Ej. Juan Pérez García"
                  />
                </div>
              </div>

              <h2 className="text-lg font-bold border-b border-slate-100 pb-2 mt-8 dark:border-slate-900">Fecha de Elaboración</h2>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Día</label>
                  <input
                    type="text"
                    value={datosPolitica.dia}
                    onChange={(e) => setDatosPolitica({ ...datosPolitica, dia: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                    placeholder="Ej. 28"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Mes</label>
                  <input
                    type="text"
                    value={datosPolitica.mes}
                    onChange={(e) => setDatosPolitica({ ...datosPolitica, mes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                    placeholder="Ej. Mayo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Año</label>
                  <input
                    type="text"
                    value={datosPolitica.anio}
                    onChange={(e) => setDatosPolitica({ ...datosPolitica, anio: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none print:bg-transparent print:border-none"
                    placeholder="Ej. 2026"
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default function DocumentoEditorRoot() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <DocumentoEditorInner />
    </Suspense>
  );
}
