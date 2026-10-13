from datetime import timedelta
from typing import Any
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
    RequisitoLegalBase, MatrizLegal, ItemMatrizLegal
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
        
        # 1. Petición pública sin credenciales
        self.client.credentials()
        payload = {
            "nombre": "Pedro Rojas",
            "rut": "15.456.789-0",
            "firma": "data:image/png;base64,iVBORw0KGgoAAAANS..." # base64 simulado
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar en base de datos que se haya agregado
        registro.refresh_from_db()
        self.assertEqual(len(registro.asistentes), 1)
        self.assertEqual(registro.asistentes[0]['nombre'], "Pedro Rojas")
        self.assertTrue(registro.asistentes[0]['firma'].startswith("data:image/"))

        # 2. Intentar registrar el mismo RUT
        response_duplicado = self.client.post(url, payload, format='json')
        self.assertEqual(response_duplicado.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response_duplicado.data)

        # 3. Intentar registrar con campos vacíos
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
        
        trabajador_1 = {"nombre": "Juan Perez", "rut": "12.345.678-9", "firma": "data:image/png;base64,aaaa"}
        trabajador_2 = {"nombre": "Maria Soto", "rut": "9.876.543-2", "firma": "data:image/png;base64,bbbb"}
        
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
        """Valida que al crear una denuncia se asignen 72 horas legales y el semáforo sea VERDE inicialmente."""
        self.assertIsNotNone(self.denuncia_a.plazo_limite_derivacion_dt)
        diff = self.denuncia_a.plazo_limite_derivacion_dt - self.denuncia_a.fecha_hora_ingreso
        self.assertAlmostEqual(diff.total_seconds() / 3600, 72.0, delta=0.5)
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





