"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "../../../../utils/api";

interface TemaCapacitacion {
  id: number;
  titulo: string;
  categoria: string;
  duracion_minutos: number;
  descripcion: string;
}

export default function NuevaCapacitacionPage() {
  const router = useRouter();
  const [temas, setTemas] = useState<TemaCapacitacion[]>([]);
  const [loadingTemas, setLoadingTemas] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de formularios
  const [selectedTemaId, setSelectedTemaId] = useState<string>("");
  const [fechaProgramada, setFechaProgramada] = useState<string>("");
  const [lugar, setLugar] = useState<string>("");

  // Estado para crear nuevo tema (dentro del modal o inline)
  const [isCrearTemaOpen, setIsCrearTemaOpen] = useState(false);
  const [nuevoTema, setNuevoTema] = useState({
    titulo: "",
    descripcion: "",
    categoria: "CHARLA_5_MIN",
    duracion_minutos: 5,
    contenido_clave_raw: "", // Puntos clave separados por salto de línea
  });
  const [savingTema, setSavingTema] = useState(false);
  const [errorTema, setErrorTema] = useState<string | null>(null);

  const fetchTemas = async () => {
    setLoadingTemas(true);
    try {
      const res = await authFetch(getApiUrl("/api/temas-capacitacion/"));
      if (!res.ok) throw new Error("Error al obtener los temas de capacitación.");
      const data = await res.json();
      setTemas(data);
      if (data.length > 0 && !selectedTemaId) {
        setSelectedTemaId(data[0].id.toString());
      }
    } catch (err: any) {
      setError("No se pudieron cargar los temas base.");
    } finally {
      setLoadingTemas(false);
    }
  };

  useEffect(() => {
    fetchTemas();
  }, []);

  const handleCrearTemaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTema(true);
    setErrorTema(null);

    const puntosClave = nuevoTema.contenido_clave_raw
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p !== "");

    const payload = {
      titulo: nuevoTema.titulo,
      descripcion: nuevoTema.descripcion,
      categoria: nuevoTema.categoria,
      duracion_minutos: nuevoTema.duracion_minutos,
      contenido_clave: puntosClave,
    };

    try {
      const res = await authFetch(getApiUrl("/api/temas-capacitacion/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Error al registrar el nuevo tema.");
      const data = await res.json();

      setTemas([...temas, data]);
      setSelectedTemaId(data.id.toString());
      setIsCrearTemaOpen(false);
      setNuevoTema({
        titulo: "",
        descripcion: "",
        categoria: "CHARLA_5_MIN",
        duracion_minutos: 5,
        contenido_clave_raw: "",
      });
    } catch (err: any) {
      setErrorTema(err.message || "No se pudo crear el tema.");
    } finally {
      setSavingTema(false);
    }
  };

  const handleProgramarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemaId) {
      alert("Debes seleccionar un tema de capacitación.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tema: parseInt(selectedTemaId),
      fecha_programada: fechaProgramada,
      lugar: lugar,
      estado: "PROGRAMADA",
    };

    try {
      const res = await authFetch(getApiUrl("/api/registro-capacitacion/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("No se pudo programar la capacitación. Verifica los datos.");
      router.push("/panel/capacitaciones");
    } catch (err: any) {
      setError(err.message || "Ocurrió un error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            Programar Nueva Capacitación / Charla
          </h1>
          <p className="text-slate-400 mt-2 text-xs">
            Planifica una sesión de capacitación para tus trabajadores en obra o taller.
          </p>
        </div>
        <button
          onClick={() => router.push("/panel/capacitaciones")}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-750 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
        >
          Volver al PAC
        </button>
      </div>

      {/* Tip / Asistencia Externa */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
          <span className="text-base">💡</span>
          <span>
            ¿Requieres que un <strong>Psicólogo Laboral (Ley Karin)</strong> o <strong>Ergónomo (TMERT)</strong> dicte esta sesión en tu empresa?
          </span>
        </div>
        <a
          href="/capacitaciones"
          className="text-orange-600 dark:text-orange-400 font-bold hover:underline shrink-0"
        >
          Solicitar Relator HD →
        </a>
      </div>

      {/* Formulario Principal */}
      <div className="bg-white dark:bg-slate-950 p-6 md:p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
        
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-4 rounded-xl mb-6 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleProgramarSubmit} className="space-y-6">
          
          {/* Selector de Temas */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Tema de la Capacitación</label>
              <button
                type="button"
                onClick={() => setIsCrearTemaOpen(true)}
                className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
              >
                + Crear Tema Personalizado
              </button>
            </div>

            {loadingTemas ? (
              <div className="py-2.5 text-xs text-slate-400 font-semibold italic">Cargando temas base...</div>
            ) : temas.length === 0 ? (
              <div className="py-2.5 text-xs text-red-500 italic">No hay temas disponibles. Crea uno para comenzar.</div>
            ) : (
              <select
                required
                value={selectedTemaId}
                onChange={(e) => setSelectedTemaId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
              >
                {temas.map((tema) => (
                  <option key={tema.id} value={tema.id}>
                    {tema.titulo} ({tema.categoria === "CHARLA_5_MIN" ? "Charla 5 min" : tema.categoria === "INDUCCION_ODI" ? "ODI" : "Curso"})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fecha Programada */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Fecha Programada</label>
              <input
                type="date"
                required
                value={fechaProgramada}
                onChange={(e) => setFechaProgramada(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Lugar Físico */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Lugar / Ubicación de la Charla</label>
              <input
                type="text"
                required
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="ej. Bodega Central / Patio de acopio norte"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Botón de Enviar */}
          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded-xl text-sm shadow-md transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            >
              {saving ? "Planificando..." : "Programar en Calendario"}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL CREAR TEMA PERSONALIZADO */}
      {isCrearTemaOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              Crear Tema de Capacitación
            </h2>

            {errorTema && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-3 rounded-xl mb-4 text-xs">
                {errorTema}
              </div>
            )}

            <form onSubmit={handleCrearTemaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Título del Tema</label>
                <input
                  type="text"
                  required
                  value={nuevoTema.titulo}
                  onChange={(e) => setNuevoTema({ ...nuevoTema, titulo: e.target.value })}
                  placeholder="ej. Plan de respuesta ante derrames químicos"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Categoría</label>
                  <select
                    value={nuevoTema.categoria}
                    onChange={(e) => {
                      const cat = e.target.value;
                      let dur = nuevoTema.duracion_minutos;
                      if (cat === "CURSO_8H_GENERO") dur = 480;
                      else if (cat === "CURSO_20H_CPHS") dur = 1200;
                      else if (cat === "CURSO_1H_EPP") dur = 60;
                      else if (cat === "CHARLA_5_MIN") dur = 5;
                      else if (cat === "INDUCCION_ODI") dur = 60;
                      setNuevoTema({ ...nuevoTema, categoria: cat, duracion_minutos: dur });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                  >
                    <option value="CHARLA_5_MIN">Charla de 5 Minutos (Operativa)</option>
                    <option value="INDUCCION_ODI">Inducción ODI (Art. 15 D.S. N° 44)</option>
                    <option value="CURSO_8H_GENERO">Curso Bienal 8h Género (Art. 16 D.S. N° 44)</option>
                    <option value="CURSO_20H_CPHS">Curso 20h CPHS (Mutualidad / D.S. N° 44)</option>
                    <option value="CURSO_1H_EPP">Capacitación Obligatoria EPP 1h (D.S. N° 44)</option>
                    <option value="CURSO_TEORICO">Capacitación Teórica General</option>
                    <option value="CURSO_PRACTICO">Capacitación Práctica / Simulacro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Duración (Minutos)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={nuevoTema.duracion_minutos}
                    onChange={(e) => setNuevoTema({ ...nuevoTema, duracion_minutos: parseInt(e.target.value) || 5 })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Resumen / Descripción del Tema</label>
                <textarea
                  required
                  rows={3}
                  value={nuevoTema.descripcion}
                  onChange={(e) => setNuevoTema({ ...nuevoTema, descripcion: e.target.value })}
                  placeholder="Describe brevemente el contenido de esta capacitación..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Puntos Clave del Contenido (Uno por línea)</label>
                <textarea
                  rows={3}
                  value={nuevoTema.contenido_clave_raw}
                  onChange={(e) => setNuevoTema({ ...nuevoTema, contenido_clave_raw: e.target.value })}
                  placeholder="ej. Identificación del químico derramado&#10;Contención mediante kit absorbente&#10;Disposición final de residuos peligrosos"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCrearTemaOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTema}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  {savingTema ? "Creando..." : "Guardar Tema"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
