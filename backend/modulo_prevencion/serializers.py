from typing import Any
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from .models import (
    Plan, Suscripcion, ContadorDescargas, 
    PlantillaMaestra, DocumentoUsuario, 
    Noticia, MensajeContacto, Servicio,
    ReporteRiesgo, PlantillaInspeccion, Inspeccion, InvestigacionAccidente,
    TemaCapacitacion, RegistroCapacitacion, SugerenciaConsulta,
    Contratista, DocumentoContratista, TrabajadorSubcontratado,
    SolicitudCapacitacion,
    Empresa, CentroTrabajo, Trabajador,
    SugerenciaLaboral, DenunciaLeyKarin, AuditLogAccesoDenuncia
)

Usuario = get_user_model()

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = '__all__'


class UsuarioSerializer(serializers.ModelSerializer):
    """
    Serializer para exponer los datos del usuario una vez autenticado o registrado.
    """
    suscripcion_activa = serializers.SerializerMethodField()
    contador_descargas = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ('id', 'uuid', 'username', 'email', 'tipo_usuario', 'cuenta_padre', 'suscripcion_activa', 'contador_descargas', 'foto_perfil')

    def get_suscripcion_activa(self, obj):
        owner = obj.cuenta_padre if obj.cuenta_padre else obj
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        if sub:
            return {
                "id": sub.id,
                "plan_id": sub.plan.id,
                "plan_nombre": sub.plan.nombre,
                "plan_codigo": sub.plan.codigo,
                "precio": float(sub.plan.precio),
                "edicion_nube": sub.plan.edicion_nube,
                "marca_agua": sub.plan.marca_agua,
                "marca_blanca": sub.plan.marca_blanca,
                "limite_semanal": sub.plan.limite_semanal,
                "asientos": sub.plan.asientos,
                "acceso_servicios": getattr(sub.plan, 'acceso_servicios', False) or (float(sub.plan.precio) > 0),
                "fecha_inicio": sub.fecha_inicio,
                "fecha_vencimiento": sub.fecha_vencimiento,
            }
        return None

    def get_contador_descargas(self, obj):
        owner = obj.cuenta_padre if obj.cuenta_padre else obj
        contador, _ = ContadorDescargas.objects.get_or_create(usuario=owner)
        return {
            "descargas_semanales": contador.descargas_semanales,
            "fecha_ultima_descarga": contador.fecha_ultima_descarga
        }


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer que maneja el registro seguro de nuevos usuarios,
    crea automáticamente su contador de descargas y le asigna el plan básico.
    """
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True, 
        required=True, 
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = Usuario
        fields = ('username', 'email', 'password', 'password_confirm', 'tipo_usuario', 'cuenta_padre')
        extra_kwargs = {
            'email': {'required': True},
            'cuenta_padre': {'required': False, 'allow_null': True}
        }

    def validate(self, attrs):
        # 1. Validar coincidencia de contraseña
        if attrs['password'] != attrs['password_confirm']:
            raise ValidationError({"password": "Las contraseñas ingresadas no coinciden."})
        
        # 2. Validar correo electrónico único (Django por defecto valida username, pero no email como unique)
        email = attrs.get('email')
        if Usuario.objects.filter(email=email).exists():
            raise ValidationError({"email": "Ya existe un usuario registrado con este correo electrónico."})
            
        return attrs

    def create(self, validated_data):
        # Remover campos temporales del diccionario de validación
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        # Ejecutar creación transaccional atómica
        with transaction.atomic():
            usuario = Usuario(**validated_data)
            usuario.set_password(password)
            # Esto dispara la validación limpia (clean) para validar límites de cuenta_padre
            usuario.save()
            
            # Crear su contador de descargas a cero
            ContadorDescargas.objects.create(
                usuario=usuario,
                descargas_semanales=0,
                fecha_ultima_descarga=None
            )
            
            # Si no es un usuario hijo/asiento, le asignamos la suscripción básica de forma automática
            user_obj: Any = usuario
            if not user_obj.cuenta_padre:
                plan_basico, _ = Plan.objects.get_or_create(
                    codigo='basico',
                    defaults={
                        'nombre': 'Plan Básico',
                        'precio': 0.00,
                        'edicion_nube': False,
                        'marca_agua': True,
                        'marca_blanca': False,
                        'limite_semanal': 5, # Límite por defecto
                        'asientos': 1
                    }
                )
                
                Suscripcion.objects.create(
                    usuario=usuario,
                    plan=plan_basico,
                    estado=Suscripcion.ESTADO_ACTIVA,
                    fecha_inicio=timezone.now(),
                    fecha_vencimiento=None # Indefinido para planes gratis
                )
            
            return usuario


class PlantillaMaestraSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaMaestra
        fields = '__all__'


class DocumentoUsuarioSerializer(serializers.ModelSerializer):
    plantilla_maestra_detalle = PlantillaMaestraSerializer(source='plantilla_maestra', read_only=True)
    username = serializers.CharField(source='usuario.username', read_only=True)
    esta_desactualizado = serializers.BooleanField(read_only=True)

    class Meta:
        model = DocumentoUsuario
        fields = ('id', 'usuario', 'username', 'plantilla_maestra', 'plantilla_maestra_detalle', 'datos_guardados', 'fecha_ultimo_guardado', 'esta_desactualizado')
        extra_kwargs = {
            'usuario': {'required': False}
        }


class NoticiaSerializer(serializers.ModelSerializer):
    autor_name = serializers.CharField(source='autor.username', read_only=True)

    class Meta:
        model = Noticia
        fields = ('id', 'titulo', 'subtitulo', 'contenido', 'categoria', 'imagen_url', 'autor', 'autor_name', 'estado', 'fecha_publicacion')
        extra_kwargs = {
            'autor': {'required': False}
        }


class MensajeContactoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MensajeContacto
        fields = '__all__'
        extra_kwargs = {
            'usuario': {'required': False, 'allow_null': True}
        }


class ServicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servicio
        fields = '__all__'


class ReporteRiesgoSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)

    class Meta:
        model = ReporteRiesgo
        fields = (
            'id', 'uuid', 'usuario', 'username', 'empresa', 'empresa_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'tipo', 'descripcion', 'lugar', 'gravedad',
            'estado', 'medida_correctiva', 'fecha_creacion',
            'reportado_por_externo', 'nombre_reportante', 'rut_reportante', 'contacto_reportante',
            'empresa_faena', 'area_puesto', 'clasificacion_peligro', 'norma_infringida',
            'probabilidad', 'severidad', 'nivel_riesgo_calculado', 'jerarquia_control',
            'responsable', 'fecha_limite', 'foto_evidencia', 'fecha_resolucion'
        )
        extra_kwargs = {
            'usuario': {'required': False, 'allow_null': True}
        }


class PlantillaInspeccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaInspeccion
        fields = '__all__'


class InspeccionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)
    plantilla_nombre = serializers.CharField(source='plantilla.nombre', read_only=True)
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)

    class Meta:
        model = Inspeccion
        fields = (
            'id', 'usuario', 'username', 'empresa', 'empresa_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'plantilla', 'plantilla_nombre', 'fecha', 'respuestas',
            'porcentaje_cumplimiento', 'firma_nombre', 'firma_rut'
        )
        extra_kwargs = {
            'usuario': {'required': False},
            'porcentaje_cumplimiento': {'required': False}
        }


class InvestigacionAccidenteSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    trabajador_nombre = serializers.CharField(source='trabajador.nombre_completo', read_only=True)
    tipo_accidente_grave_display = serializers.CharField(source='get_tipo_accidente_grave_display', read_only=True)
    horas_restantes_diat = serializers.FloatField(read_only=True)
    diat_vencida = serializers.BooleanField(read_only=True)
    semaforo_diat = serializers.CharField(read_only=True)

    class Meta:
        model = InvestigacionAccidente
        fields = (
            'id', 'usuario', 'username', 'empresa', 'empresa_nombre',
            'trabajador', 'trabajador_nombre',
            'nombre_afectado', 'rut_afectado', 'cargo_afectado', 'edad_afectado', 'antiguedad_afectado',
            'tipo_evento', 'fecha_hora_evento', 'lugar_evento', 'descripcion_evento',
            'tipo_lesion', 'parte_cuerpo_afectada',
            'causas_inmediatas', 'causas_basicas', 'analisis_5_porques',
            'plan_accion',
            'diat_presentada', 'diat_folio', 'diat_fecha_presentacion', 'plazo_limite_diat_24h',
            'horas_restantes_diat', 'diat_vencida', 'semaforo_diat',
            'es_grave_o_fatal', 'tipo_accidente_grave', 'tipo_accidente_grave_display',
            'faena_suspendida', 'aviso_autoridades_realizado', 'aviso_autoridades_folio', 'aviso_autoridades_fecha',
            'dias_perdidos', 'alta_medica',
            'fecha_creacion'
        )
        extra_kwargs = {
            'usuario': {'required': False}
        }


class TemaCapacitacionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = TemaCapacitacion
        fields = ('id', 'usuario', 'username', 'titulo', 'descripcion', 'categoria', 'duracion_minutos', 'contenido_clave', 'fecha_creacion')
        extra_kwargs = {
            'usuario': {'required': False}
        }


class RegistroCapacitacionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)
    tema_titulo = serializers.CharField(source='tema.titulo', read_only=True)
    tema_detalle = TemaCapacitacionSerializer(source='tema', read_only=True)
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)

    class Meta:
        model = RegistroCapacitacion
        fields = (
            'id', 'uuid', 'usuario', 'username', 'empresa', 'empresa_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'tema', 'tema_titulo', 'tema_detalle',
            'estado', 'fecha_programada', 'fecha_realizacion', 'lugar',
            'asistentes', 'observaciones', 'fecha_creacion'
        )
        extra_kwargs = {
            'usuario': {'required': False}
        }

class SugerenciaConsultaSerializer(serializers.ModelSerializer):
    """
    Serializer para el Buzón Digital de participación y consulta de trabajadores.
    Soporta tanto la creación pública (trabajador sin cuenta) como la lectura y
    actualización por parte del prevencionista desde su panel privado.
    """
    username = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = SugerenciaConsulta
        fields = (
            'id', 'uuid', 'usuario', 'username', 'tipo', 'mensaje', 'anonimo',
            'nombre_remitente', 'contacto_remitente',
            'leido', 'respuesta', 'fecha_creacion', 'fecha_respuesta'
        )
        extra_kwargs = {
            'usuario': {'required': False, 'allow_null': True},
            'leido': {'read_only': False},
            'respuesta': {'read_only': False},
        }


class TrabajadorSubcontratadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrabajadorSubcontratado
        fields = '__all__'


class DocumentoContratistaSerializer(serializers.ModelSerializer):
    estado_calculado = serializers.ReadOnlyField()

    class Meta:
        model = DocumentoContratista
        fields = (
            'id', 'contratista', 'tipo', 'nombre_personalizado',
            'fecha_emision', 'fecha_vencimiento', 'archivo',
            'notas', 'fecha_carga', 'estado_calculado'
        )


class ContratistaSerializer(serializers.ModelSerializer):
    documentos = DocumentoContratistaSerializer(many=True, read_only=True)
    trabajadores = TrabajadorSubcontratadoSerializer(many=True, read_only=True)
    estado_cumplimiento = serializers.ReadOnlyField()

    class Meta:
        model = Contratista
        fields = (
            'id', 'usuario', 'razon_social', 'rut', 'tipo', 'giro',
            'nombre_representante', 'email_contacto', 'telefono_contacto',
            'activo', 'fecha_ingreso', 'observaciones', 'fecha_creacion',
            'documentos', 'trabajadores', 'estado_cumplimiento'
        )
        extra_kwargs = {
            'usuario': {'required': False, 'read_only': True}
        }


class ContratistaResumenSerializer(serializers.ModelSerializer):
    estado_cumplimiento = serializers.ReadOnlyField()
    cant_trabajadores = serializers.SerializerMethodField()
    cant_documentos = serializers.SerializerMethodField()

    class Meta:
        model = Contratista
        fields = (
            'id', 'razon_social', 'rut', 'tipo', 'activo', 'fecha_ingreso',
            'estado_cumplimiento', 'cant_trabajadores', 'cant_documentos'
        )

    def get_cant_trabajadores(self, obj):
        return obj.trabajadores.filter(activo=True).count()

    def get_cant_documentos(self, obj):
        return obj.documentos.count()


class SolicitudCapacitacionSerializer(serializers.ModelSerializer):
    """
    Serializador para solicitudes de capacitaciones externas y relatorías presenciales/online.
    """
    username = serializers.CharField(source='usuario.username', read_only=True)
    tipo_capacitacion_display = serializers.CharField(source='get_tipo_capacitacion_display', read_only=True)
    modalidad_display = serializers.CharField(source='get_modalidad_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = SolicitudCapacitacion
        fields = (
            'id', 'usuario', 'username', 'empresa', 'rut_empresa',
            'contacto_nombre', 'contacto_cargo', 'contacto_email', 'contacto_telefono',
            'tipo_capacitacion', 'tipo_capacitacion_display',
            'modalidad', 'modalidad_display',
            'region_comuna', 'cantidad_trabajadores', 'fecha_tentativa',
            'mensaje_adicional', 'estado', 'estado_display',
            'notas_internas', 'fecha_creacion', 'fecha_actualizacion'
        )
        read_only_fields = ('id', 'fecha_creacion', 'fecha_actualizacion')
        extra_kwargs = {
            'usuario': {'required': False, 'allow_null': True},
            'notas_internas': {'required': False, 'allow_blank': True},
            'contacto_cargo': {'required': False, 'allow_blank': True},
            'mensaje_adicional': {'required': False, 'allow_blank': True},
            'fecha_tentativa': {'required': False, 'allow_null': True},
        }


class CentroTrabajoSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    empresa_rut = serializers.CharField(source='empresa.rut', read_only=True)
    cant_trabajadores = serializers.SerializerMethodField()

    class Meta:
        model = CentroTrabajo
        fields = (
            'id', 'empresa', 'empresa_nombre', 'empresa_rut',
            'nombre', 'direccion', 'comuna', 'region',
            'es_casa_matriz', 'cant_trabajadores', 'fecha_creacion'
        )

    def get_cant_trabajadores(self, obj):
        return obj.trabajadores.filter(estado=Trabajador.ESTADO_ACTIVO).count()


class TrabajadorSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)

    class Meta:
        model = Trabajador
        fields = (
            'id', 'empresa', 'empresa_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'rut', 'nombres', 'apellidos', 'nombre_completo',
            'cargo', 'correo', 'telefono', 'fecha_ingreso',
            'estado', 'fecha_creacion'
        )

    def validate_rut(self, value):
        from .models import validar_rut_chileno
        validar_rut_chileno(value)
        return value


class EmpresaSerializer(serializers.ModelSerializer):
    prevencionista_username = serializers.CharField(source='prevencionista.username', read_only=True)
    centros_trabajo = CentroTrabajoSerializer(many=True, read_only=True)
    cant_centros = serializers.SerializerMethodField()
    cant_trabajadores = serializers.SerializerMethodField()

    class Meta:
        model = Empresa
        fields = (
            'id', 'prevencionista', 'prevencionista_username',
            'razon_social', 'nombre_fantasia', 'rut', 'giro',
            'mutualidad', 'tasa_cotizacion_adicional', 'activo',
            'fecha_creacion', 'centros_trabajo', 'cant_centros', 'cant_trabajadores'
        )
        extra_kwargs = {
            'prevencionista': {'read_only': True}
        }

    def validate_rut(self, value):
        from .models import validar_rut_chileno
        validar_rut_chileno(value)
        return value

    def get_cant_centros(self, obj):
        return obj.centros_trabajo.count()

    def get_cant_trabajadores(self, obj):
        return obj.trabajadores.filter(estado=Trabajador.ESTADO_ACTIVO).count()


class AuditLogAccesoDenunciaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = AuditLogAccesoDenuncia
        fields = ('id', 'denuncia', 'usuario', 'usuario_nombre', 'fecha_hora', 'ip_origen', 'accion')
        read_only_fields = ('id', 'fecha_hora', 'ip_origen')


class SugerenciaLaboralSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = SugerenciaLaboral
        fields = (
            'id', 'uuid', 'empresa', 'empresa_nombre',
            'mensaje', 'tipo', 'tipo_display', 'es_anonimo',
            'nombre_remitente', 'contacto_remitente',
            'estado', 'estado_display', 'respuesta', 'fecha_creacion'
        )
        read_only_fields = ('id', 'uuid', 'fecha_creacion')


class DenunciaLeyKarinSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    tipo_afectacion_display = serializers.CharField(source='get_tipo_afectacion_display', read_only=True)
    estado_tramite_display = serializers.CharField(source='get_estado_tramite_display', read_only=True)
    horas_restantes = serializers.FloatField(read_only=True)
    semaforo = serializers.CharField(read_only=True)
    accesos_auditoria = AuditLogAccesoDenunciaSerializer(many=True, read_only=True)

    class Meta:
        model = DenunciaLeyKarin
        fields = (
            'id', 'uuid', 'empresa', 'empresa_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'tipo_afectacion', 'tipo_afectacion_display',
            'rut_denunciante', 'nombre_denunciante',
            'correo_denunciante', 'telefono_denunciante',
            'nombre_denunciado', 'cargo_area_denunciado',
            'descripcion_circunstanciada', 'testigos_o_evidencias',
            'fecha_hora_ingreso', 'plazo_limite_derivacion_dt',
            'estado_tramite', 'estado_tramite_display',
            'medidas_resguardo_detalle', 'derivada_inspeccion_trabajo',
            'folio_dt', 'horas_restantes', 'semaforo',
            'accesos_auditoria'
        )
        read_only_fields = (
            'id', 'uuid', 'fecha_hora_ingreso', 'plazo_limite_derivacion_dt',
            'horas_restantes', 'semaforo', 'accesos_auditoria'
        )

    def validate_rut_denunciante(self, value):
        from .models import validar_rut_chileno
        validar_rut_chileno(value)
        return value


class DenunciaLeyKarinPublicaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DenunciaLeyKarin
        fields = (
            'id', 'uuid', 'empresa', 'centro_trabajo',
            'tipo_afectacion', 'rut_denunciante', 'nombre_denunciante',
            'correo_denunciante', 'telefono_denunciante',
            'nombre_denunciado', 'cargo_area_denunciado',
            'descripcion_circunstanciada', 'testigos_o_evidencias'
        )
        read_only_fields = ('id', 'uuid')

    def validate_rut_denunciante(self, value):
        from .models import validar_rut_chileno
        validar_rut_chileno(value)
        return value




