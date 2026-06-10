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
    TemaCapacitacion, RegistroCapacitacion
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
        fields = ('id', 'username', 'email', 'tipo_usuario', 'cuenta_padre', 'suscripcion_activa', 'contador_descargas', 'foto_perfil')

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
            if not usuario.cuenta_padre:
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

    class Meta:
        model = ReporteRiesgo
        fields = ('id', 'usuario', 'username', 'tipo', 'descripcion', 'lugar', 'gravedad', 'estado', 'medida_correctiva', 'fecha_creacion')
        extra_kwargs = {
            'usuario': {'required': False}
        }


class PlantillaInspeccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaInspeccion
        fields = '__all__'


class InspeccionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)
    plantilla_nombre = serializers.CharField(source='plantilla.nombre', read_only=True)

    class Meta:
        model = Inspeccion
        fields = ('id', 'usuario', 'username', 'plantilla', 'plantilla_nombre', 'fecha', 'respuestas', 'porcentaje_cumplimiento', 'firma_nombre', 'firma_rut')
        extra_kwargs = {
            'usuario': {'required': False},
            'porcentaje_cumplimiento': {'required': False}
        }


class InvestigacionAccidenteSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = InvestigacionAccidente
        fields = (
            'id', 'usuario', 'username',
            'nombre_afectado', 'rut_afectado', 'cargo_afectado', 'edad_afectado', 'antiguedad_afectado',
            'tipo_evento', 'fecha_hora_evento', 'lugar_evento', 'descripcion_evento',
            'tipo_lesion', 'parte_cuerpo_afectada',
            'causas_inmediatas', 'causas_basicas', 'analisis_5_porques',
            'plan_accion', 'fecha_creacion'
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

    class Meta:
        model = RegistroCapacitacion
        fields = (
            'id', 'usuario', 'username', 'tema', 'tema_titulo', 'tema_detalle',
            'estado', 'fecha_programada', 'fecha_realizacion', 'lugar',
            'asistentes', 'observaciones', 'fecha_creacion'
        )
        extra_kwargs = {
            'usuario': {'required': False}
        }



