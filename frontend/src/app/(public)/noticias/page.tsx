"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../utils/api";

interface Noticia {
  id: number;
  titulo: string;
  subtitulo: string;
  contenido: string;
  categoria: string;
  imagen_url: string;
  autor: number;
  autor_name: string;
  estado: string;
  fecha_publicacion: string;
}

export default function NoticiasPage() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Estados del CRUD
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNoticia, setEditingNoticia] = useState<Noticia | null>(null);
  const [formNoticia, setFormNoticia] = useState({
    titulo: "",
    subtitulo: "",
    contenido: "",
    categoria: "NOTICIA",
    imagen_url: "",
    estado: "BORRADOR",
  });

  const fetchNoticias = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(getApiUrl("/api/noticias/"), {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error("Error al obtener las noticias.");
      const data = await res.json();
      setNoticias(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        setIsAdmin(payload.is_superuser || payload.is_staff);
      } catch (e) {}
    }
    fetchNoticias();
  }, []);

  const handleOpenCreate = () => {
    setEditingNoticia(null);
    setFormNoticia({
      titulo: "",
      subtitulo: "",
      contenido: "",
      categoria: "NOTICIA",
      imagen_url: "",
      estado: "BORRADOR",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (noticia: Noticia) => {
    setEditingNoticia(noticia);
    setFormNoticia({
      titulo: noticia.titulo,
      subtitulo: noticia.subtitulo,
      contenido: noticia.contenido,
      categoria: noticia.categoria,
      imagen_url: noticia.imagen_url,
      estado: noticia.estado,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("access_token");
    const method = editingNoticia ? "PUT" : "POST";
    const url = editingNoticia
      ? getApiUrl(`/api/noticias/${editingNoticia.id}/`)
      : getApiUrl("/api/noticias/");

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formNoticia),
      });

      if (!res.ok) throw new Error("Error al guardar la noticia.");

      setIsModalOpen(false);
      fetchNoticias();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta noticia?")) return;
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(getApiUrl(`/api/noticias/${id}/`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Error al eliminar la noticia.");
      fetchNoticias();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300">
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Encabezado */}
        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <span className="bg-orange-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">
              Actualidad Laboral
            </span>
            <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight">
              Noticias y Cambios Normativos
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xl">
              Mantente al día con las últimas regulaciones de seguridad, circulares de la SUSESO y dictámenes de la Dirección del Trabajo en Chile.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 md:mt-0 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              + Redactar Noticia
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {noticias.map((noticia) => (
              <article
                key={noticia.id}
                className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-lg transition-all duration-300"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-xs font-bold px-2.5 py-1 rounded-full capitalize">
                      {noticia.categoria.toLowerCase()}
                    </span>
                    {isAdmin && (
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${noticia.estado === 'PUBLICADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {noticia.estado}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                    {noticia.titulo}
                  </h3>
                  {noticia.subtitulo && (
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 italic">
                      {noticia.subtitulo}
                    </p>
                  )}
                  <p className="text-slate-650 dark:text-slate-350 text-sm leading-relaxed mb-6 whitespace-pre-line">
                    {noticia.contenido}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-900 flex justify-between items-center text-xs text-slate-450 dark:text-slate-400">
                  <div>
                    <p className="font-bold">Autor: {noticia.autor_name}</p>
                    <p className="mt-0.5">{new Date(noticia.fecha_publicacion).toLocaleDateString()}</p>
                  </div>

                  {isAdmin && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenEdit(noticia)}
                        className="text-orange-655 hover:text-orange-500 font-bold cursor-pointer"
                      >
                        Editar
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => handleDelete(noticia.id)}
                        className="text-red-500 hover:text-red-400 font-bold cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              {editingNoticia ? "Editar Noticia" : "Redactar Nueva Noticia"}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Título de la Noticia</label>
                <input
                  type="text"
                  required
                  value={formNoticia.titulo}
                  onChange={(e) => setFormNoticia({ ...formNoticia, titulo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Título principal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Subtítulo o Breve Resumen</label>
                <input
                  type="text"
                  value={formNoticia.subtitulo}
                  onChange={(e) => setFormNoticia({ ...formNoticia, subtitulo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Subtítulo introductorio"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Categoría</label>
                  <select
                    value={formNoticia.categoria}
                    onChange={(e) => setFormNoticia({ ...formNoticia, categoria: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="NOTICIA">Noticia</option>
                    <option value="REGULACION">Regulación</option>
                    <option value="INNOVACION">Innovación</option>
                    <option value="CONSEJO">Consejo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Estado de Publicación</label>
                  <select
                    value={formNoticia.estado}
                    onChange={(e) => setFormNoticia({ ...formNoticia, estado: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="BORRADOR">Borrador</option>
                    <option value="PUBLICADO">Publicado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Cuerpo de la Noticia</label>
                <textarea
                  required
                  rows={6}
                  value={formNoticia.contenido}
                  onChange={(e) => setFormNoticia({ ...formNoticia, contenido: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="Escribe el contenido completo del artículo aquí..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer"
                >
                  {editingNoticia ? "Guardar Cambios" : "Publicar Noticia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
