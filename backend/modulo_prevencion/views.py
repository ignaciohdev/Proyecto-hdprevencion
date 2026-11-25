import uuid
from typing import Any
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.shortcuts import get_object_or_404
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.conf import settings
from rest_framework import generics, permissions, status, viewsets, exceptions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, MethodNotAllowed
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from .models import (
    PlantillaMaestra, DocumentoUsuario, Noticia, MensajeContacto, Servicio, Plan, Suscripcion, ContadorDescargas,
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
    SolicitudDerechoARCO, RegistroConsentimiento,
    AuditLogEventoSeguridad,
    validar_rut_chileno
)
from .serializers import (
    RegisterSerializer, UsuarioSerializer, PlanSerializer,
    PlantillaMaestraSerializer, DocumentoUsuarioSerializer,
    NoticiaSerializer, MensajeContactoSerializer, ServicioSerializer,
    ReporteRiesgoSerializer, PlantillaInspeccionSerializer, InspeccionSerializer,
    InvestigacionAccidenteSerializer,
    TemaCapacitacionSerializer, RegistroCapacitacionSerializer,
    SugerenciaConsultaSerializer,
    ContratistaSerializer, ContratistaResumenSerializer,
    DocumentoContratistaSerializer, TrabajadorSubcontratadoSerializer,
    SolicitudCapacitacionSerializer,
    EmpresaSerializer, CentroTrabajoSerializer, TrabajadorSerializer,
    SugerenciaLaboralSerializer, DenunciaLeyKarinSerializer, DenunciaLeyKarinListSerializer,
    AuditLogAccesoDenunciaSerializer, DenunciaLeyKarinPublicaCreateSerializer,
    ComiteParitarioSerializer, MiembroCPHSSerializer, ActaSesionCPHSSerializer,
    EntregaEPPSerializer,
    RequisitoLegalBaseSerializer, MatrizLegalSerializer, ItemMatrizLegalSerializer,
    MatrizRiesgoMiperSerializer, ItemMatrizRiesgoSerializer,
    SolicitudDerechoARCOSerializer, SolicitudDerechoARCOStatusSerializer
)
from .seeder_requisitos import asegurar_requisitos_base
from .mfa import (
    generar_secreto_totp,
    generar_uri_totp,
    verificar_codigo_totp,
    generar_codigos_respaldo,
    consumir_codigo_respaldo,
    crear_challenge_mfa,
    verificar_challenge_mfa,
)
from .consentimiento import registrar_consentimiento
from .auditoria import registrar_evento_seguridad

Usuario: Any = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializador personalizado de SimpleJWT para inyectar claims adicionales
    (como el correo, tipo de cuenta y estado MFA) dentro del payload del token.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Inyectar atributos personalizados del usuario en el payload del JWT
        token['username'] = user.username
        token['email'] = user.email
        token['tipo_usuario'] = user.tipo_usuario
        token['cuenta_padre_id'] = user.cuenta_padre_id
        token['is_superuser'] = user.is_superuser
        token['is_staff'] = user.is_staff
        token['mfa_enabled'] = bool(getattr(user, 'mfa_enabled', False))
        token['mfa_obligatorio'] = bool(getattr(user, 'mfa_obligatorio', False))
        
        return token


def _emitir_respuesta_login_jwt(user: Any) -> Response:
    """Emite access/refresh JWT y fija la cookie HttpOnly de sesión."""
    refresh = CustomTokenObtainPairSerializer.get_token(user)
    payload = {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'mfa_enabled': bool(getattr(user, 'mfa_enabled', False)),
        'mfa_obligatorio': bool(getattr(user, 'mfa_obligatorio', False)),
        'mfa_setup_required': bool(getattr(user, 'mfa_obligatorio', False) and not getattr(user, 'mfa_enabled', False)),
    }
    response = Response(payload, status=status.HTTP_200_OK)
    response.set_cookie(
        key='refresh_token',
        value=payload['refresh'],
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite='None',
        path='/'
    )
    return response


def _verificar_segundo_factor(usuario: Any, raw_code: str) -> bool:
    """Valida código TOTP (anti-replay) o consume código de respaldo de un solo uso."""
    code = (raw_code or '').strip()
    if not code or not getattr(usuario, 'mfa_enabled', False):
        return False
    secret = getattr(usuario, 'mfa_secret', '')
    if secret:
        step = verificar_codigo_totp(secret, code, last_used_step=usuario.mfa_last_used_step)
        if step is not None:
            usuario.mfa_last_used_step = step
            usuario.save(update_fields=['mfa_last_used_step'])
            return True
    return consumir_codigo_respaldo(usuario, code)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vista de Login personalizada:
    - Si el usuario tiene MFA TOTP habilitado y no envía código inline,
      responde mfa_required=True con un challenge_token firmado (sin emitir JWT).
    - Al completar credenciales (+ MFA si aplica), retorna 'access'/'refresh' e inyecta cookie HttpOnly.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        actor_intento = str(request.data.get('username') or request.data.get('email') or 'anonimo')[:150]
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_AUTH,
                accion='LOGIN_FAIL',
                actor_identificador=actor_intento,
                modelo_afectado='Usuario',
                exito=False,
                metadata={'reason': 'token_error'},
            )
            raise InvalidToken(e.args[0])
        except exceptions.APIException:
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_AUTH,
                accion='LOGIN_FAIL',
                actor_identificador=actor_intento,
                modelo_afectado='Usuario',
                exito=False,
                metadata={'reason': 'invalid_credentials'},
            )
            raise

        user = serializer.user
        if getattr(user, 'mfa_enabled', False):
            otp_code = (request.data.get('otp_code') or request.data.get('code') or '').strip()
            if not otp_code:
                registrar_evento_seguridad(
                    request,
                    categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                    accion='MFA_CHALLENGE',
                    usuario=user,
                    modelo_afectado='Usuario',
                    recurso_id=user.pk,
                    exito=True,
                )
                return Response({
                    'mfa_required': True,
                    'challenge_token': crear_challenge_mfa(user.pk),
                    'username': user.username,
                    'mfa_obligatorio': bool(user.mfa_obligatorio),
                }, status=status.HTTP_200_OK)

            if not _verificar_segundo_factor(user, otp_code):
                registrar_evento_seguridad(
                    request,
                    categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                    accion='MFA_FAIL',
                    usuario=user,
                    modelo_afectado='Usuario',
                    recurso_id=user.pk,
                    exito=False,
                    metadata={'flow': 'inline_login'},
                )
                return Response(
                    {
                        'otp_code': ['Código TOTP o de respaldo inválido o ya utilizado.'],
                        'detail': 'Código de verificación MFA inválido o ya utilizado.',
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_AUTH,
            accion='LOGIN_OK',
            usuario=user,
            modelo_afectado='Usuario',
            recurso_id=user.pk,
            exito=True,
            metadata={'mfa': bool(getattr(user, 'mfa_enabled', False))},
        )
        return _emitir_respuesta_login_jwt(user)


class MfaLoginVerifyView(APIView):
    """
    Segundo paso de login para usuarios con MFA TOTP activo (POST /api/auth/mfa/verify/).
    Valida challenge_token + código de 6 dígitos o código de respaldo.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'mfa_verify'

    def post(self, request, *args, **kwargs):
        challenge_token = request.data.get('challenge_token', '')
        code = (request.data.get('code') or request.data.get('otp_code') or '').strip()

        uid = verificar_challenge_mfa(challenge_token)
        if uid is None:
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_FAIL',
                modelo_afectado='Usuario',
                exito=False,
                metadata={'reason': 'invalid_challenge'},
            )
            return Response(
                {'detail': 'El desafío de verificación MFA expiró o es inválido. Inicia sesión nuevamente.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        user = Usuario.objects.filter(pk=uid, is_active=True).first()
        if not user or not getattr(user, 'mfa_enabled', False):
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_FAIL',
                usuario=user,
                modelo_afectado='Usuario',
                recurso_id=uid,
                exito=False,
                metadata={'reason': 'user_unavailable'},
            )
            return Response(
                {'detail': 'Verificación MFA no disponible para esta cuenta.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not _verificar_segundo_factor(user, code):
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_FAIL',
                usuario=user,
                modelo_afectado='Usuario',
                recurso_id=user.pk,
                exito=False,
                metadata={'flow': 'challenge_verify'},
            )
            return Response(
                {'code': ['Código TOTP o de respaldo inválido o ya utilizado.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
            accion='MFA_OK',
            usuario=user,
            modelo_afectado='Usuario',
            recurso_id=user.pk,
            exito=True,
        )
        return _emitir_respuesta_login_jwt(user)


class CustomTokenRefreshView(TokenRefreshView):
    """
    Vista de Refresh JWT con soporte dual:
    - Si no viene 'refresh' en el body, lo extrae de request.COOKIES.get('refresh_token').
    - Emite un nuevo access token y rota el refresh token en la cookie (ROTATE_REFRESH_TOKENS=True).
    - Devuelve 'access' (y 'refresh') en el JSON para compatibilidad.
    """
    def post(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if 'refresh' not in data or not data['refresh']:
            cookie_refresh = request.COOKIES.get('refresh_token')
            if cookie_refresh:
                data['refresh'] = cookie_refresh

        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        new_refresh = serializer.validated_data.get('refresh')
        if new_refresh:
            response.set_cookie(
                key='refresh_token',
                value=new_refresh,
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                secure=True,
                samesite='None',
                path='/'
            )
        return response


class LogoutView(APIView):
    """
    Logout seguro:
    - Invalida el refresh token en la blacklist.
    - Borra la cookie 'refresh_token'.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh') or request.COOKIES.get('refresh_token')
        token_user_id = None
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token_user_id = token.get('user_id')
                token.blacklist()
            except Exception:
                pass

        auth_user = request.user if getattr(request.user, 'is_authenticated', False) else None
        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_AUTH,
            accion='LOGOUT',
            usuario=auth_user,
            actor_identificador=(
                getattr(auth_user, 'username', '')
                or (f"user_id:{token_user_id}" if token_user_id else 'anonimo')
            ),
            modelo_afectado='Usuario',
            recurso_id=getattr(auth_user, 'pk', None) or token_user_id or '',
            exito=True,
        )

        response = Response({"detail": "Sesión cerrada exitosamente."}, status=status.HTTP_200_OK)
        response.delete_cookie('refresh_token', path='/', samesite='None')
        response.set_cookie(
            key='refresh_token',
            value='',
            max_age=0,
            expires='Thu, 01 Jan 1970 00:00:00 GMT',
            path='/',
            httponly=True,
            secure=True,
            samesite='None'
        )
        return response


class RegisterView(generics.CreateAPIView):
    """
    Endpoint público para la creación de cuentas de usuario.
    Genera y retorna automáticamente el token JWT tras un registro exitoso.
    """
    queryset = Usuario.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        acepta_marketing = bool(serializer.validated_data.get('acepta_marketing', False))
        user = serializer.save()

        registrar_consentimiento(
            request,
            usuario=user,
            identificador_titular=user.email,
            flujo=RegistroConsentimiento.FLUJO_REGISTRO_CUENTA,
            otorgado=True,
            categorias=['cuenta_saas', 'terminos_y_privacidad'],
            texto_aceptado="Politica de Privacidad y Terminos de Servicio HD Prevencion v1.0",
        )
        if acepta_marketing:
            registrar_consentimiento(
                request,
                usuario=user,
                identificador_titular=user.email,
                flujo=RegistroConsentimiento.FLUJO_MARKETING_NOVEDADES,
                otorgado=True,
                categorias=['novedades_sst'],
                texto_aceptado="Suscripcion opt-in actualizaciones normativas SST y novedades v1.0",
            )
        
        # Generar tokens JWT para iniciar sesión automáticamente
        refresh = RefreshToken.for_user(user)
        
        user_data = UsuarioSerializer(user).data
        
        return Response({
            'message': 'Usuario registrado exitosamente.',
            'user': user_data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


# Permisos Personalizados
class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permite lectura a cualquier usuario autenticado, pero escritura
    únicamente a administradores (superuser o staff).
    """
    def has_permission(self, request, view):
        user: Any = request.user
        if request.method in permissions.SAFE_METHODS:
            return user and user.is_authenticated
        return user and (user.is_staff or user.is_superuser)


class ContactoPermission(permissions.BasePermission):
    """
    Cualquier usuario (anónimo o autenticado) puede enviar mensajes (POST),
    pero solo los administradores pueden listar o leer mensajes recibidos.
    """
    def has_permission(self, request, view):
        user: Any = request.user
        if request.method == 'POST':
            return True
        return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


# ViewSets
class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    permission_classes = [permissions.AllowAny]


class PlantillaMaestraViewSet(viewsets.ModelViewSet):
    queryset = PlantillaMaestra.objects.all()
    serializer_class = PlantillaMaestraSerializer
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=True, methods=['get'], url_path='preview')
    def preview(self, request, pk=None):
        plantilla = self.get_object()
        if not plantilla.archivo_fuente:
            return Response({"error": "La plantilla no tiene un archivo fuente asignado."}, status=status.HTTP_400_BAD_REQUEST)
        
        file_path = plantilla.archivo_fuente.path
        import os
        if not os.path.exists(file_path):
            return Response({"error": "El archivo físico no se encuentra en el servidor."}, status=status.HTTP_404_NOT_FOUND)
            
        tipo = plantilla.tipo_archivo
        
        if tipo == 'XLSX':
            try:
                import openpyxl
                wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
                sheet: Any = wb.active
                rows_data = []
                if sheet is not None:
                    for row in sheet.iter_rows(max_row=20, max_col=10):
                        row_cells = []
                        for cell in row:
                            val = cell.value
                            if val is None:
                                row_cells.append("")
                            elif isinstance(val, (int, float)):
                                row_cells.append(val)
                            else:
                                row_cells.append(str(val))
                        rows_data.append(row_cells)
                return Response({
                    "tipo": "XLSX",
                    "data": {
                        "rows": rows_data
                    }
                })
            except Exception as e:
                return Response({"error": f"Error al leer planilla Excel: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        elif tipo == 'DOCX':
            try:
                import zipfile
                import xml.etree.ElementTree as ET
                import os
                from django.conf import settings
                
                extracted_media_dir = os.path.join(settings.MEDIA_ROOT, 'plantillas_maestras', 'extracted_media', str(plantilla.id))
                os.makedirs(extracted_media_dir, exist_ok=True)
                
                images_map = {}
                with zipfile.ZipFile(file_path, 'r') as docx:
                    for item in docx.infolist():
                        if 'word/media/' in item.filename and not item.filename.endswith('/'):
                            img_name = os.path.basename(item.filename)
                            dest_img_path = os.path.join(extracted_media_dir, img_name)
                            with open(dest_img_path, 'wb') as img_f:
                                img_f.write(docx.read(item.filename))
                            
                            public_url = request.build_absolute_uri(
                                settings.MEDIA_URL + f"plantillas_maestras/extracted_media/{plantilla.id}/{img_name}"
                            )
                            images_map[item.filename] = public_url

                    def get_rels(rels_name):
                        rels = {}
                        try:
                            content = docx.read(rels_name)
                            root = ET.fromstring(content)
                            for child in root:
                                if child.tag.endswith('Relationship'):
                                    rels[child.get('Id')] = child.get('Target')
                        except Exception:
                            pass
                        return rels
                    
                    doc_rels = get_rels('word/_rels/document.xml.rels')
                    header_rels = get_rels('word/_rels/header2.xml.rels')
                    if not header_rels:
                        header_rels = get_rels('word/_rels/header1.xml.rels')
                    footer_rels = get_rels('word/_rels/footer1.xml.rels')

                    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

                    def get_node_parts(node, rels):
                        parts = []
                        def traverse(child):
                            tag_local = child.tag.split('}')[-1]
                            if tag_local == 't':
                                if child.text:
                                    parts.append({"type": "text", "value": child.text})
                            elif tag_local == 'blip':
                                embed_id = child.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                                if embed_id and embed_id in rels:
                                    img_target = rels[embed_id]
                                    img_path = "word/" + img_target if not img_target.startswith("word/") else img_target
                                    if img_path in images_map:
                                        parts.append({"type": "image", "value": images_map[img_path]})
                            else:
                                for c in child:
                                    traverse(c)
                        traverse(node)
                        return parts

                    def parse_file_elements(xml_name, rels):
                        elements = []
                        try:
                            content = docx.read(xml_name)
                            root = ET.fromstring(content)
                            body = root.find('.//w:body', ns) if xml_name.endswith('document.xml') else root
                            
                            if body is not None:
                                for child in body:
                                    tag_local = child.tag.split('}')[-1]
                                    if tag_local == 'p':
                                        parts = get_node_parts(child, rels)
                                        if parts:
                                            elements.append({"type": "p", "parts": parts})
                                    elif tag_local == 'tbl':
                                        rows = []
                                        for tr in child.findall('.//w:tr', ns):
                                            row_cells = []
                                            for tc in tr.findall('.//w:tc', ns):
                                                cell_parts = []
                                                for p in tc.findall('.//w:p', ns):
                                                    p_parts = get_node_parts(p, rels)
                                                    if p_parts:
                                                        cell_parts.extend(p_parts)
                                                row_cells.append({"parts": cell_parts})
                                            rows.append(row_cells)
                                        elements.append({"type": "table", "rows": rows})
                        except Exception:
                            pass
                        return elements

                    header_xml = 'word/header2.xml'
                    if 'word/header2.xml' not in docx.namelist():
                        header_xml = 'word/header1.xml' if 'word/header1.xml' in docx.namelist() else None

                    footer_xml = 'word/footer1.xml' if 'word/footer1.xml' in docx.namelist() else None

                    header_elements = parse_file_elements(header_xml, header_rels) if header_xml else []
                    body_elements = parse_file_elements('word/document.xml', doc_rels)
                    footer_elements = parse_file_elements(footer_xml, footer_rels) if footer_xml else []

                    return Response({
                        "tipo": "DOCX",
                        "data": {
                            "header": header_elements,
                            "body": body_elements,
                            "footer": footer_elements
                        }
                    })
            except Exception as e:
                return Response({"error": f"Error al parsear estructura Word: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        elif tipo == 'PDF':
            url = request.build_absolute_uri(plantilla.archivo_fuente.url)
            return Response({
                "tipo": "PDF",
                "data": {
                    "url": url
                }
            })
            
        else:
            return Response({"error": "Tipo de archivo no soportado para previsualización."}, status=status.HTTP_400_BAD_REQUEST)


class DocumentoUsuarioViewSet(viewsets.ModelViewSet):
    queryset = DocumentoUsuario.objects.all()
    serializer_class = DocumentoUsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user: Any = self.request.user
        if user.is_staff or user.is_superuser:
            return DocumentoUsuario.objects.all()
        return DocumentoUsuario.objects.filter(usuario=user)

    def perform_create(self, serializer):
        usuario: Any = self.request.user
        
        # Rotación automática: Si el usuario ya tiene 5 o más copias, eliminamos la más antigua
        documentos_existentes = DocumentoUsuario.objects.filter(usuario=usuario)
        count = documentos_existentes.count()
        if count >= 5:
            # Obtener los más antiguos (ordenados de menor a mayor por fecha de último guardado)
            # Borrar suficientes para quedar en 4 copias antes de guardar la nueva
            docs_a_borrar = list(documentos_existentes.order_by('fecha_ultimo_guardado')[:(count - 4)])
            for doc in docs_a_borrar:
                doc.delete()

        owner: Any = usuario.cuenta_padre if usuario.cuenta_padre else usuario
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        if sub and not sub.plan.edicion_nube:
            raise ValidationError("Tu plan actual no permite la edición o creación de documentos en la nube. Por favor actualiza tu plan.")
        serializer.save(usuario=usuario)

    def perform_update(self, serializer):
        usuario: Any = self.request.user
        owner: Any = usuario.cuenta_padre if usuario.cuenta_padre else usuario
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        if sub and not sub.plan.edicion_nube:
            raise ValidationError("Tu plan actual no permite la edición o creación de documentos en la nube. Por favor actualiza tu plan.")
        serializer.save()

    def validar_y_registrar_descarga(self, usuario: Any):
        if usuario.is_superuser or usuario.is_staff:
            return None
            
        owner: Any = usuario.cuenta_padre if usuario.cuenta_padre else usuario
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        if not sub:
            return Response({"error": "No tienes una suscripción activa registrada."}, status=status.HTTP_403_FORBIDDEN)
            
        plan = sub.plan
        contador, _ = ContadorDescargas.objects.get_or_create(usuario=owner)
        
        now = timezone.now()
        if contador.fecha_ultima_descarga:
            if now.isocalendar()[1] != contador.fecha_ultima_descarga.isocalendar()[1] or now.isocalendar()[0] != contador.fecha_ultima_descarga.isocalendar()[0]:
                contador.descargas_semanales = 0
                
        if contador.descargas_semanales >= plan.limite_semanal:
            return Response({
                "error": f"Límite de descargas semanales alcanzado. Tu plan actual ({plan.nombre}) tiene un límite de {plan.limite_semanal} descargas semanales."
            }, status=status.HTTP_403_FORBIDDEN)
            
        contador.descargas_semanales += 1
        contador.fecha_ultima_descarga = now
        contador.save()
        return None

    @action(detail=True, methods=['get'], url_path='descargar-excel')
    def descargar_excel(self, request, pk=None):
        res_limit = self.validar_y_registrar_descarga(request.user)
        if res_limit is not None:
            return res_limit

        documento = self.get_object()
        
        owner = request.user.cuenta_padre if request.user.cuenta_padre else request.user
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        plan = sub.plan if sub else None

        datos = documento.datos_guardados or {}
        filas = datos.get('filas', [])
        
        # Crear un nuevo libro de Excel
        wb = openpyxl.Workbook()
        ws: Any = wb.active
        ws.title = "Matriz IPER"
        
        # Mostrar cuadrícula
        ws.views.sheetView[0].showGridLines = True
        
        # Definir estilos
        font_title = Font(name='Arial', size=14, bold=True, color='FFFFFF')
        font_header = Font(name='Arial', size=10, bold=True, color='FFFFFF')
        font_data = Font(name='Arial', size=9)
        
        fill_title = PatternFill(start_color='EA580C', end_color='EA580C', fill_type='solid') # Naranja (orange-600)
        fill_header = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid') # Slate-800
        
        # Fills para Nivel de Riesgo
        fill_bajo = PatternFill(start_color='DCFCE7', end_color='DCFCE7', fill_type='solid') # Verde claro (emerald-100)
        font_bajo = Font(name='Arial', size=9, bold=True, color='15803D') # Verde oscuro
        
        fill_medio = PatternFill(start_color='FEF9C3', end_color='FEF9C3', fill_type='solid') # Amarillo claro (yellow-100)
        font_medio = Font(name='Arial', size=9, bold=True, color='A16207') # Amarillo oscuro
        
        fill_alto = PatternFill(start_color='FEE2E2', end_color='FEE2E2', fill_type='solid') # Rojo claro (red-100)
        font_alto = Font(name='Arial', size=9, bold=True, color='B91C1C') # Rojo oscuro
        
        align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
        align_left = Alignment(horizontal='left', vertical='center', wrap_text=True)
        
        border_thin = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )
        
        # Título
        ws.merge_cells('A1:G2')
        cell_title = ws['A1']
        cell_title.value = f"MATRIZ IPER - {documento.usuario.username.upper()}"
        cell_title.font = font_title
        cell_title.fill = fill_title
        cell_title.alignment = align_center
        
        # Espacio en fila 3 (o marca de agua)
        ws.row_dimensions[1].height = 20
        ws.row_dimensions[2].height = 20
        ws.row_dimensions[3].height = 20
        if plan and plan.marca_agua:
            ws.merge_cells('A3:G3')
            cell_wm = ws['A3']
            cell_wm.value = "*** DOCUMENTO DE EJEMPLO - PLAN BÁSICO (HD PREVENCIÓN) ***"
            cell_wm.font = Font(name='Arial', size=10, bold=True, color='EF4444')
            cell_wm.alignment = align_center
        
        # Encabezados
        headers = [
            "Proceso / Actividad", 
            "Peligro Identificado", 
            "Consecuencia / Riesgo", 
            "Probabilidad (P)", 
            "Severidad (S)", 
            "Nivel de Riesgo (P x S)", 
            "Medidas de Control"
        ]
        
        ws.row_dimensions[4].height = 28
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=4, column=col_idx)
            cell.value = header
            cell.font = font_header
            cell.fill = fill_header
            cell.alignment = align_center
            cell.border = border_thin
            
        # Insertar datos
        current_row = 5
        for fila in filas:
            ws.row_dimensions[current_row].height = 24
            
            c_act = ws.cell(row=current_row, column=1, value=fila.get('actividad', ''))
            c_pel = ws.cell(row=current_row, column=2, value=fila.get('peligro', ''))
            c_rie = ws.cell(row=current_row, column=3, value=fila.get('riesgo', ''))
            
            try:
                p = int(fila.get('probabilidad', 1))
            except:
                p = 1
            try:
                s = int(fila.get('severidad', 1))
            except:
                s = 1
            nr = p * s
            
            c_prob = ws.cell(row=current_row, column=4, value=p)
            c_sev = ws.cell(row=current_row, column=5, value=s)
            c_nr = ws.cell(row=current_row, column=6, value=nr)
            c_med = ws.cell(row=current_row, column=7, value=fila.get('medidas_control', ''))
            
            # Estilos básicos de celdas de datos
            for c in [c_act, c_pel, c_rie, c_med]:
                c.font = font_data
                c.alignment = align_left
                c.border = border_thin
                
            for c in [c_prob, c_sev]:
                c.font = font_data
                c.alignment = align_center
                c.border = border_thin
                
            # Estilo condicional para Nivel de Riesgo
            c_nr.border = border_thin
            c_nr.alignment = align_center
            if nr >= 15:
                c_nr.fill = fill_alto
                c_nr.font = font_alto
            elif nr >= 5:
                c_nr.fill = fill_medio
                c_nr.font = font_medio
            else:
                c_nr.fill = fill_bajo
                c_nr.font = font_bajo
                
            current_row += 1
            
        if plan and not plan.marca_blanca:
            ws.row_dimensions[current_row + 1].height = 20
            ws.merge_cells(start_row=current_row + 1, start_column=1, end_row=current_row + 1, end_column=7)
            cell_brand = ws.cell(row=current_row + 1, column=1)
            cell_brand.value = "Generado por HD Prevención (www.hdprevencion.cl)"
            cell_brand.font = Font(name='Arial', size=8, italic=True, color='94A3B8')
            cell_brand.alignment = align_center
            
        # Auto-ajustar ancho de columnas
        column_widths = {
            'A': 25,
            'B': 30,
            'C': 30,
            'D': 15,
            'E': 15,
            'F': 22,
            'G': 40
        }
        for col, width in column_widths.items():
            ws.column_dimensions[col].width = width
            
        # Preparar respuesta http
        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f"attachment; filename=Matriz_IPER_{documento.pk}.xlsx"
        wb.save(response)
        return response

    @action(detail=True, methods=['get'], url_path='descargar-docx')
    def descargar_docx(self, request, pk=None):
        res_limit = self.validar_y_registrar_descarga(request.user)
        if res_limit is not None:
            return res_limit

        documento = self.get_object()
        
        owner = request.user.cuenta_padre if request.user.cuenta_padre else request.user
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        plan = sub.plan if sub else None

        plantilla = documento.plantilla_maestra
        if not plantilla.archivo_fuente:
            return Response({"error": "La plantilla base no tiene un archivo fuente."}, status=status.HTTP_400_BAD_REQUEST)
            
        file_path = plantilla.archivo_fuente.path
        import os
        if not os.path.exists(file_path):
            return Response({"error": "El archivo de plantilla no existe en el servidor."}, status=status.HTTP_404_NOT_FOUND)
            
        datos = documento.datos_guardados or {}
        
        empresa = str(datos.get('empresa', '')).strip() or "___________________"
        rep_legal = str(datos.get('representante_legal', '')).strip() or "___________________"
        dia = str(datos.get('dia', '')).strip() or "___"
        mes = str(datos.get('mes', '')).strip() or "___"
        anio = str(datos.get('anio', '')).strip() or "______"
        
        replacements = {
            "{{EMPRESA}}": empresa,
            "{{REPRESENTANTE_LEGAL}}": rep_legal,
            "{{DIA}}": dia,
            "{{MES}}": mes,
            "{{ANIO}}": anio
        }
        
        import zipfile
        import io
        
        try:
            in_memory_zip = io.BytesIO()
            with zipfile.ZipFile(file_path, 'r') as src_zip:
                with zipfile.ZipFile(in_memory_zip, 'w', zipfile.ZIP_DEFLATED) as dest_zip:
                    for item in src_zip.infolist():
                        if item.filename == 'word/document.xml':
                            xml_content = src_zip.read(item.filename)
                            xml_str = xml_content.decode('utf-8')
                            for marker, val in replacements.items():
                                xml_str = xml_str.replace(marker, val)
                                
                            # Si es plan básico, inyectar banner de marca de agua al inicio
                            if plan and plan.marca_agua:
                                wm_p = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:color w:val="EF4444"/><w:b/></w:rPr><w:t>*** DOCUMENTO DE EJEMPLO - PLAN BÁSICO (HD PREVENCIÓN) ***</w:t></w:r></w:p>'
                                xml_str = xml_str.replace('<w:body>', f'<w:body>{wm_p}')
                                
                            # Si no tiene marca blanca, inyectar branding al final
                            if plan and not plan.marca_blanca:
                                branding_p = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="94A3B8"/><w:i/></w:rPr><w:t>Generado por HD Prevención (www.hdprevencion.cl)</w:t></w:r></w:p>'
                                xml_str = xml_str.replace('</w:body>', f'{branding_p}</w:body>')

                            dest_zip.writestr(item.filename, xml_str.encode('utf-8'))
                        else:
                            dest_zip.writestr(item, src_zip.read(item.filename))
            
            in_memory_zip.seek(0)
            response = HttpResponse(
                in_memory_zip.read(),
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            response["Content-Disposition"] = f"attachment; filename=Politica_Seguridad_{documento.id}.docx"
            return response
            
        except Exception as e:
            return Response({"error": f"Error al generar el documento Word: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NoticiaViewSet(viewsets.ModelViewSet):
    queryset = Noticia.objects.all()
    serializer_class = NoticiaSerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)


class MensajeContactoViewSet(viewsets.ModelViewSet):
    queryset = MensajeContacto.objects.all()
    serializer_class = MensajeContactoSerializer
    permission_classes = [ContactoPermission]
    throttle_classes = [AnonRateThrottle]

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            instance = serializer.save(usuario=self.request.user)
        else:
            instance = serializer.save()

        registrar_consentimiento(
            self.request,
            usuario=self.request.user if self.request.user and self.request.user.is_authenticated else None,
            identificador_titular=instance.email,
            flujo=RegistroConsentimiento.FLUJO_CONTACTO,
            otorgado=True,
            categorias=['consulta_contacto'],
            texto_aceptado="Autorizacion tratamiento de datos de contacto y asesoria v1.0",
        )


class AccesoServiciosPermission(permissions.BasePermission):
    """
    Permite acceder a los servicios preventivos exclusivamente a usuarios
    con planes de pago activos, o a administradores/moderadores del sistema.
    """
    message = "Esta sección de servicios y asesorías exclusivas requiere una suscripción activa de pago (Plan Profesional, Expert o Consultora)."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        owner = user.cuenta_padre if user.cuenta_padre else user
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        if sub and (getattr(sub.plan, 'acceso_servicios', False) or float(sub.plan.precio) > 0):
            return True
        return False


class ServicioViewSet(viewsets.ModelViewSet):
    queryset = Servicio.objects.filter(activo=True)
    serializer_class = ServicioSerializer
    permission_classes = [AccesoServiciosPermission]


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user: Any = self.request.user
        return Usuario.objects.filter(pk=user.pk)

    def get_object(self) -> Any:
        return self.request.user

    def destroy(self, request, *args, **kwargs):
        raise exceptions.MethodNotAllowed(
            "DELETE",
            detail="La eliminación de cuentas de usuario no está permitida directamente por API para garantizar la trazabilidad legal. Toda solicitud de supresión de datos personales debe canalizarse a través del portal de Derechos ARCO-POL (/derechos-arco)."
        )

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='perfil')
    def perfil(self, request):
        usuario: Any = self.request.user
        if request.method == 'GET':
            serializer = self.get_serializer(usuario)
            return Response(serializer.data)

        # Si se envía explícitamente limpiar la foto de perfil
        if 'foto_perfil' in request.data:
            fp = request.data.get('foto_perfil')
            if fp == '' or fp == 'null' or fp is None:
                usuario.foto_perfil = None
                usuario.save()

        # Usar serializer para procesar el resto de los campos
        # Filtramos 'foto_perfil' si es vacío/null para que el serializer no falle al procesarlo como archivo
        data = request.data.copy()
        # Seguridad Ley 21.719 (C-1): cuenta_padre y tipo_usuario son inmutables desde perfil
        data.pop('cuenta_padre', None)
        data.pop('tipo_usuario', None)
        if 'foto_perfil' in data and (data['foto_perfil'] == '' or data['foto_perfil'] == 'null' or data['foto_perfil'] is None):
            data.pop('foto_perfil')

        password = request.data.get('password')
        if password:
            current_password = request.data.get('current_password') or ''
            if not current_password or not usuario.check_password(current_password):
                registrar_evento_seguridad(
                    request,
                    categoria=AuditLogEventoSeguridad.CATEGORIA_AUTH,
                    accion='PASSWORD_CHANGE',
                    usuario=usuario,
                    modelo_afectado='Usuario',
                    recurso_id=usuario.pk,
                    exito=False,
                    metadata={'reason': 'wrong_current_password'},
                )
                return Response(
                    {"current_password": ["Debes ingresar tu contraseña actual correcta para cambiar la contraseña."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if 'password_confirm' in request.data and request.data.get('password_confirm') != password:
                return Response(
                    {"password": ["Las contraseñas ingresadas no coinciden."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                validate_password(password, user=usuario)
            except DjangoValidationError as exc:
                registrar_evento_seguridad(
                    request,
                    categoria=AuditLogEventoSeguridad.CATEGORIA_AUTH,
                    accion='PASSWORD_CHANGE',
                    usuario=usuario,
                    modelo_afectado='Usuario',
                    recurso_id=usuario.pk,
                    exito=False,
                    metadata={'reason': 'policy_rejected'},
                )
                return Response(
                    {"password": list(exc.messages)},
                    status=status.HTTP_400_BAD_REQUEST
                )

        serializer = self.get_serializer(usuario, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if password:
            usuario.set_password(password)
            usuario.save()
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_AUTH,
                accion='PASSWORD_CHANGE',
                usuario=usuario,
                modelo_afectado='Usuario',
                recurso_id=usuario.pk,
                exito=True,
            )
            
        # Retornar datos frescos cargados del usuario
        fresh_serializer = self.get_serializer(usuario)
        return Response(fresh_serializer.data)

    @action(detail=False, methods=['post'], url_path='cambiar-plan')
    def cambiar_plan(self, request):
        usuario: Any = self.request.user
        plan_codigo = request.data.get('plan_codigo')
        
        if not plan_codigo:
            return Response({"error": "Debe especificar el plan_codigo."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            plan = Plan.objects.get(codigo=plan_codigo)
        except Plan.DoesNotExist:
            return Response({"error": "El plan especificado no existe."}, status=status.HTTP_404_NOT_FOUND)
            
        with transaction.atomic():
            # Desactivar suscripciones activas previas
            Suscripcion.objects.filter(usuario=usuario, estado=Suscripcion.ESTADO_ACTIVA).update(
                estado=Suscripcion.ESTADO_CANCELADA,
                fecha_vencimiento=timezone.now()
            )
            
            # Crear la nueva suscripción activa
            Suscripcion.objects.create(
                usuario=usuario,
                plan=plan,
                estado=Suscripcion.ESTADO_ACTIVA,
                fecha_inicio=timezone.now()
            )
            
            # Cambiar a corporativo si tiene más de 1 asiento (Plan Consultora)
            if plan.asientos > 1:
                usuario.tipo_usuario = Usuario.TIPO_CORPORATIVO
            else:
                usuario.tipo_usuario = Usuario.TIPO_INDIVIDUAL
                # Desvincular cuentas hijas
                usuario.cuentas_hijas.all().update(cuenta_padre=None)
                
            usuario.save()
            
        serializer = self.get_serializer(usuario)
        return Response({
            "message": f"Suscripción al plan {plan.nombre} activada con éxito.",
            "user": serializer.data
        })

    @action(detail=False, methods=['post'], url_path='mfa/iniciar')
    def mfa_iniciar(self, request):
        """Genera un secreto TOTP pendiente de confirmación para vincular app autenticadora."""
        usuario: Any = self.request.user
        secret = generar_secreto_totp()
        usuario.mfa_secret_pendiente = secret
        usuario.save(update_fields=['mfa_secret_pendiente'])

        account_label = usuario.email or usuario.username
        return Response({
            'secret': secret,
            'otpauth_uri': generar_uri_totp(secret, account_label),
            'mfa_enabled': bool(usuario.mfa_enabled),
            'mfa_obligatorio': bool(usuario.mfa_obligatorio),
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mfa/confirmar')
    def mfa_confirmar(self, request):
        """Valida el primer código TOTP de 6 dígitos, activa MFA y entrega códigos de respaldo únicos."""
        usuario: Any = self.request.user
        secret_pendiente = getattr(usuario, 'mfa_secret_pendiente', '')
        if not secret_pendiente:
            return Response(
                {'detail': 'No hay una configuración MFA pendiente. Inicia el enrolamiento primero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        code = (request.data.get('code') or '').strip()
        step = verificar_codigo_totp(secret_pendiente, code)
        if step is None:
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_ENABLE_FAIL',
                usuario=usuario,
                modelo_afectado='Usuario',
                recurso_id=usuario.pk,
                exito=False,
            )
            return Response(
                {'code': ['El código de 6 dígitos no es válido o expiró. Verifica la hora de tu dispositivo.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        backup_codes, backup_hashes = generar_codigos_respaldo(8)
        usuario.mfa_secret = secret_pendiente
        usuario.mfa_secret_pendiente = ''
        usuario.mfa_enabled = True
        usuario.mfa_last_used_step = step
        usuario.mfa_enrolled_at = timezone.now()
        usuario.mfa_backup_codes_hashes = backup_hashes
        usuario.save(update_fields=[
            'mfa_secret', 'mfa_secret_pendiente', 'mfa_enabled',
            'mfa_last_used_step', 'mfa_enrolled_at', 'mfa_backup_codes_hashes'
        ])

        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
            accion='MFA_ENABLED',
            usuario=usuario,
            modelo_afectado='Usuario',
            recurso_id=usuario.pk,
            exito=True,
        )

        return Response({
            'detail': 'MFA TOTP activado correctamente. Guarda tus códigos de respaldo en un lugar seguro.',
            'backup_codes': backup_codes,
            'user': self.get_serializer(usuario).data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mfa/regenerar-respaldos')
    def mfa_regenerar_respaldos(self, request):
        """Regenera los códigos de respaldo exigiendo contraseña actual y código TOTP vigente."""
        usuario: Any = self.request.user
        if not getattr(usuario, 'mfa_enabled', False):
            return Response(
                {'detail': 'El MFA TOTP aún no está habilitado en tu cuenta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        current_password = request.data.get('current_password') or ''
        if not current_password or not usuario.check_password(current_password):
            return Response(
                {'current_password': ['Contraseña actual incorrecta.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        code = (request.data.get('code') or '').strip()
        step = verificar_codigo_totp(usuario.mfa_secret, code, last_used_step=usuario.mfa_last_used_step)
        if step is None:
            return Response(
                {'code': ['Código TOTP inválido o ya utilizado.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        backup_codes, backup_hashes = generar_codigos_respaldo(8)
        usuario.mfa_last_used_step = step
        usuario.mfa_backup_codes_hashes = backup_hashes
        usuario.save(update_fields=['mfa_last_used_step', 'mfa_backup_codes_hashes'])

        return Response({
            'detail': 'Se generaron nuevos códigos de respaldo. Los anteriores quedaron anulados.',
            'backup_codes': backup_codes,
            'user': self.get_serializer(usuario).data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mfa/desactivar')
    def mfa_desactivar(self, request):
        """Desactiva MFA TOTP únicamente en cuentas individuales tras verificar contraseña y 2do factor."""
        usuario: Any = self.request.user
        if getattr(usuario, 'mfa_obligatorio', False):
            return Response(
                {'detail': 'Tu rol administrativo o corporativo exige MFA obligatorio (Ley 21.719) y no puede desactivarse desde el perfil.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not getattr(usuario, 'mfa_enabled', False):
            return Response({'detail': 'MFA ya se encuentra desactivado.'}, status=status.HTTP_200_OK)

        current_password = request.data.get('current_password') or ''
        if not current_password or not usuario.check_password(current_password):
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_DISABLE_FAIL',
                usuario=usuario,
                modelo_afectado='Usuario',
                recurso_id=usuario.pk,
                exito=False,
                metadata={'reason': 'wrong_password'},
            )
            return Response(
                {'current_password': ['Contraseña actual incorrecta.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        code = (request.data.get('code') or '').strip()
        if not _verificar_segundo_factor(usuario, code):
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
                accion='MFA_DISABLE_FAIL',
                usuario=usuario,
                modelo_afectado='Usuario',
                recurso_id=usuario.pk,
                exito=False,
                metadata={'reason': 'invalid_code'},
            )
            return Response(
                {'code': ['Código TOTP o de respaldo inválido.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        usuario.mfa_enabled = False
        usuario.mfa_secret = ''
        usuario.mfa_secret_pendiente = ''
        usuario.mfa_backup_codes_hashes = []
        usuario.mfa_last_used_step = None
        usuario.mfa_enrolled_at = None
        usuario.save(update_fields=[
            'mfa_enabled', 'mfa_secret', 'mfa_secret_pendiente',
            'mfa_backup_codes_hashes', 'mfa_last_used_step', 'mfa_enrolled_at'
        ])

        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_MFA,
            accion='MFA_DISABLED',
            usuario=usuario,
            modelo_afectado='Usuario',
            recurso_id=usuario.pk,
            exito=True,
        )

        return Response({
            'detail': 'MFA TOTP desactivado.',
            'user': self.get_serializer(usuario).data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='consentimiento-comunicaciones')
    def consentimiento_comunicaciones(self, request):
        """
        Permite otorgar o revocar en 1 clic el consentimiento opcional para
        novedades normativas SST (fila append-only en RegistroConsentimiento, Art. 12).
        """
        usuario: Any = self.request.user
        otorgado = bool(request.data.get('otorgado', False))
        registrar_consentimiento(
            request,
            usuario=usuario,
            identificador_titular=usuario.email or usuario.username,
            flujo=RegistroConsentimiento.FLUJO_MARKETING_NOVEDADES,
            otorgado=otorgado,
            categorias=['novedades_sst'],
            texto_aceptado="Preferencia de comunicaciones normativas SST y novedades v1.0",
        )
        return Response({
            'otorgado': otorgado,
            'detail': 'Preferencia de comunicaciones actualizada correctamente.',
            'user': self.get_serializer(usuario).data,
        }, status=status.HTTP_200_OK)


class ReporteRiesgoViewSet(viewsets.ModelViewSet):
    queryset = ReporteRiesgo.objects.all()
    serializer_class = ReporteRiesgoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user: Any = self.request.user
        owner: Any = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())
        return ReporteRiesgo.objects.filter(usuario__in=usuarios_grupo)

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        user: Any = self.request.user
        serializer.save(usuario=user)

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        instance = serializer.save()
        if instance.estado == ReporteRiesgo.ESTADO_RESUELTO and not instance.fecha_resolucion:
            instance.fecha_resolucion = timezone.now()
            instance.save(update_fields=['fecha_resolucion'])


class PlantillaInspeccionViewSet(viewsets.ModelViewSet):
    queryset = PlantillaInspeccion.objects.all()
    serializer_class = PlantillaInspeccionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user: Any = self.request.user
        if user.is_staff or user.is_superuser:
            return PlantillaInspeccion.objects.all()
        return PlantillaInspeccion.objects.filter(activo=True)


class InspeccionViewSet(viewsets.ModelViewSet):
    queryset = Inspeccion.objects.all()
    serializer_class = InspeccionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user: Any = self.request.user
        owner: Any = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())
        return Inspeccion.objects.filter(usuario__in=usuarios_grupo)

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        user: Any = self.request.user
        req: Any = self.request
        respuestas = req.data.get('respuestas', [])
        aprobados = 0
        total_evaluados = 0
        for r in respuestas:
            estado = r.get('estado')
            if estado == 'SI':
                aprobados += 1
                total_evaluados += 1
            elif estado == 'NO':
                total_evaluados += 1
        
        porcentaje = (aprobados / total_evaluados * 100) if total_evaluados > 0 else 0.00
        porcentaje = round(porcentaje, 2)
        serializer.save(usuario=user, porcentaje_cumplimiento=porcentaje)

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()


class InvestigacionAccidenteViewSet(viewsets.ModelViewSet):
    queryset = InvestigacionAccidente.objects.all()
    serializer_class = InvestigacionAccidenteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user: Any = self.request.user
        owner: Any = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())
        qs = InvestigacionAccidente.objects.filter(usuario__in=usuarios_grupo)
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        return qs

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        user: Any = self.request.user
        instance = serializer.save(usuario=user)
        registrar_evento_seguridad(
            self.request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
            accion='ACCIDENTE_CREATE',
            usuario=user,
            modelo_afectado='InvestigacionAccidente',
            recurso_id=instance.pk,
            exito=True,
            metadata={'empresa_id': instance.empresa_id, 'tipo_evento': instance.tipo_evento},
        )

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        instance = serializer.save()
        registrar_evento_seguridad(
            self.request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
            accion='ACCIDENTE_UPDATE',
            usuario=self.request.user,
            modelo_afectado='InvestigacionAccidente',
            recurso_id=instance.pk,
            exito=True,
            metadata={'empresa_id': instance.empresa_id},
        )

    def destroy(self, request, *args, **kwargs):
        raise exceptions.MethodNotAllowed(
            "DELETE",
            detail="Por disposición del Art. 76 de la Ley N° 16.744 y la Circular SUSESO N° 3336, los expedientes e investigaciones de accidentes laborales son inmutables y no pueden ser eliminados del sistema."
        )

    @action(detail=True, methods=['post', 'patch'], url_path='registrar-diat')
    def registrar_diat(self, request, pk=None):
        """
        Formaliza la tramitación de la DIAT ante el organismo administrador (mutualidad)
        cumpliendo el plazo perentorio de 24 horas (D.S. 44 / Ley 16.744).
        """
        accidente = self.get_object()
        diat_folio = request.data.get('diat_folio') or request.data.get('folio')
        diat_fecha = request.data.get('diat_fecha_presentacion') or request.data.get('fecha_presentacion')

        if not diat_folio and not accidente.diat_folio:
            return Response(
                {'error': 'Debe proporcionar el folio oficial de la DIAT emitido por la mutualidad.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if diat_folio:
            accidente.diat_folio = str(diat_folio).strip()
        accidente.diat_presentada = True

        if diat_fecha:
            accidente.diat_fecha_presentacion = diat_fecha
        elif not accidente.diat_fecha_presentacion:
            accidente.diat_fecha_presentacion = timezone.now()

        accidente.save()
        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
            accion='ACCIDENTE_DIAT',
            usuario=request.user,
            modelo_afectado='InvestigacionAccidente',
            recurso_id=accidente.pk,
            exito=True,
            metadata={'empresa_id': accidente.empresa_id},
        )
        serializer = self.get_serializer(accidente)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post', 'patch'], url_path='protocolo-grave-fatal')
    def protocolo_grave_fatal(self, request, pk=None):
        """
        Registra el protocolo obligatorio de accidente grave o fatal (Art. 76 Ley 16.744 / Circular 3336 SUSESO):
        - Auto-suspensión inmediata de faenas
        - Aviso inmediato a Inspección del Trabajo y Seremi de Salud
        """
        accidente = self.get_object()

        if 'faena_suspendida' in request.data:
            accidente.faena_suspendida = bool(request.data.get('faena_suspendida'))

        if 'aviso_autoridades_realizado' in request.data:
            accidente.aviso_autoridades_realizado = bool(request.data.get('aviso_autoridades_realizado'))

        if 'aviso_autoridades_folio' in request.data:
            accidente.aviso_autoridades_folio = request.data.get('aviso_autoridades_folio')

        if 'aviso_autoridades_fecha' in request.data:
            accidente.aviso_autoridades_fecha = request.data.get('aviso_autoridades_fecha')
        elif accidente.aviso_autoridades_realizado and not accidente.aviso_autoridades_fecha:
            accidente.aviso_autoridades_fecha = timezone.now()

        if 'es_grave_o_fatal' in request.data:
            accidente.es_grave_o_fatal = bool(request.data.get('es_grave_o_fatal'))

        if 'tipo_accidente_grave' in request.data:
            accidente.tipo_accidente_grave = request.data.get('tipo_accidente_grave')

        if 'dias_perdidos' in request.data:
            try:
                accidente.dias_perdidos = int(request.data.get('dias_perdidos', 0))
            except (ValueError, TypeError):
                pass

        if 'alta_medica' in request.data:
            accidente.alta_medica = bool(request.data.get('alta_medica'))

        if 'arbol_de_causas' in request.data:
            accidente.arbol_de_causas = request.data.get('arbol_de_causas')

        if 'reanudacion_autorizada' in request.data:
            accidente.reanudacion_autorizada = bool(request.data.get('reanudacion_autorizada'))

        if 'resolucion_reanudacion_dt_seremi' in request.data:
            accidente.resolucion_reanudacion_dt_seremi = request.data.get('resolucion_reanudacion_dt_seremi', '').strip()

        if 'plazo_investigacion_suseso_30d' in request.data:
            accidente.plazo_investigacion_suseso_30d = request.data.get('plazo_investigacion_suseso_30d')

        accidente.save()
        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
            accion='ACCIDENTE_PROTOCOLO_GRAVE',
            usuario=request.user,
            modelo_afectado='InvestigacionAccidente',
            recurso_id=accidente.pk,
            exito=True,
            metadata={'empresa_id': accidente.empresa_id, 'faena_suspendida': bool(accidente.faena_suspendida)},
        )
        serializer = self.get_serializer(accidente)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='estadisticas')
    def estadisticas(self, request):
        """
        Calcula los índices de siniestralidad mensual/anual con aislamiento multi-tenant:
        - total_accidentes: Conteo de eventos de trabajo.
        - total_dias_perdidos: Sumatoria de dias_perdidos.
        - tasa_frecuencia_if: (accidentes_con_tiempo_perdido * 1_000_000) / horas_trabajadas_estimadas.
        - tasa_gravedad_ig: (total_dias_perdidos * 1_000_000) / horas_trabajadas_estimadas.
        - graves_o_fatales_count: Conteo de eventos críticos que requirieron auto-suspensión.
        """
        qs = self.get_queryset()

        empresa_id = request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)

        year = request.query_params.get('year')
        if year and year != 'ALL':
            try:
                qs = qs.filter(fecha_hora_evento__year=int(year))
            except (ValueError, TypeError):
                pass

        # Conteo de eventos de trabajo (excluye trayecto o incidentes sin lesión)
        total_accidentes = qs.filter(tipo_evento=InvestigacionAccidente.TIPO_TRABAJO).count()

        # Sumatoria de días perdidos por reposo médico
        total_dias_perdidos = qs.aggregate(Sum('dias_perdidos'))['dias_perdidos__sum'] or 0

        # Accidentes con tiempo perdido (CTP): eventos de trabajo con reposo médico (dias_perdidos > 0)
        accidentes_con_tiempo_perdido = qs.filter(
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            dias_perdidos__gt=0
        ).count()

        # Eventos graves o fatales que requirieron auto-suspensión o protocolo
        graves_o_fatales_count = qs.filter(
            Q(es_grave_o_fatal=True) | Q(faena_suspendida=True)
        ).count()

        # Determinación de horas trabajadas estimadas
        user: Any = request.user
        owner: Any = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())

        horas_param = request.query_params.get('horas_trabajadas') or request.query_params.get('horas_persona')
        if horas_param:
            try:
                horas_trabajadas_estimadas = float(horas_param)
            except (ValueError, TypeError):
                horas_trabajadas_estimadas = 0.0
        else:
            if empresa_id:
                num_trabajadores = Trabajador.objects.filter(
                    empresa_id=empresa_id,
                    empresa__prevencionista__in=usuarios_grupo,
                    estado=Trabajador.ESTADO_ACTIVO
                ).count()
            else:
                num_trabajadores = Trabajador.objects.filter(
                    empresa__prevencionista__in=usuarios_grupo,
                    estado=Trabajador.ESTADO_ACTIVO
                ).count()

            if num_trabajadores > 0:
                horas_trabajadas_estimadas = float(num_trabajadores * 180 * 12)
            else:
                horas_trabajadas_estimadas = 200000.0

        # Cálculo de tasas normalizadas por millón de horas persona (NCh 436 / Circular 3336)
        if horas_trabajadas_estimadas > 0:
            tasa_frecuencia_if = round((accidentes_con_tiempo_perdido * 1_000_000) / horas_trabajadas_estimadas, 2)
            tasa_gravedad_ig = round((total_dias_perdidos * 1_000_000) / horas_trabajadas_estimadas, 2)
        else:
            tasa_frecuencia_if = 0.0
            tasa_gravedad_ig = 0.0

        return Response({
            'total_accidentes': total_accidentes,
            'total_dias_perdidos': total_dias_perdidos,
            'accidentes_con_tiempo_perdido': accidentes_con_tiempo_perdido,
            'horas_trabajadas_estimadas': horas_trabajadas_estimadas,
            'tasa_frecuencia_if': tasa_frecuencia_if,
            'tasa_gravedad_ig': tasa_gravedad_ig,
            'graves_o_fatales_count': graves_o_fatales_count,
            'diat_pendientes_count': qs.filter(diat_presentada=False).count(),
            'diat_vencidas_count': sum(1 for a in qs if a.diat_vencida),
            'total_eventos': qs.count(),
        }, status=status.HTTP_200_OK)


class TemaCapacitacionViewSet(viewsets.ModelViewSet):
    queryset = TemaCapacitacion.objects.all()
    serializer_class = TemaCapacitacionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user: Any = self.request.user
        owner: Any = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())
        return TemaCapacitacion.objects.filter(
            Q(usuario__in=usuarios_grupo) |
            Q(es_conferencia_grabada=True) |
            Q(usuario__isnull=True)
        ).distinct()

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        user: Any = self.request.user
        serializer.save(usuario=user)

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()


class RegistroCapacitacionViewSet(viewsets.ModelViewSet):
    queryset = RegistroCapacitacion.objects.all()
    serializer_class = RegistroCapacitacionSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'uuid'
    throttle_scope = 'public_qr'

    def get_throttles(self):
        if self.action in ['detalles_publicos', 'registrar_asistencia']:
            return [AnonRateThrottle(), ScopedRateThrottle()]
        return super().get_throttles()

    def get_object(self):
        """
        Resuelve la instancia asegurando máxima seguridad:
        - Para los endpoints públicos (detalles_publicos, registrar_asistencia), exige
          un UUID válido para evitar enumeración y fuga de datos sensibles.
        - Para endpoints autenticados del dashboard, permite buscar por UUID o ID numérico.
        """
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs.get(lookup_url_kwarg)

        action_name = getattr(self, 'action', None)
        if action_name in ['detalles_publicos', 'registrar_asistencia']:
            try:
                uuid.UUID(str(lookup_value))
            except (ValueError, AttributeError):
                raise Http404("Capacitación no encontrada o identificador no válido.")
            return get_object_or_404(RegistroCapacitacion, uuid=lookup_value)

        # Acciones privadas autenticadas
        queryset = self.filter_queryset(self.get_queryset())
        filter_kwargs = {}
        try:
            val_uuid = uuid.UUID(str(lookup_value))
            filter_kwargs['uuid'] = val_uuid
        except (ValueError, AttributeError):
            if str(lookup_value).isdigit():
                filter_kwargs['pk'] = lookup_value
            else:
                filter_kwargs['uuid'] = lookup_value

        obj = get_object_or_404(queryset, **filter_kwargs)
        self.check_object_permissions(self.request, obj)
        return obj

    def get_queryset(self):
        user: Any = self.request.user
        if not user or user.is_anonymous:
            # Cierre por defecto Ley 21.719 (B-4): usuarios no autenticados nunca obtienen listado de capacitaciones
            return RegistroCapacitacion.objects.none()
        owner: Any = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())
        return RegistroCapacitacion.objects.filter(usuario__in=usuarios_grupo)

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        user: Any = self.request.user
        serializer.save(usuario=user)

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()

    @action(detail=True, methods=['patch'], url_path='finalizar')
    def finalizar(self, request, uuid=None):
        """
        Finaliza una sesión de capacitación programada, guardando la lista de firmas de asistencia y comentarios.
        """
        capacitacion = self.get_object()
        if capacitacion.estado != RegistroCapacitacion.ESTADO_PROGRAMADA:
            return Response({"error": "Solo se pueden finalizar capacitaciones en estado PROGRAMADA."}, status=status.HTTP_400_BAD_REQUEST)

        asistentes = request.data.get('asistentes', [])
        observaciones = request.data.get('observaciones', '')

        capacitacion.estado = RegistroCapacitacion.ESTADO_REALIZADA
        capacitacion.fecha_realizacion = timezone.now()
        capacitacion.asistentes = asistentes
        capacitacion.observaciones = observaciones
        capacitacion.save()

        serializer = self.get_serializer(capacitacion)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['get'],
        url_path='detalles-publicos',
        permission_classes=[permissions.AllowAny]
    )
    def detalles_publicos(self, request, uuid=None):
        """
        Retorna la información básica de la capacitación para mostrarla públicamente en la firma.
        Protegido por Throttling y consultado únicamente mediante UUID seguro.
        """
        capacitacion = self.get_object()
        return Response({
            "id": capacitacion.id,
            "uuid": str(capacitacion.uuid),
            "tema_titulo": capacitacion.tema.titulo,
            "tema_descripcion": capacitacion.tema.descripcion,
            "fecha_programada": capacitacion.fecha_programada,
            "lugar": capacitacion.lugar,
            # Minimización Ley 21.719 (M-2): no exponer el nombre de usuario de login en endpoint público
            "relator": capacitacion.tema.relator_predeterminado or "Equipo Prevención de Riesgos",
            "estado": capacitacion.estado
        })

    @action(
        detail=True,
        methods=['post'],
        url_path='registrar-asistencia',
        permission_classes=[permissions.AllowAny]
    )
    def registrar_asistencia(self, request, uuid=None):
        """
        Permite a un trabajador registrar su asistencia y firma digital (Base64) de forma pública.
        Protegido por Throttling estricto (30 peticiones/min) y direccionado por UUID.
        """
        capacitacion = self.get_object()
        if capacitacion.estado != RegistroCapacitacion.ESTADO_PROGRAMADA:
            return Response({"error": "No se pueden registrar firmas en una capacitación que no esté en estado PROGRAMADA."}, status=status.HTTP_400_BAD_REQUEST)

        nombre = request.data.get('nombre', '').strip()
        rut = request.data.get('rut', '').strip()
        firma = request.data.get('firma', '').strip()

        if not nombre or not rut or not firma:
            return Response({"error": "Todos los campos (nombre, rut, firma) son obligatorios."}, status=status.HTTP_400_BAD_REQUEST)

        rut_limpio = rut.replace('.', '').replace('-', '').strip().upper()
        try:
            validar_rut_chileno(rut_limpio)
        except Exception as e:
            error_msg = e.message if hasattr(e, 'message') else str(e)
            if isinstance(error_msg, list):
                error_msg = error_msg[0]
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Evitar duplicidad de RUT en la misma charla
        if any(a.get('rut', '').replace('.', '').replace('-', '').strip().upper() == rut_limpio for a in capacitacion.asistentes):
            return Response({"error": "Este RUT ya se encuentra registrado en esta capacitación."}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(capacitacion.asistentes, list):
            capacitacion.asistentes = []

        capacitacion.asistentes.append({
            "nombre": nombre,
            "rut": rut,
            "firma": firma,
            "fecha_firma": timezone.now().isoformat(),
            "ip_dispositivo": get_client_ip(request)
        })
        capacitacion.save()

        return Response({"message": "Asistencia y firma registradas correctamente."}, status=status.HTTP_200_OK)



class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        user = request.user
        owner = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())
        empresas_usuario = Empresa.objects.filter(prevencionista__in=usuarios_grupo)

        # 1. Riesgos
        riesgos_qs = ReporteRiesgo.objects.filter(usuario__in=usuarios_grupo)
        total_riesgos = riesgos_qs.count()
        abiertos_riesgos = riesgos_qs.filter(estado='ABIERTO').count()
        proceso_riesgos = riesgos_qs.filter(estado__in=['PROCESO', 'EN_PROCESO']).count()
        resueltos_riesgos = riesgos_qs.filter(estado='RESUELTO').count()

        bajo_riesgos = riesgos_qs.filter(gravedad='BAJO').count()
        medio_riesgos = riesgos_qs.filter(gravedad='MEDIO').count()
        alto_riesgos = riesgos_qs.filter(gravedad__in=['ALTO', 'CRITICO']).count()

        acto_riesgos = riesgos_qs.filter(tipo='ACTO').count()
        condicion_riesgos = riesgos_qs.filter(tipo='CONDICION').count()

        # 2. Inspecciones
        inspecciones_qs = Inspeccion.objects.filter(usuario__in=usuarios_grupo)
        total_inspecciones = inspecciones_qs.count()
        
        # Promedio general de cumplimiento
        from django.db.models import Avg
        avg_cumplimiento = inspecciones_qs.aggregate(Avg('porcentaje_cumplimiento'))['porcentaje_cumplimiento__avg'] or 0.00
        avg_cumplimiento = float(round(avg_cumplimiento, 2))

        # Historial de las últimas 5 inspecciones
        historial_inspecciones = []
        for insp in inspecciones_qs.order_by('-fecha')[:5]:
            historial_inspecciones.append({
                "id": insp.pk,
                "plantilla_nombre": insp.plantilla.nombre,
                "fecha": insp.fecha,
                "porcentaje": float(insp.porcentaje_cumplimiento),
                "inspector": insp.usuario.username
            })

        # 3. Accidentes
        accidentes_qs = InvestigacionAccidente.objects.filter(usuario__in=usuarios_grupo)
        total_accidentes = accidentes_qs.count()
        trabajo_accidentes = accidentes_qs.filter(tipo_evento='TRABAJO').count()
        trayecto_accidentes = accidentes_qs.filter(tipo_evento='TRAYECTO').count()
        incidente_accidentes = accidentes_qs.filter(tipo_evento='INCIDENTE').count()

        # 4. Descargas y límites
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        limite_semanal = sub.plan.limite_semanal if sub else 5
        
        contador, _ = ContadorDescargas.objects.get_or_create(usuario=owner)
        descargas_semanales = contador.descargas_semanales
        
        # Validar reinicio de descargas si cambió de semana en isocalendar
        now = timezone.now()
        if contador.fecha_ultima_descarga:
            if now.isocalendar()[1] != contador.fecha_ultima_descarga.isocalendar()[1] or now.isocalendar()[0] != contador.fecha_ultima_descarga.isocalendar()[0]:
                descargas_semanales = 0

        # Últimos accidentes reportados (últimos 5)
        historial_accidentes = []
        for acc in accidentes_qs.order_by('-fecha_hora_evento')[:5]:
            historial_accidentes.append({
                "id": acc.pk,
                "nombre_afectado": acc.nombre_afectado,
                "tipo_evento": acc.tipo_evento,
                "fecha": acc.fecha_hora_evento,
                "lugar": acc.lugar_evento,
                "lesion": acc.tipo_lesion
            })

        # 5. Capacitaciones (PAC)
        capacitaciones_qs = RegistroCapacitacion.objects.filter(usuario__in=usuarios_grupo)
        total_capacitaciones = capacitaciones_qs.count()
        realizadas_capacitaciones = capacitaciones_qs.filter(estado='REALIZADA').count()
        programadas_capacitaciones = capacitaciones_qs.filter(estado='PROGRAMADA').count()
        
        asistentes_alcanzados = 0
        for cap in capacitaciones_qs.filter(estado='REALIZADA'):
            if isinstance(cap.asistentes, list):
                asistentes_alcanzados += len(cap.asistentes)

        pct_cumplimiento_pac = (realizadas_capacitaciones / total_capacitaciones * 100) if total_capacitaciones > 0 else 0.00
        pct_cumplimiento_pac = float(round(pct_cumplimiento_pac, 2))

        historial_capacitaciones = []
        for cap in capacitaciones_qs.order_by('-fecha_programada')[:5]:
            historial_capacitaciones.append({
                "id": cap.pk,
                "tema_titulo": cap.tema.titulo,
                "estado": cap.estado,
                "fecha_programada": cap.fecha_programada,
                "lugar": cap.lugar,
                "asistentes_count": len(cap.asistentes) if isinstance(cap.asistentes, list) else 0
            })

        # 6. Comité Paritario (CPHS - D.S. 44)
        comites_qs = ComiteParitario.objects.filter(
            Q(empresa__prevencionista__in=usuarios_grupo) | Q(empresa__in=empresas_usuario)
        ).distinct()
        tiene_comite = comites_qs.exists()
        comite_principal = comites_qs.order_by('-fecha_constitucion').first()

        dias_restantes_mandato = None
        en_periodo_eleccionario = False
        if comite_principal:
            dias_restantes_mandato = comite_principal.dias_restantes_mandato
            en_periodo_eleccionario = (
                (dias_restantes_mandato is not None and dias_restantes_mandato <= 60)
                or (comite_principal.estado == ComiteParitario.ESTADO_EN_ELECCION)
            )

        sesiones_ordinarias_anio = ActaSesionCPHS.objects.filter(
            comite__in=comites_qs,
            tipo_sesion=ActaSesionCPHS.TIPO_ORDINARIA,
            fecha_hora_sesion__year=now.year
        ).count()
        meta_sesiones_anual = 12
        cumplimiento_sesiones_pct = round(min(100.0, (sesiones_ordinarias_anio / 12.0) * 100.0), 1)

        meses_con_acta = set(ActaSesionCPHS.objects.filter(
            comite__in=comites_qs,
            tipo_sesion=ActaSesionCPHS.TIPO_ORDINARIA,
            fecha_hora_sesion__year=now.year
        ).values_list('fecha_hora_sesion__month', flat=True))
        sesiones_meses = [m in meses_con_acta for m in range(1, 13)]

        cphs_data = {
            "tiene_comite": tiene_comite,
            "dias_restantes_mandato": dias_restantes_mandato,
            "en_periodo_eleccionario": en_periodo_eleccionario,
            "sesiones_ordinarias_anio": sesiones_ordinarias_anio,
            "meta_sesiones_anual": meta_sesiones_anual,
            "cumplimiento_sesiones_pct": cumplimiento_sesiones_pct,
            "sesiones_meses": sesiones_meses,
        }

        # 7. Ley Karin (Canal de Denuncias - Ley 21.643) - ESTRICTA RESERVA ART. 211-B CÓDIGO DEL TRABAJO
        # NOTA DE SEGURIDAD: NO RETORNAR NOMBRES, RUTS NI DESCRIPCIONES DE DENUNCIAS
        denuncias_qs = DenunciaLeyKarin.objects.filter(
            Q(empresa__prevencionista__in=usuarios_grupo) | Q(empresa__in=empresas_usuario)
        ).distinct()
        denuncias_activas = denuncias_qs.exclude(estado_tramite=DenunciaLeyKarin.ESTADO_FINALIZADA)
        total_activas_karin = denuncias_activas.count()

        alertas_72h_criticas = 0
        for d in denuncias_activas.filter(estado_tramite__in=[
            DenunciaLeyKarin.ESTADO_RECEPCIONADA,
            DenunciaLeyKarin.ESTADO_MEDIDAS_RESGUARDO
        ]):
            if d.plazo_limite_derivacion_dt:
                if now >= d.plazo_limite_derivacion_dt - timedelta(hours=24):
                    alertas_72h_criticas += 1
            elif d.fecha_hora_ingreso and now >= d.fecha_hora_ingreso + timedelta(hours=48):
                alertas_72h_criticas += 1

        alertas_5d_mutual = denuncias_activas.filter(derivada_mutualidad=False).count()

        ley_karin_data = {
            "total_activas": total_activas_karin,
            "alertas_72h_criticas": alertas_72h_criticas,
            "alertas_5d_mutual": alertas_5d_mutual,
        }

        # 8. Entrega de EPP y RIOHS con Firma Digital (Ley 19.799 / D.S. 594)
        entregas_qs = EntregaEPP.objects.filter(
            Q(empresa__prevencionista__in=usuarios_grupo) |
            Q(responsable_entrega__in=usuarios_grupo)
        ).distinct()
        total_entregas = entregas_qs.count()
        entregas_firmadas = entregas_qs.exclude(firma_digital__isnull=True).exclude(firma_digital="").count()
        porcentaje_firmados = round((entregas_firmadas / total_entregas * 100.0), 1) if total_entregas > 0 else 100.0
        constancias_riohs_firmadas = entregas_qs.filter(
            entrega_riohs=True
        ).exclude(firma_digital__isnull=True).exclude(firma_digital="").count()

        historial_epp = []
        for e in entregas_qs.select_related('trabajador').order_by('-fecha_hora_entrega')[:5]:
            historial_epp.append({
                "id": e.pk,
                "trabajador": f"{e.trabajador.nombres} {e.trabajador.apellidos}" if e.trabajador else "Trabajador",
                "rut": e.trabajador.rut if e.trabajador else "",
                "fecha": e.fecha_hora_entrega,
                "firmado": bool(e.firma_digital and len(e.firma_digital.strip()) > 0),
                "entrega_riohs": e.entrega_riohs,
                "items_count": len(e.items_epp) if isinstance(e.items_epp, list) else 0
            })

        epp_riohs_data = {
            "total_entregas": total_entregas,
            "porcentaje_firmados": porcentaje_firmados,
            "constancias_riohs_firmadas": constancias_riohs_firmadas,
            "historial": historial_epp,
        }

        # 9. Contratistas (Subcontratación - D.S. 76)
        contratistas_qs = Contratista.objects.filter(
            Q(usuario__in=usuarios_grupo) |
            Q(empresa_principal__prevencionista__in=usuarios_grupo)
        ).distinct()
        total_empresas_contratistas = contratistas_qs.count()

        acreditadas_al_dia = 0
        contratistas_criticas = 0
        for c in contratistas_qs:
            estado_c = c.estado_cumplimiento
            if estado_c in ['AL_DIA', 'VIGENTE', 'APROBADO']:
                acreditadas_al_dia += 1
            elif estado_c == 'CRITICO':
                contratistas_criticas += 1

        porcentaje_cumplimiento_contratistas = (
            round((acreditadas_al_dia / total_empresas_contratistas * 100.0), 1)
            if total_empresas_contratistas > 0 else 100.0
        )

        contratistas_data = {
            "total_empresas": total_empresas_contratistas,
            "acreditadas_al_dia": acreditadas_al_dia,
            "porcentaje_cumplimiento": porcentaje_cumplimiento_contratistas,
        }

        # 10. Alertas Perentorias (Semáforo Legal SST en Tiempo Real)
        alertas_perentorias = []

        # A. Accidentes con DIAT pendiente 24h
        accidentes_diat_pendientes = accidentes_qs.filter(
            diat_presentada=False,
            tipo_evento__in=[InvestigacionAccidente.TIPO_TRABAJO, InvestigacionAccidente.TIPO_TRAYECTO]
        )
        if accidentes_diat_pendientes.exists():
            vencidos = [a for a in accidentes_diat_pendientes if a.plazo_limite_diat_24h and now > a.plazo_limite_diat_24h]
            if vencidos:
                alertas_perentorias.append({
                    "tipo": "CRITICA",
                    "titulo": "Plazo DIAT 24h Vencido",
                    "descripcion": f"{len(vencidos)} accidente(s) superaron el plazo legal perentorio de 24 horas sin constancia de DIAT en la mutualidad (D.S. 44).",
                    "enlace": "/panel/accidentes"
                })
            else:
                alertas_perentorias.append({
                    "tipo": "ADVERTENCIA",
                    "titulo": "DIAT 24h Pendiente",
                    "descripcion": f"{accidentes_diat_pendientes.count()} accidente(s) deben formalizarse ante la mutualidad antes de cumplir 24h.",
                    "enlace": "/panel/accidentes"
                })

        # B. Denuncias Ley Karin cerca o pasadas de 72h
        if alertas_72h_criticas > 0:
            alertas_perentorias.append({
                "tipo": "CRITICA",
                "titulo": "Ley Karin: Plazo Perentorio 72h",
                "descripcion": f"{alertas_72h_criticas} denuncia(s) en curso requieren pronunciamiento, medidas cautelares o derivación a la DT (Art. 211-B).",
                "enlace": "/panel/buzon-digital"
            })

        # C. Mandato CPHS por vencer o vencido
        if comite_principal:
            if dias_restantes_mandato is not None and dias_restantes_mandato < 0:
                alertas_perentorias.append({
                    "tipo": "CRITICA",
                    "titulo": "CPHS: Mandato Legal Vencido",
                    "descripcion": f"El mandato de 2 años de '{comite_principal.nombre}' ha caducado. Es urgente constituir una nueva directiva (D.S. 44).",
                    "enlace": "/panel/comite-paritario"
                })
            elif dias_restantes_mandato is not None and dias_restantes_mandato <= 60:
                alertas_perentorias.append({
                    "tipo": "ADVERTENCIA",
                    "titulo": "CPHS: Proceso Eleccionario (60 Días)",
                    "descripcion": f"Mandato CPHS vence en {dias_restantes_mandato} días. Debe convocarse a elecciones paritarias de trabajadores.",
                    "enlace": "/panel/comite-paritario"
                })

        # D. Contratistas no acreditadas o críticas operando
        if contratistas_criticas > 0:
            alertas_perentorias.append({
                "tipo": "CRITICA",
                "titulo": "Contratistas: Documentos Vencidos",
                "descripcion": f"{contratistas_criticas} empresa(s) colaboradora(s) registran certificados F30/F30-1 o seguros vencidos en faena (D.S. 76).",
                "enlace": "/panel/contratistas"
            })

        return Response({
            "riesgos": {
                "total": total_riesgos,
                "abiertos": abiertos_riesgos,
                "proceso": proceso_riesgos,
                "resueltos": resueltos_riesgos,
                "bajo": bajo_riesgos,
                "medio": medio_riesgos,
                "alto": alto_riesgos,
                "acto": acto_riesgos,
                "condicion": condicion_riesgos
            },
            "inspecciones": {
                "total": total_inspecciones,
                "promedio_cumplimiento": avg_cumplimiento,
                "historial": historial_inspecciones
            },
            "accidentes": {
                "total": total_accidentes,
                "trabajo": trabajo_accidentes,
                "trayecto": trayecto_accidentes,
                "incidente": incidente_accidentes,
                "historial": historial_accidentes
            },
            "descargas": {
                "utilizadas": descargas_semanales,
                "limite": limite_semanal,
                "plan_nombre": sub.plan.nombre if sub else "Plan Básico"
            },
            "capacitaciones": {
                "total": total_capacitaciones,
                "realizadas": realizadas_capacitaciones,
                "programadas": programadas_capacitaciones,
                "asistentes_alcanzados": asistentes_alcanzados,
                "cumplimiento_pac": pct_cumplimiento_pac,
                "historial": historial_capacitaciones
            },
            "cphs": cphs_data,
            "ley_karin": ley_karin_data,
            "epp_riohs": epp_riohs_data,
            "contratistas": contratistas_data,
            "alertas_perentorias": alertas_perentorias,
        })

class ReporteRiesgoPublicoCreateView(generics.CreateAPIView):
    """
    Endpoint público (sin autenticación) para que los trabajadores reporten
    condiciones o actos inseguros escaneando un código QR.
    El campo `usuario` es el prevencionista receptor identificado por su `uuid` seguro en la URL.
    Protegido contra fuerza bruta con AnonRateThrottle y ScopedRateThrottle (30 req/min).
    """
    serializer_class = ReporteRiesgoSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = 'public_qr'

    def create(self, request, *args, **kwargs):
        prevencionista_uuid = self.kwargs.get('prevencionista_uuid')
        try:
            prevencionista = Usuario.objects.get(uuid=prevencionista_uuid)
        except (Usuario.DoesNotExist, ValueError):
            return Response(
                {"error": "El código QR no corresponde a un prevencionista válido."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Validación Tenancy Ley 21.719 (A-3): Verificar que la empresa pertenezca al prevencionista del QR
        empresa = serializer.validated_data.get('empresa')
        if empresa:
            usuarios_grupo = get_usuarios_grupo(prevencionista)
            if getattr(empresa, 'prevencionista', None) not in usuarios_grupo:
                return Response(
                    {"error": "La empresa seleccionada no es válida para este prevencionista."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        reporte = serializer.save(
            usuario=prevencionista,
            tipo=ReporteRiesgo.TIPO_CONDICION,
            reportado_por_externo=True,
            estado=ReporteRiesgo.ESTADO_ABIERTO,
            gravedad=ReporteRiesgo.GRAVEDAD_MEDIA  # El prevencionista la clasifica luego
        )
        return Response(
            {
                "mensaje": "¡Reporte enviado con éxito! El prevencionista de tu empresa lo revisará pronto.",
                "uuid": str(reporte.uuid)
            },
            status=status.HTTP_201_CREATED
        )


class SugerenciaConsultaViewSet(viewsets.ModelViewSet):
    """
    ViewSet que gestiona el Buzón Digital de Participación y Consulta.
    - Listado / Detalle / PATCH (responder): requiere autenticación (prevencionista).
    - CREATE (`enviar`): endpoint público sin autenticación para trabajadores.
    """
    queryset = SugerenciaConsulta.objects.all()
    serializer_class = SugerenciaConsultaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        return SugerenciaConsulta.objects.filter(usuario__in=usuarios_grupo)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(
        detail=True,
        methods=['patch'],
        permission_classes=[permissions.IsAuthenticated],
        url_path='responder'
    )
    def responder(self, request, pk=None):
        """
        Permite al prevencionista marcar como leído y agregar una respuesta
        o acción tomada ante una sugerencia o consulta.
        """
        sugerencia = self.get_object()
        respuesta = request.data.get('respuesta', '').strip()

        sugerencia.leido = True
        if respuesta:
            sugerencia.respuesta = respuesta
            sugerencia.fecha_respuesta = timezone.now()
        sugerencia.save()

        return Response(
            SugerenciaConsultaSerializer(sugerencia).data,
            status=status.HTTP_200_OK
        )


def get_client_ip(request):
    """
    Obtiene la dirección IP confiable del cliente considerando proxies inversos (Render / Vercel).
    Seguridad Ley 21.719 (A-2): Evita falsificación tomando el salto seguro desde la derecha
    según NUM_PROXIES en lugar de un encabezado arbitrario inyectado por el cliente.
    """
    num_proxies = getattr(settings, 'NUM_PROXIES', 1)
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        parts = [p.strip() for p in x_forwarded_for.split(',') if p.strip()]
        if len(parts) >= num_proxies:
            return parts[-num_proxies]
        return parts[0]
    return request.META.get('REMOTE_ADDR') or '127.0.0.1'


class SugerenciaConsultaPublicaCreateView(generics.CreateAPIView):
    """
    Endpoint público (sin autenticación) para que los trabajadores envíen:
    a) Sugerencias Laborales abiertas de clima y mejora.
    b) Denuncias Formales Confidenciales bajo Ley Karin (Ley N° 21.643).
    El prevencionista receptor se identifica por su UUID seguro en la URL.
    Protegido contra fuerza bruta con AnonRateThrottle y ScopedRateThrottle (30 req/min).
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = 'public_qr'

    def create(self, request, *args, **kwargs):
        prevencionista_uuid = self.kwargs.get('prevencionista_uuid')
        try:
            prevencionista = Usuario.objects.get(uuid=prevencionista_uuid)
        except (Usuario.DoesNotExist, ValueError):
            return Response(
                {"error": "El código QR no corresponde a un prevencionista válido."},
                status=status.HTTP_404_NOT_FOUND
            )

        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        tipo_canal = data.get('tipo_canal') or data.get('canal')

        # Flujo B: Denuncia Formal Ley Karin
        if tipo_canal == 'DENUNCIA_KARIN' or 'rut_denunciante' in data:
            empresa_id = data.get('empresa')
            if not empresa_id:
                return Response(
                    {"error": "Debe seleccionar obligatoriamente la empresa a la cual pertenece la denuncia o sugerencia."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                empresa = Empresa.objects.filter(id=empresa_id, prevencionista=prevencionista).first()
            except (ValueError, TypeError):
                empresa = None

            if not empresa:
                return Response(
                    {"error": "Debe seleccionar obligatoriamente la empresa a la cual pertenece la denuncia o sugerencia."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = DenunciaLeyKarinPublicaCreateSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            denuncia = serializer.save(empresa=empresa)

            # Registro de auditoría de ingreso
            AuditLogAccesoDenuncia.objects.create(
                denuncia=denuncia,
                usuario=prevencionista,
                ip_origen=get_client_ip(request),
                accion="RECEPCION_PORTAL_PUBLICO"
            )

            return Response(
                {
                    "mensaje": "Denuncia Ley Karin recepcionada de manera confidencial y protegida. Se han activado los protocolos legales de resguardo.",
                    "uuid": str(denuncia.uuid),
                    "codigo_seguimiento": denuncia.codigo_seguimiento,
                    "tipo": "DENUNCIA_KARIN"
                },
                status=status.HTTP_201_CREATED
            )

        # Flujo A: Sugerencia Laboral Abierta
        es_anonimo = bool(data.get('es_anonimo', data.get('anonimo', True)))
        if not es_anonimo and not bool(data.get('acepta_privacidad')):
            return Response(
                {
                    "acepta_privacidad": [
                        "Debes autorizar el tratamiento de tus datos identificatorios opcionales o enviar el aporte de forma anónima."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        empresa_id = data.get('empresa')
        empresa = None
        if empresa_id:
            try:
                empresa = Empresa.objects.filter(id=empresa_id, prevencionista=prevencionista).first()
            except (ValueError, TypeError):
                empresa = None
        if not empresa:
            empresa = Empresa.objects.filter(prevencionista=prevencionista, activo=True).first()
        if empresa:
            tipo_sug = data.get('tipo', SugerenciaLaboral.TIPO_MEJORA_PROCESO)
            if tipo_sug == 'SUGERENCIA':
                tipo_sug = SugerenciaLaboral.TIPO_MEJORA_PROCESO
            elif tipo_sug == 'CONSULTA':
                tipo_sug = SugerenciaLaboral.TIPO_SEGURIDAD_GENERAL

            sugerencia_laboral = SugerenciaLaboral.objects.create(
                empresa=empresa,
                mensaje=data.get('mensaje', ''),
                tipo=tipo_sug,
                es_anonimo=es_anonimo,
                nombre_remitente=data.get('nombre_remitente'),
                contacto_remitente=data.get('contacto_remitente')
            )
            ret_uuid = str(sugerencia_laboral.uuid)
        else:
            # Compatibilidad retroactiva con SugerenciaConsulta
            legacy_serializer = SugerenciaConsultaSerializer(data=data)
            legacy_serializer.is_valid(raise_exception=True)
            sc = legacy_serializer.save(usuario=prevencionista)
            ret_uuid = str(sc.uuid)

        if not es_anonimo:
            identificador = (data.get('contacto_remitente') or data.get('nombre_remitente') or 'trabajador-identificado').strip()
            registrar_consentimiento(
                request,
                identificador_titular=identificador,
                flujo=RegistroConsentimiento.FLUJO_SUGERENCIA_IDENTIFICADA,
                otorgado=True,
                categorias=['sugerencia_identificada'],
                texto_aceptado="Consentimiento voluntario identificacion en buzon laboral v1.0",
            )

        return Response(
            {
                "mensaje": "Mensaje recibido. El prevencionista de tu empresa lo revisará a la brevedad.",
                "uuid": ret_uuid,
                "tipo": "SUGERENCIA"
            },
            status=status.HTTP_201_CREATED
        )


class PublicoEmpresasListView(APIView):
    """
    Endpoint público que lista las empresas y faenas de un prevencionista
    para permitir la selección adecuada en el portal QR.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_qr'

    def get(self, request, prevencionista_uuid):
        try:
            prevencionista = Usuario.objects.get(uuid=prevencionista_uuid)
        except (Usuario.DoesNotExist, ValueError):
            return Response({"error": "Prevencionista no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        empresa_param = request.query_params.get('empresa')
        if not empresa_param:
            return Response(
                {"error": "Debe especificar el parámetro ?empresa=<id> para acceder al canal público."},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            empresa_id = int(empresa_param)
        except (ValueError, TypeError):
            return Response(
                {"error": "El identificador de empresa debe ser numérico."},
                status=status.HTTP_400_BAD_REQUEST
            )

        usuarios_grupo = get_usuarios_grupo(prevencionista)
        empresas = Empresa.objects.filter(
            prevencionista__in=usuarios_grupo,
            activo=True,
            id=empresa_id
        )

        res = []
        for emp in empresas:
            centros = list(emp.centros_trabajo.values('id', 'nombre'))
            res.append({
                'id': emp.id,
                'razon_social': emp.razon_social,
                'nombre_fantasia': emp.nombre_fantasia or emp.razon_social,
                'centros_trabajo': centros
            })
        return Response(res, status=status.HTTP_200_OK)


def get_usuarios_grupo(user: Any) -> list[Any]:
    """Retorna la lista de usuarios del mismo grupo corporativo (cuenta padre y cuentas hijas)."""
    if not user or getattr(user, 'is_anonymous', True):
        return []
    owner: Any = getattr(user, 'cuenta_padre', None) or user
    cuentas_hijas: Any = getattr(owner, 'cuentas_hijas', None)
    if cuentas_hijas is not None and hasattr(cuentas_hijas, 'all'):
        return [owner] + list(cuentas_hijas.all())
    return [owner]


def validar_integridad_tenant(
    user: Any,
    validated_data: dict[str, Any],
    instance: Any = None,
    empresa_field: str = 'empresa',
) -> None:
    """
    Valida en create/update que todas las relaciones (FK) pertenezcan al grupo corporativo
    del usuario autenticado y sean consistentes entre sí (prevención de IDOR/bypass vía PATCH).
    """
    usuarios_grupo = get_usuarios_grupo(user)

    empresa_modificada = empresa_field in validated_data
    empresa = validated_data.get(empresa_field) if empresa_modificada else getattr(instance, empresa_field, None)
    if empresa_modificada and empresa is not None:
        if not empresa.prevencionista or empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({empresa_field: "No tienes permiso para operar sobre la empresa seleccionada."})

    if 'contratista' in validated_data:
        contratista = validated_data.get('contratista')
        if contratista is not None and contratista.usuario not in usuarios_grupo:
            raise ValidationError({"contratista": "No tienes permisos sobre este contratista."})

    comite_modificado = 'comite' in validated_data
    comite = validated_data.get('comite') if comite_modificado else getattr(instance, 'comite', None)
    if comite_modificado and comite is not None:
        if not comite.empresa.prevencionista or comite.empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"comite": "No tienes permiso sobre el comité seleccionado."})

    if 'matriz' in validated_data:
        matriz = validated_data.get('matriz')
        if matriz is not None and (not matriz.empresa.prevencionista or matriz.empresa.prevencionista not in usuarios_grupo):
            raise ValidationError({"matriz": "No tienes autorización sobre la matriz seleccionada."})

    centro_modificado = 'centro_trabajo' in validated_data
    centro = validated_data.get('centro_trabajo') if centro_modificado else getattr(instance, 'centro_trabajo', None)
    if centro is not None:
        if centro_modificado and (not centro.empresa.prevencionista or centro.empresa.prevencionista not in usuarios_grupo):
            raise ValidationError({"centro_trabajo": "El centro de trabajo no pertenece a tu grupo corporativo."})
        if (empresa_modificada or centro_modificado) and empresa is not None and centro.empresa_id != empresa.id:
            raise ValidationError({"centro_trabajo": "El centro de trabajo no pertenece a la empresa seleccionada."})

    trabajador_modificado = 'trabajador' in validated_data
    trabajador = validated_data.get('trabajador') if trabajador_modificado else getattr(instance, 'trabajador', None)
    empresa_objetivo = comite.empresa if comite is not None else empresa
    if trabajador is not None:
        if trabajador_modificado and (not trabajador.empresa.prevencionista or trabajador.empresa.prevencionista not in usuarios_grupo):
            raise ValidationError({"trabajador": "No tienes permiso sobre el trabajador seleccionado."})
        if (empresa_modificada or comite_modificado or trabajador_modificado) and empresa_objetivo is not None and trabajador.empresa_id != empresa_objetivo.id:
            raise ValidationError({"trabajador": "El trabajador no pertenece a la empresa seleccionada."})


class ContratistaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar contratistas y proveedores.
    """
    queryset = Contratista.objects.all()
    serializer_class: Any = ContratistaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        qs = Contratista.objects.filter(usuario__in=usuarios_grupo)
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_principal_id=empresa_id)
        return qs

    def perform_create(self, serializer):
        validar_integridad_tenant(
            self.request.user,
            serializer.validated_data,
            empresa_field='empresa_principal',
        )
        serializer.save(usuario=self.request.user)

    def perform_update(self, serializer):
        validar_integridad_tenant(
            self.request.user,
            serializer.validated_data,
            instance=serializer.instance,
            empresa_field='empresa_principal',
        )
        serializer.save()

    def get_serializer_class(self) -> Any:
        if self.action == 'list':
            return ContratistaResumenSerializer
        return ContratistaSerializer

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Devuelve estadísticas rápidas de cumplimiento de contratistas para el prevencionista.
        """
        queryset = self.get_queryset()
        total_contratistas = queryset.count()
        contratistas_al_dia = 0
        contratistas_por_vencer = 0
        contratistas_criticos = 0
        contratistas_sin_docs = 0

        for con in queryset:
            estado = con.estado_cumplimiento
            if estado == 'AL_DIA':
                contratistas_al_dia += 1
            elif estado == 'POR_VENCER':
                contratistas_por_vencer += 1
            elif estado == 'CRITICO':
                contratistas_criticos += 1
            elif estado == 'SIN_DOCUMENTOS':
                contratistas_sin_docs += 1

        # Estadísticas de documentos (aisladas al grupo corporativo / filtro activo)
        docs = DocumentoContratista.objects.filter(contratista__in=queryset)
        total_docs = docs.count()
        docs_vencidos = 0
        docs_por_vencer = 0
        docs_vigentes = 0

        for doc in docs:
            est = doc.estado_calculado
            if est == 'VENCIDO':
                docs_vencidos += 1
            elif est == 'POR_VENCER':
                docs_por_vencer += 1
            elif est == 'VIGENTE':
                docs_vigentes += 1

        # Trabajadores totales activos
        total_trabajadores = TrabajadorSubcontratado.objects.filter(
            contratista__in=queryset,
            activo=True
        ).count()

        return Response({
            'total_contratistas': total_contratistas,
            'contratistas_al_dia': contratistas_al_dia,
            'contratistas_por_vencer': contratistas_por_vencer,
            'contratistas_criticos': contratistas_criticos,
            'contratistas_sin_docs': contratistas_sin_docs,
            'total_documentos': total_docs,
            'documentos_vencidos': docs_vencidos,
            'documentos_por_vencer': docs_por_vencer,
            'documentos_vigentes': docs_vigentes,
            'total_trabajadores': total_trabajadores
        })


class DocumentoContratistaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la documentación legal de contratistas.
    """
    queryset = DocumentoContratista.objects.all()
    serializer_class = DocumentoContratistaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        req: Any = self.request
        usuarios_grupo = get_usuarios_grupo(req.user)
        queryset = DocumentoContratista.objects.filter(contratista__usuario__in=usuarios_grupo)
        contratista_id = req.query_params.get('contratista')
        if contratista_id:
            queryset = queryset.filter(contratista_id=contratista_id)
        return queryset

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()


class TrabajadorSubcontratadoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar la nómina de trabajadores subcontratados.
    """
    queryset = TrabajadorSubcontratado.objects.all()
    serializer_class = TrabajadorSubcontratadoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        req: Any = self.request
        usuarios_grupo = get_usuarios_grupo(req.user)
        queryset = TrabajadorSubcontratado.objects.filter(contratista__usuario__in=usuarios_grupo)
        contratista_id = req.query_params.get('contratista')
        if contratista_id:
            queryset = queryset.filter(contratista_id=contratista_id)
        return queryset

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()


class SolicitudCapacitacionPermission(permissions.BasePermission):
    """
    Permite que cualquier persona (pública o autenticada) envíe solicitudes de cotización (POST).
    Para listar o ver detalles: los administradores tienen acceso global;
    los usuarios logueados pueden ver el historial de sus propias solicitudes.
    """
    def has_permission(self, request, view):
        if request.method == 'POST':
            return True
        user: Any = request.user
        return user and user.is_authenticated


class SolicitudCapacitacionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la recepción y gestión de solicitudes de relatorías y capacitaciones externas.
    """
    queryset = SolicitudCapacitacion.objects.all()
    serializer_class = SolicitudCapacitacionSerializer
    permission_classes = [SolicitudCapacitacionPermission]

    def get_queryset(self):
        user: Any = self.request.user
        if not user or not user.is_authenticated:
            return SolicitudCapacitacion.objects.none()
        if user.is_superuser or user.is_staff:
            return SolicitudCapacitacion.objects.all()
        return SolicitudCapacitacion.objects.filter(usuario=user)

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            instance = serializer.save(usuario=self.request.user)
        else:
            instance = serializer.save()

        registrar_consentimiento(
            self.request,
            usuario=self.request.user if self.request.user and self.request.user.is_authenticated else None,
            identificador_titular=instance.contacto_email,
            flujo=RegistroConsentimiento.FLUJO_COTIZACION_CAPACITACION,
            otorgado=True,
            categorias=['cotizacion_capacitacion'],
            texto_aceptado="Autorizacion tratamiento de datos para cotizacion de capacitacion v1.0",
        )





class EmpresaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de Empresas asesoradas.
    Aislamiento Multi-Tenant estricto: el prevencionista solo ve y opera sobre sus propias empresas.
    """
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Empresa.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        return Empresa.objects.filter(prevencionista__in=usuarios_grupo)

    def perform_create(self, serializer):
        serializer.save(prevencionista=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        tiene_accidentes = instance.accidentes.exists()
        tiene_denuncias = instance.denuncias_karin.exists()
        tiene_epp = instance.entregas_epp.exists()
        if tiene_accidentes or tiene_denuncias or tiene_epp:
            return Response(
                {
                    "error": "No es posible eliminar esta empresa porque mantiene expedientes de accidentes (Ley 16.744), denuncias Ley Karin (Ley 21.643) o registros de EPP bajo deber legal de conservación mínima (5 años). Debe realizarse archivado o bloqueo."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class CentroTrabajoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Centros de Trabajo / Faenas / Sucursales.
    Aislamiento Multi-Tenant: solo centros de trabajo pertenecientes a las empresas del prevencionista.
    """
    queryset = CentroTrabajo.objects.all()
    serializer_class = CentroTrabajoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return CentroTrabajo.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        queryset = CentroTrabajo.objects.filter(empresa__prevencionista__in=usuarios_grupo)
        
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)
        return queryset

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()


class TrabajadorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Fichas y Registro de Trabajadores.
    Aislamiento Multi-Tenant: solo trabajadores vinculados a las empresas del prevencionista.
    """
    queryset = Trabajador.objects.all()
    serializer_class = TrabajadorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Trabajador.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        queryset = Trabajador.objects.filter(empresa__prevencionista__in=usuarios_grupo)
        
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)
            
        centro_id = self.request.query_params.get('centro_trabajo')
        if centro_id:
            queryset = queryset.filter(centro_trabajo_id=centro_id)
            
        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
            
        return queryset

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        instance = serializer.save()
        registrar_evento_seguridad(
            self.request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
            accion='TRABAJADOR_CREATE',
            usuario=self.request.user,
            modelo_afectado='Trabajador',
            recurso_id=instance.pk,
            exito=True,
            metadata={'empresa_id': instance.empresa_id},
        )

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        instance = serializer.save()
        registrar_evento_seguridad(
            self.request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
            accion='TRABAJADOR_UPDATE',
            usuario=self.request.user,
            modelo_afectado='Trabajador',
            recurso_id=instance.pk,
            exito=True,
            metadata={'empresa_id': instance.empresa_id},
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        pk_id = instance.pk
        empresa_id = instance.empresa_id
        tiene_accidentes = instance.accidentes_sufridos.exists()
        tiene_epp = instance.entregas_epp.exists()
        if tiene_accidentes or tiene_epp:
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
                accion='TRABAJADOR_DELETE',
                usuario=request.user,
                modelo_afectado='Trabajador',
                recurso_id=pk_id,
                exito=False,
                metadata={'empresa_id': empresa_id, 'reason': 'sst_dependency'},
            )
            return Response(
                {
                    "error": "No es posible eliminar la ficha de este trabajador porque registra accidentes laborales (Ley 16.744) o comprobantes de entrega de EPP con deber legal de conservación. Considere inactivar su estado."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        response = super().destroy(request, *args, **kwargs)
        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
            accion='TRABAJADOR_DELETE',
            usuario=request.user,
            modelo_afectado='Trabajador',
            recurso_id=pk_id,
            exito=True,
            metadata={'empresa_id': empresa_id},
        )
        return response


class DenunciaLeyKarinViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión confidencial y trazada de denuncias bajo Ley Karin (Ley N° 21.643).
    Aislamiento Multi-Tenant: solo accesible por el prevencionista a cargo de la empresa.
    Auditoría: cada retrieve (apertura de expediente) genera un registro inmutable en AuditLogAccesoDenuncia.
    """
    queryset = DenunciaLeyKarin.objects.all()
    serializer_class = DenunciaLeyKarinSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return DenunciaLeyKarinListSerializer
        return DenunciaLeyKarinSerializer

    def destroy(self, request, *args, **kwargs):
        """
        Bloqueo total de eliminación: Por mandato de la Ley N° 21.643 y la DT,
        los expedientes de denuncia laboral son inmutables y no pueden ser eliminados.
        """
        raise exceptions.MethodNotAllowed(
            "DELETE",
            detail="Por disposición de la Ley N° 21.643 y la Dirección del Trabajo (DT), las denuncias laborales no pueden ser eliminadas del sistema."
        )

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return DenunciaLeyKarin.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        queryset = DenunciaLeyKarin.objects.filter(empresa__prevencionista__in=usuarios_grupo)

        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)

        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado_tramite=estado)

        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Registrar auditoría inmutable de apertura de expediente
        AuditLogAccesoDenuncia.objects.create(
            denuncia=instance,
            usuario=request.user,
            ip_origen=get_client_ip(request),
            accion=AuditLogAccesoDenuncia.ACCION_APERTURA
        )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        instance = serializer.save()
        AuditLogAccesoDenuncia.objects.create(
            denuncia=instance,
            usuario=self.request.user,
            ip_origen=get_client_ip(self.request),
            accion=AuditLogAccesoDenuncia.ACCION_MODIFICACION
        )

    @action(detail=True, methods=['post', 'patch'], url_path='registrar-medidas')
    def registrar_medidas(self, request, pk=None):
        """
        Registra medidas cautelares de resguardo inmediato (separación física, etc.).
        """
        denuncia = self.get_object()
        medidas = request.data.get('medidas_resguardo_detalle', '').strip()
        if not medidas:
            return Response(
                {"medidas_resguardo_detalle": "Debe especificar las medidas cautelares adoptadas."},
                status=status.HTTP_400_BAD_REQUEST
            )
        denuncia.medidas_resguardo_detalle = medidas
        denuncia.estado_tramite = DenunciaLeyKarin.ESTADO_MEDIDAS_RESGUARDO
        denuncia.save()

        AuditLogAccesoDenuncia.objects.create(
            denuncia=denuncia,
            usuario=request.user,
            ip_origen=get_client_ip(request),
            accion=AuditLogAccesoDenuncia.ACCION_MEDIDAS
        )

        return Response(DenunciaLeyKarinSerializer(denuncia).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post', 'patch'], url_path='derivar-dt')
    def derivar_dt(self, request, pk=None):
        """
        Registra la derivación formal a la Inspección del Trabajo (DT).
        """
        denuncia = self.get_object()
        folio_dt = request.data.get('folio_dt', '').strip()
        denuncia.derivada_inspeccion_trabajo = True
        denuncia.folio_dt = folio_dt or None
        denuncia.estado_tramite = DenunciaLeyKarin.ESTADO_DERIVADA_DT
        denuncia.save()

        AuditLogAccesoDenuncia.objects.create(
            denuncia=denuncia,
            usuario=request.user,
            ip_origen=get_client_ip(request),
            accion=AuditLogAccesoDenuncia.ACCION_DERIVACION
        )

        return Response(DenunciaLeyKarinSerializer(denuncia).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post', 'patch'], url_path='derivar-mutualidad')
    def derivar_mutualidad(self, request, pk=None):
        """
        Registra la notificación formal a la mutualidad dentro de 5 días hábiles
        conforme al Compendio SUSESO Libro IV y Anexo 67.
        """
        denuncia = self.get_object()
        folio_mutualidad = request.data.get('folio_mutualidad', '').strip()
        atencion_psicologica = request.data.get('atencion_psicologica_ofrecida')
        fecha_ofrecimiento = request.data.get('fecha_ofrecimiento_psicologico')
        comprobante_file = request.FILES.get('comprobante_anexo_67')

        denuncia.derivada_mutualidad = True
        denuncia.fecha_derivacion_mutualidad = timezone.localdate()
        if folio_mutualidad:
            denuncia.folio_mutualidad = folio_mutualidad
        if atencion_psicologica is not None:
            denuncia.atencion_psicologica_ofrecida = str(atencion_psicologica).lower() in ['true', '1', 't']
        if fecha_ofrecimiento:
            denuncia.fecha_ofrecimiento_psicologico = fecha_ofrecimiento
        elif denuncia.atencion_psicologica_ofrecida and not denuncia.fecha_ofrecimiento_psicologico:
            denuncia.fecha_ofrecimiento_psicologico = timezone.localdate()
        if comprobante_file:
            denuncia.comprobante_anexo_67 = comprobante_file
        denuncia.save()

        AuditLogAccesoDenuncia.objects.create(
            denuncia=denuncia,
            usuario=request.user,
            ip_origen=get_client_ip(request),
            accion="DERIVACION_MUTUALIDAD_ANEXO67"
        )

        return Response(DenunciaLeyKarinSerializer(denuncia).data, status=status.HTTP_200_OK)


class SugerenciaLaboralViewSet(viewsets.ModelViewSet):
    """
    ViewSet para el Canal Abierto de Sugerencias y Clima Laboral.
    """
    queryset = SugerenciaLaboral.objects.all()
    serializer_class = SugerenciaLaboralSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return SugerenciaLaboral.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        queryset = SugerenciaLaboral.objects.filter(empresa__prevencionista__in=usuarios_grupo)

        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)

        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)

        return queryset

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()

    @action(detail=True, methods=['post', 'patch'], url_path='responder')
    def responder(self, request, pk=None):
        sugerencia = self.get_object()
        respuesta = request.data.get('respuesta', '').strip()
        estado = request.data.get('estado')
        if respuesta:
            sugerencia.respuesta = respuesta
        if estado in dict(SugerenciaLaboral.ESTADO_CHOICES):
            sugerencia.estado = estado
        sugerencia.save()
        return Response(SugerenciaLaboralSerializer(sugerencia).data, status=status.HTTP_200_OK)


class ComiteParitarioViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de Comités Paritarios de Higiene y Seguridad (CPHS) según D.S. N° 44.
    Aislamiento Multi-Tenant: solo comités de empresas asesoradas por el usuario / grupo del prevencionista.
    """
    queryset = ComiteParitario.objects.all()
    serializer_class = ComiteParitarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return ComiteParitario.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        queryset = ComiteParitario.objects.filter(
            empresa__prevencionista__in=usuarios_grupo
        ).select_related('empresa', 'centro_trabajo').prefetch_related('miembros', 'actas')

        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)

        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)

        return queryset

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()

    @action(detail=True, methods=['get'], url_path='estadisticas')
    def estadisticas(self, request, pk=None):
        """
        Retorna estadísticas normativas del CPHS:
        - Sesiones ordinarias del año en curso vs meta legal (12 anuales según D.S. 44).
        - Acuerdos totales, cumplidos y pendientes.
        - Días restantes de mandato legal (2 años).
        - Estructura y paridad de miembros.
        """
        comite = self.get_object()
        hoy = timezone.localdate()

        # 1. Sesiones ordinarias en el año actual (meta 12)
        sesiones_ordinarias_ano = comite.actas.filter(
            tipo_sesion=ActaSesionCPHS.TIPO_ORDINARIA,
            fecha_hora_sesion__year=hoy.year
        ).count()
        meta_legal_anual = 12
        porcentaje_sesiones = min(100.0, round((sesiones_ordinarias_ano / meta_legal_anual) * 100, 1))

        # 2. Acuerdos preventivos
        total_acuerdos = 0
        acuerdos_cumplidos = 0
        for acta in comite.actas.all():
            if isinstance(acta.acuerdos, list):
                total_acuerdos += len(acta.acuerdos)
                acuerdos_cumplidos += sum(1 for a in acta.acuerdos if isinstance(a, dict) and a.get('cumplido') is True)

        acuerdos_pendientes = total_acuerdos - acuerdos_cumplidos
        tasa_cumplimiento_acuerdos = round((acuerdos_cumplidos / total_acuerdos) * 100, 1) if total_acuerdos > 0 else 100.0

        # 3. Composición paritaria
        miembros_activos = comite.miembros.filter(activo=True)
        titulares_empresa = miembros_activos.filter(
            estamento=MiembroCPHS.ESTAMENTO_EMPRESA,
            tipo_representacion=MiembroCPHS.REPRESENTACION_TITULAR
        ).count()
        titulares_trabajadores = miembros_activos.filter(
            estamento=MiembroCPHS.ESTAMENTO_TRABAJADORES,
            tipo_representacion=MiembroCPHS.REPRESENTACION_TITULAR
        ).count()
        suplentes_empresa = miembros_activos.filter(
            estamento=MiembroCPHS.ESTAMENTO_EMPRESA,
            tipo_representacion=MiembroCPHS.REPRESENTACION_SUPLENTE
        ).count()
        suplentes_trabajadores = miembros_activos.filter(
            estamento=MiembroCPHS.ESTAMENTO_TRABAJADORES,
            tipo_representacion=MiembroCPHS.REPRESENTACION_SUPLENTE
        ).count()

        presidente = miembros_activos.filter(cargo=MiembroCPHS.CARGO_PRESIDENTE).first()
        secretario = miembros_activos.filter(cargo=MiembroCPHS.CARGO_SECRETARIO).first()

        return Response({
            "comite_id": comite.id,
            "comite_nombre": comite.nombre,
            "empresa_nombre": comite.empresa.razon_social,
            "fecha_constitucion": comite.fecha_constitucion,
            "fecha_vencimiento_mandato": comite.fecha_vencimiento_mandato,
            "dias_restantes_mandato": comite.dias_restantes_mandato,
            "estado_mandato": comite.estado,
            "estado_mandato_display": comite.get_estado_display(),
            # Sesiones mensuales
            "sesiones_ordinarias_ano": sesiones_ordinarias_ano,
            "meta_legal_anual": meta_legal_anual,
            "porcentaje_cumplimiento_sesiones": porcentaje_sesiones,
            "total_actas": comite.actas.count(),
            # Acuerdos
            "total_acuerdos": total_acuerdos,
            "acuerdos_cumplidos": acuerdos_cumplidos,
            "acuerdos_pendientes": acuerdos_pendientes,
            "tasa_cumplimiento_acuerdos": tasa_cumplimiento_acuerdos,
            # Estructura paritaria
            "total_miembros": miembros_activos.count(),
            "titulares_empresa": titulares_empresa,
            "titulares_trabajadores": titulares_trabajadores,
            "suplentes_empresa": suplentes_empresa,
            "suplentes_trabajadores": suplentes_trabajadores,
            "tiene_presidente": presidente is not None,
            "tiene_secretario": secretario is not None,
            "presidente_nombre": presidente.nombre if presidente else None,
            "secretario_nombre": secretario.nombre if secretario else None,
            "paridad_completa": (titulares_empresa == 3 and titulares_trabajadores == 3)
        }, status=status.HTTP_200_OK)


class MiembroCPHSViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de integrantes del Comité Paritario (CPHS).
    Permite registrar titulares, suplentes y cargos de Presidente/Secretario.
    """
    queryset = MiembroCPHS.objects.all()
    serializer_class = MiembroCPHSSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return MiembroCPHS.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        queryset = MiembroCPHS.objects.filter(
            comite__empresa__prevencionista__in=usuarios_grupo
        ).select_related('comite', 'trabajador')

        comite_id = self.request.query_params.get('comite')
        if comite_id:
            queryset = queryset.filter(comite_id=comite_id)

        estamento = self.request.query_params.get('estamento')
        if estamento:
            queryset = queryset.filter(estamento=estamento)

        return queryset

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        comite = serializer.validated_data.get('comite')

        # Si se asigna cargo Presidente o Secretario, actualizar al anterior a VOCAL si existiese
        cargo = serializer.validated_data.get('cargo')
        if cargo in [MiembroCPHS.CARGO_PRESIDENTE, MiembroCPHS.CARGO_SECRETARIO]:
            MiembroCPHS.objects.filter(comite=comite, cargo=cargo).update(cargo=MiembroCPHS.CARGO_VOCAL)

        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        cargo = serializer.validated_data.get('cargo')
        instance = self.get_object()
        comite_objetivo = serializer.validated_data.get('comite', instance.comite)
        if cargo in [MiembroCPHS.CARGO_PRESIDENTE, MiembroCPHS.CARGO_SECRETARIO]:
            MiembroCPHS.objects.filter(comite=comite_objetivo, cargo=cargo).exclude(id=instance.id).update(cargo=MiembroCPHS.CARGO_VOCAL)
        serializer.save()


def validar_quorum_legal_cphs(comite, asistentes):
    """
    Art. 40 D.S. N° 44: Prohíbe sesionar válidamente al CPHS si no concurre al menos
    1 representante de la entidad empleadora y 1 de las personas trabajadoras.
    """
    if not asistentes or not isinstance(asistentes, list):
        raise ValidationError({"quorum": "Infracción al Art. 40 del D.S. N° 44: Se requiere la asistencia de al menos 1 representante de la entidad empleadora y 1 de las personas trabajadoras para sesionar válidamente."})

    asistentes_patronales = 0
    asistentes_laborales = 0

    miembros_db = list(comite.miembros.filter(activo=True)) if comite else []
    for a in asistentes:
        a_str = str(a).upper()
        if 'EMPRESA' in a_str or 'PATRONAL' in a_str or 'EMPLEADOR' in a_str:
            asistentes_patronales += 1
        elif 'TRABAJADOR' in a_str or 'LABORAL' in a_str:
            asistentes_laborales += 1
        else:
            for m in miembros_db:
                if m.nombre.upper() in a_str:
                    if m.estamento == MiembroCPHS.ESTAMENTO_EMPRESA:
                        asistentes_patronales += 1
                    elif m.estamento == MiembroCPHS.ESTAMENTO_TRABAJADORES:
                        asistentes_laborales += 1
                    break

    if asistentes_patronales < 1 or asistentes_laborales < 1:
        raise ValidationError({"quorum": "Infracción al Art. 40 del D.S. N° 44: Se requiere la asistencia de al menos 1 representante de la entidad empleadora y 1 de las personas trabajadoras para sesionar válidamente."})


class ActaSesionCPHSViewSet(viewsets.ModelViewSet):
    """
    ViewSet para el Libro Digital de Actas del CPHS (D.S. N° 44).
    Aislamiento Multi-Tenant: solo actas de comités de empresas del prevencionista.
    """
    queryset = ActaSesionCPHS.objects.all()
    serializer_class = ActaSesionCPHSSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return ActaSesionCPHS.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        queryset = ActaSesionCPHS.objects.filter(
            comite__empresa__prevencionista__in=usuarios_grupo
        ).select_related('comite')

        comite_id = self.request.query_params.get('comite')
        if comite_id:
            queryset = queryset.filter(comite_id=comite_id)

        tipo_sesion = self.request.query_params.get('tipo_sesion')
        if tipo_sesion:
            queryset = queryset.filter(tipo_sesion=tipo_sesion)

        return queryset

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        comite = serializer.validated_data.get('comite')

        # Art. 40 D.S. N° 44: Quórum legal obligatorio
        asistentes = serializer.validated_data.get('asistentes', [])
        validar_quorum_legal_cphs(comite, asistentes)

        # Asignar número correlativo automático si no viene asignado
        numero = serializer.validated_data.get('numero_acta')
        if not numero:
            ultimo = ActaSesionCPHS.objects.filter(comite=comite).order_by('-numero_acta').first()
            siguiente = (ultimo.numero_acta + 1) if ultimo else 1
            serializer.save(numero_acta=siguiente)
        else:
            serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        comite = serializer.validated_data.get('comite', serializer.instance.comite)
        asistentes = serializer.validated_data.get('asistentes', serializer.instance.asistentes)
        validar_quorum_legal_cphs(comite, asistentes)
        serializer.save()

    @action(detail=True, methods=['patch'], url_path='cambiar-estado-acuerdo')
    def cambiar_estado_acuerdo(self, request, pk=None):
        """
        Marca un acuerdo preventivo del acta como cumplido o pendiente.
        Body: {"indice_acuerdo": 0, "cumplido": true}
        """
        acta = self.get_object()
        indice = request.data.get('indice_acuerdo')
        cumplido = request.data.get('cumplido')

        if indice is None or not isinstance(acta.acuerdos, list):
            return Response(
                {"error": "Debe especificar el 'indice_acuerdo' a actualizar."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            indice = int(indice)
        except (ValueError, TypeError):
            return Response({"error": "El 'indice_acuerdo' debe ser un número entero."}, status=status.HTTP_400_BAD_REQUEST)

        if indice < 0 or indice >= len(acta.acuerdos):
            return Response(
                {"error": f"Índice fuera de rango. El acta posee {len(acta.acuerdos)} acuerdo(s)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        acuerdos_modificados = list(acta.acuerdos)
        if isinstance(acuerdos_modificados[indice], dict):
            es_cumplido = bool(cumplido)
            acuerdos_modificados[indice]['cumplido'] = es_cumplido
            if es_cumplido:
                acuerdos_modificados[indice]['fecha_cumplimiento'] = timezone.localdate().isoformat()
            else:
                acuerdos_modificados[indice].pop('fecha_cumplimiento', None)

        acta.acuerdos = acuerdos_modificados
        acta.save(update_fields=['acuerdos'])

        return Response(ActaSesionCPHSSerializer(acta).data, status=status.HTTP_200_OK)


class EntregaEPPViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la Gestión y Registro de Entrega de EPP y RIOHS con Firma Digital.
    Cumple con el Art. 68 de la Ley 16.744 y Art. 53 del D.S. 594.
    Aislamiento Multi-Tenant estricto para el prevencionista y sus empresas asesoradas.
    """
    queryset = EntregaEPP.objects.all()
    serializer_class = EntregaEPPSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return EntregaEPP.objects.none()
        usuarios_grupo = get_usuarios_grupo(user)
        queryset = EntregaEPP.objects.filter(
            empresa__prevencionista__in=usuarios_grupo
        ).select_related('empresa', 'centro_trabajo', 'trabajador', 'responsable_entrega')

        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)

        trabajador_id = self.request.query_params.get('trabajador')
        if trabajador_id:
            queryset = queryset.filter(trabajador_id=trabajador_id)

        riohs = self.request.query_params.get('entrega_riohs')
        if riohs is not None:
            queryset = queryset.filter(entrega_riohs=(riohs.lower() in ['true', '1']))

        return queryset

    def perform_create(self, serializer):
        empresa = serializer.validated_data.get('empresa')
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        if empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"empresa": "No tienes permiso para registrar entregas de EPP en esta empresa."})

        trabajador = serializer.validated_data.get('trabajador')
        if trabajador.empresa != empresa:
            raise ValidationError({"trabajador": "El trabajador no pertenece a la empresa indicada."})

        centro_trabajo = serializer.validated_data.get('centro_trabajo')
        if centro_trabajo and centro_trabajo.empresa != empresa:
            raise ValidationError({"centro_trabajo": "El centro de trabajo no pertenece a la empresa indicada."})

        ip = get_client_ip(self.request)
        instance = serializer.save(
            responsable_entrega=self.request.user,
            ip_registro=ip
        )
        registrar_evento_seguridad(
            self.request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_SST,
            accion='EPP_CREATE',
            usuario=self.request.user,
            modelo_afectado='EntregaEPP',
            recurso_id=instance.pk,
            exito=True,
            metadata={'empresa_id': instance.empresa_id, 'entrega_riohs': bool(instance.entrega_riohs)},
        )

    def update(self, request, *args, **kwargs):
        raise exceptions.MethodNotAllowed(
            "PUT",
            detail="Por disposición de la Ley N° 19.799 sobre documentos electrónicos y firma electrónica, los comprobantes de entrega de EPP y RIOHS debidamente firmados son inmutables y no admiten modificaciones."
        )

    def partial_update(self, request, *args, **kwargs):
        raise exceptions.MethodNotAllowed(
            "PATCH",
            detail="Por disposición de la Ley N° 19.799 sobre documentos electrónicos y firma electrónica, los comprobantes de entrega de EPP y RIOHS debidamente firmados son inmutables y no admiten modificaciones."
        )

    def destroy(self, request, *args, **kwargs):
        raise exceptions.MethodNotAllowed(
            "DELETE",
            detail="Por disposición de la Ley N° 19.799 sobre documentos electrónicos y firma electrónica, los comprobantes de entrega de EPP y RIOHS firmados no pueden ser eliminados del sistema."
        )

    @action(detail=False, methods=['get'], url_path='estadisticas')
    def estadisticas(self, request):
        """
        Retorna métricas preventivas:
        - Entregas de EPP realizadas en el mes en curso.
        - Total de trabajadores de la empresa con RIOHS firmado vs pendientes de entrega.
        - Total histórico de entregas y equipos entregados.
        """
        user = request.user
        usuarios_grupo = get_usuarios_grupo(user)
        entregas_qs = EntregaEPP.objects.filter(empresa__prevencionista__in=usuarios_grupo)
        trabajadores_qs = Trabajador.objects.filter(
            empresa__prevencionista__in=usuarios_grupo,
            estado=Trabajador.ESTADO_ACTIVO
        )

        empresa_id = request.query_params.get('empresa')
        if empresa_id:
            entregas_qs = entregas_qs.filter(empresa_id=empresa_id)
            trabajadores_qs = trabajadores_qs.filter(empresa_id=empresa_id)

        hoy = timezone.localdate()
        entregas_mes = entregas_qs.filter(
            fecha_hora_entrega__year=hoy.year,
            fecha_hora_entrega__month=hoy.month
        ).count()

        total_trabajadores = trabajadores_qs.count()
        trabajadores_con_riohs_ids = set(
            entregas_qs.filter(entrega_riohs=True)
            .values_list('trabajador_id', flat=True)
        )
        trabajadores_activos_ids = set(trabajadores_qs.values_list('id', flat=True))
        con_riohs_count = len(trabajadores_con_riohs_ids.intersection(trabajadores_activos_ids))
        pendientes_riohs_count = max(0, total_trabajadores - con_riohs_count)
        porcentaje_riohs = round((con_riohs_count / total_trabajadores) * 100, 1) if total_trabajadores > 0 else 0.0

        total_entregas = entregas_qs.count()
        total_items_epp = 0
        for entrega in entregas_qs:
            if isinstance(entrega.items_epp, list):
                total_items_epp += sum(int(item.get('cantidad', 1)) for item in entrega.items_epp if isinstance(item, dict))

        return Response({
            "entregas_mes": entregas_mes,
            "total_trabajadores": total_trabajadores,
            "trabajadores_con_riohs": con_riohs_count,
            "trabajadores_pendientes_riohs": pendientes_riohs_count,
            "porcentaje_cumplimiento_riohs": porcentaje_riohs,
            "total_entregas_historico": total_entregas,
            "total_items_epp_entregados": total_items_epp,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='historial-trabajador/(?P<trabajador_id>[^/.]+)')
    def historial_trabajador(self, request, trabajador_id=None):
        """
        Retorna todas las entregas de EPP y RIOHS correspondientes a un trabajador específico.
        """
        user = request.user
        usuarios_grupo = get_usuarios_grupo(user)
        trabajador = get_object_or_404(
            Trabajador.objects.filter(empresa__prevencionista__in=usuarios_grupo),
            pk=trabajador_id
        )
        entregas = EntregaEPP.objects.filter(trabajador=trabajador).order_by('-fecha_hora_entrega')
        serializer = self.get_serializer(entregas, many=True)
        return Response({
            "trabajador": {
                "id": trabajador.id,
                "nombres": trabajador.nombres,
                "apellidos": trabajador.apellidos,
                "rut": trabajador.rut,
                "cargo": trabajador.cargo,
                "empresa_nombre": trabajador.empresa.razon_social
            },
            "entregas": serializer.data
        }, status=status.HTTP_200_OK)


class RequisitoLegalBaseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de solo lectura para consultar el catálogo oficial de Requisitos Legales Base SST de Chile.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RequisitoLegalBaseSerializer
    queryset = RequisitoLegalBase.objects.filter(activo=True)

    def get_queryset(self):
        if not RequisitoLegalBase.objects.exists():
            asegurar_requisitos_base()
        qs = RequisitoLegalBase.objects.filter(activo=True)
        rubro = self.request.query_params.get('rubro_aplicable')
        if rubro:
            qs = qs.filter(Q(rubro_aplicable=rubro) | Q(rubro_aplicable=RequisitoLegalBase.RUBRO_TRANSVERSAL))
        organismo = self.request.query_params.get('organismo')
        if organismo:
            qs = qs.filter(organismo=organismo)
        return qs.order_by('orden', 'identificacion_norma', 'articulo')


class MatrizLegalViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de Matrices Legales por empresa y faena.
    Aislamiento Multi-Tenant estricto para el prevencionista / grupo corporativo.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MatrizLegalSerializer

    def get_queryset(self):
        user = self.request.user
        usuarios_grupo = get_usuarios_grupo(user)
        qs = MatrizLegal.objects.filter(empresa__prevencionista__in=usuarios_grupo)

        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)

        centro_trabajo_id = self.request.query_params.get('centro_trabajo')
        if centro_trabajo_id:
            qs = qs.filter(centro_trabajo_id=centro_trabajo_id)

        return qs.order_by('-fecha_actualizacion')

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save(prevencionista=self.request.user)

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()

    @action(detail=False, methods=['post'], url_path='generar-automatica')
    def generar_automatica(self, request):
        """
        Genera en 1 segundo una matriz legal completa con ítems individualizados
        según el rubro de la empresa (CIIU) y las condiciones particulares de su faena.
        """
        user = request.user
        usuarios_grupo = get_usuarios_grupo(user)

        empresa_id = request.data.get('empresa_id')
        if not empresa_id:
            return Response({"error": "Debe indicar el ID de la empresa evaluada."}, status=status.HTTP_400_BAD_REQUEST)

        empresa = get_object_or_404(
            Empresa.objects.filter(prevencionista__in=usuarios_grupo),
            pk=empresa_id
        )

        centro_trabajo_id = request.data.get('centro_trabajo_id')
        centro_trabajo = None
        if centro_trabajo_id:
            centro_trabajo = get_object_or_404(
                CentroTrabajo.objects.filter(empresa=empresa),
                pk=centro_trabajo_id
            )

        rubro = request.data.get('rubro', RequisitoLegalBase.RUBRO_TRANSVERSAL)
        condiciones = request.data.get('condiciones', {})
        if not isinstance(condiciones, dict):
            condiciones = {}

        # Asegurar catálogo base disponible
        if not RequisitoLegalBase.objects.exists():
            asegurar_requisitos_base()

        # Crear la cabecera de la matriz
        matriz = MatrizLegal.objects.create(
            empresa=empresa,
            centro_trabajo=centro_trabajo,
            prevencionista=user,
            rubro_principal=rubro,
            condiciones_faena=condiciones,
            observacion_general=request.data.get('observacion_general', '')
        )

        # Seleccionar requisitos aplicables
        requisitos_candidatos = RequisitoLegalBase.objects.filter(
            activo=True
        ).filter(
            Q(rubro_aplicable=RequisitoLegalBase.RUBRO_TRANSVERSAL) | Q(rubro_aplicable=rubro)
        )

        items_to_create = []
        for req in requisitos_candidatos:
            cond = req.condicion_activacion.strip().upper() if req.condicion_activacion else ""
            if cond:
                activar = False
                if cond == "MAS_25_TRABAJADORES" and (condiciones.get("mas_25_trabajadores") or condiciones.get("mas_25")):
                    activar = True
                elif cond == "MAS_10_TRABAJADORES" and (condiciones.get("mas_10_trabajadores") or condiciones.get("mas_10")):
                    activar = True
                elif cond == "MAS_100_TRABAJADORES" and (condiciones.get("mas_100_trabajadores") or condiciones.get("mas_100")):
                    activar = True
                elif cond == "TRABAJO_ALTURA" and (condiciones.get("trabajo_altura") or condiciones.get("altura")):
                    activar = True
                elif cond == "SUSTANCIAS_PELIGROSAS" and (condiciones.get("sustancias_peligrosas") or condiciones.get("suspel")):
                    activar = True
                elif cond == "SUBCONTRATACION" and (condiciones.get("subcontratacion") or condiciones.get("subcontratistas")):
                    activar = True
                elif cond == "ESPACIOS_CONFINADOS" and (condiciones.get("espacios_confinados") or condiciones.get("confinados")):
                    activar = True
                elif cond == "RUIDO_OCUPACIONAL" and (condiciones.get("ruido_ocupacional") or condiciones.get("prexor") or condiciones.get("ruido")):
                    activar = True
                elif cond == "SILICE_POLVO" and (condiciones.get("silice_polvo") or condiciones.get("planesi") or condiciones.get("silice")):
                    activar = True

                if not activar:
                    continue

            items_to_create.append(ItemMatrizLegal(
                matriz=matriz,
                requisito_base=req,
                organismo=req.organismo,
                tipo_norma=req.tipo_norma,
                identificacion_norma=req.identificacion_norma,
                articulo=req.articulo,
                titulo=req.titulo,
                descripcion_exigencia=req.descripcion_exigencia,
                sancion_multa=req.sancion_multa,
                estado=ItemMatrizLegal.ESTADO_PROCESO,
                orden=req.orden
            ))

        ItemMatrizLegal.objects.bulk_create(items_to_create)

        serializer = self.get_serializer(matriz)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='estadisticas')
    def estadisticas(self, request, pk=None):
        """
        Retorna estadísticas ejecutivas de cumplimiento y desglose por organismo fiscalizador.
        """
        matriz = self.get_object()
        items = matriz.items.exclude(estado=ItemMatrizLegal.ESTADO_NO_APLICA)

        desglose_organismo = {}
        for org_code, org_name in RequisitoLegalBase.ORGANISMO_CHOICES:
            org_items = items.filter(organismo=org_code)
            total_org = org_items.count()
            if total_org > 0:
                cumplidos_org = org_items.filter(estado=ItemMatrizLegal.ESTADO_CUMPLE).count()
                pct_org = round((cumplidos_org / total_org) * 100, 1)
                desglose_organismo[org_code] = {
                    "organismo_nombre": org_name,
                    "total": total_org,
                    "cumplidos": cumplidos_org,
                    "en_proceso": org_items.filter(estado=ItemMatrizLegal.ESTADO_PROCESO).count(),
                    "brechas_criticas": org_items.filter(estado=ItemMatrizLegal.ESTADO_NO_CUMPLE).count(),
                    "porcentaje_cumplimiento": pct_org
                }

        return Response({
            "matriz_id": matriz.id,
            "empresa_nombre": matriz.empresa.razon_social,
            "rubro": matriz.get_rubro_principal_display(),
            "total_requisitos": matriz.total_requisitos,
            "cumplidos": matriz.cumplidos,
            "en_proceso": matriz.en_proceso,
            "brechas_criticas": matriz.brechas_criticas,
            "porcentaje_cumplimiento": matriz.porcentaje_cumplimiento,
            "estado_semaforo": matriz.estado_semaforo,
            "desglose_organismo": desglose_organismo
        }, status=status.HTTP_200_OK)


class ItemMatrizLegalViewSet(viewsets.ModelViewSet):
    """
    ViewSet para actualizar el estado de cumplimiento, evidencia y plazos de un ítem de matriz legal.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ItemMatrizLegalSerializer

    def get_queryset(self):
        user = self.request.user
        usuarios_grupo = get_usuarios_grupo(user)
        qs = ItemMatrizLegal.objects.filter(matriz__empresa__prevencionista__in=usuarios_grupo)

        matriz_id = self.request.query_params.get('matriz')
        if matriz_id:
            qs = qs.filter(matriz_id=matriz_id)

        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)

        organismo = self.request.query_params.get('organismo')
        if organismo:
            qs = qs.filter(organismo=organismo)

        return qs.order_by('orden', 'identificacion_norma', 'articulo')

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()


class MatrizRiesgoMiperViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de Matrices de Riesgo MIPER (Guía Técnica ISP / D.S. N° 44).
    Aislamiento Multi-Tenant estricto para el prevencionista / grupo corporativo.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MatrizRiesgoMiperSerializer

    def get_queryset(self):
        user = self.request.user
        usuarios_grupo = get_usuarios_grupo(user)
        qs = MatrizRiesgoMiper.objects.filter(empresa__prevencionista__in=usuarios_grupo)

        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)

        centro_trabajo_id = self.request.query_params.get('centro_trabajo')
        if centro_trabajo_id:
            qs = qs.filter(centro_trabajo_id=centro_trabajo_id)

        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)

        return qs.order_by('-fecha_actualizacion')

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save(prevencionista=self.request.user)

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()

    @action(detail=True, methods=['get'], url_path='matriz-calor')
    def matriz_calor(self, request, pk=None):
        """
        Retorna la matriz de distribución 5x5 del ISP para Riesgo Puro vs. Riesgo Residual
        (conteo de peligros en cada celda de probabilidad x severidad para renderizar el mapa de calor).
        """
        matriz = self.get_object()
        items = list(matriz.items.all())

        grid = []
        for probabilidad in range(5, 0, -1):  # Eje Y: 5 (Muy alta) a 1 (Muy baja)
            for severidad in range(1, 6):      # Eje X: 1 (Insignificante) a 5 (Catastrófica)
                mag = probabilidad * severidad
                if mag >= 17:
                    clasificacion = 'CRITICO'
                elif mag >= 10:
                    clasificacion = 'ALTO'
                elif mag >= 5:
                    clasificacion = 'MEDIO'
                else:
                    clasificacion = 'BAJO'

                count_puro = sum(
                    1 for it in items
                    if it.probabilidad_pura == probabilidad and it.severidad_pura == severidad
                )
                count_residual = sum(
                    1 for it in items
                    if it.probabilidad_residual == probabilidad and it.severidad_residual == severidad
                )

                grid.append({
                    "probabilidad": probabilidad,
                    "severidad": severidad,
                    "magnitud": mag,
                    "clasificacion": clasificacion,
                    "count_puro": count_puro,
                    "count_residual": count_residual,
                })

        return Response({
            "matriz_id": matriz.id,
            "matriz_nombre": matriz.nombre,
            "total_peligros": matriz.total_peligros,
            "porcentaje_reduccion_riesgo": matriz.porcentaje_reduccion_riesgo,
            "totales": {
                "puro": {
                    "critico": matriz.criticos_puros,
                    "alto": matriz.altos_puros,
                    "medio": sum(1 for it in items if 5 <= it.magnitud_pura <= 9),
                    "bajo": sum(1 for it in items if it.magnitud_pura <= 4),
                },
                "residual": {
                    "critico": matriz.criticos_residuales,
                    "alto": matriz.altos_residuales,
                    "medio": matriz.medios_residuales,
                    "bajo": matriz.bajos_residuales,
                }
            },
            "grid": grid
        }, status=status.HTTP_200_OK)


class ItemMatrizRiesgoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de ítems individuales de la Matriz MIPER.
    Permite CRUD completo de ítems con reordenamiento y aislamiento multi-tenant.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ItemMatrizRiesgoSerializer

    def get_queryset(self):
        user = self.request.user
        usuarios_grupo = get_usuarios_grupo(user)
        qs = ItemMatrizRiesgo.objects.filter(matriz__empresa__prevencionista__in=usuarios_grupo)

        matriz_id = self.request.query_params.get('matriz')
        if matriz_id:
            qs = qs.filter(matriz_id=matriz_id)

        tipo_actividad = self.request.query_params.get('tipo_actividad')
        if tipo_actividad:
            qs = qs.filter(tipo_actividad=tipo_actividad)

        clasificacion_peligro = self.request.query_params.get('clasificacion_peligro')
        if clasificacion_peligro:
            qs = qs.filter(clasificacion_peligro=clasificacion_peligro)

        estado_control = self.request.query_params.get('estado_control')
        if estado_control:
            qs = qs.filter(estado_control=estado_control)

        return qs.order_by('orden', 'id')

    def perform_create(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data)
        serializer.save()

    def perform_update(self, serializer):
        validar_integridad_tenant(self.request.user, serializer.validated_data, instance=serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        usuarios_grupo = get_usuarios_grupo(user)
        if instance.matriz.empresa.prevencionista not in usuarios_grupo:
            raise ValidationError("No tienes autorización para eliminar ítems de esta matriz MIPER.")
        instance.delete()


class ClimaUvView(APIView):
    """
    Endpoint georreferenciado de Radiación UV Solar (D.S. N° 594 Art. 109)
    y Estrés Térmico por Calor (Enmienda ISO 2024 Cláusulas 4.1 y 4.2).
    Conecta con Open-Meteo API con caché de 30 minutos y resolución de faenas chilenas.
    """
    permission_classes = [permissions.AllowAny]

    COORDENADAS_CHILE = {
        'SANTIAGO': (-33.45, -70.66),
        'ANTOFAGASTA': (-23.65, -70.40),
        'CALAMA': (-22.45, -68.93),
        'CONCEPCION': (-36.83, -73.05),
        'PUERTO MONTT': (-41.47, -72.94),
        'VALPARAISO': (-33.04, -71.62),
        'IQUIQUE': (-20.21, -70.15),
        'COPIAPO': (-27.36, -70.33),
        'RANCAGUA': (-34.17, -70.74),
        'ARICA': (-18.47, -70.30),
        'LA SERENA': (-29.90, -71.25),
        'COQUIMBO': (-29.95, -71.34),
        'TALCA': (-35.43, -71.66),
        'CHILLAN': (-36.60, -72.10),
        'TEMUCO': (-38.74, -72.59),
        'VALDIVIA': (-39.81, -73.24),
        'COYHAIQUE': (-45.57, -72.07),
        'PUNTA ARENAS': (-53.16, -70.91),
    }

    def get(self, request):
        import urllib.request
        import json
        import unicodedata
        from django.core.cache import cache

        centro_trabajo_id = request.query_params.get('centro_trabajo_id')
        comuna_param = request.query_params.get('comuna')
        lat_param = request.query_params.get('lat')
        lon_param = request.query_params.get('lon')

        ciudad = "Santiago"
        faena_nombre = None
        empresa_nombre = None
        lat = None
        lon = None

        if centro_trabajo_id:
            try:
                user = request.user
                is_auth = user and not user.is_anonymous
                if is_auth:
                    usuarios_grupo = get_usuarios_grupo(user)
                    centro = CentroTrabajo.objects.select_related('empresa').filter(
                        id=centro_trabajo_id,
                        empresa__prevencionista__in=usuarios_grupo
                    ).first()
                    if centro:
                        faena_nombre = centro.nombre
                        empresa_nombre = centro.empresa.razon_social if centro.empresa else None
                        ciudad = centro.comuna or centro.region or centro.nombre
                else:
                    # Protección Ley 21.719 (M-1): Peticiones anónimas solo obtienen comuna/clima sin filtrar razón social ni faena por ID
                    centro = CentroTrabajo.objects.filter(id=centro_trabajo_id).first()
                    if centro:
                        ciudad = centro.comuna or centro.region or "Santiago"
            except (ValueError, TypeError):
                pass

        if not comuna_param and ciudad and ciudad != "Santiago":
            comuna_param = ciudad
        elif comuna_param:
            ciudad = comuna_param

        # Determinar coordenadas
        if lat_param and lon_param:
            try:
                lat = float(lat_param)
                lon = float(lon_param)
            except (ValueError, TypeError):
                lat, lon = None, None

        if lat is None or lon is None:
            if comuna_param:
                norm = unicodedata.normalize('NFKD', str(comuna_param))
                norm_str = "".join(c for c in norm if not unicodedata.combining(c)).upper().strip()
                for key, coords in self.COORDENADAS_CHILE.items():
                    if key in norm_str or norm_str in key:
                        lat, lon = coords
                        ciudad = key.title()
                        break

        if lat is None or lon is None:
            lat, lon = self.COORDENADAS_CHILE['SANTIAGO']
            if not ciudad:
                ciudad = "Santiago"

        cache_key = f"clima_uv_{lat:.2f}_{lon:.2f}"
        cached_result = cache.get(cache_key)
        if cached_result and isinstance(cached_result, dict):
            resp = dict(cached_result)
            if faena_nombre:
                resp["faena_nombre"] = faena_nombre
            if empresa_nombre:
                resp["empresa_nombre"] = empresa_nombre
            if ciudad:
                resp["ciudad"] = ciudad
            return Response(resp, status=status.HTTP_200_OK)

        api_url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,uv_index,is_day"
            f"&daily=uv_index_max,temperature_2m_max&timezone=America%2FSantiago"
        )

        uv_actual = 2.0
        uv_max_dia = 5.0
        temperatura = 22.0
        sensacion_termica = 22.0
        humedad = 50
        fecha_str = timezone.localdate().isoformat()
        hora_str = timezone.localtime().strftime("%H:%M")

        try:
            req = urllib.request.Request(api_url, headers={'User-Agent': 'HDPrevencion-SST-Clima/1.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                payload = json.loads(response.read().decode('utf-8'))
                current = payload.get('current', {})
                daily = payload.get('daily', {})

                if 'uv_index' in current and current.get('uv_index') is not None:
                    uv_actual = float(current.get('uv_index'))
                if 'temperature_2m' in current and current.get('temperature_2m') is not None:
                    temperatura = float(current.get('temperature_2m'))
                if 'apparent_temperature' in current and current.get('apparent_temperature') is not None:
                    sensacion_termica = float(current.get('apparent_temperature'))
                if 'relative_humidity_2m' in current and current.get('relative_humidity_2m') is not None:
                    humedad = round(float(current.get('relative_humidity_2m')))

                if daily.get('uv_index_max') and len(daily['uv_index_max']) > 0 and daily['uv_index_max'][0] is not None:
                    uv_max_dia = float(daily['uv_index_max'][0])
                else:
                    uv_max_dia = uv_actual

                if daily.get('time') and len(daily['time']) > 0:
                    fecha_str = str(daily['time'][0])
                if current.get('time'):
                    hora_str = current['time'].split('T')[-1][:5]
        except Exception:
            pass

        eval_uv = max(uv_actual, uv_max_dia)
        if eval_uv < 3.0:
            nivel_uv = "BAJO"
            nivel_uv_display = "Bajo"
            color_hex = "#22c55e"
            medidas_legales_ds594 = [
                "Uso de lentes con filtro UV. Exposición segura."
            ]
        elif eval_uv < 6.0:
            nivel_uv = "MODERADO"
            nivel_uv_display = "Moderado"
            color_hex = "#eab308"
            medidas_legales_ds594 = [
                "Protector solar FPS 30+, gafas UV 400 y gorro con visera."
            ]
        elif eval_uv < 8.0:
            nivel_uv = "ALTO"
            nivel_uv_display = "Alto"
            color_hex = "#f97316"
            medidas_legales_ds594 = [
                "Reaplicación obligatoria de protector solar FPS 50+ cada 2 horas, ropa manga larga y gorro legionario con cubrenuca."
            ]
        elif eval_uv < 11.0:
            nivel_uv = "MUY_ALTO"
            nivel_uv_display = "Muy Alto"
            color_hex = "#ef4444"
            medidas_legales_ds594 = [
                "Pausas activas bajo sombra, puntos de hidratación obligatorios cada 45 min y evitar exposición prolongada entre 11:00 y 16:00 hrs."
            ]
        else:
            nivel_uv = "EXTREMO"
            nivel_uv_display = "Extremo"
            color_hex = "#a855f7"
            medidas_legales_ds594 = [
                "Alerta Crítica D.S. 594. Prohibición de faenas pesadas al sol en horario punta. Monitoreo constante de fatiga y golpes de calor."
            ]

        estres_termico_alerta = sensacion_termica >= 32.0
        if estres_termico_alerta:
            medidas_legales_ds594.insert(
                0,
                "Alerta de Estrés Térmico (Enmienda Oficial ISO 2024): Hidratación obligatoria de 1 vaso de agua fresca cada 15-20 minutos, habilitación de zonas de descanso climatizadas o con ventilación forzada."
            )

        resultado = {
            "ciudad": ciudad,
            "faena_nombre": faena_nombre,
            "empresa_nombre": empresa_nombre,
            "fecha": fecha_str,
            "hora_consulta": hora_str,
            "uv_actual": round(uv_actual, 1),
            "uv_max_dia": round(uv_max_dia, 1),
            "nivel_uv": nivel_uv,
            "nivel_uv_display": nivel_uv_display,
            "color_hex": color_hex,
            "temperatura": round(temperatura, 1),
            "sensacion_termica": round(sensacion_termica, 1),
            "humedad": humedad,
            "estres_termico_alerta": estres_termico_alerta,
            "medidas_legales_ds594": medidas_legales_ds594,
            "hora_inicio_peligro": "11:00",
            "hora_fin_peligro": "16:00"
        }

        cache.set(cache_key, resultado, timeout=1800)
        return Response(resultado, status=status.HTTP_200_OK)


class SolicitudDerechoARCOCreateView(generics.CreateAPIView):
    """
    Endpoint público para que cualquier titular de datos ejerza sus derechos ARCO-POL
    (Acceso, Rectificación, Supresión, Oposición, Portabilidad, Bloqueo).
    Arts. 4 al 11 Ley N° 21.719.
    """
    serializer_class = SolicitudDerechoARCOSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = 'public_qr'

    def perform_create(self, serializer):
        tipo = serializer.validated_data.get('tipo_derecho')
        # Si solicita bloqueo temporal, activamos flag inmediatamente (plazo 2 días hábiles Art. 11)
        bloqueo = (tipo == SolicitudDerechoARCO.TIPO_BLOQUEO)
        serializer.save(bloqueo_provisional_activo=bloqueo)


class SolicitudDerechoARCOConsultaView(generics.RetrieveAPIView):
    """
    Permite consultar el estado de tramitación y plazos de una solicitud ARCO por UUID
    sin exponer datos identificatorios sensibles en el endpoint público.
    """
    queryset = SolicitudDerechoARCO.objects.all()
    serializer_class = SolicitudDerechoARCOStatusSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = 'public_qr'
    lookup_field = 'uuid'


class PortabilidadDatosView(APIView):
    """
    Endpoint autenticado y aislado por tenant para el Derecho a la Portabilidad (Art. 9 Ley N° 21.719).
    - Sin `?rut=`: exporta todos los datos personales propios de la cuenta autenticada (Responsable).
    - Con `?rut=`: exporta los registros del trabajador pertenecientes únicamente al grupo/tenant
      del usuario autenticado (Encargado Art. 15 bis), impidiendo acceso anónimo o cross-tenant.
    """
    permission_classes = [permissions.IsAuthenticated]

    def _exportar_cuenta_propia(self, user: Any) -> dict[str, Any]:
        suscripciones = list(
            Suscripcion.objects.filter(usuario=user).select_related('plan').values(
                'plan__nombre', 'plan__codigo', 'estado', 'fecha_inicio', 'fecha_vencimiento'
            )
        )
        documentos = [
            {
                "plantilla": d.plantilla_maestra.titulo if d.plantilla_maestra else None,
                "fecha_ultimo_guardado": d.fecha_ultimo_guardado.isoformat() if d.fecha_ultimo_guardado else None,
                "datos_guardados": d.datos_guardados,
            }
            for d in DocumentoUsuario.objects.filter(usuario=user).select_related('plantilla_maestra')
        ]
        email = (user.email or '').strip()
        contactos = (
            list(MensajeContacto.objects.filter(email__iexact=email).values('asunto', 'mensaje', 'fecha_creacion'))
            if email else []
        )
        solicitudes_cap = (
            list(SolicitudCapacitacion.objects.filter(contacto_email__iexact=email).values(
                'empresa', 'rut_empresa', 'contacto_cargo', 'contacto_telefono', 'fecha_creacion'
            ))
            if email else []
        )
        solicitudes_arco = (
            list(SolicitudDerechoARCO.objects.filter(email_titular__iexact=email).values(
                'uuid', 'tipo_derecho', 'estado', 'fecha_solicitud', 'fecha_limite_30d'
            ))
            if email else []
        )
        return {
            "perfil": {
                "uuid": str(user.uuid),
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "tipo_usuario": user.tipo_usuario,
                "date_joined": user.date_joined.isoformat() if user.date_joined else None,
            },
            "suscripciones": [
                {
                    **s,
                    "fecha_inicio": s["fecha_inicio"].isoformat() if s["fecha_inicio"] else None,
                    "fecha_vencimiento": s["fecha_vencimiento"].isoformat() if s["fecha_vencimiento"] else None,
                }
                for s in suscripciones
            ],
            "documentos_guardados": documentos,
            "consultas_contacto": [
                {**c, "fecha_creacion": c["fecha_creacion"].isoformat() if c["fecha_creacion"] else None}
                for c in contactos
            ],
            "solicitudes_capacitacion": [
                {**sc, "fecha_creacion": sc["fecha_creacion"].isoformat() if sc["fecha_creacion"] else None}
                for sc in solicitudes_cap
            ],
            "solicitudes_arco": [
                {
                    **sa,
                    "uuid": str(sa["uuid"]),
                    "fecha_solicitud": sa["fecha_solicitud"].isoformat() if sa["fecha_solicitud"] else None,
                    "fecha_limite_30d": sa["fecha_limite_30d"].isoformat() if sa["fecha_limite_30d"] else None,
                }
                for sa in solicitudes_arco
            ],
        }

    def _exportar_trabajador_tenant(self, usuarios_grupo: list[Any], rut: str) -> dict[str, Any]:
        rut_norm = rut.strip()
        rut_lower = rut_norm.lower()

        trabajadores = Trabajador.objects.filter(
            empresa__prevencionista__in=usuarios_grupo, rut__iexact=rut_norm
        ).select_related('empresa', 'centro_trabajo')
        datos_trabajador = [
            {
                "empresa": t.empresa.razon_social,
                "centro_trabajo": t.centro_trabajo.nombre if t.centro_trabajo else None,
                "nombres": t.nombres,
                "apellidos": t.apellidos,
                "rut": t.rut,
                "cargo": t.cargo,
                "correo": t.correo,
                "telefono": t.telefono,
                "fecha_ingreso": t.fecha_ingreso.isoformat() if t.fecha_ingreso else None,
                "estado": t.estado,
            }
            for t in trabajadores
        ]

        entregas = EntregaEPP.objects.filter(
            Q(empresa__prevencionista__in=usuarios_grupo) | Q(trabajador__empresa__prevencionista__in=usuarios_grupo),
            trabajador__rut__iexact=rut_norm
        ).select_related('empresa', 'trabajador__empresa')
        datos_epp = [
            {
                "empresa": e.empresa.razon_social if e.empresa else None,
                "fecha_hora_entrega": e.fecha_hora_entrega.isoformat() if e.fecha_hora_entrega else None,
                "items_epp": e.items_epp,
                "entrega_riohs": e.entrega_riohs,
            }
            for e in entregas
        ]

        accidentes_qs = InvestigacionAccidente.objects.filter(
            empresa__prevencionista__in=usuarios_grupo
        ).select_related('empresa', 'trabajador')
        accidentes = [
            a for a in accidentes_qs
            if (a.rut_afectado or '').strip().lower() == rut_lower
            or (a.trabajador and (a.trabajador.rut or '').strip().lower() == rut_lower)
        ]
        datos_accidentes = [
            {
                "empresa": a.empresa.razon_social if a.empresa else None,
                "fecha_hora_evento": a.fecha_hora_evento.isoformat() if a.fecha_hora_evento else None,
                "tipo_evento": a.tipo_evento,
                "lugar_evento": a.lugar_evento,
                "descripcion_evento": a.descripcion_evento,
                "tipo_lesion": a.tipo_lesion,
                "parte_cuerpo_afectada": a.parte_cuerpo_afectada,
                "dias_perdidos": a.dias_perdidos,
                "alta_medica": a.alta_medica,
                "diat_presentada": a.diat_presentada,
                "diat_folio": a.diat_folio,
            }
            for a in accidentes
        ]

        capacitaciones_qs = RegistroCapacitacion.objects.filter(
            empresa__prevencionista__in=usuarios_grupo
        ).select_related('empresa', 'tema')
        datos_capacitaciones = []
        for cap in capacitaciones_qs:
            if not isinstance(cap.asistentes, list):
                continue
            for item in cap.asistentes:
                if isinstance(item, dict) and str(item.get('rut', '')).strip().lower() == rut_lower:
                    datos_capacitaciones.append({
                        "empresa": cap.empresa.razon_social if cap.empresa else None,
                        "tema": cap.tema.titulo if cap.tema else None,
                        "estado": cap.estado,
                        "fecha_realizacion": cap.fecha_realizacion.isoformat() if cap.fecha_realizacion else None,
                        "nombre": item.get('nombre'),
                        "rut": item.get('rut'),
                        "cargo": item.get('cargo'),
                    })

        cphs_qs = MiembroCPHS.objects.filter(
            comite__empresa__prevencionista__in=usuarios_grupo, rut__iexact=rut_norm
        ).select_related('comite__empresa')
        datos_cphs = [
            {
                "empresa": m.comite.empresa.razon_social,
                "cargo": m.cargo,
                "estamento": m.estamento,
                "tipo_representacion": m.tipo_representacion,
                "activo": m.activo,
                "fecha_designacion": m.fecha_designacion.isoformat() if m.fecha_designacion else None,
            }
            for m in cphs_qs
        ]

        sub_qs = TrabajadorSubcontratado.objects.filter(
            contratista__usuario__in=usuarios_grupo, rut__iexact=rut_norm
        ).select_related('contratista')
        datos_subcontratacion = [
            {
                "contratista": s.contratista.razon_social,
                "nombre_completo": s.nombre_completo,
                "rut": s.rut,
                "cargo": s.cargo,
                "fecha_ingreso_obra": s.fecha_ingreso_obra.isoformat() if s.fecha_ingreso_obra else None,
                "fecha_egreso_obra": s.fecha_egreso_obra.isoformat() if s.fecha_egreso_obra else None,
                "activo": s.activo,
            }
            for s in sub_qs
        ]

        return {
            "rut_titular": rut_norm,
            "fichas_laborales": datos_trabajador,
            "registros_epp": datos_epp,
            "investigaciones_accidentes": datos_accidentes,
            "capacitaciones": datos_capacitaciones,
            "comites_paritarios": datos_cphs,
            "subcontratacion": datos_subcontratacion,
            "nota_reserva_legal": (
                "Eventuales denuncias bajo Ley N° 21.643 (Ley Karin) están sujetas a reserva legal "
                "(Art. 211-B Código del Trabajo) y requieren verificación directa con el Responsable."
            ),
        }

    def get(self, request):
        rut = (request.query_params.get('rut') or '').strip()
        payload: dict[str, Any] = {
            "estandar_interoperabilidad": "Ley N° 21.719 Art. 9 (Portabilidad)",
            "fecha_exportacion": timezone.now().isoformat(),
        }
        if rut:
            usuarios_grupo = get_usuarios_grupo(request.user)
            payload["ambito"] = "trabajador_tenant"
            payload.update(self._exportar_trabajador_tenant(usuarios_grupo, rut))
        else:
            payload["ambito"] = "cuenta_usuario"
            payload.update(self._exportar_cuenta_propia(request.user))

        registrar_evento_seguridad(
            request,
            categoria=AuditLogEventoSeguridad.CATEGORIA_ARCO,
            accion='EXPORT_PORTABILIDAD',
            usuario=request.user,
            modelo_afectado='PortabilidadDatos',
            recurso_id=request.user.pk,
            exito=True,
            metadata={'ambito': payload['ambito'], 'consulta_trabajador': bool(rut)},
        )

        return Response(payload, status=status.HTTP_200_OK)







