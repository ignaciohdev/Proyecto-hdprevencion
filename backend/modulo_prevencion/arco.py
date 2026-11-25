"""
Motor operativo de derechos ARCO-POL y trazabilidad de datos personales (Ley N° 21.719).

Incluye:
1. Mapa declarativo completo de tablas y columnas (`MAPA_DATOS_PERSONALES` + `CATALOGO_SIN_PII`)
   con causal de licitud verificada, plazo de conservación y verificación automática de cobertura
   contra los modelos reales de `modulo_prevencion`.
2. Exportación portable JSON y CSV (con saneamiento anti-inyección de fórmulas) usando blind index
   HMAC-SHA256 (`rut_hmac`) para `InvestigacionAccidente` y `DenunciaLeyKarin`.
3. Ejecución transaccional real de Rectificación, Supresión/Anonimización bajo demanda y Oposición,
   respetando retenciones legales SST (5 años), Ley Karin (5 años) y Código Tributario (6 años).
4. Registro formal de rechazo de bloqueo provisional ante la APDP (Art. 11).
"""

import csv
import hashlib
import io
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .auditoria import registrar_evento_seguridad
from .consentimiento import registrar_consentimiento
from .crypto import calcular_rut_hmac, normalizar_rut_blind_index
from .models import (
    ActaSesionCPHS,
    AuditLogAccesoDenuncia,
    AuditLogEventoSeguridad,
    ComiteParitario,
    ContadorDescargas,
    Contratista,
    DenunciaLeyKarin,
    DocumentoUsuario,
    Empresa,
    EntregaEPP,
    Inspeccion,
    InvestigacionAccidente,
    MensajeContacto,
    MiembroCPHS,
    RegistroBrechaSeguridad,
    RegistroCapacitacion,
    RegistroConsentimiento,
    ReporteRiesgo,
    SolicitudCapacitacion,
    SolicitudDerechoARCO,
    SugerenciaConsulta,
    SugerenciaLaboral,
    Suscripcion,
    Trabajador,
    TrabajadorSubcontratado,
    Usuario,
)


# ==============================================================================
# MAPA DECLARATIVO DE TABLAS Y COLUMNAS (COBERTURA 100% DEL ESQUEMA)
# ==============================================================================

MAPA_DATOS_PERSONALES: dict[str, dict[str, Any]] = {
    'Usuario': {
        'modelo': Usuario,
        'tabla': 'modulo_prevencion_usuario',
        'categoria_titular': 'Usuario / Titular de Cuenta SaaS',
        'causa_licitud': 'Art. 12 y Art. 13 letra b) Ley N° 21.719 (consentimiento y ejecución contractual SaaS)',
        'plazo_conservacion': 'Vigencia contractual de la cuenta; antecedentes de facturación 6 años (Art. 17 Código Tributario)',
        'es_sensible': False,
        'campos_rectificables': ('first_name', 'last_name', 'email'),
        'columnas': (
            'id', 'password', 'last_login', 'is_superuser', 'username', 'first_name',
            'last_name', 'email', 'is_staff', 'is_active', 'date_joined', 'uuid',
            'tipo_usuario', 'cuenta_padre', 'foto_perfil', 'mfa_enabled', 'mfa_secret',
            'mfa_secret_pendiente', 'mfa_backup_codes_hashes', 'mfa_last_used_step',
            'mfa_enrolled_at',
        ),
    },
    'Suscripcion': {
        'modelo': Suscripcion,
        'tabla': 'modulo_prevencion_suscripcion',
        'categoria_titular': 'Usuario / Titular de Cuenta SaaS',
        'causa_licitud': 'Art. 13 letra b) y c) Ley N° 21.719 (ejecución contractual y respaldo tributario Art. 17 Código Tributario)',
        'plazo_conservacion': '6 años desde el término de vigencia contractual (Art. 17 y 200 Código Tributario)',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': ('id', 'usuario', 'plan', 'estado', 'fecha_inicio', 'fecha_vencimiento'),
    },
    'ContadorDescargas': {
        'modelo': ContadorDescargas,
        'tabla': 'modulo_prevencion_contadordescargas',
        'categoria_titular': 'Usuario / Titular de Cuenta SaaS',
        'causa_licitud': 'Art. 13 letra b) Ley N° 21.719 (control de cuota contractual del plan)',
        'plazo_conservacion': 'Vigencia activa de la cuenta de usuario',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': ('id', 'usuario', 'descargas_semanales', 'fecha_ultima_descarga'),
    },
    'DocumentoUsuario': {
        'modelo': DocumentoUsuario,
        'tabla': 'modulo_prevencion_documentousuario',
        'categoria_titular': 'Usuario / Titular de Cuenta SaaS',
        'causa_licitud': 'Art. 13 letra b) Ley N° 21.719 (prestación de servicio de edición documental SST)',
        'plazo_conservacion': 'Vigencia de la cuenta o hasta supresión solicitada por el titular (12 meses sin suscripción activa)',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': ('id', 'usuario', 'plantilla_maestra', 'datos_guardados', 'fecha_ultimo_guardado'),
    },
    'MensajeContacto': {
        'modelo': MensajeContacto,
        'tabla': 'modulo_prevencion_mensajecontacto',
        'categoria_titular': 'Usuario / Solicitante Web',
        'causa_licitud': 'Art. 12 Ley N° 21.719 (consentimiento explícito al remitir consulta de contacto)',
        'plazo_conservacion': '12 meses desde la recepción o hasta supresión/oposición del titular',
        'es_sensible': False,
        'campos_rectificables': ('nombre', 'email'),
        'columnas': ('id', 'usuario', 'nombre', 'email', 'asunto', 'mensaje', 'leido', 'fecha_creacion'),
    },
    'Empresa': {
        'modelo': Empresa,
        'tabla': 'modulo_prevencion_empresa',
        'categoria_titular': 'Representante / Entidad Empleadora',
        'causa_licitud': 'Art. 13 letra b) y c) Ley N° 21.719 (gestión B2B de cumplimiento Ley N° 16.744 y D.S. N° 44)',
        'plazo_conservacion': 'Vigencia del contrato de prestación SST más 5 años para registros laborales asociados',
        'es_sensible': False,
        'campos_rectificables': ('razon_social', 'nombre_fantasia', 'giro'),
        'columnas': (
            'id', 'prevencionista', 'razon_social', 'nombre_fantasia', 'rut',
            'giro', 'mutualidad', 'tasa_cotizacion_adicional', 'activo', 'fecha_creacion',
        ),
    },
    'Trabajador': {
        'modelo': Trabajador,
        'tabla': 'modulo_prevencion_trabajador',
        'categoria_titular': 'Trabajador / Colaborador SST',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (deber legal de protección SST Art. 184 Código del Trabajo, Ley N° 16.744 y D.S. N° 44)',
        'plazo_conservacion': '5 años desde término de la relación laboral / prescripción SST (Art. 510 Código del Trabajo)',
        'es_sensible': False,
        'campos_rectificables': ('nombres', 'apellidos', 'cargo', 'correo', 'telefono'),
        'columnas': (
            'id', 'empresa', 'centro_trabajo', 'rut', 'nombres', 'apellidos',
            'cargo', 'correo', 'telefono', 'fecha_ingreso', 'estado', 'fecha_creacion',
        ),
    },
    'ReporteRiesgo': {
        'modelo': ReporteRiesgo,
        'tabla': 'modulo_prevencion_reporteriesgo',
        'categoria_titular': 'Trabajador / Reportante SST',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (Arts. 10 y 66 D.S. N° 44) y Art. 12 Ley N° 21.719 (consentimiento en datos identificatorios opcionales QR)',
        'plazo_conservacion': '5 años registro técnico de peligro SST; datos opcionales del reportante anonimizables a solicitud',
        'es_sensible': False,
        'campos_rectificables': ('nombre_reportante', 'contacto_reportante'),
        'columnas': (
            'id', 'uuid', 'usuario', 'empresa', 'centro_trabajo', 'tipo', 'descripcion',
            'lugar', 'empresa_faena', 'area_puesto', 'clasificacion_peligro',
            'norma_infringida', 'probabilidad', 'severidad', 'nivel_riesgo_calculado',
            'gravedad', 'estado', 'jerarquia_control', 'medida_correctiva', 'responsable',
            'fecha_limite', 'foto_evidencia', 'fecha_resolucion', 'reportado_por_externo',
            'nombre_reportante', 'rut_reportante', 'contacto_reportante', 'fecha_creacion',
        ),
    },
    'Inspeccion': {
        'modelo': Inspeccion,
        'tabla': 'modulo_prevencion_inspeccion',
        'categoria_titular': 'Inspector / Trabajador SST',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (inspecciones obligatorias D.S. N° 594 y D.S. N° 44)',
        'plazo_conservacion': '5 años para fiscalización DT y SEREMI de Salud',
        'es_sensible': False,
        'campos_rectificables': ('firma_nombre',),
        'columnas': (
            'id', 'usuario', 'empresa', 'centro_trabajo', 'plantilla', 'fecha',
            'respuestas', 'porcentaje_cumplimiento', 'firma_nombre', 'firma_rut',
        ),
    },
    'InvestigacionAccidente': {
        'modelo': InvestigacionAccidente,
        'tabla': 'modulo_prevencion_investigacionaccidente',
        'categoria_titular': 'Trabajador Afectado (Datos de Salud Sensibles)',
        'causa_licitud': 'Art. 16 y Art. 13 letra c) Ley N° 21.719 (obligación legal Art. 76 Ley N° 16.744, D.S. N° 44 y Compendio SUSESO)',
        'plazo_conservacion': 'Mínimo 5 años desde ocurrencia del accidente o cierre SUSESO (cifrado en reposo e índice ciego HMAC)',
        'es_sensible': True,
        'campos_rectificables': ('nombre_afectado', 'cargo_afectado'),
        'columnas': (
            'id', 'usuario', 'empresa', 'trabajador', 'nombre_afectado', 'rut_afectado',
            'rut_hmac', 'cargo_afectado', 'edad_afectado', 'antiguedad_afectado',
            'tipo_evento', 'fecha_hora_evento', 'lugar_evento', 'descripcion_evento',
            'tipo_lesion', 'parte_cuerpo_afectada', 'causas_inmediatas', 'causas_basicas',
            'analisis_5_porques', 'plan_accion', 'diat_presentada', 'diat_folio',
            'diat_fecha_presentacion', 'plazo_limite_diat_24h', 'es_grave_o_fatal',
            'tipo_accidente_grave', 'faena_suspendida', 'aviso_autoridades_realizado',
            'aviso_autoridades_folio', 'aviso_autoridades_fecha', 'arbol_de_causas',
            'plazo_investigacion_suseso_30d', 'reanudacion_autorizada',
            'resolucion_reanudacion_dt_seremi', 'dias_perdidos', 'alta_medica',
            'fecha_creacion',
        ),
    },
    'RegistroCapacitacion': {
        'modelo': RegistroCapacitacion,
        'tabla': 'modulo_prevencion_registrocapacitacion',
        'categoria_titular': 'Trabajador Asistente a Capacitación SST',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (obligación de informar riesgos Art. 15 D.S. N° 44 y Ley N° 16.744)',
        'plazo_conservacion': '5 años desde realización (nómina de asistentes cifrada en reposo)',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': (
            'id', 'uuid', 'usuario', 'empresa', 'centro_trabajo', 'tema', 'estado',
            'fecha_programada', 'fecha_realizacion', 'lugar', 'asistentes',
            'observaciones', 'evaluacion_comprension_aplicada',
            'porcentaje_aprobacion_minimo', 'entidad_capacitadora', 'codigo_sence',
            'certificado_emitido', 'fecha_creacion',
        ),
    },
    'SugerenciaConsulta': {
        'modelo': SugerenciaConsulta,
        'tabla': 'modulo_prevencion_sugerenciaconsulta',
        'categoria_titular': 'Usuario / Remitente Buzón',
        'causa_licitud': 'Art. 12 Ley N° 21.719 (consentimiento explícito en identificación opcional)',
        'plazo_conservacion': '24 meses desde cierre o anonimización inmediata a solicitud',
        'es_sensible': False,
        'campos_rectificables': ('nombre_remitente', 'contacto_remitente'),
        'columnas': (
            'id', 'uuid', 'usuario', 'tipo', 'mensaje', 'anonimo', 'nombre_remitente',
            'contacto_remitente', 'leido', 'respuesta', 'fecha_creacion', 'fecha_respuesta',
        ),
    },
    'SugerenciaLaboral': {
        'modelo': SugerenciaLaboral,
        'tabla': 'modulo_prevencion_sugerencialaboral',
        'categoria_titular': 'Trabajador / Remitente QR',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (participación Art. 66 D.S. N° 44) y Art. 12 en identificación opcional',
        'plazo_conservacion': '5 años registro participativo; identidad opcional anonimizable a solicitud',
        'es_sensible': False,
        'campos_rectificables': ('nombre_remitente', 'contacto_remitente'),
        'columnas': (
            'id', 'uuid', 'empresa', 'mensaje', 'tipo', 'es_anonimo',
            'nombre_remitente', 'contacto_remitente', 'estado', 'respuesta', 'fecha_creacion',
        ),
    },
    'DenunciaLeyKarin': {
        'modelo': DenunciaLeyKarin,
        'tabla': 'modulo_prevencion_denuncialeykarin',
        'categoria_titular': 'Denunciante y Denunciado (Ley Karin — Confidencial/Sensible)',
        'causa_licitud': 'Art. 16 y Art. 13 letra c) Ley N° 21.719 (Arts. 211-B y ss. Código del Trabajo, Ley N° 21.643 y D.S. N° 21/2024 MINTRAB)',
        'plazo_conservacion': '5 años desde resolución/derivación DT/Mutualidad con reserva estricta de identidad',
        'es_sensible': True,
        'campos_rectificables': (),
        'columnas': (
            'id', 'uuid', 'empresa', 'centro_trabajo', 'tipo_afectacion',
            'rut_denunciante', 'rut_hmac', 'nombre_denunciante', 'correo_denunciante',
            'telefono_denunciante', 'nombre_denunciado', 'cargo_area_denunciado',
            'descripcion_circunstanciada', 'testigos_o_evidencias', 'fecha_hora_ingreso',
            'plazo_limite_derivacion_dt', 'estado_tramite', 'medidas_resguardo_detalle',
            'derivada_inspeccion_trabajo', 'folio_dt', 'derivada_mutualidad',
            'fecha_derivacion_mutualidad', 'folio_mutualidad', 'comprobante_anexo_67',
            'atencion_psicologica_ofrecida', 'fecha_ofrecimiento_psicologico',
            'plazo_limite_informe_mutualidad_5d',
        ),
    },
    'AuditLogAccesoDenuncia': {
        'modelo': AuditLogAccesoDenuncia,
        'tabla': 'modulo_prevencion_auditlogaccesodenuncia',
        'categoria_titular': 'Usuario Revisor / Auditoría Confidencial',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (deber de reserva y trazabilidad Ley N° 21.643 y Art. 14 sexies Ley N° 21.719)',
        'plazo_conservacion': '5 años (registro inmutable append-only)',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': ('id', 'denuncia', 'usuario', 'fecha_hora', 'ip_origen', 'accion'),
    },
    'Contratista': {
        'modelo': Contratista,
        'tabla': 'modulo_prevencion_contratista',
        'categoria_titular': 'Representante / Empresa Contratista',
        'causa_licitud': 'Art. 13 letra b) y c) Ley N° 21.719 (control subcontratación Arts. 183-A a 183-E Código del Trabajo y Ley N° 20.123)',
        'plazo_conservacion': '5 años desde término de faena/contrato (prescripción Art. 183-B y 510 Código del Trabajo)',
        'es_sensible': False,
        'campos_rectificables': ('nombre_representante', 'email_contacto', 'telefono_contacto'),
        'columnas': (
            'id', 'tipo', 'usuario', 'empresa_principal', 'centro_trabajo',
            'razon_social', 'rut', 'giro', 'nombre_representante', 'email_contacto',
            'telefono_contacto', 'activo', 'fecha_ingreso', 'observaciones', 'fecha_creacion',
        ),
    },
    'TrabajadorSubcontratado': {
        'modelo': TrabajadorSubcontratado,
        'tabla': 'modulo_prevencion_trabajadorsubcontratado',
        'categoria_titular': 'Trabajador en Régimen de Subcontratación',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (Ley N° 20.123, D.S. N° 76 MINTRAB y Art. 183-E Código del Trabajo)',
        'plazo_conservacion': '5 años desde egreso de obra o término de contrato principal',
        'es_sensible': False,
        'campos_rectificables': ('nombre_completo', 'cargo'),
        'columnas': (
            'id', 'contratista', 'nombre_completo', 'rut', 'cargo',
            'fecha_ingreso_obra', 'fecha_egreso_obra', 'activo',
        ),
    },
    'SolicitudCapacitacion': {
        'modelo': SolicitudCapacitacion,
        'tabla': 'modulo_prevencion_solicitudcapacitacion',
        'categoria_titular': 'Solicitante Comercial / Prevencionista',
        'causa_licitud': 'Art. 12 y Art. 13 letra b) Ley N° 21.719 (solicitud comercial/precontractual)',
        'plazo_conservacion': '24 meses desde cierre o hasta supresión solicitada sin relación contractual vigente',
        'es_sensible': False,
        'campos_rectificables': ('contacto_nombre', 'contacto_cargo', 'contacto_email', 'contacto_telefono'),
        'columnas': (
            'id', 'usuario', 'empresa', 'rut_empresa', 'contacto_nombre',
            'contacto_cargo', 'contacto_email', 'contacto_telefono', 'tipo_capacitacion',
            'tema', 'perfil_relator', 'modalidad', 'region_comuna',
            'cantidad_trabajadores', 'fecha_tentativa', 'mensaje_adicional',
            'estado', 'notas_internas', 'fecha_creacion', 'fecha_actualizacion',
        ),
    },
    'MiembroCPHS': {
        'modelo': MiembroCPHS,
        'tabla': 'modulo_prevencion_miembrocphs',
        'categoria_titular': 'Integrante Comité Paritario (CPHS)',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (Ley N° 16.744 Art. 66, D.S. N° 54/1969 y D.S. N° 44)',
        'plazo_conservacion': 'Duración del mandato (2 años) más 5 años de archivo legal CPHS',
        'es_sensible': False,
        'campos_rectificables': ('nombre', 'cargo'),
        'columnas': (
            'id', 'comite', 'trabajador', 'nombre', 'rut', 'estamento',
            'tipo_representacion', 'cargo', 'activo', 'tiene_fuero_laboral',
            'causal_cese', 'fecha_designacion', 'fecha_creacion',
        ),
    },
    'ActaSesionCPHS': {
        'modelo': ActaSesionCPHS,
        'tabla': 'modulo_prevencion_actasesioncphs',
        'categoria_titular': 'Integrante / Asistente a Sesión CPHS',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (D.S. N° 54/1969 MINTRAB obligación de actas)',
        'plazo_conservacion': '5 años para fiscalización Dirección del Trabajo',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': (
            'id', 'comite', 'numero_acta', 'tipo_sesion', 'fecha_hora_sesion',
            'lugar', 'asistentes', 'tabla_temas', 'acuerdos', 'fecha_creacion',
        ),
    },
    'EntregaEPP': {
        'modelo': EntregaEPP,
        'tabla': 'modulo_prevencion_entregaepp',
        'categoria_titular': 'Trabajador Receptor de EPP / RIOHS (Biometría / Firma)',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 y Art. 16 ter (Art. 68 Ley N° 16.744, Art. 184 Código del Trabajo, Arts. 52-55 D.S. N° 44)',
        'plazo_conservacion': '5 años desde la entrega (firma digital e IP cifradas en reposo)',
        'es_sensible': True,
        'campos_rectificables': (),
        'columnas': (
            'id', 'empresa', 'centro_trabajo', 'trabajador', 'responsable_entrega',
            'items_epp', 'entrega_riohs', 'version_riohs', 'declaracion_capacitacion',
            'firma_digital', 'ip_registro', 'fecha_hora_entrega',
        ),
    },
    'SolicitudDerechoARCO': {
        'modelo': SolicitudDerechoARCO,
        'tabla': 'modulo_prevencion_solicitudderechoarco',
        'categoria_titular': 'Titular Solicitante de Derechos ARCO-POL',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (cumplimiento de procedimiento Arts. 4–11 bis Ley N° 21.719)',
        'plazo_conservacion': '5 años para acreditar cumplimiento y plazos legales ante la APDP',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': (
            'id', 'uuid', 'tipo_derecho', 'rut_titular', 'nombre_titular',
            'email_titular', 'telefono_titular', 'detalle_solicitud', 'estado',
            'fecha_solicitud', 'fecha_limite_30d', 'bloqueo_provisional_activo',
            'fecha_limite_bloqueo_2d', 'aviso_apdp_rechazo_bloqueo',
            'fecha_aviso_apdp_bloqueo', 'respuesta_formal', 'fecha_resolucion',
        ),
    },
    'RegistroBrechaSeguridad': {
        'modelo': RegistroBrechaSeguridad,
        'tabla': 'modulo_prevencion_registrobrechaseguridad',
        'categoria_titular': 'Responsable de Análisis / Contacto Entidad Responsable',
        'causa_licitud': 'Art. 13 letra c) Ley N° 21.719 (Arts. 14 sexies y 15 bis Ley N° 21.719)',
        'plazo_conservacion': '5 años como registro obligatorio de incidentes ante la APDP',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': (
            'id', 'codigo_incidente', 'fecha_deteccion', 'tipo_brecha', 'severidad',
            'datos_sensibles_afectados', 'datos_economicos_financieros',
            'empresa_responsable', 'notificado_responsable',
            'fecha_notificacion_responsable', 'contacto_responsable_notificado',
            'descripcion_incidente', 'medidas_correctivas_inmediatas',
            'notificado_agencia', 'fecha_notificacion_agencia',
            'folio_notificacion_agencia', 'notificado_titulares',
            'fecha_notificacion_titulares', 'responsable_analisis',
        ),
    },
    'RegistroConsentimiento': {
        'modelo': RegistroConsentimiento,
        'tabla': 'modulo_prevencion_registroconsentimiento',
        'categoria_titular': 'Titular Otorgante/Revocante de Consentimiento',
        'causa_licitud': 'Art. 13 letra c) y Art. 12 Ley N° 21.719 (deber del Responsable de acreditar consentimiento válido)',
        'plazo_conservacion': '5 años desde el término del tratamiento asociado (registro inmutable append-only)',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': (
            'id', 'usuario', 'identificador_titular', 'flujo', 'version_politica',
            'hash_politica', 'otorgado', 'categorias', 'ip_origen', 'user_agent',
            'fecha_evento',
        ),
    },
    'AuditLogEventoSeguridad': {
        'modelo': AuditLogEventoSeguridad,
        'tabla': 'modulo_prevencion_auditlogeventoseguridad',
        'categoria_titular': 'Actor Autenticado o Titular Afectado por Evento de Seguridad/ARCO',
        'causa_licitud': 'Art. 13 letra c) y Art. 14 quinquies Ley N° 21.719 (medidas técnicas de trazabilidad y auditoría)',
        'plazo_conservacion': '5 años (registro inmutable append-only)',
        'es_sensible': False,
        'campos_rectificables': (),
        'columnas': (
            'id', 'usuario', 'actor_identificador', 'categoria', 'accion',
            'modelo_afectado', 'recurso_id', 'exito', 'ip_origen', 'user_agent',
            'metadata', 'fecha_evento',
        ),
    },
}


CATALOGO_SIN_PII: dict[str, dict[str, Any]] = {
    'Plan': {
        'causa_licitud': 'Catálogo comercial SaaS sin datos personales individuales',
        'columnas': (
            'id', 'nombre', 'codigo', 'precio', 'edicion_nube', 'marca_agua',
            'marca_blanca', 'limite_semanal', 'asientos', 'acceso_servicios',
        ),
    },
    'PlantillaMaestra': {
        'causa_licitud': 'Catálogo maestro de plantillas documentales SST sin datos personales',
        'columnas': ('id', 'nombre', 'tipo_archivo', 'archivo_fuente', 'fecha_ultima_actualizacion'),
    },
    'Noticia': {
        'causa_licitud': 'Contenido editorial público informativo (autor interno staff)',
        'columnas': ('id', 'titulo', 'subtitulo', 'contenido', 'categoria', 'imagen_url', 'autor', 'estado', 'fecha_publicacion'),
    },
    'Servicio': {
        'causa_licitud': 'Catálogo público de servicios SST sin datos personales',
        'columnas': ('id', 'nombre', 'descripcion', 'icono', 'activo'),
    },
    'CentroTrabajo': {
        'causa_licitud': 'Catálogo organizacional de faenas/sucursales de entidad empleadora (sin PII individual)',
        'columnas': ('id', 'empresa', 'nombre', 'direccion', 'comuna', 'region', 'es_casa_matriz', 'fecha_creacion'),
    },
    'PlantillaInspeccion': {
        'causa_licitud': 'Checklist técnico normativo sin datos personales',
        'columnas': ('id', 'nombre', 'descripcion', 'preguntas', 'activo'),
    },
    'TemaCapacitacion': {
        'causa_licitud': 'Catálogo curricular de cursos SST (Art. 15 D.S. N° 44)',
        'columnas': (
            'id', 'usuario', 'titulo', 'descripcion', 'categoria', 'duracion_minutos',
            'contenido_clave', 'es_conferencia_grabada', 'precio_clp', 'video_url',
            'normativa_legal_vigente', 'organismo_exigente', 'requiere_evaluacion',
            'porcentaje_aprobacion', 'preguntas_evaluacion', 'relator_predeterminado',
            'fecha_creacion',
        ),
    },
    'DocumentoContratista': {
        'causa_licitud': 'Certificados corporativos/previsionales de empresa contratista (sin datos individuales)',
        'columnas': ('id', 'contratista', 'tipo', 'nombre_personalizado', 'fecha_emision', 'fecha_vencimiento', 'archivo', 'notas', 'fecha_carga'),
    },
    'ComiteParitario': {
        'causa_licitud': 'Entidad organizacional CPHS por centro de trabajo (D.S. N° 54/1969)',
        'columnas': (
            'id', 'empresa', 'centro_trabajo', 'nombre', 'fecha_constitucion',
            'fecha_vencimiento_mandato', 'estado', 'folio_registro_rel_dt',
            'fecha_registro_rel_dt', 'alerta_plazo_rel_15dias', 'fecha_creacion',
        ),
    },
    'RequisitoLegalBase': {
        'causa_licitud': 'Catálogo normativo chileno SST sin datos personales',
        'columnas': (
            'id', 'organismo', 'tipo_norma', 'identificacion_norma', 'articulo',
            'titulo', 'descripcion_exigencia', 'sancion_multa', 'rubro_aplicable',
            'condicion_activacion', 'orden', 'activo',
        ),
    },
    'MatrizLegal': {
        'causa_licitud': 'Matriz organizacional de requisitos legales por faena',
        'columnas': (
            'id', 'empresa', 'centro_trabajo', 'prevencionista', 'rubro_principal',
            'condiciones_faena', 'fecha_creacion', 'fecha_actualizacion', 'observacion_general',
        ),
    },
    'ItemMatrizLegal': {
        'causa_licitud': 'Ítem normativo de cumplimiento legal organizacional',
        'columnas': (
            'id', 'matriz', 'requisito_base', 'organismo', 'tipo_norma',
            'identificacion_norma', 'articulo', 'titulo', 'descripcion_exigencia',
            'sancion_multa', 'estado', 'evidencia_cumplimiento', 'responsable',
            'fecha_compromiso', 'fecha_verificacion', 'observaciones', 'orden',
        ),
    },
    'MatrizRiesgoMiper': {
        'causa_licitud': 'Matriz organizacional IPER / MIPER por faena (D.S. N° 44)',
        'columnas': (
            'id', 'empresa', 'centro_trabajo', 'prevencionista', 'nombre',
            'proceso_area', 'version', 'estado', 'fecha_aprobacion',
            'fecha_proxima_revision', 'fecha_creacion', 'fecha_actualizacion',
        ),
    },
    'ItemMatrizRiesgo': {
        'causa_licitud': 'Evaluación técnica de puesto de trabajo / peligro MIPER sin identificación de persona natural',
        'columnas': (
            'id', 'matriz', 'proceso', 'actividad', 'tipo_actividad',
            'puesto_trabajo', 'peligro', 'clasificacion_peligro',
            'riesgo_consecuencia', 'probabilidad_pura', 'severidad_pura',
            'controles_existentes', 'controles_requeridos', 'es_accidente_grave_fatal',
            'trabajador_sensible', 'control_eliminacion', 'control_sustitucion',
            'control_ingenieria', 'control_administrativo', 'control_epp',
            'probabilidad_residual', 'severidad_residual', 'responsable',
            'plazo_implementacion', 'estado_control', 'orden',
        ),
    },
}


def validar_cobertura_mapa_datos() -> dict[str, Any]:
    """
    Verifica en tiempo real que todos los modelos y columnas concretas de
    `modulo_prevencion` estén declarados en `MAPA_DATOS_PERSONALES` o `CATALOGO_SIN_PII`.
    """
    app_config = apps.get_app_config('modulo_prevencion')
    modelos_reales = list(app_config.get_models())

    modelos_faltantes: list[str] = []
    columnas_faltantes: dict[str, list[str]] = {}
    columnas_sobrantes: dict[str, list[str]] = {}
    total_columnas = 0

    for model in modelos_reales:
        name = model.__name__
        meta = MAPA_DATOS_PERSONALES.get(name) or CATALOGO_SIN_PII.get(name)
        concrete_cols = {f.name for f in model._meta.concrete_fields}
        total_columnas += len(concrete_cols)

        if not meta:
            modelos_faltantes.append(name)
            continue

        declared_cols = set(meta.get('columnas', ()))
        missing = sorted(concrete_cols - declared_cols)
        extra = sorted(declared_cols - concrete_cols)
        if missing:
            columnas_faltantes[name] = missing
        if extra:
            columnas_sobrantes[name] = extra

    ok = not modelos_faltantes and not columnas_faltantes and not columnas_sobrantes
    return {
        'ok': ok,
        'total_modelos': len(modelos_reales),
        'total_modelos_pii': len(MAPA_DATOS_PERSONALES),
        'total_modelos_sin_pii': len(CATALOGO_SIN_PII),
        'total_columnas': total_columnas,
        'modelos_faltantes': modelos_faltantes,
        'columnas_faltantes': columnas_faltantes,
        'columnas_sobrantes': columnas_sobrantes,
    }


# ==============================================================================
# HELPERS DE IDENTIDAD, SERIALIZACIÓN PORTABLE Y CSV SEGURO
# ==============================================================================

def _normalizar_rut_variantes(rut: str) -> set[str]:
    norm = normalizar_rut_blind_index(rut)
    if not norm or norm.startswith('ANON'):
        return set()
    raw = (rut or '').strip()
    variantes = {norm, norm.lower(), raw, raw.upper(), raw.lower()}
    if len(norm) >= 2:
        cuerpo, dv = norm[:-1], norm[-1]
        for d in (dv.upper(), dv.lower()):
            variantes.add(f'{cuerpo}-{d}')
            if cuerpo.isdigit() and len(cuerpo) > 6:
                formateado = f'{int(cuerpo):,}'.replace(',', '.')
                variantes.add(f'{formateado}-{d}')
    return {v for v in variantes if v}


def _resolver_identidad(
    *,
    usuario: Usuario | None = None,
    rut: str = '',
    email: str = '',
) -> dict[str, Any]:
    rut_clean = (rut or '').strip()
    rut_norm = normalizar_rut_blind_index(rut_clean)
    rut_hmac = calcular_rut_hmac(rut_clean) if rut_norm and not rut_norm.startswith('ANON') else ''
    email_clean = (email or (usuario.email if usuario else '') or '').strip().lower()
    return {
        'usuario': usuario,
        'rut': rut_clean,
        'rut_norm': rut_norm,
        'rut_hmac': rut_hmac,
        'rut_variantes': _normalizar_rut_variantes(rut_clean),
        'email': email_clean,
    }


def _rut_en_asistentes(asistentes: Any, rut_variantes: set[str], rut_norm: str) -> bool:
    if not isinstance(asistentes, list) or not rut_norm:
        return False
    for item in asistentes:
        if not isinstance(item, dict):
            continue
        item_rut = normalizar_rut_blind_index(str(item.get('rut', '')))
        if item_rut and (item_rut == rut_norm or str(item.get('rut', '')).strip().upper() in rut_variantes):
            return True
    return False


def _formatear_valor(val: Any) -> Any:
    if val is None or isinstance(val, (bool, int, float, str)):
        return val
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, (uuid.UUID, Decimal)):
        return str(val)
    if isinstance(val, dict):
        return {str(k): _formatear_valor(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_formatear_valor(v) for v in val]
    return str(val)


def _sanitizar_celda_csv(valor: Any) -> str:
    texto = '' if valor is None else str(valor)
    if texto and texto[0] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + texto
    return texto


def serializar_portabilidad_csv(payload: dict[str, Any]) -> str:
    """
    Convierte el payload JSON de portabilidad a formato CSV UTF-8 estructurado
    con mitigación contra CSV formula injection.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['tabla_o_seccion', 'registro_indice', 'campo', 'valor'])

    writer.writerow(['metadatos', '0', 'alcance', _sanitizar_celda_csv(payload.get('alcance', ''))])
    writer.writerow(['metadatos', '0', 'fecha_exportacion', _sanitizar_celda_csv(payload.get('fecha_exportacion', ''))])
    writer.writerow(['metadatos', '0', 'base_legal', _sanitizar_celda_csv(payload.get('base_legal', ''))])

    ignorados = {'alcance', 'fecha_exportacion', 'base_legal', 'resumen_mapa_legal'}
    for seccion, contenido in payload.items():
        if seccion in ignorados:
            continue
        if isinstance(contenido, dict):
            for campo, val in contenido.items():
                writer.writerow([
                    _sanitizar_celda_csv(seccion),
                    '0',
                    _sanitizar_celda_csv(campo),
                    _sanitizar_celda_csv(val),
                ])
        elif isinstance(contenido, list):
            for idx, fila in enumerate(contenido, start=1):
                if isinstance(fila, dict):
                    for campo, val in fila.items():
                        writer.writerow([
                            _sanitizar_celda_csv(seccion),
                            str(idx),
                            _sanitizar_celda_csv(campo),
                            _sanitizar_celda_csv(val),
                        ])
                else:
                    writer.writerow([
                        _sanitizar_celda_csv(seccion),
                        str(idx),
                        'valor',
                        _sanitizar_celda_csv(fila),
                    ])
    return output.getvalue()


# ==============================================================================
# EXPORTACIÓN / PORTABILIDAD TRANSVERSAL (ART. 9 LEY N° 21.719)
# ==============================================================================

def _exportar_datos_cuenta(usuario: Usuario, identidad: dict[str, Any]) -> dict[str, Any]:
    email_norm = identidad['email']
    cons_q = Q(usuario=usuario)
    if email_norm:
        cons_q |= Q(identificador_titular__iexact=email_norm)
    if identidad['rut_norm']:
        cons_q |= Q(identificador_titular__iexact=identidad['rut_norm'])

    reportes_qs = ReporteRiesgo.objects.filter(
        Q(usuario=usuario) | (Q(contacto_reportante__iexact=email_norm) if email_norm else Q(pk__in=[]))
    ).select_related('empresa', 'centro_trabajo')

    inspecciones_qs = Inspeccion.objects.filter(usuario=usuario).select_related('empresa', 'plantilla')
    sugerencias_qs = SugerenciaConsulta.objects.filter(usuario=usuario)
    solicitudes_arco = (
        SolicitudDerechoARCO.objects.filter(email_titular__iexact=usuario.email)
        if usuario.email
        else SolicitudDerechoARCO.objects.none()
    )
    contactos_qs = MensajeContacto.objects.filter(
        Q(usuario=usuario) | (Q(email__iexact=email_norm) if email_norm else Q(pk__in=[]))
    )
    solicitudes_cap_qs = SolicitudCapacitacion.objects.filter(
        Q(usuario=usuario) | (Q(contacto_email__iexact=email_norm) if email_norm else Q(pk__in=[]))
    )

    return {
        'perfil': {
            'uuid': str(usuario.uuid),
            'username': usuario.username,
            'email': usuario.email,
            'first_name': usuario.first_name,
            'last_name': usuario.last_name,
            'tipo_usuario': usuario.tipo_usuario,
            'date_joined': _formatear_valor(usuario.date_joined),
            'mfa_enabled': usuario.mfa_enabled,
        },
        'suscripciones': [
            {
                'plan': s.plan.nombre,
                'plan__nombre': s.plan.nombre,
                'plan__codigo': s.plan.codigo,
                'estado': s.estado,
                'fecha_inicio': _formatear_valor(s.fecha_inicio),
                'fecha_vencimiento': _formatear_valor(s.fecha_vencimiento),
            }
            for s in Suscripcion.objects.filter(usuario=usuario).select_related('plan')
        ],
        'documentos_guardados': [
            {
                'id': d.id,
                'plantilla': d.plantilla_maestra.nombre if d.plantilla_maestra else None,
                'datos_guardados': _formatear_valor(d.datos_guardados),
                'fecha_ultimo_guardado': _formatear_valor(d.fecha_ultimo_guardado),
            }
            for d in DocumentoUsuario.objects.filter(usuario=usuario).select_related('plantilla_maestra')
        ],
        'consultas_contacto': [
            {
                'id': m.id,
                'asunto': m.asunto,
                'mensaje': m.mensaje,
                'fecha_creacion': _formatear_valor(m.fecha_creacion),
            }
            for m in contactos_qs
        ],
        'solicitudes_capacitacion': [
            {
                'id': sc.id,
                'empresa': sc.empresa,
                'rut_empresa': sc.rut_empresa,
                'tema': sc.tema,
                'estado': sc.estado,
                'fecha_creacion': _formatear_valor(sc.fecha_creacion),
            }
            for sc in solicitudes_cap_qs
        ],
        'reportes_riesgo': [
            {
                'uuid': str(r.uuid),
                'empresa': r.empresa.razon_social if r.empresa else r.empresa_faena,
                'centro_trabajo': r.centro_trabajo.nombre if r.centro_trabajo else '',
                'tipo': r.tipo,
                'gravedad': r.gravedad,
                'estado': r.estado,
                'nombre_reportante': r.nombre_reportante,
                'contacto_reportante': r.contacto_reportante,
                'fecha_creacion': _formatear_valor(r.fecha_creacion),
            }
            for r in reportes_qs
        ],
        'inspecciones': [
            {
                'id': insp.id,
                'empresa': insp.empresa.razon_social if insp.empresa else '',
                'plantilla': insp.plantilla.nombre,
                'fecha': _formatear_valor(insp.fecha),
                'porcentaje_cumplimiento': insp.porcentaje_cumplimiento,
                'firma_nombre': insp.firma_nombre,
            }
            for insp in inspecciones_qs
        ],
        'sugerencias_consultas': [
            {
                'uuid': str(sg.uuid),
                'tipo': sg.tipo,
                'mensaje': sg.mensaje,
                'anonimo': sg.anonimo,
                'nombre_remitente': sg.nombre_remitente,
                'contacto_remitente': sg.contacto_remitente,
                'fecha_creacion': _formatear_valor(sg.fecha_creacion),
            }
            for sg in sugerencias_qs
        ],
        'sugerencias_laborales': [],
        'consentimientos': [
            {
                'id': c.id,
                'flujo': c.flujo,
                'otorgado': c.otorgado,
                'version_politica': c.version_politica,
                'categorias': _formatear_valor(c.categorias),
                'fecha_evento': _formatear_valor(c.fecha_evento),
            }
            for c in RegistroConsentimiento.objects.filter(cons_q)
        ],
        'solicitudes_arco': [
            {
                'uuid': str(sol.uuid),
                'tipo_derecho': sol.tipo_derecho,
                'estado': sol.estado,
                'bloqueo_provisional_activo': sol.bloqueo_provisional_activo,
                'fecha_solicitud': _formatear_valor(sol.fecha_solicitud),
            }
            for sol in solicitudes_arco
        ],
    }


def _exportar_datos_trabajador_tenant(
    identidad: dict[str, Any],
    *,
    usuarios_grupo: list[Usuario] | None = None,
) -> dict[str, Any]:
    rut_norm = identidad['rut_norm']
    rut_hmac = identidad['rut_hmac']
    rut_variantes = identidad['rut_variantes']

    def _scope_empresa(qs, field='empresa__prevencionista__in'):
        if usuarios_grupo is not None:
            return qs.filter(**{field: usuarios_grupo})
        return qs

    trabajadores_qs = _scope_empresa(Trabajador.objects.select_related('empresa', 'centro_trabajo'))
    fichas = [
        {
            'id': t.id,
            'empresa': t.empresa.razon_social,
            'rut': t.rut,
            'nombres': t.nombres,
            'apellidos': t.apellidos,
            'cargo': t.cargo,
            'correo': t.correo,
            'telefono': t.telefono,
            'estado': t.estado,
        }
        for t in trabajadores_qs
        if normalizar_rut_blind_index(t.rut) == rut_norm
    ]
    correos_trabajadores = {f['correo'].strip().lower() for f in fichas if f.get('correo')}

    entregas_qs = _scope_empresa(EntregaEPP.objects.select_related('empresa', 'trabajador'))
    registros_epp = [
        {
            'id': e.id,
            'empresa': e.empresa.razon_social,
            'fecha_hora_entrega': _formatear_valor(e.fecha_hora_entrega),
            'items_epp': _formatear_valor(e.items_epp),
            'entrega_riohs': e.entrega_riohs,
            'version_riohs': e.version_riohs,
        }
        for e in entregas_qs
        if normalizar_rut_blind_index(e.trabajador.rut) == rut_norm
    ]

    # Consulta indexada por blind index HMAC-SHA256 (sin escaneo en memoria de toda la tabla)
    acc_q = Q(rut_hmac=rut_hmac) if rut_hmac else Q(pk__in=[])
    if rut_variantes:
        acc_q |= Q(trabajador__rut__in=rut_variantes)
    accidentes_qs = _scope_empresa(
        InvestigacionAccidente.objects.filter(acc_q).select_related('empresa').distinct()
    )
    investigaciones_accidentes = [
        {
            'id': acc.id,
            'empresa': acc.empresa.razon_social if acc.empresa else '',
            'nombre_afectado': acc.nombre_afectado,
            'rut_afectado': acc.rut_afectado,
            'tipo_evento': acc.tipo_evento,
            'fecha_hora_evento': _formatear_valor(acc.fecha_hora_evento),
            'tipo_lesion': acc.tipo_lesion,
            'es_grave_o_fatal': acc.es_grave_o_fatal,
        }
        for acc in accidentes_qs
    ]

    caps_qs = _scope_empresa(RegistroCapacitacion.objects.select_related('empresa', 'tema'))
    capacitaciones = [
        {
            'uuid': str(cap.uuid),
            'empresa': cap.empresa.razon_social if cap.empresa else '',
            'tema': cap.tema.titulo if cap.tema else '',
            'fecha_realizacion': _formatear_valor(cap.fecha_realizacion or cap.fecha_programada),
            'estado': cap.estado,
        }
        for cap in caps_qs
        if _rut_en_asistentes(cap.asistentes, rut_variantes, rut_norm)
    ]

    reportes_qs = _scope_empresa(ReporteRiesgo.objects.select_related('empresa', 'centro_trabajo'))
    reportes_riesgo = [
        {
            'uuid': str(rep.uuid),
            'empresa': rep.empresa.razon_social if rep.empresa else rep.empresa_faena,
            'tipo': rep.tipo,
            'gravedad': rep.gravedad,
            'estado': rep.estado,
            'nombre_reportante': rep.nombre_reportante,
            'rut_reportante': rep.rut_reportante,
            'contacto_reportante': rep.contacto_reportante,
            'fecha_creacion': _formatear_valor(rep.fecha_creacion),
        }
        for rep in reportes_qs
        if (
            normalizar_rut_blind_index(rep.rut_reportante or '') == rut_norm
            or (rep.contacto_reportante or '').strip().lower() in correos_trabajadores
        )
    ]

    inspecciones_qs = _scope_empresa(Inspeccion.objects.select_related('empresa', 'plantilla'))
    inspecciones = [
        {
            'id': insp.id,
            'empresa': insp.empresa.razon_social if insp.empresa else '',
            'plantilla': insp.plantilla.nombre,
            'fecha': _formatear_valor(insp.fecha),
            'porcentaje_cumplimiento': insp.porcentaje_cumplimiento,
            'firma_nombre': insp.firma_nombre,
            'firma_rut': insp.firma_rut,
        }
        for insp in inspecciones_qs
        if normalizar_rut_blind_index(insp.firma_rut or '') == rut_norm
    ]

    sugerencias_qs = _scope_empresa(SugerenciaLaboral.objects.select_related('empresa'))
    sugerencias_laborales = [
        {
            'uuid': str(sg.uuid),
            'empresa': sg.empresa.razon_social,
            'tipo': sg.tipo,
            'mensaje': sg.mensaje,
            'es_anonimo': sg.es_anonimo,
            'nombre_remitente': sg.nombre_remitente,
            'contacto_remitente': sg.contacto_remitente,
            'estado': sg.estado,
            'fecha_creacion': _formatear_valor(sg.fecha_creacion),
        }
        for sg in sugerencias_qs
        if not sg.es_anonimo and (
            (sg.contacto_remitente or '').strip().lower() in correos_trabajadores
            or normalizar_rut_blind_index(sg.contacto_remitente or '') == rut_norm
        )
    ]

    cphs_qs = _scope_empresa(
        MiembroCPHS.objects.select_related('comite__empresa'),
        field='comite__empresa__prevencionista__in',
    )
    comites_paritarios = [
        {
            'comite': m.comite.nombre,
            'empresa': m.comite.empresa.razon_social,
            'cargo': m.cargo,
            'estamento': m.estamento,
            'tiene_fuero_laboral': m.tiene_fuero_laboral,
            'activo': m.activo,
        }
        for m in cphs_qs
        if normalizar_rut_blind_index(m.rut) == rut_norm
    ]

    sub_qs = TrabajadorSubcontratado.objects.select_related('contratista')
    if usuarios_grupo is not None:
        sub_qs = sub_qs.filter(
            Q(contratista__empresa_principal__prevencionista__in=usuarios_grupo)
            | Q(contratista__usuario__in=usuarios_grupo)
        ).distinct()
    subcontratacion = [
        {
            'contratista': ts.contratista.razon_social,
            'nombre_completo': ts.nombre_completo,
            'cargo': ts.cargo,
            'activo': ts.activo,
            'fecha_ingreso_obra': _formatear_valor(ts.fecha_ingreso_obra),
        }
        for ts in sub_qs
        if normalizar_rut_blind_index(ts.rut) == rut_norm
    ]

    # Consulta indexada por HMAC en DenunciaLeyKarin (sin exponer identidad de terceros por Ley 21.643)
    karin_qs = _scope_empresa(DenunciaLeyKarin.objects.filter(rut_hmac=rut_hmac)) if rut_hmac else DenunciaLeyKarin.objects.none()
    denuncias_ley_karin_resumen = [
        {
            'codigo_seguimiento': dk.codigo_seguimiento,
            'tipo_afectacion': dk.tipo_afectacion,
            'estado_tramite': dk.estado_tramite,
            'fecha_hora_ingreso': _formatear_valor(dk.fecha_hora_ingreso),
            'plazo_limite_derivacion_dt': _formatear_valor(dk.plazo_limite_derivacion_dt),
        }
        for dk in karin_qs
    ]

    cons_q = Q(identificador_titular__in=rut_variantes) if rut_variantes else Q(pk__in=[])
    if rut_hmac:
        cons_q |= Q(identificador_titular=rut_hmac)
    for correo in correos_trabajadores:
        cons_q |= Q(identificador_titular__iexact=correo)

    consentimientos = [
        {
            'id': c.id,
            'flujo': c.flujo,
            'otorgado': c.otorgado,
            'version_politica': c.version_politica,
            'categorias': _formatear_valor(c.categorias),
            'fecha_evento': _formatear_valor(c.fecha_evento),
        }
        for c in RegistroConsentimiento.objects.filter(cons_q)
    ]

    solicitudes_arco = [
        {
            'uuid': str(sol.uuid),
            'tipo_derecho': sol.tipo_derecho,
            'estado': sol.estado,
            'bloqueo_provisional_activo': sol.bloqueo_provisional_activo,
            'fecha_solicitud': _formatear_valor(sol.fecha_solicitud),
        }
        for sol in SolicitudDerechoARCO.objects.filter(
            Q(rut_titular__in=rut_variantes) | Q(email_titular__in=correos_trabajadores)
        )
    ]

    return {
        'fichas_laborales': fichas,
        'registros_epp': registros_epp,
        'investigaciones_accidentes': investigaciones_accidentes,
        'capacitaciones': capacitaciones,
        'reportes_riesgo': reportes_riesgo,
        'inspecciones': inspecciones,
        'sugerencias_laborales': sugerencias_laborales,
        'comites_paritarios': comites_paritarios,
        'subcontratacion': subcontratacion,
        'denuncias_ley_karin_resumen': denuncias_ley_karin_resumen,
        'consentimientos': consentimientos,
        'solicitudes_arco': solicitudes_arco,
    }


def exportar_datos_titular(
    *,
    usuario: Usuario | None = None,
    rut: str = '',
    email: str = '',
    usuarios_grupo: list[Usuario] | None = None,
) -> dict[str, Any]:
    """Genera la exportación portable completa (cuenta o titular trabajador por RUT/HMAC)."""
    identidad = _resolver_identidad(usuario=usuario, rut=rut, email=email)
    if identidad['rut_norm']:
        alcance = 'trabajador_tenant'
        datos = _exportar_datos_trabajador_tenant(identidad, usuarios_grupo=usuarios_grupo)
    elif usuario is not None:
        alcance = 'cuenta_usuario'
        datos = _exportar_datos_cuenta(usuario, identidad)
    else:
        raise ValueError("Debe proporcionar un usuario autenticado o un RUT de titular.")

    return {
        'ambito': alcance,
        'alcance': alcance,
        'estandar_interoperabilidad': 'Ley N° 21.719 Art. 9 (Portabilidad)',
        **({'rut_titular': identidad['rut'] or identidad['rut_norm']} if alcance == 'trabajador_tenant' else {}),
        'fecha_exportacion': timezone.now().isoformat(),
        'base_legal': 'Art. 9 y Art. 14 ter Ley N° 21.719 (Derecho de Acceso y Portabilidad en formato interoperable)',
        'resumen_mapa_legal': {
            nombre: {
                'causa_licitud': cfg['causa_licitud'],
                'plazo_conservacion': cfg['plazo_conservacion'],
                'es_sensible': cfg['es_sensible'],
            }
            for nombre, cfg in MAPA_DATOS_PERSONALES.items()
        },
        **datos,
    }


# ==============================================================================
# EJECUCIÓN TRANSACCIONAL: RECTIFICACIÓN, SUPRESIÓN/ANONIMIZACIÓN Y OPOSICIÓN
# ==============================================================================

def _aplicar_cambios_campos(instancia: Any, cambios: dict[str, Any], campos_permitidos: tuple[str, ...]) -> list[str]:
    modificados: list[str] = []
    for campo, valor in (cambios or {}).items():
        if campo in campos_permitidos and hasattr(instancia, campo):
            setattr(instancia, campo, valor)
            modificados.append(campo)
    if modificados:
        instancia.save(update_fields=modificados)
    return modificados


@transaction.atomic
def ejecutar_rectificacion_titular(
    *,
    usuario_actor: Usuario | None = None,
    request: Any = None,
    usuario_objetivo: Usuario | None = None,
    rut: str = '',
    email: str = '',
    usuarios_grupo: list[Usuario] | None = None,
    cambios: dict[str, dict[str, Any]] | None = None,
    solicitud: SolicitudDerechoARCO | None = None,
) -> dict[str, Any]:
    """
    Ejecuta rectificación efectiva de datos personales inexactos o desactualizados
    (Art. 6 Ley N° 21.719) sobre columnas declaradas rectificables.
    """
    cambios = cambios or {}
    identidad = _resolver_identidad(usuario=usuario_objetivo, rut=rut, email=email)
    rut_norm = identidad['rut_norm']
    actualizados: dict[str, int] = {}

    if usuario_objetivo and isinstance(cambios.get('usuario'), dict):
        campos_u = _aplicar_cambios_campos(
            usuario_objetivo,
            cambios['usuario'],
            MAPA_DATOS_PERSONALES['Usuario']['campos_rectificables'],
        )
        if campos_u:
            actualizados['Usuario'] = actualizados.get('Usuario', 0) + 1

    if rut_norm and isinstance(cambios.get('trabajador'), dict):
        trab_qs = Trabajador.objects.all()
        if usuarios_grupo is not None:
            trab_qs = trab_qs.filter(empresa__prevencionista__in=usuarios_grupo)
        for trab in trab_qs:
            if normalizar_rut_blind_index(trab.rut) == rut_norm:
                if _aplicar_cambios_campos(trab, cambios['trabajador'], MAPA_DATOS_PERSONALES['Trabajador']['campos_rectificables']):
                    actualizados['Trabajador'] = actualizados.get('Trabajador', 0) + 1

    if isinstance(cambios.get('reporte_riesgo'), dict):
        rep_qs = ReporteRiesgo.objects.all()
        if usuarios_grupo is not None:
            rep_qs = rep_qs.filter(Q(empresa__prevencionista__in=usuarios_grupo) | Q(usuario=usuario_objetivo))
        for rep in rep_qs:
            coincide = (
                (rut_norm and normalizar_rut_blind_index(rep.rut_reportante or '') == rut_norm)
                or (usuario_objetivo and rep.usuario_id == usuario_objetivo.id)
                or (identidad['email'] and (rep.contacto_reportante or '').strip().lower() == identidad['email'])
            )
            if coincide and _aplicar_cambios_campos(rep, cambios['reporte_riesgo'], MAPA_DATOS_PERSONALES['ReporteRiesgo']['campos_rectificables']):
                actualizados['ReporteRiesgo'] = actualizados.get('ReporteRiesgo', 0) + 1

    if rut_norm and isinstance(cambios.get('miembro_cphs'), dict):
        cphs_qs = MiembroCPHS.objects.all()
        if usuarios_grupo is not None:
            cphs_qs = cphs_qs.filter(comite__empresa__prevencionista__in=usuarios_grupo)
        for miembro in cphs_qs:
            if normalizar_rut_blind_index(miembro.rut) == rut_norm:
                if _aplicar_cambios_campos(miembro, cambios['miembro_cphs'], MAPA_DATOS_PERSONALES['MiembroCPHS']['campos_rectificables']):
                    actualizados['MiembroCPHS'] = actualizados.get('MiembroCPHS', 0) + 1

    if rut_norm and isinstance(cambios.get('trabajador_subcontratado'), dict):
        sub_qs = TrabajadorSubcontratado.objects.all()
        if usuarios_grupo is not None:
            sub_qs = sub_qs.filter(contratista__empresa_principal__prevencionista__in=usuarios_grupo)
        for sub in sub_qs:
            if normalizar_rut_blind_index(sub.rut) == rut_norm:
                if _aplicar_cambios_campos(sub, cambios['trabajador_subcontratado'], MAPA_DATOS_PERSONALES['TrabajadorSubcontratado']['campos_rectificables']):
                    actualizados['TrabajadorSubcontratado'] = actualizados.get('TrabajadorSubcontratado', 0) + 1

    if isinstance(cambios.get('mensaje_contacto'), dict) and (usuario_objetivo or identidad['email']):
        mc_qs = MensajeContacto.objects.filter(
            Q(usuario=usuario_objetivo) if usuario_objetivo else Q(email__iexact=identidad['email'])
        )
        for mc in mc_qs:
            if _aplicar_cambios_campos(mc, cambios['mensaje_contacto'], MAPA_DATOS_PERSONALES['MensajeContacto']['campos_rectificables']):
                actualizados['MensajeContacto'] = actualizados.get('MensajeContacto', 0) + 1

    if solicitud is not None:
        solicitud.estado = SolicitudDerechoARCO.ESTADO_RESUELTA
        solicitud.bloqueo_provisional_activo = False
        solicitud.fecha_resolucion = timezone.now()
        if not solicitud.respuesta_formal:
            solicitud.respuesta_formal = f"Rectificación ejecutada sobre registros: {actualizados or 'sin cambios pendientes'}."
        solicitud.save(update_fields=['estado', 'bloqueo_provisional_activo', 'fecha_resolucion', 'respuesta_formal'])

    registrar_evento_seguridad(
        request,
        categoria=AuditLogEventoSeguridad.CATEGORIA_ARCO,
        accion='ARCO_RECTIFICACION',
        usuario=usuario_actor,
        actor_identificador=identidad['email'] or identidad['rut_norm'] or (usuario_actor.email if usuario_actor else ''),
        modelo_afectado=','.join(sorted(actualizados.keys())) or 'ARCO',
        recurso_id=str(solicitud.uuid) if solicitud else '',
        exito=True,
        metadata={'actualizados': actualizados},
    )

    return {'actualizados': actualizados, 'solicitud_uuid': str(solicitud.uuid) if solicitud else None}


@transaction.atomic
def ejecutar_supresion_titular(
    *,
    usuario_actor: Usuario | None = None,
    request: Any = None,
    usuario_objetivo: Usuario | None = None,
    rut: str = '',
    email: str = '',
    usuarios_grupo: list[Usuario] | None = None,
    forzar_anonimizacion_sst: bool = False,
    solicitud: SolicitudDerechoARCO | None = None,
) -> dict[str, Any]:
    """
    Ejecuta supresión o anonimización efectiva bajo demanda (Art. 7 y Art. 16 ter Ley N° 21.719),
    preservando registros sujetos a bloqueo legal vigente (5 años SST/Ley Karin, 6 años tributario)
    con respuesta fundamentada y trazabilidad auditada.
    """
    identidad = _resolver_identidad(usuario=usuario_objetivo, rut=rut, email=email)
    rut_norm = identidad['rut_norm']
    rut_hmac = identidad['rut_hmac']
    rut_variantes = identidad['rut_variantes']
    email_norm = identidad['email']

    ahora = timezone.now()
    corte_5_anos = ahora - timedelta(days=1825)
    corte_6_anos = timezone.localdate() - timedelta(days=2190)

    suprimidos: dict[str, int] = {}
    retenidos_por_ley: list[dict[str, Any]] = []

    # 1. ReporteRiesgo: siempre permite suprimir PII opcional del reportante externo/interno
    rep_qs = ReporteRiesgo.objects.all()
    if usuarios_grupo is not None:
        rep_qs = rep_qs.filter(Q(empresa__prevencionista__in=usuarios_grupo) | Q(usuario=usuario_objetivo))
    for rep in rep_qs:
        coincide = (
            (usuario_objetivo and rep.usuario_id == usuario_objetivo.id)
            or (rut_norm and normalizar_rut_blind_index(rep.rut_reportante or '') == rut_norm)
            or (email_norm and (rep.contacto_reportante or '').strip().lower() == email_norm)
        )
        if coincide and (rep.nombre_reportante or rep.rut_reportante or rep.contacto_reportante):
            rep.nombre_reportante = ''
            rep.rut_reportante = ''
            rep.contacto_reportante = ''
            rep.save(update_fields=['nombre_reportante', 'rut_reportante', 'contacto_reportante'])
            suprimidos['ReporteRiesgo'] = suprimidos.get('ReporteRiesgo', 0) + 1

    # 2. Inspeccion: anonimiza firma nominal sin alterar trazabilidad técnica de la faena
    insp_qs = Inspeccion.objects.all()
    if usuarios_grupo is not None:
        insp_qs = insp_qs.filter(Q(empresa__prevencionista__in=usuarios_grupo) | Q(usuario=usuario_objetivo))
    for insp in insp_qs:
        coincide = (
            (usuario_objetivo and insp.usuario_id == usuario_objetivo.id)
            or (rut_norm and normalizar_rut_blind_index(insp.firma_rut or '') == rut_norm)
        )
        if coincide and (insp.firma_nombre or insp.firma_rut):
            insp.firma_nombre = 'Inspector Anonimizado (ARCO)'
            insp.firma_rut = ''
            insp.save(update_fields=['firma_nombre', 'firma_rut'])
            suprimidos['Inspeccion'] = suprimidos.get('Inspeccion', 0) + 1

    # 3. SugerenciaLaboral y SugerenciaConsulta
    sug_lab_qs = SugerenciaLaboral.objects.all()
    if usuarios_grupo is not None:
        sug_lab_qs = sug_lab_qs.filter(empresa__prevencionista__in=usuarios_grupo)
    for sg in sug_lab_qs:
        coincide = (
            (email_norm and (sg.contacto_remitente or '').strip().lower() == email_norm)
            or (rut_norm and normalizar_rut_blind_index(sg.contacto_remitente or '') == rut_norm)
        )
        if coincide:
            sg.es_anonimo = True
            sg.nombre_remitente = ''
            sg.contacto_remitente = ''
            sg.save(update_fields=['es_anonimo', 'nombre_remitente', 'contacto_remitente'])
            suprimidos['SugerenciaLaboral'] = suprimidos.get('SugerenciaLaboral', 0) + 1

    if usuario_objetivo or email_norm:
        sc_q = Q(usuario=usuario_objetivo) if usuario_objetivo else Q(contacto_remitente__iexact=email_norm)
        for sgc in SugerenciaConsulta.objects.filter(sc_q):
            sgc.anonimo = True
            sgc.nombre_remitente = ''
            sgc.contacto_remitente = ''
            sgc.save(update_fields=['anonimo', 'nombre_remitente', 'contacto_remitente'])
            suprimidos['SugerenciaConsulta'] = suprimidos.get('SugerenciaConsulta', 0) + 1

        mc_q = Q(usuario=usuario_objetivo) if usuario_objetivo else Q(email__iexact=email_norm)
        for mc in MensajeContacto.objects.filter(mc_q):
            mc.nombre = 'Titular Suprimido'
            mc.email = f'suprimido+{mc.pk}@anon.invalid'
            mc.mensaje = '[MENSAJE SUPRIMIDO POR SOLICITUD DE SUPRESIÓN ARCO-POL]'
            mc.save(update_fields=['nombre', 'email', 'mensaje'])
            suprimidos['MensajeContacto'] = suprimidos.get('MensajeContacto', 0) + 1

    # 4. Registros por RUT: Capacitaciones, Trabajador, Accidentes (rut_hmac), DenunciaLeyKarin (rut_hmac)
    if rut_norm:
        cap_qs = RegistroCapacitacion.objects.all()
        if usuarios_grupo is not None:
            cap_qs = cap_qs.filter(empresa__prevencionista__in=usuarios_grupo)
        caps_retenidas = 0
        for cap in cap_qs:
            if not _rut_en_asistentes(cap.asistentes, rut_variantes, rut_norm):
                continue
            if cap.fecha_realizacion:
                es_vencido = cap.fecha_realizacion < corte_5_anos
            elif cap.fecha_programada:
                es_vencido = cap.fecha_programada < corte_5_anos.date()
            else:
                es_vencido = cap.fecha_creacion < corte_5_anos
            if es_vencido or forzar_anonimizacion_sst:
                nuevos = []
                for a in cap.asistentes:
                    if isinstance(a, dict) and normalizar_rut_blind_index(str(a.get('rut', ''))) == rut_norm:
                        token_h = hashlib.sha256(f'cap:{cap.pk}:{rut_norm}'.encode('utf-8')).hexdigest()[:10].upper()
                        copia = dict(a)
                        copia['nombre'] = 'Asistente Anonimizado (ARCO)'
                        copia['rut'] = f'ANON-{token_h}'
                        nuevos.append(copia)
                    else:
                        nuevos.append(a)
                cap.asistentes = nuevos
                cap.save(update_fields=['asistentes'])
                suprimidos['RegistroCapacitacion'] = suprimidos.get('RegistroCapacitacion', 0) + 1
            else:
                caps_retenidas += 1
        if caps_retenidas:
            retenidos_por_ley.append({
                'modelo': 'RegistroCapacitacion',
                'cantidad': caps_retenidas,
                'causal_legal': MAPA_DATOS_PERSONALES['RegistroCapacitacion']['causa_licitud'],
            })

        acc_qs = InvestigacionAccidente.objects.filter(rut_hmac=rut_hmac) if rut_hmac else InvestigacionAccidente.objects.none()
        if usuarios_grupo is not None:
            acc_qs = acc_qs.filter(empresa__prevencionista__in=usuarios_grupo)
        acc_retenidos = 0
        for acc in acc_qs:
            if forzar_anonimizacion_sst or (acc.fecha_hora_evento and acc.fecha_hora_evento < corte_5_anos):
                token_h = hashlib.sha256(f'acc:{acc.pk}:{rut_norm}'.encode('utf-8')).hexdigest()[:10].upper()
                acc.nombre_afectado = 'Trabajador Anonimizado (ARCO)'
                acc.rut_afectado = f'ANON-{token_h}'
                acc.rut_hmac = ''
                acc.save(update_fields=['nombre_afectado', 'rut_afectado', 'rut_hmac'])
                suprimidos['InvestigacionAccidente'] = suprimidos.get('InvestigacionAccidente', 0) + 1
            else:
                acc_retenidos += 1
        if acc_retenidos:
            retenidos_por_ley.append({
                'modelo': 'InvestigacionAccidente',
                'cantidad': acc_retenidos,
                'causal_legal': MAPA_DATOS_PERSONALES['InvestigacionAccidente']['causa_licitud'],
            })

        karin_qs = DenunciaLeyKarin.objects.filter(rut_hmac=rut_hmac) if rut_hmac else DenunciaLeyKarin.objects.none()
        if usuarios_grupo is not None:
            karin_qs = karin_qs.filter(empresa__prevencionista__in=usuarios_grupo)
        karin_retenidos = 0
        for dk in karin_qs:
            vencida_finalizada = (
                dk.estado_tramite in {DenunciaLeyKarin.ESTADO_DERIVADA_DT, DenunciaLeyKarin.ESTADO_FINALIZADA}
                and dk.fecha_hora_ingreso
                and dk.fecha_hora_ingreso < corte_5_anos
            )
            if forzar_anonimizacion_sst or vencida_finalizada:
                token_h = hashlib.sha256(f'karin:{dk.pk}:{rut_norm}'.encode('utf-8')).hexdigest()[:10].upper()
                dk.rut_denunciante = f'ANON-{token_h}'
                dk.rut_hmac = ''
                dk.nombre_denunciante = 'Denunciante Anonimizado (ARCO)'
                dk.correo_denunciante = f'anon-{token_h}@suprimido.invalid'
                dk.telefono_denunciante = ''
                dk.save(update_fields=[
                    'rut_denunciante', 'rut_hmac', 'nombre_denunciante',
                    'correo_denunciante', 'telefono_denunciante',
                ])
                suprimidos['DenunciaLeyKarin'] = suprimidos.get('DenunciaLeyKarin', 0) + 1
            else:
                karin_retenidos += 1
        if karin_retenidos:
            retenidos_por_ley.append({
                'modelo': 'DenunciaLeyKarin',
                'cantidad': karin_retenidos,
                'causal_legal': MAPA_DATOS_PERSONALES['DenunciaLeyKarin']['causa_licitud'],
            })

        trab_qs = Trabajador.objects.all()
        if usuarios_grupo is not None:
            trab_qs = trab_qs.filter(empresa__prevencionista__in=usuarios_grupo)
        trab_retenidos = 0
        for trab in trab_qs:
            if normalizar_rut_blind_index(trab.rut) != rut_norm:
                continue
            epp_reciente = EntregaEPP.objects.filter(trabajador=trab, fecha_hora_entrega__gte=corte_5_anos).exists()
            if forzar_anonimizacion_sst or (not epp_reciente and trab.estado != Trabajador.ESTADO_ACTIVO and trab.fecha_creacion < corte_5_anos):
                token_h = hashlib.sha256(f'trab:{trab.pk}:{rut_norm}'.encode('utf-8')).hexdigest()[:10].upper()
                trab.rut = f'ANON-{token_h}'
                trab.nombres = 'Trabajador'
                trab.apellidos = 'Anonimizado (ARCO)'
                trab.correo = ''
                trab.telefono = ''
                trab.estado = Trabajador.ESTADO_INACTIVO
                trab.save(update_fields=['rut', 'nombres', 'apellidos', 'correo', 'telefono', 'estado'])
                suprimidos['Trabajador'] = suprimidos.get('Trabajador', 0) + 1
            else:
                trab_retenidos += 1
        if trab_retenidos:
            retenidos_por_ley.append({
                'modelo': 'Trabajador',
                'cantidad': trab_retenidos,
                'causal_legal': MAPA_DATOS_PERSONALES['Trabajador']['causa_licitud'],
            })

    # 5. Cuenta Usuario SaaS (respetando bloqueo tributario < 6 años si hay suscripciones vigentes/recientes)
    if usuario_objetivo is not None:
        suscripciones_vigentes_tributarias = Suscripcion.objects.filter(usuario=usuario_objetivo).filter(
            Q(estado=Suscripcion.ESTADO_ACTIVA) | Q(fecha_inicio__gte=corte_6_anos) | Q(fecha_vencimiento__gte=corte_6_anos)
        ).exists()
        if forzar_anonimizacion_sst or not suscripciones_vigentes_tributarias:
            suf = usuario_objetivo.uuid.hex[:10]
            usuario_objetivo.is_active = False
            usuario_objetivo.username = f'suprimido_{suf}'
            usuario_objetivo.email = f'suprimido+{suf}@anon.invalid'
            usuario_objetivo.first_name = ''
            usuario_objetivo.last_name = ''
            usuario_objetivo.mfa_enabled = False
            usuario_objetivo.mfa_secret = ''
            usuario_objetivo.mfa_secret_pendiente = ''
            usuario_objetivo.mfa_backup_codes_hashes = []
            usuario_objetivo.set_unusable_password()
            usuario_objetivo.save(update_fields=[
                'is_active', 'username', 'email', 'first_name', 'last_name',
                'mfa_enabled', 'mfa_secret', 'mfa_secret_pendiente',
                'mfa_backup_codes_hashes', 'password',
            ])
            suprimidos['Usuario'] = 1
        else:
            retenidos_por_ley.append({
                'modelo': 'Usuario / Suscripcion',
                'cantidad': 1,
                'causal_legal': MAPA_DATOS_PERSONALES['Suscripcion']['causa_licitud'],
            })

    if solicitud is not None:
        solicitud.estado = SolicitudDerechoARCO.ESTADO_RESUELTA
        solicitud.bloqueo_provisional_activo = False
        solicitud.fecha_resolucion = ahora
        solicitud.respuesta_formal = (
            f"Supresión/Anonimización ejecutada. Suprimidos: {suprimidos or 'ninguno'}. "
            f"Retenidos con bloqueo legal fundamentado: {len(retenidos_por_ley)} categorías."
        )
        solicitud.save(update_fields=['estado', 'bloqueo_provisional_activo', 'fecha_resolucion', 'respuesta_formal'])

    registrar_evento_seguridad(
        request,
        categoria=AuditLogEventoSeguridad.CATEGORIA_ARCO,
        accion='ARCO_SUPRESION',
        usuario=usuario_actor,
        actor_identificador=email_norm or rut_norm or (usuario_actor.email if usuario_actor else ''),
        modelo_afectado=','.join(sorted(suprimidos.keys())) or 'ARCO',
        recurso_id=str(solicitud.uuid) if solicitud else '',
        exito=True,
        metadata={'suprimidos': suprimidos, 'retenidos_por_ley': retenidos_por_ley},
    )

    return {
        'suprimidos': suprimidos,
        'retenidos_por_ley': retenidos_por_ley,
        'solicitud_uuid': str(solicitud.uuid) if solicitud else None,
    }


@transaction.atomic
def ejecutar_oposicion_titular(
    *,
    usuario_actor: Usuario | None = None,
    request: Any = None,
    usuario_objetivo: Usuario | None = None,
    rut: str = '',
    email: str = '',
    usuarios_grupo: list[Usuario] | None = None,
    motivo: str = '',
    activar_bloqueo_provisional: bool = True,
    solicitud: SolicitudDerechoARCO | None = None,
) -> dict[str, Any]:
    """
    Ejecuta oposición real al tratamiento no obligatorio (Art. 8 y Art. 11 Ley N° 21.719):
    revoca consentimientos opcionales/comerciales, suprime datos opcionales de contacto
    y activa bloqueo provisional transversal mientras se resuelve la solicitud asociada.
    """
    identidad = _resolver_identidad(usuario=usuario_objetivo, rut=rut, email=email)
    rut_norm = identidad['rut_norm']
    email_norm = identidad['email']
    identificador = email_norm or rut_norm or (usuario_objetivo.username if usuario_objetivo else 'titular')

    # 1. Revocar consentimientos opcionales de forma inmutable (append-only)
    consentimientos_revocados = 0
    for flujo in (
        RegistroConsentimiento.FLUJO_MARKETING_NOVEDADES,
        RegistroConsentimiento.FLUJO_REPORTE_RIESGO_IDENTIFICADO,
    ):
        registrar_consentimiento(
            request,
            flujo=flujo,
            identificador_titular=identificador,
            otorgado=False,
            usuario=usuario_objetivo,
            categorias=['contacto_opcional'],
            texto_aceptado=f'Oposición ejercida por el titular: {motivo[:200]}' if motivo else 'Oposición al tratamiento (Art. 8 Ley 21.719)',
        )
        consentimientos_revocados += 1

    # 2. Suprimir PII opcional no sujeta a obligación legal SST (reportes/sugerencias)
    opcionales_suprimidos = 0
    rep_qs = ReporteRiesgo.objects.all()
    if usuarios_grupo is not None:
        rep_qs = rep_qs.filter(Q(empresa__prevencionista__in=usuarios_grupo) | Q(usuario=usuario_objetivo))
    for rep in rep_qs:
        coincide = (
            (usuario_objetivo and rep.usuario_id == usuario_objetivo.id)
            or (rut_norm and normalizar_rut_blind_index(rep.rut_reportante or '') == rut_norm)
            or (email_norm and (rep.contacto_reportante or '').strip().lower() == email_norm)
        )
        if coincide and (rep.nombre_reportante or rep.rut_reportante or rep.contacto_reportante):
            rep.nombre_reportante = ''
            rep.rut_reportante = ''
            rep.contacto_reportante = ''
            rep.save(update_fields=['nombre_reportante', 'rut_reportante', 'contacto_reportante'])
            opcionales_suprimidos += 1

    # 3. Registrar o actualizar solicitud de Oposición con bloqueo provisional transversal activo
    if solicitud is None and activar_bloqueo_provisional:
        solicitud = SolicitudDerechoARCO.objects.create(
            tipo_derecho=SolicitudDerechoARCO.TIPO_OPOSICION,
            rut_titular=identidad['rut'] or rut_norm or (usuario_objetivo.username if usuario_objetivo else 'NO_PROPORCIONADO'),
            nombre_titular=(usuario_objetivo.get_full_name() or usuario_objetivo.username) if usuario_objetivo else identificador,
            email_titular=email_norm or 'sin-correo@arco.local',
            detalle_solicitud=motivo or 'Oposición al tratamiento no obligatorio (Art. 8 Ley N° 21.719).',
            estado=SolicitudDerechoARCO.ESTADO_EN_TRAMITE,
            bloqueo_provisional_activo=True,
        )
    elif solicitud is not None:
        solicitud.estado = SolicitudDerechoARCO.ESTADO_EN_TRAMITE if activar_bloqueo_provisional else SolicitudDerechoARCO.ESTADO_RESUELTA
        solicitud.bloqueo_provisional_activo = activar_bloqueo_provisional
        if not activar_bloqueo_provisional and not solicitud.fecha_resolucion:
            solicitud.fecha_resolucion = timezone.now()
        solicitud.save(update_fields=['estado', 'bloqueo_provisional_activo', 'fecha_resolucion'])

    registrar_evento_seguridad(
        request,
        categoria=AuditLogEventoSeguridad.CATEGORIA_ARCO,
        accion='ARCO_OPOSICION',
        usuario=usuario_actor,
        actor_identificador=identificador,
        modelo_afectado='RegistroConsentimiento,ReporteRiesgo,SolicitudDerechoARCO',
        recurso_id=str(solicitud.uuid) if solicitud else '',
        exito=True,
        metadata={
            'consentimientos_revocados': consentimientos_revocados,
            'opcionales_suprimidos': opcionales_suprimidos,
            'bloqueo_provisional_activo': bool(solicitud and solicitud.bloqueo_provisional_activo),
        },
    )

    return {
        'consentimientos_revocados': consentimientos_revocados,
        'opcionales_suprimidos': opcionales_suprimidos,
        'bloqueo_provisional_activo': bool(solicitud and solicitud.bloqueo_provisional_activo),
        'solicitud_uuid': str(solicitud.uuid) if solicitud else None,
    }


@transaction.atomic
def registrar_rechazo_bloqueo_apdp(
    solicitud: SolicitudDerechoARCO,
    *,
    usuario_actor: Usuario | None = None,
    request: Any = None,
    motivo: str = '',
) -> SolicitudDerechoARCO:
    """
    Registra formalmente el rechazo de un bloqueo provisional y la constancia de
    comunicación a la Agencia de Protección de Datos Personales (Art. 11 Ley N° 21.719).
    """
    ahora = timezone.now()
    solicitud.bloqueo_provisional_activo = False
    solicitud.aviso_apdp_rechazo_bloqueo = True
    solicitud.fecha_aviso_apdp_bloqueo = ahora
    if motivo:
        solicitud.respuesta_formal = motivo
    solicitud.save(update_fields=[
        'bloqueo_provisional_activo',
        'aviso_apdp_rechazo_bloqueo',
        'fecha_aviso_apdp_bloqueo',
        'respuesta_formal',
    ])

    registrar_evento_seguridad(
        request,
        categoria=AuditLogEventoSeguridad.CATEGORIA_ARCO,
        accion='ARCO_RECHAZO_BLOQUEO_APDP',
        usuario=usuario_actor,
        actor_identificador=usuario_actor.email if usuario_actor else 'staff',
        modelo_afectado='SolicitudDerechoARCO',
        recurso_id=str(solicitud.uuid),
        exito=True,
        metadata={'motivo': motivo[:300]},
    )
    return solicitud
