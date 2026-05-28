from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.http import HttpResponse
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from django.db import transaction
from django.utils import timezone
from .models import PlantillaMaestra, DocumentoUsuario, Noticia, MensajeContacto, Servicio, Plan, Suscripcion, ContadorDescargas
from .serializers import (
    RegisterSerializer, UsuarioSerializer, PlanSerializer,
    PlantillaMaestraSerializer, DocumentoUsuarioSerializer,
    NoticiaSerializer, MensajeContactoSerializer, ServicioSerializer
)

Usuario = get_user_model()

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
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and (request.user.is_staff or request.user.is_superuser)


class ContactoPermission(permissions.BasePermission):
    """
    Cualquier usuario autenticado puede enviar mensajes (POST),
    pero solo los administradores pueden leer el listado.
    """
    def has_permission(self, request, view):
        if request.method == 'POST':
            return request.user and request.user.is_authenticated
        return request.user and (request.user.is_staff or request.user.is_superuser)


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
                sheet = wb.active
                rows_data = []
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
    serializer_class = DocumentoUsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return DocumentoUsuario.objects.all()
        return DocumentoUsuario.objects.filter(usuario=user)

    def perform_create(self, serializer):
        usuario = self.request.user
        
        # Rotación automática: Si el usuario ya tiene 5 o más copias, eliminamos la más antigua
        documentos_existentes = DocumentoUsuario.objects.filter(usuario=usuario)
        count = documentos_existentes.count()
        if count >= 5:
            # Obtener los más antiguos (ordenados de menor a mayor por fecha de último guardado)
            # Borrar suficientes para quedar en 4 copias antes de guardar la nueva
            docs_a_borrar = list(documentos_existentes.order_by('fecha_ultimo_guardado')[:(count - 4)])
            for doc in docs_a_borrar:
                doc.delete()

        owner = usuario.cuenta_padre if usuario.cuenta_padre else usuario
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        if sub and not sub.plan.edicion_nube:
            raise ValidationError("Tu plan actual no permite la edición o creación de documentos en la nube. Por favor actualiza tu plan.")
        serializer.save(usuario=usuario)

    def perform_update(self, serializer):
        usuario = self.request.user
        owner = usuario.cuenta_padre if usuario.cuenta_padre else usuario
        sub = owner.suscripciones.filter(estado=Suscripcion.ESTADO_ACTIVA).first()
        if sub and not sub.plan.edicion_nube:
            raise ValidationError("Tu plan actual no permite la edición o creación de documentos en la nube. Por favor actualiza tu plan.")
        serializer.save()

    def validar_y_registrar_descarga(self, usuario):
        if usuario.is_superuser or usuario.is_staff:
            return None
            
        owner = usuario.cuenta_padre if usuario.cuenta_padre else usuario
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
        ws = wb.active
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
        response["Content-Disposition"] = f"attachment; filename=Matriz_IPER_{documento.id}.xlsx"
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


class ServicioViewSet(viewsets.ModelViewSet):
    queryset = Servicio.objects.all()
    serializer_class = ServicioSerializer
    permission_classes = [IsAdminOrReadOnly]


class UsuarioViewSet(viewsets.ModelViewSet):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Usuario.objects.filter(id=self.request.user.id)

    def get_object(self):
        return self.request.user

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='perfil')
    def perfil(self, request):
        usuario = self.request.user
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
        usuario = self.request.user
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


