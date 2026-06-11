"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../../../../utils/api";

interface Trabajador {
  id: number;
  nombre_completo: string;
  rut: string;
  cargo: string;
  fecha_ingreso_obra: string;
  fecha_egreso_obra: string | null;
  activo: boolean;
  contratista: number;
}

interface Documento {
  id: number;
  tipo: string;
  nombre_personalizado: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  archivo: string | null;
  notas: string | null;
  fecha_carga: string;
  estado_calculado: "VIGENTE" | "POR_VENCER" | "VENCIDO" | "SIN_VENCIMIENTO";
}

interface Contratista {
  id: number;
  razon_social: string;
  rut: string;
  tipo: "CONTRATISTA" | "PROVEEDOR";
  giro: string;
  nombre_representante: string;
  email_contacto: string;
  telefono_contacto: string;
  activo: boolean;
  fecha_ingreso: string;
  observaciones: string | null;
  fecha_creacion: string;
  documentos: Documento[];
  trabajadores: Trabajador[];
  estado_cumplimiento: string;
}

const TIPO_DOC_LABEL: Record<string, string> = {
  F30: "Certificado F30 (Antecedentes Laborales/Previsionales)",
  F30_1: "Certificado F30-1 (Detalle de Deuda y Cumplimiento)",
  SEGURO_ACCIDENTE: "Certificado Seguro Accidentes (Ley 16.744)",
  CONTRATO_TRABAJO: "Contrato de Trabajo del Personal",
  ODI: "Obligación de Informar (ODI / DAS)",
  REGLAMENTO_INTERNO: "Reglamento Interno de Higiene y Seguridad",
  OTRO: "Otro Documento"
};

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  return { Authorization: token ? `Bearer ${token}` : "" };
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function ContratistaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: contratistaId } = use(params);
  const router = useRouter();

  const [contratista, setContratista] = useState<Contratista | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: "general", "documentos", "trabajadores"
  const [activeTab, setActiveTab] = useState<"general" | "documentos" | "trabajadores">("general");

  // Form de datos generales
  const [generalForm, setGeneralForm] = useState({
    razon_social: "",
    rut: "",
    tipo: "CONTRATISTA",
    giro: "",
    nombre_representante: "",
    email_contacto: "",
    telefono_contacto: "",
    fecha_ingreso: "",
    observaciones: "",
    activo: true
  });
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Modal Documento
  const [showDocModal, setShowDocModal] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docForm, setDocForm] = useState({
    tipo: "F30",
    nombre_personalizado: "",
    fecha_emision: new Date().toISOString().split("T")[0],
    fecha_vencimiento: "",
    notas: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Modal Trabajador
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<number | null>(null);
  const [savingWorker, setSavingWorker] = useState(false);
  const [workerForm, setWorkerForm] = useState({
    nombre_completo: "",
    rut: "",
    cargo: "",
    fecha_ingreso_obra: new Date().toISOString().split("T")[0],
    fecha_egreso_obra: "",
    activo: true
  });

  const fetchContratista = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/contratistas/${contratistaId}/`), {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Error al obtener los detalles del contratista.");
      const data = await res.json();
      setContratista(data);
      setGeneralForm({
        razon_social: data.razon_social,
        rut: data.rut,
        tipo: data.tipo,
        giro: data.giro || "",
        nombre_representante: data.nombre_representante || "",
        email_contacto: data.email_contacto || "",
        telefono_contacto: data.telefono_contacto || "",
        fecha_ingreso: data.fecha_ingreso,
        observaciones: data.observaciones || "",
        activo: data.activo
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }, [contratistaId]);

  useEffect(() => {
    fetchContratista();
  }, [fetchContratista]);

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      const res = await fetch(getApiUrl(`/api/contratistas/${contratistaId}/`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(generalForm)
      });
      if (!res.ok) throw new Error("No se pudieron guardar los cambios generales.");
      const updated = await res.json();
      setContratista(updated);
      alert("✅ Datos generales guardados con éxito.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDoc(true);
    try {
      const formData = new FormData();
      formData.append("contratista", contratistaId);
      formData.append("tipo", docForm.tipo);
      formData.append("fecha_emision", docForm.fecha_emision);
      if (docForm.tipo === "OTRO" && docForm.nombre_personalizado) {
        formData.append("nombre_personalizado", docForm.nombre_personalizado);
      }
      if (docForm.fecha_vencimiento) {
        formData.append("fecha_vencimiento", docForm.fecha_vencimiento);
      }
      if (docForm.notas) {
        formData.append("notas", docForm.notas);
      }
      if (selectedFile) {
        formData.append("archivo", selectedFile);
      }

      const res = await fetch(getApiUrl("/api/documentos-contratista/"), {
        method: "POST",
        headers: getAuthHeaders(), // NOT content-type: multipart/form-data browser handles boundary automatically
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "No se pudo subir el documento.");
      }

      setShowDocModal(false);
      setDocForm({
        tipo: "F30",
        nombre_personalizado: "",
        fecha_emision: new Date().toISOString().split("T")[0],
        fecha_vencimiento: "",
        notas: ""
      });
      setSelectedFile(null);
      fetchContratista();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir.");
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDocDelete = async (docId: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este documento?")) return;
    try {
      const res = await fetch(getApiUrl(`/api/documentos-contratista/${docId}/`), {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("No se pudo eliminar el documento.");
      fetchContratista();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar.");
    }
  };

  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWorker(true);
    try {
      const payload = {
        ...workerForm,
        contratista: Number(contratistaId),
        fecha_egreso_obra: workerForm.fecha_egreso_obra || null
      };

      const url = editingWorkerId 
        ? getApiUrl(`/api/trabajadores-subcontratados/${editingWorkerId}/`)
        : getApiUrl("/api/trabajadores-subcontratados/");
      const method = editingWorkerId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("No se pudo guardar la información del trabajador.");

      setShowWorkerModal(false);
      setEditingWorkerId(null);
      setWorkerForm({
        nombre_completo: "",
        rut: "",
        cargo: "",
        fecha_ingreso_obra: new Date().toISOString().split("T")[0],
        fecha_egreso_obra: "",
        activo: true
      });
      fetchContratista();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar trabajador.");
    } finally {
      setSavingWorker(false);
    }
  };

  const handleWorkerEdit = (worker: Trabajador) => {
    setEditingWorkerId(worker.id);
    setWorkerForm({
      nombre_completo: worker.nombre_completo,
      rut: worker.rut,
      cargo: worker.cargo,
      fecha_ingreso_obra: worker.fecha_ingreso_obra,
      fecha_egreso_obra: worker.fecha_egreso_obra || "",
      activo: worker.activo
    });
    setShowWorkerModal(true);
  };

  const handleWorkerDelete = async (workerId: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este trabajador de la nómina?")) return;
    try {
      const res = await fetch(getApiUrl(`/api/trabajadores-subcontratados/${workerId}/`), {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("No se pudo eliminar al trabajador.");
      fetchContratista();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar.");
    }
  };

  if (loading && !contratista) {
    return (
      <div style={s.page}>
        <div style={s.info}>Cargando ficha de contratista...</div>
      </div>
    );
  }

  if (error || !contratista) {
    return (
      <div style={s.page}>
        <div style={s.errorBox}>
          <h3>Error</h3>
          <p>{error || "Contratista no encontrado."}</p>
          <button style={s.cancelBtn} onClick={() => router.push("/panel/contratistas")}>
            ⬅ Volver al listado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Volver */}
      <button style={s.backLink} onClick={() => router.push("/panel/contratistas")}>
        ⬅ Volver a Contratistas
      </button>

      {/* Header Ficha */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{contratista.razon_social}</h1>
          <p style={s.subtitle}>
            RUT: {contratista.rut} &bull; Giro: {contratista.giro || "No especificado"}
          </p>
        </div>
        <div>
          <span style={{
            ...s.tipoTag,
            background: contratista.tipo === "CONTRATISTA" ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.15)",
            color: contratista.tipo === "CONTRATISTA" ? "#a5b4fc" : "#a7f3d0",
            fontSize: "13px",
            padding: "6px 14px",
            marginRight: "12px"
          }}>
            {contratista.tipo === "CONTRATISTA" ? "Contratista" : "Proveedor"}
          </span>
          <span style={{
            ...(contratista.estado_cumplimiento === "AL_DIA" ? s.badgeGreen :
                contratista.estado_cumplimiento === "POR_VENCER" ? s.badgeYellow :
                contratista.estado_cumplimiento === "CRITICO" ? s.badgeRed : s.badgeGray),
            fontSize: "13px",
            padding: "6px 14px"
          }}>
            {contratista.estado_cumplimiento === "AL_DIA" ? "Al Día" :
             contratista.estado_cumplimiento === "POR_VENCER" ? "Por Vencer" :
             contratista.estado_cumplimiento === "CRITICO" ? "Crítico" : "Sin Docs"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabsContainer}>
        <button
          style={{ ...s.tabButton, ...(activeTab === "general" ? s.tabActive : {}) }}
          onClick={() => setActiveTab("general")}
        >
          📝 Datos Generales
        </button>
        <button
          style={{ ...s.tabButton, ...(activeTab === "documentos" ? s.tabActive : {}) }}
          onClick={() => setActiveTab("documentos")}
          id="tab-documentos"
        >
          📄 Documentos ({contratista.documentos.length})
        </button>
        <button
          style={{ ...s.tabButton, ...(activeTab === "trabajadores" ? s.tabActive : {}) }}
          onClick={() => setActiveTab("trabajadores")}
          id="tab-nomina"
        >
          👷 Nómina Trabajadores ({contratista.trabajadores.length})
        </button>
      </div>

      {/* Tab content */}
      <div style={s.tabContent}>
        
        {/* 1. Datos Generales */}
        {activeTab === "general" && (
          <form onSubmit={handleGeneralSubmit} style={s.form}>
            <div style={s.formGrid}>
              <div style={s.formGroup}>
                <label style={s.label}>Razón Social</label>
                <input
                  type="text"
                  required
                  value={generalForm.razon_social}
                  onChange={(e) => setGeneralForm(p => ({ ...p, razon_social: e.target.value }))}
                  style={s.input}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>RUT</label>
                <input
                  type="text"
                  required
                  value={generalForm.rut}
                  onChange={(e) => setGeneralForm(p => ({ ...p, rut: e.target.value }))}
                  style={s.input}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Tipo de Relación</label>
                <select
                  value={generalForm.tipo}
                  onChange={(e) => setGeneralForm(p => ({ ...p, tipo: e.target.value }))}
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
                  value={generalForm.giro}
                  onChange={(e) => setGeneralForm(p => ({ ...p, giro: e.target.value }))}
                  style={s.input}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Nombre Representante</label>
                <input
                  type="text"
                  value={generalForm.nombre_representante}
                  onChange={(e) => setGeneralForm(p => ({ ...p, nombre_representante: e.target.value }))}
                  style={s.input}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Email de Contacto</label>
                <input
                  type="email"
                  value={generalForm.email_contacto}
                  onChange={(e) => setGeneralForm(p => ({ ...p, email_contacto: e.target.value }))}
                  style={s.input}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Teléfono de Contacto</label>
                <input
                  type="text"
                  value={generalForm.telefono_contacto}
                  onChange={(e) => setGeneralForm(p => ({ ...p, telefono_contacto: e.target.value }))}
                  style={s.input}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Fecha Ingreso Obra</label>
                <input
                  type="date"
                  value={generalForm.fecha_ingreso}
                  onChange={(e) => setGeneralForm(p => ({ ...p, fecha_ingreso: e.target.value }))}
                  style={s.input}
                />
              </div>
              <div style={{ ...s.formGroup, justifyContent: "center" }}>
                <label style={s.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={generalForm.activo}
                    onChange={(e) => setGeneralForm(p => ({ ...p, activo: e.target.checked }))}
                    style={s.checkbox}
                  />
                  Contratista Activo en Faena
                </label>
              </div>
            </div>
            
            <div style={s.formGroupFull}>
              <label style={s.label}>Observaciones / Descripción de Labores</label>
              <textarea
                rows={4}
                value={generalForm.observaciones}
                onChange={(e) => setGeneralForm(p => ({ ...p, observaciones: e.target.value }))}
                style={s.textarea}
              />
            </div>

            <button
              type="submit"
              disabled={savingGeneral}
              style={{ ...s.submitBtn, opacity: savingGeneral ? 0.7 : 1, width: "fit-content" }}
            >
              {savingGeneral ? "Guardando..." : "💾 Guardar Cambios"}
            </button>
          </form>
        )}

        {/* 2. Documentos */}
        {activeTab === "documentos" && (
          <div>
            <div style={s.tabHeader}>
              <h3 style={s.tabTitle}>Documentación de Cumplimiento</h3>
              <button
                id="btn-subir-documento"
                style={s.addBtnSmall}
                onClick={() => setShowDocModal(true)}
              >
                📤 Cargar Documento
              </button>
            </div>

            <div style={s.tableContainer}>
              {contratista.documentos.length === 0 ? (
                <div style={s.empty}>
                  <div style={{ fontSize: "36px", marginBottom: "10px" }}>📄</div>
                  <p>No se han cargado documentos para este contratista.</p>
                </div>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Tipo de Documento</th>
                      <th style={s.th}>Fecha Emisión</th>
                      <th style={s.th}>Fecha Vencimiento</th>
                      <th style={s.th}>Estado</th>
                      <th style={s.th}>Archivo</th>
                      <th style={s.th}>Notas</th>
                      <th style={s.th}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratista.documentos.map((doc) => {
                      let tagStyle = s.badgeGray;
                      let tagText = "Sin vencimiento";
                      if (doc.estado_calculado === "VIGENTE") {
                        tagStyle = s.badgeGreen;
                        tagText = "Vigente";
                      } else if (doc.estado_calculado === "POR_VENCER") {
                        tagStyle = s.badgeYellow;
                        tagText = "Por Vencer";
                      } else if (doc.estado_calculado === "VENCIDO") {
                        tagStyle = s.badgeRed;
                        tagText = "Vencido";
                      }

                      return (
                        <tr key={doc.id} style={s.tr} id={`documento-row-${doc.id}`}>
                          <td style={s.td}>
                            <strong>
                              {doc.tipo === "OTRO" && doc.nombre_personalizado
                                ? doc.nombre_personalizado
                                : TIPO_DOC_LABEL[doc.tipo] || doc.tipo}
                            </strong>
                          </td>
                          <td style={s.td}>{formatDate(doc.fecha_emision)}</td>
                          <td style={s.td}>{formatDate(doc.fecha_vencimiento || "")}</td>
                          <td style={s.td}>
                            <span style={tagStyle}>{tagText}</span>
                          </td>
                          <td style={s.td}>
                            {doc.archivo ? (
                              <a
                                href={doc.archivo}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={s.downloadLink}
                              >
                                📥 Descargar PDF
                              </a>
                            ) : (
                              <span style={{ color: "#64748b" }}>Sin archivo</span>
                            )}
                          </td>
                          <td style={s.td}>
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>{doc.notas || "—"}</span>
                          </td>
                          <td style={s.td}>
                            <button
                              style={s.deleteBtn}
                              onClick={() => handleDocDelete(doc.id)}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* 3. Nómina de Trabajadores */}
        {activeTab === "trabajadores" && (
          <div>
            <div style={s.tabHeader}>
              <h3 style={s.tabTitle}>Nómina de Personal Subcontratado</h3>
              <button
                id="btn-agregar-trabajador"
                style={s.addBtnSmall}
                onClick={() => {
                  setEditingWorkerId(null);
                  setWorkerForm({
                    nombre_completo: "",
                    rut: "",
                    cargo: "",
                    fecha_ingreso_obra: new Date().toISOString().split("T")[0],
                    fecha_egreso_obra: "",
                    activo: true
                  });
                  setShowWorkerModal(true);
                }}
              >
                👷 Agregar Trabajador
              </button>
            </div>

            <div style={s.tableContainer}>
              {contratista.trabajadores.length === 0 ? (
                <div style={s.empty}>
                  <div style={{ fontSize: "36px", marginBottom: "10px" }}>👷</div>
                  <p>No hay trabajadores registrados en la nómina.</p>
                </div>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Nombre Completo</th>
                      <th style={s.th}>RUT</th>
                      <th style={s.th}>Cargo / Función</th>
                      <th style={s.th}>Ingreso Obra</th>
                      <th style={s.th}>Egreso Obra</th>
                      <th style={s.th}>Estado</th>
                      <th style={s.th}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratista.trabajadores.map((worker) => (
                      <tr key={worker.id} style={s.tr} id={`trabajador-row-${worker.id}`}>
                        <td style={s.td}>
                          <strong>{worker.nombre_completo}</strong>
                        </td>
                        <td style={s.td}>{worker.rut}</td>
                        <td style={s.td}>{worker.cargo}</td>
                        <td style={s.td}>{formatDate(worker.fecha_ingreso_obra)}</td>
                        <td style={s.td}>{formatDate(worker.fecha_egreso_obra || "")}</td>
                        <td style={s.td}>
                          <span style={worker.activo ? s.badgeGreen : s.badgeRed}>
                            {worker.activo ? "Activo" : "Retirado"}
                          </span>
                        </td>
                        <td style={s.td}>
                          <button
                            style={{ ...s.viewBtn, marginRight: "8px", border: "1px solid rgba(99,102,241,0.4)" }}
                            onClick={() => handleWorkerEdit(worker)}
                            id={`btn-editar-trabajador-${worker.id}`}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            style={s.deleteBtn}
                            onClick={() => handleWorkerDelete(worker.id)}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal Subir Documento */}
      {showDocModal && (
        <div style={s.overlay} onClick={() => setShowDocModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>📤 Cargar Documento Legal</h3>
              <button
                style={s.closeBtn}
                onClick={() => setShowDocModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleDocSubmit} style={s.form}>
              <div style={s.formGroup}>
                <label style={s.label}>Tipo de Documento *</label>
                <select
                  value={docForm.tipo}
                  onChange={(e) => setDocForm(p => ({ ...p, tipo: e.target.value }))}
                  style={s.input}
                >
                  {Object.entries(TIPO_DOC_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {docForm.tipo === "OTRO" && (
                <div style={s.formGroup}>
                  <label style={s.label}>Nombre del Documento Personalizado *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Acta de Entrega EPP Especial"
                    value={docForm.nombre_personalizado}
                    onChange={(e) => setDocForm(p => ({ ...p, nombre_personalizado: e.target.value }))}
                    style={s.input}
                  />
                </div>
              )}

              <div style={s.formGrid}>
                <div style={s.formGroup}>
                  <label style={s.label}>Fecha de Emisión *</label>
                  <input
                    type="date"
                    required
                    value={docForm.fecha_emision}
                    onChange={(e) => setDocForm(p => ({ ...p, fecha_emision: e.target.value }))}
                    style={s.input}
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Fecha de Vencimiento (Si aplica)</label>
                  <input
                    type="date"
                    value={docForm.fecha_vencimiento}
                    onChange={(e) => setDocForm(p => ({ ...p, fecha_vencimiento: e.target.value }))}
                    style={s.input}
                  />
                </div>
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Archivo PDF (Opcional) *</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={s.input}
                  id="input-archivo-pdf"
                />
                <span style={{ fontSize: "11px", color: "#64748b" }}>Peso máximo recomendado: 10MB</span>
              </div>

              <div style={s.formGroupFull}>
                <label style={s.label}>Notas adicionales</label>
                <textarea
                  rows={2}
                  placeholder="Comentarios adicionales sobre el documento..."
                  value={docForm.notas}
                  onChange={(e) => setDocForm(p => ({ ...p, notas: e.target.value }))}
                  style={s.textarea}
                />
              </div>

              <div style={s.formActions}>
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  style={s.cancelBtn}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDoc}
                  style={{ ...s.submitBtn, opacity: savingDoc ? 0.7 : 1 }}
                  id="btn-confirmar-subida"
                >
                  {savingDoc ? "Subiendo..." : "💾 Cargar Documento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Trabajador */}
      {showWorkerModal && (
        <div style={s.overlay} onClick={() => setShowWorkerModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>
                {editingWorkerId ? "✏️ Editar Trabajador" : "👷 Agregar Trabajador a Nómina"}
              </h3>
              <button
                style={s.closeBtn}
                onClick={() => setShowWorkerModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleWorkerSubmit} style={s.form}>
              <div style={s.formGroup}>
                <label style={s.label}>Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez Gómez"
                  value={workerForm.nombre_completo}
                  onChange={(e) => setWorkerForm(p => ({ ...p, nombre_completo: e.target.value }))}
                  style={s.input}
                  id="input-nombre-trabajador"
                />
              </div>
              
              <div style={s.formGrid}>
                <div style={s.formGroup}>
                  <label style={s.label}>RUT *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 18.234.567-8"
                    value={workerForm.rut}
                    onChange={(e) => setWorkerForm(p => ({ ...p, rut: e.target.value }))}
                    style={s.input}
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Cargo / Función *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Jornal / Eléctrico / Supervisor"
                    value={workerForm.cargo}
                    onChange={(e) => setWorkerForm(p => ({ ...p, cargo: e.target.value }))}
                    style={s.input}
                  />
                </div>
              </div>

              <div style={s.formGrid}>
                <div style={s.formGroup}>
                  <label style={s.label}>Fecha Ingreso Obra *</label>
                  <input
                    type="date"
                    required
                    value={workerForm.fecha_ingreso_obra}
                    onChange={(e) => setWorkerForm(p => ({ ...p, fecha_ingreso_obra: e.target.value }))}
                    style={s.input}
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Fecha Egreso Obra (Si se retiró)</label>
                  <input
                    type="date"
                    value={workerForm.fecha_egreso_obra}
                    onChange={(e) => setWorkerForm(p => ({ ...p, fecha_egreso_obra: e.target.value }))}
                    style={s.input}
                  />
                </div>
              </div>

              <div style={s.formGroup}>
                <label style={s.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={workerForm.activo}
                    onChange={(e) => setWorkerForm(p => ({ ...p, activo: e.target.checked }))}
                    style={s.checkbox}
                  />
                  Trabajador Activo en Faena
                </label>
              </div>

              <div style={s.formActions}>
                <button
                  type="button"
                  onClick={() => setShowWorkerModal(false)}
                  style={s.cancelBtn}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWorker}
                  style={{ ...s.submitBtn, opacity: savingWorker ? 0.7 : 1 }}
                  id="btn-confirmar-trabajador"
                >
                  {savingWorker ? "Guardando..." : "💾 Guardar Trabajador"}
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
    padding: "24px 32px",
    minHeight: "100vh",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: "#f1f5f9"
  },
  backLink: {
    background: "transparent",
    border: "none",
    color: "#f97316",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    padding: 0,
    marginBottom: "16px",
    display: "flex",
    alignItems: "center"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  tabsContainer: {
    display: "flex",
    borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
    marginBottom: "28px",
    gap: "8px"
  },
  tabButton: {
    background: "transparent",
    border: "none",
    borderBottom: "3px solid transparent",
    color: "#64748b",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s"
  },
  tabActive: {
    color: "#f97316",
    borderBottom: "3px solid #f97316"
  },
  tabContent: {
    background: "rgba(30, 41, 59, 0.3)",
    border: "1px solid rgba(148, 163, 184, 0.08)",
    borderRadius: "16px",
    padding: "28px"
  },
  tabHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px"
  },
  tabTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#f1f5f9",
    margin: 0
  },
  addBtnSmall: {
    background: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px"
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
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "#cbd5e1",
    cursor: "pointer",
    userSelect: "none",
    marginTop: "20px"
  },
  checkbox: {
    accentColor: "#f97316",
    width: "16px",
    height: "16px",
    cursor: "pointer"
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
  },
  tableContainer: {
    background: "rgba(15, 23, 42, 0.4)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    borderRadius: "12px",
    overflow: "hidden"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left"
  },
  th: {
    padding: "12px 18px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
    fontSize: "12px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase"
  },
  tr: {
    borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
    transition: "background 0.2s"
  },
  td: {
    padding: "14px 18px",
    fontSize: "13px",
    color: "#cbd5e1"
  },
  downloadLink: {
    color: "#60a5fa",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "12px"
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: "15px"
  },
  viewBtn: {
    display: "inline-block",
    textDecoration: "none",
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "6px",
    padding: "4px 8px",
    fontSize: "12px",
    color: "#cbd5e1",
    cursor: "pointer"
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
    padding: "20px",
    fontSize: "13px",
    color: "#fca5a5"
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
    padding: "40px 20px"
  },
  // Modal Styles
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
    maxWidth: "600px",
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
  }
};
