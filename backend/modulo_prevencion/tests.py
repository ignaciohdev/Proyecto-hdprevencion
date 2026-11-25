from datetime import timedelta
from typing import Any
import hashlib
import json
import time
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.utils import timezone
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.management import call_command
from django.db import connection
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from .models import (
    TemaCapacitacion, RegistroCapacitacion, Plan, Suscripcion, Usuario,
    Empresa, CentroTrabajo, Trabajador,
    DenunciaLeyKarin, SugerenciaLaboral, AuditLogAccesoDenuncia,
    InvestigacionAccidente,
    ComiteParitario, MiembroCPHS, ActaSesionCPHS,
    EntregaEPP,
    Contratista, DocumentoContratista, TrabajadorSubcontratado,
    RequisitoLegalBase, MatrizLegal, ItemMatrizLegal,
    MatrizRiesgoMiper, ItemMatrizRiesgo,
    AuditLogEventoSeguridad
)
from .mfa import calcular_totp, TOTP_PERIOD_SECONDS
from .validators import HIBPPasswordValidator
from .seeder_requisitos import asegurar_requisitos_base

class CapacitacionIntegrationTestCase(APITestCase):
    """
    Casos de prueba integrales para verificar el correcto funcionamiento
    del Módulo de Capacitaciones y el flujo de Autofirma Digital Móvil (QR).
    """
    client: Any

    def setUp(self):
        # Crear un plan de prueba
        self.plan = Plan.objects.create(
            nombre="Plan Premium de Prueba",
            codigo="premium-test",
            precio=9990.00,
            limite_semanal=10,
            asientos=5
        )

        # Crear un usuario prevencionista / cliente
        self.user = Usuario.objects.create_user(
            username="prevencionista_test",
            email="test@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )

        # Crear suscripción activa para el usuario
        self.suscripcion = Suscripcion.objects.create(
            usuario=self.user,
            plan=self.plan,
            estado=Suscripcion.ESTADO_ACTIVA,
            fecha_inicio=timezone.now()
        )

        # Autenticar al cliente para las llamadas de administración
        self.client.login(username="prevencionista_test", password="securepassword123")
        response = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prevencionista_test',
            'password': 'securepassword123'
        })
        self.token = response.data['access']
        # Guardamos las credenciales de administración
        self.auth_headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}

    def test_detalles_publicos_anonimo(self):
        """
        Verifica que cualquier usuario (incluso anónimo/no autenticado) pueda
        consultar los detalles básicos de una charla para firmarla.
        """
        tema = TemaCapacitacion.objects.create(
            usuario=self.user,
            titulo="Charla de Inducción ODI",
            descripcion="Descripción breve",
            categoria=TemaCapacitacion.CATEGORIA_ODI,
            duracion_minutos=40
        )
        registro = RegistroCapacitacion.objects.create(
            usuario=self.user,
            tema=tema,
            estado=RegistroCapacitacion.ESTADO_PROGRAMADA,
            fecha_programada=timezone.now().date(),
            lugar="Taller Principal"
        )

        # Hacer petición sin token JWT (Anónimo)
        self.client.credentials() # Limpiar credenciales
        url = reverse('registrocapacitacion-detalles-publicos', kwargs={'uuid': str(registro.uuid)})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['tema_titulo'], "Charla de Inducción ODI")
        self.assertEqual(response.data['relator'], "prevencionista_test")
        self.assertEqual(response.data['estado'], RegistroCapacitacion.ESTADO_PROGRAMADA)

    def test_rechazo_enumeracion_id_secuencial_publico(self):
        """
        Verifica que los endpoints públicos rechacen IDs secuenciales numéricos (404),
        impidiendo la enumeración de recursos y fuga de datos sensibles.
        """
        tema = TemaCapacitacion.objects.create(
            usuario=self.user,
            titulo="Charla Anti Spoofing",
            descripcion="Descripción breve",
            categoria=TemaCapacitacion.CATEGORIA_ODI,
            duracion_minutos=15
        )
        registro = RegistroCapacitacion.objects.create(
            usuario=self.user,
            tema=tema,
            estado=RegistroCapacitacion.ESTADO_PROGRAMADA,
            fecha_programada=timezone.now().date(),
            lugar="Planta"
        )
        self.client.credentials()
        # Intentar acceder mediante ID secuencial numérico a endpoint público
        url_secuencial = f"/api/registro-capacitacion/{registro.pk}/detalles-publicos/"
        response = self.client.get(url_secuencial)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_registrar_asistencia_publica(self):
        """
        Verifica que los trabajadores puedan registrar su asistencia y firma Base64
        de manera pública, y valida restricciones como campos obligatorios y RUT duplicado.
        """
        tema = TemaCapacitacion.objects.create(
            usuario=self.user,
            titulo="Uso de Extintores",
            descripcion="Charla de uso de extintores",
            categoria=TemaCapacitacion.CATEGORIA_PRACTICO,
            duracion_minutos=30
        )
        registro = RegistroCapacitacion.objects.create(
            usuario=self.user,
            tema=tema,
            estado=RegistroCapacitacion.ESTADO_PROGRAMADA,
            fecha_programada=timezone.now().date(),
            lugar="Patio de Maniobras",
            asistentes=[]
        )

        url = reverse('registrocapacitacion-registrar-asistencia', kwargs={'uuid': str(registro.uuid)})
        
        # 1. Petición pública sin credenciales con RUT válido (DV 5)
        self.client.credentials()
        payload = {
            "nombre": "Pedro Rojas",
            "rut": "15.456.789-5",
            "firma": "data:image/png;base64,iVBORw0KGgoAAAANS..." # base64 simulado
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar en base de datos que se haya agregado con IP y fecha_firma
        registro.refresh_from_db()
        self.assertEqual(len(registro.asistentes), 1)
        self.assertEqual(registro.asistentes[0]['nombre'], "Pedro Rojas")
        self.assertTrue(registro.asistentes[0]['firma'].startswith("data:image/"))
        self.assertIn('fecha_firma', registro.asistentes[0])
        self.assertIn('ip_dispositivo', registro.asistentes[0])

        # 2. Intentar registrar con RUT con dígito verificador inválido (Módulo 11)
        payload_rut_invalido = {
            "nombre": "Juan Error",
            "rut": "15.456.789-0",
            "firma": "data:image/png;base64,iVBORw0KGgoAAAANS..."
        }
        response_bad_rut = self.client.post(url, payload_rut_invalido, format='json')
        self.assertEqual(response_bad_rut.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response_bad_rut.data)

        # 3. Intentar registrar el mismo RUT (duplicado)
        response_duplicado = self.client.post(url, payload, format='json')
        self.assertEqual(response_duplicado.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response_duplicado.data)

        # 4. Intentar registrar con campos vacíos
        payload_incompleto = {"nombre": "", "rut": "", "firma": ""}
        response_incompleto = self.client.post(url, payload_incompleto, format='json')
        self.assertEqual(response_incompleto.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ciclo_completo_capacitacion(self):
        """
        Valida el flujo de trabajo completo del prevencionista: agendar,
        esperar firmas del personal, finalizar sesión y auditar stats en el dashboard.
        """
        # Autenticar como prevencionista
        self.client.credentials(**self.auth_headers)

        # 1. Crear Tema
        tema_data = {
            "titulo": "Uso Correcto de EPP",
            "descripcion": "Charla obligatoria sobre el uso y mantenimiento de EPP.",
            "categoria": TemaCapacitacion.CATEGORIA_CHARLA,
            "duracion_minutos": 15,
            "contenido_clave": ["Casco", "Zapatos"]
        }
        url_temas = reverse('temacapacitacion-list')
        response_tema = self.client.post(url_temas, tema_data, format='json')
        self.assertEqual(response_tema.status_code, status.HTTP_201_CREATED)
        tema_id = response_tema.data['id']

        # 2. Programar Charla
        fecha_prog = (timezone.now() + timedelta(days=1)).date()
        registro_data = {
            "tema": tema_id,
            "fecha_programada": str(fecha_prog),
            "lugar": "Sala de Reuniones B",
            "estado": RegistroCapacitacion.ESTADO_PROGRAMADA,
            "asistentes": []
        }
        url_registros = reverse('registrocapacitacion-list')
        response_registro = self.client.post(url_registros, registro_data, format='json')
        self.assertEqual(response_registro.status_code, status.HTTP_201_CREATED)
        registro_id = response_registro.data['id']
        registro_uuid = response_registro.data['uuid']

        # 3. Trabajadores firman mediante endpoint público (Simulado con UUID)
        self.client.credentials() # Anónimo
        url_firmar = reverse('registrocapacitacion-registrar-asistencia', kwargs={'uuid': registro_uuid})
        
        trabajador_1 = {"nombre": "Juan Perez", "rut": "12.345.678-5", "firma": "data:image/png;base64,aaaa"}
        trabajador_2 = {"nombre": "Maria Soto", "rut": "15.456.789-5", "firma": "data:image/png;base64,bbbb"}
        
        self.client.post(url_firmar, trabajador_1, format='json')
        self.client.post(url_firmar, trabajador_2, format='json')

        # 4. Prevencionista finaliza la capacitación
        self.client.credentials(**self.auth_headers) # Autenticar de nuevo
        
        # Traer el registro actualizado (que el front enviará al finalizar)
        registro_obj = RegistroCapacitacion.objects.get(id=registro_id)
        
        finalizar_url = reverse('registrocapacitacion-finalizar', kwargs={'uuid': registro_uuid})
        payload_finalizar = {
            "asistentes": registro_obj.asistentes,
            "observaciones": "Se ejecutó de forma óptima con firmas móviles."
        }
        response_finalizar = self.client.patch(finalizar_url, payload_finalizar, format='json')
        self.assertEqual(response_finalizar.status_code, status.HTTP_200_OK)
        self.assertEqual(response_finalizar.data['estado'], RegistroCapacitacion.ESTADO_REALIZADA)
        self.assertEqual(len(response_finalizar.data['asistentes']), 2)

        # 5. Comprobar que impacta el dashboard analítico
        url_stats = reverse('dashboard_stats')
        response_stats = self.client.get(url_stats)
        self.assertEqual(response_stats.status_code, status.HTTP_200_OK)
        
        cap_stats = response_stats.data.get('capacitaciones')
        self.assertEqual(cap_stats['total'], 1)
        self.assertEqual(cap_stats['realizadas'], 1)
        self.assertEqual(cap_stats['asistentes_alcanzados'], 2)
        self.assertEqual(cap_stats['cumplimiento_pac'], 100.0)

    def test_intentar_finalizar_ya_realizada(self):
        """
        Verifica que no se pueda volver a finalizar una capacitación que ya está en estado REALIZADA.
        """
        self.client.credentials(**self.auth_headers)
        
        tema = TemaCapacitacion.objects.create(
            usuario=self.user,
            titulo="Tema Test",
            descripcion="Desc",
            categoria=TemaCapacitacion.CATEGORIA_TEORICO,
            duracion_minutos=30
        )
        registro = RegistroCapacitacion.objects.create(
            usuario=self.user,
            tema=tema,
            estado=RegistroCapacitacion.ESTADO_REALIZADA,
            fecha_programada=timezone.now().date(),
            fecha_realizacion=timezone.now(),
            lugar="Sala B",
            asistentes=[]
        )

        finalizar_url = reverse('registrocapacitacion-finalizar', kwargs={'uuid': str(registro.uuid)})
        response = self.client.patch(finalizar_url, {"asistentes": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)


class JWTAuthSecurityTestCase(APITestCase):
    """
    Pruebas de seguridad para mitigación SEC-02 (Fortalecimiento de JWT):
    - Cookies HttpOnly SameSite=None Secure para refresh token.
    - Soporte dual (cookie y body) en endpoint de refresh.
    - Rotación y blacklist de tokens antiguos.
    - Logout seguro e invalidación de token.
    """
    client: Any

    def setUp(self):
        cache.clear()
        self.user = Usuario.objects.create_user(
            username="jwt_user_test",
            email="jwt@hdprevencion.cl",
            password="StrongPassword123!"
        )

    def test_login_retorna_tokens_e_inyecta_cookie(self):
        url = reverse('token_obtain_pair')
        payload = {
            "username": "jwt_user_test",
            "password": "StrongPassword123!"
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        
        # Verificar cookie refresh_token
        self.assertIn('refresh_token', response.cookies)
        cookie = response.cookies['refresh_token']
        self.assertEqual(cookie['httponly'], True)
        self.assertEqual(cookie['secure'], True)
        self.assertEqual(cookie['samesite'], 'None')
        self.assertEqual(cookie['path'], '/')
        self.assertEqual(cookie.value, response.data['refresh'])

    def test_refresh_desde_cookie_y_rotacion(self):
        # 1. Login para obtener refresh token
        login_res = self.client.post(reverse('token_obtain_pair'), {
            "username": "jwt_user_test",
            "password": "StrongPassword123!"
        })
        first_refresh = login_res.data['refresh']

        # 2. Refrescar sin enviar refresh en el body (usando la cookie inyectada)
        refresh_url = reverse('token_refresh')
        response = self.client.post(refresh_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        
        # El token de refresco debe haber rotado
        second_refresh = response.data['refresh']
        self.assertNotEqual(first_refresh, second_refresh)
        self.assertEqual(response.cookies['refresh_token'].value, second_refresh)

        # 3. Intentar reutilizar el primer refresh token debe fallar por estar en Blacklist
        reuse_res = self.client.post(refresh_url, {'refresh': first_refresh}, format='json')
        self.assertEqual(reuse_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_invalida_token_y_borra_cookie(self):
        login_res = self.client.post(reverse('token_obtain_pair'), {
            "username": "jwt_user_test",
            "password": "StrongPassword123!"
        })
        refresh_token = login_res.data['refresh']

        logout_url = reverse('auth_logout')
        logout_res = self.client.post(logout_url, {}, format='json')
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)
        
        # Verificar que la cookie fue eliminada (valor vacío)
        self.assertEqual(logout_res.cookies['refresh_token'].value, '')

        # Intentar refrescar con el token que fue revocado debe ser rechazado
        refresh_url = reverse('token_refresh')
        reuse_res = self.client.post(refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(reuse_res.status_code, status.HTTP_401_UNAUTHORIZED)


class MultiTenantDomainTestCase(APITestCase):
    """
    Pruebas unitarias para validar la arquitectura de datos DAT-01 y DAT-02:
    - Validación de RUT chileno (Módulo 11).
    - Aislamiento multi-tenant entre prevencionistas (Usuario A y Usuario B).
    - Asignación automática de prevencionista al crear Empresa.
    - Prevención de vinculación cruzada no autorizada de Centros de Trabajo y Trabajadores.
    """
    def setUp(self):
        self.user_a = Usuario.objects.create_user(
            username="prevencionista_a",
            email="a@prevencion.cl",
            password="Password123!",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.user_b = Usuario.objects.create_user(
            username="prevencionista_b",
            email="b@prevencion.cl",
            password="Password123!",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )

        # Empresa A creada directamente para Usuario A
        self.empresa_a = Empresa.objects.create(
            prevencionista=self.user_a,
            razon_social="Constructora A SpA",
            rut="76.123.456-0",
            mutualidad="ACHS",
            tasa_cotizacion_adicional=1.50
        )
        self.centro_a = CentroTrabajo.objects.create(
            empresa=self.empresa_a,
            nombre="Faena Andina",
            direccion="Camino Los Andes 100",
            comuna="Las Condes"
        )
        self.trabajador_a = Trabajador.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            rut="12.345.678-5",
            nombres="Juan",
            apellidos="Pérez",
            cargo="Operador Rigger"
        )

    def test_aislamiento_listado_empresas_centros_trabajadores(self):
        # Autenticar como Usuario A -> ve sus registros
        self.client.force_authenticate(user=self.user_a)
        res_emp_a = self.client.get('/api/empresas/')
        self.assertEqual(res_emp_a.status_code, status.HTTP_200_OK)
        items_emp_a = res_emp_a.data if isinstance(res_emp_a.data, list) else res_emp_a.data.get('results', [])
        self.assertEqual(len(items_emp_a), 1)

        res_cen_a = self.client.get('/api/centros-trabajo/')
        self.assertEqual(res_cen_a.status_code, status.HTTP_200_OK)
        items_cen_a = res_cen_a.data if isinstance(res_cen_a.data, list) else res_cen_a.data.get('results', [])
        self.assertEqual(len(items_cen_a), 1)

        res_tra_a = self.client.get('/api/trabajadores/')
        self.assertEqual(res_tra_a.status_code, status.HTTP_200_OK)
        items_tra_a = res_tra_a.data if isinstance(res_tra_a.data, list) else res_tra_a.data.get('results', [])
        self.assertEqual(len(items_tra_a), 1)

        # Autenticar como Usuario B -> aislamiento multi-tenant estricto (0 registros)
        self.client.force_authenticate(user=self.user_b)
        res_emp_b = self.client.get('/api/empresas/')
        self.assertEqual(res_emp_b.status_code, status.HTTP_200_OK)
        items_emp_b = res_emp_b.data if isinstance(res_emp_b.data, list) else res_emp_b.data.get('results', [])
        self.assertEqual(len(items_emp_b), 0)

        res_cen_b = self.client.get('/api/centros-trabajo/')
        self.assertEqual(res_cen_b.status_code, status.HTTP_200_OK)
        items_cen_b = res_cen_b.data if isinstance(res_cen_b.data, list) else res_cen_b.data.get('results', [])
        self.assertEqual(len(items_cen_b), 0)

        res_tra_b = self.client.get('/api/trabajadores/')
        self.assertEqual(res_tra_b.status_code, status.HTTP_200_OK)
        items_tra_b = res_tra_b.data if isinstance(res_tra_b.data, list) else res_tra_b.data.get('results', [])
        self.assertEqual(len(items_tra_b), 0)

    def test_denegacion_acceso_directo_y_modificacion_cruzada(self):
        # Usuario B no puede consultar, modificar ni eliminar entidades del Usuario A (debe dar 404)
        self.client.force_authenticate(user=self.user_b)

        res_emp = self.client.get(f'/api/empresas/{self.empresa_a.id}/')
        self.assertEqual(res_emp.status_code, status.HTTP_404_NOT_FOUND)

        res_cen = self.client.get(f'/api/centros-trabajo/{self.centro_a.id}/')
        self.assertEqual(res_cen.status_code, status.HTTP_404_NOT_FOUND)

        res_tra = self.client.get(f'/api/trabajadores/{self.trabajador_a.id}/')
        self.assertEqual(res_tra.status_code, status.HTTP_404_NOT_FOUND)

        # Modificación no autorizada
        res_patch = self.client.patch(f'/api/empresas/{self.empresa_a.id}/', {'razon_social': 'Ataque'})
        self.assertEqual(res_patch.status_code, status.HTTP_404_NOT_FOUND)

        res_patch_tra = self.client.patch(f'/api/trabajadores/{self.trabajador_a.id}/', {'cargo': 'Modificado'})
        self.assertEqual(res_patch_tra.status_code, status.HTTP_404_NOT_FOUND)

        # Eliminación no autorizada
        res_del = self.client.delete(f'/api/empresas/{self.empresa_a.id}/')
        self.assertEqual(res_del.status_code, status.HTTP_404_NOT_FOUND)

    def test_creacion_empresa_asigna_prevencionista_automaticamente(self):
        self.client.force_authenticate(user=self.user_b)
        payload = {
            'razon_social': 'Minera del Sur SpA',
            'rut': '77.890.123-4',
            'mutualidad': 'MUTUAL',
            'tasa_cotizacion_adicional': 2.30
        }
        res = self.client.post('/api/empresas/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['prevencionista'], self.user_b.id)
        
        empresa_creada = Empresa.objects.get(id=res.data['id'])
        self.assertEqual(empresa_creada.prevencionista, self.user_b)

    def test_prevencion_vinculacion_cruzada_al_crear(self):
        # Usuario B intenta asociar un Centro o Trabajador a una Empresa ajena
        self.client.force_authenticate(user=self.user_b)

        payload_centro = {
            'empresa': self.empresa_a.id,
            'nombre': 'Faena Intrusión',
            'direccion': 'Calle Falsa 123'
        }
        res_cen = self.client.post('/api/centros-trabajo/', payload_centro, format='json')
        self.assertEqual(res_cen.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('empresa', res_cen.data)

        payload_trabajador = {
            'empresa': self.empresa_a.id,
            'rut': '15.456.789-5',
            'nombres': 'Pedro',
            'apellidos': 'Gómez',
            'cargo': 'Maestro'
        }
        res_tra = self.client.post('/api/trabajadores/', payload_trabajador, format='json')
        self.assertEqual(res_tra.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('empresa', res_tra.data)

    def test_validacion_rut_modulo_11(self):
        self.client.force_authenticate(user=self.user_a)
        # RUT con dígito verificador erróneo
        payload_invalido = {
            'razon_social': 'Empresa RUT Incorrecto',
            'rut': '76.123.456-9',  # Esperado es 0
            'mutualidad': 'ACHS'
        }
        res = self.client.post('/api/empresas/', payload_invalido, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rut', res.data)


class LeyKarinComplianceTestCase(APITestCase):
    """
    Casos de prueba para verificar el cumplimiento estricto de la Ley N° 21.643 (Ley Karin):
    1. Gestión automática y precisa del plazo legal de 72 horas para derivación a la DT y cálculo de semáforo.
    2. Aislamiento multi-tenant de las denuncias confidenciales por prevencionista / empresa.
    3. Trazabilidad e inmutabilidad: generación obligatoria de AuditLogAccesoDenuncia en cada retrieve (apertura).
    4. Registro de Medidas de Resguardo Inmediatas y Derivación a la DT.
    5. Canal público QR: envío guiado de denuncias formales y sugerencias abiertas.
    """
    def setUp(self):
        cache.clear()
        self.user_a = Usuario.objects.create_user(
            username="prevencionista_karin_a",
            email="karina@prevencion.cl",
            password="Password123!",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.user_b = Usuario.objects.create_user(
            username="prevencionista_karin_b",
            email="karinb@prevencion.cl",
            password="Password123!",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )

        self.empresa_a = Empresa.objects.create(
            prevencionista=self.user_a,
            razon_social="Empresa Alpha SpA",
            rut="76.123.456-0"
        )
        self.centro_a = CentroTrabajo.objects.create(
            empresa=self.empresa_a,
            nombre="Planta Norte",
            direccion="Av. Central 500"
        )

        self.empresa_b = Empresa.objects.create(
            prevencionista=self.user_b,
            razon_social="Empresa Beta SpA",
            rut="77.890.123-4"
        )

        self.denuncia_a = DenunciaLeyKarin.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            tipo_afectacion=DenunciaLeyKarin.TIPO_ACOSO_LABORAL,
            rut_denunciante="12.345.678-5",
            nombre_denunciante="María Soto",
            correo_denunciante="msoto@alpha.cl",
            nombre_denunciado="Carlos Gómez",
            descripcion_circunstanciada="Hostigamiento reiterado en reuniones."
        )

    def test_plazo_72_horas_y_semaforo(self):
        """Valida que al crear una denuncia se calculen 3 días hábiles administrativos (Art. 211-C CT) y el semáforo sea VERDE inicialmente."""
        self.assertIsNotNone(self.denuncia_a.plazo_limite_derivacion_dt)
        self.assertGreater(self.denuncia_a.plazo_limite_derivacion_dt, self.denuncia_a.fecha_hora_ingreso)
        self.assertLess(self.denuncia_a.plazo_limite_derivacion_dt.weekday(), 5)
        self.assertEqual(self.denuncia_a.plazo_limite_derivacion_dt.hour, 23)
        self.assertEqual(self.denuncia_a.plazo_limite_derivacion_dt.minute, 59)
        self.assertEqual(self.denuncia_a.semaforo, 'VERDE')

        # Si modificamos el plazo para que queden 10 horas -> debe pasar a ROJO
        self.denuncia_a.plazo_limite_derivacion_dt = timezone.now() + timedelta(hours=10)
        self.denuncia_a.save()
        self.assertEqual(self.denuncia_a.semaforo, 'ROJO')

        # Si se marca como derivada a la DT -> semaforo debe ser DERIVADA
        self.denuncia_a.derivada_inspeccion_trabajo = True
        self.denuncia_a.save()
        self.assertEqual(self.denuncia_a.semaforo, 'DERIVADA')

    def test_aislamiento_multitenant_denuncias(self):
        """Usuario B no puede listar ni ver las denuncias confidenciales de Empresa A."""
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get('/api/denuncias-ley-karin/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(items), 0)

        # Acceso directo por ID prohibido (404)
        res_det = self.client.get(f'/api/denuncias-ley-karin/{self.denuncia_a.id}/')
        self.assertEqual(res_det.status_code, status.HTTP_404_NOT_FOUND)

    def test_auditoria_inmutable_al_consultar_detalle(self):
        """Cada retrieve genera un registro en AuditLogAccesoDenuncia."""
        self.assertEqual(AuditLogAccesoDenuncia.objects.filter(denuncia=self.denuncia_a).count(), 0)

        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(f'/api/denuncias-ley-karin/{self.denuncia_a.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        logs = AuditLogAccesoDenuncia.objects.filter(denuncia=self.denuncia_a)
        self.assertEqual(logs.count(), 1)
        first_log = logs.first()
        self.assertIsNotNone(first_log)
        assert first_log is not None
        self.assertEqual(first_log.usuario, self.user_a)
        self.assertEqual(first_log.accion, AuditLogAccesoDenuncia.ACCION_APERTURA)

    def test_registro_medidas_resguardo_y_derivacion_dt(self):
        """Permite registrar medidas cautelares y folio de derivación DT con auditoría."""
        self.client.force_authenticate(user=self.user_a)

        # 1. Registrar medidas de resguardo
        res_med = self.client.post(
            f'/api/denuncias-ley-karin/{self.denuncia_a.id}/registrar-medidas/',
            {'medidas_resguardo_detalle': 'Separación física de turnos y puestos de trabajo.'},
            format='json'
        )
        self.assertEqual(res_med.status_code, status.HTTP_200_OK)
        self.denuncia_a.refresh_from_db()
        self.assertEqual(self.denuncia_a.estado_tramite, DenunciaLeyKarin.ESTADO_MEDIDAS_RESGUARDO)
        self.assertIsNotNone(self.denuncia_a.medidas_resguardo_detalle)
        self.assertIn('Separación física', self.denuncia_a.medidas_resguardo_detalle or '')

        # 2. Derivar a DT
        res_dt = self.client.post(
            f'/api/denuncias-ley-karin/{self.denuncia_a.id}/derivar-dt/',
            {'folio_dt': 'DT-2026-98765'},
            format='json'
        )
        self.assertEqual(res_dt.status_code, status.HTTP_200_OK)
        self.denuncia_a.refresh_from_db()
        self.assertTrue(self.denuncia_a.derivada_inspeccion_trabajo)
        self.assertEqual(self.denuncia_a.folio_dt, 'DT-2026-98765')
        self.assertEqual(self.denuncia_a.estado_tramite, DenunciaLeyKarin.ESTADO_DERIVADA_DT)

    def test_portal_publico_qr_denuncia_karin(self):
        """Trabajador anónimo/externo envía una denuncia formal Ley Karin vía QR."""
        self.client.credentials()  # Anónimo
        payload = {
            'tipo_canal': 'DENUNCIA_KARIN',
            'empresa': self.empresa_a.id,
            'centro_trabajo': self.centro_a.id,
            'tipo_afectacion': 'ACOSO_SEXUAL',
            'rut_denunciante': '15.456.789-5',
            'nombre_denunciante': 'Ana Morales',
            'correo_denunciante': 'amorales@trabajadores.cl',
            'telefono_denunciante': '+56987654321',
            'nombre_denunciado': 'Jefe de Turno',
            'cargo_area_denunciado': 'Operaciones',
            'descripcion_circunstanciada': 'Comentarios inapropiados reiterados.',
            'testigos_o_evidencias': 'Compañeros de cuadrilla presentes.'
        }
        url = reverse('buzon_publico', kwargs={'prevencionista_uuid': str(self.user_a.uuid)})
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['tipo'], 'DENUNCIA_KARIN')

        denuncia_creada = DenunciaLeyKarin.objects.get(uuid=res.data['uuid'])
        self.assertEqual(denuncia_creada.empresa, self.empresa_a)
        self.assertEqual(denuncia_creada.nombre_denunciante, 'Ana Morales')
        self.assertIn('codigo_seguimiento', res.data)
        self.assertEqual(res.data['codigo_seguimiento'], denuncia_creada.codigo_seguimiento)

        # Caso: Sin empresa -> 400 Bad Request
        payload_sin_emp = payload.copy()
        del payload_sin_emp['empresa']
        res_sin_emp = self.client.post(url, payload_sin_emp, format='json')
        self.assertEqual(res_sin_emp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Debe seleccionar obligatoriamente la empresa a la cual pertenece la denuncia o sugerencia.", res_sin_emp.data.get('error', ''))

    def test_enmascaramiento_lista_y_bloqueo_delete(self):
        """P0.1: El endpoint de listado enmascara la identidad y hechos. El método DELETE está bloqueado (405)."""
        self.client.force_authenticate(user=self.user_a)

        # 1. Listado enmascarado
        res_list = self.client.get('/api/denuncias-ley-karin/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        items = res_list.data if isinstance(res_list.data, list) else res_list.data.get('results', [])
        self.assertGreater(len(items), 0)
        item = items[0]
        # Debe contener código de seguimiento y semáforo
        self.assertIn('codigo_seguimiento', item)
        self.assertTrue(item['codigo_seguimiento'].startswith('KARIN-'))
        # NO debe exponer datos sensibles en el listado
        self.assertNotIn('rut_denunciante', item)
        self.assertNotIn('nombre_denunciante', item)
        self.assertNotIn('descripcion_circunstanciada', item)

        # 2. Bloqueo total de DELETE
        res_del = self.client.delete(f'/api/denuncias-ley-karin/{self.denuncia_a.id}/')
        self.assertEqual(res_del.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(DenunciaLeyKarin.objects.filter(id=self.denuncia_a.id).exists())

    def test_derivacion_mutualidad_5_dias_anexo_67(self):
        """P0.3: Derivación a la mutualidad dentro de 5 días hábiles, folio y atención psicológica."""
        self.client.force_authenticate(user=self.user_a)

        # Verifica cálculo automático de 5 días hábiles en modelo
        self.assertIsNotNone(self.denuncia_a.plazo_limite_informe_mutualidad_5d)

        res_mut = self.client.post(
            f'/api/denuncias-ley-karin/{self.denuncia_a.id}/derivar-mutualidad/',
            {
                'folio_mutualidad': 'ACHS-MUT-2026-99',
                'atencion_psicologica_ofrecida': True
            },
            format='json'
        )
        self.assertEqual(res_mut.status_code, status.HTTP_200_OK)
        self.denuncia_a.refresh_from_db()
        self.assertTrue(self.denuncia_a.derivada_mutualidad)
        self.assertEqual(self.denuncia_a.folio_mutualidad, 'ACHS-MUT-2026-99')
        self.assertTrue(self.denuncia_a.atencion_psicologica_ofrecida)
        self.assertIsNotNone(self.denuncia_a.fecha_ofrecimiento_psicologico)

        # Verifica log inmutable de derivación a mutualidad
        self.assertTrue(
            AuditLogAccesoDenuncia.objects.filter(
                denuncia=self.denuncia_a,
                accion="DERIVACION_MUTUALIDAD_ANEXO67"
            ).exists()
        )


class AccidentesComplianceTestCase(APITestCase):
    """
    Casos de prueba para el módulo de Investigación de Accidentes y cumplimiento legal:
    - Tramitación DIAT en plazo legal perentorio de 24 horas (D.S. 44 / Ley 16.744)
    - Protocolo de Accidente Grave o Fatal (Art. 76 Ley 16.744 / Circular 3336 SUSESO)
    - Estadísticas de siniestralidad (Tasa de Frecuencia IF y Tasa de Gravedad IG - NCh 436)
    - Aislamiento multi-tenant en estadísticas y expedientes
    """
    client: Any

    def setUp(self):
        self.plan = Plan.objects.create(
            nombre="Plan Compliance",
            codigo="plan-compliance",
            precio=15000.00,
            limite_semanal=10,
            asientos=5
        )
        # Prevencionista A
        self.user_a = Usuario.objects.create_user(
            username="prev_acc_a",
            email="prev_a@compliance.cl",
            password="password123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        Suscripcion.objects.create(
            usuario=self.user_a,
            plan=self.plan,
            estado=Suscripcion.ESTADO_ACTIVA,
            fecha_inicio=timezone.now()
        )
        self.empresa_a = Empresa.objects.create(
            prevencionista=self.user_a,
            razon_social="Constructora Norte SpA",
            rut="76.111.222-3"
        )
        self.trabajador_a = Trabajador.objects.create(
            empresa=self.empresa_a,
            rut="14.333.444-5",
            nombres="Carlos",
            apellidos="Méndez",
            cargo="Enfierrador"
        )

        # Prevencionista B (tenant aislado)
        self.user_b = Usuario.objects.create_user(
            username="prev_acc_b",
            email="prev_b@compliance.cl",
            password="password123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        Suscripcion.objects.create(
            usuario=self.user_b,
            plan=self.plan,
            estado=Suscripcion.ESTADO_ACTIVA,
            fecha_inicio=timezone.now()
        )
        self.empresa_b = Empresa.objects.create(
            prevencionista=self.user_b,
            razon_social="Minera Sur S.A.",
            rut="77.444.555-6"
        )

        # Token para usuario A
        resp_a = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prev_acc_a',
            'password': 'password123'
        })
        self.token_a = resp_a.data['access']
        self.headers_a = {'HTTP_AUTHORIZATION': f'Bearer {self.token_a}'}

    def test_calculo_plazo_24h_diat_y_helpers(self):
        """Valida que el plazo de 24h para DIAT se autocalcule y los helpers reflejen el estado correcto."""
        ahora = timezone.now()

        # 1. Accidente recién ocurrido: en plazo legal
        acc_reciente = InvestigacionAccidente.objects.create(
            usuario=self.user_a,
            empresa=self.empresa_a,
            trabajador=self.trabajador_a,
            nombre_afectado=self.trabajador_a.nombre_completo,
            rut_afectado=self.trabajador_a.rut,
            cargo_afectado=self.trabajador_a.cargo,
            edad_afectado=35,
            antiguedad_afectado="2 años",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=ahora,
            lugar_evento="Piso 4 - Obra Central",
            descripcion_evento="Caída al mismo nivel tropezando con cable.",
            tipo_lesion="Esguince tobillo derecho",
            parte_cuerpo_afectada="Tobillo"
        )

        # Plazo debe ser fecha_hora_evento + 24 horas
        self.assertIsNotNone(acc_reciente.plazo_limite_diat_24h)
        expected_deadline = ahora + timedelta(hours=24)
        self.assertAlmostEqual(
            acc_reciente.plazo_limite_diat_24h.timestamp(),
            expected_deadline.timestamp(),
            delta=5
        )
        self.assertGreater(acc_reciente.horas_restantes_diat, 0)
        self.assertFalse(acc_reciente.diat_vencida)
        self.assertEqual(acc_reciente.semaforo_diat, 'EN_PLAZO')

        # 2. Accidente ocurrido hace más de 24 horas sin presentar DIAT
        acc_vencido = InvestigacionAccidente.objects.create(
            usuario=self.user_a,
            empresa=self.empresa_a,
            trabajador=self.trabajador_a,
            nombre_afectado="Pedro Soto",
            rut_afectado="15.222.333-4",
            cargo_afectado="Ayudante",
            edad_afectado=28,
            antiguedad_afectado="6 meses",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=ahora - timedelta(hours=26),
            lugar_evento="Bodega",
            descripcion_evento="Corte menor en dedo índice.",
            tipo_lesion="Herida cortante",
            parte_cuerpo_afectada="Mano",
            diat_presentada=False
        )
        self.assertTrue(acc_vencido.diat_vencida)
        self.assertEqual(acc_vencido.semaforo_diat, 'VENCIDA')

        # 3. Formalizar la DIAT -> el semáforo pasa a PRESENTADA y diat_vencida es False
        acc_vencido.diat_presentada = True
        acc_vencido.diat_folio = "ACHS-998877"
        acc_vencido.diat_fecha_presentacion = ahora
        acc_vencido.save()
        self.assertFalse(acc_vencido.diat_vencida)
        self.assertEqual(acc_vencido.semaforo_diat, 'PRESENTADA')

    def test_endpoint_registrar_diat(self):
        """Valida la acción @action registrar-diat para asentar folio y fecha formal."""
        acc = InvestigacionAccidente.objects.create(
            usuario=self.user_a,
            empresa=self.empresa_a,
            nombre_afectado="Luis Lagos",
            rut_afectado="16.555.666-7",
            cargo_afectado="Operador Grúa",
            edad_afectado=40,
            antiguedad_afectado="3 años",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=timezone.now(),
            lugar_evento="Patio de Acopio",
            descripcion_evento="Golpe contra poste de señalización.",
            tipo_lesion="Contusión en hombro",
            parte_cuerpo_afectada="Hombro izquierdo"
        )
        url = f"/api/accidentes/{acc.id}/registrar-diat/"

        # Sin folio -> 400
        res_fail = self.client.post(url, {}, format='json', **self.headers_a)
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Con folio exitoso
        payload = {'diat_folio': 'MUTUAL-2026-445566'}
        res_ok = self.client.post(url, payload, format='json', **self.headers_a)
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(res_ok.data['diat_presentada'])
        self.assertEqual(res_ok.data['diat_folio'], 'MUTUAL-2026-445566')
        self.assertEqual(res_ok.data['semaforo_diat'], 'PRESENTADA')

        acc.refresh_from_db()
        self.assertTrue(acc.diat_presentada)
        self.assertEqual(acc.diat_folio, 'MUTUAL-2026-445566')
        self.assertIsNotNone(acc.diat_fecha_presentacion)

    def test_endpoint_protocolo_grave_fatal(self):
        """Valida la acción @action protocolo-grave-fatal para asentar auto-suspensión y aviso a autoridades."""
        acc = InvestigacionAccidente.objects.create(
            usuario=self.user_a,
            empresa=self.empresa_a,
            nombre_afectado="Matías Vega",
            rut_afectado="17.888.999-0",
            cargo_afectado="Carpintero",
            edad_afectado=31,
            antiguedad_afectado="1 año",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=timezone.now(),
            lugar_evento="Andamio Piso 8",
            descripcion_evento="Caída libre desde andamio a 4 metros de altura.",
            tipo_lesion="Politraumatismo con fractura expuesta",
            parte_cuerpo_afectada="Pierna derecha",
            es_grave_o_fatal=True,
            tipo_accidente_grave='CAIDA_ALTURA'
        )
        url = f"/api/accidentes/{acc.id}/protocolo-grave-fatal/"

        payload = {
            'faena_suspendida': True,
            'aviso_autoridades_realizado': True,
            'aviso_autoridades_folio': 'NOTIF-DT-994411',
            'dias_perdidos': 45
        }
        res = self.client.post(url, payload, format='json', **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['faena_suspendida'])
        self.assertTrue(res.data['aviso_autoridades_realizado'])
        self.assertEqual(res.data['aviso_autoridades_folio'], 'NOTIF-DT-994411')
        self.assertEqual(res.data['dias_perdidos'], 45)

        acc.refresh_from_db()
        self.assertTrue(acc.faena_suspendida)
        self.assertTrue(acc.aviso_autoridades_realizado)
        self.assertEqual(acc.aviso_autoridades_folio, 'NOTIF-DT-994411')
        self.assertEqual(acc.dias_perdidos, 45)

    def test_estadisticas_indices_if_ig_y_aislamiento_multitenant(self):
        """
        Valida que el endpoint /api/accidentes/estadisticas/ calcule:
        - total_accidentes (eventos de trabajo)
        - total_dias_perdidos
        - tasa_frecuencia_if: (CTP * 1_000_000) / horas_trabajadas
        - tasa_gravedad_ig: (dias_perdidos * 1_000_000) / horas_trabajadas
        - graves_o_fatales_count
        - estricto aislamiento multi-tenant
        """
        ahora = timezone.now()

        # Accidente 1 del Prevencionista A: TRABAJO con 10 días perdidos
        InvestigacionAccidente.objects.create(
            usuario=self.user_a,
            empresa=self.empresa_a,
            nombre_afectado="Trabajador Uno",
            rut_afectado="11.111.111-1",
            cargo_afectado="Operario",
            edad_afectado=25,
            antiguedad_afectado="1 año",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=ahora,
            lugar_evento="Línea 1",
            descripcion_evento="Golpe en mano",
            tipo_lesion="Contusión",
            parte_cuerpo_afectada="Mano",
            dias_perdidos=10,
            es_grave_o_fatal=False
        )

        # Accidente 2 del Prevencionista A: TRABAJO grave con 20 días perdidos y faena suspendida
        InvestigacionAccidente.objects.create(
            usuario=self.user_a,
            empresa=self.empresa_a,
            nombre_afectado="Trabajador Dos",
            rut_afectado="22.222.222-2",
            cargo_afectado="Mecánico",
            edad_afectado=42,
            antiguedad_afectado="5 años",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=ahora,
            lugar_evento="Taller",
            descripcion_evento="Atrapamiento en polea",
            tipo_lesion="Amputación falange",
            parte_cuerpo_afectada="Dedo",
            dias_perdidos=20,
            es_grave_o_fatal=True,
            tipo_accidente_grave='AMPUTACION',
            faena_suspendida=True
        )

        # Accidente 3 del Prevencionista A: INCIDENTE sin días perdidos
        InvestigacionAccidente.objects.create(
            usuario=self.user_a,
            empresa=self.empresa_a,
            nombre_afectado="Trabajador Tres",
            rut_afectado="33.333.333-3",
            cargo_afectado="Supervisor",
            edad_afectado=38,
            antiguedad_afectado="3 años",
            tipo_evento=InvestigacionAccidente.TIPO_INCIDENTE,
            fecha_hora_evento=ahora,
            lugar_evento="Oficina Técnica",
            descripcion_evento="Caída de estante sin lesionados",
            tipo_lesion="Ninguna",
            parte_cuerpo_afectada="Ninguna",
            dias_perdidos=0
        )

        # Accidente de Prevencionista B (tenant ajeno): 100 días perdidos
        InvestigacionAccidente.objects.create(
            usuario=self.user_b,
            empresa=self.empresa_b,
            nombre_afectado="Trabajador B",
            rut_afectado="99.999.999-9",
            cargo_afectado="Minero",
            edad_afectado=45,
            antiguedad_afectado="10 años",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=ahora,
            lugar_evento="Socavón Mina B",
            descripcion_evento="Derrumbe",
            tipo_lesion="Fractura múltiple",
            parte_cuerpo_afectada="Piernas",
            dias_perdidos=100
        )

        # Consultar estadísticas con 1.000.000 de horas trabajadas para facilitar verificación
        url = "/api/accidentes/estadisticas/?horas_trabajadas=1000000"
        res = self.client.get(url, **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        # Solo eventos de trabajo de usuario A (2)
        self.assertEqual(data['total_accidentes'], 2)
        # Sumatoria de días perdidos de usuario A (10 + 20 = 30) - NO incluye los 100 de B
        self.assertEqual(data['total_dias_perdidos'], 30)
        self.assertEqual(data['accidentes_con_tiempo_perdido'], 2)
        # IF = (2 * 1_000_000) / 1_000_000 = 2.0
        self.assertEqual(data['tasa_frecuencia_if'], 2.0)
        # IG = (30 * 1_000_000) / 1_000_000 = 30.0
        self.assertEqual(data['tasa_gravedad_ig'], 30.0)
        # Graves o fatales con auto-suspensión (1)
        self.assertEqual(data['graves_o_fatales_count'], 1)
        # Total eventos de usuario A (2 trabajo + 1 incidente = 3)
        self.assertEqual(data['total_eventos'], 3)

    def test_inmutabilidad_accidente_delete_bloqueado(self):
        """Circular SUSESO 3336 y Art. 76 Ley 16.744: DELETE está bloqueado (405)."""
        acc = InvestigacionAccidente.objects.create(
            usuario=self.user_a,
            empresa=self.empresa_a,
            nombre_afectado="Trabajador Inmutable",
            rut_afectado="11.222.333-4",
            edad_afectado=30,
            antiguedad_afectado="1 año",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=timezone.now(),
            lugar_evento="Taller",
            descripcion_evento="Golpe en mano con herramienta manual",
            tipo_lesion="Contusión leve",
            parte_cuerpo_afectada="Mano"
        )
        res = self.client.delete(f"/api/accidentes/{acc.id}/", **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(InvestigacionAccidente.objects.filter(id=acc.id).exists())


class ComiteParitarioIntegrationTestCase(APITestCase):
    """
    Casos de prueba para verificar:
    1. Aislamiento Multi-Tenant estricto de Comités Paritarios, Miembros y Actas.
    2. Auto-cálculo de 2 años de mandato (730 días) según D.S. 44.
    3. Cómputo de días restantes y actualización de estados.
    4. Estadísticas anuales (meta 12 sesiones, acuerdos cumplidos vs pendientes).
    5. Cambio de estado de acuerdos en actas.
    """
    client: Any

    def setUp(self):
        cache.clear()
        self.plan = Plan.objects.create(
            nombre="Plan Test CPHS",
            codigo="plan-test-cphs",
            precio=15000.00,
            limite_semanal=20,
            asientos=5
        )

        # Usuario Prevencionista A
        self.user_a = Usuario.objects.create_user(
            username="prevencionista_cphs_a",
            email="prev_cphs_a@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.empresa_a = Empresa.objects.create(
            prevencionista=self.user_a,
            razon_social="Constructora Andina SpA",
            rut="76.123.456-7"
        )
        self.centro_a = CentroTrabajo.objects.create(
            empresa=self.empresa_a,
            nombre="Faena Edificio Central",
            direccion="Av. Los Leones 1234"
        )

        res_a = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prevencionista_cphs_a',
            'password': 'securepassword123'
        })
        self.token_a = res_a.data['access']
        self.headers_a = {'HTTP_AUTHORIZATION': f'Bearer {self.token_a}'}

        # Usuario Prevencionista B (Tenant ajeno)
        self.user_b = Usuario.objects.create_user(
            username="prevencionista_cphs_b",
            email="prev_cphs_b@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.empresa_b = Empresa.objects.create(
            prevencionista=self.user_b,
            razon_social="Minera del Norte S.A.",
            rut="77.987.654-3"
        )

        res_b = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prevencionista_cphs_b',
            'password': 'securepassword123'
        })
        self.token_b = res_b.data['access']
        self.headers_b = {'HTTP_AUTHORIZATION': f'Bearer {self.token_b}'}

    def test_calculo_vigencia_dos_anos_mandato(self):
        """Verifica que al guardar un CPHS sin fecha_vencimiento_mandato, se calculan 730 días."""
        hoy = timezone.localdate()
        comite = ComiteParitario.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            nombre="CPHS Faena Central",
            fecha_constitucion=hoy
        )
        self.assertEqual(comite.fecha_vencimiento_mandato, hoy + timedelta(days=730))
        self.assertEqual(comite.dias_restantes_mandato, 730)
        self.assertEqual(comite.estado, ComiteParitario.ESTADO_VIGENTE)

    def test_cambio_estado_segun_dias_restantes(self):
        """Verifica que si quedan <= 60 días pasa a POR_VENCER, y si vence pasa a VENCIDO."""
        hoy = timezone.localdate()
        # Caso por vencer
        comite_por_vencer = ComiteParitario.objects.create(
            empresa=self.empresa_a,
            nombre="CPHS Por Vencer",
            fecha_constitucion=hoy - timedelta(days=700),
            fecha_vencimiento_mandato=hoy + timedelta(days=30)
        )
        self.assertEqual(comite_por_vencer.estado, ComiteParitario.ESTADO_POR_VENCER)

        # Caso vencido
        comite_vencido = ComiteParitario.objects.create(
            empresa=self.empresa_a,
            nombre="CPHS Vencido",
            fecha_constitucion=hoy - timedelta(days=800),
            fecha_vencimiento_mandato=hoy - timedelta(days=70)
        )
        self.assertEqual(comite_vencido.estado, ComiteParitario.ESTADO_VENCIDO)

    def test_aislamiento_multitenant_estricto(self):
        """Verifica que Prevencionista B no pueda ver comités ni actas de Prevencionista A."""
        hoy = timezone.localdate()
        comite_a = ComiteParitario.objects.create(
            empresa=self.empresa_a,
            nombre="CPHS Privado Tenant A",
            fecha_constitucion=hoy
        )
        MiembroCPHS.objects.create(
            comite=comite_a,
            nombre="Juan Perez",
            rut="12.345.678-5",
            estamento=MiembroCPHS.ESTAMENTO_EMPRESA,
            tipo_representacion=MiembroCPHS.REPRESENTACION_TITULAR,
            cargo=MiembroCPHS.CARGO_PRESIDENTE
        )
        acta_a = ActaSesionCPHS.objects.create(
            comite=comite_a,
            numero_acta=1,
            tipo_sesion=ActaSesionCPHS.TIPO_ORDINARIA,
            fecha_hora_sesion=timezone.now(),
            lugar="Sala de Reuniones",
            tabla_temas="Constitución",
            acuerdos=[{"acuerdo": "Revisar extintores", "responsable": "Juan", "plazo": "2026-11-01", "cumplido": False}]
        )

        # Usuario A ve su comité
        res_a = self.client.get("/api/comites-paritarios/", **self.headers_a)
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        results_a = res_a.data.get('results', res_a.data) if isinstance(res_a.data, dict) else res_a.data
        self.assertEqual(len(results_a), 1)

        # Usuario B no ve el comité de A
        res_b = self.client.get("/api/comites-paritarios/", **self.headers_b)
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        results_b = res_b.data.get('results', res_b.data) if isinstance(res_b.data, dict) else res_b.data
        self.assertEqual(len(results_b), 0)

        # Usuario B no puede ver el acta de A
        res_acta_b = self.client.get(f"/api/actas-cphs/{acta_a.id}/", **self.headers_b)
        self.assertEqual(res_acta_b.status_code, status.HTTP_404_NOT_FOUND)

        # Usuario B no puede crear actas en el comité de A
        res_post_b = self.client.post("/api/actas-cphs/", {
            "comite": comite_a.id,
            "tipo_sesion": "ORDINARIA",
            "fecha_hora_sesion": timezone.now().isoformat(),
            "lugar": "Infiltrado",
            "tabla_temas": "Intrusión"
        }, format='json', **self.headers_b)
        self.assertEqual(res_post_b.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bloqueo_acta_sin_quorum_legal(self):
        """P0.4: Impide registrar o sesionar actas si falta al menos 1 representante patronal o 1 laboral (Art. 40 D.S. 44)."""
        comite = ComiteParitario.objects.create(
            empresa=self.empresa_a,
            nombre="CPHS Quorum Test",
            fecha_constitucion=timezone.localdate()
        )
        MiembroCPHS.objects.create(
            comite=comite,
            nombre="Carlos Patronal",
            rut="11.222.333-4",
            estamento=MiembroCPHS.ESTAMENTO_EMPRESA,
            tipo_representacion=MiembroCPHS.REPRESENTACION_TITULAR,
            cargo=MiembroCPHS.CARGO_PRESIDENTE
        )
        MiembroCPHS.objects.create(
            comite=comite,
            nombre="Lucia Laboral",
            rut="12.333.444-5",
            estamento=MiembroCPHS.ESTAMENTO_TRABAJADORES,
            tipo_representacion=MiembroCPHS.REPRESENTACION_TITULAR,
            cargo=MiembroCPHS.CARGO_SECRETARIO
        )

        # Intento 1: Solo patronal (sin representación laboral) -> Debe fallar 400
        res_fail1 = self.client.post("/api/actas-cphs/", {
            "comite": comite.id,
            "numero_acta": 1,
            "tipo_sesion": "ORDINARIA",
            "fecha_hora_sesion": timezone.now().isoformat(),
            "lugar": "Sala A",
            "asistentes": ["Carlos Patronal (Presidente - Empresa)"],
            "tabla_temas": "Revisión mensual"
        }, format='json', **self.headers_a)
        self.assertEqual(res_fail1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("quorum", res_fail1.data)

        # Intento 2: Con quorum válido (1 patronal + 1 laboral) -> Debe aprobar 201
        res_ok = self.client.post("/api/actas-cphs/", {
            "comite": comite.id,
            "numero_acta": 1,
            "tipo_sesion": "ORDINARIA",
            "fecha_hora_sesion": timezone.now().isoformat(),
            "lugar": "Sala A",
            "asistentes": [
                "Carlos Patronal (Presidente - Empresa)",
                "Lucia Laboral (Secretario - Trabajadores)"
            ],
            "tabla_temas": "Revisión mensual y acuerdos"
        }, format='json', **self.headers_a)
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)

    def test_estadisticas_cphs(self):
        """Verifica el cálculo de estadísticas legales de 12 sesiones y acuerdos cumplidos."""
        hoy = timezone.localdate()
        comite = ComiteParitario.objects.create(
            empresa=self.empresa_a,
            nombre="CPHS Estadísticas",
            fecha_constitucion=hoy
        )
        # Crear 2 actas ordinarias con acuerdos
        ActaSesionCPHS.objects.create(
            comite=comite,
            numero_acta=1,
            tipo_sesion=ActaSesionCPHS.TIPO_ORDINARIA,
            fecha_hora_sesion=timezone.now(),
            lugar="Sala A",
            tabla_temas="Tema 1",
            acuerdos=[
                {"acuerdo": "A1", "responsable": "R1", "plazo": "2026-11-01", "cumplido": True},
                {"acuerdo": "A2", "responsable": "R2", "plazo": "2026-11-02", "cumplido": False}
            ]
        )
        ActaSesionCPHS.objects.create(
            comite=comite,
            numero_acta=2,
            tipo_sesion=ActaSesionCPHS.TIPO_ORDINARIA,
            fecha_hora_sesion=timezone.now(),
            lugar="Sala A",
            tabla_temas="Tema 2",
            acuerdos=[
                {"acuerdo": "A3", "responsable": "R3", "plazo": "2026-11-03", "cumplido": True}
            ]
        )

        res = self.client.get(f"/api/comites-paritarios/{comite.id}/estadisticas/", **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data['sesiones_ordinarias_ano'], 2)
        self.assertEqual(data['meta_legal_anual'], 12)
        self.assertEqual(data['total_acuerdos'], 3)
        self.assertEqual(data['acuerdos_cumplidos'], 2)
        self.assertEqual(data['acuerdos_pendientes'], 1)
        self.assertEqual(data['tasa_cumplimiento_acuerdos'], 66.7)

    def test_cambiar_estado_acuerdo_acta(self):
        """Verifica la acción para cambiar el estado de un acuerdo de pendiente a cumplido."""
        comite = ComiteParitario.objects.create(
            empresa=self.empresa_a,
            nombre="CPHS Acuerdos",
            fecha_constitucion=timezone.localdate()
        )
        acta = ActaSesionCPHS.objects.create(
            comite=comite,
            numero_acta=1,
            tipo_sesion=ActaSesionCPHS.TIPO_ORDINARIA,
            fecha_hora_sesion=timezone.now(),
            lugar="Oficina",
            tabla_temas="Puntos Varios",
            acuerdos=[
                {"acuerdo": "Instalar barandas", "responsable": "Jefe Obra", "plazo": "2026-10-20", "cumplido": False}
            ]
        )

        # Marcar acuerdo índice 0 como cumplido
        res = self.client.patch(
            f"/api/actas-cphs/{acta.id}/cambiar-estado-acuerdo/",
            {"indice_acuerdo": 0, "cumplido": True},
            format='json',
            **self.headers_a
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        acta.refresh_from_db()
        self.assertTrue(acta.acuerdos[0]['cumplido'])
        self.assertIn('fecha_cumplimiento', acta.acuerdos[0])


class EntregaEPPTestCase(APITestCase):
    """
    Casos de prueba para verificar:
    1. Aislamiento Multi-Tenant estricto en el registro e historial de entregas de EPP.
    2. Guardado íntegro de la firma digital Base64 e IP del firmante.
    3. Estadísticas preventivas (entregas del mes, trabajadores con RIOHS).
    4. Historial por trabajador individual.
    """
    client: Any

    def setUp(self):
        cache.clear()
        self.plan = Plan.objects.create(
            nombre="Plan Test EPP",
            codigo="plan-test-epp",
            precio=12000.00,
            limite_semanal=20,
            asientos=5
        )

        # Usuario Prevencionista A
        self.user_a = Usuario.objects.create_user(
            username="prevencionista_epp_a",
            email="prev_epp_a@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.empresa_a = Empresa.objects.create(
            prevencionista=self.user_a,
            razon_social="Constructora Fortaleza S.A.",
            rut="76.543.210-K"
        )
        self.centro_a = CentroTrabajo.objects.create(
            empresa=self.empresa_a,
            nombre="Obra Costanera",
            direccion="Av. Andrés Bello 2000"
        )
        self.trabajador_a1 = Trabajador.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            nombres="Pedro",
            apellidos="González",
            rut="15.678.901-2",
            cargo="Enfierrador"
        )
        self.trabajador_a2 = Trabajador.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            nombres="Esteban",
            apellidos="Muñoz",
            rut="16.789.012-3",
            cargo="Carpintero"
        )

        res_a = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prevencionista_epp_a',
            'password': 'securepassword123'
        })
        self.token_a = res_a.data['access']
        self.headers_a = {'HTTP_AUTHORIZATION': f'Bearer {self.token_a}'}

        # Usuario Prevencionista B (Tenant ajeno)
        self.user_b = Usuario.objects.create_user(
            username="prevencionista_epp_b",
            email="prev_epp_b@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.empresa_b = Empresa.objects.create(
            prevencionista=self.user_b,
            razon_social="Agrícola del Valle Ltda.",
            rut="77.111.222-3"
        )
        self.trabajador_b = Trabajador.objects.create(
            empresa=self.empresa_b,
            nombres="Rodrigo",
            apellidos="Silva",
            rut="17.890.123-4",
            cargo="Operador Maquinaria"
        )

        res_b = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prevencionista_epp_b',
            'password': 'securepassword123'
        })
        self.token_b = res_b.data['access']
        self.headers_b = {'HTTP_AUTHORIZATION': f'Bearer {self.token_b}'}

    def test_creacion_entrega_con_firma_digital(self):
        """Verifica la creación exitosa con firma en Base64, captura de IP y asignación de responsable."""
        firma_mock = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        payload = {
            "empresa": self.empresa_a.id,
            "centro_trabajo": self.centro_a.id,
            "trabajador": self.trabajador_a1.id,
            "items_epp": [
                {
                    "tipo": "Casco de seguridad (NCh 461)",
                    "marca_modelo": "MSA V-Gard",
                    "certificacion": "CESMEC",
                    "cantidad": 1,
                    "motivo": "ENTREGA_INICIAL"
                },
                {
                    "tipo": "Calzado de seguridad (NCh 772)",
                    "marca_modelo": "Norseg Energy",
                    "talla": "42",
                    "cantidad": 1,
                    "motivo": "ENTREGA_INICIAL"
                }
            ],
            "entrega_riohs": True,
            "version_riohs": "Versión 2026.1",
            "declaracion_capacitacion": True,
            "firma_digital": firma_mock
        }

        res = self.client.post("/api/entregas-epp/", payload, format='json', **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data

        self.assertEqual(data['trabajador'], self.trabajador_a1.id)
        self.assertEqual(data['responsable_entrega'], self.user_a.id)
        self.assertEqual(data['total_items'], 2)
        self.assertTrue(data['entrega_riohs'])
        self.assertEqual(data['firma_digital'], firma_mock)
        self.assertIsNotNone(data['ip_registro'])

        entrega = EntregaEPP.objects.get(id=data['id'])
        self.assertEqual(entrega.responsable_entrega, self.user_a)
        self.assertEqual(len(entrega.items_epp), 2)

    def test_aislamiento_multitenant_entregas(self):
        """Prevencionista B no puede ver entregas de A ni registrar EPP a trabajadores de A."""
        firma_mock = "data:image/png;base64,mock"
        entrega_a = EntregaEPP.objects.create(
            empresa=self.empresa_a,
            trabajador=self.trabajador_a1,
            responsable_entrega=self.user_a,
            items_epp=[{"tipo": "Guantes", "cantidad": 2}],
            firma_digital=firma_mock
        )

        # Usuario B intenta listar -> debe recibir 0
        res_b = self.client.get("/api/entregas-epp/", **self.headers_b)
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        results_b = res_b.data.get('results', res_b.data) if isinstance(res_b.data, dict) else res_b.data
        self.assertEqual(len(results_b), 0)

        # Usuario B intenta ver el detalle de la entrega de A -> 404
        res_det_b = self.client.get(f"/api/entregas-epp/{entrega_a.id}/", **self.headers_b)
        self.assertEqual(res_det_b.status_code, status.HTTP_404_NOT_FOUND)

        # Usuario B intenta crear entrega asociando empresa o trabajador de A -> 400
        res_post_b = self.client.post("/api/entregas-epp/", {
            "empresa": self.empresa_a.id,
            "trabajador": self.trabajador_a1.id,
            "items_epp": [{"tipo": "Casco", "cantidad": 1}],
            "firma_digital": firma_mock
        }, format='json', **self.headers_b)
        self.assertEqual(res_post_b.status_code, status.HTTP_400_BAD_REQUEST)

    def test_estadisticas_y_cobertura_riohs(self):
        """Verifica conteo de entregas en el mes y cobertura de trabajadores con RIOHS firmado."""
        firma_mock = "data:image/png;base64,mock"
        # Entrega a Pedro con RIOHS
        EntregaEPP.objects.create(
            empresa=self.empresa_a,
            trabajador=self.trabajador_a1,
            responsable_entrega=self.user_a,
            items_epp=[{"tipo": "Casco", "cantidad": 1}],
            entrega_riohs=True,
            firma_digital=firma_mock
        )
        # Entrega a Esteban sin RIOHS
        EntregaEPP.objects.create(
            empresa=self.empresa_a,
            trabajador=self.trabajador_a2,
            responsable_entrega=self.user_a,
            items_epp=[{"tipo": "Lentes", "cantidad": 2}],
            entrega_riohs=False,
            firma_digital=firma_mock
        )

        res = self.client.get("/api/entregas-epp/estadisticas/", **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(data['entregas_mes'], 2)
        self.assertEqual(data['total_trabajadores'], 2)
        self.assertEqual(data['trabajadores_con_riohs'], 1)
        self.assertEqual(data['trabajadores_pendientes_riohs'], 1)
        self.assertEqual(data['porcentaje_cumplimiento_riohs'], 50.0)
        self.assertEqual(data['total_items_epp_entregados'], 3)

    def test_historial_por_trabajador(self):
        """Verifica endpoint de historial de EPP por trabajador."""
        firma_mock = "data:image/png;base64,mock"
        EntregaEPP.objects.create(
            empresa=self.empresa_a,
            trabajador=self.trabajador_a1,
            responsable_entrega=self.user_a,
            items_epp=[{"tipo": "Arnés de Seguridad", "cantidad": 1}],
            firma_digital=firma_mock
        )

        # Usuario A consulta historial de trabajador A1
        res = self.client.get(f"/api/entregas-epp/historial-trabajador/{self.trabajador_a1.id}/", **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['entregas']), 1)
        self.assertEqual(res.data['trabajador']['rut'], self.trabajador_a1.rut)

        # Usuario B intenta consultar historial de trabajador A1 -> 404
        res_b = self.client.get(f"/api/entregas-epp/historial-trabajador/{self.trabajador_a1.id}/", **self.headers_b)
        self.assertEqual(res_b.status_code, status.HTTP_404_NOT_FOUND)

    def test_inmutabilidad_entrega_epp_put_patch_delete_bloqueados(self):
        """Ley N° 19.799: PUT, PATCH y DELETE en entregas de EPP firmadas están bloqueados (405)."""
        firma_mock = "data:image/png;base64,iVBORw0KGgoAAAANS..."
        entrega = EntregaEPP.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            trabajador=self.trabajador_a1,
            responsable_entrega=self.user_a,
            items_epp=[{"tipo": "Casco", "cantidad": 1}],
            entrega_riohs=True,
            firma_digital=firma_mock
        )
        # Intentar PUT
        res_put = self.client.put(f"/api/entregas-epp/{entrega.id}/", {"items_epp": []}, format='json', **self.headers_a)
        self.assertEqual(res_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Intentar PATCH
        res_patch = self.client.patch(f"/api/entregas-epp/{entrega.id}/", {"entrega_riohs": False}, format='json', **self.headers_a)
        self.assertEqual(res_patch.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Intentar DELETE
        res_delete = self.client.delete(f"/api/entregas-epp/{entrega.id}/", **self.headers_a)
        self.assertEqual(res_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(EntregaEPP.objects.filter(id=entrega.id).exists())


class MatrizLegalIntegrationTestCase(APITestCase):
    """
    Casos de prueba para verificar el Módulo de Matriz Legal Automatizada por Rubro:
    - Precarga y consulta de RequisitoLegalBase.
    - Generación automática según rubro y condiciones de faena (Construcción, CPHS, Altura).
    - Recálculo dinámico de porcentaje de cumplimiento y estado de semáforo.
    - Aislamiento multi-tenant estricto entre empresas y prevencionistas.
    """
    client: Any

    def setUp(self):
        asegurar_requisitos_base()

        # Usuario Prevencionista A
        self.user_a = Usuario.objects.create_user(
            username="prevencionista_matriz_a",
            email="prev_matriz_a@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.empresa_a = Empresa.objects.create(
            prevencionista=self.user_a,
            razon_social="Constructora Aconcagua SpA",
            rut="76.123.456-7",
            mutualidad="ACHS",
            giro="Construcción de edificios completos"
        )
        self.centro_a = CentroTrabajo.objects.create(
            empresa=self.empresa_a,
            nombre="Edificio Mirador Norte",
            direccion="Av. Apoquindo 4500",
            comuna="Las Condes"
        )
        res_a = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prevencionista_matriz_a',
            'password': 'securepassword123'
        })
        self.token_a = res_a.data['access']
        self.headers_a = {'HTTP_AUTHORIZATION': f'Bearer {self.token_a}'}

        # Usuario Prevencionista B (Tenant ajeno)
        self.user_b = Usuario.objects.create_user(
            username="prevencionista_matriz_b",
            email="prev_matriz_b@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.empresa_b = Empresa.objects.create(
            prevencionista=self.user_b,
            razon_social="Minera Los Bronces Ltda.",
            rut="77.987.654-3",
            mutualidad="Mutual de Seguridad",
            giro="Extracción de cobre"
        )
        res_b = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prevencionista_matriz_b',
            'password': 'securepassword123'
        })
        self.token_b = res_b.data['access']
        self.headers_b = {'HTTP_AUTHORIZATION': f'Bearer {self.token_b}'}

    def test_catalogo_requisitos_base(self):
        """Verifica la consulta y filtrado del catálogo oficial de requisitos base."""
        res = self.client.get("/api/requisitos-legales-base/", **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 20)

        # Filtrar por rubro CONSTRUCCION (debe incluir transversales + construcción)
        res_const = self.client.get("/api/requisitos-legales-base/?rubro_aplicable=CONSTRUCCION", **self.headers_a)
        self.assertEqual(res_const.status_code, status.HTTP_200_OK)
        rubros = {item['rubro_aplicable'] for item in res_const.data}
        self.assertTrue(rubros.issubset({'CONSTRUCCION', 'TRANSVERSAL'}))

        # Filtrar por organismo DT
        res_dt = self.client.get("/api/requisitos-legales-base/?organismo=DT", **self.headers_a)
        self.assertEqual(res_dt.status_code, status.HTTP_200_OK)
        for item in res_dt.data:
            self.assertEqual(item['organismo'], 'DT')

    def test_generar_matriz_automatica_construccion(self):
        """Verifica la generación automática de matriz legal con condiciones de faena."""
        payload = {
            "empresa_id": self.empresa_a.id,
            "centro_trabajo_id": self.centro_a.id,
            "rubro": "CONSTRUCCION",
            "condiciones": {
                "mas_25_trabajadores": True,
                "mas_10_trabajadores": True,
                "trabajo_altura": True,
                "subcontratacion": True,
                "sustancias_peligrosas": False
            },
            "observacion_general": "Auditoría legal de inicio de faena constructiva."
        }
        res = self.client.post("/api/matrices-legales/generar-automatica/", payload, format='json', **self.headers_a)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data

        self.assertEqual(data['empresa'], self.empresa_a.id)
        self.assertEqual(data['rubro_principal'], 'CONSTRUCCION')
        self.assertGreater(data['total_requisitos'], 10)
        self.assertEqual(data['cumplidos'], 0)
        self.assertEqual(data['porcentaje_cumplimiento'], 0.0)
        self.assertEqual(data['estado_semaforo'], 'CRITICO')

        # Verificar presencia de ítems clave
        titulos = [item['titulo'] for item in data['items']]
        identificaciones = [item['identificacion_norma'] for item in data['items']]

        # Ítem transversal básico
        self.assertTrue(any("Reglamento Interno" in t for t in titulos))
        # Ítem por condición mas_25_trabajadores (CPHS)
        self.assertTrue(any("Comité Paritario" in t for t in titulos))
        # Ítem por condición trabajo_altura (Andamios)
        self.assertTrue(any("Andamios" in t or "NCh 998" in i for t, i in zip(titulos, identificaciones)))
        # Ítem específico de construcción (Excavaciones)
        self.assertTrue(any("NCh 349" in i for i in identificaciones))

    def test_recalculo_porcentaje_y_semaforo(self):
        """Verifica que el porcentaje de cumplimiento y semáforo se recalculan al actualizar ítems."""
        # Generar matriz
        payload = {
            "empresa_id": self.empresa_a.id,
            "rubro": "TRANSVERSAL",
            "condiciones": {"mas_10_trabajadores": True}
        }
        res_crear = self.client.post("/api/matrices-legales/generar-automatica/", payload, format='json', **self.headers_a)
        self.assertEqual(res_crear.status_code, status.HTTP_201_CREATED)
        matriz_id = res_crear.data['id']
        items = res_crear.data['items']
        self.assertGreater(len(items), 0)

        # Inicialmente 0% -> CRITICO
        res_stats = self.client.get(f"/api/matrices-legales/{matriz_id}/estadisticas/", **self.headers_a)
        self.assertEqual(res_stats.status_code, status.HTTP_200_OK)
        self.assertEqual(res_stats.data['porcentaje_cumplimiento'], 0.0)
        self.assertEqual(res_stats.data['estado_semaforo'], 'CRITICO')

        # Pasar todos los ítems a CUMPLE
        for item in items:
            res_patch = self.client.patch(
                f"/api/items-matriz-legal/{item['id']}/",
                {
                    "estado": "CUMPLE",
                    "evidencia_cumplimiento": "Documento depositado en DT folio 12345",
                    "responsable": "Juan Prevencionista"
                },
                format='json',
                **self.headers_a
            )
            self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

        # Verificar recálculo a 100% -> OPTIMO
        res_stats_updated = self.client.get(f"/api/matrices-legales/{matriz_id}/estadisticas/", **self.headers_a)
        self.assertEqual(res_stats_updated.status_code, status.HTTP_200_OK)
        self.assertEqual(res_stats_updated.data['porcentaje_cumplimiento'], 100.0)
        self.assertEqual(res_stats_updated.data['estado_semaforo'], 'OPTIMO')
        self.assertEqual(res_stats_updated.data['cumplidos'], len(items))
        self.assertEqual(res_stats_updated.data['brechas_criticas'], 0)
        self.assertIn('DT', res_stats_updated.data['desglose_organismo'])

    def test_aislamiento_multitenant(self):
        """Verifica que el usuario B no puede ver ni modificar matrices ni ítems de la empresa del usuario A."""
        payload = {
            "empresa_id": self.empresa_a.id,
            "rubro": "CONSTRUCCION",
            "condiciones": {}
        }
        res_crear = self.client.post("/api/matrices-legales/generar-automatica/", payload, format='json', **self.headers_a)
        self.assertEqual(res_crear.status_code, status.HTTP_201_CREATED)
        matriz_id = res_crear.data['id']
        primer_item_id = res_crear.data['items'][0]['id']

        # Usuario B intenta ver la matriz de Usuario A -> 404
        res_b_ver = self.client.get(f"/api/matrices-legales/{matriz_id}/", **self.headers_b)
        self.assertEqual(res_b_ver.status_code, status.HTTP_404_NOT_FOUND)

        # Usuario B intenta ver estadísticas de la matriz de Usuario A -> 404
        res_b_stats = self.client.get(f"/api/matrices-legales/{matriz_id}/estadisticas/", **self.headers_b)
        self.assertEqual(res_b_stats.status_code, status.HTTP_404_NOT_FOUND)

        # Usuario B intenta generar matriz para la empresa de Usuario A -> 404
        res_b_generar = self.client.post("/api/matrices-legales/generar-automatica/", {
            "empresa_id": self.empresa_a.id,
            "rubro": "MINERIA"
        }, format='json', **self.headers_b)
        self.assertEqual(res_b_generar.status_code, status.HTTP_404_NOT_FOUND)

        # Usuario B intenta modificar un ítem de la matriz de Usuario A -> 404
        res_b_patch = self.client.patch(
            f"/api/items-matriz-legal/{primer_item_id}/",
            {"estado": "CUMPLE"},
            format='json',
            **self.headers_b
        )
        self.assertEqual(res_b_patch.status_code, status.HTTP_404_NOT_FOUND)


class MatrizRiesgoMiperIntegrationTestCase(APITestCase):
    """
    Casos de prueba para el Módulo de Matriz de Identificación de Peligros
    y Evaluación de Riesgos (MIPER / IPER - Guía Técnica ISP y D.S. N° 44).
    """
    client: Any

    def setUp(self):
        self.user_a = Usuario.objects.create_user(
            username="prev_miper_a",
            email="prev_miper_a@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.user_b = Usuario.objects.create_user(
            username="prev_miper_b",
            email="prev_miper_b@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )

        res_a = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prev_miper_a',
            'password': 'securepassword123'
        })
        self.headers_a = {'HTTP_AUTHORIZATION': f"Bearer {res_a.data['access']}"}

        res_b = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prev_miper_b',
            'password': 'securepassword123'
        })
        self.headers_b = {'HTTP_AUTHORIZATION': f"Bearer {res_b.data['access']}"}

        self.empresa_a = Empresa.objects.create(
            prevencionista=self.user_a,
            razon_social="Constructora Andina SpA",
            rut="76.123.456-7",
            mutualidad="ACHS",
            giro="Construcción de edificios"
        )
        self.centro_a = CentroTrabajo.objects.create(
            empresa=self.empresa_a,
            nombre="Faena Los Conquistadores",
            direccion="Av. Los Conquistadores 1234, Providencia",
            comuna="Providencia"
        )

        self.empresa_b = Empresa.objects.create(
            prevencionista=self.user_b,
            razon_social="Servicios Mineros del Norte SpA",
            rut="77.987.654-3",
            mutualidad="MUTUAL",
            giro="Servicios de apoyo a la minería"
        )

    def test_creacion_matriz_e_items_calculo_magnitudes(self):
        """
        Verifica la creación de Matriz MIPER, agregado de ítems y cálculo automático
        de magnitudes puras/residuales y clasificaciones según escala ISP.
        """
        # Crear matriz para Empresa A
        payload_matriz = {
            "empresa": self.empresa_a.id,
            "centro_trabajo": self.centro_a.id,
            "nombre": "Matriz IPER Faena Obras Civiles y Excavaciones",
            "proceso_area": "Operaciones en Terreno / Movimiento de Tierras",
            "version": 1,
            "estado": "VIGENTE"
        }
        res_matriz = self.client.post("/api/matrices-riesgo-miper/", payload_matriz, format='json', **self.headers_a)
        self.assertEqual(res_matriz.status_code, status.HTTP_201_CREATED)
        matriz_id = res_matriz.data['id']
        self.assertEqual(res_matriz.data['prevencionista_nombre'], "prev_miper_a")
        self.assertEqual(res_matriz.data['empresa_nombre'], "Constructora Andina SpA")

        # Agregar ítem crítico: P=5, S=5 (25 -> CRITICO), residual P=2, S=2 (4 -> BAJO)
        item_critico = {
            "matriz": matriz_id,
            "proceso": "Movimiento de Tierras",
            "actividad": "Excavación de zanjas y perfilado",
            "tipo_actividad": "RUTINARIA",
            "puesto_trabajo": "Jornalero / Operador Retroexcavadora",
            "peligro": "Derrumbe de taludes y paredes de excavación",
            "clasificacion_peligro": "SEGURIDAD",
            "riesgo_consecuencia": "Atrapamiento, asfixia por aplastamiento, lesiones graves o fatales",
            "probabilidad_pura": 5,
            "severidad_pura": 5,
            "control_eliminacion": "",
            "control_sustitucion": "",
            "control_ingenieria": "Entibaciones continuas de madera y metal según NCh 349",
            "control_administrativo": "Procedimiento de trabajo seguro (PTS) y delimitación perimetral",
            "control_epp": "Casco de seguridad, calzado con puntera NCh 772, chaleco reflectante",
            "probabilidad_residual": 2,
            "severidad_residual": 2,
            "responsable": "Jefe de Terreno / Prevencionista",
            "estado_control": "IMPLEMENTADO",
            "orden": 1
        }
        res_item_1 = self.client.post("/api/items-matriz-riesgo/", item_critico, format='json', **self.headers_a)
        self.assertEqual(res_item_1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_item_1.data['magnitud_pura'], 25)
        self.assertEqual(res_item_1.data['clasificacion_pura'], 'CRITICO')
        self.assertEqual(res_item_1.data['magnitud_residual'], 4)
        self.assertEqual(res_item_1.data['clasificacion_residual'], 'BAJO')

        # Agregar ítem alto: P=4, S=3 (12 -> ALTO), residual P=2, S=3 (6 -> MEDIO)
        item_alto = {
            "matriz": matriz_id,
            "proceso": "Hormigonado",
            "actividad": "Vaciado de losa en altura",
            "tipo_actividad": "RUTINARIA",
            "puesto_trabajo": "Concretero",
            "peligro": "Caída a distinto nivel desde borde de losa",
            "clasificacion_peligro": "SEGURIDAD",
            "riesgo_consecuencia": "Politraumastismo, fracturas, muerte",
            "probabilidad_pura": 4,
            "severidad_pura": 3,
            "control_ingenieria": "Instalación de barandas rígidas perimetrales",
            "control_administrativo": "Permiso de trabajo en altura",
            "control_epp": "Arnés de seguridad con doble cabo de vida",
            "probabilidad_residual": 2,
            "severidad_residual": 3,
            "responsable": "Supervisor de Obra",
            "estado_control": "IMPLEMENTADO",
            "orden": 2
        }
        res_item_2 = self.client.post("/api/items-matriz-riesgo/", item_alto, format='json', **self.headers_a)
        self.assertEqual(res_item_2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_item_2.data['magnitud_pura'], 12)
        self.assertEqual(res_item_2.data['clasificacion_pura'], 'ALTO')
        self.assertEqual(res_item_2.data['magnitud_residual'], 6)
        self.assertEqual(res_item_2.data['clasificacion_residual'], 'MEDIO')

        # Consultar matriz y verificar métricas agregadas
        res_matriz_get = self.client.get(f"/api/matrices-riesgo-miper/{matriz_id}/", **self.headers_a)
        self.assertEqual(res_matriz_get.status_code, status.HTTP_200_OK)
        data_m = res_matriz_get.data
        self.assertEqual(data_m['total_peligros'], 2)
        self.assertEqual(data_m['criticos_puros'], 1)
        self.assertEqual(data_m['altos_puros'], 1)
        self.assertEqual(data_m['criticos_residuales'], 0)
        self.assertEqual(data_m['medios_residuales'], 1)
        self.assertEqual(data_m['bajos_residuales'], 1)
        # Reducción: suma pura = 25 + 12 = 37. Suma residual = 4 + 6 = 10. (37-10)/37 = 72.97% -> 73.0%
        self.assertAlmostEqual(data_m['porcentaje_reduccion_riesgo'], 73.0, places=0)
        self.assertEqual(len(data_m['items']), 2)

    def test_validacion_rango_probabilidad_severidad(self):
        """Verifica que el serializer rechace valores fuera del rango 1 a 5."""
        matriz = MatrizRiesgoMiper.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            prevencionista=self.user_a,
            nombre="Matriz Test Validación",
            proceso_area="Área de Pruebas"
        )
        # Probabilidad pura fuera de rango (6)
        res_error_p = self.client.post("/api/items-matriz-riesgo/", {
            "matriz": matriz.id,
            "proceso": "P",
            "actividad": "A",
            "puesto_trabajo": "PT",
            "peligro": "Pel",
            "clasificacion_peligro": "SEGURIDAD",
            "riesgo_consecuencia": "RC",
            "probabilidad_pura": 6,
            "severidad_pura": 3,
            "probabilidad_residual": 2,
            "severidad_residual": 2
        }, format='json', **self.headers_a)
        self.assertEqual(res_error_p.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('probabilidad_pura', res_error_p.data)

        # Severidad residual fuera de rango (0)
        res_error_s = self.client.post("/api/items-matriz-riesgo/", {
            "matriz": matriz.id,
            "proceso": "P",
            "actividad": "A",
            "puesto_trabajo": "PT",
            "peligro": "Pel",
            "clasificacion_peligro": "SEGURIDAD",
            "riesgo_consecuencia": "RC",
            "probabilidad_pura": 3,
            "severidad_pura": 3,
            "probabilidad_residual": 2,
            "severidad_residual": 0
        }, format='json', **self.headers_a)
        self.assertEqual(res_error_s.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('severidad_residual', res_error_s.data)

    def test_validacion_jerarquia_controles_obligatoria(self):
        """P1.6: Impide registrar riesgo residual inferior al puro si no se declara control preventivo (Art. 9 y 10 D.S. 44)."""
        matriz = MatrizRiesgoMiper.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            prevencionista=self.user_a,
            nombre="Matriz Controles D.S. 44",
            proceso_area="Taller"
        )
        # Reducción de riesgo (pura: 3x3=9, residual: 1x1=1) SIN controles -> Debe fallar 400
        res_fail = self.client.post("/api/items-matriz-riesgo/", {
            "matriz": matriz.id,
            "proceso": "Corte de metales",
            "actividad": "Uso de esmeril angular",
            "puesto_trabajo": "Operador",
            "peligro": "Proyección de partículas",
            "clasificacion_peligro": "SEGURIDAD",
            "riesgo_consecuencia": "Lesiones oculares",
            "probabilidad_pura": 3,
            "severidad_pura": 3,
            "probabilidad_residual": 1,
            "severidad_residual": 1,
            "control_eliminacion": "",
            "control_sustitucion": "",
            "control_ingenieria": "",
            "control_administrativo": "",
            "control_epp": ""
        }, format='json', **self.headers_a)
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Con al menos un control (EPP) -> Debe aprobar 201
        res_ok = self.client.post("/api/items-matriz-riesgo/", {
            "matriz": matriz.id,
            "proceso": "Corte de metales",
            "actividad": "Uso de esmeril angular",
            "puesto_trabajo": "Operador",
            "peligro": "Proyección de partículas",
            "clasificacion_peligro": "SEGURIDAD",
            "riesgo_consecuencia": "Lesiones oculares",
            "probabilidad_pura": 3,
            "severidad_pura": 3,
            "probabilidad_residual": 1,
            "severidad_residual": 1,
            "control_epp": "Careta facial de policarbonato y antiparras certificadas"
        }, format='json', **self.headers_a)
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)

    def test_aislamiento_multitenant_miper(self):
        """Verifica que el usuario B no pueda ver, alterar ni añadir ítems en la matriz de la empresa del usuario A."""
        matriz = MatrizRiesgoMiper.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            prevencionista=self.user_a,
            nombre="Matriz Privada Usuario A",
            proceso_area="Área Secreta"
        )
        item = ItemMatrizRiesgo.objects.create(
            matriz=matriz,
            proceso="Proceso A",
            actividad="Actividad A",
            puesto_trabajo="Puesto A",
            peligro="Peligro A",
            clasificacion_peligro="FISICO",
            riesgo_consecuencia="Consecuencia A",
            probabilidad_pura=4,
            severidad_pura=4,
            probabilidad_residual=2,
            severidad_residual=2
        )

        # Usuario B no puede ver la matriz de Usuario A -> 404
        res_ver = self.client.get(f"/api/matrices-riesgo-miper/{matriz.id}/", **self.headers_b)
        self.assertEqual(res_ver.status_code, status.HTTP_404_NOT_FOUND)

        # Usuario B no puede listar ítems de la matriz de Usuario A -> lista vacía
        res_list_items = self.client.get(f"/api/items-matriz-riesgo/?matriz={matriz.id}", **self.headers_b)
        self.assertEqual(res_list_items.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list_items.data), 0)

        # Usuario B no puede crear ítem en matriz de Usuario A -> 400 Bad Request
        res_crear_item = self.client.post("/api/items-matriz-riesgo/", {
            "matriz": matriz.id,
            "proceso": "Infiltración",
            "actividad": "Intento de hack",
            "puesto_trabajo": "Tester B",
            "peligro": "Ataque",
            "clasificacion_peligro": "SEGURIDAD",
            "riesgo_consecuencia": "Fuga",
            "probabilidad_pura": 1,
            "severidad_pura": 1,
            "probabilidad_residual": 1,
            "severidad_residual": 1
        }, format='json', **self.headers_b)
        self.assertEqual(res_crear_item.status_code, status.HTTP_400_BAD_REQUEST)

        # Usuario B no puede modificar ítem de Usuario A -> 404 Not Found
        res_patch_item = self.client.patch(f"/api/items-matriz-riesgo/{item.id}/", {
            "peligro": "Modificado indebidamente"
        }, format='json', **self.headers_b)
        self.assertEqual(res_patch_item.status_code, status.HTTP_404_NOT_FOUND)

        # Usuario B no puede eliminar ítem de Usuario A -> 404 Not Found
        res_del_item = self.client.delete(f"/api/items-matriz-riesgo/{item.id}/", **self.headers_b)
        self.assertEqual(res_del_item.status_code, status.HTTP_404_NOT_FOUND)

    def test_endpoint_matriz_calor_5x5(self):
        """Verifica que el endpoint /matriz-calor retorne la cuadrícula 5x5 con conteos correctos."""
        matriz = MatrizRiesgoMiper.objects.create(
            empresa=self.empresa_a,
            centro_trabajo=self.centro_a,
            prevencionista=self.user_a,
            nombre="Matriz para Heatmap 5x5",
            proceso_area="Planta Industrial"
        )
        # Ítem 1: Pura P=5, S=5 (25, Crítico). Residual P=1, S=2 (2, Bajo)
        ItemMatrizRiesgo.objects.create(
            matriz=matriz,
            proceso="Fundición",
            actividad="Vaciado de metal fundido",
            puesto_trabajo="Operador Horno",
            peligro="Salpicadura de metal a alta temperatura",
            clasificacion_peligro="FISICO",
            riesgo_consecuencia="Quemaduras graves de 3er grado",
            probabilidad_pura=5,
            severidad_pura=5,
            probabilidad_residual=1,
            severidad_residual=2
        )
        # Ítem 2: Pura P=5, S=5 (25, Crítico). Residual P=3, S=3 (9, Medio)
        ItemMatrizRiesgo.objects.create(
            matriz=matriz,
            proceso="Calderas",
            actividad="Mantenimiento de tuberías de vapor",
            puesto_trabajo="Mecánico",
            peligro="Explosión por sobrepresión",
            clasificacion_peligro="SEGURIDAD",
            riesgo_consecuencia="Trauma acústico, quemaduras",
            probabilidad_pura=5,
            severidad_pura=5,
            probabilidad_residual=3,
            severidad_residual=3
        )

        res_calor = self.client.get(f"/api/matrices-riesgo-miper/{matriz.id}/matriz-calor/", **self.headers_a)
        self.assertEqual(res_calor.status_code, status.HTTP_200_OK)
        data = res_calor.data

        self.assertEqual(data['matriz_id'], matriz.id)
        self.assertEqual(data['total_peligros'], 2)
        self.assertEqual(len(data['grid']), 25)

        # Buscar la celda P=5, S=5 en la cuadrícula
        celda_5_5 = next(c for c in data['grid'] if c['probabilidad'] == 5 and c['severidad'] == 5)
        self.assertEqual(celda_5_5['magnitud'], 25)
        self.assertEqual(celda_5_5['clasificacion'], 'CRITICO')
        self.assertEqual(celda_5_5['count_puro'], 2)
        self.assertEqual(celda_5_5['count_residual'], 0)

        # Buscar la celda P=1, S=2 (residual del ítem 1)
        celda_1_2 = next(c for c in data['grid'] if c['probabilidad'] == 1 and c['severidad'] == 2)
        self.assertEqual(celda_1_2['count_puro'], 0)
        self.assertEqual(celda_1_2['count_residual'], 1)

        # Buscar la celda P=3, S=3 (residual del ítem 2)
        celda_3_3 = next(c for c in data['grid'] if c['probabilidad'] == 3 and c['severidad'] == 3)
        self.assertEqual(celda_3_3['count_puro'], 0)
        self.assertEqual(celda_3_3['count_residual'], 1)

        # Totales
        self.assertEqual(data['totales']['puro']['critico'], 2)
        self.assertEqual(data['totales']['residual']['critico'], 0)
        self.assertEqual(data['totales']['residual']['medio'], 1)
        self.assertEqual(data['totales']['residual']['bajo'], 1)


class ContratistaMultiTenantTestCase(APITestCase):
    """
    Casos de prueba para verificar el Aislamiento Multi-Tenant Corporativo en Contratistas:
    - Usuarios de cuenta hija pueden consultar y operar sobre contratistas de la cuenta padre.
    - Usuarios ajenos (tenant B) no pueden ver ni modificar contratistas del grupo A.
    """
    client: Any

    def setUp(self):
        cache.clear()
        self.plan = Plan.objects.create(
            nombre="Plan Corporativo Test",
            codigo="plan-corp-test",
            precio=49990.00,
            limite_semanal=100,
            asientos=10
        )
        # Cuenta Padre (Prevencionista Senior)
        self.user_padre = Usuario.objects.create_user(
            username="prev_padre_corp",
            email="padre_corp@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_CORPORATIVO
        )
        # Cuenta Hija (Asiento dependiente)
        self.user_hija = Usuario.objects.create_user(
            username="prev_hija_corp",
            email="hija_corp@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL,
            cuenta_padre=self.user_padre
        )
        # Usuario Tenant B (Ajeno)
        self.user_b = Usuario.objects.create_user(
            username="prev_externo_b",
            email="externo_b@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )

        self.empresa_padre = Empresa.objects.create(
            prevencionista=self.user_padre,
            razon_social="Corporación Minera S.A.",
            rut="76.999.888-7"
        )
        self.contratista_padre = Contratista.objects.create(
            usuario=self.user_padre,
            empresa_principal=self.empresa_padre,
            razon_social="Servicios Eléctricos Ltda.",
            rut="77.222.333-4"
        )

        # Tokens
        res_hija = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prev_hija_corp',
            'password': 'securepassword123'
        })
        self.headers_hija = {'HTTP_AUTHORIZATION': f'Bearer {res_hija.data["access"]}'}

        res_b = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prev_externo_b',
            'password': 'securepassword123'
        })
        self.headers_b = {'HTTP_AUTHORIZATION': f'Bearer {res_b.data["access"]}'}

    def test_cuenta_hija_ve_contratista_corporativo(self):
        """La cuenta hija consulta /api/contratistas/ y ve el contratista creado por su cuenta padre."""
        res = self.client.get("/api/contratistas/", **self.headers_hija)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['razon_social'], "Servicios Eléctricos Ltda.")

    def test_tenant_ajeno_no_ve_contratista_corporativo(self):
        """Usuario ajeno (Tenant B) consulta /api/contratistas/ y no ve los contratistas del grupo corporativo A."""
        res = self.client.get("/api/contratistas/", **self.headers_b)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(items), 0)

    def test_cuenta_hija_opera_documentos_y_trabajadores_contratista(self):
        """La cuenta hija puede listar y crear documentos/trabajadores del contratista de su empresa corporativa."""
        doc = DocumentoContratista.objects.create(
            contratista=self.contratista_padre,
            tipo=DocumentoContratista.TIPO_F30,
            fecha_emision=timezone.localdate(),
            fecha_vencimiento=timezone.localdate() + timedelta(days=30)
        )
        res_docs = self.client.get(f"/api/documentos-contratista/?contratista={self.contratista_padre.id}", **self.headers_hija)
        self.assertEqual(res_docs.status_code, status.HTTP_200_OK)
        docs_items = res_docs.data if isinstance(res_docs.data, list) else res_docs.data.get('results', [])
        self.assertEqual(len(docs_items), 1)

        # Cuenta hija crea trabajador subcontratado
        trab_payload = {
            "contratista": self.contratista_padre.id,
            "nombre_completo": "Esteban Técnico",
            "rut": "15.456.789-5",
            "cargo": "Electricista",
            "fecha_ingreso_obra": str(timezone.localdate())
        }
        res_crear_trab = self.client.post("/api/trabajadores-subcontratados/", trab_payload, format='json', **self.headers_hija)
        self.assertEqual(res_crear_trab.status_code, status.HTTP_201_CREATED)


class ClimaUvTestCase(APITestCase):
    """
    Casos de prueba para verificar el endpoint de Clima, Radiación UV (D.S. 594)
    y Estrés Térmico por Calor (Enmienda ISO 2024).
    """
    def setUp(self):
        cache.clear()
        self.user = Usuario.objects.create_user(
            username="prev_clima_test",
            email="clima@hdprevencion.cl",
            password="securepassword123"
        )
        self.empresa = Empresa.objects.create(
            prevencionista=self.user,
            razon_social="Constructora Andes SpA",
            rut="76.123.456-0"
        )
        self.centro = CentroTrabajo.objects.create(
            empresa=self.empresa,
            nombre="Faena Mina Norte",
            direccion="Camino Minero s/n",
            comuna="Antofagasta",
            region="Antofagasta"
        )

    @patch('urllib.request.urlopen')
    def test_radiacion_uv_ds594_y_estres_termico_json(self, mock_urlopen):
        """Valida que /api/clima/radiacion-uv/ responda 200 con la estructura oficial del D.S. 594 e ISO 2024."""
        mock_data = {
            "latitude": -23.65,
            "longitude": -70.40,
            "current": {
                "time": "2026-10-16T12:00",
                "temperature_2m": 31.5,
                "apparent_temperature": 33.2,
                "relative_humidity_2m": 65,
                "uv_index": 8.6,
                "is_day": 1
            },
            "daily": {
                "time": ["2026-10-16"],
                "uv_index_max": [10.2],
                "temperature_2m_max": [32.0]
            }
        }
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps(mock_data).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        # Consultar por centro_trabajo_id
        res = self.client.get(f"/api/clima/radiacion-uv/?centro_trabajo_id={self.centro.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        # Verificación de claves requeridas
        self.assertEqual(data['ciudad'], "Antofagasta")
        self.assertEqual(data['faena_nombre'], "Faena Mina Norte")
        self.assertEqual(data['empresa_nombre'], "Constructora Andes SpA")
        self.assertEqual(data['fecha'], "2026-10-16")
        self.assertEqual(data['uv_actual'], 8.6)
        self.assertEqual(data['uv_max_dia'], 10.2)
        self.assertEqual(data['nivel_uv'], "MUY_ALTO")
        self.assertEqual(data['color_hex'], "#ef4444")
        self.assertEqual(data['temperatura'], 31.5)
        self.assertEqual(data['sensacion_termica'], 33.2)
        self.assertEqual(data['humedad'], 65)

        # Validación Estrés Térmico ISO 2024 (sensación >= 32°C)
        self.assertTrue(data['estres_termico_alerta'])
        self.assertIn("Alerta de Estrés Térmico (Enmienda Oficial ISO 2024)", data['medidas_legales_ds594'][0])

        # Horario de mayor riesgo
        self.assertEqual(data['hora_inicio_peligro'], "11:00")
        self.assertEqual(data['hora_fin_peligro'], "16:00")
        self.assertGreaterEqual(len(data['medidas_legales_ds594']), 2)

    @patch('urllib.request.urlopen')
    def test_cache_30_minutos_clima(self, mock_urlopen):
        """Valida que llamadas sucesivas a la misma ubicación utilicen la caché."""
        mock_data = {
            "current": {"temperature_2m": 20.0, "apparent_temperature": 20.0, "relative_humidity_2m": 50, "uv_index": 2.0},
            "daily": {"time": ["2026-10-16"], "uv_index_max": [2.5]}
        }
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps(mock_data).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        # Primera llamada (consulta API)
        res1 = self.client.get("/api/clima/radiacion-uv/?comuna=Santiago")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(mock_urlopen.call_count, 1)

        # Segunda llamada inmediata (debe venir de cache)
        res2 = self.client.get("/api/clima/radiacion-uv/?comuna=Santiago")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(mock_urlopen.call_count, 1)


class MatrizRiesgoMiperTestCase(APITestCase):
    """
    Pruebas unitarias y de integración para la Matriz IPERC
    (D.S. N° 44, ISO 45001, Circular SUSESO 3336 y Guía Técnica ISP).
    """
    client: Any

    def setUp(self):
        self.user = Usuario.objects.create_user(
            username="prev_iperc",
            email="iperc@hdprevencion.cl",
            password="securepassword123",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL
        )
        self.client.force_authenticate(user=self.user)
        self.empresa = Empresa.objects.create(
            prevencionista=self.user,
            razon_social="Constructora Andina SpA",
            rut="76.123.456-0"
        )
        self.matriz = MatrizRiesgoMiper.objects.create(
            empresa=self.empresa,
            prevencionista=self.user,
            nombre="Matriz IPERC Faena Central",
            proceso_area="Construcción en Altura",
            version=1
        )

    def test_validacion_escala_isp_limites(self):
        """Valida que P y C fuera de 1..5 generen error de validación."""
        from django.core.exceptions import ValidationError
        item = ItemMatrizRiesgo(
            matriz=self.matriz,
            proceso="Obra Gruesa",
            actividad="Enfierrado",
            puesto_trabajo="Enfierrador",
            peligro="Caída a distinto nivel",
            clasificacion_peligro="SEGURIDAD",
            riesgo_consecuencia="Traumatismo",
            probabilidad_pura=6,  # Inválido (> 5)
            severidad_pura=3,
            probabilidad_residual=2,
            severidad_residual=2
        )
        with self.assertRaises(ValidationError):
            item.clean()

    def test_validacion_ds44_reduccion_riesgo_sin_controles(self):
        """No es legal reducir el riesgo residual sin registrar al menos un control."""
        from django.core.exceptions import ValidationError
        item = ItemMatrizRiesgo(
            matriz=self.matriz,
            proceso="Montaje",
            actividad="Soldadura",
            puesto_trabajo="Soldador",
            peligro="Humos metálicos",
            clasificacion_peligro="QUIMICO",
            riesgo_consecuencia="Fiebre de humos",
            probabilidad_pura=4,
            severidad_pura=3,  # Pura = 12
            probabilidad_residual=2,
            severidad_residual=2,  # Residual = 4
        )
        with self.assertRaises(ValidationError):
            item.clean()

        # Con control requerido o de jerarquía debe pasar
        item.controles_requeridos = "Extracción localizada y EPP respiratorio"
        item.clean()  # No debe lanzar excepción

    def test_validacion_circular_3336_accidente_grave_fatal(self):
        """Si es accidente grave/fatal, debe evaluarse con Severidad >= 4 o Crítico >= 17."""
        from django.core.exceptions import ValidationError
        item = ItemMatrizRiesgo(
            matriz=self.matriz,
            proceso="Trabajo en Altura",
            actividad="Techumbre > 1.8m",
            puesto_trabajo="Techador",
            peligro="Caída de altura sobre 1.8m",
            clasificacion_peligro="SEGURIDAD",
            riesgo_consecuencia="Muerte o invalidez",
            es_accidente_grave_fatal=True,
            probabilidad_pura=2,
            severidad_pura=2,  # Magnitud = 4 (< 17 y Severidad < 4)
            probabilidad_residual=2,
            severidad_residual=2,
        )
        with self.assertRaises(ValidationError):
            item.clean()

        # Si Severidad pura es 4 o 5 (Grave/Catastrófico) con control preventivo, pasa
        item.severidad_pura = 4
        item.control_ingenieria = "Línea de vida y arnés con amortiguador"
        item.clean()  # Válido

    def test_endpoint_matriz_calor_estructura_y_conteos(self):
        """Verifica la respuesta del grid 5x5 con Y=Probabilidad (5 a 1) y X=Severidad (1 a 5)."""
        ItemMatrizRiesgo.objects.create(
            matriz=self.matriz,
            proceso="Excavación",
            actividad="Zanja",
            puesto_trabajo="Operador",
            peligro="Derrumbe",
            clasificacion_peligro="SEGURIDAD",
            riesgo_consecuencia="Atrapamiento",
            probabilidad_pura=5,
            severidad_pura=5,
            control_ingenieria="Entibación obligatoria",
            probabilidad_residual=2,
            severidad_residual=3
        )
        res = self.client.get(f"/api/matrices-riesgo-miper/{self.matriz.id}/matriz-calor/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["matriz_id"], self.matriz.id)
        self.assertEqual(data["total_peligros"], 1)
        grid = data["grid"]
        self.assertEqual(len(grid), 25)
        # Primer elemento de la grilla debe ser P=5, S=1 (Eje Y: 5 a 1, Eje X: 1 a 5)
        self.assertEqual(grid[0]["probabilidad"], 5)
        self.assertEqual(grid[0]["severidad"], 1)
        # Elemento P=5, S=5 debe tener count_puro = 1
        celda_5_5 = next(c for c in grid if c["probabilidad"] == 5 and c["severidad"] == 5)
        self.assertEqual(celda_5_5["count_puro"], 1)
        self.assertEqual(celda_5_5["count_residual"], 0)
        # Elemento P=2, S=3 debe tener count_residual = 1
        celda_2_3 = next(c for c in grid if c["probabilidad"] == 2 and c["severidad"] == 3)
        self.assertEqual(celda_2_3["count_residual"], 1)

    def test_creacion_item_api_con_pasos_infografia(self):
        """Verifica la creación de ítem vía API con campos de Pasos 4 y 5 y Circular 3336."""
        payload = {
            "matriz": self.matriz.id,
            "proceso": "Hormigonado",
            "actividad": "Vaciado de losa",
            "tipo_actividad": "RUTINARIA",
            "puesto_trabajo": "Concretero",
            "peligro": "Exposición a radiación UV y calor extremo",
            "clasificacion_peligro": "CLIMATICO",
            "riesgo_consecuencia": "Insolación y estrés térmico (ISO 2024)",
            "es_accidente_grave_fatal": False,
            "trabajador_sensible": "Adulto mayor / Hipertenso",
            "probabilidad_pura": 4,
            "severidad_pura": 3,
            "controles_existentes": "Uso de legionario y bloqueador solar",
            "controles_requeridos": "Puntos de hidratación y rotación de faena",
            "control_administrativo": "Pausa en horario punta 12:00 a 16:00",
            "control_epp": "Protector solar FPS 50+ con registro ISP",
            "probabilidad_residual": 2,
            "severidad_residual": 2,
            "responsable": "Capataz de Obra",
            "estado_control": "IMPLEMENTADO",
        }
        res = self.client.post("/api/items-matriz-riesgo/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        item_id = res.json()["id"]
        created = ItemMatrizRiesgo.objects.get(id=item_id)
        self.assertEqual(created.clasificacion_peligro, "CLIMATICO")
        self.assertEqual(created.controles_existentes, "Uso de legionario y bloqueador solar")
        self.assertEqual(created.trabajador_sensible, "Adulto mayor / Hipertenso")


class Ley21719P0SecurityTestCase(APITestCase):
    """
    Pruebas automatizadas de remediaciones P0 Ley N° 21.719:
    - P0.1: Cierre anónimo y multi-tenant de PortabilidadDatosView + minimización en consulta ARCO.
    - P0.2: Desacoplamiento y rotación con MultiFernet en FIELD_ENCRYPTION_KEY.
    """
    client: Any

    def setUp(self):
        cache.clear()
        self.owner = Usuario.objects.create_user(
            username="p0_owner",
            email="p0_owner@hdprevencion.cl",
            password="PasswordFuerte123!",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL,
        )
        self.other = Usuario.objects.create_user(
            username="p0_other",
            email="p0_other@hdprevencion.cl",
            password="PasswordFuerte123!",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL,
        )
        self.empresa = Empresa.objects.create(
            prevencionista=self.owner,
            razon_social="Empresa Protegida SpA",
            rut="76.543.210-K",
        )
        self.trabajador = Trabajador.objects.create(
            empresa=self.empresa,
            rut="15.111.222-3",
            nombres="María",
            apellidos="Segura",
            cargo="Supervisora",
        )

    def test_portabilidad_rechaza_anonimos_y_aisla_tenants(self):
        # 1. Anónimo rechazado (401)
        res_anon = self.client.get("/api/privacidad/portabilidad/?rut=15.111.222-3")
        self.assertEqual(res_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Otro usuario autenticado recibe 0 fichas del tenant propietario
        self.client.force_authenticate(user=self.other)
        res_cross = self.client.get("/api/privacidad/portabilidad/?rut=15.111.222-3")
        self.assertEqual(res_cross.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cross.json()["fichas_laborales"], [])

        # 3. Propietario autenticado accede al trabajador y también a su propia cuenta sin ?rut=
        self.client.force_authenticate(user=self.owner)
        res_owner_trab = self.client.get("/api/privacidad/portabilidad/?rut=15.111.222-3")
        self.assertEqual(res_owner_trab.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_owner_trab.json()["fichas_laborales"]), 1)

        res_owner_self = self.client.get("/api/privacidad/portabilidad/")
        self.assertEqual(res_owner_self.status_code, status.HTTP_200_OK)
        self.assertEqual(res_owner_self.json()["ambito"], "cuenta_usuario")
        self.assertEqual(res_owner_self.json()["perfil"]["email"], "p0_owner@hdprevencion.cl")

    def test_consulta_arco_por_uuid_no_filtra_pii(self):
        res_post = self.client.post(
            "/api/privacidad/solicitar-derecho/",
            {
                "tipo_derecho": "BLOQUEO",
                "rut_titular": "15.111.222-3",
                "nombre_titular": "María Segura",
                "email_titular": "maria@ejemplo.cl",
                "detalle_solicitud": "Detalle privado de prueba",
            },
            format="json",
        )
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED)
        ticket_uuid = res_post.json()["uuid"]

        res_get = self.client.get(f"/api/privacidad/consultar-derecho/{ticket_uuid}/")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        data = res_get.json()
        self.assertIn("estado", data)
        self.assertTrue(data["bloqueo_provisional_activo"])
        for sensitive_key in ("rut_titular", "nombre_titular", "email_titular", "telefono_titular", "detalle_solicitud", "respuesta_formal"):
            self.assertNotIn(sensitive_key, data)

    def test_crypto_multifernet_y_rotacion_independiente_de_secret_key(self):
        from cryptography.fernet import Fernet
        from django.test import override_settings
        from modulo_prevencion.crypto import cifrar_texto, descifrar_texto, rotar_texto_cifrado

        key_1 = Fernet.generate_key().decode("utf-8")
        key_2 = Fernet.generate_key().decode("utf-8")

        with override_settings(FIELD_ENCRYPTION_KEY=key_1, FIELD_ENCRYPTION_OLD_KEYS=[]):
            token_v1 = cifrar_texto("Relato ultra confidencial")
            self.assertTrue(token_v1.startswith("enc:v1:"))
            # Cambiar SECRET_KEY NO rompe el descifrado mientras FIELD_ENCRYPTION_KEY sea la misma
            with override_settings(SECRET_KEY="otra_secret_key_totalmente_distinta"):
                self.assertEqual(descifrar_texto(token_v1), "Relato ultra confidencial")

        # Rotación a key_2 manteniendo key_1 en FIELD_ENCRYPTION_OLD_KEYS
        with override_settings(FIELD_ENCRYPTION_KEY=key_2, FIELD_ENCRYPTION_OLD_KEYS=[key_1]):
            self.assertEqual(descifrar_texto(token_v1), "Relato ultra confidencial")
            token_rotado = rotar_texto_cifrado(token_v1)
            self.assertNotEqual(token_rotado, token_v1)

        # Con key_2 solamente (sin key_1), token_rotado sigue descifrándose
        with override_settings(FIELD_ENCRYPTION_KEY=key_2, FIELD_ENCRYPTION_OLD_KEYS=[]):
            self.assertEqual(descifrar_texto(token_rotado), "Relato ultra confidencial")


class Ley21719P1SecurityTestCase(APITestCase):
    """
    Pruebas de regresión para controles P1.1 (Ley 21.719):
    - Validación de fortaleza de contraseñas y clave actual en registro y perfil
    - Contacto público con POST anónimo y lectura restringida a staff
    - Aislamiento multi-tenant y consultas grupales (accidentes, contratistas, sugerencias)
    - Bloqueo de reasignación cross-tenant vía PATCH
    - Restricción de PublicoEmpresasListView sin enumeración de cartera ni RUT
    """

    def setUp(self):
        from .models import Contratista, DocumentoContratista, TrabajadorSubcontratado, SugerenciaConsulta

        cache.clear()
        self.owner = Usuario.objects.create_user(
            username="p1_owner",
            email="p1_owner@hdprevencion.cl",
            password="PasswordFuerte123!",
            tipo_usuario="CORPORATIVO",
        )
        self.hija = Usuario.objects.create_user(
            username="p1_hija",
            email="p1_hija@hdprevencion.cl",
            password="PasswordFuerte123!",
            tipo_usuario="CORPORATIVO",
            cuenta_padre=self.owner,
        )
        self.ajeno = Usuario.objects.create_user(
            username="p1_ajeno",
            email="p1_ajeno@hdprevencion.cl",
            password="PasswordFuerte123!",
            tipo_usuario="INDIVIDUAL",
        )
        self.staff = Usuario.objects.create_user(
            username="p1_staff",
            email="p1_staff@hdprevencion.cl",
            password="PasswordFuerte123!",
            is_staff=True,
        )

        self.emp_a = Empresa.objects.create(
            prevencionista=self.owner,
            razon_social="Empresa Alfa SpA",
            rut="76.111.222-3",
        )
        self.centro_a = CentroTrabajo.objects.create(
            empresa=self.emp_a,
            nombre="Casa Matriz Alfa",
            direccion="Av. Principal 100",
        )
        self.trab_a_activo = Trabajador.objects.create(
            empresa=self.emp_a,
            centro_trabajo=self.centro_a,
            rut="12.345.678-5",
            nombres="Juan",
            apellidos="Pérez",
            estado=Trabajador.ESTADO_ACTIVO,
        )
        Trabajador.objects.create(
            empresa=self.emp_a,
            centro_trabajo=self.centro_a,
            rut="11.111.111-1",
            nombres="Pedro",
            apellidos="Desvinculado",
            estado=Trabajador.ESTADO_DESVINCULADO,
        )

        self.emp_b = Empresa.objects.create(
            prevencionista=self.ajeno,
            razon_social="Empresa Beta SpA",
            rut="77.999.888-4",
        )
        self.centro_b = CentroTrabajo.objects.create(
            empresa=self.emp_b,
            nombre="Sucursal Beta",
            direccion="Calle Falsa 999",
        )

        self.contratista_a = Contratista.objects.create(
            usuario=self.owner,
            empresa_principal=self.emp_a,
            centro_trabajo=self.centro_a,
            razon_social="Servicios Contratista Alfa",
            rut="78.222.333-1",
        )
        DocumentoContratista.objects.create(
            contratista=self.contratista_a,
            tipo="F30",
            fecha_emision="2026-01-01",
            fecha_vencimiento="2027-01-01",
        )
        TrabajadorSubcontratado.objects.create(
            contratista=self.contratista_a,
            rut="15.222.333-4",
            nombre_completo="Subcontratado Uno",
            cargo="Técnico",
            fecha_ingreso_obra=timezone.localdate(),
            activo=True,
        )

        self.contratista_b = Contratista.objects.create(
            usuario=self.ajeno,
            empresa_principal=self.emp_b,
            centro_trabajo=self.centro_b,
            razon_social="Contratista Beta",
            rut="79.444.555-2",
        )
        SugerenciaConsulta.objects.create(
            usuario=self.owner,
            tipo=SugerenciaConsulta.TIPO_SUGERENCIA,
            mensaje="Mejorar señalética de evacuación",
        )

    def _auth(self, username, password="PasswordFuerte123!"):
        res = self.client.post("/api/auth/login/", {"username": username, "password": password})
        self.assertEqual(res.status_code, 200)
        return {"HTTP_AUTHORIZATION": f"Bearer {res.json()['access']}"}

    def test_registro_y_perfil_exigen_politica_contrasenas_y_clave_actual(self):
        # 1. Registro rechaza contraseña débil
        res_reg_debil = self.client.post("/api/auth/register/", {
            "username": "nuevo_debil",
            "email": "debil@hdprevencion.cl",
            "password": "123",
            "password_confirm": "123",
            "acepta_privacidad": True,
        })
        self.assertEqual(res_reg_debil.status_code, 400)
        self.assertIn("password", res_reg_debil.json())

        # 2. Registro acepta contraseña robusta y consentimiento explícito
        res_reg_ok = self.client.post("/api/auth/register/", {
            "username": "nuevo_robusto",
            "email": "robusto@hdprevencion.cl",
            "password": "ClaveSegura#2026!",
            "password_confirm": "ClaveSegura#2026!",
            "acepta_privacidad": True,
        })
        self.assertEqual(res_reg_ok.status_code, 201)

        headers = self._auth("p1_owner")
        # 3. Cambio de contraseña en perfil exige contraseña actual
        res_no_current = self.client.patch("/api/usuarios/perfil/", {
            "password": "NuevaClaveSegura#2026!",
            "password_confirm": "NuevaClaveSegura#2026!",
        }, **headers)
        self.assertEqual(res_no_current.status_code, 400)
        self.assertIn("current_password", res_no_current.json())

        # 4. Rechaza contraseña actual incorrecta
        res_wrong_current = self.client.patch("/api/usuarios/perfil/", {
            "current_password": "ClaveIncorrecta!",
            "password": "NuevaClaveSegura#2026!",
        }, **headers)
        self.assertEqual(res_wrong_current.status_code, 400)

        # 5. Rechaza contraseña nueva débil
        res_weak_new = self.client.patch("/api/usuarios/perfil/", {
            "current_password": "PasswordFuerte123!",
            "password": "password",
        }, **headers)
        self.assertEqual(res_weak_new.status_code, 400)
        self.assertIn("password", res_weak_new.json())

        # 6. Permite cambio válido y actualiza credenciales
        res_ok = self.client.patch("/api/usuarios/perfil/", {
            "current_password": "PasswordFuerte123!",
            "password": "NuevaClaveSegura#2026!",
            "password_confirm": "NuevaClaveSegura#2026!",
        }, **headers)
        self.assertEqual(res_ok.status_code, 200)
        self._auth("p1_owner", password="NuevaClaveSegura#2026!")

    def test_contacto_permite_post_anonimo_pero_protege_lectura(self):
        res_post = self.client.post("/api/contacto/", {
            "nombre": "Carlos Visitante",
            "email": "carlos@empresa.cl",
            "asunto": "Cotización SaaS",
            "mensaje": "Necesito asesoría en Ley 21.719",
            "acepta_privacidad": True,
        })
        self.assertEqual(res_post.status_code, 201)

        res_get_anon = self.client.get("/api/contacto/")
        self.assertEqual(res_get_anon.status_code, 401)

        res_get_user = self.client.get("/api/contacto/", **self._auth("p1_owner"))
        self.assertEqual(res_get_user.status_code, 403)

        res_get_staff = self.client.get("/api/contacto/", **self._auth("p1_staff"))
        self.assertEqual(res_get_staff.status_code, 200)

    def test_accidentes_estadisticas_sin_horas_y_aislamiento_tenant(self):
        headers = self._auth("p1_owner")
        # Sin ?horas_trabajadas= no debe lanzar FieldError (activo=True) y debe contar solo 1 trabajador ACTIVO (1*180*12=2160)
        res_ok = self.client.get("/api/accidentes/estadisticas/", **headers)
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(res_ok.json()["horas_trabajadas_estimadas"], 2160.0)

        # Filtrar por empresa ajena no debe contar trabajadores de emp_b
        res_cross = self.client.get(f"/api/accidentes/estadisticas/?empresa={self.emp_b.id}", **headers)
        self.assertEqual(res_cross.status_code, 200)
        self.assertEqual(res_cross.json()["horas_trabajadas_estimadas"], 200000.0)

    def test_contratista_dashboard_y_sugerencias_grupo_corporativo(self):
        headers_hija = self._auth("p1_hija")
        headers_ajeno = self._auth("p1_ajeno")

        res_dash = self.client.get("/api/contratistas/dashboard/", **headers_hija)
        self.assertEqual(res_dash.status_code, 200)
        data_dash = res_dash.json()
        self.assertEqual(data_dash["total_contratistas"], 1)
        self.assertEqual(data_dash["total_documentos"], 1)
        self.assertEqual(data_dash["total_trabajadores"], 1)

        res_sug = self.client.get("/api/buzon/", **headers_hija)
        self.assertEqual(res_sug.status_code, 200)
        sug_list = res_sug.json().get("results", res_sug.json()) if isinstance(res_sug.json(), dict) else res_sug.json()
        self.assertEqual(len(sug_list), 1)

        res_sug_ajeno = self.client.get("/api/buzon/", **headers_ajeno)
        self.assertEqual(res_sug_ajeno.status_code, 200)
        sug_ajeno_list = res_sug_ajeno.json().get("results", res_sug_ajeno.json()) if isinstance(res_sug_ajeno.json(), dict) else res_sug_ajeno.json()
        self.assertEqual(len(sug_ajeno_list), 0)

    def test_patch_no_permite_reasignar_fk_cross_tenant(self):
        headers_owner = self._auth("p1_owner")

        # Trabajador no puede reasignarse a empresa o centro de tenant B
        res_trab_emp = self.client.patch(
            f"/api/trabajadores/{self.trab_a_activo.id}/",
            {"empresa": self.emp_b.id},
            **headers_owner,
        )
        self.assertEqual(res_trab_emp.status_code, 400)

        res_trab_centro = self.client.patch(
            f"/api/trabajadores/{self.trab_a_activo.id}/",
            {"centro_trabajo": self.centro_b.id},
            **headers_owner,
        )
        self.assertEqual(res_trab_centro.status_code, 400)

        # Centro de trabajo no puede reasignarse a empresa de tenant B
        res_centro = self.client.patch(
            f"/api/centros-trabajo/{self.centro_a.id}/",
            {"empresa": self.emp_b.id},
            **headers_owner,
        )
        self.assertEqual(res_centro.status_code, 400)

        # Contratista no puede reasignar empresa_principal o centro_trabajo a tenant B
        res_cont = self.client.patch(
            f"/api/contratistas/{self.contratista_a.id}/",
            {"empresa_principal": self.emp_b.id},
            **headers_owner,
        )
        self.assertEqual(res_cont.status_code, 400)

        # DocumentoContratista no puede reasignarse a contratista de tenant B
        doc_id = self.contratista_a.documentos.first().id
        res_doc = self.client.patch(
            f"/api/documentos-contratista/{doc_id}/",
            {"contratista": self.contratista_b.id},
            **headers_owner,
        )
        self.assertEqual(res_doc.status_code, 400)

    def test_publico_empresas_requiere_empresa_y_no_expone_rut(self):
        res_sin_param = self.client.get(f"/api/publico/{self.owner.uuid}/empresas/")
        self.assertEqual(res_sin_param.status_code, 400)

        res_con_param = self.client.get(f"/api/publico/{self.owner.uuid}/empresas/?empresa={self.emp_a.id}")
        self.assertEqual(res_con_param.status_code, 200)
        payload = res_con_param.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["razon_social"], "Empresa Alfa SpA")
        self.assertNotIn("rut", payload[0])
        self.assertEqual(payload[0]["centros_trabajo"][0]["nombre"], "Casa Matriz Alfa")
        self.assertNotIn("direccion", payload[0]["centros_trabajo"][0])

        # UID de otro prevencionista no devuelve empresa de Alfa
        res_ajeno = self.client.get(f"/api/publico/{self.ajeno.uuid}/empresas/?empresa={self.emp_a.id}")
        self.assertEqual(res_ajeno.status_code, 200)
        self.assertEqual(res_ajeno.json(), [])


class Ley21719P1MFATestCase(APITestCase):
    """
    Pruebas de integración para MFA TOTP RFC 6238 y códigos de respaldo (P1.2 / sec-mfa):
    - Enrolamiento QR/otpauth, cifrado en reposo del secreto TOTP y rechazo de replay
    - Login en 2 pasos (challenge_token + TOTP o backup code de un solo uso)
    - Enforcement obligatorio para staff/superuser/corporativos bajo MFA_ENFORCE_PRIVILEGED
    - Bloqueo de desactivación para roles obligatorios y regeneración en individuales
    """

    def setUp(self):
        cache.clear()
        self.corp_user = Usuario.objects.create_user(
            username="mfa_corp",
            email="mfa_corp@hdprevencion.cl",
            password="PasswordFuerte123!",
            tipo_usuario=Usuario.TIPO_CORPORATIVO,
        )
        self.indiv_user = Usuario.objects.create_user(
            username="mfa_indiv",
            email="mfa_indiv@hdprevencion.cl",
            password="PasswordFuerte123!",
            tipo_usuario=Usuario.TIPO_INDIVIDUAL,
        )

    def _login(self, username, password="PasswordFuerte123!"):
        return self.client.post("/api/auth/login/", {"username": username, "password": password})

    def test_enrolamiento_totp_cifrado_y_antireplay(self):
        import time
        from django.db import connection
        from modulo_prevencion.mfa import calcular_totp

        res_login = self._login("mfa_corp")
        self.assertEqual(res_login.status_code, 200)
        self.assertTrue(res_login.json()["mfa_setup_required"])
        headers = {"HTTP_AUTHORIZATION": f"Bearer {res_login.json()['access']}"}

        # 1. Iniciar enrolamiento
        res_init = self.client.post("/api/usuarios/mfa/iniciar/", **headers)
        self.assertEqual(res_init.status_code, 200)
        secret = res_init.json()["secret"]
        self.assertIn("otpauth://totp/", res_init.json()["otpauth_uri"])

        # Confirmación rechaza código inválido
        res_bad = self.client.post("/api/usuarios/mfa/confirmar/", {"code": "000000"}, **headers)
        self.assertEqual(res_bad.status_code, 400)

        # 2. Confirmar con ventana (step - 1) dentro de skew permitido
        base_step = int(time.time() // 30)
        code_confirm = calcular_totp(secret, base_step - 1)
        res_conf = self.client.post("/api/usuarios/mfa/confirmar/", {"code": code_confirm}, **headers)
        self.assertEqual(res_conf.status_code, 200)
        payload = res_conf.json()
        self.assertTrue(payload["user"]["mfa_enabled"])
        self.assertEqual(len(payload["backup_codes"]), 8)
        self.assertEqual(payload["user"]["mfa_backup_codes_remaining"], 8)

        # Secreto almacenado cifrado en BD (enc:v1:...)
        with connection.cursor() as cursor:
            cursor.execute("SELECT mfa_secret, mfa_secret_pendiente FROM modulo_prevencion_usuario WHERE id = %s", [self.corp_user.id])
            raw_secret, raw_pending = cursor.fetchone()
        self.assertTrue(str(raw_secret).startswith("enc:v1:"))
        self.assertEqual(raw_pending, "")

        # 3. Login pide paso 2 sin emitir JWT todavía
        res_step1 = self._login("mfa_corp")
        self.assertEqual(res_step1.status_code, 200)
        step1_data = res_step1.json()
        self.assertTrue(step1_data["mfa_required"])
        self.assertNotIn("access", step1_data)
        self.assertNotIn("refresh_token", res_step1.cookies)
        challenge = step1_data["challenge_token"]

        # Reutilizar exacto código ya usado (anti-replay) falla
        res_replay = self.client.post("/api/auth/mfa/verify/", {"challenge_token": challenge, "code": code_confirm})
        self.assertEqual(res_replay.status_code, 400)

        # Desafío manipulado falla con 401
        res_bad_chal = self.client.post("/api/auth/mfa/verify/", {"challenge_token": "tampered", "code": code_confirm})
        self.assertEqual(res_bad_chal.status_code, 401)

        # 4. Siguiente ventana válida (base_step) completa el login y entrega JWT
        code_login = calcular_totp(secret, base_step)
        res_step2 = self.client.post("/api/auth/mfa/verify/", {"challenge_token": challenge, "code": code_login})
        self.assertEqual(res_step2.status_code, 200)
        self.assertIn("access", res_step2.json())
        self.assertIn("refresh_token", res_step2.cookies)

        # 5. Consumo de código de respaldo de un solo uso
        backup_0 = payload["backup_codes"][0]
        res_step1_b = self._login("mfa_corp")
        res_backup_ok = self.client.post(
            "/api/auth/mfa/verify/",
            {"challenge_token": res_step1_b.json()["challenge_token"], "code": backup_0},
        )
        self.assertEqual(res_backup_ok.status_code, 200)

        # Reusar el mismo código de respaldo falla
        res_step1_c = self._login("mfa_corp")
        res_backup_reuse = self.client.post(
            "/api/auth/mfa/verify/",
            {"challenge_token": res_step1_c.json()["challenge_token"], "code": backup_0},
        )
        self.assertEqual(res_backup_reuse.status_code, 400)

    def test_enforcement_obligatorio_y_gestion_individual(self):
        import time
        from django.test import override_settings
        from modulo_prevencion.mfa import calcular_totp

        headers_corp = {"HTTP_AUTHORIZATION": f"Bearer {self._login('mfa_corp').json()['access']}"}
        headers_indiv = {"HTTP_AUTHORIZATION": f"Bearer {self._login('mfa_indiv').json()['access']}"}

        # Con MFA_ENFORCE_PRIVILEGED=True, cuenta corporativa sin MFA queda bloqueada en módulos operativos
        with override_settings(MFA_ENFORCE_PRIVILEGED=True):
            res_blocked = self.client.get("/api/empresas/", **headers_corp)
            self.assertEqual(res_blocked.status_code, 403)
            self.assertEqual(res_blocked.json().get("code"), "mfa_setup_required")

            # Pero sí puede consultar perfil y enrolar MFA
            self.assertEqual(self.client.get("/api/usuarios/perfil/", **headers_corp).status_code, 200)
            res_init_c = self.client.post("/api/usuarios/mfa/iniciar/", **headers_corp)
            self.assertEqual(res_init_c.status_code, 200)
            base_step = int(time.time() // 30)
            res_conf_c = self.client.post(
                "/api/usuarios/mfa/confirmar/",
                {"code": calcular_totp(res_init_c.json()["secret"], base_step - 1)},
                **headers_corp,
            )
            self.assertEqual(res_conf_c.status_code, 200)

            # Tras activar MFA ya accede normalmente y no puede desactivarlo
            self.assertEqual(self.client.get("/api/empresas/", **headers_corp).status_code, 200)
            res_no_disable = self.client.post(
                "/api/usuarios/mfa/desactivar/",
                {"current_password": "PasswordFuerte123!", "code": calcular_totp(res_init_c.json()["secret"], base_step)},
                **headers_corp,
            )
            self.assertEqual(res_no_disable.status_code, 400)

            # Cuenta individual sin MFA mantiene acceso normal (opcional)
            self.assertEqual(self.client.get("/api/empresas/", **headers_indiv).status_code, 200)

        # Cuenta individual activa, regenera respaldos y desactiva MFA correctamente
        res_init_i = self.client.post("/api/usuarios/mfa/iniciar/", **headers_indiv)
        secret_i = res_init_i.json()["secret"]
        base_step = int(time.time() // 30)
        res_conf_i = self.client.post(
            "/api/usuarios/mfa/confirmar/",
            {"code": calcular_totp(secret_i, base_step - 1)},
            **headers_indiv,
        )
        old_backup = res_conf_i.json()["backup_codes"][0]

        res_regen = self.client.post(
            "/api/usuarios/mfa/regenerar-respaldos/",
            {"current_password": "PasswordFuerte123!", "code": calcular_totp(secret_i, base_step)},
            **headers_indiv,
        )
        self.assertEqual(res_regen.status_code, 200)
        new_backup = res_regen.json()["backup_codes"][0]
        self.assertNotIn(old_backup, res_regen.json()["backup_codes"])

        res_disable = self.client.post(
            "/api/usuarios/mfa/desactivar/",
            {"current_password": "PasswordFuerte123!", "code": new_backup},
            **headers_indiv,
        )
        self.assertEqual(res_disable.status_code, 200)
        self.assertFalse(res_disable.json()["user"]["mfa_enabled"])


class Ley21719P1ConsentTestCase(APITestCase):
    """
    Pruebas de integración para el registro probatorio append-only de consentimientos
    y avisos de privacidad (P1.3 / Art. 12 y 14 ter Ley N° 21.719).
    """

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_registro_exige_consentimiento_y_permite_revocar_marketing(self):
        from .models import RegistroConsentimiento

        # 1. Registro sin acepta_privacidad -> 400
        res_sin_check = self.client.post("/api/auth/register/", {
            "username": "consent_fail",
            "email": "consent_fail@hdprevencion.cl",
            "password": "ClaveSegura#2026!",
            "password_confirm": "ClaveSegura#2026!",
        })
        self.assertEqual(res_sin_check.status_code, 400)
        self.assertIn("acepta_privacidad", res_sin_check.json())

        # 2. Registro válido con marketing opt-in
        res_ok = self.client.post("/api/auth/register/", {
            "username": "consent_ok",
            "email": "consent_ok@hdprevencion.cl",
            "password": "ClaveSegura#2026!",
            "password_confirm": "ClaveSegura#2026!",
            "acepta_privacidad": True,
            "acepta_marketing": True,
        }, HTTP_USER_AGENT="PyTestBrowser/1.0")
        self.assertEqual(res_ok.status_code, 201)
        self.assertTrue(res_ok.json()["user"]["marketing_novedades"])

        eventos_cta = RegistroConsentimiento.objects.filter(
            identificador_titular="consent_ok@hdprevencion.cl",
            flujo=RegistroConsentimiento.FLUJO_REGISTRO_CUENTA,
        )
        self.assertEqual(eventos_cta.count(), 1)
        self.assertEqual(eventos_cta.first().version_politica, "1.0")
        self.assertEqual(len(eventos_cta.first().hash_politica), 64)
        self.assertIn("PyTestBrowser/1.0", eventos_cta.first().user_agent)

        # 3. Revocar consentimiento de novedades crea una nueva fila append-only
        headers = {"HTTP_AUTHORIZATION": f"Bearer {res_ok.json()['tokens']['access']}"}
        res_revocar = self.client.post(
            "/api/usuarios/consentimiento-comunicaciones/",
            {"otorgado": False},
            format="json",
            **headers,
        )
        self.assertEqual(res_revocar.status_code, 200)
        self.assertFalse(res_revocar.json()["user"]["marketing_novedades"])

        historial_mkt = RegistroConsentimiento.objects.filter(
            identificador_titular="consent_ok@hdprevencion.cl",
            flujo=RegistroConsentimiento.FLUJO_MARKETING_NOVEDADES,
        ).order_by("fecha_evento")
        self.assertEqual(historial_mkt.count(), 2)
        self.assertEqual([ev.otorgado for ev in historial_mkt], [True, False])

    def test_contacto_y_cotizacion_capacitacion_exigen_optin(self):
        from .models import RegistroConsentimiento

        # Contacto sin opt-in -> 400
        res_c_fail = self.client.post("/api/contacto/", {
            "nombre": "Visitante",
            "email": "vis@empresa.cl",
            "asunto": "Duda",
            "mensaje": "Texto",
        })
        self.assertEqual(res_c_fail.status_code, 400)
        self.assertIn("acepta_privacidad", res_c_fail.json())

        # Contacto con opt-in -> 201 + evidencia
        res_c_ok = self.client.post("/api/contacto/", {
            "nombre": "Visitante",
            "email": "vis@empresa.cl",
            "asunto": "Duda",
            "mensaje": "Texto",
            "acepta_privacidad": True,
        })
        self.assertEqual(res_c_ok.status_code, 201)
        self.assertTrue(
            RegistroConsentimiento.objects.filter(
                identificador_titular="vis@empresa.cl",
                flujo=RegistroConsentimiento.FLUJO_CONTACTO,
                otorgado=True,
            ).exists()
        )

        # Solicitud de capacitación sin opt-in -> 400
        cap_payload = {
            "empresa": "Minera Sur SpA",
            "rut_empresa": "76.555.444-3",
            "contacto_nombre": "Ana Jefe SST",
            "contacto_email": "ana@minerasur.cl",
            "contacto_telefono": "+56911112222",
            "tipo_capacitacion": "LEY_KARIN",
            "modalidad": "PRESENCIAL",
            "region_comuna": "Antofagasta",
            "cantidad_trabajadores": 25,
        }
        self.assertEqual(self.client.post("/api/solicitudes-capacitacion/", cap_payload).status_code, 400)

        # Con opt-in -> 201 + evidencia
        cap_payload["acepta_privacidad"] = True
        res_cap_ok = self.client.post("/api/solicitudes-capacitacion/", cap_payload)
        self.assertEqual(res_cap_ok.status_code, 201)
        self.assertTrue(
            RegistroConsentimiento.objects.filter(
                identificador_titular="ana@minerasur.cl",
                flujo=RegistroConsentimiento.FLUJO_COTIZACION_CAPACITACION,
                otorgado=True,
            ).exists()
        )

        # PATCH administrativo interno sobre la solicitud no exige re-enviar acepta_privacidad
        staff = Usuario.objects.create_user(
            username="cap_staff",
            email="cap_staff@hdprevencion.cl",
            password="PasswordFuerte123!",
            is_staff=True,
        )
        token_staff = self.client.post("/api/auth/login/", {"username": "cap_staff", "password": "PasswordFuerte123!"}).json()["access"]
        res_patch = self.client.patch(
            f"/api/solicitudes-capacitacion/{res_cap_ok.json()['id']}/",
            {"notas_internas": "Cotización enviada por correo"},
            HTTP_AUTHORIZATION=f"Bearer {token_staff}",
        )
        self.assertEqual(res_patch.status_code, 200)

    def test_buzon_sugerencia_anonima_vs_identificada(self):
        from .models import RegistroConsentimiento

        owner = Usuario.objects.create_user(
            username="buzon_owner",
            email="buzon_owner@hdprevencion.cl",
            password="PasswordFuerte123!",
        )
        emp = Empresa.objects.create(
            prevencionista=owner,
            razon_social="Empresa Buzón SpA",
            rut="76.333.444-5",
        )

        # Anónima no requiere consentimiento
        res_anon = self.client.post(f"/api/publico/{owner.uuid}/buzon/", {
            "tipo_canal": "SUGERENCIA",
            "empresa": emp.id,
            "mensaje": "Sugerencia anónima de mejora",
            "es_anonimo": True,
        }, format="json")
        self.assertEqual(res_anon.status_code, 201)

        # Identificada sin acepta_privacidad -> 400
        res_ident_fail = self.client.post(f"/api/publico/{owner.uuid}/buzon/", {
            "tipo_canal": "SUGERENCIA",
            "empresa": emp.id,
            "mensaje": "Sugerencia con mis datos",
            "es_anonimo": False,
            "nombre_remitente": "Pedro Trabajador",
            "contacto_remitente": "pedro@empresa.cl",
        }, format="json")
        self.assertEqual(res_ident_fail.status_code, 400)

        # Identificada con acepta_privacidad=True -> 201 + evidencia
        res_ident_ok = self.client.post(f"/api/publico/{owner.uuid}/buzon/", {
            "tipo_canal": "SUGERENCIA",
            "empresa": emp.id,
            "mensaje": "Sugerencia con mis datos",
            "es_anonimo": False,
            "nombre_remitente": "Pedro Trabajador",
            "contacto_remitente": "pedro@empresa.cl",
            "acepta_privacidad": True,
        }, format="json")
        self.assertEqual(res_ident_ok.status_code, 201)
        self.assertTrue(
            RegistroConsentimiento.objects.filter(
                identificador_titular="pedro@empresa.cl",
                flujo=RegistroConsentimiento.FLUJO_SUGERENCIA_IDENTIFICADA,
                otorgado=True,
            ).exists()
        )


class Ley21719P1RetencionYOperacionTestCase(APITestCase):
    """
    Pruebas para operación ARCO-POL, registro de brechas y retención/purga automática
    (P1.4 / Arts. 4–11, 14 sexies y 7 Ley N° 21.719).
    """

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_admin_registra_arco_brechas_y_consentimiento(self):
        from django.contrib import admin
        from .models import RegistroBrechaSeguridad, RegistroConsentimiento, SolicitudDerechoARCO

        self.assertIn(SolicitudDerechoARCO, admin.site._registry)
        self.assertIn(RegistroBrechaSeguridad, admin.site._registry)
        self.assertIn(RegistroConsentimiento, admin.site._registry)

    def test_arco_bloqueo_y_seguimiento_por_uuid(self):
        from .models import SolicitudDerechoARCO

        res_create = self.client.post("/api/privacidad/solicitar-derecho/", {
            "tipo_derecho": SolicitudDerechoARCO.TIPO_BLOQUEO,
            "rut_titular": "12.345.678-5",
            "nombre_titular": "Titular Bloqueo",
            "email_titular": "bloqueo@empresa.cl",
            "detalle_solicitud": "Solicito suspensión temporal de tratamiento.",
        }, format="json")
        self.assertEqual(res_create.status_code, 201)
        uuid_sol = res_create.json()["uuid"]

        res_status = self.client.get(f"/api/privacidad/consultar-derecho/{uuid_sol}/")
        self.assertEqual(res_status.status_code, 200)
        data = res_status.json()
        self.assertEqual(data["estado"], SolicitudDerechoARCO.ESTADO_PENDIENTE)
        self.assertTrue(data["bloqueo_provisional_activo"])
        self.assertNotIn("rut_titular", data)
        self.assertNotIn("email_titular", data)

    def test_comando_purga_respeta_retencion_sst_y_bloqueos_arco(self):
        from datetime import timedelta
        from django.core.management import call_command
        from django.core.management.base import CommandError
        from .models import MensajeContacto, SolicitudCapacitacion, SolicitudDerechoARCO

        ahora = timezone.now()
        hace_400d = ahora - timedelta(days=400)
        hace_120d = ahora - timedelta(days=120)
        hace_2000d = ahora - timedelta(days=2000)

        # Rechaza bajar el mínimo legal de 5 años (1825 días) en SST
        with self.assertRaises(CommandError):
            call_command("purgar_datos_vencidos", dias_sst=365)

        # 1. Mensaje vencido (> 12m) vs reciente vs protegido por bloqueo ARCO
        m_vencido = MensajeContacto.objects.create(nombre="Old", email="old@test.cl", asunto="A", mensaje="M")
        MensajeContacto.objects.filter(id=m_vencido.id).update(fecha_creacion=hace_400d)

        m_bloqueado = MensajeContacto.objects.create(nombre="Lock", email="lock@test.cl", asunto="A", mensaje="M")
        MensajeContacto.objects.filter(id=m_bloqueado.id).update(fecha_creacion=hace_400d)
        SolicitudDerechoARCO.objects.create(
            tipo_derecho=SolicitudDerechoARCO.TIPO_BLOQUEO,
            rut_titular="14.444.555-6",
            nombre_titular="Lock",
            email_titular="lock@test.cl",
            detalle_solicitud="Bloqueo provisional",
            bloqueo_provisional_activo=True,
        )

        m_reciente = MensajeContacto.objects.create(nombre="New", email="new@test.cl", asunto="A", mensaje="M")

        # 2. Cotizaciones > 12m: pendiente se purga, finalizada se conserva
        s_vencida = SolicitudCapacitacion.objects.create(
            empresa="Emp Antigua", rut_empresa="76.111.111-1",
            contacto_nombre="C1", contacto_email="c1@test.cl", contacto_telefono="+5691",
            region_comuna="Santiago", estado=SolicitudCapacitacion.ESTADO_PENDIENTE,
        )
        SolicitudCapacitacion.objects.filter(id=s_vencida.id).update(fecha_creacion=hace_400d)

        s_finalizada = SolicitudCapacitacion.objects.create(
            empresa="Emp Ejecutada", rut_empresa="76.222.222-2",
            contacto_nombre="C2", contacto_email="c2@test.cl", contacto_telefono="+5692",
            region_comuna="Santiago", estado=SolicitudCapacitacion.ESTADO_FINALIZADO,
        )
        SolicitudCapacitacion.objects.filter(id=s_finalizada.id).update(fecha_creacion=hace_400d)

        # 3. Cuenta desactivada > 90 días sin SST vs Trabajador desvinculado > 5 años
        u_inactivo = Usuario.objects.create_user(
            username="inactivo_antiguo", email="inact@test.cl",
            password="PasswordFuerte123!", is_active=False,
        )
        Usuario.objects.filter(id=u_inactivo.id).update(date_joined=hace_120d)

        owner_sst = Usuario.objects.create_user(username="sst_owner", email="sst@test.cl", password="PasswordFuerte123!")
        emp_sst = Empresa.objects.create(prevencionista=owner_sst, razon_social="SST SpA", rut="76.888.999-K")
        trab_antiguo = Trabajador.objects.create(
            empresa=emp_sst, rut="13.222.333-4",
            nombres="Juan", apellidos="Antiguo", estado=Trabajador.ESTADO_DESVINCULADO,
        )
        Trabajador.objects.filter(id=trab_antiguo.id).update(fecha_creacion=hace_2000d)

        # Dry-run no modifica nada
        call_command("purgar_datos_vencidos", dry_run=True, incluir_sst=True)
        self.assertTrue(MensajeContacto.objects.filter(id=m_vencido.id).exists())

        # Ejecución real
        call_command("purgar_datos_vencidos", incluir_sst=True)

        self.assertFalse(MensajeContacto.objects.filter(id=m_vencido.id).exists())
        self.assertTrue(MensajeContacto.objects.filter(id=m_bloqueado.id).exists())
        self.assertTrue(MensajeContacto.objects.filter(id=m_reciente.id).exists())

        self.assertFalse(SolicitudCapacitacion.objects.filter(id=s_vencida.id).exists())
        self.assertTrue(SolicitudCapacitacion.objects.filter(id=s_finalizada.id).exists())

        u_inactivo.refresh_from_db()
        self.assertTrue(u_inactivo.username.startswith("anon_user_"))

        trab_antiguo.refresh_from_db()
        self.assertEqual(trab_antiguo.nombres, "Titular Anonimizado")
        self.assertTrue(trab_antiguo.rut.startswith("ANON-"))


class Ley21719P2ObservabilityTestCase(APITestCase):
    """
    Pruebas automatizadas de remediaciones P2 Ley N° 21.719:
    - Cifrado ampliado en reposo (DenunciaLeyKarin, InvestigacionAccidente, EntregaEPP) + filtro en portabilidad.
    - Comando cifrar_y_rotar_campos (--dry-run y cifrado real de texto plano legado).
    - HIBPPasswordValidator (k-anonymity SHA-1 y comportamiento fail-open offline).
    - AuditLogEventoSeguridad append-only transversal y registro read-only en Django Admin.
    """
    client: Any

    def setUp(self):
        cache.clear()
        self.password = "ClaveSeguraP2!2026"
        self.owner = Usuario.objects.create_user(
            username="p2_owner",
            email="p2_owner@hdprevencion.cl",
            password=self.password,
            tipo_usuario=Usuario.TIPO_INDIVIDUAL,
        )
        self.empresa = Empresa.objects.create(
            prevencionista=self.owner,
            razon_social="Empresa Observabilidad SpA",
            rut="76.999.888-7",
        )
        self.centro = CentroTrabajo.objects.create(
            empresa=self.empresa,
            nombre="Planta P2",
            direccion="Av. Seguridad 100",
        )
        self.trabajador = Trabajador.objects.create(
            empresa=self.empresa,
            centro_trabajo=self.centro,
            rut="15.111.222-3",
            nombres="Camila",
            apellidos="Verificada",
            cargo="Operadora",
        )

    def tearDown(self):
        cache.clear()

    def test_cifrado_reposo_ampliado_y_portabilidad_python_filter(self):
        denuncia = DenunciaLeyKarin.objects.create(
            empresa=self.empresa,
            centro_trabajo=self.centro,
            tipo_afectacion=DenunciaLeyKarin.TIPO_ACOSO_LABORAL,
            rut_denunciante="14.555.666-8",
            nombre_denunciante="Denunciante Reservado",
            correo_denunciante="reservado@test.cl",
            telefono_denunciante="+56912345678",
            nombre_denunciado="Jefatura Denunciada",
            cargo_area_denunciado="Operaciones",
            descripcion_circunstanciada="Relato confidencial de hechos.",
        )
        accidente = InvestigacionAccidente.objects.create(
            usuario=self.owner,
            empresa=self.empresa,
            trabajador=self.trabajador,
            nombre_afectado="Camila Verificada",
            rut_afectado="15.111.222-3",
            cargo_afectado="Operadora",
            edad_afectado=32,
            antiguedad_afectado="3 años",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=timezone.now(),
            lugar_evento="Zona de Carga",
            descripcion_evento="Tropezón con bandeja.",
            tipo_lesion="Contusión Lumbar",
            parte_cuerpo_afectada="Zona Lumbar",
        )
        entrega = EntregaEPP.objects.create(
            empresa=self.empresa,
            centro_trabajo=self.centro,
            trabajador=self.trabajador,
            responsable_entrega=self.owner,
            items_epp=[{"tipo": "Casco", "marca_modelo": "V-Gard", "cantidad": 1, "motivo": "ENTREGA_INICIAL"}],
            firma_digital="data:image/png;base64,FIRMA_EN_REPOSO_SECRET_999",
        )

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT rut_denunciante, nombre_denunciante, correo_denunciante, telefono_denunciante, "
                "nombre_denunciado, cargo_area_denunciado "
                "FROM modulo_prevencion_denuncialeykarin WHERE id = %s",
                [denuncia.pk],
            )
            row_den = cursor.fetchone()
            for raw_col in row_den:
                self.assertTrue(str(raw_col).startswith("enc:v1:"), f"Columna sin prefijo cifrado: {raw_col}")
            self.assertNotIn("Denunciante Reservado", "".join(row_den))
            self.assertNotIn("14.555.666-8", "".join(row_den))

            cursor.execute(
                "SELECT nombre_afectado, rut_afectado, tipo_lesion, parte_cuerpo_afectada "
                "FROM modulo_prevencion_investigacionaccidente WHERE id = %s",
                [accidente.pk],
            )
            row_acc = cursor.fetchone()
            for raw_col in row_acc:
                self.assertTrue(str(raw_col).startswith("enc:v1:"))
            self.assertNotIn("Contusión Lumbar", "".join(row_acc))
            self.assertNotIn("15.111.222-3", "".join(row_acc))

            cursor.execute(
                "SELECT firma_digital FROM modulo_prevencion_entregaepp WHERE id = %s",
                [entrega.pk],
            )
            raw_firma = cursor.fetchone()[0]
            self.assertTrue(raw_firma.startswith("enc:v1:"))
            self.assertNotIn("FIRMA_EN_REPOSO_SECRET_999", raw_firma)

        # Lectura ORM descifra transparently
        denuncia.refresh_from_db()
        accidente.refresh_from_db()
        entrega.refresh_from_db()
        self.assertEqual(denuncia.correo_denunciante, "reservado@test.cl")
        self.assertEqual(accidente.tipo_lesion, "Contusión Lumbar")
        self.assertEqual(entrega.firma_digital, "data:image/png;base64,FIRMA_EN_REPOSO_SECRET_999")

        # Portabilidad sigue ubicando accidentes por rut_afectado cifrado vía filtro en Python
        self.client.force_authenticate(user=self.owner)
        res_port = self.client.get(reverse('privacidad_portabilidad') + "?rut=15.111.222-3")
        self.assertEqual(res_port.status_code, status.HTTP_200_OK)
        accidentes_exportados = res_port.json()["investigaciones_accidentes"]
        self.assertEqual(len(accidentes_exportados), 1)
        self.assertEqual(accidentes_exportados[0]["tipo_lesion"], "Contusión Lumbar")

    def test_comando_cifrar_y_rotar_campos_legacy_plaintext(self):
        accidente = InvestigacionAccidente.objects.create(
            usuario=self.owner,
            empresa=self.empresa,
            trabajador=self.trabajador,
            nombre_afectado="Valor Inicial",
            rut_afectado="15.111.222-3",
            cargo_afectado="Operadora",
            edad_afectado=29,
            antiguedad_afectado="1 año",
            tipo_evento=InvestigacionAccidente.TIPO_TRABAJO,
            fecha_hora_evento=timezone.now(),
            lugar_evento="Patio",
            descripcion_evento="Desc inicial",
            tipo_lesion="Herida leve",
            parte_cuerpo_afectada="Mano",
        )
        # Simula dato legado previo al cifrado directamente en SQL
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE modulo_prevencion_investigacionaccidente SET nombre_afectado = %s WHERE id = %s",
                ["Nombre Plano Legado", accidente.pk],
            )

        call_command("cifrar_y_rotar_campos", dry_run=True)
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT nombre_afectado FROM modulo_prevencion_investigacionaccidente WHERE id = %s",
                [accidente.pk],
            )
            self.assertEqual(cursor.fetchone()[0], "Nombre Plano Legado")

        call_command("cifrar_y_rotar_campos")
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT nombre_afectado FROM modulo_prevencion_investigacionaccidente WHERE id = %s",
                [accidente.pk],
            )
            raw_migrado = cursor.fetchone()[0]
            self.assertTrue(raw_migrado.startswith("enc:v1:"))

        accidente.refresh_from_db()
        self.assertEqual(accidente.nombre_afectado, "Nombre Plano Legado")

    def test_hibp_validator_k_anonymity_y_fail_open(self):
        compromised_pwd = "CompromisedPwd!2026"
        sha1_hex = hashlib.sha1(compromised_pwd.encode("utf-8")).hexdigest().upper()
        suffix = sha1_hex[5:]

        validator = HIBPPasswordValidator()

        # Deshabilitado por defecto: no debe realizar petición HTTP
        with override_settings(HIBP_CHECK_ENABLED=False):
            with patch("urllib.request.urlopen") as mock_open:
                validator.validate(compromised_pwd)
                mock_open.assert_not_called()

        # Habilitado y coincidencia en rango HIBP: rechaza contraseña
        mock_resp = MagicMock()
        mock_resp.read.return_value = f"00000AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1\n{suffix}:15\n".encode("utf-8")
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)

        with override_settings(HIBP_CHECK_ENABLED=True):
            with patch("urllib.request.urlopen", return_value=mock_resp):
                with self.assertRaises(DjangoValidationError):
                    validator.validate(compromised_pwd)

            # Sin coincidencia de sufijo: permite continuar
            mock_safe = MagicMock()
            mock_safe.read.return_value = b"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:3\n"
            mock_safe.__enter__ = MagicMock(return_value=mock_safe)
            mock_safe.__exit__ = MagicMock(return_value=False)
            with patch("urllib.request.urlopen", return_value=mock_safe):
                validator.validate(compromised_pwd)

            # Timeout / falla de red: comportamiento fail-open controlado
            with patch("urllib.request.urlopen", side_effect=TimeoutError("hibp timeout")):
                validator.validate(compromised_pwd)

    def test_audit_log_seguridad_transversal_y_admin_inmutable(self):
        from django.contrib import admin as django_admin

        # 1. Login fallido y login exitoso
        res_fail = self.client.post(reverse("token_obtain_pair"), {
            "username": "p2_owner",
            "password": "WrongPassword999!",
        })
        self.assertEqual(res_fail.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="LOGIN_FAIL", exito=False).exists())

        res_ok = self.client.post(reverse("token_obtain_pair"), {
            "username": "p2_owner",
            "password": self.password,
        })
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="LOGIN_OK", usuario=self.owner, exito=True).exists())

        # 2. Enrolamiento y verificación MFA
        self.client.force_authenticate(user=self.owner)
        res_init = self.client.post("/api/usuarios/mfa/iniciar/")
        self.assertEqual(res_init.status_code, status.HTTP_200_OK)
        current_step = int(time.time() // TOTP_PERIOD_SECONDS)
        totp_code = calcular_totp(res_init.data["secret"], current_step - 1)
        res_confirm = self.client.post("/api/usuarios/mfa/confirmar/", {"code": totp_code})
        self.assertEqual(res_confirm.status_code, status.HTTP_200_OK)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="MFA_ENABLED", exito=True).exists())

        # Segundo factor por challenge_token + auth_mfa_verify
        self.client.force_authenticate(user=None)
        res_challenge = self.client.post(reverse("token_obtain_pair"), {
            "username": "p2_owner",
            "password": self.password,
        })
        self.assertEqual(res_challenge.status_code, status.HTTP_200_OK)
        challenge_token = res_challenge.data["challenge_token"]
        self.owner.refresh_from_db()
        res_mfa_bad = self.client.post(reverse("auth_mfa_verify"), {
            "challenge_token": challenge_token,
            "code": "000000",
        })
        self.assertEqual(res_mfa_bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="MFA_FAIL", exito=False).exists())

        # Para evitar colisión anti-replay en el mismo step de 30s usamos un backup code
        backup_code = res_confirm.data["backup_codes"][0]
        res_mfa_ok = self.client.post(reverse("auth_mfa_verify"), {
            "challenge_token": challenge_token,
            "code": backup_code,
        })
        self.assertEqual(res_mfa_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="MFA_OK", exito=True).exists())

        # 3. Cambio de contraseña y Portabilidad
        self.client.force_authenticate(user=self.owner)
        res_pwd = self.client.patch(reverse("usuario-perfil"), {
            "current_password": self.password,
            "password": "NuevaClaveFuerteP2!2026",
            "password_confirm": "NuevaClaveFuerteP2!2026",
        }, format="json")
        self.assertEqual(res_pwd.status_code, status.HTTP_200_OK)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="PASSWORD_CHANGE", exito=True).exists())

        res_port = self.client.get(reverse("privacidad_portabilidad"))
        self.assertEqual(res_port.status_code, status.HTTP_200_OK)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="EXPORT_PORTABILIDAD", categoria="ARCO", exito=True).exists())

        # 4. CRUD SST crítico (Trabajador, Accidente, EntregaEPP)
        res_trab_create = self.client.post(reverse("trabajador-list"), {
            "empresa": self.empresa.id,
            "centro_trabajo": self.centro.id,
            "rut": "16.222.333-K",
            "nombres": "Diego",
            "apellidos": "Auditor",
            "cargo": "Técnico",
        }, format="json")
        self.assertEqual(res_trab_create.status_code, status.HTTP_201_CREATED)
        trab_id = res_trab_create.data["id"]
        res_trab_upd = self.client.patch(reverse("trabajador-detail", args=[trab_id]), {"cargo": "Supervisor"}, format="json")
        self.assertEqual(res_trab_upd.status_code, status.HTTP_200_OK)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="TRABAJADOR_CREATE", recurso_id=str(trab_id)).exists())
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="TRABAJADOR_UPDATE", recurso_id=str(trab_id)).exists())

        res_acc = self.client.post(reverse("investigacionaccidente-list"), {
            "empresa": self.empresa.id,
            "trabajador": trab_id,
            "nombre_afectado": "Diego Auditor",
            "rut_afectado": "16.222.333-K",
            "cargo_afectado": "Supervisor",
            "edad_afectado": 34,
            "antiguedad_afectado": "2 años",
            "tipo_evento": InvestigacionAccidente.TIPO_INCIDENTE,
            "fecha_hora_evento": timezone.now().isoformat(),
            "lugar_evento": "Bodega",
            "descripcion_evento": "Casi accidente sin lesión.",
            "tipo_lesion": "Sin lesión",
            "parte_cuerpo_afectada": "Ninguna",
        }, format="json")
        self.assertEqual(res_acc.status_code, status.HTTP_201_CREATED)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="ACCIDENTE_CREATE", recurso_id=str(res_acc.data["id"])).exists())

        res_epp = self.client.post(reverse("entregaepp-list"), {
            "empresa": self.empresa.id,
            "centro_trabajo": self.centro.id,
            "trabajador": trab_id,
            "items_epp": [{"tipo": "Casco", "marca_modelo": "3M", "cantidad": 1, "motivo": "ENTREGA_INICIAL"}],
            "entrega_riohs": False,
            "declaracion_capacitacion": True,
            "firma_digital": "data:image/png;base64,ABC123SIGNATURE",
        }, format="json")
        self.assertEqual(res_epp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(AuditLogEventoSeguridad.objects.filter(accion="EPP_CREATE", recurso_id=str(res_epp.data["id"])).exists())

        # 5. Registro en Django Admin append-only (sin add/change/delete)
        admin_cls = django_admin.site._registry.get(AuditLogEventoSeguridad)
        self.assertIsNotNone(admin_cls)
        fake_req = MagicMock()
        self.assertFalse(admin_cls.has_add_permission(fake_req))
        self.assertFalse(admin_cls.has_change_permission(fake_req))
        self.assertFalse(admin_cls.has_delete_permission(fake_req))











