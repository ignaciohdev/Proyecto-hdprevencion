import uuid
from typing import Any
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.exceptions import ValidationError
from datetime import date, timedelta
from django.utils import timezone


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
    acceso_servicios = models.BooleanField(
        default=False,
        verbose_name="Acceso a Asesorías y Servicios Exclusivos"
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

    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        verbose_name="Identificador Único (UUID)",
        help_text="UUID público seguro para códigos QR y portal de participación."
    )
    
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


def validar_rut_chileno(valor: Any) -> None:
    """
    Validador de formato y dígito verificador para RUT chileno usando Módulo 11.
    Acepta formatos con o sin puntos y con guion (ej. '76.123.456-0', '12345678-5').
    """
    if not valor:
        return

    rut_limpio = str(valor).strip().upper().replace(".", "").replace("-", "").replace(" ", "")
    if len(rut_limpio) < 2:
        raise ValidationError("El RUT ingresado es demasiado corto.")

    cuerpo = rut_limpio[:-1]
    dv = rut_limpio[-1]

    if not cuerpo.isdigit():
        raise ValidationError("El cuerpo del RUT debe contener únicamente dígitos numéricos.")

    multiplicadores = [2, 3, 4, 5, 6, 7]
    suma = sum(int(digito) * multiplicadores[i % 6] for i, digito in enumerate(reversed(cuerpo)))
    resto = 11 - (suma % 11)

    if resto == 11:
        dv_esperado = '0'
    elif resto == 10:
        dv_esperado = 'K'
    else:
        dv_esperado = str(resto)

    if dv != dv_esperado:
        raise ValidationError(f"El dígito verificador '{dv}' no es válido para el RUT ingresado (se esperaba '{dv_esperado}').")


class Empresa(models.Model):
    """
    Entidad fundamental que representa a una empresa cliente asesorada en prevención de riesgos.
    Permite arquitectura multi-tenant donde cada prevencionista gestiona su propia cartera de empresas.
    """
    MUTUALIDAD_ACHS = 'ACHS'
    MUTUALIDAD_MUTUAL = 'MUTUAL'
    MUTUALIDAD_IST = 'IST'
    MUTUALIDAD_ISL = 'ISL'
    MUTUALIDAD_OTRA = 'OTRA'
    MUTUALIDAD_CHOICES = [
        (MUTUALIDAD_ACHS, 'Asociación Chilena de Seguridad (ACHS)'),
        (MUTUALIDAD_MUTUAL, 'Mutual de Seguridad CChC'),
        (MUTUALIDAD_IST, 'Instituto de Seguridad del Trabajo (IST)'),
        (MUTUALIDAD_ISL, 'Instituto de Seguridad Laboral (ISL)'),
        (MUTUALIDAD_OTRA, 'Otra Mutualidad'),
    ]

    prevencionista = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='empresas_asesoradas',
        verbose_name="Prevencionista a Cargo"
    )
    razon_social = models.CharField(
        max_length=200,
        verbose_name="Razón Social"
    )
    nombre_fantasia = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="Nombre de Fantasía"
    )
    rut = models.CharField(
        max_length=15,
        db_index=True,
        validators=[validar_rut_chileno],
        verbose_name="RUT Empresa"
    )
    giro = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Giro o Actividad Económica"
    )
    mutualidad = models.CharField(
        max_length=20,
        choices=MUTUALIDAD_CHOICES,
        default=MUTUALIDAD_ACHS,
        verbose_name="Organismo Administrador Ley 16.744"
    )
    tasa_cotizacion_adicional = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        verbose_name="Tasa Cotización Adicional (%)",
        help_text="Cotización adicional Ley 16.744 según DS 67 o DS 110."
    )
    activo = models.BooleanField(
        default=True,
        verbose_name="Empresa Activa"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Creación"
    )

    class Meta:
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"
        ordering = ['-fecha_creacion']

    def __str__(self) -> str:
        return f"{self.razon_social} ({self.rut})"


class CentroTrabajo(models.Model):
    """
    Representa una faena, sucursal, obra o planta perteneciente a una Empresa.
    Permite segmentar inspecciones, reportes de riesgo y cuadrillas de trabajadores.
    """
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='centros_trabajo',
        verbose_name="Empresa"
    )
    nombre = models.CharField(
        max_length=150,
        verbose_name="Nombre del Centro de Trabajo / Faena"
    )
    direccion = models.CharField(
        max_length=255,
        verbose_name="Dirección Física"
    )
    comuna = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Comuna"
    )
    region = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Región"
    )
    es_casa_matriz = models.BooleanField(
        default=False,
        verbose_name="Es Casa Matriz"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Creación"
    )

    class Meta:
        verbose_name = "Centro de Trabajo"
        verbose_name_plural = "Centros de Trabajo"
        ordering = ['nombre']

    def __str__(self) -> str:
        return f"{self.nombre} - {self.empresa.razon_social}"


class Trabajador(models.Model):
    """
    Ficha de un trabajador perteneciente a una Empresa y opcionalmente a un Centro de Trabajo.
    Mantiene el historial preventivo: capacitaciones firmadas, incidentes y entrega de EPP.
    """
    ESTADO_ACTIVO = 'ACTIVO'
    ESTADO_DESVINCULADO = 'DESVINCULADO'
    ESTADO_LICENCIA = 'LICENCIA'
    ESTADO_CHOICES = [
        (ESTADO_ACTIVO, 'Activo'),
        (ESTADO_DESVINCULADO, 'Desvinculado'),
        (ESTADO_LICENCIA, 'Licencia Médica'),
    ]

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='trabajadores',
        verbose_name="Empresa"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trabajadores',
        verbose_name="Centro de Trabajo / Faena Asignada"
    )
    rut = models.CharField(
        max_length=15,
        db_index=True,
        validators=[validar_rut_chileno],
        verbose_name="RUT Trabajador"
    )
    nombres = models.CharField(
        max_length=100,
        verbose_name="Nombres"
    )
    apellidos = models.CharField(
        max_length=100,
        verbose_name="Apellidos"
    )
    cargo = models.CharField(
        max_length=100,
        verbose_name="Cargo u Ocupación"
    )
    correo = models.EmailField(
        blank=True,
        null=True,
        verbose_name="Correo Electrónico"
    )
    telefono = models.CharField(
        max_length=30,
        blank=True,
        default="",
        verbose_name="Teléfono de Contacto"
    )
    fecha_ingreso = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de Ingreso a la Empresa"
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_ACTIVO,
        verbose_name="Estado Laboral"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Creación"
    )

    class Meta:
        unique_together = [['empresa', 'rut']]
        verbose_name = "Trabajador"
        verbose_name_plural = "Trabajadores"
        ordering = ['apellidos', 'nombres']

    def __str__(self) -> str:
        return f"{self.nombres} {self.apellidos} ({self.rut})"

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}".strip()


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

    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        verbose_name="Identificador Único (UUID)",
        help_text="UUID público seguro para reportes de condiciones y actos inseguros."
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reportes_riesgo',
        verbose_name="Prevencionista"
    )
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reportes_riesgo',
        verbose_name="Empresa"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reportes_riesgo',
        verbose_name="Centro de Trabajo / Faena"
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
        verbose_name="Norma Legal Infringida (D.S. N° 44, D.S. N° 594, D.S. N° 76, Ley Karin, etc.)"
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
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspecciones',
        verbose_name="Empresa"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspecciones',
        verbose_name="Centro de Trabajo / Faena"
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

    TIPO_ACCIDENTE_GRAVE_CHOICES = [
        ('CAIDA_ALTURA', 'Caída de distinto nivel (sobre 1.8 metros)'),
        ('AMPUTACION', 'Amputación o pérdida traumática de parte del cuerpo'),
        ('ATRAPAMIENTO_ASFIXIA', 'Atrapamiento, asfixia o inmersión'),
        ('MANIOBRAS_REANIMACION', 'Accidente que requirió maniobras de RCP / Resucitación'),
        ('MANIOBRAS_RESCATE', 'Accidente que obliga a maniobras de rescate'),
        ('CONDICIONES_HIPERBARICAS', 'Accidente en faenas bajo condiciones hiperbáricas'),
        ('COLECTIVO_MASIVO', 'Accidente que afecta de manera colectiva y masiva la faena'),
        ('FALLECIMIENTO', 'Accidente con consecuencia fatal inmediata'),
        ('OTRO_GRAVE', 'Otro evento de gravedad crítica con compromiso vital'),
    ]

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
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accidentes',
        verbose_name="Empresa"
    )
    trabajador = models.ForeignKey(
        Trabajador,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accidentes_sufridos',
        verbose_name="Trabajador Afectado"
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

    # Tramitación Legal DIAT / DIEP (Plazo legal 24 horas - D.S. 44 / Ley 16.744)
    diat_presentada = models.BooleanField(
        default=False,
        verbose_name="DIAT Formalizada ante Mutualidad"
    )
    diat_folio = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="Folio DIAT Mutual"
    )
    diat_fecha_presentacion = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha Presentación DIAT"
    )
    plazo_limite_diat_24h = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Plazo Límite DIAT (24h)",
        help_text="24 horas desde la ocurrencia del evento"
    )

    # Protocolo de Accidente Grave o Fatal (Art. 76 Ley 16.744 / Circular 3336 SUSESO)
    es_grave_o_fatal = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="¿Es Accidente Grave o Fatal?"
    )
    tipo_accidente_grave = models.CharField(
        max_length=30,
        choices=TIPO_ACCIDENTE_GRAVE_CHOICES,
        blank=True,
        null=True,
        verbose_name="Tipo de Accidente Grave"
    )
    faena_suspendida = models.BooleanField(
        default=False,
        verbose_name="Auto-suspensión de Faenas",
        help_text="Auto-suspensión inmediata obligatoria de faenas por el empleador"
    )
    aviso_autoridades_realizado = models.BooleanField(
        default=False,
        verbose_name="Aviso a Autoridades",
        help_text="Aviso inmediato a Inspección del Trabajo y Seremi de Salud"
    )
    aviso_autoridades_folio = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="Folio Notificación Autoridades"
    )
    aviso_autoridades_fecha = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha Notificación Autoridades"
    )

    # Metodología de Árbol de Causas y Flujo RALF / SUSESO (eDoc 143)
    arbol_de_causas = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Árbol de Causas",
        help_text="Estructura de hechos y causas según metodología del Árbol de Causas exigida por SUSESO para eDoc 143"
    )
    plazo_investigacion_suseso_30d = models.DateField(
        null=True,
        blank=True,
        verbose_name="Plazo Investigación SUSESO (30 Días)",
        help_text="Plazo legal de 30 días corridos para remitir investigación eDoc 143 a la mutualidad"
    )
    reanudacion_autorizada = models.BooleanField(
        default=False,
        verbose_name="Reanudación de Faenas Autorizada",
        help_text="Autorización formal de levantamiento de suspensión de faenas por DT o Seremi"
    )
    resolucion_reanudacion_dt_seremi = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Resolución de Reanudación DT / Seremi"
    )

    # Control de Días Perdidos y Licencias
    dias_perdidos = models.PositiveIntegerField(
        default=0,
        verbose_name="Días Perdidos",
        help_text="Días de reposo/licencia médica laboral"
    )
    alta_medica = models.BooleanField(
        default=False,
        verbose_name="Alta Médica Emitida"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Registro")

    @property
    def horas_restantes_diat(self) -> float:
        """Tiempo restante en horas para cumplir con el plazo legal de 24h para presentar la DIAT."""
        if not self.plazo_limite_diat_24h:
            return 0.0
        diff = (self.plazo_limite_diat_24h - timezone.now()).total_seconds() / 3600.0
        return round(diff, 1)

    @property
    def diat_vencida(self) -> bool:
        """True si han pasado >24 horas de la ocurrencia del evento y diat_presentada sigue en False."""
        if self.diat_presentada:
            return False
        if not self.plazo_limite_diat_24h:
            if self.fecha_hora_evento:
                return timezone.now() > (self.fecha_hora_evento + timedelta(hours=24))
            return False
        return timezone.now() > self.plazo_limite_diat_24h

    @property
    def semaforo_diat(self) -> str:
        """
        Retorna el estado del semáforo legal para la tramitación de la DIAT:
        - 'PRESENTADA': Formalizada ante la mutualidad (verde)
        - 'VENCIDA': Superó las 24 horas sin formalizar (rojo)
        - 'EN_PLAZO': En plazo legal con horas restantes (amarillo)
        """
        if self.diat_presentada:
            return 'PRESENTADA'
        if self.diat_vencida:
            return 'VENCIDA'
        return 'EN_PLAZO'

    def save(self, *args, **kwargs):
        if self.fecha_hora_evento and not self.plazo_limite_diat_24h:
            self.plazo_limite_diat_24h = self.fecha_hora_evento + timedelta(hours=24)
        super().save(*args, **kwargs)

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
    CATEGORIA_CURSO_8H_GENERO = 'CURSO_8H_GENERO'
    CATEGORIA_CURSO_20H_CPHS = 'CURSO_20H_CPHS'
    CATEGORIA_CURSO_1H_EPP = 'CURSO_1H_EPP'

    CATEGORIA_CHOICES = [
        (CATEGORIA_CHARLA, 'Charla de 5 Minutos'),
        (CATEGORIA_ODI, 'Información de los riesgos laborales (ODI Art. 15 D.S. N° 44)'),
        (CATEGORIA_TEORICO, 'Capacitación Teórica'),
        (CATEGORIA_PRACTICO, 'Capacitación Práctica / Simulacro'),
        (CATEGORIA_CURSO_8H_GENERO, 'Curso Bienal 8h con Enfoque de Género (Art. 16 D.S. N° 44)'),
        (CATEGORIA_CURSO_20H_CPHS, 'Curso 20h CPHS (Mutualidad / D.S. N° 44)'),
        (CATEGORIA_CURSO_1H_EPP, 'Capacitación Obligatoria EPP 1h (D.S. N° 44)'),
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

    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        verbose_name="Identificador Único (UUID)",
        help_text="UUID público seguro para firma de charlas vía código QR."
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='capacitaciones_registradas',
        verbose_name="Prevencionista Relator"
    )
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='capacitaciones',
        verbose_name="Empresa"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='capacitaciones',
        verbose_name="Centro de Trabajo / Faena"
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
    evaluacion_comprension_aplicada = models.BooleanField(
        default=False,
        verbose_name="Evaluación de Comprensión Aplicada"
    )
    porcentaje_aprobacion_minimo = models.PositiveIntegerField(
        default=75,
        verbose_name="Porcentaje Mínimo de Aprobación (%)"
    )
    entidad_capacitadora = models.CharField(
        max_length=150,
        blank=True,
        default="",
        verbose_name="Entidad Capacitadora / OTEC / Mutualidad"
    )
    codigo_sence = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="Código SENCE (si aplica)"
    )
    certificado_emitido = models.BooleanField(
        default=False,
        verbose_name="Certificado Formal Emitido"
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

    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        verbose_name="Identificador Único (UUID)",
        help_text="UUID público seguro para el buzón digital de sugerencias y denuncias."
    )

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


class SugerenciaLaboral(models.Model):
    """
    Canal abierto y participativo para sugerencias de clima laboral, mejoras de procesos
    y seguridad general dentro de una empresa.
    """
    TIPO_MEJORA_PROCESO = 'MEJORA_PROCESO'
    TIPO_CLIMA_LABORAL = 'CLIMA_LABORAL'
    TIPO_SEGURIDAD_GENERAL = 'SEGURIDAD_GENERAL'
    TIPO_OTRO = 'OTRO'
    TIPO_CHOICES = [
        (TIPO_MEJORA_PROCESO, 'Mejora de Procesos / Productividad'),
        (TIPO_CLIMA_LABORAL, 'Clima Laboral y Bienestar'),
        (TIPO_SEGURIDAD_GENERAL, 'Seguridad y Salud en el Trabajo'),
        (TIPO_OTRO, 'Otro Aporte / Sugerencia'),
    ]

    ESTADO_NUEVA = 'NUEVA'
    ESTADO_REVISADA = 'REVISADA'
    ESTADO_APLICADA = 'APLICADA'
    ESTADO_CHOICES = [
        (ESTADO_NUEVA, 'Nueva'),
        (ESTADO_REVISADA, 'Revisada'),
        (ESTADO_APLICADA, 'Aplicada'),
    ]

    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        verbose_name="Identificador Único (UUID)"
    )
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='sugerencias',
        verbose_name="Empresa"
    )
    mensaje = models.TextField(verbose_name="Mensaje de la Sugerencia")
    tipo = models.CharField(
        max_length=30,
        choices=TIPO_CHOICES,
        default=TIPO_MEJORA_PROCESO,
        verbose_name="Tipo de Sugerencia"
    )
    es_anonimo = models.BooleanField(
        default=True,
        verbose_name="Es Anónimo"
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
        verbose_name="Contacto del Remitente"
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_NUEVA,
        verbose_name="Estado de la Sugerencia"
    )
    respuesta = models.TextField(
        blank=True,
        null=True,
        verbose_name="Respuesta o Medida Preventiva"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Creación"
    )

    class Meta:
        verbose_name = "Sugerencia Laboral"
        verbose_name_plural = "Sugerencias Laborales"
        ordering = ['-fecha_creacion']

    def __str__(self) -> str:
        remitente = self.nombre_remitente if not self.es_anonimo and self.nombre_remitente else "Anónimo"
        return f"[{self.get_tipo_display()}] {remitente} - {self.empresa.razon_social}"


class DenunciaLeyKarin(models.Model):
    """
    Canal formal, confidencial y auditado para denuncias bajo Ley N° 21.643 (Ley Karin)
    sobre Acoso Sexual, Acoso Laboral y Violencia en el Trabajo.
    Cumple estrictamente con la Circular SUSESO y Dictámenes de la Dirección del Trabajo (DT).
    """
    TIPO_ACOSO_SEXUAL = 'ACOSO_SEXUAL'
    TIPO_ACOSO_LABORAL = 'ACOSO_LABORAL'
    TIPO_VIOLENCIA_EXTERNA = 'VIOLENCIA_EXTERNA'
    TIPO_AFECTACION_CHOICES = [
        (TIPO_ACOSO_SEXUAL, 'Acoso Sexual (Art. 2 Inc. 2 Código del Trabajo)'),
        (TIPO_ACOSO_LABORAL, 'Acoso Laboral (Art. 2 Inc. 3 Código del Trabajo)'),
        (TIPO_VIOLENCIA_EXTERNA, 'Violencia en el Trabajo ejercida por terceros/clientes (Art. 2 Inc. 4)'),
    ]

    ESTADO_RECEPCIONADA = 'RECEPCIONADA'
    ESTADO_MEDIDAS_RESGUARDO = 'MEDIDAS_RESGUARDO_APLICADAS'
    ESTADO_DERIVADA_DT = 'DERIVADA_A_DT'
    ESTADO_INVESTIGACION_INTERNA = 'INVESTIGACION_INTERNA'
    ESTADO_FINALIZADA = 'FINALIZADA'
    ESTADO_TRAMITE_CHOICES = [
        (ESTADO_RECEPCIONADA, 'Recepcionada / En Análisis Inicial'),
        (ESTADO_MEDIDAS_RESGUARDO, 'Medidas de Resguardo Cautelar Aplicadas'),
        (ESTADO_DERIVADA_DT, 'Derivada a Inspección del Trabajo (DT)'),
        (ESTADO_INVESTIGACION_INTERNA, 'Investigación Interna en Curso'),
        (ESTADO_FINALIZADA, 'Finalizada con Dictamen / Resolución'),
    ]

    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        verbose_name="Identificador Único Confidencial (UUID)"
    )
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='denuncias_karin',
        verbose_name="Empresa"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='denuncias_karin',
        verbose_name="Centro de Trabajo / Faena"
    )
    tipo_afectacion = models.CharField(
        max_length=30,
        choices=TIPO_AFECTACION_CHOICES,
        verbose_name="Tipo de Afectación"
    )

    # Identificación del Denunciante (Obligatorio para denuncia formal y medidas de protección)
    rut_denunciante = models.CharField(
        max_length=15,
        validators=[validar_rut_chileno],
        verbose_name="RUT del Denunciante"
    )
    nombre_denunciante = models.CharField(
        max_length=150,
        verbose_name="Nombre Completo del Denunciante"
    )
    correo_denunciante = models.EmailField(
        verbose_name="Correo Electrónico del Denunciante"
    )
    telefono_denunciante = models.CharField(
        max_length=30,
        blank=True,
        default="",
        verbose_name="Teléfono del Denunciante"
    )

    # Datos de la Persona Denunciada
    nombre_denunciado = models.CharField(
        max_length=150,
        verbose_name="Nombre de la Persona Denunciada"
    )
    cargo_area_denunciado = models.CharField(
        max_length=150,
        blank=True,
        default="",
        verbose_name="Cargo o Área de la Persona Denunciada"
    )

    # Relato de los Hechos
    descripcion_circunstanciada = models.TextField(
        verbose_name="Descripción Circunstanciada",
        help_text="Hechos, lugares y fechas aproximadas"
    )
    testigos_o_evidencias = models.TextField(
        blank=True,
        null=True,
        verbose_name="Testigos o Evidencias"
    )

    # Gestión de Plazos Legales y Medidas (72h DT)
    fecha_hora_ingreso = models.DateTimeField(
        auto_now_add=True,
        editable=False,
        verbose_name="Fecha y Hora de Ingreso"
    )
    plazo_limite_derivacion_dt = models.DateTimeField(
        blank=True,
        null=True,
        help_text="72 horas legales desde el ingreso",
        verbose_name="Plazo Límite Derivación DT"
    )
    estado_tramite = models.CharField(
        max_length=35,
        choices=ESTADO_TRAMITE_CHOICES,
        default=ESTADO_RECEPCIONADA,
        verbose_name="Estado del Trámite"
    )
    medidas_resguardo_detalle = models.TextField(
        blank=True,
        null=True,
        help_text="Separación de puestos físicos, redistribución de jornadas, etc.",
        verbose_name="Medidas de Resguardo Cautelar"
    )
    derivada_inspeccion_trabajo = models.BooleanField(
        default=False,
        verbose_name="Derivada a Inspección del Trabajo (DT)"
    )
    folio_dt = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="Folio DT"
    )

    # Derivación a Organismo Administrador (Compendio SUSESO Libro IV y Anexo 67 - Plazo 5 días hábiles)
    derivada_mutualidad = models.BooleanField(
        default=False,
        verbose_name="Derivada a Mutualidad (Anexo 67)"
    )
    fecha_derivacion_mutualidad = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha Derivación Mutualidad"
    )
    folio_mutualidad = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="Folio de Ingreso en Mutualidad"
    )
    comprobante_anexo_67 = models.FileField(
        upload_to="karin_anexo67/",
        null=True,
        blank=True,
        verbose_name="Comprobante Anexo 67 SUSESO"
    )
    atencion_psicologica_ofrecida = models.BooleanField(
        default=False,
        verbose_name="Atención Psicológica Temprana Ofrecida"
    )
    fecha_ofrecimiento_psicologico = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha Ofrecimiento Atención Psicológica"
    )
    plazo_limite_informe_mutualidad_5d = models.DateField(
        null=True,
        blank=True,
        verbose_name="Plazo Límite Mutualidad (5 Días Hábiles)"
    )

    class Meta:
        verbose_name = "Denuncia Ley Karin"
        verbose_name_plural = "Denuncias Ley Karin"
        ordering = ['-fecha_hora_ingreso']

    def save(self, *args, **kwargs):
        from datetime import timedelta
        from django.utils import timezone
        if not self.plazo_limite_derivacion_dt:
            # 72 horas legales desde el momento de registro
            self.plazo_limite_derivacion_dt = timezone.now() + timedelta(hours=72)
        if not self.plazo_limite_informe_mutualidad_5d:
            base_date = timezone.localdate()
            dias_agregados = 0
            curr = base_date
            while dias_agregados < 5:
                curr += timedelta(days=1)
                if curr.weekday() < 5:  # Lunes a Viernes
                    dias_agregados += 1
            self.plazo_limite_informe_mutualidad_5d = curr
        super().save(*args, **kwargs)

    @property
    def codigo_seguimiento(self) -> str:
        year = self.fecha_hora_ingreso.year if self.fecha_hora_ingreso else 2026
        return f"KARIN-{year}-{str(self.uuid)[:8].upper()}"

    @property
    def dias_restantes_mutualidad(self) -> int:
        from django.utils import timezone
        if not self.plazo_limite_informe_mutualidad_5d:
            return 5
        hoy = timezone.localdate()
        return (self.plazo_limite_informe_mutualidad_5d - hoy).days

    @property
    def horas_restantes(self) -> float:
        from django.utils import timezone
        if not self.plazo_limite_derivacion_dt:
            return 72.0
        diff = self.plazo_limite_derivacion_dt - timezone.now()
        return round(diff.total_seconds() / 3600.0, 1)

    @property
    def semaforo(self) -> str:
        if self.derivada_inspeccion_trabajo or self.estado_tramite in [self.ESTADO_DERIVADA_DT, self.ESTADO_FINALIZADA]:
            return 'DERIVADA'
        horas = self.horas_restantes
        if horas <= 12:
            return 'ROJO'
        elif horas <= 24:
            return 'AMARILLO'
        return 'VERDE'

    def __str__(self) -> str:
        return f"Denuncia Karin #{self.id} - {self.get_tipo_afectacion_display()} ({self.empresa.razon_social})"


class AuditLogAccesoDenuncia(models.Model):
    """
    Registro inmutable de confidencialidad y auditoría de accesos a una denuncia Ley Karin.
    """
    ACCION_APERTURA = "APERTURA_EXPEDIENTE"
    ACCION_DESCARGA = "DESCARGA_INFORME"
    ACCION_MEDIDAS = "REGISTRO_MEDIDAS"
    ACCION_DERIVACION = "DERIVACION_DT"

    denuncia = models.ForeignKey(
        DenunciaLeyKarin,
        on_delete=models.CASCADE,
        related_name='accesos_auditoria',
        verbose_name="Denuncia Asociada"
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        verbose_name="Usuario que Accedió"
    )
    fecha_hora = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha y Hora de Acceso"
    )
    ip_origen = models.GenericIPAddressField(
        verbose_name="Dirección IP de Origen"
    )
    accion = models.CharField(
        max_length=100,
        default=ACCION_APERTURA,
        verbose_name="Acción Realizada"
    )

    class Meta:
        verbose_name = "Auditoría de Acceso a Denuncia"
        verbose_name_plural = "Auditorías de Accesos a Denuncias"
        ordering = ['-fecha_hora']

    def __str__(self) -> str:
        return f"[{self.fecha_hora}] {self.usuario.username} - {self.accion} en Denuncia #{self.denuncia_id}"


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
    empresa_principal = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='contratistas',
        null=True,
        blank=True,
        verbose_name="Empresa Principal / Mandante (D.S. N° 76)"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contratistas',
        verbose_name="Centro de Trabajo / Faena"
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
        (TIPO_ODI, 'Información de los riesgos laborales (ODI Art. 15 D.S. N° 44)'),
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
    TIPO_CPHS = 'CPHS_DS44'
    CPHS_DS54 = 'CPHS_DS44'  # Alias de compatibilidad
    TIPO_OTRO = 'A_MEDIDA'

    TIPO_CHOICES = [
        (TIPO_LEY_KARIN, 'Prevención del Acoso y Ley Karin / Protocolo SUSESO-ISTAS 21 (Psicólogo Laboral)'),
        (TIPO_TMERT, 'Ergonomía, TMERT y Manejo Manual de Cargas Ley 20.949 (Kinesiólogo / Ergónomo)'),
        (TIPO_SEGURIDAD_CRITICA, 'Trabajos Críticos: Altura Física, Espacios Confinados, LOTO (Prevencionista Senior)'),
        (TIPO_EXTINTORES, 'Uso y Manejo Práctico de Extintores DS 594 (Instructor en Terreno)'),
        (TIPO_INDUCCION_ODI, 'Inducción de riesgos laborales (ODI Art. 15 D.S. N° 44)'),
        (TIPO_CPHS, 'Capacitación y Asesoría a Comité Paritario (D.S. N° 44 Arts. 23 al 49)'),
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


class ComiteParitario(models.Model):
    """
    Representa un Comité Paritario de Higiene y Seguridad (CPHS) según D.S. N° 44
    y Ley N° 16.744 (obligatorio para empresas con más de 25 trabajadores).
    Vigencia legal de mandato: 2 años calendario contados desde la constitución.
    """
    ESTADO_VIGENTE = 'VIGENTE'
    ESTADO_POR_VENCER = 'POR_VENCER'
    ESTADO_VENCIDO = 'VENCIDO'
    ESTADO_EN_ELECCION = 'EN_ELECCION'
    ESTADO_CHOICES = [
        (ESTADO_VIGENTE, 'Vigente'),
        (ESTADO_POR_VENCER, 'Por Vencer (< 60 días)'),
        (ESTADO_VENCIDO, 'Mandato Vencido'),
        (ESTADO_EN_ELECCION, 'Proceso Eleccionario'),
    ]

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='comites_paritarios',
        verbose_name="Empresa"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='comites_paritarios',
        verbose_name="Centro de Trabajo / Faena"
    )
    nombre = models.CharField(
        max_length=150,
        verbose_name="Nombre del Comité",
        help_text="Ej: CPHS Casa Matriz, CPHS Faena Mina Central"
    )
    fecha_constitucion = models.DateField(
        verbose_name="Fecha de Elección / Constitución"
    )
    fecha_vencimiento_mandato = models.DateField(
        null=True,
        blank=True,
        verbose_name="Vencimiento Mandato (2 Años D.S. 44)"
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_VIGENTE,
        verbose_name="Estado del Mandato"
    )
    folio_registro_rel_dt = models.CharField(
        max_length=80,
        blank=True,
        default="",
        verbose_name="Folio Registro Electrónico Laboral (REL DT)",
        help_text="Folio de inscripción del CPHS en el Registro Electrónico Laboral de la DT"
    )
    fecha_registro_rel_dt = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de Inscripción en REL DT"
    )
    alerta_plazo_rel_15dias = models.DateField(
        null=True,
        blank=True,
        verbose_name="Plazo Máximo Inscripción REL (15 Días Hábiles)",
        help_text="Plazo máximo de 15 días hábiles desde la elección para subir el acta a la DT"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Registro"
    )

    class Meta:
        verbose_name = "Comité Paritario (CPHS)"
        verbose_name_plural = "Comités Paritarios (CPHS)"
        ordering = ['-fecha_constitucion']

    def __str__(self) -> str:
        return f"{self.nombre} - {self.empresa.razon_social}"

    @property
    def dias_restantes_mandato(self) -> int:
        if not self.fecha_vencimiento_mandato:
            return 0
        hoy = timezone.localdate()
        return (self.fecha_vencimiento_mandato - hoy).days

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.fecha_constitucion and not self.fecha_vencimiento_mandato:
            self.fecha_vencimiento_mandato = self.fecha_constitucion + timedelta(days=730)

        if self.fecha_constitucion and not self.alerta_plazo_rel_15dias:
            dias_agregados = 0
            curr = self.fecha_constitucion
            while dias_agregados < 15:
                curr += timedelta(days=1)
                if curr.weekday() < 5:  # Lunes a Viernes
                    dias_agregados += 1
            self.alerta_plazo_rel_15dias = curr

        if self.fecha_vencimiento_mandato and self.estado != self.ESTADO_EN_ELECCION:
            dias = self.dias_restantes_mandato
            if dias < 0:
                self.estado = self.ESTADO_VENCIDO
            elif dias <= 60:
                self.estado = self.ESTADO_POR_VENCER
            else:
                self.estado = self.ESTADO_VIGENTE

        super().save(*args, **kwargs)


class MiembroCPHS(models.Model):
    """
    Miembro integrante de un Comité Paritario de Higiene y Seguridad (CPHS).
    Estructura paritaria: 3 titulares y 3 suplentes patronales, y 3 titulares y 3 suplentes laborales.
    D.S. 44 exige designar Presidente y Secretario obligatoriamente.
    """
    ESTAMENTO_EMPRESA = 'EMPRESA'
    ESTAMENTO_TRABAJADORES = 'TRABAJADORES'
    ESTAMENTO_EXPERTO_DPR = 'EXPERTO_DPR'
    ESTAMENTO_CHOICES = [
        (ESTAMENTO_EMPRESA, 'Representante del Empleador'),
        (ESTAMENTO_TRABAJADORES, 'Representante de los Trabajadores'),
        (ESTAMENTO_EXPERTO_DPR, 'Experto en Prevención de Riesgos (Derecho Propio Art. 38 D.S. 44)'),
    ]

    REPRESENTACION_TITULAR = 'TITULAR'
    REPRESENTACION_SUPLENTE = 'SUPLENTE'
    REPRESENTACION_CHOICES = [
        (REPRESENTACION_TITULAR, 'Miembro Titular'),
        (REPRESENTACION_SUPLENTE, 'Miembro Suplente'),
    ]

    CARGO_PRESIDENTE = 'PRESIDENTE'
    CARGO_SECRETARIO = 'SECRETARIO'
    CARGO_VOCAL = 'VOCAL'
    CARGO_CHOICES = [
        (CARGO_PRESIDENTE, 'Presidente'),
        (CARGO_SECRETARIO, 'Secretario'),
        (CARGO_VOCAL, 'Vocal / Integrante'),
    ]

    comite = models.ForeignKey(
        ComiteParitario,
        on_delete=models.CASCADE,
        related_name='miembros',
        verbose_name="Comité Paritario"
    )
    trabajador = models.ForeignKey(
        Trabajador,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='participaciones_cphs',
        verbose_name="Ficha Trabajador Asociada"
    )
    nombre = models.CharField(
        max_length=150,
        verbose_name="Nombre y Apellidos"
    )
    rut = models.CharField(
        max_length=15,
        validators=[validar_rut_chileno],
        verbose_name="RUT del Miembro"
    )
    estamento = models.CharField(
        max_length=20,
        choices=ESTAMENTO_CHOICES,
        verbose_name="Estamento Representado"
    )
    tipo_representacion = models.CharField(
        max_length=20,
        choices=REPRESENTACION_CHOICES,
        verbose_name="Tipo de Representación"
    )
    cargo = models.CharField(
        max_length=20,
        choices=CARGO_CHOICES,
        default=CARGO_VOCAL,
        verbose_name="Cargo en el Comité"
    )
    activo = models.BooleanField(
        default=True,
        verbose_name="Miembro Activo"
    )
    tiene_fuero_laboral = models.BooleanField(
        default=False,
        verbose_name="Tiene Fuero Laboral",
        help_text="Representante titular de los trabajadores con fuero laboral según Art. 243 Código del Trabajo y Art. 33 D.S. 44"
    )
    CAUSAL_CESE_TERMINO_CONTRATO = 'TERMINO_CONTRATO'
    CAUSAL_CESE_INASISTENCIA = 'INASISTENCIA_REITERADA'
    CAUSAL_CESE_VENCIMIENTO = 'VENCIMIENTO_MANDATO'
    CAUSAL_CESE_CHOICES = [
        (CAUSAL_CESE_TERMINO_CONTRATO, 'Término de la relación laboral con la empresa'),
        (CAUSAL_CESE_INASISTENCIA, 'Inasistencia injustificada a dos sesiones consecutivas (Art. 31 D.S. N° 44)'),
        (CAUSAL_CESE_VENCIMIENTO, 'Término natural del período de 2 años'),
    ]
    causal_cese = models.CharField(
        max_length=30,
        choices=CAUSAL_CESE_CHOICES,
        blank=True,
        null=True,
        verbose_name="Causal Legal de Cese",
        help_text="Causales taxativas según Art. 31 D.S. N° 44 (la renuncia voluntaria simple no es causal legítima)"
    )
    fecha_designacion = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de Designación / Elección"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Registro"
    )

    class Meta:
        verbose_name = "Miembro de CPHS"
        verbose_name_plural = "Miembros de CPHS"
        ordering = ['estamento', 'tipo_representacion', 'cargo', 'nombre']

    def __str__(self) -> str:
        return f"{self.nombre} ({self.get_cargo_display()} - {self.get_estamento_display()})"


class ActaSesionCPHS(models.Model):
    """
    Acta formal de sesión del Comité Paritario de Higiene y Seguridad (CPHS) según D.S. N° 44 Arts. 39, 40 y 42.
    Reuniones ordinarias mensuales obligatorias (12 anuales) o extraordinarias ante accidentes graves/urgencias.
    """
    TIPO_ORDINARIA = 'ORDINARIA'
    TIPO_EXTRAORDINARIA = 'EXTRAORDINARIA'
    TIPO_SESION_CHOICES = [
        (TIPO_ORDINARIA, 'Sesión Ordinaria Mensual'),
        (TIPO_EXTRAORDINARIA, 'Sesión Extraordinaria (Accidente Grave / Urgencia)'),
    ]

    comite = models.ForeignKey(
        ComiteParitario,
        on_delete=models.CASCADE,
        related_name='actas',
        verbose_name="Comité Paritario"
    )
    numero_acta = models.PositiveIntegerField(
        verbose_name="N° Correlativo de Acta"
    )
    tipo_sesion = models.CharField(
        max_length=20,
        choices=TIPO_SESION_CHOICES,
        default=TIPO_ORDINARIA,
        verbose_name="Tipo de Sesión"
    )
    fecha_hora_sesion = models.DateTimeField(
        verbose_name="Fecha y Hora de la Reunión"
    )
    lugar = models.CharField(
        max_length=200,
        verbose_name="Lugar o Modalidad de la Reunión"
    )
    asistentes = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de miembros asistentes para verificación de quorum legal"
    )
    tabla_temas = models.TextField(
        verbose_name="Puntos Tratados en la Tabla"
    )
    acuerdos = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de acuerdos: [{'acuerdo': '...', 'responsable': '...', 'plazo': 'YYYY-MM-DD', 'cumplido': false}]"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Creación"
    )

    class Meta:
        verbose_name = "Acta de Sesión CPHS"
        verbose_name_plural = "Actas de Sesiones CPHS"
        ordering = ['-fecha_hora_sesion', '-numero_acta']
        unique_together = [['comite', 'numero_acta']]

    def __str__(self) -> str:
        return f"Acta N°{self.numero_acta} ({self.get_tipo_sesion_display()}) - {self.comite.nombre}"


class EntregaEPP(models.Model):
    """
    Registro formal e inmutable de Entrega de Elementos de Protección Personal (EPP)
    y ejemplar del Reglamento Interno de Orden, Higiene y Seguridad (RIOHS) con Firma Digital.
    Cumple con:
    - Art. 68 Ley N° 16.744: Gratuidad obligatoria de los EPP por el empleador.
    - Art. 53 D.S. N° 594: Obligación de capacitar en el uso correcto y conservación adecuada.
    - Art. 153 a 157 Código del Trabajo: Constancia firmada de entrega del RIOHS.
    """
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='entregas_epp',
        verbose_name="Empresa"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='entregas_epp',
        verbose_name="Centro de Trabajo / Faena"
    )
    trabajador = models.ForeignKey(
        Trabajador,
        on_delete=models.CASCADE,
        related_name='entregas_epp',
        verbose_name="Trabajador Receptor"
    )
    responsable_entrega = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='entregas_epp_realizadas',
        verbose_name="Prevencionista / Bodega"
    )
    items_epp = models.JSONField(
        default=list,
        help_text="Lista de EPPs: [{'tipo': '...', 'marca_modelo': '...', 'certificacion': '...', 'talla': '...', 'cantidad': 1, 'motivo': 'ENTREGA_INICIAL|RECAMBIO_DESGASTE|DETERIORO'}]"
    )
    entrega_riohs = models.BooleanField(
        default=False,
        verbose_name="Se hizo entrega de ejemplar de RIOHS"
    )
    version_riohs = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Versión o Año del RIOHS entregado"
    )
    declaracion_capacitacion = models.BooleanField(
        default=True,
        verbose_name="Declara haber recibido inducción de uso y mantención adecuada (Art. 53 D.S. 594)"
    )
    firma_digital = models.TextField(
        verbose_name="Firma Digitalizada (Base64 PNG)"
    )
    ip_registro = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="IP del dispositivo firmante"
    )
    fecha_hora_entrega = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha y Hora Legal de Recepción"
    )

    class Meta:
        verbose_name = "Entrega de EPP y RIOHS"
        verbose_name_plural = "Entregas de EPP y RIOHS"
        ordering = ['-fecha_hora_entrega']

    def __str__(self) -> str:
        return f"Entrega EPP a {self.trabajador.nombres} {self.trabajador.apellidos} - {self.fecha_hora_entrega.strftime('%d/%m/%Y %H:%M')}"


class RequisitoLegalBase(models.Model):
    """
    Catálogo maestro de requisitos legales y técnicos de Seguridad y Salud en el Trabajo (SST)
    vigentes en Chile (D.S. 594, Ley 16.744, D.S. 44, Ley Karin 21.643, etc.).
    """
    ORGANISMO_DT = 'DT'
    ORGANISMO_SEREMI = 'SEREMI'
    ORGANISMO_SUSESO = 'SUSESO'
    ORGANISMO_SERNAGEOMIN = 'SERNAGEOMIN'
    ORGANISMO_SAG = 'SAG'
    ORGANISMO_SEC = 'SEC'
    ORGANISMO_DIRECTEMAR = 'DIRECTEMAR'
    ORGANISMO_SMA = 'SMA'

    ORGANISMO_CHOICES = [
        (ORGANISMO_DT, 'Dirección del Trabajo (DT)'),
        (ORGANISMO_SEREMI, 'Seremi de Salud / MINSAL'),
        (ORGANISMO_SUSESO, 'Superintendencia de Seguridad Social (SUSESO)'),
        (ORGANISMO_SERNAGEOMIN, 'Sernageomin (Minería)'),
        (ORGANISMO_SAG, 'Servicio Agrícola y Ganadero (SAG)'),
        (ORGANISMO_SEC, 'Superintendencia de Electricidad y Combustibles (SEC)'),
        (ORGANISMO_DIRECTEMAR, 'Directemar (Armada de Chile)'),
        (ORGANISMO_SMA, 'Superintendencia del Medio Ambiente (SMA)'),
    ]

    TIPO_LEY = 'LEY'
    TIPO_DS = 'DECRETO_SUPREMO'
    TIPO_RESOLUCION = 'RESOLUCION'
    TIPO_PROTOCOLO = 'PROTOCOLO_MINSAL'
    TIPO_CIRCULAR = 'CIRCULAR_SUSESO'
    TIPO_CODIGO = 'CODIGO_TRABAJO'

    TIPO_NORMA_CHOICES = [
        (TIPO_LEY, 'Ley de la República'),
        (TIPO_DS, 'Decreto Supremo (D.S.)'),
        (TIPO_RESOLUCION, 'Resolución Exenta'),
        (TIPO_PROTOCOLO, 'Protocolo Técnico MINSAL'),
        (TIPO_CIRCULAR, 'Circular SUSESO'),
        (TIPO_CODIGO, 'Código del Trabajo'),
    ]

    RUBRO_TRANSVERSAL = 'TRANSVERSAL'
    RUBRO_CONSTRUCCION = 'CONSTRUCCION'
    RUBRO_MINERIA = 'MINERIA'
    RUBRO_INDUSTRIA = 'INDUSTRIA'
    RUBRO_AGRICOLA = 'AGRICOLA'
    RUBRO_TRANSPORTE = 'TRANSPORTE'
    RUBRO_SALUD = 'SALUD'
    RUBRO_COMERCIO = 'COMERCIO'
    RUBRO_QUIMICA = 'QUIMICA'
    RUBRO_ALIMENTOS = 'ALIMENTOS'

    RUBRO_CHOICES = [
        (RUBRO_TRANSVERSAL, 'Transversal (Aplica a todas las empresas)'),
        (RUBRO_CONSTRUCCION, 'Construcción y Obras Civiles'),
        (RUBRO_MINERIA, 'Minería y Sondajes'),
        (RUBRO_INDUSTRIA, 'Industria Manufacturera y Metalmecánica'),
        (RUBRO_AGRICOLA, 'Agrícola y Forestal'),
        (RUBRO_TRANSPORTE, 'Transporte y Logística'),
        (RUBRO_SALUD, 'Salud y Clínicas'),
        (RUBRO_COMERCIO, 'Comercio y Retail'),
        (RUBRO_QUIMICA, 'Química y Bodegas de Sustancias Peligrosas'),
        (RUBRO_ALIMENTOS, 'Alimentos y Gastronomía'),
    ]

    organismo = models.CharField(
        max_length=20,
        choices=ORGANISMO_CHOICES,
        verbose_name="Organismo Fiscalizador"
    )
    tipo_norma = models.CharField(
        max_length=20,
        choices=TIPO_NORMA_CHOICES,
        verbose_name="Tipo de Norma Jurídica"
    )
    identificacion_norma = models.CharField(
        max_length=120,
        verbose_name="Identificación de la Norma",
        help_text="Ej: D.S. N° 594, Ley N° 21.643, D.S. N° 44"
    )
    articulo = models.CharField(
        max_length=80,
        verbose_name="Artículo / Párrafo",
        help_text="Ej: Art. 53, Art. 21, Art. 153"
    )
    titulo = models.CharField(
        max_length=255,
        verbose_name="Título / Materia del Requisito"
    )
    descripcion_exigencia = models.TextField(
        verbose_name="Descripción de la Exigencia Legal Obligatoria"
    )
    sancion_multa = models.CharField(
        max_length=255,
        verbose_name="Sanción / Multa Legal Aplicable",
        help_text="Ej: 10 a 60 UTM por infracción gravísima; suspensión de faena"
    )
    rubro_aplicable = models.CharField(
        max_length=30,
        choices=RUBRO_CHOICES,
        default=RUBRO_TRANSVERSAL,
        verbose_name="Rubro o Actividad Económica"
    )
    condicion_activacion = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="Condición de Activación en Faena",
        help_text="Flags: MAS_25_TRABAJADORES, MAS_10_TRABAJADORES, TRABAJO_ALTURA, SUSTANCIAS_PELIGROSAS, SUBCONTRATACION, ESPACIOS_CONFINADOS"
    )
    orden = models.PositiveIntegerField(
        default=100,
        verbose_name="Orden de Despliegue"
    )
    activo = models.BooleanField(
        default=True,
        verbose_name="Requisito Vigente / Activo"
    )

    class Meta:
        verbose_name = "Requisito Legal Base SST"
        verbose_name_plural = "Requisitos Legales Base SST"
        ordering = ['orden', 'identificacion_norma', 'articulo']

    def __str__(self) -> str:
        return f"{self.identificacion_norma} {self.articulo} - {self.titulo}"


class MatrizLegal(models.Model):
    """
    Matriz de Cumplimiento Legal personalizada para una empresa y centro de trabajo específico.
    Generada automáticamente según rubro económico (CIIU) y condiciones operativas.
    """
    SEMAFORO_OPTIMO = 'OPTIMO'
    SEMAFORO_REGULAR = 'REGULAR'
    SEMAFORO_CRITICO = 'CRITICO'

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='matrices_legales',
        verbose_name="Empresa Evaluada"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matrices_legales',
        verbose_name="Centro de Trabajo / Faena"
    )
    prevencionista = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='matrices_legales_creadas',
        verbose_name="Prevencionista Auditor"
    )
    rubro_principal = models.CharField(
        max_length=30,
        choices=RequisitoLegalBase.RUBRO_CHOICES,
        verbose_name="Rubro Principal Aplicado"
    )
    condiciones_faena = models.JSONField(
        default=dict,
        blank=True,
        help_text="Flags activados en faena: {'trabajo_altura': true, 'mas_25_trabajadores': true, ...}"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Creación"
    )
    fecha_actualizacion = models.DateTimeField(
        auto_now=True,
        verbose_name="Última Actualización"
    )
    observacion_general = models.TextField(
        blank=True,
        default="",
        verbose_name="Observaciones Generales de la Auditoría"
    )

    class Meta:
        verbose_name = "Matriz Legal SST"
        verbose_name_plural = "Matrices Legales SST"
        ordering = ['-fecha_actualizacion']

    def __str__(self) -> str:
        ct_str = f" - {self.centro_trabajo.nombre}" if self.centro_trabajo else ""
        return f"Matriz Legal {self.get_rubro_principal_display()} - {self.empresa.razon_social}{ct_str}"

    @property
    def total_requisitos(self) -> int:
        return self.items.exclude(estado=ItemMatrizLegal.ESTADO_NO_APLICA).count()

    @property
    def cumplidos(self) -> int:
        return self.items.filter(estado=ItemMatrizLegal.ESTADO_CUMPLE).count()

    @property
    def en_proceso(self) -> int:
        return self.items.filter(estado=ItemMatrizLegal.ESTADO_PROCESO).count()

    @property
    def brechas_criticas(self) -> int:
        return self.items.filter(estado=ItemMatrizLegal.ESTADO_NO_CUMPLE).count()

    @property
    def porcentaje_cumplimiento(self) -> float:
        tot = self.total_requisitos
        if tot <= 0:
            return 0.0
        return round((self.cumplidos / tot) * 100, 1)

    @property
    def estado_semaforo(self) -> str:
        pct = self.porcentaje_cumplimiento
        if pct >= 85.0:
            return self.SEMAFORO_OPTIMO
        elif pct >= 60.0:
            return self.SEMAFORO_REGULAR
        return self.SEMAFORO_CRITICO


class ItemMatrizLegal(models.Model):
    """
    Ítem individual de requisito evaluado en la matriz legal de una empresa.
    Mantiene snapshot de la exigencia legal, estado de cumplimiento, evidencia y responsable.
    """
    ESTADO_CUMPLE = 'CUMPLE'
    ESTADO_PROCESO = 'EN_PROCESO'
    ESTADO_NO_CUMPLE = 'NO_CUMPLE'
    ESTADO_NO_APLICA = 'NO_APLICA'

    ESTADO_CHOICES = [
        (ESTADO_CUMPLE, 'Cumple Totalmente'),
        (ESTADO_PROCESO, 'En Proceso de Implementación'),
        (ESTADO_NO_CUMPLE, 'No Cumple (Brecha Crítica)'),
        (ESTADO_NO_APLICA, 'No Aplica a la Operación'),
    ]

    matriz = models.ForeignKey(
        MatrizLegal,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="Matriz Legal"
    )
    requisito_base = models.ForeignKey(
        RequisitoLegalBase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='instancias_matriz',
        verbose_name="Requisito Base Catálogo"
    )
    organismo = models.CharField(
        max_length=20,
        verbose_name="Organismo Fiscalizador"
    )
    tipo_norma = models.CharField(
        max_length=20,
        verbose_name="Tipo de Norma"
    )
    identificacion_norma = models.CharField(
        max_length=120,
        verbose_name="Identificación de la Norma"
    )
    articulo = models.CharField(
        max_length=80,
        verbose_name="Artículo / Párrafo"
    )
    titulo = models.CharField(
        max_length=255,
        verbose_name="Título del Requisito"
    )
    descripcion_exigencia = models.TextField(
        verbose_name="Descripción de la Exigencia"
    )
    sancion_multa = models.CharField(
        max_length=255,
        verbose_name="Sanción o Multa DT/Seremi"
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_PROCESO,
        verbose_name="Estado de Cumplimiento"
    )
    evidencia_cumplimiento = models.TextField(
        blank=True,
        default="",
        verbose_name="Evidencia de Cumplimiento Documentada",
        help_text="Ej: Copia de RIOHS depositado en DT folio 49202, registro digital de EPP, acta CPHS N°5"
    )
    responsable = models.CharField(
        max_length=150,
        blank=True,
        default="",
        verbose_name="Responsable de Implementación / Custodia"
    )
    fecha_compromiso = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha Compromiso de Subsanación"
    )
    fecha_verificacion = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de Verificación de Cumplimiento"
    )
    observaciones = models.TextField(
        blank=True,
        default="",
        verbose_name="Observaciones Técnicas"
    )
    orden = models.PositiveIntegerField(
        default=100,
        verbose_name="Orden"
    )

    class Meta:
        verbose_name = "Ítem de Matriz Legal"
        verbose_name_plural = "Ítems de Matriz Legal"
        ordering = ['orden', 'identificacion_norma', 'articulo']

    def __str__(self) -> str:
        return f"[{self.get_estado_display()}] {self.identificacion_norma} {self.articulo} - {self.titulo}"


class MatrizRiesgoMiper(models.Model):
    """
    Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER / IPER)
    según Guía Técnica del ISP, D.S. N° 44 (2025/2026), ISO 45001 y D.S. N° 594.
    """
    ESTADO_BORRADOR = 'BORRADOR'
    ESTADO_VIGENTE = 'VIGENTE'
    ESTADO_EN_REVISION = 'EN_REVISION'
    ESTADO_CHOICES = [
        (ESTADO_BORRADOR, 'Borrador en Elaboración'),
        (ESTADO_VIGENTE, 'Vigente y Aprobada'),
        (ESTADO_EN_REVISION, 'En Revisión Periódica / Post-Incidente'),
    ]

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='matrices_miper',
        verbose_name="Empresa"
    )
    centro_trabajo = models.ForeignKey(
        CentroTrabajo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matrices_miper',
        verbose_name="Centro de Trabajo / Faena"
    )
    prevencionista = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='matrices_miper_creadas',
        verbose_name="Prevencionista Responsable"
    )
    nombre = models.CharField(
        max_length=200,
        verbose_name="Nombre de la Matriz IPER"
    )
    proceso_area = models.CharField(
        max_length=150,
        verbose_name="Área / Proceso Evaluado"
    )
    version = models.PositiveIntegerField(
        default=1,
        verbose_name="Versión de la Matriz"
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_VIGENTE,
        verbose_name="Estado de la Matriz"
    )
    fecha_aprobacion = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de Aprobación"
    )
    fecha_proxima_revision = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha Próxima Revisión"
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de Creación"
    )
    fecha_actualizacion = models.DateTimeField(
        auto_now=True,
        verbose_name="Última Actualización"
    )

    class Meta:
        verbose_name = "Matriz de Riesgo MIPER"
        verbose_name_plural = "Matrices de Riesgo MIPER"
        ordering = ['-fecha_actualizacion']

    def __str__(self) -> str:
        return f"{self.nombre} (v{self.version}) - {self.empresa.razon_social}"

    @property
    def total_peligros(self) -> int:
        return self.items.count()

    @property
    def criticos_puros(self) -> int:
        return sum(1 for it in self.items.all() if it.magnitud_pura >= 17)

    @property
    def altos_puros(self) -> int:
        return sum(1 for it in self.items.all() if 10 <= it.magnitud_pura <= 16)

    @property
    def criticos_residuales(self) -> int:
        return sum(1 for it in self.items.all() if it.magnitud_residual >= 17)

    @property
    def altos_residuales(self) -> int:
        return sum(1 for it in self.items.all() if 10 <= it.magnitud_residual <= 16)

    @property
    def medios_residuales(self) -> int:
        return sum(1 for it in self.items.all() if 5 <= it.magnitud_residual <= 9)

    @property
    def bajos_residuales(self) -> int:
        return sum(1 for it in self.items.all() if it.magnitud_residual <= 4)

    @property
    def porcentaje_reduccion_riesgo(self) -> float:
        items = list(self.items.all())
        if not items:
            return 0.0
        sum_pura = sum(it.magnitud_pura for it in items)
        if sum_pura <= 0:
            return 0.0
        sum_residual = sum(it.magnitud_residual for it in items)
        reduccion = ((sum_pura - sum_residual) / sum_pura) * 100
        return round(max(0.0, reduccion), 1)


class ItemMatrizRiesgo(models.Model):
    """
    Evaluación individual de peligro, riesgo puro, jerarquía de controles
    y riesgo residual bajo escala ISP 1 a 5 y metodología D.S. N° 44.
    """
    TIPO_RUTINARIA = 'RUTINARIA'
    TIPO_NO_RUTINARIA = 'NO_RUTINARIA'
    TIPO_EMERGENCIA = 'EMERGENCIA'
    TIPO_ACTIVIDAD_CHOICES = [
        (TIPO_RUTINARIA, 'Rutinaria (Operación Habitual)'),
        (TIPO_NO_RUTINARIA, 'No Rutinaria (Ocasional / Mantenimiento)'),
        (TIPO_EMERGENCIA, 'Emergencia / Contingencia'),
    ]

    CONTROL_IMPLEMENTADO = 'IMPLEMENTADO'
    CONTROL_EN_PROCESO = 'EN_PROCESO'
    CONTROL_PENDIENTE = 'PENDIENTE'
    ESTADO_CONTROL_CHOICES = [
        (CONTROL_IMPLEMENTADO, 'Control Implementado y Verificado'),
        (CONTROL_EN_PROCESO, 'En Proceso de Implementación'),
        (CONTROL_PENDIENTE, 'Pendiente de Presupuesto / Adquisición'),
    ]

    matriz = models.ForeignKey(
        MatrizRiesgoMiper,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="Matriz MIPER"
    )
    proceso = models.CharField(
        max_length=150,
        verbose_name="Proceso"
    )
    actividad = models.CharField(
        max_length=200,
        verbose_name="Actividad / Tarea"
    )
    tipo_actividad = models.CharField(
        max_length=20,
        choices=TIPO_ACTIVIDAD_CHOICES,
        default=TIPO_RUTINARIA,
        verbose_name="Tipo de Actividad"
    )
    puesto_trabajo = models.CharField(
        max_length=150,
        verbose_name="Puesto de Trabajo / Ocupación Expuesta"
    )
    peligro = models.TextField(
        verbose_name="Descripción del Peligro Identificado"
    )
    clasificacion_peligro = models.CharField(
        max_length=30,
        choices=ReporteRiesgo.PELIGRO_CHOICES,
        verbose_name="Clasificación del Peligro"
    )
    riesgo_consecuencia = models.TextField(
        verbose_name="Riesgo / Evento No Deseado y Consecuencia"
    )

    # Evaluación Riesgo Puro (Escala 1 a 5)
    probabilidad_pura = models.PositiveSmallIntegerField(
        default=3,
        help_text="1: Rara vez, 2: Improbable, 3: Posible, 4: Probable, 5: Casi seguro",
        verbose_name="Probabilidad Pura (P)"
    )
    severidad_pura = models.PositiveSmallIntegerField(
        default=3,
        help_text="1: Insignificante, 2: Menor, 3: Moderado, 4: Mayor, 5: Catastrófico",
        verbose_name="Severidad Pura (S)"
    )

    # Jerarquía Legal de Controles (Guía ISP / ISO 45001)
    control_eliminacion = models.TextField(
        blank=True,
        default="",
        verbose_name="1. Control por Eliminación"
    )
    control_sustitucion = models.TextField(
        blank=True,
        default="",
        verbose_name="2. Control por Sustitución"
    )
    control_ingenieria = models.TextField(
        blank=True,
        default="",
        verbose_name="3. Control de Ingeniería"
    )
    control_administrativo = models.TextField(
        blank=True,
        default="",
        verbose_name="4. Control Administrativo / Señalización"
    )
    control_epp = models.TextField(
        blank=True,
        default="",
        verbose_name="5. Elementos de Protección Personal (EPP)"
    )

    # Evaluación Riesgo Residual (con controles aplicados)
    probabilidad_residual = models.PositiveSmallIntegerField(
        default=2,
        help_text="1 a 5",
        verbose_name="Probabilidad Residual (Pr)"
    )
    severidad_residual = models.PositiveSmallIntegerField(
        default=2,
        help_text="1 a 5",
        verbose_name="Severidad Residual (Sr)"
    )

    responsable = models.CharField(
        max_length=150,
        blank=True,
        default="",
        verbose_name="Responsable de Implementación / Seguimiento"
    )
    plazo_implementacion = models.DateField(
        null=True,
        blank=True,
        verbose_name="Plazo de Implementación"
    )
    estado_control = models.CharField(
        max_length=20,
        choices=ESTADO_CONTROL_CHOICES,
        default=CONTROL_IMPLEMENTADO,
        verbose_name="Estado del Control"
    )
    orden = models.PositiveIntegerField(
        default=10,
        verbose_name="Orden de Despliegue"
    )

    class Meta:
        verbose_name = "Ítem de Matriz de Riesgo MIPER"
        verbose_name_plural = "Ítems de Matriz de Riesgo MIPER"
        ordering = ['orden', '-id']

    def __str__(self) -> str:
        return f"{self.actividad} - {self.peligro[:40]}"

    @property
    def magnitud_pura(self) -> int:
        return self.probabilidad_pura * self.severidad_pura

    @property
    def clasificacion_pura(self) -> str:
        mag = self.magnitud_pura
        if mag >= 17:
            return 'CRITICO'
        elif mag >= 10:
            return 'ALTO'
        elif mag >= 5:
            return 'MEDIO'
        return 'BAJO'

    @property
    def magnitud_residual(self) -> int:
        return self.probabilidad_residual * self.severidad_residual

    @property
    def clasificacion_residual(self) -> str:
        mag = self.magnitud_residual
        if mag >= 17:
            return 'CRITICO'
        elif mag >= 10:
            return 'ALTO'
        elif mag >= 5:
            return 'MEDIO'
        return 'BAJO'

    def clean(self):
        super().clean()
        for field_name in ['probabilidad_pura', 'severidad_pura', 'probabilidad_residual', 'severidad_residual']:
            val = getattr(self, field_name)
            if val is not None and (val < 1 or val > 5):
                raise ValidationError({field_name: "El valor debe estar comprendido entre 1 y 5 según la Escala de la Guía Técnica del ISP."})

        # Art. 9 y 10 D.S. N° 44: Jerarquía obligatoria de controles
        if self.magnitud_residual < self.magnitud_pura:
            controles = [
                self.control_eliminacion,
                self.control_sustitucion,
                self.control_ingenieria,
                self.control_administrativo,
                self.control_epp,
            ]
            if not any(c and c.strip() for c in controles):
                raise ValidationError(
                    "Artículos 9 y 10 D.S. N° 44: No es legal reducir el riesgo residual sin registrar al menos una medida de control de la jerarquía preventiva (eliminación, sustitución, ingeniería, administrativa o EPP)."
                )




