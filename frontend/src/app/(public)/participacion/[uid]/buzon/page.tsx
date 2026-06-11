'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function BuzonPublicoPage() {
  const { uid } = useParams<{ uid: string }>();

  const [tipo, setTipo] = useState<'SUGERENCIA' | 'CONSULTA'>('SUGERENCIA');
  const [form, setForm] = useState({
    mensaje: '',
    nombre_remitente: '',
    contacto_remitente: '',
  });
  const [anonimo, setAnonimo] = useState(true);
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.mensaje.trim()) return;

    setFormState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/publico/${uid}/buzon/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          mensaje: form.mensaje,
          anonimo,
          nombre_remitente: anonimo ? null : (form.nombre_remitente || null),
          contacto_remitente: anonimo ? null : (form.contacto_remitente || null),
        }),
      });

      if (res.ok) {
        setFormState('success');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Ocurrió un error al enviar tu mensaje.');
        setFormState('error');
      }
    } catch {
      setErrorMsg('No se pudo conectar al servidor. Verifica tu conexión a Internet.');
      setFormState('error');
    }
  };

  if (formState === 'success') {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>📬</div>
          <h1 style={styles.successTitle}>¡Mensaje recibido!</h1>
          <p style={styles.successText}>
            Tu {tipo === 'SUGERENCIA' ? 'sugerencia' : 'consulta'} fue enviada
            correctamente al prevencionista de tu empresa, quien la revisará a la
            brevedad.
          </p>
          <p style={styles.successSub}>Puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.badge}>📬 Buzón Digital</div>
          <h1 style={styles.title}>Participación y Consulta</h1>
          <p style={styles.subtitle}>
            Envía una sugerencia de mejora o una consulta sobre seguridad
            directamente al prevencionista de tu empresa. No necesitas cuenta ni
            contraseña.
          </p>
        </div>

        {/* Selector de Tipo */}
        <div style={styles.typeSelector}>
          <button
            type="button"
            onClick={() => setTipo('SUGERENCIA')}
            style={{
              ...styles.typeBtn,
              ...(tipo === 'SUGERENCIA' ? styles.typeBtnActive : {}),
            }}
          >
            💡 Sugerencia
          </button>
          <button
            type="button"
            onClick={() => setTipo('CONSULTA')}
            style={{
              ...styles.typeBtn,
              ...(tipo === 'CONSULTA' ? styles.typeBtnActiveBlue : {}),
            }}
          >
            ❓ Consulta
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Mensaje */}
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="mensaje">
              Tu {tipo === 'SUGERENCIA' ? 'sugerencia' : 'consulta'}{' '}
              <span style={styles.required}>*</span>
            </label>
            <textarea
              id="mensaje"
              name="mensaje"
              value={form.mensaje}
              onChange={handleChange}
              required
              rows={5}
              placeholder={
                tipo === 'SUGERENCIA'
                  ? 'Ej: Sería útil colocar señalética en el acceso a bodega para indicar el uso obligatorio de casco...'
                  : 'Ej: ¿Cuándo son los próximos exámenes de altura? ¿Hay charlas de emergencia planificadas?'
              }
              style={styles.textarea}
            />
          </div>

          {/* Toggle anonimo */}
          <div style={styles.anonRow}>
            <label style={styles.anonLabel} htmlFor="anonimo">
              <input
                id="anonimo"
                type="checkbox"
                checked={anonimo}
                onChange={e => setAnonimo(e.target.checked)}
                style={styles.checkbox}
              />
              Enviar de forma anónima
            </label>
            <span style={styles.anonHint}>
              {anonimo
                ? 'No se incluirá tu identidad'
                : 'Tus datos serán visibles para el prevencionista'}
            </span>
          </div>

          {/* Datos opcionales (si no es anónimo) */}
          {!anonimo && (
            <div style={styles.twoCol}>
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="nombre_remitente">
                  Tu nombre
                </label>
                <input
                  id="nombre_remitente"
                  name="nombre_remitente"
                  value={form.nombre_remitente}
                  onChange={handleChange}
                  type="text"
                  placeholder="Nombre completo (opcional)"
                  style={styles.input}
                />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="contacto_remitente">
                  Email o teléfono
                </label>
                <input
                  id="contacto_remitente"
                  name="contacto_remitente"
                  value={form.contacto_remitente}
                  onChange={handleChange}
                  type="text"
                  placeholder="Para recibir respuesta"
                  style={styles.input}
                />
              </div>
            </div>
          )}

          {formState === 'error' && (
            <div style={styles.errorBox}>⚠️ {errorMsg}</div>
          )}

          <button
            type="submit"
            disabled={formState === 'submitting' || !form.mensaje.trim()}
            style={{
              ...styles.submitBtn,
              ...(tipo === 'CONSULTA' ? styles.submitBtnBlue : {}),
              opacity: formState === 'submitting' ? 0.7 : 1,
              cursor: formState === 'submitting' ? 'not-allowed' : 'pointer',
            }}
          >
            {formState === 'submitting' ? 'Enviando...' : '📤 Enviar Mensaje'}
          </button>
        </form>

        <p style={styles.footer}>
          Este buzón es gestionado por el prevencionista de riesgos de tu empresa.
        </p>
      </div>
    </div>
  );
}

/* ───────────── Estilos ───────────── */
const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  card: {
    background: 'rgba(30, 41, 59, 0.9)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    maxWidth: '560px',
    width: '100%',
    padding: '40px 36px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  badge: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '5px 14px',
    borderRadius: '20px',
    marginBottom: '14px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#f1f5f9',
    margin: '0 0 10px',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: 1.6,
    margin: 0,
  },
  typeSelector: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '20px',
  },
  typeBtn: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '10px',
    padding: '11px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  typeBtnActive: {
    background: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.5)',
    color: '#fbbf24',
  },
  typeBtnActiveBlue: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.5)',
    color: '#a5b4fc',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#cbd5e1',
    letterSpacing: '0.02em',
  },
  required: {
    color: '#f87171',
  },
  input: {
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '14px',
    color: '#f1f5f9',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  textarea: {
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '14px',
    color: '#f1f5f9',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    width: '100%',
    boxSizing: 'border-box',
  },
  anonRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  anonLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#cbd5e1',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#6366f1',
    cursor: 'pointer',
  },
  anonHint: {
    fontSize: '12px',
    color: '#475569',
    marginLeft: '24px',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '13px',
    color: '#fca5a5',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#1a1a1a',
    fontWeight: 800,
    fontSize: '15px',
    border: 'none',
    borderRadius: '12px',
    padding: '14px',
    marginTop: '4px',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.35)',
  },
  submitBtnBlue: {
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    color: '#fff',
    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
  },
  footer: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#475569',
    marginTop: '24px',
    marginBottom: 0,
  },
  successCard: {
    background: 'rgba(30, 41, 59, 0.9)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '20px',
    maxWidth: '440px',
    width: '100%',
    padding: '52px 40px',
    textAlign: 'center',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  successIcon: {
    fontSize: '52px',
    marginBottom: '16px',
  },
  successTitle: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#818cf8',
    margin: '0 0 12px',
  },
  successText: {
    fontSize: '15px',
    color: '#94a3b8',
    lineHeight: 1.65,
    margin: '0 0 16px',
  },
  successSub: {
    fontSize: '13px',
    color: '#475569',
    margin: 0,
  },
};
