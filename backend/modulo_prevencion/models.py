from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.exceptions import ValidationError

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
        return f"{self.nombre} (${int(self.precio):,} CLP)"


class Usuario(AbstractUser):
    """
    Modelo de usuario personalizado que extiende el User predeterminado de Django
    para permitir autenticación por Email/Username, definir tipo de cuenta y
    soportar relaciones jerárquicas multi-asiento.
    """
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

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        indexes = [
            models.Index(fields=['tipo_usuario']),
        ]

    def __str__(self) -> str:
        return f"{self.username} ({self.get_tipo_usuario_display()})"

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
        return f"{self.plantilla_maestra.nombre} - {self.usuario.username} (Guardado: {self.fecha_ultimo_guardado.strftime('%d/%m/%Y %H:%M')})"

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
        return f"{self.asunto} - {self.nombre} ({self.fecha_creacion.strftime('%d/%m/%Y')})"


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

