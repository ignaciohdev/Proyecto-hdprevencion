from datetime import timedelta
from typing import Any
import json
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.utils import timezone
from django.core.cache import cache
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
    MatrizRiesgoMiper, ItemMatrizRiesgo
)
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






