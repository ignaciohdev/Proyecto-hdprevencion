from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import (
    Plan, Usuario, Suscripcion, ContadorDescargas, 
    PlantillaMaestra, DocumentoUsuario, 
    Noticia, MensajeContacto, Servicio,
    TemaCapacitacion, RegistroCapacitacion
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
        'is_staff', 
        'is_active'
    )
    list_filter = (
        'tipo_usuario', 
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
    
    # Organizar campos en secciones claras en el formulario de edición
    fieldsets = UserAdmin.fieldsets + (
        ('Información SaaS (Prevención HD)', {
            'fields': ('tipo_usuario', 'cuenta_padre'),
            'description': 'Campos específicos de la jerarquía de suscripciones y tipos de cuentas corporativas o individuales.'
        }),
    )
    
    # Organizar campos para el formulario de creación rápida
    add_fieldsets = UserAdmin.add_fieldsets + (
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
            return format_html(
                '<span style="background-color: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">Desactualizado</span>'
            )
        return format_html(
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


