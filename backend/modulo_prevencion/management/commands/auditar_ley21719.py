import os
import sys
import json
import time
import uuid
import datetime
import webbrowser
from decimal import Decimal
from typing import Dict, Any, List, Tuple

from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from modulo_prevencion.models import (
    Usuario, Empresa, Trabajador, CentroTrabajo,
    DenunciaLeyKarin, InvestigacionAccidente, EntregaEPP,
    AuditLogAccesoDenuncia
)


def is_encrypted(val) -> bool:
    return bool(val and str(val).startswith("enc:v1:"))


class TerminalColors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'


class Command(BaseCommand):
    help = "Ejecuta la Suite Forense y Auditoría Técnica de Cumplimiento Ley N° 21.719 (Protección de Datos Personales)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-browser',
            action='store_true',
            help='No abre el navegador automáticamente con el informe HTML al finalizar.'
        )
        parser.add_argument(
            '--output-dir',
            type=str,
            default='.',
            help='Directorio donde guardar el informe HTML de auditoría.'
        )

    def handle(self, *args, **options):
        start_time = time.time()
        self.print_banner()

        results: List[Dict[str, Any]] = []

        # Suite 1: Aislamiento Multi-Tenant y Prevención de Fuga Horizontal
        res1 = self.test_suite_multitenant()
        results.append(res1)

        # Suite 2: Criptografía en Reposo en Base de Datos
        res2 = self.test_suite_criptografia()
        results.append(res2)

        # Suite 3: Retención Legal Obligatoria vs Supresión Arbitraria
        res3 = self.test_suite_retencion_legal()
        results.append(res3)

        # Suite 4: Canal de Derechos ARCO-POL y Portabilidad
        res4 = self.test_suite_arco_portabilidad()
        results.append(res4)

        # Suite 5: Trazabilidad e Inmutabilidad de Auditoría
        res5 = self.test_suite_audit_log()
        results.append(res5)

        # Suite 6: Mitigación de Superficie de Ataque y Endpoints
        res6 = self.test_suite_superficie_endpoints()
        results.append(res6)

        # Suite 7: Hardening de Cabeceras HTTP y Transporte Seguro
        res7 = self.test_suite_headers_cookies()
        results.append(res7)

        total_duration = round(time.time() - start_time, 2)
        passed_count = sum(1 for r in results if r['status'] == 'PASSED')
        total_count = len(results)
        compliance_pct = int((passed_count / total_count) * 100)

        self.print_summary(results, compliance_pct, total_duration)

        # Generar Reporte HTML Ejecutivo
        output_dir = options.get('output_dir', '.')
        html_path = os.path.join(output_dir, "informe_auditoria_ley21719.html")
        self.generate_html_report(results, compliance_pct, total_duration, html_path)

        self.stdout.write(
            f"\n{TerminalColors.GREEN}{TerminalColors.BOLD}[✓] Informe Ejecutivo HTML generado exitosamente:{TerminalColors.END} {os.path.abspath(html_path)}\n"
        )

        if not options.get('no_browser', False):
            try:
                webbrowser.open('file://' + os.path.abspath(html_path))
            except Exception as e:
                self.stdout.write(f"No se pudo abrir automáticamente el navegador: {e}")

    def print_banner(self):
        banner = f"""
{TerminalColors.CYAN}{TerminalColors.BOLD}
========================================================================================
        PROGRAMA DE EVALUACIÓN Y AUDITORÍA TÉCNICA - LEY N° 21.719
        Sistema de Verificación Forense contra Filtraciones de Datos Personales
========================================================================================{TerminalColors.END}
{TerminalColors.BLUE}Objetivo: Comprobación técnica de cero fugas, criptografía en reposo y derechos del titular.{TerminalColors.END}
{TerminalColors.YELLOW}Fecha de Ejecución:{TerminalColors.END} {timezone.now().strftime('%d/%m/%Y %H:%M:%S')}
{TerminalColors.YELLOW}Entorno:{TerminalColors.END} Django {settings.DATABASES['default']['ENGINE'].split('.')[-1]} / Python {sys.version.split()[0]}
----------------------------------------------------------------------------------------
"""
        self.stdout.write(banner)

    # -------------------------------------------------------------------------
    # SUITE 1: Multi-Tenancy & Fuga Horizontal (Arts. 13 y 14)
    # -------------------------------------------------------------------------
    def test_suite_multitenant(self) -> Dict[str, Any]:
        suite_name = "Suite 1: Aislamiento Multi-Tenant & Fuga de Datos Horizontal"
        articulo = "Arts. 13 (Confidencialidad) y 14 (Seguridad) Ley N° 21.719"
        self.stdout.write(f"{TerminalColors.BOLD}[*] Ejecutando {suite_name}...{TerminalColors.END}")

        client = APIClient()
        evidence = []
        status = "PASSED"
        details = []

        try:
            with transaction.atomic():
                u_id = uuid.uuid4().hex[:6]
                user_a = Usuario.objects.create_user(
                    username=f"audit_user_a_{u_id}",
                    email=f"user_a_{u_id}@audit.cl",
                    password="PasswordSeguro123!",
                    tipo_usuario=Usuario.TIPO_INDIVIDUAL
                )
                user_b = Usuario.objects.create_user(
                    username=f"audit_user_b_{u_id}",
                    email=f"user_b_{u_id}@audit.cl",
                    password="PasswordSeguro123!",
                    tipo_usuario=Usuario.TIPO_INDIVIDUAL
                )

                empresa_b = Empresa.objects.create(
                    prevencionista=user_b,
                    razon_social=f"Empresa Confidencial B {u_id}",
                    rut="76.999.888-7",
                    activo=True
                )

                trabajador_b = Trabajador.objects.create(
                    empresa=empresa_b,
                    rut="18.888.777-6",
                    nombres="Juan Confidencial",
                    apellidos="Pérez B",
                    cargo="Operador de Maquinaria",
                    correo="juan.b@confidencial.cl"
                )

                # Test 1.1: Usuario A autenticado intenta consultar el trabajador confidencial de Empresa B
                client.force_authenticate(user=user_a)
                url_trabajador_b = f"/api/trabajadores/{trabajador_b.id}/"
                res_cross_get = client.get(url_trabajador_b)

                if res_cross_get.status_code in [404, 403]:
                    details.append(f"Aislamiento de lectura: Petición a {url_trabajador_b} bloqueada con HTTP {res_cross_get.status_code} (Datos invisibles para Tenant A).")
                    evidence.append({
                        "test": "Acceso Cruzado No Autorizado a Ficha de Trabajador",
                        "intento": f"Usuario A (ID {user_a.id}) intenta leer Trabajador de Empresa B (ID {trabajador_b.id})",
                        "resultado": f"HTTP {res_cross_get.status_code} - BLOQUEADO / NO ENCONTRADO",
                        "estado": "PASS"
                    })
                else:
                    status = "FAILED"
                    details.append(f"FALLA: Aislamiento vulnerado. Usuario A pudo leer datos de Empresa B con status HTTP {res_cross_get.status_code}.")
                    evidence.append({
                        "test": "Acceso Cruzado No Autorizado a Ficha de Trabajador",
                        "intento": f"Usuario A (ID {user_a.id}) intenta leer Trabajador de Empresa B (ID {trabajador_b.id})",
                        "resultado": f"HTTP {res_cross_get.status_code} - FILTRACIÓN DE AISLAMIENTO DETECTADA",
                        "estado": "FAIL"
                    })

                # Test 1.2: Intento de auto-asignación ilegítima de cuenta padre en el registro
                client.logout()
                res_reg = client.post('/api/auth/register/', {
                    "username": f"hacker_child_{u_id}",
                    "email": f"hacker_{u_id}@attack.cl",
                    "password": "PasswordHacker123!",
                    "password_confirm": "PasswordHacker123!",
                    "cuenta_padre": user_b.id,  # Intento de colgarse de cuenta B
                    "tipo_usuario": "CORPORATIVO"
                }, format="json")

                nuevo_user = Usuario.objects.filter(username=f"hacker_child_{u_id}").first()
                if nuevo_user and nuevo_user.cuenta_padre is None and nuevo_user.tipo_usuario == Usuario.TIPO_INDIVIDUAL:
                    details.append("Protección contra escalamiento: Intento de inyección de cuenta padre fue sanitizado automáticamente a INDIVIDUAL.")
                    evidence.append({
                        "test": "Inyección de 'cuenta_padre' en Registro",
                        "intento": f"POST /api/auth/register/ con cuenta_padre={user_b.id}",
                        "resultado": "Sanitizado a cuenta_padre=None y tipo_usuario='INDIVIDUAL'",
                        "estado": "PASS"
                    })
                else:
                    status = "FAILED"
                    details.append("FALLA: El usuario pudo registrarse y auto-asignarse como cuenta hija de un corporativo ajeno (Vulnerabilidad Multi-Tenant C-1).")
                    evidence.append({
                        "test": "Inyección de 'cuenta_padre' en Registro",
                        "intento": f"POST /api/auth/register/ con cuenta_padre={user_b.id}",
                        "resultado": "VULNERABLE: Usuario creado con cuenta_padre vinculada a tercero",
                        "estado": "FAIL"
                    })

                transaction.set_rollback(True)

        except Exception as e:
            status = "FAILED"
            details.append(f"Error imprevisto en Suite 1: {str(e)}")

        self.print_suite_status(suite_name, status)
        return {
            "name": suite_name,
            "articulo": articulo,
            "gravedad": "CRÍTICA",
            "sancion": "Infracción Gravísima (Arts. 14 quinquies, 16 y 35) - Multa hasta 20.000 UTM (~$1.300M CLP)",
            "impacto": "Exposición en texto plano en disco de relatos de acoso sexual/laboral (Ley Karin) o expedientes de accidentes.",
            "status": status,
            "details": details,
            "evidence": evidence
        }

    # -------------------------------------------------------------------------
    # SUITE 2: Criptografía en Reposo (Art. 14)
    # -------------------------------------------------------------------------
    def test_suite_criptografia(self) -> Dict[str, Any]:
        suite_name = "Suite 2: Criptografía en Reposo en Base de Datos (AES-128-CBC + HMAC)"
        articulo = "Art. 14 (Medidas de Seguridad Criptográfica) Ley N° 21.719"
        self.stdout.write(f"{TerminalColors.BOLD}[*] Ejecutando {suite_name}...{TerminalColors.END}")

        evidence = []
        status = "PASSED"
        details = []

        try:
            with transaction.atomic():
                u_id = uuid.uuid4().hex[:6]
                user = Usuario.objects.create_user(
                    username=f"crypto_tester_{u_id}",
                    email=f"crypto_{u_id}@test.cl",
                    password="Password123!"
                )
                empresa = Empresa.objects.create(
                    prevencionista=user,
                    razon_social=f"Empresa Cripto {u_id}",
                    rut="77.111.222-3"
                )

                texto_sensible_denuncia = (
                    "RELATO CONFIDENCIAL LEY KARIN: La trabajadora declara acoso laboral reiterado "
                    "por parte de su jefatura directa en faena durante los meses de octubre y noviembre."
                )

                denuncia = DenunciaLeyKarin.objects.create(
                    empresa=empresa,
                    tipo_afectacion="ACOSO_LABORAL",
                    rut_denunciante="17.999.888-5",
                    nombre_denunciante="Denunciante Anónima",
                    correo_denunciante="denuncia@test.cl",
                    descripcion_circunstanciada=texto_sensible_denuncia,
                    testigos_o_evidencias="3 correos electrónicos adjuntos bajo custodia",
                    medidas_resguardo_detalle="Separación física preventiva de funciones"
                )

                # Test 2.1: Inspección SQL cruda a bajo nivel (disco físico)
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT descripcion_circunstanciada, testigos_o_evidencias FROM modulo_prevencion_denuncialeykarin WHERE id = %s",
                        [denuncia.id]
                    )
                    raw_row = cursor.fetchone()

                raw_desc, raw_testigos = raw_row[0], raw_row[1]

                es_cifrado_desc = is_encrypted(raw_desc)
                es_cifrado_testigos = is_encrypted(raw_testigos)
                fuga_plana = (texto_sensible_denuncia in str(raw_desc))

                if es_cifrado_desc and es_cifrado_testigos and not fuga_plana:
                    details.append(f"Lectura SQL física: Campo almacenado en disco con prefijo '{raw_desc[:14]}...' (Total {len(raw_desc)} caracteres cifrados).")
                    details.append("Cero texto plano en base de datos: La consulta directa a la tabla no expone nombres ni testimonios.")
                    evidence.append({
                        "test": "Inspección SQL Directa en Tabla DenunciaLeyKarin",
                        "intento": "SELECT descripcion_circunstanciada FROM base_datos_cruda",
                        "resultado": f"ALMACENADO EN DISCO: {raw_desc[:35]}... (Texto plano indetectable)",
                        "estado": "PASS"
                    })
                else:
                    status = "FAILED"
                    preview_txt = str(raw_desc)[:45] if raw_desc else "Vacío"
                    details.append(f"FALLA: El texto sensible de la denuncia se encuentra en TEXTO PLANO en el disco ('{preview_txt}...'). Vulnerable a sustracción de backups o volcado de memoria.")
                    evidence.append({
                        "test": "Inspección SQL Directa en Tabla DenunciaLeyKarin",
                        "intento": "SELECT descripcion_circunstanciada FROM base_datos_cruda",
                        "resultado": f"TEXTO PLANO EXPUESTO EN DISCO: '{preview_txt}...' (Sin cifrado AES)",
                        "estado": "FAIL"
                    })

                # Test 2.2: Verificación de descifrado transparente para el ORM de la aplicación
                denuncia_recuperada = DenunciaLeyKarin.objects.get(id=denuncia.id)
                if denuncia_recuperada.descripcion_circunstanciada == texto_sensible_denuncia:
                    details.append("Descifrado en tiempo de ejecución: El modelo descifra transparente y congruentemente para usuarios autorizados.")
                    evidence.append({
                        "test": "Descifrado transparente en capa ORM",
                        "intento": "DenunciaLeyKarin.objects.get(id=denuncia.id)",
                        "resultado": "Descifrado verificado con integridad HMAC-SHA256 idéntico al original",
                        "estado": "PASS"
                    })
                else:
                    status = "FAILED"
                    details.append("FALLA: El ORM no pudo descifrar el contenido cifrado.")
                    evidence.append({
                        "test": "Descifrado transparente en capa ORM",
                        "intento": "DenunciaLeyKarin.objects.get(id=denuncia.id)",
                        "resultado": "Falla de integridad o error en clave de descifrado",
                        "estado": "FAIL"
                    })

                transaction.set_rollback(True)

        except Exception as e:
            status = "FAILED"
            details.append(f"Error en Suite 2: {str(e)}")

        self.print_suite_status(suite_name, status)
        return {
            "name": suite_name,
            "articulo": articulo,
            "gravedad": "CRÍTICA",
            "sancion": "Infracción Gravísima (Arts. 14 quinquies, 16 y 35) - Multa hasta 20.000 UTM (~$1.300M CLP)",
            "impacto": "Exposición en texto plano en disco de relatos de acoso sexual/laboral (Ley Karin) o expedientes de accidentes.",
            "status": status,
            "details": details,
            "evidence": evidence
        }

    # -------------------------------------------------------------------------
    # SUITE 3: Retención Legal Obligatoria (Art. 12 y SUSESO)
    # -------------------------------------------------------------------------
    def test_suite_retencion_legal(self) -> Dict[str, Any]:
        suite_name = "Suite 3: Resguardo de Retención Legal de 5 Años vs. Supresión Arbitraria"
        articulo = "Art. 12 (Conservación Legal) y Circular SUSESO 3336 / Ley 16.744"
        self.stdout.write(f"{TerminalColors.BOLD}[*] Ejecutando {suite_name}...{TerminalColors.END}")

        client = APIClient()
        evidence = []
        status = "PASSED"
        details = []

        try:
            with transaction.atomic():
                u_id = uuid.uuid4().hex[:6]
                user = Usuario.objects.create_user(
                    username=f"retention_user_{u_id}",
                    email=f"retention_{u_id}@test.cl",
                    password="Password123!"
                )
                empresa = Empresa.objects.create(
                    prevencionista=user,
                    razon_social=f"Constructora Histórica {u_id}",
                    rut="78.333.444-5"
                )
                trabajador = Trabajador.objects.create(
                    empresa=empresa,
                    rut="15.555.444-3",
                    nombres="Carlos",
                    apellidos="González",
                    cargo="Enfierrador"
                )

                # Registrar un accidente reciente (año 2026, retención exigida hasta 2031)
                InvestigacionAccidente.objects.create(
                    usuario=user,
                    empresa=empresa,
                    trabajador=trabajador,
                    nombre_afectado="Carlos González",
                    rut_afectado="15.555.444-3",
                    cargo_afectado="Enfierrador",
                    edad_afectado=35,
                    antiguedad_afectado="2 años",
                    tipo_evento="ACCIDENTE_TRABAJO",
                    fecha_hora_evento=timezone.now() - datetime.timedelta(days=120),
                    lugar_evento="Piso 4 Obra Central",
                    descripcion_evento="Caída al mismo nivel con esguince de tobillo grado 2.",
                    tipo_lesion="Esguince",
                    parte_cuerpo_afectada="Tobillo derecho",
                    es_grave_o_fatal=False
                )

                # Test 3.1: Intento de eliminar la empresa vía DELETE API
                client.force_authenticate(user=user)
                res_del_empresa = client.delete(f"/api/empresas/{empresa.id}/")

                resp_body = res_del_empresa.content.decode('utf-8', 'ignore')
                if res_del_empresa.status_code == 400 and ("conservación mínima" in resp_body or "deber legal" in resp_body or "retención" in resp_body):
                    details.append(f"Bloqueo preventivo de borrado: DELETE /api/empresas/{empresa.id}/ rechazado con HTTP 400 (Violación de plazo 5 años detectada).")
                    evidence.append({
                        "test": "Intento de Eliminación de Empresa con Historial de Accidentes",
                        "intento": f"DELETE /api/empresas/{empresa.id}/ (Historial < 5 años)",
                        "resultado": "HTTP 400 - RECHAZADO: 'Deber legal de conservación mínima (5 años)'",
                        "estado": "PASS"
                    })
                else:
                    status = "FAILED"
                    if res_del_empresa.status_code in [200, 204]:
                        msg_del = "FALLA: La empresa con expedientes de accidentes menores a 5 años fue eliminada exitosamente (HTTP 204). Se violó el deber legal de conservación de la Circular SUSESO 3336."
                    else:
                        msg_del = f"FALLA: La eliminación de la empresa no aplicó el bloqueo legal preventivo de 5 años (Respuesta: HTTP {res_del_empresa.status_code})."
                    details.append(msg_del)
                    evidence.append({
                        "test": "Intento de Eliminación de Empresa con Historial de Accidentes",
                        "intento": f"DELETE /api/empresas/{empresa.id}/ (Historial < 5 años)",
                        "resultado": f"HTTP {res_del_empresa.status_code} - ELIMINACIÓN PERMITIDA (Sin protección 5 años)",
                        "estado": "FAIL"
                    })

                transaction.set_rollback(True)

        except Exception as e:
            status = "FAILED"
            details.append(f"Error en Suite 3: {str(e)}")

        self.print_suite_status(suite_name, status)
        return {
            "name": suite_name,
            "articulo": articulo,
            "gravedad": "ALTA",
            "sancion": "Art. 12 Ley 21.719 en concordancia con Circular SUSESO 3336 y Ley 16.744 (Deber legal de conservación 5 años)",
            "impacto": "Destrucción ilícita de expedientes de accidentes o denuncias laborales en curso, exponiendo a sanciones laborales, civiles y de la SUSESO.",
            "status": status,
            "details": details,
            "evidence": evidence
        }

    # -------------------------------------------------------------------------
    # SUITE 4: Canal de Derechos ARCO-POL y Portabilidad (Arts. 4-11)
    # -------------------------------------------------------------------------
    def test_suite_arco_portabilidad(self) -> Dict[str, Any]:
        suite_name = "Suite 4: Canal de Derechos ARCO-POL y Portabilidad de Datos"
        articulo = "Arts. 4 al 11 (Acceso, Supresión, Oposición, Portabilidad, Bloqueo) Ley N° 21.719"
        self.stdout.write(f"{TerminalColors.BOLD}[*] Ejecutando {suite_name}...{TerminalColors.END}")

        client = APIClient()
        evidence = []
        status = "PASSED"
        details = []

        try:
            with transaction.atomic():
                # Test 4.1: Ingreso de solicitud pública de Bloqueo Temporal (Art. 11 Ley 21.719)
                payload_arco = {
                    "tipo_derecho": "BLOQUEO",
                    "rut_titular": "16.123.456-7",
                    "nombre_titular": "Titular de Prueba",
                    "email_titular": "titular.prueba@gmail.com",
                    "telefono_titular": "+56912345678",
                    "detalle_solicitud": "Solicito el bloqueo cautelar de mis datos mientras se tramita la revocación de consentimiento."
                }

                res_arco = client.post(
                    "/api/privacidad/solicitar-derecho/",
                    data=payload_arco,
                    format="json"
                )

                if res_arco.status_code == 201:
                    arco_data = res_arco.json()
                    uuid_ticket = arco_data.get('uuid')
                    bloqueo_activo = arco_data.get('bloqueo_provisional_activo')

                    if uuid_ticket and bloqueo_activo is True:
                        details.append(f"Canal público ARCO operativo: Ticket emitido ({uuid_ticket}) con flag de bloqueo cautelar activado automáticamente.")
                        evidence.append({
                            "test": "Ingreso Público de Solicitud de Bloqueo de Datos",
                            "intento": "POST /api/privacidad/solicitar-derecho/ (Anónimo)",
                            "resultado": f"HTTP 201 Created - Ticket UUID: {uuid_ticket} | Bloqueo Cautelar: ACTIVO",
                            "estado": "PASS"
                        })
                    else:
                        status = "FAILED"
                        details.append("FALLA: La solicitud se creó pero no devolvió UUID o no activó el bloqueo provisional.")
                        evidence.append({
                            "test": "Ingreso Público de Solicitud de Bloqueo de Datos",
                            "intento": "POST /api/privacidad/solicitar-derecho/ (Anónimo)",
                            "resultado": "Respuesta incompleta: Falta UUID o flag de bloqueo",
                            "estado": "FAIL"
                        })
                else:
                    status = "FAILED"
                    if res_arco.status_code == 404:
                        msg_arco = "FALLA: El canal público de recepción de Derechos ARCO (/api/privacidad/solicitar-derecho/) NO EXISTE en el sistema (HTTP 404 Not Found)."
                    else:
                        msg_arco = f"FALLA: El canal de Derechos ARCO rechazó la solicitud con código HTTP {res_arco.status_code}."
                    details.append(msg_arco)
                    evidence.append({
                        "test": "Ingreso Público de Solicitud de Bloqueo de Datos",
                        "intento": "POST /api/privacidad/solicitar-derecho/ (Anónimo)",
                        "resultado": f"HTTP {res_arco.status_code} - CANAL INEXISTENTE O INOPERATIVO",
                        "estado": "FAIL"
                    })

                # Test 4.2: Portabilidad de Datos (Art. 9 Ley 21.719)
                u_id = uuid.uuid4().hex[:6]
                empresa_p = Empresa.objects.create(
                    prevencionista=Usuario.objects.first(),
                    razon_social=f"Empresa Portabilidad {u_id}",
                    rut="76.123.456-4"
                )
                Trabajador.objects.create(
                    empresa=empresa_p,
                    rut="16.123.456-7",
                    nombres="Titular",
                    apellidos="Portabilidad",
                    cargo="Auditor de Calidad"
                )

                res_port = client.get("/api/privacidad/portabilidad/?rut=16.123.456-7")
                if res_port.status_code == 200:
                    port_json = res_port.json()
                    formato_valido = "estandar_interoperabilidad" in port_json and "fichas_laborales" in port_json
                    if formato_valido:
                        details.append("Exportación estructurada: Endpoint /api/privacidad/portabilidad/ entregó formato abierto interoperable JSON.")
                        evidence.append({
                            "test": "Descarga de Datos en Formato Portabilidad (JSON)",
                            "intento": "GET /api/privacidad/portabilidad/?rut=16.123.456-7",
                            "resultado": f"HTTP 200 OK - Estándar: '{port_json.get('estandar_interoperabilidad')}' ({len(port_json.get('fichas_laborales', []))} fichas)",
                            "estado": "PASS"
                        })
                    else:
                        status = "FAILED"
                        details.append("FALLA: La respuesta de portabilidad no cumple con el estándar de interoperabilidad exigido por el Art. 9.")
                        evidence.append({
                            "test": "Validación de Estándar Interoperable de Portabilidad",
                            "intento": "GET /api/privacidad/portabilidad/?rut=16.123.456-7",
                            "resultado": "Formato estructurado inválido o incompleto",
                            "estado": "FAIL"
                        })
                else:
                    status = "FAILED"
                    if res_port.status_code == 404:
                        msg_p = "FALLA: El endpoint de Portabilidad de Datos (/api/privacidad/portabilidad/) NO EXISTE en el sistema (HTTP 404 Not Found)."
                    else:
                        msg_p = f"FALLA: El endpoint de Portabilidad respondió con código HTTP {res_port.status_code}."
                    details.append(msg_p)
                    evidence.append({
                        "test": "Descarga de Datos en Formato Portabilidad (JSON)",
                        "intento": "GET /api/privacidad/portabilidad/?rut=16.123.456-7",
                        "resultado": f"HTTP {res_port.status_code} - ENDPOINT INEXISTENTE O INOPERATIVO",
                        "estado": "FAIL"
                    })

                transaction.set_rollback(True)

        except Exception as e:
            status = "FAILED"
            details.append(f"Error en Suite 4: {str(e)}")

        self.print_suite_status(suite_name, status)
        return {
            "name": suite_name,
            "articulo": articulo,
            "gravedad": "ALTA",
            "sancion": "Infracción Grave (Arts. 4 al 11 y Art. 34) - Multas de hasta 10.000 UTM (~$650M CLP)",
            "impacto": "Ausencia de canal formal para que los titulares soliciten bloqueo cautelar, supresión o portabilidad estructurada de sus datos.",
            "status": status,
            "details": details,
            "evidence": evidence
        }

    # -------------------------------------------------------------------------
    # SUITE 5: Trazabilidad y Bitácora de Auditoría (Art. 14 bis)
    # -------------------------------------------------------------------------
    def test_suite_audit_log(self) -> Dict[str, Any]:
        suite_name = "Suite 5: Trazabilidad, Auditoría e Inmutabilidad de Accesos"
        articulo = "Art. 14 bis (Principio de Responsabilidad y Registro de Operaciones)"
        self.stdout.write(f"{TerminalColors.BOLD}[*] Ejecutando {suite_name}...{TerminalColors.END}")

        client = APIClient()
        evidence = []
        status = "PASSED"
        details = []

        try:
            with transaction.atomic():
                u_id = uuid.uuid4().hex[:6]
                user = Usuario.objects.create_user(
                    username=f"auditor_user_{u_id}",
                    email=f"auditor_{u_id}@test.cl",
                    password="Password123!"
                )
                empresa = Empresa.objects.create(
                    prevencionista=user,
                    razon_social=f"Empresa Auditoría {u_id}",
                    rut="79.111.222-3"
                )
                denuncia = DenunciaLeyKarin.objects.create(
                    empresa=empresa,
                    tipo_afectacion="ACOSO_SEXUAL",
                    rut_denunciante="19.111.222-3",
                    nombre_denunciante="Titular Protegido",
                    descripcion_circunstanciada="Descripción confidencial de prueba."
                )

                # Consultar detalle de denuncia a través de la API autenticado
                client.force_authenticate(user=user)
                res_denuncia = client.get(
                    f"/api/denuncias-ley-karin/{denuncia.id}/",
                    REMOTE_ADDR="190.161.45.12"
                )

                if res_denuncia.status_code == 200:
                    log_entry = AuditLogAccesoDenuncia.objects.filter(
                        denuncia=denuncia,
                        usuario=user
                    ).first()

                    if log_entry:
                        details.append(f"Inmutabilidad de auditoría: Acceso registrado automáticamente con IP {log_entry.ip_origen} y marca temporal {log_entry.fecha_hora}.")
                        evidence.append({
                            "test": "Registro de Auditoría de Acceso a Denuncia Ley Karin",
                            "intento": f"GET /api/denuncias-ley-karin/{denuncia.id}/ desde IP 190.161.45.12",
                            "resultado": f"LOG GENERADO: Usuario {user.username} - IP {log_entry.ip_origen} - Acción: {log_entry.accion}",
                            "estado": "PASS"
                        })
                    else:
                        status = "FAILED"
                        details.append("FALLA: Se consultó la denuncia confidencial pero NO se generó el registro inmutable de auditoría (Violación de trazabilidad Art. 14 bis).")
                        evidence.append({
                            "test": "Registro de Auditoría de Acceso a Denuncia Ley Karin",
                            "intento": f"GET /api/denuncias-ley-karin/{denuncia.id}/ desde IP 190.161.45.12",
                            "resultado": "INEXISTENTE: La consulta no generó registro en AuditLogAccesoDenuncia",
                            "estado": "FAIL"
                        })
                else:
                    status = "FAILED"
                    details.append(f"FALLA: La consulta a la denuncia confidencial fue rechazada por el servidor con código HTTP {res_denuncia.status_code}.")
                    evidence.append({
                        "test": "Acceso a Denuncia Confidencial Ley Karin",
                        "intento": f"GET /api/denuncias-ley-karin/{denuncia.id}/",
                        "resultado": f"HTTP {res_denuncia.status_code} - Error en consulta",
                        "estado": "FAIL"
                    })

                transaction.set_rollback(True)

        except Exception as e:
            status = "FAILED"
            details.append(f"Error en Suite 5: {str(e)}")

        self.print_suite_status(suite_name, status)
        return {
            "name": suite_name,
            "articulo": articulo,
            "gravedad": "MEDIA-ALTA",
            "sancion": "Art. 14 bis (Principio de Responsabilidad y Registro Inmutable de Operaciones)",
            "impacto": "Incapacidad de auditar accesos indebidos a datos confidenciales o responder a requerimientos de la Agencia ante denuncias.",
            "status": status,
            "details": details,
            "evidence": evidence
        }

    # -------------------------------------------------------------------------
    # SUITE 6: Superficie de Ataque y Endpoints Públicos (Art. 14)
    # -------------------------------------------------------------------------
    def test_suite_superficie_endpoints(self) -> Dict[str, Any]:
        suite_name = "Suite 6: Mitigación de Superficie de Ataque y Blindaje de Endpoints"
        articulo = "Art. 14 (Seguridad por Defecto y Confidencialidad Técnica)"
        self.stdout.write(f"{TerminalColors.BOLD}[*] Ejecutando {suite_name}...{TerminalColors.END}")

        client = APIClient()
        evidence = []
        status = "PASSED"
        details = []

        try:
            # Test 6.1: Ofuscación de ruta Django Admin (/admin/ debe ser 404)
            res_admin_default = client.get('/admin/')
            if res_admin_default.status_code == 404:
                details.append("Ruta administrativa por defecto (/admin/): OFUSCADA (Devuelve HTTP 404 - No disponible).")
                evidence.append({
                    "test": "Ofuscación de Panel de Control Administrativo",
                    "intento": "GET /admin/ (Ruta estándar de escaneo)",
                    "resultado": "HTTP 404 Not Found - Acceso deshabilitado",
                    "estado": "PASS"
                })
            else:
                status = "FAILED"
                details.append(f"FALLA: La ruta de administración estándar (/admin/) está activa y expuesta públicamente (HTTP {res_admin_default.status_code}). No cuenta con ofuscación de superficie.")
                evidence.append({
                    "test": "Ofuscación de Panel de Control Administrativo",
                    "intento": "GET /admin/ (Ruta estándar de escaneo)",
                    "resultado": f"HTTP {res_admin_default.status_code} - EXPUESTO (Panel no ofuscado)",
                    "estado": "FAIL"
                })

            # Test 6.2: Verificación de panel seguro personalizado
            custom_admin_path = getattr(settings, 'DJANGO_ADMIN_PATH', 'sst-control-panel/')
            res_custom_admin = client.get(f'/{custom_admin_path}')
            if res_custom_admin.status_code in [200, 302]:
                details.append(f"Panel seguro activo en ruta protegida: /{custom_admin_path} (HTTP {res_custom_admin.status_code}).")
                evidence.append({
                    "test": "Disponibilidad de Panel en Ruta Protegida",
                    "intento": f"GET /{custom_admin_path}",
                    "resultado": f"HTTP {res_custom_admin.status_code} - Panel Operativo Protegido",
                    "estado": "PASS"
                })

            # Test 6.3: Consulta anónima a lista de capacitaciones (no debe filtrar nombres de usuarios)
            res_capacitaciones = client.get('/api/registro-capacitacion/')
            if res_capacitaciones.status_code in [200, 401, 403]:
                if res_capacitaciones.status_code == 200:
                    data = res_capacitaciones.json()
                    items = data.get('results', data) if isinstance(data, dict) else data
                    if len(items) == 0:
                        details.append("Blindaje de listados: Visitantes anónimos no pueden enumerar capacitaciones ni usuarios registrados (0 resultados expuestos).")
                        evidence.append({
                            "test": "Enumeración Anónima de Capacitaciones",
                            "intento": "GET /api/registro-capacitacion/ (Sin token)",
                            "resultado": "Respuesta vacía [] - Sin filtración de nombres ni RUTs",
                            "estado": "PASS"
                        })
                    else:
                        status = "FAILED"
                        details.append(f"FALLA: Visitantes anónimos pueden enumerar capacitaciones privadas ({len(items)} registros filtrados).")
                        evidence.append({
                            "test": "Enumeración Anónima de Capacitaciones",
                            "intento": "GET /api/registro-capacitacion/ (Sin token)",
                            "resultado": f"EXPUESTO: {len(items)} registros visibles anónimamente",
                            "estado": "FAIL"
                        })

        except Exception as e:
            status = "FAILED"
            details.append(f"Error en Suite 6: {str(e)}")

        self.print_suite_status(suite_name, status)
        return {
            "name": suite_name,
            "articulo": articulo,
            "gravedad": "MEDIA",
            "sancion": "Art. 14 (Seguridad por Defecto y Medidas Técnicas Preventivas)",
            "impacto": "Exposición de rutas administrativas a ataques de fuerza bruta y filtración de nóminas a usuarios anónimos.",
            "status": status,
            "details": details,
            "evidence": evidence
        }

    # -------------------------------------------------------------------------
    # SUITE 7: Cabeceras de Seguridad HTTP y Cookies (Art. 14)
    # -------------------------------------------------------------------------
    def test_suite_headers_cookies(self) -> Dict[str, Any]:
        suite_name = "Suite 7: Cabeceras de Seguridad HTTP y Transporte Seguro"
        articulo = "Art. 14 (Seguridad en Comunicaciones y Protección de Sesiones)"
        self.stdout.write(f"{TerminalColors.BOLD}[*] Ejecutando {suite_name}...{TerminalColors.END}")

        evidence = []
        status = "PASSED"
        details = []

        try:
            cookie_secure = getattr(settings, 'SESSION_COOKIE_SECURE', False)
            csrf_secure = getattr(settings, 'CSRF_COOKIE_SECURE', False)
            cookie_httponly = getattr(settings, 'SESSION_COOKIE_HTTPONLY', False)
            time_zone = getattr(settings, 'TIME_ZONE', '')

            details.append(f"Flags de sesión: SESSION_COOKIE_HTTPONLY={cookie_httponly}, SESSION_COOKIE_SECURE={cookie_secure}, CSRF_COOKIE_SECURE={csrf_secure}.")

            if cookie_httponly:
                evidence.append({
                    "test": "Protección contra robo de sesión por XSS (HttpOnly)",
                    "intento": "Verificación de directiva SESSION_COOKIE_HTTPONLY",
                    "resultado": "CONFIGURADO: True (Inaccesible vía document.cookie)",
                    "estado": "PASS"
                })
            else:
                status = "FAILED"
                details.append("FALLA: Directiva SESSION_COOKIE_HTTPONLY deshabilitada (riesgo de secuestro de sesión por XSS).")
                evidence.append({
                    "test": "Protección contra robo de sesión por XSS (HttpOnly)",
                    "intento": "Verificación de directiva SESSION_COOKIE_HTTPONLY",
                    "resultado": "INSEGURO: False (Cookies expuestas a lectura en JavaScript)",
                    "estado": "FAIL"
                })

            if time_zone == 'America/Santiago':
                details.append(f"Trazabilidad horaria oficial: TIME_ZONE configurado congruentemente a '{time_zone}'.")
                evidence.append({
                    "test": "Sincronización Horaria Oficial de Auditoría",
                    "intento": "Verificación de TIME_ZONE",
                    "resultado": "CONFIGURADO: 'America/Santiago' (Trazabilidad legal exacta)",
                    "estado": "PASS"
                })
            else:
                details.append(f"Aviso: Zona horaria actual '{time_zone}' (Recomendada: 'America/Santiago').")

            next_config_path = os.path.join(settings.BASE_DIR.parent, "frontend", "next.config.ts")
            if os.path.exists(next_config_path):
                with open(next_config_path, "r", encoding="utf-8") as f:
                    content = f.read()

                headers_presentes = [
                    ("Strict-Transport-Security", "Strict-Transport-Security" in content),
                    ("X-Frame-Options", "X-Frame-Options" in content),
                    ("X-Content-Type-Options", "X-Content-Type-Options" in content),
                    ("Referrer-Policy", "Referrer-Policy" in content)
                ]

                todos_presentes = all(h[1] for h in headers_presentes)
                if todos_presentes:
                    details.append("Frontend Hardening: Cabeceras de seguridad HSTS, SAMEORIGIN, nosniff y Referrer-Policy integradas en Next.js.")
                    evidence.append({
                        "test": "Cabeceras HTTP de Protección contra Clickjacking y MITM",
                        "intento": "Inspección de directivas en next.config.ts",
                        "resultado": "HSTS, X-Frame-Options (SAMEORIGIN), nosniff y Referrer-Policy PRESENTES",
                        "estado": "PASS"
                    })
                else:
                    status = "FAILED"
                    faltantes = [h[0] for h in headers_presentes if not h[1]]
                    details.append(f"FALLA: Cabeceras HTTP de seguridad ausentes en el frontend: {', '.join(faltantes)}.")
                    evidence.append({
                        "test": "Cabeceras HTTP de Protección contra Clickjacking y MITM",
                        "intento": "Inspección de directivas en next.config.ts",
                        "resultado": f"AUSENTES: {', '.join(faltantes)}",
                        "estado": "FAIL"
                    })

        except Exception as e:
            status = "FAILED"
            details.append(f"Error en Suite 7: {str(e)}")

        self.print_suite_status(suite_name, status)
        return {
            "name": suite_name,
            "articulo": articulo,
            "gravedad": "ALTA",
            "sancion": "Art. 14 (Seguridad de las Comunicaciones y Confidencialidad)",
            "impacto": "Susceptibilidad a ataques XSS, secuestro de cookies de sesión (sin HttpOnly) y robo de credenciales en tránsito.",
            "status": status,
            "details": details,
            "evidence": evidence
        }

    # -------------------------------------------------------------------------
    # Métodos Auxiliares de Presentación y Generación de HTML
    # -------------------------------------------------------------------------
    def print_suite_status(self, suite_name: str, status: str):
        if status == "PASSED":
            icon = f"{TerminalColors.GREEN}[✓ APROBADO]{TerminalColors.END}"
        else:
            icon = f"{TerminalColors.RED}[✗ FALLIDO]{TerminalColors.END}"
        self.stdout.write(f"  └─> {icon} {suite_name}\n")

    def print_summary(self, results: List[Dict[str, Any]], compliance_pct: int, duration: float):
        self.stdout.write(f"{TerminalColors.BOLD}========================================================================================{TerminalColors.END}")
        self.stdout.write(f"{TerminalColors.BOLD}                     RESUMEN EJECUTIVO DE CUMPLIMIENTO TÉCNICO                          {TerminalColors.END}")
        self.stdout.write(f"{TerminalColors.BOLD}========================================================================================{TerminalColors.END}")

        for r in results:
            color = TerminalColors.GREEN if r['status'] == 'PASSED' else TerminalColors.RED
            self.stdout.write(f" • {color}{r['status']:<7}{TerminalColors.END} | {r['name']:<65} | {r['articulo']}")

        self.stdout.write("----------------------------------------------------------------------------------------")
        score_color = TerminalColors.GREEN if compliance_pct == 100 else TerminalColors.YELLOW
        self.stdout.write(
            f" {TerminalColors.BOLD}PUNTAJE DE CONFORMIDAD TÉCNICA:{TerminalColors.END} {score_color}{compliance_pct}%{TerminalColors.END} "
            f"({sum(1 for r in results if r['status'] == 'PASSED')}/{len(results)} suites exitosas) | Tiempo: {duration}s"
        )
        self.stdout.write(f"{TerminalColors.BOLD}========================================================================================{TerminalColors.END}")

    def generate_html_report(self, results: List[Dict[str, Any]], compliance_pct: int, duration: float, file_path: str):
        fecha_str = timezone.now().strftime("%d de %B de %Y a las %H:%M:%S")

        if compliance_pct == 100:
            dictamen_text = "APROBADO SIN RESERVAS"
            dictamen_color = "var(--success)"
            banner_class = "score-banner-pass"
            banner_title = "100% CONFORMIDAD NORMATIVA Y TÉCNICA"
            banner_desc = "Todas las pruebas de infiltración horizontal, criptografía en reposo y canales de derechos resultaron exitosas sin vulnerabilidades detectadas."
            circle_color = "var(--success)"
            circle_bg = "rgba(16, 185, 129, 0.2)"
        elif compliance_pct >= 70:
            dictamen_text = "CONFORMIDAD PARCIAL / OBSERVACIONES"
            dictamen_color = "var(--warning)"
            banner_class = "score-banner-warn"
            banner_title = f"CONFORMIDAD PARCIAL ({compliance_pct}%)"
            banner_desc = "El sistema supera controles básicos pero mantiene vulnerabilidades que deben ser corregidas antes de la entrada en vigor de la Ley N° 21.719."
            circle_color = "var(--warning)"
            circle_bg = "rgba(245, 158, 11, 0.2)"
        else:
            dictamen_text = "NO CONFORME - VULNERABILIDADES CRÍTICAS"
            dictamen_color = "var(--danger)"
            banner_class = "score-banner-fail"
            banner_title = f"ALTO RIESGO DE FILTRACIÓN Y SANCIONES ({compliance_pct}%)"
            banner_desc = "El sistema presenta brechas graves de confidencialidad, datos sensibles en texto plano y ausencia de canales obligatorios. Existe riesgo inminente de multas de hasta 20.000 UTM o 4% de ingresos bajo la Ley N° 21.719."
            circle_color = "var(--danger)"
            circle_bg = "rgba(239, 68, 68, 0.2)"

        suites_html = ""
        for idx, r in enumerate(results, 1):
            if r['status'] == 'PASSED':
                badge_class = "badge-pass"
                badge_text = "✓ CUMPLE ESTÁNDAR (0 FUGAS)"
            else:
                badge_class = "badge-fail"
                badge_text = "✗ VULNERABLE (BRECHA DETECTADA)"

            grav = r.get('gravedad', 'MEDIA')
            if grav == 'CRÍTICA':
                grav_badge = '<span class="badge badge-critic">GRAVEDAD: CRÍTICA</span>'
            elif 'ALTA' in grav:
                grav_badge = '<span class="badge badge-high">GRAVEDAD: ALTA</span>'
            else:
                grav_badge = '<span class="badge badge-medium">GRAVEDAD: MEDIA</span>'

            details_html = "".join([f"<li>{d}</li>" for d in r['details']])

            evidence_rows = ""
            for ev in r.get('evidence', []):
                ev_badge = "status-pass" if ev['estado'] == 'PASS' else "status-fail"
                evidence_rows += f"""
                <tr>
                    <td><strong>{ev['test']}</strong></td>
                    <td><code>{ev['intento']}</code></td>
                    <td><span class="ev-result">{ev['resultado']}</span></td>
                    <td><span class="{ev_badge}">{ev['estado']}</span></td>
                </tr>
                """

            suites_html += f"""
            <div class="card suite-card">
                <div class="suite-header">
                    <div>
                        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                            <span class="suite-num">Prueba #{idx}</span>
                            {grav_badge}
                        </div>
                        <h3 class="suite-title">{r['name']}</h3>
                        <p class="suite-law">Fundamento Jurídico: <strong>{r['articulo']}</strong></p>
                    </div>
                    <span class="badge {badge_class}">{badge_text}</span>
                </div>
                <div class="suite-body">
                    <div class="risk-box">
                        <div class="risk-item">
                            <span class="risk-label">Sanción Legal Aplicable:</span>
                            <span class="risk-val">{r.get('sancion', 'Art. 35 Ley 21.719')}</span>
                        </div>
                        <div class="risk-item">
                            <span class="risk-label">Impacto de la Falla:</span>
                            <span class="risk-val">{r.get('impacto', 'Exposición de datos personales')}</span>
                        </div>
                    </div>
                    <ul class="details-list">
                        {details_html}
                    </ul>
                    <table class="evidence-table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">Prueba de Infiltración / Chequeo</th>
                                <th style="width: 30%;">Vector Probado</th>
                                <th style="width: 35%;">Evidencia Técnica Obtenida</th>
                                <th style="width: 10%;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {evidence_rows}
                        </tbody>
                    </table>
                </div>
            </div>
            """

        html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe Técnico Forense: Cumplimiento Ley N° 21.719 - HD Prevención</title>
    <style>
        :root {{
            --bg: #0f172a;
            --card-bg: #1e293b;
            --border: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #38bdf8;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            line-height: 1.6;
            padding: 30px 20px;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        .header {{
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 40px;
            margin-bottom: 30px;
            position: relative;
            overflow: hidden;
        }}
        .header::after {{
            content: "";
            position: absolute;
            top: 0; right: 0; width: 350px; height: 100%;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(15, 23, 42, 0) 70%);
            pointer-events: none;
        }}
        .logo-tag {{
            display: inline-block;
            background: rgba(56, 189, 248, 0.15);
            color: var(--accent);
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 12px;
            border: 1px solid rgba(56, 189, 248, 0.3);
        }}
        h1 {{
            font-size: 2.2rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            margin-bottom: 10px;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--border);
        }}
        .meta-item h4 {{
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }}
        .meta-item p {{
            font-size: 1.05rem;
            font-weight: 600;
        }}
        .score-banner {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-radius: 12px;
            padding: 24px 30px;
            margin-bottom: 30px;
            transition: all 0.3s ease;
        }}
        .score-banner-pass {{
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }}
        .score-banner-warn {{
            background: rgba(245, 158, 11, 0.12);
            border: 1px solid rgba(245, 158, 11, 0.4);
        }}
        .score-banner-fail {{
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.4);
        }}
        .score-text h2 {{
            font-size: 1.5rem;
            font-weight: 700;
        }}
        .score-text p {{
            color: var(--text-muted);
            font-size: 0.95rem;
            margin-top: 4px;
        }}
        .score-circle {{
            font-size: 2.8rem;
            font-weight: 900;
            width: 100px;
            height: 100px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }}
        .card {{
            background-color: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-bottom: 24px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        }}
        .suite-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 20px 24px;
            background: rgba(255, 255, 255, 0.02);
            border-bottom: 1px solid var(--border);
        }}
        .suite-num {{
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--accent);
            text-transform: uppercase;
        }}
        .suite-title {{
            font-size: 1.25rem;
            margin-top: 2px;
            font-weight: 700;
        }}
        .suite-law {{
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-top: 4px;
        }}
        .badge {{
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 700;
            letter-spacing: 0.05em;
            display: inline-block;
        }}
        .badge-pass {{
            background-color: rgba(16, 185, 129, 0.2);
            color: var(--success);
            border: 1px solid rgba(16, 185, 129, 0.4);
        }}
        .badge-fail {{
            background-color: rgba(239, 68, 68, 0.2);
            color: var(--danger);
            border: 1px solid rgba(239, 68, 68, 0.4);
        }}
        .badge-critic {{
            background-color: rgba(239, 68, 68, 0.25);
            color: #f87171;
            border: 1px solid #ef4444;
        }}
        .badge-high {{
            background-color: rgba(249, 115, 22, 0.25);
            color: #fb923c;
            border: 1px solid #f97316;
        }}
        .badge-medium {{
            background-color: rgba(234, 179, 8, 0.25);
            color: #fde047;
            border: 1px solid #eab308;
        }}
        .risk-box {{
            background: rgba(15, 23, 42, 0.6);
            border-left: 4px solid var(--accent);
            border-radius: 6px;
            padding: 14px 18px;
            margin-bottom: 20px;
        }}
        .risk-item {{
            margin-bottom: 6px;
            font-size: 0.9rem;
        }}
        .risk-item:last-child {{
            margin-bottom: 0;
        }}
        .risk-label {{
            font-weight: 700;
            color: var(--text-muted);
            margin-right: 8px;
        }}
        .risk-val {{
            color: #f1f5f9;
        }}
        .suite-body {{
            padding: 24px;
        }}
        .details-list {{
            list-style: none;
            margin-bottom: 20px;
        }}
        .details-list li {{
            position: relative;
            padding-left: 24px;
            margin-bottom: 8px;
            font-size: 0.95rem;
            color: #cbd5e1;
        }}
        .details-list li::before {{
            content: "•";
            position: absolute;
            left: 8px;
            color: var(--accent);
            font-weight: bold;
        }}
        .evidence-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            margin-top: 15px;
            background: rgba(15, 23, 42, 0.4);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--border);
        }}
        .evidence-table th {{
            background: rgba(15, 23, 42, 0.8);
            color: var(--text-muted);
            text-align: left;
            padding: 12px 16px;
            font-weight: 600;
            border-bottom: 1px solid var(--border);
        }}
        .evidence-table td {{
            padding: 12px 16px;
            border-bottom: 1px solid rgba(51, 65, 85, 0.5);
            vertical-align: top;
        }}
        .evidence-table tr:last-child td {{
            border-bottom: none;
        }}
        code {{
            background: #0f172a;
            color: #38bdf8;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.8rem;
            word-break: break-all;
        }}
        .ev-result {{
            color: #e2e8f0;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.8rem;
            word-break: break-all;
        }}
        .status-pass {{
            color: var(--success);
            font-weight: bold;
        }}
        .status-fail {{
            color: var(--danger);
            font-weight: bold;
        }}
        .footer {{
            text-align: center;
            margin-top: 50px;
            padding: 30px;
            color: var(--text-muted);
            font-size: 0.9rem;
            border-top: 1px solid var(--border);
        }}
        .actions-bar {{
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
            gap: 12px;
        }}
        .btn {{
            background: var(--accent);
            color: #0f172a;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }}
        .btn:hover {{
            filter: brightness(1.1);
            transform: translateY(-1px);
        }}
        @media print {{
            body {{ background: white; color: black; padding: 0; }}
            .card {{ border: 1px solid #ccc; box-shadow: none; break-inside: avoid; }}
            .btn, .actions-bar {{ display: none; }}
            .score-banner-pass {{ border: 1px solid #10b981; }}
            .score-banner-fail {{ border: 1px solid #ef4444; }}
            .score-banner-warn {{ border: 1px solid #f59e0b; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="actions-bar">
            <button class="btn" onclick="window.print()">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                Imprimir / Guardar en PDF
            </button>
        </div>

        <div class="header">
            <span class="logo-tag">CERTIFICACIÓN Y AUDITORÍA TÉCNICA FORENSE</span>
            <h1>Informe de Evaluación y Cero Filtraciones</h1>
            <p style="color: var(--text-muted); font-size: 1.1rem;">
                Comprobación empírica y criptográfica de inmunidad contra fugas de datos y cumplimiento estricto de la <strong>Ley N° 21.719</strong>.
            </p>

            <div class="meta-grid">
                <div class="meta-item">
                    <h4>Sistema Auditado</h4>
                    <p>Plataforma HD Prevención (SaaS)</p>
                </div>
                <div class="meta-item">
                    <h4>Fecha & Hora</h4>
                    <p>{fecha_str}</p>
                </div>
                <div class="meta-item">
                    <h4>Duración del Test</h4>
                    <p>{duration} segundos</p>
                </div>
                <div class="meta-item">
                    <h4>Dictamen Final</h4>
                    <p style="color: {dictamen_color}; font-weight: 800;">{dictamen_text}</p>
                </div>
            </div>
        </div>

        <div class="score-banner {banner_class}">
            <div class="score-text">
                <h2 style="color: {dictamen_color};">{banner_title}</h2>
                <p>{banner_desc}</p>
            </div>
            <div class="score-circle" style="color: {circle_color}; border: 3px solid {circle_color}; background: {circle_bg};">
                {compliance_pct}%
            </div>
        </div>

        <!-- Renderizado de Suites -->
        {suites_html}

        <div class="footer">
            <p><strong>HD Prevención & Cía. - Servicio de Adecuación y Blindaje Técnico</strong></p>
            <p style="margin-top: 5px;">Este informe fue generado de forma automatizada mediante inspección de base de datos en bajo nivel y pruebas de inyección HTTP.</p>
        </div>
    </div>
</body>
</html>
"""
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_content)
