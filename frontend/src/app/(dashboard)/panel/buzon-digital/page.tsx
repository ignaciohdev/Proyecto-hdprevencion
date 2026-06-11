"use client";

import { useEffect, useState, useCallback } from "react";
import { getApiUrl } from "../../../utils/api";

interface SugerenciaConsulta {
  id: number;
  tipo: "SUGERENCIA" | "CONSULTA";
  mensaje: string;
  anonimo: boolean;
  nombre_remitente: string | null;
  contacto_remitente: string | null;
  leido: boolean;
  respuesta: string | null;
  fecha_creacion: string;
  fecha_respuesta: string | null;
}

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  return { Authorization: token ? `Bearer ${token}` : "" };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BuzonDigitalPage() {
  const [items, setItems] = useState<SugerenciaConsulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroLeido, setFiltroLeido] = useState<string>("TODOS");

  const [selected, setSelected] = useState<SugerenciaConsulta | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [saving, setSaving] = useState(false);

  // QR modal
  const [uid, setUid] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/buzon/"), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error al obtener el buzón digital.");
      setItems(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener el id del usuario actual para construir el QR
  const fetchUid = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/usuarios/perfil/"), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUid(String(data.id));
      }
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchUid();
  }, [fetchItems, fetchUid]);

  const handleOpenDetail = (item: SugerenciaConsulta) => {
    setSelected(item);
    setRespuesta(item.respuesta || "");
  };

  const handleResponder = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(
        getApiUrl(`/api/buzon/${selected.id}/responder/`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ respuesta }),
        }
      );
      if (!res.ok) throw new Error("No se pudo guardar la respuesta.");
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelected(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter((i) => {
    if (filtroTipo !== "TODOS" && i.tipo !== filtroTipo) return false;
    if (filtroLeido === "PENDIENTE" && i.leido) return false;
    if (filtroLeido === "LEIDO" && !i.leido) return false;
    return true;
  });

  const pendientes = items.filter((i) => !i.leido).length;

  const buzonUrl = uid
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/participacion/${uid}/buzon`
    : "";
  const reportarUrl = uid
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/participacion/${uid}/reportar`
    : "";

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>
            📬 Buzón de Participación y Consulta
            {pendientes > 0 && (
              <span style={s.badge}>{pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>
            )}
          </h1>
          <p style={s.subtitle}>
            Sugerencias y consultas enviadas por los trabajadores de tu empresa
            a través del portal público.
          </p>
        </div>
        <button
          id="btn-ver-qr-buzon"
          style={s.qrBtn}
          onClick={() => setShowQrModal(true)}
        >
          📲 Ver códigos QR
        </button>
      </div>

      {/* ── Filtros ── */}
      <div style={s.filters}>
        <div style={s.filterGroup}>
          <span style={s.filterLabel}>Tipo:</span>
          {["TODOS", "SUGERENCIA", "CONSULTA"].map((t) => (
            <button
              key={t}
              style={{ ...s.chip, ...(filtroTipo === t ? s.chipActive : {}) }}
              onClick={() => setFiltroTipo(t)}
            >
              {t === "TODOS" ? "Todos" : t === "SUGERENCIA" ? "💡 Sugerencias" : "❓ Consultas"}
            </button>
          ))}
        </div>
        <div style={s.filterGroup}>
          <span style={s.filterLabel}>Estado:</span>
          {["TODOS", "PENDIENTE", "LEIDO"].map((t) => (
            <button
              key={t}
              style={{ ...s.chip, ...(filtroLeido === t ? s.chipActive : {}) }}
              onClick={() => setFiltroLeido(t)}
            >
              {t === "TODOS" ? "Todos" : t === "PENDIENTE" ? "🟡 Pendientes" : "✅ Respondidos"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={s.layout}>
        {/* Lista */}
        <div style={s.list}>
          {loading && <div style={s.info}>Cargando mensajes...</div>}
          {error && <div style={s.errorBox}>{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div style={s.empty}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
              <p>No hay mensajes con este filtro.</p>
              <p style={{ fontSize: "13px", color: "#475569", marginTop: "6px" }}>
                Comparte los códigos QR con los trabajadores para empezar a recibir reportes.
              </p>
            </div>
          )}
          {!loading &&
            filtered.map((item) => (
              <div
                key={item.id}
                style={{
                  ...s.card,
                  ...(selected?.id === item.id ? s.cardSelected : {}),
                  borderLeft: `4px solid ${item.tipo === "SUGERENCIA" ? "#f59e0b" : "#6366f1"}`,
                }}
                onClick={() => handleOpenDetail(item)}
                id={`buzon-item-${item.id}`}
              >
                <div style={s.cardTop}>
                  <span
                    style={{
                      ...s.tipoTag,
                      background: item.tipo === "SUGERENCIA"
                        ? "rgba(245,158,11,0.15)"
                        : "rgba(99,102,241,0.15)",
                      color: item.tipo === "SUGERENCIA" ? "#fbbf24" : "#a5b4fc",
                    }}
                  >
                    {item.tipo === "SUGERENCIA" ? "💡 Sugerencia" : "❓ Consulta"}
                  </span>
                  <span
                    style={{
                      ...s.estadoTag,
                      background: item.leido
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(234,179,8,0.15)",
                      color: item.leido ? "#34d399" : "#fcd34d",
                    }}
                  >
                    {item.leido ? "✅ Respondido" : "🟡 Pendiente"}
                  </span>
                </div>
                <p style={s.cardMensaje}>
                  {item.mensaje.length > 120
                    ? item.mensaje.slice(0, 120) + "…"
                    : item.mensaje}
                </p>
                <div style={s.cardMeta}>
                  <span>
                    {item.anonimo
                      ? "👤 Anónimo"
                      : `👤 ${item.nombre_remitente || "Sin nombre"}`}
                  </span>
                  <span>{formatDate(item.fecha_creacion)}</span>
                </div>
              </div>
            ))}
        </div>

        {/* Detalle */}
        {selected ? (
          <div style={s.detail}>
            <div style={s.detailHeader}>
              <h2 style={s.detailTitle}>
                {selected.tipo === "SUGERENCIA" ? "💡 Sugerencia" : "❓ Consulta"}
              </h2>
              <button
                style={s.closeBtn}
                onClick={() => setSelected(null)}
                aria-label="Cerrar detalle"
              >
                ✕
              </button>
            </div>

            <div style={s.detailMeta}>
              <div style={s.metaRow}>
                <span style={s.metaKey}>Remitente:</span>
                <span style={s.metaVal}>
                  {selected.anonimo
                    ? "Anónimo"
                    : selected.nombre_remitente || "Sin nombre"}
                </span>
              </div>
              {!selected.anonimo && selected.contacto_remitente && (
                <div style={s.metaRow}>
                  <span style={s.metaKey}>Contacto:</span>
                  <span style={s.metaVal}>{selected.contacto_remitente}</span>
                </div>
              )}
              <div style={s.metaRow}>
                <span style={s.metaKey}>Recibido:</span>
                <span style={s.metaVal}>{formatDate(selected.fecha_creacion)}</span>
              </div>
              {selected.fecha_respuesta && (
                <div style={s.metaRow}>
                  <span style={s.metaKey}>Respondido:</span>
                  <span style={s.metaVal}>{formatDate(selected.fecha_respuesta)}</span>
                </div>
              )}
            </div>

            <div style={s.mensajeBox}>
              <p style={s.mensajeLabel}>Mensaje del trabajador</p>
              <p style={s.mensajeText}>{selected.mensaje}</p>
            </div>

            <div style={s.respuestaSection}>
              <label style={s.respuestaLabel} htmlFor="textarea-respuesta">
                Respuesta / Acción tomada
              </label>
              <textarea
                id="textarea-respuesta"
                rows={5}
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                placeholder="Escribe aquí la respuesta o la acción que tomaste ante este mensaje..."
                style={s.respuestaTextarea}
              />
              <button
                id="btn-guardar-respuesta"
                style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}
                onClick={handleResponder}
                disabled={saving}
              >
                {saving ? "Guardando..." : "💾 Guardar Respuesta"}
              </button>
            </div>
          </div>
        ) : (
          <div style={s.emptyDetail}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>👈</div>
            <p>Selecciona un mensaje para ver el detalle y responder.</p>
          </div>
        )}
      </div>

      {/* ── Modal QR ── */}
      {showQrModal && (
        <div style={s.overlay} onClick={() => setShowQrModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>📲 Códigos QR de Participación</h3>
              <button
                style={s.closeBtn}
                onClick={() => setShowQrModal(false)}
              >
                ✕
              </button>
            </div>
            <p style={s.modalSubtitle}>
              Imprime o comparte estos QR en las instalaciones de tu empresa.
              Los trabajadores pueden escanearlos sin necesidad de cuenta.
            </p>
            <div style={s.qrGrid}>
              {/* QR Reporte */}
              <div style={s.qrCard}>
                <div style={s.qrIcon}>🦺</div>
                <h4 style={s.qrCardTitle}>Reportar Condición Insegura</h4>
                <p style={s.qrCardDesc}>
                  Trabadores reportan un peligro detectado en el trabajo.
                </p>
                {uid && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(reportarUrl)}`}
                    alt="QR Reporte de Riesgo"
                    style={s.qrImg}
                  />
                )}
                <a
                  href={reportarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.qrLink}
                >
                  Abrir formulario ↗
                </a>
              </div>
              {/* QR Buzón */}
              <div style={s.qrCard}>
                <div style={s.qrIcon}>📬</div>
                <h4 style={s.qrCardTitle}>Buzón de Sugerencias y Consultas</h4>
                <p style={s.qrCardDesc}>
                  Trabajadores envían ideas o consultas de seguridad.
                </p>
                {uid && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(buzonUrl)}`}
                    alt="QR Buzón Digital"
                    style={s.qrImg}
                  />
                )}
                <a
                  href={buzonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.qrLink}
                >
                  Abrir formulario ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Estilos ─── */
const s: Record<string, React.CSSProperties> = {
  page: {
    padding: "28px 32px",
    minHeight: "100vh",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: "#f1f5f9",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#f1f5f9",
    margin: "0 0 6px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  badge: {
    background: "linear-gradient(135deg, #f59e0b, #d97706)",
    color: "#1a1a1a",
    fontSize: "12px",
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: "20px",
    verticalAlign: "middle",
  },
  subtitle: {
    fontSize: "14px",
    color: "#64748b",
    margin: 0,
  },
  qrBtn: {
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 18px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
    whiteSpace: "nowrap",
  },
  filters: {
    display: "flex",
    gap: "24px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  chip: {
    background: "rgba(30, 41, 59, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "8px",
    padding: "5px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#64748b",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  chipActive: {
    background: "rgba(99, 102, 241, 0.15)",
    border: "1px solid rgba(99, 102, 241, 0.4)",
    color: "#a5b4fc",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr",
    gap: "24px",
    alignItems: "start",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    background: "rgba(30, 41, 59, 0.7)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    borderRadius: "12px",
    padding: "16px",
    cursor: "pointer",
    transition: "background 0.2s, transform 0.15s",
  },
  cardSelected: {
    background: "rgba(99, 102, 241, 0.1)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    gap: "8px",
  },
  tipoTag: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  estadoTag: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: "6px",
  },
  cardMensaje: {
    fontSize: "13px",
    color: "#cbd5e1",
    lineHeight: 1.55,
    margin: "0 0 10px",
  },
  cardMeta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "#475569",
  },
  detail: {
    background: "rgba(15, 23, 42, 0.7)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    borderRadius: "16px",
    padding: "28px",
    position: "sticky",
    top: "24px",
  },
  emptyDetail: {
    background: "rgba(15, 23, 42, 0.4)",
    border: "1px dashed rgba(148, 163, 184, 0.15)",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 32px",
    textAlign: "center",
    color: "#475569",
    fontSize: "14px",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  detailTitle: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#f1f5f9",
    margin: 0,
  },
  closeBtn: {
    background: "rgba(148, 163, 184, 0.1)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    color: "#94a3b8",
    width: "32px",
    height: "32px",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  detailMeta: {
    background: "rgba(30, 41, 59, 0.5)",
    borderRadius: "10px",
    padding: "14px 16px",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  metaRow: {
    display: "flex",
    gap: "12px",
    fontSize: "13px",
  },
  metaKey: {
    color: "#64748b",
    fontWeight: 600,
    minWidth: "80px",
  },
  metaVal: {
    color: "#cbd5e1",
  },
  mensajeBox: {
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "20px",
  },
  mensajeLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#818cf8",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin: "0 0 8px",
  },
  mensajeText: {
    fontSize: "14px",
    color: "#e2e8f0",
    lineHeight: 1.65,
    margin: 0,
  },
  respuestaSection: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  respuestaLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  respuestaTextarea: {
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "13px",
    color: "#f1f5f9",
    fontFamily: "inherit",
    lineHeight: 1.6,
    resize: "vertical",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  saveBtn: {
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "11px 20px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(16,185,129,0.25)",
    alignSelf: "flex-start",
  },
  info: {
    color: "#64748b",
    fontSize: "14px",
    textAlign: "center",
    padding: "40px",
  },
  errorBox: {
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "13px",
    color: "#fca5a5",
  },
  empty: {
    textAlign: "center",
    color: "#475569",
    fontSize: "14px",
    padding: "60px 32px",
  },
  // Modal QR
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    background: "rgba(15, 23, 42, 0.98)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "20px",
    padding: "36px",
    maxWidth: "640px",
    width: "100%",
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#f1f5f9",
    margin: 0,
  },
  modalSubtitle: {
    fontSize: "13px",
    color: "#64748b",
    marginBottom: "28px",
    lineHeight: 1.55,
  },
  qrGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  qrCard: {
    background: "rgba(30, 41, 59, 0.7)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    borderRadius: "14px",
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    textAlign: "center",
  },
  qrIcon: {
    fontSize: "32px",
  },
  qrCardTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#e2e8f0",
    margin: 0,
    lineHeight: 1.3,
  },
  qrCardDesc: {
    fontSize: "12px",
    color: "#64748b",
    margin: 0,
    lineHeight: 1.5,
  },
  qrImg: {
    borderRadius: "8px",
    border: "4px solid #fff",
  },
  qrLink: {
    fontSize: "12px",
    color: "#818cf8",
    textDecoration: "none",
    fontWeight: 600,
  },
};
