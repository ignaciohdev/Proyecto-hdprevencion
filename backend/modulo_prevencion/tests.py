from datetime import timedelta
from typing import Any
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from .models import TemaCapacitacion, RegistroCapacitacion, Plan, Suscripcion, Usuario

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

