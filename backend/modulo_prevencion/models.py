from typing import Any
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.exceptions import ValidationError
from datetime import date


class Plan(models.Model):
    """
    Modelo que define los distintos planes de suscripción de la plataforma.
    """
    nombre = models.CharField(
        max_length=50, 
        unique=True, 
        verbose_name="Nombre del Plan"
    )
    codigo = models.SlugField(
        max_length=50, 
        unique=True, 
        verbose_name="Código del Plan",
        help_text="Identificador único legible en código (ej. basico, profesional, expert, consultora)."
    )
    precio = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        verbose_name="Precio (CLP)"
    )
    edicion_nube = models.BooleanField(
        default=False, 
        verbose_name="Edición en la Nube"
    )
    marca_agua = models.BooleanField(
        default=True, 
        verbose_name="Tiene Marca de Agua"
    )
    marca_blanca = models.BooleanField(
        default=False, 
        verbose_name="Marca Blanca"
    )
    limite_semanal = models.PositiveIntegerField(
        verbose_name="Límite Semanal de Descargas"
    )
    asientos = models.PositiveIntegerField(
        default=1, 
        verbose_name="Número de Asientos/Usuarios"
    )

    class Meta:
        verbose_name = "Plan de Suscripción"
        verbose_name_plural = "Planes de Suscripción"
        ordering = ['precio']

    def __str__(self) -> str:
        precio_val = int(float(str(self.precio)))
        return f"{self.nombre} (${precio_val:,} CLP)"


class Usuario(AbstractUser):
    """
    Modelo de usuario personalizado que extiende el User predeterminado de Django
    para permitir autenticación por Email/Username, definir tipo de cuenta y
    soportar relaciones jerárquicas multi-asiento.
    """
    cuentas_hijas: Any

    TIPO_INDIVIDUAL = 'INDIVIDUAL'
    TIPO_CORPORATIVO = 'CORPORATIVO'
    
    TIPO_USUARIO_CHOICES = [
        (TIPO_INDIVIDUAL, 'Individual'),
        (TIPO_CORPORATIVO, 'Multi-asiento Corporativo'),
    ]
    
    tipo_usuario = models.CharField(
        max_length=20,
        choices=TIPO_USUARIO_CHOICES,
        default=TIPO_INDIVIDUAL,
        verbose_name="Tipo de Usuario",
        help_text="Clasificación del tipo de cuenta para control de asientos corporativos."
    )
    
    cuenta_padre = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cuentas_hijas',
        verbose_name="Cuenta Padre",
        help_text="Usuario administrador principal (Consultora) al que está asociado este asiento de usuario."
    )
    foto_perfil = models.FileField(
        upload_to='fotos_perfil/',
        null=True,
        blank=True,
        verbose_name="Foto de Perfil"
    )

    class Meta(AbstractUser.Meta):
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        indexes = [
            models.Index(fields=['tipo_usuario']),
        ]

    def __str__(self) -> str:
        tipo_str = getattr(self, 'get_tipo_usuario_display')()
        return f"{self.username} ({tipo_str})"

    def clean(self) -> None:
        super().clean()
        if self.cuenta_padre:
            # 1. No se puede ser padre de sí mismo
            if self.cuenta_padre == self:
                raise ValidationError(
                    {"cuenta_padre": "Un usuario no puede ser su propia cuenta padre."}
                )
            
            # 2. Impedir jerarquías multinivel (evitar que un hijo sea a su vez padre de otro)
            if self.cuenta_padre.cuenta_padre is not None:
                raise ValidationError(
                    {"cuenta_padre": "La cuenta padre seleccionada no puede ser una cuenta hija de otro usuario."}
                )
            
            # 3. Validar límite máximo de 4 cuentas hijas (5 asientos en total con el padre)
            hijos_actuales = self.cuenta_padre.cuentas_hijas.exclude(pk=self.pk).count()
            if hijos_actuales >= 4:
                raise ValidationError(
                    {"cuenta_padre": "La cuenta padre seleccionada ya ha alcanzado el límite máximo de 4 asientos asociados (cuentas hijas)."}
                )

            # 4. Validar que el padre sea del tipo corporativo
            if self.cuenta_padre.tipo_usuario != self.TIPO_CORPORATIVO:
                raise ValidationError(
                    {"cuenta_padre": "La cuenta padre debe ser de tipo 'Multi-asiento Corporativo' para asociar asientos."}
                )

    def save(self, *args, **kwargs) -> None:
        self.clean()
        super().save(*args, **kwargs)


class Suscripcion(models.Model):
    """
    Registra el estado, vigencia y plan de suscripción de cada usuario en la plataforma.
    """
    ESTADO_ACTIVA = 'ACTIVA'
    ESTADO_CANCELADA = 'CANCELADA'
    ESTADO_IMPAGA = 'IMPAGA'
    
    ESTADO_CHOICES = [
        (ESTADO_ACTIVA, 'Activa'),
        (ESTADO_CANCELADA, 'Cancelada'),
        (ESTADO_IMPAGA, 'Impaga'),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='suscripciones',
        verbose_name="Usuario"
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name='suscripciones',
        verbose_name="Plan"
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_ACTIVA,
        verbose_name="Estado"
    )
    fecha_inicio = models.DateTimeField(
        verbose_name="Fecha de Inicio"
    )
    fecha_vencimiento = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de Vencimiento"
    )

    class Meta:
        verbose_name = "Suscripción"
        verbose_name_plural = "Suscripciones"
        indexes = [
            models.Index(fields=['estado']),
            models.Index(fields=['usuario', 'estado']),
        ]

    def __str__(self) -> str:
        return f"{self.usuario.username} - {self.plan.nombre} ({self.estado})"


class ContadorDescargas(models.Model):
    """
    Controla el límite de descargas semanales de cada usuario de forma acumulada.
    """
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='contador_descargas',
        verbose_name="Usuario"
    )
    descargas_semanales = models.PositiveIntegerField(
        default=0,
        verbose_name="Descargas Semanales"
    )
    fecha_ultima_descarga = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de Última Descarga"
    )

    class Meta:
        verbose_name = "Contador de Descargas"
        verbose_name_plural = "Contadores de Descargas"
        indexes = [
            models.Index(fields=['descargas_semanales']),
        ]

    def __str__(self) -> str:
        return f"{self.usuario.username}: {self.descargas_semanales} descargas esta semana"


class PlantillaMaestra(models.Model):
    """
    Formatos base oficiales subidos por los administradores de la plataforma.
    """
    TIPO_XLSX = 'XLSX'
    TIPO_DOCX = 'DOCX'
    TIPO_PDF = 'PDF'
    
    TIPO_ARCHIVO_CHOICES = [
        (TIPO_XLSX, 'Microsoft Excel (XLSX)'),
        (TIPO_DOCX, 'Microsoft Word (DOCX)'),
        (TIPO_PDF, 'Adobe PDF (PDF)'),
    ]

    nombre = models.CharField(
        max_length=255, 
        verbose_name="Nombre de la Plantilla"
    )
    tipo_archivo = models.CharField(
        max_length=10,
        choices=TIPO_ARCHIVO_CHOICES,
        verbose_name="Tipo de Archivo"
    )
    archivo_fuente = models.FileField(
        upload_to='plantillas_maestras/',
        verbose_name="Archivo Fuente",
        help_text="Archivo oficial cargado al servidor."
    )
    fecha_ultima_actualizacion = models.DateTimeField(
        auto_now=True,
        verbose_name="Fecha de Última Actualización"
    )

    class Meta:
        verbose_name = "Plantilla Maestra"
        verbose_name_plural = "Plantillas Maestras"
        ordering = ['-fecha_ultima_actualizacion']

    def __str__(self) -> str:
        return f"{self.nombre} ({self.tipo_archivo})"


class DocumentoUsuario(models.Model):
    """
    Copias de documentos que los clientes guardan en la nube y editan de forma dinámica.
    """
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='documentos',
        verbose_name="Usuario"
    )
    plantilla_maestra = models.ForeignKey(
        PlantillaMaestra,
        on_delete=models.CASCADE,
        related_name='documentos_usuarios',
        verbose_name="Plantilla Maestra"
    )
    datos_guardados = models.JSONField(
        verbose_name="Datos Guardados",
        help_text="Valores del formulario del cliente serializados en formato JSON."
    )
    fecha_ultimo_guardado = models.DateTimeField(
        auto_now=True,
        verbose_name="Fecha de Último Guardado"
    )

    class Meta:
        verbose_name = "Documento de Usuario"
        verbose_name_plural = "Documentos de Usuario"
        indexes = [
            models.Index(fields=['usuario', 'plantilla_maestra']),
            models.Index(fields=['fecha_ultimo_guardado']),
        ]

    def __str__(self) -> str:
        fecha_obj: Any = self.fecha_ultimo_guardado
        fecha_str = fecha_obj.strftime('%d/%m/%Y %H:%M') if hasattr(fecha_obj, 'strftime') else str(fecha_obj)
        return f"{self.plantilla_maestra.nombre} - {self.usuario.username} (Guardado: {fecha_str})"

    @property
    def esta_desactualizado(self) -> bool:
        """
        Determina si la plantilla maestra base fue actualizada por un administrador
        en una fecha posterior a la última edición del documento por parte del cliente.
        """
        return self.plantilla_maestra.fecha_ultima_actualizacion > self.fecha_ultimo_guardado


class Noticia(models.Model):
    """
    Modelo para gestionar artículos de noticias y actualizaciones normativas.
    """
    CATEGORIA_REGULACION = 'REGULACION'
    CATEGORIA_INNOVACION = 'INNOVACION'
    CATEGORIA_NOTICIA = 'NOTICIA'
    CATEGORIA_CONSEJO = 'CONSEJO'
    
    CATEGORIA_CHOICES = [
        (CATEGORIA_REGULACION, 'Regulación'),
        (CATEGORIA_INNOVACION, 'Innovación'),
        (CATEGORIA_NOTICIA, 'Noticia'),
        (CATEGORIA_CONSEJO, 'Consejo'),
    ]
    
    ESTADO_BORRADOR = 'BORRADOR'
    ESTADO_PUBLICADO = 'PUBLICADO'
    
    ESTADO_CHOICES = [
        (ESTADO_BORRADOR, 'Borrador'),
        (ESTADO_PUBLICADO, 'Publicado'),
    ]

    titulo = models.CharField(max_length=255, verbose_name="Título")
    subtitulo = models.CharField(max_length=255, blank=True, verbose_name="Subtítulo")
    contenido = models.TextField(verbose_name="Contenido")
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, default=CATEGORIA_NOTICIA, verbose_name="Categoría")
    imagen_url = models.CharField(max_length=500, blank=True, verbose_name="URL de la Imagen")
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='noticias', verbose_name="Autor")
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default=ESTADO_BORRADOR, verbose_name="Estado")
    fecha_publicacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Publicación")

    class Meta:
        verbose_name = "Noticia"
        verbose_name_plural = "Noticias"
        ordering = ['-fecha_publicacion']

    def __str__(self) -> str:
        return self.titulo


class MensajeContacto(models.Model):
    """
    Modelo para registrar las consultas de soporte o asesoría enviadas por los usuarios.
    """
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mensajes_contacto',
        verbose_name="Usuario"
    )
    nombre = models.CharField(max_length=100, verbose_name="Nombre")
    email = models.EmailField(verbose_name="Correo Electrónico")
    asunto = models.CharField(max_length=200, verbose_name="Asunto")
    mensaje = models.TextField(verbose_name="Mensaje")
    leido = models.BooleanField(default=False, verbose_name="Leído")
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Envío")

    class Meta:
        verbose_name = "Mensaje de Contacto"
        verbose_name_plural = "Mensajes de Contacto"
        ordering = ['-fecha_creacion']

    def __str__(self) -> str:
        fecha_obj: Any = self.fecha_creacion
        fecha_str = fecha_obj.strftime('%d/%m/%Y') if hasattr(fecha_obj, 'strftime') else str(fecha_obj)
        return f"{self.asunto} - {self.nombre} ({fecha_str})"


class Servicio(models.Model):
    """
    Modelo que define los servicios preventivos disponibles.
    """
    nombre = models.CharField(max_length=150, unique=True, verbose_name="Nombre del Servicio")
    descripcion = models.TextField(verbose_name="Descripción")
    icono = models.CharField(
        max_length=50, 
        default="shield", 
        verbose_name="Icono Lucide", 
        help_text="Nombre de icono a usar en Next.js (ej. shield, book, user, file-text)"
    )
    activo = models.BooleanField(default=True, verbose_name="Activo")

    class Meta:
        verbose_name = "Servicio"
        verbose_name_plural = "Servicios"
        ordering = ['nombre']

    def __str__(self) -> str:
        return self.nombre


class ReporteRiesgo(models.Model):
    """
    Bitácora de hallazgos (Actos o Condiciones Subestándar) e Inspecciones en Terreno.
    Estructurado bajo normativa chilena (DS 594, Ley 16.744, DS 76, Protocolos MINSAL).
    """
    TIPO_ACTO = 'ACTO'
    TIPO_CONDICION = 'CONDICION'
    TIPO_CHOICES = [
        (TIPO_ACTO, 'Acto Inseguro / Subestándar'),
        (TIPO_CONDICION, 'Condición Insegura / Subestándar'),
    ]

    GRAVEDAD_BAJA = 'BAJO'
    GRAVEDAD_MEDIA = 'MEDIO'
    GRAVEDAD_ALTA = 'ALTO'
    GRAVEDAD_CRITICA = 'CRITICO'
    GRAVEDAD_CHOICES = [
        (GRAVEDAD_BAJA, 'Bajo (Riesgo Leve)'),
        (GRAVEDAD_MEDIA, 'Medio (Riesgo Moderado)'),
        (GRAVEDAD_ALTA, 'Alto (Riesgo Importante)'),
        (GRAVEDAD_CRITICA, 'Crítico (Intolerable / Detención Inmediata)'),
    ]

    ESTADO_ABIERTO = 'ABIERTO'
    ESTADO_PROCESO = 'EN_PROCESO'
    ESTADO_RESUELTO = 'RESUELTO'
    ESTADO_CHOICES = [
        (ESTADO_ABIERTO, 'Abierto'),
        (ESTADO_PROCESO, 'En Proceso'),
        (ESTADO_RESUELTO, 'Resuelto / Subsanado'),
    ]

    # Clasificación legal de peligros (DS 594 y Protocolos MINSAL)
    PELIGRO_FISICO = 'FISICO'
    PELIGRO_QUIMICO = 'QUIMICO'
    PELIGRO_BIOLOGICO = 'BIOLOGICO'
    PELIGRO_ERGONOMICO = 'ERGONOMICO'
    PELIGRO_PSICOSOCIAL = 'PSICOSOCIAL'
    PELIGRO_SEGURIDAD = 'SEGURIDAD'
    PELIGRO_CHOICES = [
        (PELIGRO_FISICO, 'Riesgo Físico (Ruido - PREXOR, Radiación UV Art. 109, Vibraciones, Iluminación)'),
        (PELIGRO_QUIMICO, 'Riesgo Químico (Sílice - PLANESI, Solventes, Polvos, Vapores)'),
        (PELIGRO_BIOLOGICO, 'Riesgo Biológico (Agentes Biológicos, Hantavirus, Virus, Bacterias)'),
        (PELIGRO_ERGONOMICO, 'Riesgo Ergonómico (TMERT DS 594, Manejo Manual de Carga Ley 20.001)'),
        (PELIGRO_PSICOSOCIAL, 'Riesgo Psicosocial (SUSESO/ISTAS 21 - CEAL-SM)'),
        (PELIGRO_SEGURIDAD, 'Riesgo de Seguridad / Mecánico (Caídas altura DS 76, Atrapamiento, Eléctrico)'),
    ]

    # Jerarquía de Control Legal (ISO 45001 / DS 76)
    CONTROL_ELIMINACION = 'ELIMINACION'
    CONTROL_SUSTITUCION = 'SUSTITUCION'
    CONTROL_INGENIERIA = 'INGENIERIA'
    CONTROL_ADMINISTRATIVO = 'ADMINISTRATIVO'
    CONTROL_EPP = 'EPP'
    CONTROL_CHOICES = [
        (CONTROL_ELIMINACION, '1. Eliminación del Peligro'),
        (CONTROL_SUSTITUCION, '2. Sustitución'),
        (CONTROL_INGENIERIA, '3. Control de Ingeniería'),
        (CONTROL_ADMINISTRATIVO, '4. Control Administrativo / Procedimientos / Señalética'),
        (CONTROL_EPP, '5. Elementos de Protección Personal (EPP)'),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reportes_riesgo',
        verbose_name="Prevencionista"
    )
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default=TIPO_CONDICION,
        verbose_name="Clasificación"
    )
    descripcion = models.TextField(verbose_name="Descripción del Hallazgo")
    lugar = models.CharField(max_length=255, verbose_name="Ubicación Física")
    
    # Nuevos campos de contexto y tipificación legal chilena
    empresa_faena = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="Empresa / Faena / Centro de Trabajo"
    )
    area_puesto = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="Área o Puesto de Trabajo"
    )
    clasificacion_peligro = models.CharField(
        max_length=30,
        choices=PELIGRO_CHOICES,
        default=PELIGRO_SEGURIDAD,
        verbose_name="Tipificación Normativa del Peligro (MINSAL / DS 594)"
    )
    norma_infringida = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Norma Legal Infringida (DS 594, DS 40, etc.)"
    )
    
    # Matriz cuantitativa de evaluación de riesgo (Probabilidad x Consecuencia/Severidad)
    probabilidad = models.PositiveSmallIntegerField(
        default=2,
        verbose_name="Probabilidad (1: Baja, 2: Media, 3: Alta)"
    )
    severidad = models.PositiveSmallIntegerField(
        default=2,
        verbose_name="Severidad / Consecuencia (1: Leve, 2: Grave, 3: Crítica)"
    )
    nivel_riesgo_calculado = models.CharField(
        max_length=20,
        default="MEDIO",
        verbose_name="Nivel de Riesgo Evaluado (P x S)"
    )

    gravedad = models.CharField(
        max_length=10,
        choices=GRAVEDAD_CHOICES,
        default=GRAVEDAD_MEDIA,
        verbose_name="Gravedad Estimada"
    )
    estado = models.CharField(
        max_length=15,
        choices=ESTADO_CHOICES,
        default=ESTADO_ABIERTO,
        verbose_name="Estado"
    )
    
    # Medida correctiva con Jerarquía de Control Legal
    jerarquia_control = models.CharField(
        max_length=30,
        choices=CONTROL_CHOICES,
        default=CONTROL_ADMINISTRATIVO,
        verbose_name="Jerarquía de Control Legal (ISO 45001 / DS 76)"
    )
    medida_correctiva = models.TextField(
        blank=True,
        null=True,
        verbose_name="Medida Correctiva / Resolución"
    )
    responsable = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="Responsable en la Empresa / Faena (Art. 66 Ley 16.744)"
    )
    fecha_limite = models.DateField(
        null=True,
        blank=True,
        verbose_name="Plazo Límite de Subsanación"
    )
    foto_evidencia = models.TextField(
        blank=True,
        default="",
        verbose_name="Evidencia Fotográfica (Base64 o URL)"
    )
    fecha_resolucion = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de Resolución / Cierre"
    )

    # Campos para reportes recibidos desde el portal público de trabajadores (QR)
    reportado_por_externo = models.BooleanField(
        default=False,
        verbose_name="Reportado por Trabajador (Externo)",
        help_text="Indica si este reporte fue enviado desde el portal público de participación mediante código QR."
    )
    nombre_reportante = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        verbose_name="Nombre del Reportante"
    )
    rut_reportante = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        verbose_name="RUT del Reportante"
    )
    contacto_reportante = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        verbose_name="Contacto del Reportante (Email/Teléfono)"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Reporte"
    )

    class Meta:
        verbose_name = "Inspección y Hallazgo"
        verbose_name_plural = "Inspecciones y Hallazgos en Terreno"
        ordering = ['-fecha_creacion']

    def __str__(self) -> str:
        origen = " [Trabajador QR]" if self.reportado_por_externo else ""
        return f"{self.tipo} ({self.gravedad}) - {self.lugar} [{self.estado}]{origen}"


class PlantillaInspeccion(models.Model):
    """
    Estructura de las listas de verificación (checklists) de inspección predefinidas.
    """
    nombre = models.CharField(max_length=150, unique=True, verbose_name="Nombre de Inspección")
    descripcion = models.TextField(blank=True, verbose_name="Descripción")
    preguntas = models.JSONField(
        verbose_name="Preguntas de la Plantilla",
        help_text="Lista de textos para evaluar (ej. ['¿El manómetro indica presión correcta?', '¿Tiene señalización?'])."
    )
    activo = models.BooleanField(default=True, verbose_name="Activo")

    class Meta:
        verbose_name = "Plantilla de Inspección"
        verbose_name_plural = "Plantillas de Inspección"
        ordering = ['nombre']

    def __str__(self) -> str:
        return self.nombre


class Inspeccion(models.Model):
    """
    Registros de las inspecciones ejecutadas por el prevencionista de riesgos.
    """
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='inspecciones',
        verbose_name="Inspector (Prevencionista)"
    )
    plantilla = models.ForeignKey(
        PlantillaInspeccion,
        on_delete=models.PROTECT,
        related_name='inspecciones_realizadas',
        verbose_name="Plantilla de Inspección"
    )
    fecha = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Ejecución"
    )
    respuestas = models.JSONField(
        verbose_name="Respuestas del Checklist",
        help_text="Respuestas en formato JSON conteniendo: [{'pregunta': 'Texto', 'estado': 'SI|NO|NA', 'observacion': 'Detalle'}]."
    )
    porcentaje_cumplimiento = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        verbose_name="Porcentaje de Cumplimiento"
    )
    firma_nombre = models.CharField(max_length=150, verbose_name="Nombre del Firma")
    firma_rut = models.CharField(max_length=15, verbose_name="RUT de Firma")

    class Meta:
        verbose_name = "Inspección Ejecutada"
        verbose_name_plural = "Inspecciones Ejecutadas"
        ordering = ['-fecha']

    def __str__(self) -> str:
        fecha_obj: Any = self.fecha
        fecha_str = fecha_obj.strftime('%d/%m/%Y') if hasattr(fecha_obj, 'strftime') else str(fecha_obj)
        return f"{self.plantilla.nombre} - {self.usuario.username} ({fecha_str} - {self.porcentaje_cumplimiento}%)"


class InvestigacionAccidente(models.Model):
    """
    Modelo para registrar la investigación detallada de un accidente o incidente de trabajo.
    """
    TIPO_TRABAJO = 'TRABAJO'
    TIPO_TRAYECTO = 'TRAYECTO'
    TIPO_INCIDENTE = 'INCIDENTE'

    TIPO_EVENTO_CHOICES = [
        (TIPO_TRABAJO, 'Accidente del Trabajo'),
        (TIPO_TRAYECTO, 'Accidente de Trayecto'),
        (TIPO_INCIDENTE, 'Incidente / Casi Accidente'),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='investigaciones_accidentes',
        verbose_name="Prevencionista Investigador"
    )
    
    # Datos del Afectado
    nombre_afectado = models.CharField(max_length=150, verbose_name="Nombre Completo del Afectado")
    rut_afectado = models.CharField(max_length=15, verbose_name="RUT del Afectado")
    cargo_afectado = models.CharField(max_length=100, verbose_name="Cargo / Puesto de Trabajo")
    edad_afectado = models.PositiveIntegerField(verbose_name="Edad del Afectado")
    antiguedad_afectado = models.CharField(max_length=50, verbose_name="Antigüedad en la Empresa")

    # Datos del Evento
    tipo_evento = models.CharField(
        max_length=20,
        choices=TIPO_EVENTO_CHOICES,
        default=TIPO_TRABAJO,
        verbose_name="Tipo de Evento"
    )
    fecha_hora_evento = models.DateTimeField(verbose_name="Fecha y Hora del Evento")
    lugar_evento = models.CharField(max_length=255, verbose_name="Ubicación Física / Lugar del Suceso")
    descripcion_evento = models.TextField(verbose_name="Descripción Cronológica del Accidente/Incidente")

    # Evaluación Inicial de Lesiones
    tipo_lesion = models.CharField(max_length=100, verbose_name="Tipo de Lesión")
    parte_cuerpo_afectada = models.CharField(max_length=100, verbose_name="Parte del Cuerpo Afectada")

    # Análisis de Causas
    causas_inmediatas = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Causas Inmediatas (Actos y Condiciones)",
        help_text="JSON conteniendo los actos y condiciones subestándar identificados."
    )
    causas_basicas = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Causas Básicas (Factores Personales y del Trabajo)",
        help_text="JSON conteniendo los factores personales y del trabajo identificados."
    )
    analisis_5_porques = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Análisis de los 5 Porqués",
        help_text="Lista de textos para la secuencia de los 5 porqués hasta la causa raíz."
    )

    # Plan de Acción
    plan_accion = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Plan de Acción Correctiva",
        help_text="Lista de objetos: [{'medida': '...', 'responsable': '...', 'fecha_limite': 'AAAA-MM-DD', 'estado': 'PENDIENTE|REALIZADO'}]."
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Registro")

    class Meta:
        verbose_name = "Investigación de Accidente"
        verbose_name_plural = "Investigaciones de Accidentes"
        ordering = ['-fecha_hora_evento']

    def __str__(self) -> str:
        fecha_obj: Any = self.fecha_hora_evento
        fecha_str = fecha_obj.strftime('%d/%m/%Y') if hasattr(fecha_obj, 'strftime') else str(fecha_obj)
        tipo_str = getattr(self, 'get_tipo_evento_display')()
        return f"{tipo_str} - {self.nombre_afectado} ({fecha_str})"


class TemaCapacitacion(models.Model):
    """
    Define los temas y contenidos base para las capacitaciones de prevención.
    """
    CATEGORIA_CHARLA = 'CHARLA_5_MIN'
    CATEGORIA_ODI = 'INDUCCION_ODI'
    CATEGORIA_TEORICO = 'CURSO_TEORICO'
    CATEGORIA_PRACTICO = 'CURSO_PRACTICO'

    CATEGORIA_CHOICES = [
        (CATEGORIA_CHARLA, 'Charla de 5 Minutos'),
        (CATEGORIA_ODI, 'Inducción de Obligación de Informar (ODI/DAS)'),
        (CATEGORIA_TEORICO, 'Capacitación Teórica'),
        (CATEGORIA_PRACTICO, 'Capacitación Práctica / Simulacro'),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='temas_capacitacion',
        verbose_name="Prevencionista Creador"
    )
    titulo = models.CharField(max_length=200, verbose_name="Título de la Capacitación")
    descripcion = models.TextField(verbose_name="Descripción o Resumen del Contenido")
    categoria = models.CharField(
        max_length=30,
        choices=CATEGORIA_CHOICES,
        default=CATEGORIA_CHARLA,
        verbose_name="Categoría de Capacitación"
    )
    duracion_minutos = models.PositiveIntegerField(default=5, verbose_name="Duración Estimada (Minutos)")
    contenido_clave = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Puntos Clave del Contenido",
        help_text="Lista de puntos esenciales a tratar durante la charla."
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Creación")

    class Meta:
        verbose_name = "Tema de Capacitación"
        verbose_name_plural = "Temas de Capacitaciones"
        ordering = ['titulo']

    def __str__(self) -> str:
        cat_str = getattr(self, 'get_categoria_display')()
        return f"{self.titulo} ({cat_str})"


class RegistroCapacitacion(models.Model):
    """
    Registra las capacitaciones planificadas y realizadas con su respectiva asistencia de firmas.
    """
    ESTADO_PROGRAMADA = 'PROGRAMADA'
    ESTADO_REALIZADA = 'REALIZADA'
    ESTADO_CANCELADA = 'CANCELADA'

    ESTADO_CHOICES = [
        (ESTADO_PROGRAMADA, 'Programada'),
        (ESTADO_REALIZADA, 'Realizada'),
        (ESTADO_CANCELADA, 'Cancelada'),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='capacitaciones_registradas',
        verbose_name="Prevencionista Relator"
    )
    tema = models.ForeignKey(
        TemaCapacitacion,
        on_delete=models.PROTECT,
        related_name='sesiones_ejecutadas',
        verbose_name="Tema a Impartir"
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_PROGRAMADA,
        verbose_name="Estado de la Sesión"
    )
    fecha_programada = models.DateField(verbose_name="Fecha Programada")
    fecha_realizacion = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha y Hora de Realización"
    )
    lugar = models.CharField(max_length=255, verbose_name="Ubicación Física / Lugar")
    asistentes = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Listado de Asistentes y Firmas",
        help_text="Lista de objetos: [{'nombre': '...', 'rut': '...', 'firma': '...'}]"
    )
    observaciones = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observaciones / Comentarios"
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Registro")

    class Meta:
        verbose_name = "Registro de Capacitación"
        verbose_name_plural = "Registros de Capacitaciones"
        ordering = ['-fecha_programada']

    def __str__(self) -> str:
        return f"{self.tema.titulo} - {self.fecha_programada} [{self.estado}]"


class SugerenciaConsulta(models.Model):
    """
    Buzón digital de sugerencias y consultas enviadas por los trabajadores
    desde el portal público de participación (código QR), sin necesidad de cuenta.
    El prevencionista receptor puede leerlas y registrar una respuesta o acción tomada.
    """
    TIPO_SUGERENCIA = 'SUGERENCIA'
    TIPO_CONSULTA = 'CONSULTA'

    TIPO_CHOICES = [
        (TIPO_SUGERENCIA, 'Sugerencia Preventiva'),
        (TIPO_CONSULTA, 'Consulta de Seguridad'),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sugerencias_consultas',
        verbose_name="Prevencionista Receptor"
    )
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default=TIPO_SUGERENCIA,
        verbose_name="Tipo de Mensaje"
    )
    mensaje = models.TextField(verbose_name="Mensaje del Trabajador")
    anonimo = models.BooleanField(
        default=True,
        verbose_name="Enviado Anónimamente"
    )
    nombre_remitente = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        verbose_name="Nombre del Remitente"
    )
    contacto_remitente = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        verbose_name="Contacto del Remitente (Email/Teléfono)"
    )
    leido = models.BooleanField(
        default=False,
        verbose_name="Leído por el Prevencionista"
    )
    respuesta = models.TextField(
        blank=True,
        null=True,
        verbose_name="Respuesta / Acción Tomada por el Prevencionista"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Envío"
    )
    fecha_respuesta = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Fecha de Respuesta"
    )

    class Meta:
        verbose_name = "Sugerencia / Consulta"
        verbose_name_plural = "Sugerencias y Consultas"
        ordering = ['-fecha_creacion']

    def __str__(self) -> str:
        remitente = self.nombre_remitente if not self.anonimo and self.nombre_remitente else "Anónimo"
        fecha_obj: Any = self.fecha_creacion
        fecha_str = fecha_obj.strftime('%d/%m/%Y') if hasattr(fecha_obj, 'strftime') else str(fecha_obj)
        tipo_str = getattr(self, 'get_tipo_display')()
        return f"{tipo_str} de {remitente} ({fecha_str})"


class Contratista(models.Model):
    """
    Empresa contratista o proveedora que opera bajo la Ley de Subcontratación 20.123.
    """
    documentos: Any
    trabajadores: Any

    TIPO_CONTRATISTA = 'CONTRATISTA'
    TIPO_PROVEEDOR = 'PROVEEDOR'
    TIPO_CHOICES = [
        (TIPO_CONTRATISTA, 'Contratista'),
        (TIPO_PROVEEDOR, 'Proveedor'),
    ]

    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default=TIPO_CONTRATISTA,
        verbose_name="Tipo de Empresa"
    )


    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='contratistas',
        verbose_name="Prevencionista de Riesgos"
    )
    razon_social = models.CharField(max_length=200, verbose_name="Razón Social")
    rut = models.CharField(max_length=15, verbose_name="RUT de la Empresa")
    giro = models.CharField(max_length=200, blank=True, verbose_name="Giro / Actividad Económica")
    nombre_representante = models.CharField(max_length=150, blank=True, verbose_name="Nombre Representante")
    email_contacto = models.EmailField(blank=True, verbose_name="Correo de Contacto")
    telefono_contacto = models.CharField(max_length=50, blank=True, verbose_name="Teléfono de Contacto")
    activo = models.BooleanField(default=True, verbose_name="Activo")
    fecha_ingreso = models.DateField(default=date.today, verbose_name="Fecha de Ingreso")
    observaciones = models.TextField(blank=True, null=True, verbose_name="Observaciones")
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Registro")

    class Meta:
        verbose_name = "Contratista"
        verbose_name_plural = "Contratistas"
        ordering = ['razon_social']
        unique_together = ('usuario', 'rut')

    def __str__(self) -> str:
        return f"{self.razon_social} ({self.rut})"

    @property
    def estado_cumplimiento(self) -> str:
        """
        Determina el estado general de cumplimiento de la contratista basándose en sus documentos.
        """
        docs_mgr: Any = getattr(self, 'documentos', None)
        if docs_mgr is None or not docs_mgr.exists():
            return 'SIN_DOCUMENTOS'
        
        estados = [doc.estado_calculado for doc in docs_mgr.all()]
        if 'VENCIDO' in estados:
            return 'CRITICO'
        if 'POR_VENCER' in estados:
            return 'POR_VENCER'
        return 'AL_DIA'


class DocumentoContratista(models.Model):
    """
    Documentación legal de cumplimiento laboral, previsional y de seguridad para contratistas.
    """
    TIPO_F30 = 'F30'
    TIPO_F30_1 = 'F30_1'
    TIPO_SEGURO = 'SEGURO_ACCIDENTE'
    TIPO_CONTRATO = 'CONTRATO_TRABAJO'
    TIPO_ODI = 'ODI'
    TIPO_REGLAMENTO = 'REGLAMENTO_INTERNO'
    TIPO_OTRO = 'OTRO'

    TIPO_CHOICES = [
        (TIPO_F30, 'Certificado F30 (Antecedentes Laborales/Previsionales)'),
        (TIPO_F30_1, 'Certificado F30-1 (Detalle de Deuda y Cumplimiento)'),
        (TIPO_SEGURO, 'Certificado Seguro Accidentes (Ley 16.744)'),
        (TIPO_CONTRATO, 'Contrato de Trabajo del Personal'),
        (TIPO_ODI, 'Obligación de Informar (ODI / DAS)'),
        (TIPO_REGLAMENTO, 'Reglamento Interno de Higiene y Seguridad'),
        (TIPO_OTRO, 'Otro Documento'),
    ]

    contratista = models.ForeignKey(
        Contratista,
        on_delete=models.CASCADE,
        related_name='documentos',
        verbose_name="Empresa Contratista"
    )
    tipo = models.CharField(
        max_length=30,
        choices=TIPO_CHOICES,
        default=TIPO_F30,
        verbose_name="Tipo de Documento"
    )
    nombre_personalizado = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        verbose_name="Nombre Personalizado (Solo si es 'Otro')"
    )
    fecha_emision = models.DateField(verbose_name="Fecha de Emisión")
    fecha_vencimiento = models.DateField(
        blank=True,
        null=True,
        verbose_name="Fecha de Vencimiento"
    )
    archivo = models.FileField(
        upload_to='documentos_contratistas/',
        blank=True,
        null=True,
        verbose_name="Archivo del Documento (PDF)"
    )
    notas = models.TextField(blank=True, null=True, verbose_name="Notas / Comentarios")
    fecha_carga = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Carga")

    class Meta:
        verbose_name = "Documento de Contratista"
        verbose_name_plural = "Documentos de Contratistas"
        ordering = ['-fecha_carga']

    def __str__(self) -> str:
        tipo_str = getattr(self, 'get_tipo_display')()
        nombre_doc = self.nombre_personalizado if self.tipo == self.TIPO_OTRO and self.nombre_personalizado else tipo_str
        return f"{nombre_doc} - {self.contratista.razon_social}"

    @property
    def estado_calculado(self) -> str:
        """
        Calcula el estado del documento en base a su fecha de vencimiento.
        """
        if not self.fecha_vencimiento:
            return 'SIN_VENCIMIENTO'
        hoy = date.today()
        venc_obj: Any = self.fecha_vencimiento
        delta = (venc_obj - hoy).days
        if delta < 0:
            return 'VENCIDO'
        elif delta <= 30:
            return 'POR_VENCER'
        else:
            return 'VIGENTE'


class TrabajadorSubcontratado(models.Model):
    """
    Nómina plana de trabajadores que pertenecen a una empresa contratista.
    """
    contratista = models.ForeignKey(
        Contratista,
        on_delete=models.CASCADE,
        related_name='trabajadores',
        verbose_name="Empresa Contratista"
    )
    nombre_completo = models.CharField(max_length=150, verbose_name="Nombre Completo")
    rut = models.CharField(max_length=15, verbose_name="RUT")
    cargo = models.CharField(max_length=100, verbose_name="Cargo / Función")
    fecha_ingreso_obra = models.DateField(verbose_name="Fecha de Ingreso a Obra")
    fecha_egreso_obra = models.DateField(
        blank=True,
        null=True,
        verbose_name="Fecha de Egreso de Obra"
    )
    activo = models.BooleanField(default=True, verbose_name="Activo en Faena")

    class Meta:
        verbose_name = "Trabajador Subcontratado"
        verbose_name_plural = "Trabajadores Subcontratados"
        ordering = ['nombre_completo']

    def __str__(self) -> str:
        return f"{self.nombre_completo} ({self.rut}) - {self.contratista.razon_social}"


class SolicitudCapacitacion(models.Model):
    """
    Solicitud de cotización para capacitaciones corporativas y relatorías presenciales o sincrónicas
    impartidas por el equipo de profesionales de HD Prevención (Psicólogos laborales,
    Ergónomos/Kinesiólogos, Prevencionistas de Riesgos con Registro SEREMI/SNS, Instructores).
    """
    TIPO_LEY_KARIN = 'LEY_KARIN'
    TIPO_TMERT = 'TMERT_ERGONOMIA'
    TIPO_SEGURIDAD_CRITICA = 'SEGURIDAD_CRITICA'
    TIPO_EXTINTORES = 'EXTINTORES_EMERGENCIAS'
    TIPO_INDUCCION_ODI = 'INDUCCION_ODI'
    TIPO_CPHS = 'CPHS_DS54'
    TIPO_OTRO = 'A_MEDIDA'

    TIPO_CHOICES = [
        (TIPO_LEY_KARIN, 'Prevención del Acoso y Ley Karin / Protocolo SUSESO-ISTAS 21 (Psicólogo Laboral)'),
        (TIPO_TMERT, 'Ergonomía, TMERT y Manejo Manual de Cargas Ley 20.949 (Kinesiólogo / Ergónomo)'),
        (TIPO_SEGURIDAD_CRITICA, 'Trabajos Críticos: Altura Física, Espacios Confinados, LOTO (Prevencionista Senior)'),
        (TIPO_EXTINTORES, 'Uso y Manejo Práctico de Extintores DS 594 (Instructor en Terreno)'),
        (TIPO_INDUCCION_ODI, 'Inducción de Obligación de Informar ODI / DAS DS 40 (Prevencionista Registro SEREMI)'),
        (TIPO_CPHS, 'Capacitación y Asesoría a Comité Paritario DS 54 (Especialista CPHS)'),
        (TIPO_OTRO, 'Capacitación Técnica Especializada a Medida'),
    ]

    MODALIDAD_PRESENCIAL = 'PRESENCIAL'
    MODALIDAD_ONLINE = 'ONLINE'
    MODALIDAD_MIXTA = 'MIXTA'

    MODALIDAD_CHOICES = [
        (MODALIDAD_PRESENCIAL, 'Presencial en Terreno / Faena / Oficina'),
        (MODALIDAD_ONLINE, 'Sincrónica Online (Videollamada en Vivo)'),
        (MODALIDAD_MIXTA, 'Híbrida / Mixta'),
    ]

    ESTADO_PENDIENTE = 'PENDIENTE'
    ESTADO_CONTACTADO = 'CONTACTADO'
    ESTADO_COTIZADO = 'COTIZADO'
    ESTADO_COORDINADO = 'COORDINADO'
    ESTADO_FINALIZADO = 'FINALIZADO'
    ESTADO_CANCELADO = 'CANCELADO'

    ESTADO_CHOICES = [
        (ESTADO_PENDIENTE, 'Pendiente de Contacto'),
        (ESTADO_CONTACTADO, 'En Contacto con la Empresa'),
        (ESTADO_COTIZADO, 'Cotización Enviada'),
        (ESTADO_COORDINADO, 'Fecha y Relator Coordinados'),
        (ESTADO_FINALIZADO, 'Capacitación Ejecutada'),
        (ESTADO_CANCELADO, 'Cancelada'),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes_capacitacion',
        verbose_name="Usuario Registrado (opcional)"
    )
    empresa = models.CharField(max_length=200, verbose_name="Nombre o Razón Social de la Empresa")
    rut_empresa = models.CharField(max_length=20, verbose_name="RUT de la Empresa")
    contacto_nombre = models.CharField(max_length=150, verbose_name="Nombre del Contacto")
    contacto_cargo = models.CharField(max_length=100, blank=True, null=True, verbose_name="Cargo de Contacto")
    contacto_email = models.EmailField(verbose_name="Correo Electrónico de Contacto")
    contacto_telefono = models.CharField(max_length=50, verbose_name="Teléfono o WhatsApp")
    
    tipo_capacitacion = models.CharField(
        max_length=40,
        choices=TIPO_CHOICES,
        default=TIPO_LEY_KARIN,
        verbose_name="Programa o Especialidad Requerida"
    )
    modalidad = models.CharField(
        max_length=20,
        choices=MODALIDAD_CHOICES,
        default=MODALIDAD_PRESENCIAL,
        verbose_name="Modalidad Deseada"
    )
    region_comuna = models.CharField(
        max_length=150,
        verbose_name="Ubicación de Faena / Ciudad / Comuna",
        help_text="Lugar donde se dictará la capacitación para cálculo de traslados/viáticos."
    )
    cantidad_trabajadores = models.PositiveIntegerField(
        default=10,
        verbose_name="Cantidad Estimada de Trabajadores"
    )
    fecha_tentativa = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha Tentativa Deseada"
    )
    mensaje_adicional = models.TextField(
        blank=True,
        null=True,
        verbose_name="Detalles o Requerimientos Específicos"
    )

    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_PENDIENTE,
        verbose_name="Estado de la Solicitud"
    )
    notas_internas = models.TextField(
        blank=True,
        null=True,
        verbose_name="Notas Internas de HD Prevención"
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Creación")
    fecha_actualizacion = models.DateTimeField(auto_now=True, verbose_name="Última Actualización")

    class Meta:
        verbose_name = "Solicitud de Capacitación Externa"
        verbose_name_plural = "Solicitudes de Capacitaciones Externas"
        ordering = ['-fecha_creacion']

    def __str__(self) -> str:
        return f"{self.empresa} - {self.get_tipo_capacitacion_display()} ({self.estado})"


