'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function ReportarRiesgoPage() {
  const { uid } = useParams<{ uid: string }>();

  const [form, setForm] = useState({
    descripcion: '',
    lugar: '',
    nombre_reportante: '',
    rut_reportante: '',
    contacto_reportante: '',
  });

  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion.trim() || !form.lugar.trim()) return;

    setFormState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/publico/${uid}/reportar-riesgo/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: form.descripcion,
          lugar: form.lugar,
          nombre_reportante: form.nombre_reportante || null,
          rut_reportante: form.rut_reportante || null,
          contacto_reportante: form.contacto_reportante || null,
        }),
      });

      if (res.ok) {
        setFormState('success');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Ocurrió un error al enviar el reporte.');
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
          <div style={styles.successIcon}>✅</div>
          <h1 style={styles.successTitle}>¡Reporte enviado!</h1>
          <p style={styles.successText}>
            Gracias por reportar esta condición insegura. El prevencionista de
            tu empresa lo revisará y tomará las medidas necesarias a la brevedad.
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
          <div style={styles.badge}>🦺 Portal de Participación</div>
          <h1 style={styles.title}>Reportar Condición Insegura</h1>
          <p style={styles.subtitle}>
            Usa este formulario para informar sobre un peligro, condición o
            acto inseguro en tu lugar de trabajo. No necesitas cuenta ni
            contraseña.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Descripción */}
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="descripcion">
              ¿Qué detectaste? <span style={styles.required}>*</span>
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Ej: Cable eléctrico pelado en el pasillo de bodega, baranda floja en escalera..."
              style={styles.textarea}
            />
          </div>

          {/* Lugar */}
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="lugar">
              ¿Dónde está la situación? <span style={styles.required}>*</span>
            </label>
            <input
              id="lugar"
              name="lugar"
              value={form.lugar}
              onChange={handleChange}
              required
              type="text"
              placeholder="Ej: Bodega principal, Piso 2 – oficina 204, Patio de carga..."
              style={styles.input}
            />
          </div>

          <div style={styles.divider}>
            <span style={styles.dividerText}>Tus datos (opcionales)</span>
          </div>
          <p style={styles.optionalNote}>
            Si quieres que el prevencionista pueda contactarte con el
            resultado, ingresa tus datos. Puedes dejarlos en blanco.
          </p>

          {/* Nombre */}
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="nombre_reportante">
              Tu nombre completo
            </label>
            <input
              id="nombre_reportante"
              name="nombre_reportante"
              value={form.nombre_reportante}
              onChange={handleChange}
              type="text"
              placeholder="Nombre completo (opcional)"
              style={styles.input}
            />
          </div>

          {/* RUT */}
          <div style={styles.twoCol}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="rut_reportante">
                RUT
              </label>
              <input
                id="rut_reportante"
                name="rut_reportante"
                value={form.rut_reportante}
                onChange={handleChange}
                type="text"
                placeholder="12.345.678-9"
                style={styles.input}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="contacto_reportante">
                Email o teléfono
              </label>
              <input
                id="contacto_reportante"
                name="contacto_reportante"
                value={form.contacto_reportante}
                onChange={handleChange}
                type="text"
                placeholder="email@ejemplo.com"
                style={styles.input}
              />
            </div>
          </div>

          {formState === 'error' && (
            <div style={styles.errorBox}>⚠️ {errorMsg}</div>
          )}

          <div style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.6)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            🔒 <strong>Aviso de Privacidad (Ley N° 21.719):</strong> Los datos entregados se utilizarán únicamente para evaluar y corregir la condición de riesgo en faena. Conoce tus derechos y plazos en nuestra{' '}
            <a href="/privacidad" target="_blank" style={{ color: '#fb923c', textDecoration: 'underline' }}>
              Política de Privacidad
            </a>.
          </div>

          <button
            type="submit"
            disabled={
              formState === 'submitting' ||
              !form.descripcion.trim() ||
              !form.lugar.trim()
            }
            style={{
              ...styles.submitBtn,
              opacity: formState === 'submitting' ? 0.7 : 1,
              cursor: formState === 'submitting' ? 'not-allowed' : 'pointer',
            }}
          >
            {formState === 'submitting' ? 'Enviando...' : '📤 Enviar Reporte'}
          </button>
        </form>

        <p style={styles.footer}>
          Este portal es gestionado por el prevencionista de riesgos de tu empresa.
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
    marginBottom: '32px',
  },
  badge: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#1a1a1a',
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
    transition: 'border-color 0.2s',
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
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '4px 0 0',
  },
  dividerText: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  },
  optionalNote: {
    fontSize: '12px',
    color: '#64748b',
    margin: '-10px 0 0',
    lineHeight: 1.5,
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
    border: '1px solid rgba(16, 185, 129, 0.3)',
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
    color: '#10b981',
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
