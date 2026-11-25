"use client";

import { useState } from "react";
import { getApiUrl } from "../../utils/api";

interface Programa {
  id: string;
  categoriaNormativa: string;
  titulo: string;
  perfilRelator: string;
  duracionRecomendada: string;
  icono: string;
  badge: string;
  descripcion: string;
  temasClave: string[];
  normaLegal: string;
}

const PROGRAMAS_CAPACITACION: Programa[] = [
  {
    id: "LEY_KARIN",
    categoriaNormativa: "Salud Mental & Convivencia Laboral",
    titulo: "Prevención del Acoso y Ley Karin (Ley 21.643)",
    perfilRelator: "Psicólogo Laboral / Especialista en RRHH y SUSESO",
    duracionRecomendada: "2 a 4 Horas (Teórico-Práctico)",
    icono: "🧠",
    badge: "Obligatorio Nacional",
    descripcion:
      "Capacitación integral para directivos, jefaturas y trabajadores sobre identificación, prevención e investigación de conductas de acoso sexual, acoso laboral y violencia en el trabajo.",
    temasClave: [
      "Marco regulatorio Ley N° 21.643 y directrices SUSESO / DT",
      "Definición y tipificación de conductas de acoso y violencia",
      "Protocolo de prevención y canal interno de denuncias",
      "Medidas de resguardo, confidencialidad y medidas cautelares",
    ],
    normaLegal: "Ley 21.643 / Circular SUSESO / Código del Trabajo",
  },
  {
    id: "TMERT_ERGONOMIA",
    categoriaNormativa: "Ergonomía & Salud Ocupacional",
    titulo: "Ergonomía, TMERT y Manejo Manual de Cargas",
    perfilRelator: "Kinesiólogo / Ergónomo Ocupacional",
    duracionRecomendada: "2 a 3 Horas (Taller en Puesto)",
    icono: "🦴",
    badge: "Fiscalizable MINSAL",
    descripcion:
      "Instrucción biomecánica y postural para prevenir lesiones musculoesqueléticas en extremidades superiores y columna, adaptada a líneas de producción, bodegas y oficinas.",
    temasClave: [
      "Norma Técnica TMERT-EESS (MINSAL)",
      "Límites de peso Ley N° 20.949 (Ley del Saco: 25 kg hombres / 20 kg mujeres)",
      "Pausas activas y ejercicios compensatorios",
      "Higiene postural en puestos de digitación y levantamiento de carga",
    ],
    normaLegal: "D.S. 594 / Norma Técnica TMERT / Ley 20.949",
  },
  {
    id: "EXTINTORES_EMERGENCIAS",
    categoriaNormativa: "Emergencias & Protección Contra el Fuego",
    titulo: "Uso y Manejo Práctico de Extintores Portátiles",
    perfilRelator: "Instructor Especialista en Fuego / Bombero / Prevencionista",
    duracionRecomendada: "2 a 3 Horas (Práctica de Terreno)",
    icono: "🧯",
    badge: "Exigencia D.S. 594",
    descripcion:
      "Entrenamiento teórico y práctico con fuego controlado o simulador digital. Cada trabajador aprende a operar extintores de polvo químico seco (PQS) y CO2 de forma segura.",
    temasClave: [
      "Química y triángulo del fuego (Clases A, B, C, D, K)",
      "Método PASS/TAPE para descarga segura del extintor",
      "Inspección mensual del extintor (manómetro, precinto, tarjeta)",
      "Vías de evacuación y zonas de seguridad en faena",
    ],
    normaLegal: "D.S. N° 594 Art. 48 / NCh 1430",
  },
  {
    id: "SEGURIDAD_CRITICA",
    categoriaNormativa: "Trabajos de Alto Riesgo",
    titulo: "Seguridad en Altura Física y Espacios Confinados",
    perfilRelator: "Ingeniero en Prevención Senior / Rescatista Acreditado",
    duracionRecomendada: "4 Horas (Teoría + Ajuste de Arnés)",
    icono: "🧗",
    badge: "Alto Riesgo Crítico",
    descripcion:
      "Formación rigurosa sobre sistemas de protección contra caídas (SPDC), cálculo de distancia libre de caída y rescate inicial en faenas de construcción y minería.",
    temasClave: [
      "Inspección pre-uso de arnés de cuerpo entero y líneas de vida",
      "Puntos de anclaje certificados y factor de caída",
      "Monitoreo atmosférico previo en espacios confinados",
      "Permisos de trabajo seguro (PTS) y bloqueo de energías (LOTO)",
    ],
    normaLegal: "Guía Técnica ISP / D.S. 594 / Normas Chilenas NCh",
  },
  {
    id: "INDUCCION_ODI",
    categoriaNormativa: "Marco Legal Laboral",
    titulo: "Información de los Riesgos Laborales (ODI Art. 15)",
    perfilRelator: "Ingeniero en Prevención (Registro SEREMI / SNS)",
    duracionRecomendada: "2 Horas (Por Puesto de Trabajo)",
    icono: "📋",
    badge: "Obligatorio D.S. 44",
    descripcion:
      "Elaboración e instrucción legal de los riesgos inherentes a los puestos de trabajo, métodos de trabajo correctos y medidas preventivas requeridas por el Decreto Supremo N° 44 (Art. 15).",
    temasClave: [
      "Riesgos específicos por cargo y área operativa",
      "Uso, mantención y reposición obligatoria de EPP",
      "Procedimiento en caso de accidentes (Ley 16.744 / Formato DIAT)",
      "Firma individual del acta con respaldo de entrega al trabajador",
    ],
    normaLegal: "D.S. N° 44 Art. 15 / Ley 16.744",
  },
  {
    id: "CPHS_DS54",
    categoriaNormativa: "Participación Paritaria",
    titulo: "Capacitación y Asesoría a Comités Paritarios (CPHS)",
    perfilRelator: "Asesor Senior en Gestión Preventiva",
    duracionRecomendada: "3 Horas",
    icono: "🤝",
    badge: "D.S. 44",
    descripcion:
      "Instrucción metodológica para miembros titulares y suplentes del Comité Paritario: investigación de accidentes bajo el árbol de causas, inspecciones planeadas y fomento preventivo.",
    temasClave: [
      "Funciones legales del CPHS según D.S. N° 44 (Arts. 23 al 49)",
      "Técnicas modernas de investigación de incidentes",
      "Elaboración del Programa de Trabajo Paritario",
      "Coordinación efectiva con la Mutualidad (ACHS, Mutual, IST, ISL)",
    ],
    normaLegal: "Decreto Supremo N° 44 (Arts. 23 al 49) / Ley 16.744 Art. 66",
  },
];

export default function CapacitacionesPublicPage() {
  const [selectedPrograma, setSelectedPrograma] = useState<string>("LEY_KARIN");
  const [formData, setFormData] = useState({
    empresa: "",
    rut_empresa: "",
    contacto_nombre: "",
    contacto_cargo: "",
    contacto_email: "",
    contacto_telefono: "",
    tipo_capacitacion: "LEY_KARIN",
    modalidad: "PRESENCIAL",
    region_comuna: "",
    cantidad_trabajadores: 15,
    fecha_tentativa: "",
    mensaje_adicional: "",
  });

  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPrograma = (progId: string) => {
    setSelectedPrograma(progId);
    setFormData((prev) => ({ ...prev, tipo_capacitacion: progId }));
    const formElement = document.getElementById("cotizador-formulario");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceptaPrivacidad) {
      setError("Debes autorizar el tratamiento de tus datos de contacto conforme a nuestra Política de Privacidad.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(getApiUrl("/api/solicitudes-capacitacion/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          cantidad_trabajadores: Number(formData.cantidad_trabajadores) || 10,
          fecha_tentativa: formData.fecha_tentativa || null,
          acepta_privacidad: aceptaPrivacidad,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.acepta_privacidad?.[0] ||
          errorData.detail ||
            "No pudimos procesar tu solicitud. Por favor verifica los datos ingresados."
        );
      }

      setSuccess(true);
      setAceptaPrivacidad(false);
      setFormData({
        empresa: "",
        rut_empresa: "",
        contacto_nombre: "",
        contacto_cargo: "",
        contacto_email: "",
        contacto_telefono: "",
        tipo_capacitacion: selectedPrograma,
        modalidad: "PRESENCIAL",
        region_comuna: "",
        cantidad_trabajadores: 15,
        fecha_tentativa: "",
        mensaje_adicional: "",
      });
    } catch (err: any) {
      setError(err.message || "Error al enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-16 py-8">
      {/* 1. HERO SECTION */}
      <section className="container mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 p-8 md:p-16 text-white shadow-2xl">
          {/* Luces de ambiente decorativas */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
              <span>🇨🇱</span>
              <span>Relatorías & Capacitaciones In-Company</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">
              Capacitaciones Profesionales con{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
                Especialistas Acreditados
              </span>
            </h1>

            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              Enviamos profesionales a terreno o dictamos sesiones en vivo para tu empresa:{" "}
              <strong className="text-white">Psicólogos Laborales</strong> para Ley Karin,{" "}
              <strong className="text-white">Kinesiólogos y Ergónomos</strong> para TMERT, y{" "}
              <strong className="text-white">Prevencionistas de Riesgos con Registro SEREMI / SNS</strong> para
              cumplir con la Ley N° 16.744, D.S. 44 y D.S. 594.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="#cotizador-formulario"
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-orange-600/25 transition-all hover:scale-[1.02] cursor-pointer text-sm flex items-center space-x-2"
              >
                <span>🗓️</span>
                <span>Cotizar Capacitación para mi Empresa</span>
              </a>
              <a
                href="#catalogo-programas"
                className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold py-3.5 px-6 rounded-xl transition-all cursor-pointer text-sm flex items-center space-x-2"
              >
                <span>Explorar Programas Formativos ↓</span>
              </a>
            </div>

            {/* Garantías de Cumplimiento Legal */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-bold text-base">✓</span>
                <span>Actas con Firma Digital</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-bold text-base">✓</span>
                <span>Relatores Colegiados/SNS</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-bold text-base">✓</span>
                <span>Válido DT y Mutualidades</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-bold text-base">✓</span>
                <span>Cobertura en Todo Chile</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATÁLOGO DE PROGRAMAS FORMADOS */}
      <section id="catalogo-programas" className="container mx-auto px-4 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            Catálogo Normativo 2026
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
            Programas Adaptados a la Legislación Chilena
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">
            Diseñados para responder directamente a fiscalizaciones del SEREMI de Salud, Dirección del Trabajo y requerimientos de mutualidades.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROGRAMAS_CAPACITACION.map((prog) => (
            <div
              key={prog.id}
              className={`bg-white dark:bg-slate-950 rounded-2xl border transition-all duration-300 p-6 flex flex-col justify-between hover:shadow-xl ${
                selectedPrograma === prog.id
                  ? "border-orange-500 ring-2 ring-orange-500/20 shadow-md"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <span className="text-3xl p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    {prog.icono}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50">
                    {prog.badge}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    {prog.categoriaNormativa}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                    {prog.titulo}
                  </h3>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-900 space-y-1.5 text-xs">
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <span className="font-bold mr-1.5 text-slate-400">👤 Relator:</span>
                    <span className="truncate">{prog.perfilRelator}</span>
                  </div>
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <span className="font-bold mr-1.5 text-slate-400">⏱️ Duración:</span>
                    <span>{prog.duracionRecomendada}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {prog.descripcion}
                </p>

                <div className="space-y-1.5 pt-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Puntos Clave del Temario:
                  </p>
                  <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {prog.temasClave.map((punto, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-orange-500 font-bold">•</span>
                        <span>{punto}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">
                  {prog.normaLegal}
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectPrograma(prog.id)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
                >
                  Cotizar Este Curso →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. FORMULARIO DE COTIZACIÓN IN-COMPANY */}
      <section id="cotizador-formulario" className="container mx-auto px-4">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-12 shadow-xl max-w-4xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <span className="bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase px-3 py-1 rounded-full">
              Respuesta en menos de 24 horas hábiles
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
              Solicita una Propuesta Técnica y Comercial
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">
              Completa los detalles de tu empresa. Te enviaremos el temario detallado, el currículum del relator acreditado y la propuesta económica adaptada a tu dotación.
            </p>
          </div>

          {success ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-8 rounded-2xl text-center space-y-4">
              <span className="text-5xl">🎉</span>
              <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                ¡Solicitud de Capacitación Recibida con Éxito!
              </h3>
              <p className="text-xs md:text-sm text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
                Hemos asignado tu requerimiento a nuestro coordinador de relatorías. Te contactaremos dentro de 24 horas hábiles al correo y teléfono indicados con la propuesta formal.
              </p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs cursor-pointer transition-all"
              >
                Enviar otra solicitud
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4 rounded-xl text-xs text-red-650 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Fila 1: Datos de la Empresa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Razón Social / Nombre de la Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                    placeholder="Ej. Constructora del Norte S.A."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    RUT de la Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.rut_empresa}
                    onChange={(e) => setFormData({ ...formData, rut_empresa: e.target.value })}
                    placeholder="Ej. 76.123.456-7"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Fila 2: Contraparte de Contacto */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Nombre de Contacto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contacto_nombre}
                    onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
                    placeholder="Ej. Carla Muñoz"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Cargo o Función
                  </label>
                  <input
                    type="text"
                    value={formData.contacto_cargo}
                    onChange={(e) => setFormData({ ...formData, contacto_cargo: e.target.value })}
                    placeholder="Ej. Jefe de Prevención / RRHH"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.contacto_telefono}
                    onChange={(e) => setFormData({ ...formData, contacto_telefono: e.target.value })}
                    placeholder="Ej. +56 9 8765 4321"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Fila 3: Email */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                  Correo Electrónico Corporativo *
                </label>
                <input
                  type="email"
                  required
                  value={formData.contacto_email}
                  onChange={(e) => setFormData({ ...formData, contacto_email: e.target.value })}
                  placeholder="ej. contacto@tuempresa.cl"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Fila 4: Configuración de la Capacitación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Programa Requerido *
                  </label>
                  <select
                    value={formData.tipo_capacitacion}
                    onChange={(e) => {
                      setFormData({ ...formData, tipo_capacitacion: e.target.value });
                      setSelectedPrograma(e.target.value);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="LEY_KARIN">Ley Karin & Acoso Laboral (Ley 21.643)</option>
                    <option value="TMERT_ERGONOMIA">Ergonomía, TMERT y Manejo de Cargas</option>
                    <option value="EXTINTORES_EMERGENCIAS">Uso Práctico de Extintores Portátiles (DS 594)</option>
                    <option value="SEGURIDAD_CRITICA">Seguridad en Altura Física & Espacios Confinados</option>
                    <option value="INDUCCION_ODI">Información de Riesgos Laborales (ODI - Art. 15 D.S. N° 44)</option>
                    <option value="CPHS_DS54">Comités Paritarios de Higiene y Seguridad (D.S. N° 44)</option>
                    <option value="A_MEDIDA">Programa Técnico Personalizado a Medida</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Modalidad *
                  </label>
                  <select
                    value={formData.modalidad}
                    onChange={(e) => setFormData({ ...formData, modalidad: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="PRESENCIAL">Presencial en Terreno / Faena / Instalaciones</option>
                    <option value="ONLINE">Sincrónica Online (En Vivo por Teams / Zoom / Meet)</option>
                    <option value="MIXTA">Híbrida / Mixta</option>
                  </select>
                </div>
              </div>

              {/* Fila 5: Logística y Trabajadores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Comuna / Ciudad / Faena *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.region_comuna}
                    onChange={(e) => setFormData({ ...formData, region_comuna: e.target.value })}
                    placeholder="Ej. Antofagasta, Santiago Centro..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Cantidad Estimada de Trabajadores *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.cantidad_trabajadores}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cantidad_trabajadores: parseInt(e.target.value) || 10,
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    Fecha Tentativa Deseada
                  </label>
                  <input
                    type="date"
                    value={formData.fecha_tentativa}
                    onChange={(e) => setFormData({ ...formData, fecha_tentativa: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Fila 6: Observaciones */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                  Detalles o Requerimientos Particulares
                </label>
                <textarea
                  rows={3}
                  value={formData.mensaje_adicional}
                  onChange={(e) => setFormData({ ...formData, mensaje_adicional: e.target.value })}
                  placeholder="Indica horarios requeridos, turnos rotativos, si necesitas certificados impresos o temas adicionales a incorporar..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* Consentimiento opt-in y aviso corto (Art. 12 y 14 ter Ley 21.719) */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={aceptaPrivacidad}
                    onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                    required
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 shrink-0"
                  />
                  <span>
                    Autorizo el tratamiento de mis datos de contacto para gestionar y responder esta cotización de capacitación conforme a la{" "}
                    <a href="/privacidad" target="_blank" className="text-orange-600 underline font-semibold">
                      Política de Privacidad
                    </a>. <span className="text-rose-500">*</span>
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-6">
                  HD Prevención tratará tus datos exclusivamente para preparar y responder tu cotización, conservándolos hasta por 12 meses. Ejerce tus derechos ARCO-POL en{" "}
                  <a href="/derechos-arco" className="text-orange-600 underline font-semibold">/derechos-arco</a>.
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-8 rounded-xl text-sm shadow-lg shadow-orange-600/20 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Enviando Solicitud..." : "Solicitar Cotización y Propuesta Técnica →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* 4. PREGUNTAS FRECUENTES (FAQ LEGAL) */}
      <section className="container mx-auto px-4 max-w-4xl space-y-6">
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Preguntas Frecuentes sobre las Capacitaciones
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aspectos de validez legal, mutualidad y certificación en Chile.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>📜</span>
              <span>¿Los relatores cuentan con registro oficial?</span>
            </h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Sí. Los prevencionistas cuentan con registro vigente del Servicio de Salud / SEREMI correspondiente según la Ley 16.744, y los psicólogos y kinesiólogos cuentan con título profesional universitario validado.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>✍️</span>
              <span>¿Cómo se entrega el respaldo de asistencia?</span>
            </h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Al finalizar cada sesión se emite un Acta Oficial de Asistencia con firmas digitales y datos de los asistentes, lista para ser presentada ante la Dirección del Trabajo (DT) o la SEREMI.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>🚚</span>
              <span>¿Tienen cobertura fuera de la Región Metropolitana?</span>
            </h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Sí, prestamos servicios en todas las regiones del país, incluyendo faenas mineras, forestales e industriales, previa coordinación de viáticos y traslados.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>💻</span>
              <span>¿Pueden integrarse a nuestra cuenta del SaaS?</span>
            </h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Si tu empresa utiliza el SaaS HD Prevención, las actas y temas quedan sincronizados directamente en tu panel de control, sumando automáticamente al cumplimiento del PAC.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
