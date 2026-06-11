"use client";

import { useEffect, useState, useCallback } from "react";
import { getApiUrl } from "../../../utils/api";

interface ContratistaResumen {
  id: number;
  razon_social: string;
  rut: string;
  tipo: "CONTRATISTA" | "PROVEEDOR";
  activo: boolean;
  fecha_ingreso: string;
  estado_cumplimiento: "AL_DIA" | "POR_VENCER" | "CRITICO" | "SIN_DOCUMENTOS";
  cant_trabajadores: number;
  cant_documentos: number;
}

interface DashboardStats {
  total_contratistas: number;
  contratistas_al_dia: number;
  contratistas_por_vencer: number;
  contratistas_criticos: number;
  contratistas_sin_docs: number;
  total_documentos: number;
  documentos_vencidos: number;
  documentos_por_vencer: number;
  documentos_vigentes: number;
  total_trabajadores: number;
}

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  return { Authorization: token ? `Bearer ${token}` : "" };
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function ContratistasPage() {
  const [contratistas, setContratistas] = useState<ContratistaResumen[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroCumplimiento, setFiltroCumplimiento] = useState<string>("TODOS");

  // Modal para agregar contratista
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    razon_social: "",
    rut: "",
    tipo: "CONTRATISTA",
    giro: "",
    nombre_representante: "",
    email_contacto: "",
    telefono_contacto: "",
    fecha_ingreso: new Date().toISOString().split("T")[0],
    observaciones: "",
    activo: true
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Obtener lista resumida de contratistas
      const resList = await fetch(getApiUrl("/api/contratistas/"), {
        headers: getAuthHeaders()
      });
      if (!resList.ok) throw new Error("Error al obtener la lista de contratistas.");
      const dataList = await resList.json();
      setContratistas(dataList);

      // 2. Obtener estadísticas del panel
      const resStats = await fetch(getApiUrl("/api/contratistas/dashboard/"), {
        headers: getAuthHeaders()
      });
      if (!resStats.ok) throw new Error("Error al obtener estadísticas de contratistas.");
      const dataStats = await resStats.json();
      setStats(dataStats);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddContratista = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(getApiUrl("/api/contratistas/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || errorData.rut || "No se pudo guardar la empresa contratista. Verifica que el RUT no esté duplicado.");
      }

      // Reiniciar formulario y cerrar modal
      setForm({
        razon_social: "",
        rut: "",
        tipo: "CONTRATISTA",
        giro: "",
        nombre_representante: "",
        email_contacto: "",
        telefono_contacto: "",
        fecha_ingreso: new Date().toISOString().split("T")[0],
        observaciones: "",
        activo: true
      });
      setShowAddModal(false);
      // Recargar datos
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  // Filtrado lógico
  const filtered = contratistas.filter((c) => {
    // Buscar por razon social o rut
    const term = search.toLowerCase();
    const matchesSearch = c.razon_social.toLowerCase().includes(term) || c.rut.toLowerCase().includes(term);
    
    // Tipo
    const matchesTipo = filtroTipo === "TODOS" || c.tipo === filtroTipo;

    // Cumplimiento
    const matchesCumplimiento = filtroCumplimiento === "TODOS" || c.estado_cumplimiento === filtroCumplimiento;

    return matchesSearch && matchesTipo && matchesCumplimiento;
  });

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>
            🏢 Gestión de Contratistas y Proveedores
          </h1>
          <p style={s.subtitle}>
            Control y verificación documental según la Ley de Subcontratación 20.123.
          </p>
        </div>
        <button
          id="btn-agregar-contratista"
          style={s.addBtn}
          onClick={() => setShowAddModal(true)}
        >
          ➕ Agregar Contratista
        </button>
      </div>

      {/* Tarjetas de Estadísticas */}
      {stats && (
        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <span style={s.statIcon}>🏢</span>
            <div style={s.statInfo}>
              <span style={s.statValue}>{stats.total_contratistas}</span>
              <span style={s.statLabel}>Total Contratistas</span>
            </div>
          </div>
          <div style={{ ...s.statCard, borderLeft: "4px solid #10b981" }}>
            <span style={{ ...s.statIcon, color: "#10b981" }}>🟢</span>
            <div style={s.statInfo}>
              <span style={s.statValue}>{stats.contratistas_al_dia}</span>
              <span style={s.statLabel}>Al Día</span>
            </div>
          </div>
          <div style={{ ...s.statCard, borderLeft: "4px solid #f59e0b" }}>
            <span style={{ ...s.statIcon, color: "#f59e0b" }}>🟡</span>
            <div style={s.statInfo}>
              <span style={s.statValue}>{stats.contratistas_por_vencer}</span>
              <span style={s.statLabel}>Por Vencer</span>
            </div>
          </div>
          <div style={{ ...s.statCard, borderLeft: "4px solid #ef4444" }}>
            <span style={{ ...s.statIcon, color: "#ef4444" }}>🔴</span>
            <div style={s.statInfo}>
              <span style={s.statValue}>{stats.contratistas_criticos}</span>
              <span style={s.statLabel}>Críticos (Vencidos)</span>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={s.filtersCard}>
        <div style={s.searchWrapper}>
          <span style={s.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por Razón Social o RUT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchInput}
          />
        </div>

        <div style={s.filterGroup}>
          <span style={s.filterLabel}>Tipo:</span>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={s.selectInput}
          >
            <option value="TODOS">Todos</option>
            <option value="CONTRATISTA">Contratistas</option>
            <option value="PROVEEDOR">Proveedores</option>
          </select>
        </div>

        <div style={s.filterGroup}>
          <span style={s.filterLabel}>Cumplimiento:</span>
          <select
            value={filtroCumplimiento}
            onChange={(e) => setFiltroCumplimiento(e.target.value)}
            style={s.selectInput}
          >
            <option value="TODOS">Todos</option>
            <option value="AL_DIA">🟢 Al Día</option>
            <option value="POR_VENCER">🟡 Por Vencer</option>
            <option value="CRITICO">🔴 Crítico</option>
            <option value="SIN_DOCUMENTOS">⚪ Sin Documentos</option>
          </select>
        </div>
      </div>

      {/* Contenido (Tabla) */}
      <div style={s.tableContainer}>
        {loading && <div style={s.info}>Cargando contratistas y estados...</div>}
        {error && <div style={s.errorBox}>{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={s.empty}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏢</div>
            <p>No se encontraron contratistas o proveedores.</p>
            <p style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>
              Crea tu primer contratista usando el botón de la esquina superior derecha.
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Razón Social</th>
                <th style={s.th}>RUT</th>
                <th style={s.th}>Tipo</th>
                <th style={s.th}>Estado Cumplimiento</th>
                <th style={s.th}>Trabajadores</th>
                <th style={s.th}>Docs</th>
                <th style={s.th}>Ingreso</th>
                <th style={s.th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                let badgeStyle = s.badgeGray;
                let badgeText = "Sin Documentos";
                if (item.estado_cumplimiento === "AL_DIA") {
                  badgeStyle = s.badgeGreen;
                  badgeText = "Al Día";
                } else if (item.estado_cumplimiento === "POR_VENCER") {
                  badgeStyle = s.badgeYellow;
                  badgeText = "Por Vencer";
                } else if (item.estado_cumplimiento === "CRITICO") {
                  badgeStyle = s.badgeRed;
                  badgeText = "Crítico";
                }

                return (
                  <tr key={item.id} style={s.tr} id={`contratista-row-${item.id}`}>
                    <td style={s.td}>
                      <span style={s.conName}>{item.razon_social}</span>
                      {!item.activo && <span style={s.inactiveTag}>Inactivo</span>}
                    </td>
                    <td style={s.td}>{item.rut}</td>
                    <td style={s.td}>
                      <span style={{
                        ...s.tipoTag,
                        background: item.tipo === "CONTRATISTA" ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.15)",
                        color: item.tipo === "CONTRATISTA" ? "#a5b4fc" : "#a7f3d0"
                      }}>
                        {item.tipo === "CONTRATISTA" ? "Contratista" : "Proveedor"}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={badgeStyle}>{badgeText}</span>
                    </td>
                    <td style={s.td}>👷 {item.cant_trabajadores}</td>
                    <td style={s.td}>📄 {item.cant_documentos}</td>
                    <td style={s.td}>{formatDate(item.fecha_ingreso)}</td>
                    <td style={s.td}>
                      <a
                        href={`/panel/contratistas/${item.id}`}
                        style={s.viewBtn}
                        id={`btn-ver-contratista-${item.id}`}
                      >
                        🔎 Ver Ficha
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Agregar Contratista */}
      {showAddModal && (
        <div style={s.overlay} onClick={() => setShowAddModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>➕ Registrar Contratista / Proveedor</h3>
              <button
                style={s.closeBtn}
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddContratista} style={s.form}>
              <div style={s.formGrid}>
                <div style={s.formGroup}>
                  <label style={s.label}>Razón Social *</label>
                  <input
                    type="text"
                    name="razon_social"
                    required
                    value={form.razon_social}
                    onChange={handleInputChange}
                    style={s.input}
                    placeholder="Ej. Constructora Alerce S.A."
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>RUT de la Empresa *</label>
                  <input
                    type="text"
                    name="rut"
                    required
                    value={form.rut}
                    onChange={handleInputChange}
                    style={s.input}
                    placeholder="Ej. 76.123.456-K"
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Tipo de Empresa *</label>
                  <select
                    name="tipo"
                    value={form.tipo}
                    onChange={handleInputChange}
                    style={s.input}
                  >
                    <option value="CONTRATISTA">Contratista</option>
                    <option value="PROVEEDOR">Proveedor</option>
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Giro Comercial</label>
                  <input
                    type="text"
                    name="giro"
                    value={form.giro}
                    onChange={handleInputChange}
                    style={s.input}
                    placeholder="Ej. Obras Civiles y Construcción"
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Nombre Representante</label>
                  <input
                    type="text"
                    name="nombre_representante"
                    value={form.nombre_representante}
                    onChange={handleInputChange}
                    style={s.input}
                    placeholder="Ej. Carlos Mendoza Torres"
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Correo de Contacto</label>
                  <input
                    type="email"
                    name="email_contacto"
                    value={form.email_contacto}
                    onChange={handleInputChange}
                    style={s.input}
                    placeholder="Ej. contacto@empresa.cl"
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Teléfono de Contacto</label>
                  <input
                    type="text"
                    name="telefono_contacto"
                    value={form.telefono_contacto}
                    onChange={handleInputChange}
                    style={s.input}
                    placeholder="Ej. +56912345678"
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Fecha Ingreso Obra</label>
                  <input
                    type="date"
                    name="fecha_ingreso"
                    value={form.fecha_ingreso}
                    onChange={handleInputChange}
                    style={s.input}
                  />
                </div>
              </div>
              <div style={s.formGroupFull}>
                <label style={s.label}>Observaciones / Notas</label>
                <textarea
                  name="observaciones"
                  rows={3}
                  value={form.observaciones}
                  onChange={handleInputChange}
                  style={s.textarea}
                  placeholder="Detalles sobre las labores contratadas, áreas de trabajo autorizadas, etc."
                />
              </div>

              <div style={s.formActions}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={s.cancelBtn}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Registrando..." : "💾 Registrar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: "28px 32px",
    minHeight: "100vh",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: "#f1f5f9"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px"
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#f1f5f9",
    margin: "0 0 6px"
  },
  subtitle: {
    fontSize: "14px",
    color: "#64748b",
    margin: 0
  },
  addBtn: {
    background: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(249,115,22,0.3)"
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
    marginBottom: "28px"
  },
  statCard: {
    background: "rgba(30, 41, 59, 0.7)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    borderRadius: "14px",
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    gap: "16px"
  },
  statIcon: {
    fontSize: "28px"
  },
  statInfo: {
    display: "flex",
    flexDirection: "column"
  },
  statValue: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#f1f5f9"
  },
  statLabel: {
    fontSize: "12px",
    color: "#64748b"
  },
  filtersCard: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    borderRadius: "12px",
    padding: "16px 20px",
    display: "flex",
    gap: "20px",
    marginBottom: "24px",
    flexWrap: "wrap",
    alignItems: "center"
  },
  searchWrapper: {
    display: "flex",
    alignItems: "center",
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    padding: "0 12px",
    flex: 1,
    minWidth: "260px"
  },
  searchIcon: {
    fontSize: "14px",
    color: "#64748b"
  },
  searchInput: {
    background: "transparent",
    border: "none",
    padding: "8px 10px",
    fontSize: "13px",
    color: "#f1f5f9",
    outline: "none",
    width: "100%"
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  filterLabel: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 600
  },
  selectInput: {
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "#f1f5f9",
    outline: "none",
    cursor: "pointer"
  },
  tableContainer: {
    background: "rgba(30, 41, 59, 0.4)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    borderRadius: "14px",
    padding: "16px 0",
    overflowX: "auto"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left"
  },
  th: {
    padding: "12px 20px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
    fontSize: "12px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em"
  },
  tr: {
    borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
    transition: "background 0.2s"
  },
  td: {
    padding: "14px 20px",
    fontSize: "13px",
    color: "#cbd5e1"
  },
  conName: {
    fontWeight: 700,
    color: "#f1f5f9",
    marginRight: "8px"
  },
  inactiveTag: {
    fontSize: "10px",
    background: "rgba(239, 68, 68, 0.12)",
    color: "#fca5a5",
    padding: "1px 6px",
    borderRadius: "4px",
    fontWeight: 600
  },
  tipoTag: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: "6px"
  },
  badgeGreen: {
    background: "rgba(16, 185, 129, 0.15)",
    color: "#34d399",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: 700,
    fontSize: "11px"
  },
  badgeYellow: {
    background: "rgba(245, 158, 11, 0.15)",
    color: "#fbbf24",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: 700,
    fontSize: "11px"
  },
  badgeRed: {
    background: "rgba(239, 68, 68, 0.15)",
    color: "#fca5a5",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: 700,
    fontSize: "11px"
  },
  badgeGray: {
    background: "rgba(148, 163, 184, 0.15)",
    color: "#cbd5e1",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: 700,
    fontSize: "11px"
  },
  viewBtn: {
    display: "inline-block",
    textDecoration: "none",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "6px",
    padding: "5px 10px",
    fontSize: "12px",
    color: "#f1f5f9",
    fontWeight: 600,
    transition: "all 0.2s"
  },
  info: {
    color: "#64748b",
    fontSize: "14px",
    textAlign: "center",
    padding: "40px"
  },
  errorBox: {
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "10px",
    padding: "14px",
    margin: "0 20px 20px",
    fontSize: "13px",
    color: "#fca5a5"
  },
  empty: {
    textAlign: "center",
    color: "#475569",
    fontSize: "14px",
    padding: "60px 20px"
  },
  // Modal Overlay
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px"
  },
  modal: {
    background: "rgba(15, 23, 42, 0.98)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "20px",
    padding: "32px",
    maxWidth: "700px",
    width: "100%",
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    maxHeight: "90vh",
    overflowY: "auto"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px"
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#f1f5f9",
    margin: 0
  },
  closeBtn: {
    background: "rgba(148, 163, 184, 0.1)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    color: "#94a3b8",
    width: "30px",
    height: "30px",
    cursor: "pointer",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px"
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  formGroupFull: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#94a3b8"
  },
  input: {
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#f1f5f9",
    outline: "none"
  },
  textarea: {
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#f1f5f9",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical"
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "12px"
  },
  cancelBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13px",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: 600
  },
  submitBtn: {
    background: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer"
  }
};
