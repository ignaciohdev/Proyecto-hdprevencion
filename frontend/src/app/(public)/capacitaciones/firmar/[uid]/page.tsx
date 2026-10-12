"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../../../../utils/api";

interface SessionDetails {
  id: number;
  uuid: string;
  tema_titulo: string;
  tema_descripcion: string;
  fecha_programada: string;
  lugar: string;
  relator: string;
  estado: string;
}

export default function PublicFirmaPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid: capacitacionUuid } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");

  // Canvas para la Firma
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Cargar detalles de la capacitación
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/registro-capacitacion/${capacitacionUuid}/detalles-publicos/`));
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "No se pudo cargar la información de la capacitación.");
        }
        const data = await res.json();
        setSession(data);
      } catch (err: any) {
        setError(err.message || "Error al conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    };
    if (capacitacionUuid) {
      fetchDetails();
    }
  }, [capacitacionUuid]);

  // Configurar el Canvas cuando se carga la página o cambia el tamaño
  useEffect(() => {
    if (!session || session.estado !== "PROGRAMADA") return;

    const canvas = canvasRef.current;
    if (canvas) {
      // Ajustar la resolución del canvas al ancho del contenedor
      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 200;

        // Volver a configurar el estilo de trazo tras redimensionar
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#0f172a"; // Slate 900
        }
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }
  }, [session]);

  // Dibujo en Canvas (Mouse y Touch)
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prevenir scrolling en móviles
    if (e.cancelable) e.preventDefault();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.cancelable) e.preventDefault();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !rut.trim()) {
      alert("Por favor, ingresa tu nombre y RUT.");
      return;
    }

    if (!hasDrawn) {
      alert("Por favor, firma en el recuadro antes de enviar.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSubmitting(true);
    setError(null);

    // Convertir canvas a imagen Base64
    const firmaBase64 = canvas.toDataURL("image/png");

    try {
      const res = await fetch(getApiUrl(`/api/registro-capacitacion/${capacitacionUuid}/registrar-asistencia/`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          rut: rut.trim(),
          firma: firmaBase64,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "No se pudo registrar la asistencia.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Error de red al registrar la asistencia.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4 p-6">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-semibold">Cargando datos de la capacitación...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-950 border border-red-500/30 p-6 rounded-2xl max-w-md w-full text-center space-y-4 shadow-xl">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-lg font-bold text-white">Error de Carga</h2>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-950 border border-emerald-500/30 p-8 rounded-2xl max-w-md w-full text-center space-y-6 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-500 text-3xl font-bold">
            ✓
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Asistencia Registrada</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Tu participación en la charla ha sido firmada y guardada exitosamente en el sistema de seguridad.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-900 text-xs text-slate-500">
            Puedes cerrar esta pestaña o volver al navegador.
          </div>
        </div>
      </div>
    );
  }

  const isClosed = session ? session.estado !== "PROGRAMADA" : true;

  if (isClosed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-950 border border-amber-500/30 p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-xl">
          <span className="text-4xl">🔒</span>
          <h2 className="text-lg font-bold text-white">Charla Finalizada o Cerrada</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Esta capacitación ya se encuentra en estado <strong>{session?.estado}</strong>. No es posible agregar nuevas firmas o registros de asistencia.
          </p>
          <div className="pt-4 text-xs text-slate-500">
            Comunícate con el Prevencionista de Riesgos relator si necesitas regularizar tu registro.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-10 px-4 md:px-6 flex flex-col justify-center items-center">
      
      {/* Tarjeta Contenedora Principal */}
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Banner Temático */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 text-white text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded border border-white/10">
            Registro Oficial de Asistencia
          </span>
          <h1 className="text-xl font-black mt-2 tracking-wide">HD PREVENCIÓN</h1>
        </div>

        {/* Detalles de la Charla */}
        <div className="p-5 border-b border-slate-900 bg-slate-900/30 text-xs text-slate-400 space-y-2.5">
          <h3 className="font-bold text-sm text-white">{session?.tema_titulo}</h3>
          {session?.tema_descripcion && (
            <p className="italic leading-normal line-clamp-2">{session.tema_descripcion}</p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900/50 text-[11px] font-semibold text-slate-450">
            <p><strong>Relator:</strong> {session?.relator}</p>
            <p><strong>Lugar:</strong> {session?.lugar}</p>
          </div>
        </div>

        {/* Formulario y Firma */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-955 border border-red-500/30 text-red-450 p-3.5 rounded-xl text-xs font-semibold leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {/* Nombre Completo */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Nombre Completo del Trabajador
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Andrés Pérez Soto"
              className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* RUT */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              RUT (Con guión y dígito verificador)
            </label>
            <input
              type="text"
              required
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="Ej. 12.345.678-9"
              className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Lienzo de Firma Canvas */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Firma Digital (Dibuje con su dedo o mouse)
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[10px] text-orange-500 hover:text-orange-400 font-bold uppercase cursor-pointer"
              >
                Limpiar
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-white relative">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ touchAction: "none" }}
                className="w-full cursor-crosshair block h-[200px]"
              />
            </div>
          </div>

          {/* Botón de Enviar */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-850 text-white font-bold py-3.5 px-4 rounded-xl text-xs tracking-wider uppercase transition-all shadow-lg hover:shadow-orange-600/10 cursor-pointer"
          >
            {submitting ? "Registrando Asistencia..." : "Enviar Firma de Asistencia"}
          </button>
        </form>

      </div>

      <div className="text-center text-[10px] text-slate-650 mt-6 max-w-xs leading-relaxed">
        HD Prevención es un software de resguardo y control legal. Al firmar, ratificas tu asistencia a la charla de seguridad.
      </div>
      
    </div>
  );
}
