import uuid
from typing import Any
from django.db import transaction
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
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from .models import (
    PlantillaMaestra, DocumentoUsuario, Noticia, MensajeContacto, Servicio, Plan, Suscripcion, ContadorDescargas,
    ReporteRiesgo, PlantillaInspeccion, Inspeccion, InvestigacionAccidente,
    TemaCapacitacion, RegistroCapacitacion, SugerenciaConsulta,
    Contratista, DocumentoContratista, TrabajadorSubcontratado,
    SolicitudCapacitacion
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
    SolicitudCapacitacionSerializer
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
    Vista de Login personalizada que retorna los tokens JWT con la información extendida del usuario.
    """
    serializer_class = CustomTokenObtainPairSerializer


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
        return InvestigacionAccidente.objects.filter(usuario__in=usuarios_grupo)

    def perform_create(self, serializer):
        user: Any = self.request.user
        serializer.save(usuario=user)


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


class SugerenciaConsultaPublicaCreateView(generics.CreateAPIView):
    """
    Endpoint público (sin autenticación) para que los trabajadores envíen
    sugerencias o consultas al prevencionista de su empresa via código QR.
    El campo `usuario` es el prevencionista receptor identificado por su `uuid` seguro en la URL.
    Protegido contra fuerza bruta con AnonRateThrottle y ScopedRateThrottle (30 req/min).
    """
    serializer_class = SugerenciaConsultaSerializer
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
        sugerencia = serializer.save(usuario=prevencionista)
        return Response(
            {
                "mensaje": "Mensaje recibido. El prevencionista de tu empresa lo revisará a la brevedad.",
                "uuid": str(sugerencia.uuid)
            },
            status=status.HTTP_201_CREATED
        )


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


