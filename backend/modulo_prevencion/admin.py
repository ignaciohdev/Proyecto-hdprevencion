import hashlib
import json
from typing import Any
from django import forms
from django.contrib import admin
from django.contrib.admin.forms import AdminAuthenticationForm
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from .auditoria import registrar_evento_seguridad
from .mfa import verificar_segundo_factor_usuario
from .models import (
    Plan, Usuario, Suscripcion, ContadorDescargas, 
    PlantillaMaestra, DocumentoUsuario, 
    Noticia, MensajeContacto, Servicio,
    TemaCapacitacion, RegistroCapacitacion,
    SugerenciaConsulta, SolicitudCapacitacion,
    RequisitoLegalBase, MatrizLegal, ItemMatrizLegal,
    MatrizRiesgoMiper, ItemMatrizRiesgo,
    RegistroConsentimiento, SolicitudDerechoARCO, RegistroBrechaSeguridad,
    AuditLogEventoSeguridad
)

@admin.register(Usuario)
class UsuarioCustomAdmin(UserAdmin):
    """
    Administración personalizada de usuarios, extendiendo la interfaz nativa
    de Django UserAdmin para incorporar los campos específicos de SaaS.
    """
    list_display = (
        'username', 
        'email', 
        'tipo_usuario', 
        'cuenta_padre', 
        'mfa_enabled',
        'is_staff', 
        'is_active'
    )
    list_filter = (
        'tipo_usuario', 
        'mfa_enabled',
        'is_staff', 
        'is_active', 
        'groups'
    )
    search_fields = (
        'username', 
        'first_name', 
        'last_name', 
        'email'
    )
    readonly_fields = tuple(getattr(UserAdmin, 'readonly_fields', ())) + ('mfa_enrolled_at',)
    
    # Organizar campos en secciones claras en el formulario de edición
    fieldsets = tuple(UserAdmin.fieldsets or ()) + (
        ('Información SaaS (Prevención HD)', {
            'fields': ('tipo_usuario', 'cuenta_padre', 'mfa_enabled', 'mfa_enrolled_at'),
            'description': 'Campos específicos de jerarquía corporativa y estado MFA TOTP (sin exponer secretos criptográficos).'
        }),
    )
    
    # Organizar campos para el formulario de creación rápida
    add_fieldsets = tuple(UserAdmin.add_fieldsets or ()) + (
        ('Información SaaS (Prevención HD)', {
            'classes': ('wide',),
            'fields': ('tipo_usuario', 'cuenta_padre'),
        }),
    )


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    """
    Gestión del catálogo de planes de suscripción y sus límites.
    """
    list_display = (
        'nombre', 
        'precio_display', 
        'limite_semanal', 
        'asientos', 
        'edicion_nube', 
        'marca_agua', 
        'marca_blanca'
    )
    list_filter = (
        'edicion_nube', 
        'marca_agua', 
        'marca_blanca'
    )
    search_fields = ('nombre', 'codigo')
    prepopulated_fields = {'codigo': ('nombre',)}
    ordering = ('precio',)

    @admin.display(description="Precio", ordering="precio")
    def precio_display(self, obj):
        return f"${int(obj.precio):,} CLP"


@admin.register(Suscripcion)
class SuscripcionAdmin(admin.ModelAdmin):
    """
    Gestión de las suscripciones asociadas a los clientes.
    """
    list_display = (
        'usuario', 
        'plan', 
        'estado_label', 
        'fecha_inicio', 
        'fecha_vencimiento'
    )
    list_filter = (
        'estado', 
        'plan', 
        'fecha_inicio'
    )
    search_fields = (
        'usuario__username', 
        'usuario__email', 
        'plan__nombre'
    )
    date_hierarchy = 'fecha_inicio'
    raw_id_fields = ('usuario',)  # Útil para buscar usuarios en bases de datos con muchos registros

    @admin.display(description="Estado", ordering="estado")
    def estado_label(self, obj):
        """
        Devuelve una etiqueta HTML con colores según el estado de la suscripción.
        """
        colors = {
            Suscripcion.ESTADO_ACTIVA: '#10b981',      # Verde
            Suscripcion.ESTADO_CANCELADA: '#6b7280',   # Gris
            Suscripcion.ESTADO_IMPAGA: '#ef4444',      # Rojo
        }
        color = colors.get(obj.estado, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_estado_display()
        )


@admin.register(ContadorDescargas)
class ContadorDescargasAdmin(admin.ModelAdmin):
    """
    Visualización del conteo de descargas semanales por usuario.
    """
    list_display = (
        'usuario', 
        'descargas_semanales', 
        'fecha_ultima_descarga'
    )
    search_fields = (
        'usuario__username', 
        'usuario__email'
    )
    raw_id_fields = ('usuario',)


@admin.register(PlantillaMaestra)
class PlantillaMaestraAdmin(admin.ModelAdmin):
    """
    Gestión de las plantillas maestras (Formatos base XLSX, DOCX, PDF).
    """
    list_display = (
        'nombre', 
        'tipo_archivo', 
        'fecha_ultima_actualizacion'
    )
    list_filter = ('tipo_archivo',)
    search_fields = ('nombre',)
    date_hierarchy = 'fecha_ultima_actualizacion'


@admin.register(DocumentoUsuario)
class DocumentoUsuarioAdmin(admin.ModelAdmin):
    """
    Supervisión de los documentos generados por los usuarios finales y su vigencia.
    """
    list_display = (
        'usuario', 
        'plantilla_maestra', 
        'fecha_ultimo_guardado', 
        'estado_actualizacion_label'
    )
    list_filter = (
        'plantilla_maestra__tipo_archivo', 
        'fecha_ultimo_guardado'
    )
    search_fields = (
        'usuario__username', 
        'plantilla_maestra__nombre'
    )
    readonly_fields = ('fecha_ultimo_guardado',)
    raw_id_fields = ('usuario', 'plantilla_maestra')

    @admin.display(description="Vigencia", ordering="plantilla_maestra__fecha_ultima_actualizacion")
    def estado_actualizacion_label(self, obj):
        """
        Muestra visualmente si el documento del usuario está desactualizado respecto a la plantilla original.
        """
        if obj.esta_desactualizado:
            return mark_safe(
                '<span style="background-color: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">Desactualizado</span>'
            )
        return mark_safe(
            '<span style="background-color: #d1fae5; color: #047857; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">Al Día</span>'
        )


@admin.register(Noticia)
class NoticiaAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'categoria', 'autor', 'estado', 'fecha_publicacion')
    list_filter = ('categoria', 'estado', 'fecha_publicacion')
    search_fields = ('titulo', 'subtitulo', 'contenido', 'autor__username')
    date_hierarchy = 'fecha_publicacion'
    raw_id_fields = ('autor',)


@admin.register(MensajeContacto)
class MensajeContactoAdmin(admin.ModelAdmin):
    list_display = ('asunto', 'nombre', 'email', 'leido', 'fecha_creacion')
    list_filter = ('leido', 'fecha_creacion')
    search_fields = ('nombre', 'email', 'asunto', 'mensaje')
    date_hierarchy = 'fecha_creacion'
    readonly_fields = ('fecha_creacion',)


@admin.register(Servicio)
class ServicioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'icono', 'activo')
    list_filter = ('activo',)
    search_fields = ('nombre', 'descripcion')


@admin.register(TemaCapacitacion)
class TemaCapacitacionAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'categoria', 'duracion_minutos', 'usuario', 'fecha_creacion')
    list_filter = ('categoria', 'fecha_creacion')
    search_fields = ('titulo', 'descripcion', 'usuario__username')
    raw_id_fields = ('usuario',)


@admin.register(RegistroCapacitacion)
class RegistroCapacitacionAdmin(admin.ModelAdmin):
    list_display = ('tema', 'usuario', 'estado', 'fecha_programada', 'fecha_realizacion', 'lugar')
    list_filter = ('estado', 'fecha_programada', 'fecha_realizacion')
    search_fields = ('tema__titulo', 'usuario__username', 'lugar')
    raw_id_fields = ('usuario', 'tema')
    date_hierarchy = 'fecha_programada'


@admin.register(SugerenciaConsulta)
class SugerenciaConsultaAdmin(admin.ModelAdmin):
    """
    Gestión del Buzón Digital de sugerencias y consultas de trabajadores.
    """
    list_display = (
        'tipo', 'usuario', 'estado_lectura', 'anonimo', 'nombre_remitente', 'fecha_creacion'
    )
    list_filter = ('tipo', 'leido', 'anonimo', 'fecha_creacion')
    search_fields = ('mensaje', 'nombre_remitente', 'usuario__username')
    readonly_fields = ('fecha_creacion',)
    date_hierarchy = 'fecha_creacion'
    raw_id_fields = ('usuario',)

    @admin.display(description="Estado", ordering="leido")
    def estado_lectura(self, obj):
        if obj.leido:
            return mark_safe(
                '<span style="background-color:#d1fae5;color:#047857;padding:3px 8px;border-radius:4px;font-size:0.82rem;font-weight:600;">Respondido</span>'
            )
        return mark_safe(
            '<span style="background-color:#fef3c7;color:#92400e;padding:3px 8px;border-radius:4px;font-size:0.82rem;font-weight:600;">Pendiente</span>'
        )


@admin.register(SolicitudCapacitacion)
class SolicitudCapacitacionAdmin(admin.ModelAdmin):
    list_display = (
        'empresa', 'tipo_capacitacion', 'modalidad', 'contacto_nombre',
        'contacto_telefono', 'cantidad_trabajadores', 'estado_badge', 'fecha_creacion'
    )
    list_filter = ('estado', 'tipo_capacitacion', 'modalidad', 'fecha_creacion')
    search_fields = ('empresa', 'rut_empresa', 'contacto_nombre', 'contacto_email', 'region_comuna')
    readonly_fields = ('fecha_creacion', 'fecha_actualizacion')
    date_hierarchy = 'fecha_creacion'
    raw_id_fields = ('usuario',)

    @admin.display(description="Estado", ordering="estado")
    def estado_badge(self, obj):
        colores = {
            'PENDIENTE': ('#fef3c7', '#92400e'),
            'CONTACTADO': ('#e0e7ff', '#3730a3'),
            'COTIZADO': ('#f3e8ff', '#6b21a8'),
            'COORDINADO': ('#dbeafe', '#1e40af'),
            'FINALIZADO': ('#d1fae5', '#065f46'),
            'CANCELADO': ('#fee2e2', '#991b1b'),
        }
        bg, text = colores.get(obj.estado, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:3px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">{obj.get_estado_display()}</span>'
        )


@admin.register(RequisitoLegalBase)
class RequisitoLegalBaseAdmin(admin.ModelAdmin):
    list_display = ('identificacion_norma', 'articulo', 'titulo', 'organismo', 'rubro_aplicable', 'activo', 'orden')
    list_filter = ('organismo', 'tipo_norma', 'rubro_aplicable', 'activo')
    search_fields = ('identificacion_norma', 'articulo', 'titulo', 'descripcion_exigencia')
    ordering = ('orden', 'identificacion_norma', 'articulo')


class ItemMatrizLegalInline(admin.TabularInline):
    model = ItemMatrizLegal
    extra = 0
    fields = ('identificacion_norma', 'articulo', 'titulo', 'organismo', 'estado', 'responsable')
    readonly_fields = ('identificacion_norma', 'articulo', 'titulo', 'organismo')


@admin.register(MatrizLegal)
class MatrizLegalAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'centro_trabajo', 'rubro_principal', 'prevencionista', 'porcentaje_cumplimiento_label', 'estado_semaforo_badge', 'fecha_actualizacion')
    list_filter = ('rubro_principal', 'fecha_actualizacion')
    search_fields = ('empresa__razon_social', 'empresa__rut', 'prevencionista__username')
    inlines = [ItemMatrizLegalInline]

    @admin.display(description="% Cumplimiento")
    def porcentaje_cumplimiento_label(self, obj):
        return f"{obj.porcentaje_cumplimiento}%"

    @admin.display(description="Semáforo")
    def estado_semaforo_badge(self, obj):
        colores = {
            'OPTIMO': ('#d1fae5', '#065f46'),
            'REGULAR': ('#fef3c7', '#92400e'),
            'CRITICO': ('#fee2e2', '#991b1b'),
        }
        bg, text = colores.get(obj.estado_semaforo, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:3px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">{obj.estado_semaforo}</span>'
        )


@admin.register(ItemMatrizLegal)
class ItemMatrizLegalAdmin(admin.ModelAdmin):
    list_display = ('matriz', 'identificacion_norma', 'articulo', 'organismo', 'estado_badge', 'responsable', 'fecha_compromiso')
    list_filter = ('estado', 'organismo', 'tipo_norma')
    search_fields = ('identificacion_norma', 'articulo', 'titulo', 'responsable', 'evidencia_cumplimiento')

    @admin.display(description="Estado", ordering="estado")
    def estado_badge(self, obj):
        colores = {
            'CUMPLE': ('#d1fae5', '#065f46'),
            'EN_PROCESO': ('#fef3c7', '#92400e'),
            'NO_CUMPLE': ('#fee2e2', '#991b1b'),
            'NO_APLICA': ('#e5e7eb', '#374151'),
        }
        bg, text = colores.get(obj.estado, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:3px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">{obj.get_estado_display()}</span>'
        )


class ItemMatrizRiesgoInline(admin.TabularInline):
    model = ItemMatrizRiesgo
    extra = 0
    fields = ('proceso', 'actividad', 'peligro', 'clasificacion_peligro', 'magnitud_pura_badge', 'magnitud_residual_badge', 'estado_control')
    readonly_fields = ('magnitud_pura_badge', 'magnitud_residual_badge')

    @admin.display(description="Riesgo Puro")
    def magnitud_pura_badge(self, obj):
        colors = {
            'CRITICO': ('#fee2e2', '#991b1b'),
            'ALTO': ('#ffedd5', '#9a3412'),
            'MEDIO': ('#fef3c7', '#92400e'),
            'BAJO': ('#d1fae5', '#065f46')
        }
        bg, text = colors.get(obj.clasificacion_pura, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:2px 6px;border-radius:4px;font-weight:bold;">{obj.magnitud_pura} ({obj.clasificacion_pura})</span>'
        )

    @admin.display(description="Riesgo Residual")
    def magnitud_residual_badge(self, obj):
        colors = {
            'CRITICO': ('#fee2e2', '#991b1b'),
            'ALTO': ('#ffedd5', '#9a3412'),
            'MEDIO': ('#fef3c7', '#92400e'),
            'BAJO': ('#d1fae5', '#065f46')
        }
        bg, text = colors.get(obj.clasificacion_residual, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:2px 6px;border-radius:4px;font-weight:bold;">{obj.magnitud_residual} ({obj.clasificacion_residual})</span>'
        )


@admin.register(MatrizRiesgoMiper)
class MatrizRiesgoMiperAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'empresa', 'centro_trabajo', 'prevencionista', 'estado_badge', 'total_peligros', 'porcentaje_reduccion_label', 'fecha_actualizacion')
    list_filter = ('estado', 'fecha_actualizacion')
    search_fields = ('nombre', 'proceso_area', 'empresa__razon_social', 'empresa__rut', 'prevencionista__username')
    inlines = [ItemMatrizRiesgoInline]

    @admin.display(description="Estado")
    def estado_badge(self, obj):
        colors = {
            'VIGENTE': ('#d1fae5', '#065f46'),
            'BORRADOR': ('#fef3c7', '#92400e'),
            'EN_REVISION': ('#fee2e2', '#991b1b'),
        }
        bg, text = colors.get(obj.estado, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:3px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">{obj.get_estado_display()}</span>'
        )

    @admin.display(description="% Mitigación")
    def porcentaje_reduccion_label(self, obj):
        return f"{obj.porcentaje_reduccion_riesgo}%"


@admin.register(ItemMatrizRiesgo)
class ItemMatrizRiesgoAdmin(admin.ModelAdmin):
    list_display = ('matriz', 'proceso', 'actividad', 'clasificacion_peligro', 'magnitud_pura_badge', 'magnitud_residual_badge', 'estado_control', 'responsable')
    list_filter = ('clasificacion_peligro', 'estado_control', 'tipo_actividad')
    search_fields = ('proceso', 'actividad', 'peligro', 'riesgo_consecuencia', 'responsable')

    @admin.display(description="Riesgo Puro")
    def magnitud_pura_badge(self, obj):
        colors = {
            'CRITICO': ('#fee2e2', '#991b1b'),
            'ALTO': ('#ffedd5', '#9a3412'),
            'MEDIO': ('#fef3c7', '#92400e'),
            'BAJO': ('#d1fae5', '#065f46')
        }
        bg, text = colors.get(obj.clasificacion_pura, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:2px 6px;border-radius:4px;font-weight:bold;">{obj.magnitud_pura} ({obj.clasificacion_pura})</span>'
        )

    @admin.display(description="Riesgo Residual")
    def magnitud_residual_badge(self, obj):
        colors = {
            'CRITICO': ('#fee2e2', '#991b1b'),
            'ALTO': ('#ffedd5', '#9a3412'),
            'MEDIO': ('#fef3c7', '#92400e'),
            'BAJO': ('#d1fae5', '#065f46')
        }
        bg, text = colors.get(obj.clasificacion_residual, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:2px 6px;border-radius:4px;font-weight:bold;">{obj.magnitud_residual} ({obj.clasificacion_residual})</span>'
        )


@admin.register(RegistroConsentimiento)
class RegistroConsentimientoAdmin(admin.ModelAdmin):
    """Registro append-only de prueba de consentimiento (Art. 12 inciso final Ley 21.719)."""
    list_display = ('fecha_evento', 'flujo', 'identificador_titular', 'otorgado', 'version_politica', 'ip_origen')
    list_filter = ('flujo', 'otorgado', 'version_politica')
    search_fields = ('identificador_titular', 'hash_politica', 'ip_origen')
    date_hierarchy = 'fecha_evento'
    readonly_fields = (
        'usuario', 'identificador_titular', 'flujo', 'version_politica',
        'hash_politica', 'otorgado', 'categorias', 'ip_origen', 'user_agent', 'fecha_evento'
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SolicitudDerechoARCO)
class SolicitudDerechoARCOAdmin(admin.ModelAdmin):
    """Gestión operativa de derechos del titular ARCO-POL y bloqueo provisional (Arts. 4–11 Ley 21.719)."""
    list_display = (
        'uuid', 'tipo_derecho', 'rut_titular', 'nombre_titular',
        'estado_badge', 'bloqueo_provisional_activo', 'aviso_apdp_rechazo_bloqueo',
        'fecha_limite_bloqueo_2d', 'fecha_solicitud', 'fecha_limite_30d'
    )
    list_filter = ('tipo_derecho', 'estado', 'bloqueo_provisional_activo', 'aviso_apdp_rechazo_bloqueo')
    search_fields = ('uuid', 'rut_titular', 'nombre_titular', 'email_titular')
    date_hierarchy = 'fecha_solicitud'
    readonly_fields = ('uuid', 'fecha_solicitud', 'fecha_limite_30d', 'fecha_limite_bloqueo_2d', 'fecha_aviso_apdp_bloqueo')
    actions = (
        'activar_bloqueo_provisional',
        'rechazar_bloqueo_y_notificar_apdp',
        'exportar_portabilidad_arco_json',
        'ejecutar_supresion_arco',
        'ejecutar_oposicion_arco',
        'marcar_resuelta',
    )

    @admin.display(description="Estado")
    def estado_badge(self, obj):
        colors = {
            SolicitudDerechoARCO.ESTADO_PENDIENTE: ('#fef3c7', '#92400e'),
            SolicitudDerechoARCO.ESTADO_EN_TRAMITE: ('#dbeafe', '#1e40af'),
            SolicitudDerechoARCO.ESTADO_RESUELTA: ('#d1fae5', '#065f46'),
            SolicitudDerechoARCO.ESTADO_RECHAZADA: ('#fee2e2', '#991b1b'),
        }
        bg, text = colors.get(obj.estado, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:3px 8px;border-radius:4px;font-weight:bold;">{obj.get_estado_display()}</span>'
        )

    @admin.action(description="Activar bloqueo temporal provisional (Art. 11)")
    def activar_bloqueo_provisional(self, request, queryset):
        queryset.update(bloqueo_provisional_activo=True)

    @admin.action(description="Rechazar bloqueo provisional y registrar aviso APDP (Art. 11)")
    def rechazar_bloqueo_y_notificar_apdp(self, request, queryset):
        from .arco import registrar_rechazo_bloqueo_apdp
        for solicitud in queryset:
            registrar_rechazo_bloqueo_apdp(
                solicitud,
                usuario_actor=request.user,
                request=request,
                motivo="Rechazo de bloqueo provisional informado a APDP desde panel administrativo.",
            )

    @admin.action(description="Exportar copia portable JSON (Art. 9)")
    def exportar_portabilidad_arco_json(self, request, queryset):
        from .arco import exportar_datos_titular

        UserModel = get_user_model()
        exportaciones = []
        for solicitud in queryset:
            usuario_obj = (
                UserModel.objects.filter(email__iexact=solicitud.email_titular).first()
                if solicitud.email_titular else None
            )
            exportaciones.append({
                'solicitud_uuid': str(solicitud.uuid),
                'tipo_derecho': solicitud.tipo_derecho,
                'datos': exportar_datos_titular(
                    usuario=usuario_obj,
                    rut=solicitud.rut_titular,
                    email=solicitud.email_titular,
                ),
            })
        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_ARCO,
            accion='ADMIN_EXPORT_PORTABILIDAD',
            usuario=request.user,
            modelo_afectado='SolicitudDerechoARCO',
            recurso_id=','.join(str(s.uuid) for s in queryset),
            exito=True,
            metadata={'cantidad': len(exportaciones)},
        )
        response = HttpResponse(
            json.dumps(exportaciones, ensure_ascii=False, indent=2),
            content_type='application/json; charset=utf-8',
        )
        response['Content-Disposition'] = 'attachment; filename="arco_portabilidad_admin.json"'
        return response

    @admin.action(description="Ejecutar supresión/anonimización respetando retención legal (Art. 7)")
    def ejecutar_supresion_arco(self, request, queryset):
        from .arco import ejecutar_supresion_titular

        UserModel = get_user_model()
        ejecutadas = 0
        for solicitud in queryset:
            usuario_obj = (
                UserModel.objects.filter(email__iexact=solicitud.email_titular).first()
                if solicitud.email_titular else None
            )
            ejecutar_supresion_titular(
                usuario_actor=request.user,
                request=request,
                usuario_objetivo=usuario_obj,
                rut=solicitud.rut_titular,
                email=solicitud.email_titular,
                forzar_anonimizacion_sst=False,
                solicitud=solicitud,
            )
            ejecutadas += 1
        self.message_user(request, f"Supresión/anonimización ejecutada en {ejecutadas} solicitud(es).")

    @admin.action(description="Ejecutar oposición y revocar opcionales (Art. 8)")
    def ejecutar_oposicion_arco(self, request, queryset):
        from .arco import ejecutar_oposicion_titular

        UserModel = get_user_model()
        ejecutadas = 0
        for solicitud in queryset:
            usuario_obj = (
                UserModel.objects.filter(email__iexact=solicitud.email_titular).first()
                if solicitud.email_titular else None
            )
            ejecutar_oposicion_titular(
                usuario_actor=request.user,
                request=request,
                usuario_objetivo=usuario_obj,
                rut=solicitud.rut_titular,
                email=solicitud.email_titular,
                motivo=solicitud.detalle_solicitud,
                activar_bloqueo_provisional=False,
                solicitud=solicitud,
            )
            ejecutadas += 1
        self.message_user(request, f"Oposición ejecutada en {ejecutadas} solicitud(es).")

    @admin.action(description="Marcar solicitudes seleccionadas como Resueltas")
    def marcar_resuelta(self, request, queryset):
        queryset.update(
            estado=SolicitudDerechoARCO.ESTADO_RESUELTA,
            bloqueo_provisional_activo=False,
            fecha_resolucion=timezone.now(),
        )

    def save_model(self, request, obj, form, change):
        if obj.estado in (SolicitudDerechoARCO.ESTADO_RESUELTA, SolicitudDerechoARCO.ESTADO_RECHAZADA):
            if not obj.fecha_resolucion:
                obj.fecha_resolucion = timezone.now()
            if 'bloqueo_provisional_activo' not in getattr(form, 'changed_data', []):
                obj.bloqueo_provisional_activo = False
        if obj.aviso_apdp_rechazo_bloqueo and not obj.fecha_aviso_apdp_bloqueo:
            obj.fecha_aviso_apdp_bloqueo = timezone.now()
        super().save_model(request, obj, form, change)


@admin.register(RegistroBrechaSeguridad)
class RegistroBrechaSeguridadAdmin(admin.ModelAdmin):
    """Registro operativo y trazabilidad de vulneraciones de seguridad (Arts. 14 sexies y 15 bis Ley 21.719)."""
    list_display = (
        'codigo_incidente', 'tipo_brecha', 'severidad_badge',
        'datos_sensibles_afectados', 'datos_economicos_financieros',
        'notificado_responsable', 'notificado_agencia', 'notificado_titulares', 'fecha_deteccion'
    )
    list_filter = (
        'tipo_brecha', 'severidad', 'datos_sensibles_afectados',
        'datos_economicos_financieros', 'notificado_responsable',
        'notificado_agencia', 'notificado_titulares',
    )
    search_fields = (
        'codigo_incidente', 'descripcion_incidente', 'responsable_analisis',
        'folio_notificacion_agencia', 'contacto_responsable_notificado',
    )
    date_hierarchy = 'fecha_deteccion'
    readonly_fields = ('fecha_deteccion',)

    @admin.display(description="Severidad")
    def severidad_badge(self, obj):
        colors = {
            RegistroBrechaSeguridad.SEVERIDAD_BAJA: ('#d1fae5', '#065f46'),
            RegistroBrechaSeguridad.SEVERIDAD_MEDIA: ('#fef3c7', '#92400e'),
            RegistroBrechaSeguridad.SEVERIDAD_ALTA: ('#ffedd5', '#9a3412'),
            RegistroBrechaSeguridad.SEVERIDAD_CRITICA: ('#fee2e2', '#991b1b'),
        }
        bg, text = colors.get(obj.severidad, ('#f3f4f6', '#374151'))
        return mark_safe(
            f'<span style="background-color:{bg};color:{text};padding:3px 8px;border-radius:4px;font-weight:bold;">{obj.severidad}</span>'
        )


@admin.register(AuditLogEventoSeguridad)
class AuditLogEventoSeguridadAdmin(admin.ModelAdmin):
    """Trazabilidad inmutable (append-only) de eventos críticos de seguridad y privacidad."""
    list_display = (
        'fecha_evento', 'categoria', 'accion', 'actor_identificador',
        'modelo_afectado', 'recurso_id', 'exito', 'ip_origen'
    )
    list_filter = ('categoria', 'accion', 'exito')
    search_fields = ('actor_identificador', 'accion', 'modelo_afectado', 'recurso_id', 'ip_origen')
    date_hierarchy = 'fecha_evento'
    readonly_fields = (
        'usuario', 'actor_identificador', 'categoria', 'accion',
        'modelo_afectado', 'recurso_id', 'exito', 'ip_origen',
        'user_agent', 'metadata', 'fecha_evento'
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


ADMIN_MFA_MAX_FAILURES = 5
ADMIN_MFA_LOCKOUT_SECONDS = 300


def _admin_mfa_rate_limit_key(request, username: str) -> str:
    ip = ''
    if request is not None:
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        ip = xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR', '')
    digest = hashlib.sha256(f"{ip}:{(username or '').strip().lower()}".encode('utf-8')).hexdigest()[:32]
    return f"admin_mfa_fail:{digest}"


class MFAAdminAuthenticationForm(AdminAuthenticationForm):
    """Formulario de acceso a Django Admin con segundo factor TOTP / códigos de respaldo (sec-mfa)."""

    otp_code = forms.CharField(
        label="Código MFA (TOTP o respaldo)",
        required=False,
        strip=True,
        widget=forms.TextInput(attrs={
            'autocomplete': 'one-time-code',
            'placeholder': '123456 o XXXX-XXXX',
        }),
        help_text="Ingresa el código TOTP de 6 dígitos de tu app autenticadora o un código de respaldo.",
    )

    def _registrar_fallo_rate_limit(self, rl_key: str, actual: int) -> None:
        cache.set(rl_key, actual + 1, timeout=ADMIN_MFA_LOCKOUT_SECONDS)

    def clean(self):
        raw_username = ''
        if hasattr(self, 'data') and self.data:
            raw_username = str(self.data.get('username') or '')
        rl_key = _admin_mfa_rate_limit_key(self.request, raw_username)
        intentos_previos = int(cache.get(rl_key, 0) or 0)
        if intentos_previos >= ADMIN_MFA_MAX_FAILURES:
            registrar_evento_seguridad(
                self.request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_FAIL',
                actor_identificador=raw_username[:150] or 'admin',
                modelo_afectado='Usuario',
                exito=False,
                metadata={'flow': 'django_admin_login', 'reason': 'rate_limited'},
            )
            raise DjangoValidationError(
                "Demasiados intentos fallidos de acceso administrativo. Espera 5 minutos antes de reintentar.",
                code='mfa_rate_limited',
            )

        try:
            cleaned_data = super().clean()
        except DjangoValidationError:
            self._registrar_fallo_rate_limit(rl_key, intentos_previos)
            raise

        user = self.get_user()
        if user is None:
            return cleaned_data

        otp_code = (cleaned_data.get('otp_code') or '').strip()
        if not getattr(user, 'mfa_enabled', False):
            self._registrar_fallo_rate_limit(rl_key, intentos_previos)
            registrar_evento_seguridad(
                self.request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_FAIL',
                usuario=user,
                modelo_afectado='Usuario',
                recurso_id=user.pk,
                exito=False,
                metadata={'flow': 'django_admin_login', 'reason': 'mfa_not_enabled'},
            )
            raise DjangoValidationError(
                "Tu cuenta administrativa debe activar MFA TOTP en Mi Perfil (/panel/perfil#seguridad-mfa) antes de ingresar al panel de administración.",
                code='mfa_setup_required',
            )

        if not otp_code:
            self._registrar_fallo_rate_limit(rl_key, intentos_previos)
            registrar_evento_seguridad(
                self.request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_FAIL',
                usuario=user,
                modelo_afectado='Usuario',
                recurso_id=user.pk,
                exito=False,
                metadata={'flow': 'django_admin_login', 'reason': 'missing_otp'},
            )
            raise DjangoValidationError(
                "Ingresa tu código TOTP de 6 dígitos o un código de respaldo para ingresar al panel de administración.",
                code='mfa_required',
            )

        if not verificar_segundo_factor_usuario(user, otp_code):
            self._registrar_fallo_rate_limit(rl_key, intentos_previos)
            registrar_evento_seguridad(
                self.request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_FAIL',
                usuario=user,
                modelo_afectado='Usuario',
                recurso_id=user.pk,
                exito=False,
                metadata={'flow': 'django_admin_login', 'reason': 'invalid_otp'},
            )
            raise DjangoValidationError(
                "Código TOTP o de respaldo inválido o ya utilizado.",
                code='invalid_mfa',
            )

        cache.delete(rl_key)
        registrar_evento_seguridad(
            self.request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
            accion='MFA_OK',
            usuario=user,
            modelo_afectado='Usuario',
            recurso_id=user.pk,
            exito=True,
            metadata={'flow': 'django_admin_login'},
        )
        return cleaned_data


class MFAAdminSite(admin.AdminSite):
    """AdminSite protegido con verificación MFA TOTP obligatoria en sesión y login."""

    login_form = MFAAdminAuthenticationForm
    login_template = 'admin/mfa_login.html'
    site_header = "HD Prevención — Panel de Control SST"
    site_title = "HD Prevención Admin"

    def has_permission(self, request):
        if not super().has_permission(request):
            return False
        user = request.user
        return bool(
            getattr(user, 'mfa_enabled', False)
            and request.session.get('mfa_admin_verified_uid') == user.pk
        )

    def login(self, request, extra_context=None):
        context = dict(extra_context or {})
        context.setdefault('mfa_admin_required', True)
        response = super().login(request, extra_context=context)
        if request.method == 'POST' and getattr(request.user, 'is_authenticated', False):
            if getattr(request.user, 'mfa_enabled', False) and response.status_code == 302:
                request.session['mfa_admin_verified_uid'] = request.user.pk
                registrar_evento_seguridad(
                    request,
                    categoria=AuditLogEventoSeguridad.CATEGORIA_AUTH,
                    accion='LOGIN_OK',
                    usuario=request.user,
                    modelo_afectado='Usuario',
                    recurso_id=request.user.pk,
                    exito=True,
                    metadata={'flow': 'django_admin_login', 'mfa': True},
                )
        return response


def configurar_admin_mfa() -> None:
    """Aplica MFAAdminSite sobre django.contrib.admin.site preservando el registro existente."""
    _ = admin.site._registry
    site_obj = getattr(admin.site, '_wrapped', admin.site)
    if not isinstance(site_obj, MFAAdminSite):
        site_obj.__class__ = MFAAdminSite
    site_obj.login_form = MFAAdminAuthenticationForm
    site_obj.login_template = 'admin/mfa_login.html'
    site_obj.site_header = MFAAdminSite.site_header
    site_obj.site_title = MFAAdminSite.site_title


configurar_admin_mfa()





