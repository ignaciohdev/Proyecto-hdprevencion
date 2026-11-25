from typing import Any
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
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
    SugerenciaLaboral, DenunciaLeyKarin, AuditLogAccesoDenuncia,
    ComiteParitario, MiembroCPHS, ActaSesionCPHS,
    EntregaEPP,
    RequisitoLegalBase, MatrizLegal, ItemMatrizLegal,
    MatrizRiesgoMiper, ItemMatrizRiesgo,
    SolicitudDerechoARCO
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
        read_only_fields = ('id', 'uuid', 'tipo_usuario', 'cuenta_padre')

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
        fields = ('username', 'email', 'password', 'password_confirm')
        extra_kwargs = {
            'email': {'required': True}
        }

    def validate(self, attrs):
        # 1. Validar coincidencia de contraseña
        if attrs['password'] != attrs['password_confirm']:
            raise ValidationError({"password": "Las contraseñas ingresadas no coinciden."})

        # 2. Validar fortaleza mínima según AUTH_PASSWORD_VALIDATORS de Django (Ley 21.719 / P1)
        temp_user = Usuario(
            username=attrs.get('username', ''),
            email=attrs.get('email', ''),
        )
        try:
            validate_password(attrs['password'], user=temp_user)
        except DjangoValidationError as exc:
            raise ValidationError({"password": list(exc.messages)})

        # 3. Validar correo electrónico único (Django por defecto valida username, pero no email como unique)
        email = attrs.get('email')
        if Usuario.objects.filter(email=email).exists():
            raise ValidationError({"email": "Ya existe un usuario registrado con este correo electrónico."})

        return attrs

    def create(self, validated_data):
        # Remover campos temporales del diccionario de validación
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        # Blindaje Ley 21.719 (C-1): todo nuevo registro es INDIVIDUAL e independiente por defecto
        validated_data['tipo_usuario'] = 'INDIVIDUAL'
        validated_data['cuenta_padre'] = None
        
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

    def validate_empresa(self, value):
        request = self.context.get('request')
        if request and request.user and not request.user.is_anonymous:
            from .views import get_usuarios_grupo
            usuarios_grupo = get_usuarios_grupo(request.user)
            if value.prevencionista not in usuarios_grupo:
                raise serializers.ValidationError("Empresa no válida o no encontrada.")
        return value

    def validate_centro_trabajo(self, value):
        if not value:
            return value
        request = self.context.get('request')
        if request and request.user and not request.user.is_anonymous:
            from .views import get_usuarios_grupo
            usuarios_grupo = get_usuarios_grupo(request.user)
            if value.empresa.prevencionista not in usuarios_grupo:
                raise serializers.ValidationError("Centro de trabajo no válido o no encontrado.")
        return value


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
            'arbol_de_causas', 'plazo_investigacion_suseso_30d', 'reanudacion_autorizada', 'resolucion_reanudacion_dt_seremi',
            'dias_perdidos', 'alta_medica',
            'fecha_creacion'
        )
        extra_kwargs = {
            'usuario': {'required': False}
        }

    def validate_empresa(self, value):
        request = self.context.get('request')
        if request and request.user and not request.user.is_anonymous:
            from .views import get_usuarios_grupo
            usuarios_grupo = get_usuarios_grupo(request.user)
            if value.prevencionista not in usuarios_grupo:
                raise serializers.ValidationError("Empresa no válida o no encontrada.")
        return value

    def validate_trabajador(self, value):
        if not value:
            return value
        request = self.context.get('request')
        if request and request.user and not request.user.is_anonymous:
            from .views import get_usuarios_grupo
            usuarios_grupo = get_usuarios_grupo(request.user)
            if value.empresa.prevencionista not in usuarios_grupo:
                raise serializers.ValidationError("Trabajador no válido o no encontrado.")
        return value


class TemaCapacitacionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)

    class Meta:
        model = TemaCapacitacion
        fields = (
            'id', 'usuario', 'username', 'titulo', 'descripcion',
            'categoria', 'categoria_display', 'duracion_minutos', 'contenido_clave',
            'es_conferencia_grabada', 'precio_clp', 'video_url',
            'normativa_legal_vigente', 'organismo_exigente',
            'requiere_evaluacion', 'porcentaje_aprobacion',
            'preguntas_evaluacion', 'relator_predeterminado',
            'fecha_creacion'
        )
        extra_kwargs = {
            'usuario': {'required': False, 'allow_null': True}
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
            'asistentes', 'observaciones',
            'evaluacion_comprension_aplicada', 'porcentaje_aprobacion_minimo',
            'entidad_capacitadora', 'codigo_sence', 'certificado_emitido',
            'fecha_creacion'
        )
        extra_kwargs = {
            'usuario': {'required': False}
        }

    def validate_empresa(self, value):
        request = self.context.get('request')
        if request and request.user and not request.user.is_anonymous:
            from .views import get_usuarios_grupo
            usuarios_grupo = get_usuarios_grupo(request.user)
            if value.prevencionista not in usuarios_grupo:
                raise serializers.ValidationError("Empresa no válida o no encontrada.")
        return value

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
    empresa_principal_nombre = serializers.CharField(source='empresa_principal.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    documentos = DocumentoContratistaSerializer(many=True, read_only=True)
    trabajadores = TrabajadorSubcontratadoSerializer(many=True, read_only=True)
    estado_cumplimiento = serializers.ReadOnlyField()

    class Meta:
        model = Contratista
        fields = (
            'id', 'usuario', 'empresa_principal', 'empresa_principal_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'razon_social', 'rut', 'tipo', 'giro',
            'nombre_representante', 'email_contacto', 'telefono_contacto',
            'activo', 'fecha_ingreso', 'observaciones', 'fecha_creacion',
            'documentos', 'trabajadores', 'estado_cumplimiento'
        )
        extra_kwargs = {
            'usuario': {'required': False, 'read_only': True}
        }


class ContratistaResumenSerializer(serializers.ModelSerializer):
    empresa_principal_nombre = serializers.CharField(source='empresa_principal.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    estado_cumplimiento = serializers.ReadOnlyField()
    cant_trabajadores = serializers.SerializerMethodField()
    cant_documentos = serializers.SerializerMethodField()

    class Meta:
        model = Contratista
        fields = (
            'id', 'empresa_principal', 'empresa_principal_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'razon_social', 'rut', 'tipo', 'activo', 'fecha_ingreso',
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
    tema_titulo = serializers.CharField(source='tema.titulo', read_only=True)
    tema_detalle = TemaCapacitacionSerializer(source='tema', read_only=True)

    class Meta:
        model = SolicitudCapacitacion
        fields = (
            'id', 'usuario', 'username', 'empresa', 'rut_empresa',
            'contacto_nombre', 'contacto_cargo', 'contacto_email', 'contacto_telefono',
            'tipo_capacitacion', 'tipo_capacitacion_display',
            'tema', 'tema_titulo', 'tema_detalle', 'perfil_relator',
            'modalidad', 'modalidad_display',
            'region_comuna', 'cantidad_trabajadores', 'fecha_tentativa',
            'mensaje_adicional', 'estado', 'estado_display',
            'notas_internas', 'fecha_creacion', 'fecha_actualizacion'
        )
        read_only_fields = ('id', 'fecha_creacion', 'fecha_actualizacion')
        extra_kwargs = {
            'usuario': {'required': False, 'allow_null': True},
            'tema': {'required': False, 'allow_null': True},
            'perfil_relator': {'required': False, 'allow_blank': True},
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


class DenunciaLeyKarinListSerializer(serializers.ModelSerializer):
    """
    Serializer de lista para canal Ley Karin (Ley N° 21.643 / D.S. 44).
    Enmascara por confidencialidad estricta y resguardo de datos personales
    todos los datos identificatorios de personas y relato pormenorizado.
    """
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    tipo_afectacion_display = serializers.CharField(source='get_tipo_afectacion_display', read_only=True)
    estado_tramite_display = serializers.CharField(source='get_estado_tramite_display', read_only=True)
    codigo_seguimiento = serializers.CharField(read_only=True)
    horas_restantes = serializers.FloatField(read_only=True)
    dias_restantes_mutualidad = serializers.IntegerField(read_only=True)
    semaforo = serializers.CharField(read_only=True)

    class Meta:
        model = DenunciaLeyKarin
        fields = (
            'id', 'uuid', 'codigo_seguimiento', 'empresa', 'empresa_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'tipo_afectacion', 'tipo_afectacion_display',
            'fecha_hora_ingreso', 'plazo_limite_derivacion_dt',
            'plazo_limite_informe_mutualidad_5d', 'dias_restantes_mutualidad',
            'estado_tramite', 'estado_tramite_display',
            'derivada_inspeccion_trabajo', 'derivada_mutualidad',
            'horas_restantes', 'semaforo'
        )
        read_only_fields = (
            'id', 'uuid', 'codigo_seguimiento', 'fecha_hora_ingreso',
            'plazo_limite_derivacion_dt', 'plazo_limite_informe_mutualidad_5d',
            'dias_restantes_mutualidad', 'horas_restantes', 'semaforo'
        )


class DenunciaLeyKarinSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    tipo_afectacion_display = serializers.CharField(source='get_tipo_afectacion_display', read_only=True)
    estado_tramite_display = serializers.CharField(source='get_estado_tramite_display', read_only=True)
    codigo_seguimiento = serializers.CharField(read_only=True)
    horas_restantes = serializers.FloatField(read_only=True)
    dias_restantes_mutualidad = serializers.IntegerField(read_only=True)
    semaforo = serializers.CharField(read_only=True)
    accesos_auditoria = AuditLogAccesoDenunciaSerializer(many=True, read_only=True)

    class Meta:
        model = DenunciaLeyKarin
        fields = (
            'id', 'uuid', 'codigo_seguimiento', 'empresa', 'empresa_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'tipo_afectacion', 'tipo_afectacion_display',
            'rut_denunciante', 'nombre_denunciante',
            'correo_denunciante', 'telefono_denunciante',
            'nombre_denunciado', 'cargo_area_denunciado',
            'descripcion_circunstanciada', 'testigos_o_evidencias',
            'fecha_hora_ingreso', 'plazo_limite_derivacion_dt',
            'estado_tramite', 'estado_tramite_display',
            'medidas_resguardo_detalle', 'derivada_inspeccion_trabajo',
            'folio_dt',
            'derivada_mutualidad', 'fecha_derivacion_mutualidad', 'folio_mutualidad',
            'comprobante_anexo_67', 'atencion_psicologica_ofrecida',
            'fecha_ofrecimiento_psicologico', 'plazo_limite_informe_mutualidad_5d',
            'dias_restantes_mutualidad',
            'horas_restantes', 'semaforo',
            'accesos_auditoria'
        )
        read_only_fields = (
            'id', 'uuid', 'codigo_seguimiento', 'fecha_hora_ingreso', 'plazo_limite_derivacion_dt',
            'plazo_limite_informe_mutualidad_5d', 'dias_restantes_mutualidad',
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


class MiembroCPHSSerializer(serializers.ModelSerializer):
    estamento_display = serializers.CharField(source='get_estamento_display', read_only=True)
    tipo_representacion_display = serializers.CharField(source='get_tipo_representacion_display', read_only=True)
    cargo_display = serializers.CharField(source='get_cargo_display', read_only=True)
    causal_cese_display = serializers.CharField(source='get_causal_cese_display', read_only=True)

    class Meta:
        model = MiembroCPHS
        fields = (
            'id', 'comite', 'trabajador', 'nombre', 'rut',
            'estamento', 'estamento_display',
            'tipo_representacion', 'tipo_representacion_display',
            'cargo', 'cargo_display', 'activo',
            'tiene_fuero_laboral', 'causal_cese', 'causal_cese_display',
            'fecha_designacion', 'fecha_creacion'
        )

    def validate_rut(self, value):
        from .models import validar_rut_chileno
        validar_rut_chileno(value)
        return value


class ActaSesionCPHSSerializer(serializers.ModelSerializer):
    comite_nombre = serializers.CharField(source='comite.nombre', read_only=True)
    tipo_sesion_display = serializers.CharField(source='get_tipo_sesion_display', read_only=True)
    numero_acta = serializers.IntegerField(required=False, allow_null=True)
    total_acuerdos = serializers.SerializerMethodField()
    acuerdos_cumplidos = serializers.SerializerMethodField()

    class Meta:
        model = ActaSesionCPHS
        fields = (
            'id', 'comite', 'comite_nombre', 'numero_acta',
            'tipo_sesion', 'tipo_sesion_display', 'fecha_hora_sesion',
            'lugar', 'asistentes', 'tabla_temas', 'acuerdos',
            'fecha_creacion', 'total_acuerdos', 'acuerdos_cumplidos'
        )
        extra_kwargs = {
            'numero_acta': {'required': False}
        }

    def get_total_acuerdos(self, obj):
        if isinstance(obj.acuerdos, list):
            return len(obj.acuerdos)
        return 0

    def get_acuerdos_cumplidos(self, obj):
        if isinstance(obj.acuerdos, list):
            return sum(1 for a in obj.acuerdos if isinstance(a, dict) and a.get('cumplido') is True)
        return 0


class ComiteParitarioSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    dias_restantes_mandato = serializers.IntegerField(read_only=True)
    miembros = MiembroCPHSSerializer(many=True, read_only=True)
    total_miembros = serializers.SerializerMethodField()
    total_actas = serializers.SerializerMethodField()

    class Meta:
        model = ComiteParitario
        fields = (
            'id', 'empresa', 'empresa_nombre',
            'centro_trabajo', 'centro_trabajo_nombre',
            'nombre', 'fecha_constitucion', 'fecha_vencimiento_mandato',
            'estado', 'estado_display', 'dias_restantes_mandato',
            'folio_registro_rel_dt', 'fecha_registro_rel_dt', 'alerta_plazo_rel_15dias',
            'miembros', 'total_miembros', 'total_actas', 'fecha_creacion'
        )

    def get_total_miembros(self, obj):
        return obj.miembros.filter(activo=True).count()

    def get_total_actas(self, obj):
        return obj.actas.count()


class EntregaEPPSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    empresa_rut = serializers.CharField(source='empresa.rut', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    trabajador_nombres = serializers.CharField(source='trabajador.nombres', read_only=True)
    trabajador_apellidos = serializers.CharField(source='trabajador.apellidos', read_only=True)
    trabajador_nombre_completo = serializers.SerializerMethodField()
    trabajador_rut = serializers.CharField(source='trabajador.rut', read_only=True)
    trabajador_cargo = serializers.CharField(source='trabajador.cargo', read_only=True)
    responsable_nombre = serializers.CharField(source='responsable_entrega.username', read_only=True)
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = EntregaEPP
        fields = (
            'id', 'empresa', 'empresa_nombre', 'empresa_rut',
            'centro_trabajo', 'centro_trabajo_nombre',
            'trabajador', 'trabajador_nombres', 'trabajador_apellidos',
            'trabajador_nombre_completo', 'trabajador_rut', 'trabajador_cargo',
            'responsable_entrega', 'responsable_nombre',
            'items_epp', 'entrega_riohs', 'version_riohs',
            'declaracion_capacitacion', 'firma_digital',
            'ip_registro', 'fecha_hora_entrega', 'total_items'
        )
        read_only_fields = ('id', 'responsable_entrega', 'ip_registro', 'fecha_hora_entrega')

    def get_trabajador_nombre_completo(self, obj):
        if obj.trabajador:
            return f"{obj.trabajador.nombres} {obj.trabajador.apellidos}".strip()
        return ""

    def get_total_items(self, obj):
        if isinstance(obj.items_epp, list):
            return sum(int(item.get('cantidad', 1)) for item in obj.items_epp if isinstance(item, dict))
        return 0


class RequisitoLegalBaseSerializer(serializers.ModelSerializer):
    organismo_display = serializers.CharField(source='get_organismo_display', read_only=True)
    tipo_norma_display = serializers.CharField(source='get_tipo_norma_display', read_only=True)
    rubro_display = serializers.CharField(source='get_rubro_aplicable_display', read_only=True)

    class Meta:
        model = RequisitoLegalBase
        fields = (
            'id', 'organismo', 'organismo_display',
            'tipo_norma', 'tipo_norma_display',
            'identificacion_norma', 'articulo', 'titulo',
            'descripcion_exigencia', 'sancion_multa',
            'rubro_aplicable', 'rubro_display',
            'condicion_activacion', 'orden', 'activo'
        )


class ItemMatrizLegalSerializer(serializers.ModelSerializer):
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = ItemMatrizLegal
        fields = (
            'id', 'matriz', 'requisito_base',
            'organismo', 'tipo_norma', 'identificacion_norma',
            'articulo', 'titulo', 'descripcion_exigencia',
            'sancion_multa', 'estado', 'estado_display',
            'evidencia_cumplimiento', 'responsable',
            'fecha_compromiso', 'fecha_verificacion',
            'observaciones', 'orden'
        )
        read_only_fields = (
            'id', 'matriz', 'requisito_base',
            'organismo', 'tipo_norma', 'identificacion_norma',
            'articulo', 'titulo', 'descripcion_exigencia', 'sancion_multa'
        )


class MatrizLegalSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    empresa_rut = serializers.CharField(source='empresa.rut', read_only=True)
    empresa_mutualidad = serializers.CharField(source='empresa.mutualidad', read_only=True)
    empresa_giro = serializers.CharField(source='empresa.giro', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    prevencionista_nombre = serializers.CharField(source='prevencionista.username', read_only=True)
    rubro_principal_display = serializers.CharField(source='get_rubro_principal_display', read_only=True)

    total_requisitos = serializers.IntegerField(read_only=True)
    cumplidos = serializers.IntegerField(read_only=True)
    en_proceso = serializers.IntegerField(read_only=True)
    brechas_criticas = serializers.IntegerField(read_only=True)
    porcentaje_cumplimiento = serializers.FloatField(read_only=True)
    estado_semaforo = serializers.CharField(read_only=True)

    items = ItemMatrizLegalSerializer(many=True, read_only=True)

    class Meta:
        model = MatrizLegal
        fields = (
            'id', 'empresa', 'empresa_nombre', 'empresa_rut',
            'empresa_mutualidad', 'empresa_giro',
            'centro_trabajo', 'centro_trabajo_nombre',
            'prevencionista', 'prevencionista_nombre',
            'rubro_principal', 'rubro_principal_display',
            'condiciones_faena', 'observacion_general',
            'fecha_creacion', 'fecha_actualizacion',
            'total_requisitos', 'cumplidos', 'en_proceso',
            'brechas_criticas', 'porcentaje_cumplimiento',
            'estado_semaforo', 'items'
        )
        read_only_fields = (
            'id', 'prevencionista', 'fecha_creacion', 'fecha_actualizacion',
            'total_requisitos', 'cumplidos', 'en_proceso',
            'brechas_criticas', 'porcentaje_cumplimiento', 'estado_semaforo'
        )


class ItemMatrizRiesgoSerializer(serializers.ModelSerializer):
    magnitud_pura = serializers.IntegerField(read_only=True)
    clasificacion_pura = serializers.CharField(read_only=True)
    magnitud_residual = serializers.IntegerField(read_only=True)
    clasificacion_residual = serializers.CharField(read_only=True)
    tipo_actividad_display = serializers.CharField(source='get_tipo_actividad_display', read_only=True)
    clasificacion_peligro_display = serializers.CharField(source='get_clasificacion_peligro_display', read_only=True)
    estado_control_display = serializers.CharField(source='get_estado_control_display', read_only=True)

    class Meta:
        model = ItemMatrizRiesgo
        fields = (
            'id', 'matriz', 'proceso', 'actividad', 'tipo_actividad', 'tipo_actividad_display',
            'puesto_trabajo', 'peligro', 'clasificacion_peligro', 'clasificacion_peligro_display',
            'riesgo_consecuencia',
            'es_accidente_grave_fatal', 'trabajador_sensible',
            'probabilidad_pura', 'severidad_pura', 'magnitud_pura', 'clasificacion_pura',
            'controles_existentes',
            'controles_requeridos',
            'control_eliminacion', 'control_sustitucion', 'control_ingenieria',
            'control_administrativo', 'control_epp',
            'probabilidad_residual', 'severidad_residual', 'magnitud_residual', 'clasificacion_residual',
            'responsable', 'plazo_implementacion', 'estado_control', 'estado_control_display',
            'orden'
        )
        read_only_fields = (
            'id', 'magnitud_pura', 'clasificacion_pura', 'magnitud_residual', 'clasificacion_residual'
        )

    def validate_probabilidad_pura(self, value):
        if value < 1 or value > 5:
            raise ValidationError("La probabilidad pura debe estar entre 1 y 5.")
        return value

    def validate_severidad_pura(self, value):
        if value < 1 or value > 5:
            raise ValidationError("La severidad pura debe estar entre 1 y 5.")
        return value

    def validate_probabilidad_residual(self, value):
        if value < 1 or value > 5:
            raise ValidationError("La probabilidad residual debe estar entre 1 y 5.")
        return value

    def validate_severidad_residual(self, value):
        if value < 1 or value > 5:
            raise ValidationError("La severidad residual debe estar entre 1 y 5.")
        return value

    def validate(self, data):
        data = super().validate(data)
        p_pura = data.get('probabilidad_pura', getattr(self.instance, 'probabilidad_pura', 2))
        s_pura = data.get('severidad_pura', getattr(self.instance, 'severidad_pura', 2))
        p_res = data.get('probabilidad_residual', getattr(self.instance, 'probabilidad_residual', 2))
        s_res = data.get('severidad_residual', getattr(self.instance, 'severidad_residual', 2))

        mag_pura = p_pura * s_pura
        mag_res = p_res * s_res
        if mag_res < mag_pura:
            controles = [
                data.get('control_eliminacion', getattr(self.instance, 'control_eliminacion', '')),
                data.get('control_sustitucion', getattr(self.instance, 'control_sustitucion', '')),
                data.get('control_ingenieria', getattr(self.instance, 'control_ingenieria', '')),
                data.get('control_administrativo', getattr(self.instance, 'control_administrativo', '')),
                data.get('control_epp', getattr(self.instance, 'control_epp', '')),
                data.get('controles_requeridos', getattr(self.instance, 'controles_requeridos', '')),
            ]
            if not any(c and str(c).strip() for c in controles):
                raise serializers.ValidationError(
                    "Artículos 9 y 10 D.S. N° 44: No es legal reducir el riesgo residual sin registrar al menos una medida de control de la jerarquía preventiva o un control requerido."
                )

        es_grave = data.get('es_accidente_grave_fatal', getattr(self.instance, 'es_accidente_grave_fatal', False))
        if es_grave and (s_pura < 4 and mag_pura < 17):
            raise serializers.ValidationError({
                "es_accidente_grave_fatal": "Circular SUSESO N° 3336 / Art. 184 bis Código del Trabajo: Los peligros con potencial de accidente grave o fatal deben evaluarse con Severidad mayor o igual a 4 o Magnitud Pura en rango Crítico (17-25)."
            })

        return data


class MatrizRiesgoMiperSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    empresa_rut = serializers.CharField(source='empresa.rut', read_only=True)
    empresa_giro = serializers.CharField(source='empresa.giro', read_only=True)
    centro_trabajo_nombre = serializers.CharField(source='centro_trabajo.nombre', read_only=True)
    prevencionista_nombre = serializers.CharField(source='prevencionista.username', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    total_peligros = serializers.IntegerField(read_only=True)
    criticos_puros = serializers.IntegerField(read_only=True)
    altos_puros = serializers.IntegerField(read_only=True)
    criticos_residuales = serializers.IntegerField(read_only=True)
    altos_residuales = serializers.IntegerField(read_only=True)
    medios_residuales = serializers.IntegerField(read_only=True)
    bajos_residuales = serializers.IntegerField(read_only=True)
    porcentaje_reduccion_riesgo = serializers.FloatField(read_only=True)

    items = ItemMatrizRiesgoSerializer(many=True, read_only=True)

    class Meta:
        model = MatrizRiesgoMiper
        fields = (
            'id', 'empresa', 'empresa_nombre', 'empresa_rut', 'empresa_giro',
            'centro_trabajo', 'centro_trabajo_nombre',
            'prevencionista', 'prevencionista_nombre',
            'nombre', 'proceso_area', 'version',
            'estado', 'estado_display',
            'fecha_aprobacion', 'fecha_proxima_revision',
            'fecha_creacion', 'fecha_actualizacion',
            'total_peligros', 'criticos_puros', 'altos_puros',
            'criticos_residuales', 'altos_residuales', 'medios_residuales', 'bajos_residuales',
            'porcentaje_reduccion_riesgo',
            'items'
        )
        read_only_fields = (
            'id', 'prevencionista', 'fecha_creacion', 'fecha_actualizacion',
            'total_peligros', 'criticos_puros', 'altos_puros',
            'criticos_residuales', 'altos_residuales', 'medios_residuales', 'bajos_residuales',
            'porcentaje_reduccion_riesgo'
        )


class SolicitudDerechoARCOSerializer(serializers.ModelSerializer):
    """
    Serializer para el ingreso y gestión interna de solicitudes ARCO-POL (Ley N° 21.719).
    """
    tipo_derecho_display = serializers.CharField(source='get_tipo_derecho_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = SolicitudDerechoARCO
        fields = (
            'uuid', 'tipo_derecho', 'tipo_derecho_display',
            'rut_titular', 'nombre_titular', 'email_titular', 'telefono_titular',
            'detalle_solicitud', 'estado', 'estado_display',
            'fecha_solicitud', 'fecha_limite_30d', 'bloqueo_provisional_activo',
            'respuesta_formal', 'fecha_resolucion'
        )
        read_only_fields = (
            'uuid', 'estado', 'fecha_solicitud', 'fecha_limite_30d',
            'bloqueo_provisional_activo', 'respuesta_formal', 'fecha_resolucion'
        )


class SolicitudDerechoARCOStatusSerializer(serializers.ModelSerializer):
    """
    Serializer mínimo para consulta pública por UUID sin exponer PII ni contenido sensible.
    """
    tipo_derecho_display = serializers.CharField(source='get_tipo_derecho_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = SolicitudDerechoARCO
        fields = (
            'uuid', 'tipo_derecho', 'tipo_derecho_display',
            'estado', 'estado_display',
            'fecha_solicitud', 'fecha_limite_30d',
            'bloqueo_provisional_activo', 'fecha_resolucion'
        )
        read_only_fields = fields







