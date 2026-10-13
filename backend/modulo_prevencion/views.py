import uuid
from typing import Any
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.shortcuts import get_object_or_404
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
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
    ComiteParitario, MiembroCPHS, ActaSesionCPHS
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
    SugerenciaLaboralSerializer, DenunciaLeyKarinSerializer,
    AuditLogAccesoDenunciaSerializer, DenunciaLeyKarinPublicaCreateSerializer,
    ComiteParitarioSerializer, MiembroCPHSSerializer, ActaSesionCPHSSerializer
)

Usuario: Any = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializador personalizado de SimpleJWT para inyectar claims adicionales
    (como el correo, tipo de cuenta y relación corporativa) dentro del payload del token.
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
        
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vista de Login personalizada:
    - Retorna 'access' y 'refresh' en JSON (para compatibilidad de clientes).
    - Inyecta el 'refresh_token' en una cookie HttpOnly:
      httponly=True, secure=True, samesite='None', path='/', max_age=7 días.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK and 'refresh' in response.data:
            refresh_token = response.data['refresh']
            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                secure=True,
                samesite='None',
                path='/'
            )
        return response


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
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

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
        user = serializer.save()
        
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
    Cualquier usuario autenticado puede enviar mensajes (POST),
    pero solo los administradores pueden leer el listado.
    """
    def has_permission(self, request, view):
        user: Any = request.user
        if request.method == 'POST':
            return user and user.is_authenticated
        return user and (user.is_staff or user.is_superuser)


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

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(usuario=self.request.user)
        else:
            serializer.save()


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
        if 'foto_perfil' in data and (data['foto_perfil'] == '' or data['foto_perfil'] == 'null' or data['foto_perfil'] is None):
            data.pop('foto_perfil')

        serializer = self.get_serializer(usuario, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        password = request.data.get('password')
        if password:
            usuario.set_password(password)
            usuario.save()
            
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
        user: Any = self.request.user
        serializer.save(usuario=user)

    def perform_update(self, serializer):
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
        user: Any = self.request.user
        serializer.save(usuario=user)

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

        accidente.save()
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
                num_trabajadores = Trabajador.objects.filter(empresa_id=empresa_id, activo=True).count()
            else:
                num_trabajadores = Trabajador.objects.filter(empresa__prevencionista__in=usuarios_grupo, activo=True).count()

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
        return TemaCapacitacion.objects.filter(usuario__in=usuarios_grupo)

    def perform_create(self, serializer):
        user: Any = self.request.user
        serializer.save(usuario=user)


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
            return RegistroCapacitacion.objects.all()
        owner: Any = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())
        return RegistroCapacitacion.objects.filter(usuario__in=usuarios_grupo)

    def perform_create(self, serializer):
        user: Any = self.request.user
        serializer.save(usuario=user)

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
            "relator": capacitacion.usuario.username,
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

        # Evitar duplicidad de RUT en la misma charla
        if any(a.get('rut') == rut for a in capacitacion.asistentes):
            return Response({"error": "Este RUT ya se encuentra registrado en esta capacitación."}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(capacitacion.asistentes, list):
            capacitacion.asistentes = []

        capacitacion.asistentes.append({
            "nombre": nombre,
            "rut": rut,
            "firma": firma
        })
        capacitacion.save()

        return Response({"message": "Asistencia y firma registradas correctamente."}, status=status.HTTP_200_OK)



class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        owner = user.cuenta_padre if user.cuenta_padre else user
        usuarios_grupo = [owner] + list(owner.cuentas_hijas.all())

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
            }
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
        return SugerenciaConsulta.objects.filter(usuario=self.request.user)

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
    """Obtiene la dirección IP real del cliente considerando proxies inversos."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip or '127.0.0.1'


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

        # Resolver empresa del prevencionista
        empresa_id = data.get('empresa')
        empresa = None
        if empresa_id:
            empresa = Empresa.objects.filter(id=empresa_id, prevencionista=prevencionista).first()
        if not empresa:
            empresa = Empresa.objects.filter(prevencionista=prevencionista, activo=True).first()

        # Flujo B: Denuncia Formal Ley Karin
        if tipo_canal == 'DENUNCIA_KARIN' or 'rut_denunciante' in data:
            if not empresa:
                return Response(
                    {"error": "El prevencionista aún no tiene empresas vinculadas para recibir denuncias formales."},
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
                    "tipo": "DENUNCIA_KARIN"
                },
                status=status.HTTP_201_CREATED
            )

        # Flujo A: Sugerencia Laboral Abierta
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
                es_anonimo=data.get('es_anonimo', data.get('anonimo', True)),
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

    def get(self, request, prevencionista_uuid):
        try:
            prevencionista = Usuario.objects.get(uuid=prevencionista_uuid)
        except (Usuario.DoesNotExist, ValueError):
            return Response({"error": "Prevencionista no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        empresas = Empresa.objects.filter(prevencionista=prevencionista, activo=True)
        res = []
        for emp in empresas:
            centros = list(emp.centros_trabajo.values('id', 'nombre', 'direccion'))
            res.append({
                'id': emp.id,
                'razon_social': emp.razon_social,
                'nombre_fantasia': emp.nombre_fantasia or emp.razon_social,
                'rut': emp.rut,
                'centros_trabajo': centros
            })
        return Response(res, status=status.HTTP_200_OK)


class ContratistaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar contratistas y proveedores.
    """
    queryset = Contratista.objects.all()
    serializer_class: Any = ContratistaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Contratista.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

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

        # Estadísticas de documentos
        from datetime import date
        hoy = date.today()
        docs = DocumentoContratista.objects.filter(contratista__usuario=request.user)
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
            contratista__usuario=request.user,
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
        queryset = DocumentoContratista.objects.filter(contratista__usuario=req.user)
        contratista_id = req.query_params.get('contratista')
        if contratista_id:
            queryset = queryset.filter(contratista_id=contratista_id)
        return queryset

    def perform_create(self, serializer):
        contratista = serializer.validated_data.get('contratista')
        if contratista.usuario != self.request.user:
            raise ValidationError({"contratista": "No tienes permisos sobre este contratista."})
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
        queryset = TrabajadorSubcontratado.objects.filter(contratista__usuario=req.user)
        contratista_id = req.query_params.get('contratista')
        if contratista_id:
            queryset = queryset.filter(contratista_id=contratista_id)
        return queryset

    def perform_create(self, serializer):
        contratista = serializer.validated_data.get('contratista')
        if contratista.usuario != self.request.user:
            raise ValidationError({"contratista": "No tienes permisos sobre este contratista."})
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
            serializer.save(usuario=self.request.user)
        else:
            serializer.save()


def get_usuarios_grupo(user: Any) -> list[Any]:
    """Retorna la lista de usuarios del mismo grupo corporativo (cuenta padre y cuentas hijas)."""
    if not user or getattr(user, 'is_anonymous', True):
        return []
    owner: Any = getattr(user, 'cuenta_padre', None) or user
    cuentas_hijas: Any = getattr(owner, 'cuentas_hijas', None)
    if cuentas_hijas is not None and hasattr(cuentas_hijas, 'all'):
        return [owner] + list(cuentas_hijas.all())
    return [owner]


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
        empresa = serializer.validated_data.get('empresa')
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        if empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"empresa": "No tienes permiso para asociar centros de trabajo a esta empresa."})
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
        empresa = serializer.validated_data.get('empresa')
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        if empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"empresa": "No tienes permiso para registrar trabajadores en esta empresa."})
            
        centro_trabajo = serializer.validated_data.get('centro_trabajo')
        if centro_trabajo and centro_trabajo.empresa != empresa:
            raise ValidationError({"centro_trabajo": "El centro de trabajo no pertenece a la empresa seleccionada."})
            
        serializer.save()


class DenunciaLeyKarinViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión confidencial y trazada de denuncias bajo Ley Karin (Ley N° 21.643).
    Aislamiento Multi-Tenant: solo accesible por el prevencionista a cargo de la empresa.
    Auditoría: cada retrieve (apertura de expediente) genera un registro inmutable en AuditLogAccesoDenuncia.
    """
    queryset = DenunciaLeyKarin.objects.all()
    serializer_class = DenunciaLeyKarinSerializer
    permission_classes = [permissions.IsAuthenticated]

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
        empresa = serializer.validated_data.get('empresa')
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        if empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"empresa": "No tienes permiso para registrar denuncias en esta empresa."})
        serializer.save()

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
        empresa = serializer.validated_data.get('empresa')
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        if empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"empresa": "No tienes permiso para registrar sugerencias en esta empresa."})
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
        empresa = serializer.validated_data.get('empresa')
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        if empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"empresa": "No tienes permiso para constituir comités en esta empresa."})

        centro_trabajo = serializer.validated_data.get('centro_trabajo')
        if centro_trabajo and centro_trabajo.empresa != empresa:
            raise ValidationError({"centro_trabajo": "El centro de trabajo no pertenece a la empresa seleccionada."})

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
        comite = serializer.validated_data.get('comite')
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        if comite.empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"comite": "No tienes permiso para agregar miembros a este comité."})

        trabajador = serializer.validated_data.get('trabajador')
        if trabajador and trabajador.empresa != comite.empresa:
            raise ValidationError({"trabajador": "El trabajador no pertenece a la empresa de este comité."})

        # Si se asigna cargo Presidente o Secretario, actualizar al anterior a VOCAL si existiese
        cargo = serializer.validated_data.get('cargo')
        if cargo in [MiembroCPHS.CARGO_PRESIDENTE, MiembroCPHS.CARGO_SECRETARIO]:
            MiembroCPHS.objects.filter(comite=comite, cargo=cargo).update(cargo=MiembroCPHS.CARGO_VOCAL)

        serializer.save()

    def perform_update(self, serializer):
        cargo = serializer.validated_data.get('cargo')
        instance = self.get_object()
        if cargo in [MiembroCPHS.CARGO_PRESIDENTE, MiembroCPHS.CARGO_SECRETARIO]:
            MiembroCPHS.objects.filter(comite=instance.comite, cargo=cargo).exclude(id=instance.id).update(cargo=MiembroCPHS.CARGO_VOCAL)
        serializer.save()


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
        comite = serializer.validated_data.get('comite')
        usuarios_grupo = get_usuarios_grupo(self.request.user)
        if comite.empresa.prevencionista not in usuarios_grupo:
            raise ValidationError({"comite": "No tienes permiso para registrar actas en este comité."})

        # Asignar número correlativo automático si no viene asignado
        numero = serializer.validated_data.get('numero_acta')
        if not numero:
            ultimo = ActaSesionCPHS.objects.filter(comite=comite).order_by('-numero_acta').first()
            siguiente = (ultimo.numero_acta + 1) if ultimo else 1
            serializer.save(numero_acta=siguiente)
        else:
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





