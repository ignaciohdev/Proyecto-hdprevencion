from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from .models import TemaCapacitacion, RegistroCapacitacion, Plan, Suscripcion

Usuario = get_user_model()

class CapacitacionIntegrationTestCase(APITestCase):
    """
    Casos de prueba integrales para verificar el correcto funcionamiento
    del Módulo de Capacitaciones y Seguimiento de Cumplimiento (PAC).
    """

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

        # Autenticar al cliente para las llamadas API
        self.client.login(username="prevencionista_test", password="securepassword123")
        # Generar token JWT para cabecera si fuera necesario
        response = self.client.post(reverse('token_obtain_pair'), {
            'username': 'prevencionista_test',
            'password': 'securepassword123'
        })
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_ciclo_completo_capacitacion(self):
        """
        Prueba el flujo completo:
        1. Crear tema de capacitación
        2. Programar una sesión
        3. Validar estado inicial en PROGRAMADA
        4. Finalizar sesión (agregar firmas y observaciones)
        5. Validar que pase a REALIZADA
        6. Validar que las estadísticas del dashboard reflejen el avance
        """
        # 1. Crear Tema de Capacitación
        tema_data = {
            "titulo": "Uso Correcto de EPP",
            "descripcion": "Charla obligatoria sobre el uso y mantenimiento de EPP según normativa.",
            "categoria": TemaCapacitacion.CATEGORIA_CHARLA,
            "duracion_minutos": 15,
            "contenido_clave": ["Casco", "Lentes de seguridad", "Zapatos de seguridad"]
        }
        url_temas = reverse('temacapacitacion-list')
        response_tema = self.client.post(url_temas, tema_data, format='json')
        self.assertEqual(response_tema.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response_tema.data['titulo'], "Uso Correcto de EPP")
        
        tema_id = response_tema.data['id']

        # 2. Programar Sesión de Capacitación
        fecha_prog = (timezone.now() + timezone.timedelta(days=2)).date()
        registro_data = {
            "tema": tema_id,
            "fecha_programada": str(fecha_prog),
            "lugar": "Sala de Reuniones Central",
            "estado": RegistroCapacitacion.ESTADO_PROGRAMADA,
            "asistentes": []
        }
        url_registros = reverse('registrocapacitacion-list')
        response_registro = self.client.post(url_registros, registro_data, format='json')
        self.assertEqual(response_registro.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response_registro.data['estado'], RegistroCapacitacion.ESTADO_PROGRAMADA)
        
        registro_id = response_registro.data['id']

        # 3. Finalizar Charla en Terreno (Recolección de Firmas)
        asistentes_data = [
            {"nombre": "Juan Perez", "rut": "12.345.678-9", "firma": "Juan Perez"},
            {"nombre": "Maria Soto", "rut": "9.876.543-2", "firma": "Maria Soto"}
        ]
        finalizar_url = reverse('registrocapacitacion-finalizar', kwargs={'pk': registro_id})
        payload_finalizar = {
            "asistentes": asistentes_data,
            "observaciones": "Se realizó capacitación interactiva con demostración práctica."
        }
        response_finalizar = self.client.patch(finalizar_url, payload_finalizar, format='json')
        self.assertEqual(response_finalizar.status_code, status.HTTP_200_OK)
        self.assertEqual(response_finalizar.data['estado'], RegistroCapacitacion.ESTADO_REALIZADA)
        self.assertEqual(len(response_finalizar.data['asistentes']), 2)
        self.assertIsNotNone(response_finalizar.data['fecha_realizacion'])

        # 4. Validar Actualización en el Dashboard de Indicadores
        url_stats = reverse('dashboard_stats')
        response_stats = self.client.get(url_stats)
        self.assertEqual(response_stats.status_code, status.HTTP_200_OK)
        
        # Verificar estructura de respuesta de capacitaciones
        cap_stats = response_stats.data.get('capacitaciones')
        self.assertIsNotNone(cap_stats)
        self.assertEqual(cap_stats['total'], 1)
        self.assertEqual(cap_stats['realizadas'], 1)
        self.assertEqual(cap_stats['programadas'], 0)
        self.assertEqual(cap_stats['asistentes_alcanzados'], 2)
        self.assertEqual(cap_stats['cumplimiento_pac'], 100.0)
        self.assertEqual(len(cap_stats['historial']), 1)
        self.assertEqual(cap_stats['historial'][0]['tema_titulo'], "Uso Correcto de EPP")

    def test_intentar_finalizar_ya_realizada(self):
        """
        Verifica que no se pueda volver a finalizar una capacitación que ya está en estado REALIZADA.
        """
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

        finalizar_url = reverse('registrocapacitacion-finalizar', kwargs={'pk': registro.id})
        response = self.client.patch(finalizar_url, {"asistentes": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
