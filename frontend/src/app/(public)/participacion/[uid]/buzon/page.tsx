'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

type CanalType = 'SUGERENCIA' | 'DENUNCIA_KARIN';
type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface EmpresaItem {
  id: number;
  razon_social: string;
  nombre_fantasia: string;
  rut: string;
  centros_trabajo: { id: number; nombre: string; direccion: string }[];
}

function BuzonPublicoContent() {
  const { uid } = useParams<{ uid: string }>();
  const searchParams = useSearchParams();
  const empresaParam = searchParams.get('empresa');

  // Selector principal de canal
  const [canal, setCanal] = useState<CanalType>('SUGERENCIA');

  // Empresas disponibles del prevencionista
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [selectedCentroId, setSelectedCentroId] = useState<string>('');

  // Formulario Sugerencia Laboral
  const [tipoSugerencia, setTipoSugerencia] = useState<'MEJORA_PROCESO' | 'CLIMA_LABORAL' | 'SEGURIDAD_GENERAL'>('MEJORA_PROCESO');
  const [mensajeSugerencia, setMensajeSugerencia] = useState('');
  const [esAnonimo, setEsAnonimo] = useState(true);
  const [nombreRemitente, setNombreRemitente] = useState('');
  const [contactoRemitente, setContactoRemitente] = useState('');

  // Formulario Denuncia Ley Karin
  const [tipoAfectacion, setTipoAfectacion] = useState<'ACOSO_LABORAL' | 'ACOSO_SEXUAL' | 'VIOLENCIA_EXTERNA'>('ACOSO_LABORAL');
  const [rutDenunciante, setRutDenunciante] = useState('');
  const [nombreDenunciante, setNombreDenunciante] = useState('');
  const [correoDenunciante, setCorreoDenunciante] = useState('');
  const [telefonoDenunciante, setTelefonoDenunciante] = useState('');
  const [nombreDenunciado, setNombreDenunciado] = useState('');
  const [cargoAreaDenunciado, setCargoAreaDenunciado] = useState('');
  const [descripcionHechos, setDescripcionHechos] = useState('');
  const [testigosEvidencias, setTestigosEvidencias] = useState('');

  // Estados de carga y feedback
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ uuid: string; tipo: string } | null>(null);

  // Cargar lista de empresas y centros de trabajo del prevencionista (Aislada por tenant)
  useEffect(() => {
    if (!uid) return;
    const fetchEmpresas = async () => {
      try {
        const query = empresaParam ? `?empresa=${encodeURIComponent(empresaParam)}` : '';
        const res = await fetch(`${API_URL}/publico/${uid}/empresas/${query}`);
        if (res.ok) {
          const data: EmpresaItem[] = await res.json();
          setEmpresas(data);
          if (data.length > 0) {
            setSelectedEmpresaId(String(data[0].id));
            if (data[0].centros_trabajo.length > 0) {
              setSelectedCentroId(String(data[0].centros_trabajo[0].id));
            }
          }
        }
      } catch {
        // silencioso
      }
    };
    fetchEmpresas();
  }, [uid, empresaParam]);

  // Centros de trabajo disponibles para la empresa seleccionada
  const centrosDisponibles =
    empresas.find(e => String(e.id) === selectedEmpresaId)?.centros_trabajo || [];

  const handleEmpresaChange = (empresaId: string) => {
    setSelectedEmpresaId(empresaId);
    const emp = empresas.find(e => String(e.id) === empresaId);
    if (emp && emp.centros_trabajo.length > 0) {
      setSelectedCentroId(String(emp.centros_trabajo[0].id));
    } else {
      setSelectedCentroId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    setErrorMsg('');

    try {
      let payload: Record<string, unknown> = {};

      if (canal === 'DENUNCIA_KARIN') {
        if (!rutDenunciante.trim() || !nombreDenunciante.trim() || !correoDenunciante.trim()) {
          setErrorMsg('Por favor completa todos los datos obligatorios del denunciante.');
          setFormState('error');
          return;
        }
        if (!nombreDenunciado.trim() || !descripcionHechos.trim()) {
          setErrorMsg('Por favor indica el nombre de la persona denunciada y la descripción de los hechos.');
          setFormState('error');
          return;
        }

        payload = {
          tipo_canal: 'DENUNCIA_KARIN',
          empresa: selectedEmpresaId ? Number(selectedEmpresaId) : undefined,
          centro_trabajo: selectedCentroId ? Number(selectedCentroId) : undefined,
          tipo_afectacion: tipoAfectacion,
          rut_denunciante: rutDenunciante.trim(),
          nombre_denunciante: nombreDenunciante.trim(),
          correo_denunciante: correoDenunciante.trim(),
          telefono_denunciante: telefonoDenunciante.trim(),
          nombre_denunciado: nombreDenunciado.trim(),
          cargo_area_denunciado: cargoAreaDenunciado.trim(),
          descripcion_circunstanciada: descripcionHechos.trim(),
          testigos_o_evidencias: testigosEvidencias.trim() || null,
        };
      } else {
        if (!mensajeSugerencia.trim()) {
          setErrorMsg('Por favor escribe tu sugerencia.');
          setFormState('error');
          return;
        }

        payload = {
          tipo_canal: 'SUGERENCIA',
          empresa: selectedEmpresaId ? Number(selectedEmpresaId) : undefined,
          tipo: tipoSugerencia,
          mensaje: mensajeSugerencia.trim(),
          es_anonimo: esAnonimo,
          nombre_remitente: esAnonimo ? null : nombreRemitente.trim() || null,
          contacto_remitente: esAnonimo ? null : contactoRemitente.trim() || null,
        };
      }

      const res = await fetch(`${API_URL}/publico/${uid}/buzon/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessInfo({ uuid: data.uuid, tipo: data.tipo || canal });
        setFormState('success');
      } else {
        const errorText =
          data.error ||
          data.rut_denunciante?.[0] ||
          data.empresa?.[0] ||
          'Ocurrió un error al enviar el formulario. Verifica los campos requeridos.';
        setErrorMsg(errorText);
        setFormState('error');
      }
    } catch {
      setErrorMsg('No se pudo conectar con el servidor. Revisa tu conexión a Internet.');
      setFormState('error');
    }
  };

  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto">
            {successInfo?.tipo === 'DENUNCIA_KARIN' ? '⚖️' : '📬'}
          </div>

          <h1 className="text-2xl font-black text-white">
            {successInfo?.tipo === 'DENUNCIA_KARIN'
              ? 'Denuncia Ley Karin Recepcionada'
              : '¡Mensaje Enviado con Éxito!'}
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            {successInfo?.tipo === 'DENUNCIA_KARIN'
              ? 'Tu denuncia ha sido registrada bajo estricta confidencialidad. Se ha notificado formalmente al prevencionista y empleador para activar las medidas de resguardo cautelar dentro del plazo legal de 72 horas (Ley N° 21.643).'
              : 'Tu sugerencia de mejora ha sido transmitida de forma segura al prevencionista de tu empresa.'}
          </p>

          {successInfo?.uuid && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-400">
              Comprobante Seguro: <span className="text-amber-400">{successInfo.uuid}</span>
            </div>
          )}

          <p className="text-xs text-slate-500">Puedes cerrar esta ventana de manera segura.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6">
        {/* Encabezado */}
        <div className="text-center space-y-2 pb-4 border-b border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full inline-block">
            Portal Público de Participación & Denuncias
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Buzón de Trabajadores</h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto">
            Canal directo con el prevencionista de tu empresa. Puedes ingresar una propuesta de mejora o una denuncia formal y confidencial bajo la Ley Karin.
          </p>
        </div>

        {/* Selector de Canal: Sugerencia vs Denuncia Ley Karin */}
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setCanal('SUGERENCIA')}
            className={`py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              canal === 'SUGERENCIA'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>💡</span>
            <span>Sugerencia / Clima</span>
          </button>

          <button
            type="button"
            onClick={() => setCanal('DENUNCIA_KARIN')}
            className={`py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              canal === 'DENUNCIA_KARIN'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>⚖️</span>
            <span>Denuncia Ley Karin</span>
          </button>
        </div>

        {/* Contexto de Empresa y Faena (Aislamiento Multi-Tenant y Confidencialidad) */}
        {empresas.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">
                Empresa Vinculada (Canal Confidencial):
              </label>
              <div className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl p-2.5 text-xs text-white flex items-center justify-between shadow-inner">
                <span className="font-bold truncate">
                  🏢 {empresas.find(e => String(e.id) === selectedEmpresaId)?.razon_social || empresas[0]?.razon_social}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono ml-2 shrink-0">
                  🔒 Contexto Fijo
                </span>
              </div>
            </div>

            {centrosDisponibles.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5">
                  Faena o Sucursal (opcional):
                </label>
                <select
                  value={selectedCentroId}
                  onChange={e => setSelectedCentroId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">(Toda la Empresa / No especifica)</option>
                  {centrosDisponibles.map(cen => (
                    <option key={cen.id} value={cen.id}>
                      {cen.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {canal === 'DENUNCIA_KARIN' ? (
            /* ══════ FORMULARIO LEY KARIN ══════ */
            <div className="space-y-4">
              {/* Alerta de Confidencialidad */}
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 leading-relaxed flex items-start gap-2.5">
                <span className="text-lg">🛡️</span>
                <div>
                  <strong>Canal Protegido por Ley N° 21.643:</strong> Este procedimiento garantiza
                  confidencialidad estricta y protección inmediata contra represalias (Art. 211-B). El empleador
                  debe adoptar medidas cautelares dentro de 72 horas corridas.
                </div>
              </div>

              {/* Tipo de Afectación */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Materia o Afectación a Denunciar <span className="text-rose-500">*</span>:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { id: 'ACOSO_LABORAL', label: 'Acoso Laboral', sub: 'Art. 2 Inc. 3' },
                    { id: 'ACOSO_SEXUAL', label: 'Acoso Sexual', sub: 'Art. 2 Inc. 2' },
                    { id: 'VIOLENCIA_EXTERNA', label: 'Violencia en el Trabajo', sub: 'Art. 2 Inc. 4' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipoAfectacion(t.id as unknown as typeof tipoAfectacion)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        tipoAfectacion === t.id
                          ? 'bg-rose-600/20 border-rose-500 text-white font-bold ring-1 ring-rose-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs">{t.label}</div>
                      <div className="text-[10px] opacity-70">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Identificación del Denunciante */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>👤</span> Datos del Denunciante (Requerido por Ley para activar medidas de resguardo)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      RUT <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={rutDenunciante}
                      onChange={e => setRutDenunciante(e.target.value)}
                      placeholder="12.345.678-5"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Nombre Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nombreDenunciante}
                      onChange={e => setNombreDenunciante(e.target.value)}
                      placeholder="Nombre y Apellidos"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Correo Electrónico <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={correoDenunciante}
                      onChange={e => setCorreoDenunciante(e.target.value)}
                      placeholder="correo@ejemplo.cl"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Teléfono de Contacto</label>
                    <input
                      type="text"
                      value={telefonoDenunciante}
                      onChange={e => setTelefonoDenunciante(e.target.value)}
                      placeholder="+56 9 1234 5678"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Datos de la Persona Denunciada */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎯</span> Persona Denunciada
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Nombre Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nombreDenunciado}
                      onChange={e => setNombreDenunciado(e.target.value)}
                      placeholder="Nombre del denunciado"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Cargo o Área de Trabajo</label>
                    <input
                      type="text"
                      value={cargoAreaDenunciado}
                      onChange={e => setCargoAreaDenunciado(e.target.value)}
                      placeholder="Ej: Supervisor de Turno / Bodega"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Relato de los Hechos */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Descripción Circunstanciada de los Hechos <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  required
                  rows={5}
                  value={descripcionHechos}
                  onChange={e => setDescripcionHechos(e.target.value)}
                  placeholder="Describe de manera detallada las fechas aproximadas, lugares físicos o digitales y acciones ocurridas..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500 leading-relaxed"
                />
              </div>

              {/* Testigos o Evidencias */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Testigos o Evidencias Aportadas (Opcional):
                </label>
                <textarea
                  rows={2}
                  value={testigosEvidencias}
                  onChange={e => setTestigosEvidencias(e.target.value)}
                  placeholder="Menciona si existen correos, mensajes o personas que presenciaron los hechos..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          ) : (
            /* ══════ FORMULARIO SUGERENCIA / CLIMA ══════ */
            <div className="space-y-4">
              {/* Tipo de Sugerencia */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Área de la Sugerencia:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { id: 'MEJORA_PROCESO', label: '💡 Mejora de Procesos', sub: 'Eficiencia y métodos' },
                    { id: 'CLIMA_LABORAL', label: '🤝 Clima & Convivencia', sub: 'Ambiente laboral' },
                    { id: 'SEGURIDAD_GENERAL', label: '🦺 Seguridad & Salud', sub: 'Condiciones de faena' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipoSugerencia(t.id as unknown as typeof tipoSugerencia)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        tipoSugerencia === t.id
                          ? 'bg-amber-600/20 border-amber-500 text-white font-bold ring-1 ring-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs">{t.label}</div>
                      <div className="text-[10px] opacity-70">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Tu Sugerencia o Aporte <span className="text-amber-500">*</span>:
                </label>
                <textarea
                  required
                  rows={5}
                  value={mensajeSugerencia}
                  onChange={e => setMensajeSugerencia(e.target.value)}
                  placeholder="Ej: Proponemos instalar un dispensador de agua potable adicional en el sector de acopio de materiales y reforzar la señalética de cruce peatonal..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Anónimo Toggle */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={esAnonimo}
                    onChange={e => setEsAnonimo(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-600 focus:ring-0"
                  />
                  <span>Enviar de forma anónima (tu identidad no será registrada)</span>
                </label>

                {!esAnonimo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Tu Nombre</label>
                      <input
                        type="text"
                        value={nombreRemitente}
                        onChange={e => setNombreRemitente(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Contacto (Email o Teléfono)
                      </label>
                      <input
                        type="text"
                        value={contactoRemitente}
                        onChange={e => setContactoRemitente(e.target.value)}
                        placeholder="Para recibir respuesta"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Aviso de Privacidad y Tratamiento de Datos (Art. 14 ter Ley 21.719) */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
            <p>
              🔒 <strong>Aviso de Protección de Datos (Ley N° 21.719):</strong> Los datos recopilados serán tratados exclusivamente para la tramitación de esta {canal === 'DENUNCIA_KARIN' ? 'denuncia Ley Karin bajo estricta reserva legal (Ley 21.643 y D.S. 44)' : 'sugerencia o consulta laboral'}.
            </p>
            <p>
              Puedes revisar las finalidades, plazos de conservación y procedimiento para ejercer tus derechos de acceso, rectificación y supresión en nuestra{" "}
              <a href="/privacidad" target="_blank" className="text-orange-400 underline font-semibold">
                Política de Privacidad
              </a>.
            </p>
          </div>

          {/* Botón de Envío */}
          <button
            type="submit"
            disabled={formState === 'submitting'}
            className={`w-full py-3.5 px-6 rounded-2xl text-sm font-extrabold text-white transition-all shadow-xl cursor-pointer disabled:opacity-50 ${
              canal === 'DENUNCIA_KARIN'
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30'
                : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/30'
            }`}
          >
            {formState === 'submitting'
              ? 'Enviando al sistema seguro...'
              : canal === 'DENUNCIA_KARIN'
              ? '⚖️ Enviar Denuncia Formal Ley Karin'
              : '📬 Enviar Sugerencia Laboral'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BuzonPublicoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BuzonPublicoContent />
    </Suspense>
  );
}
