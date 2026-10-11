import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from modulo_prevencion.models import PlantillaMaestra, Servicio, Noticia, Plan, PlantillaInspeccion, TemaCapacitacion
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.utils import timezone

Usuario = get_user_model()

def seed():
    print("Iniciando sembrado de datos en la base de datos...")

    # 1. Asegurar la existencia de los 4 Planes de Suscripción
    planes_data = [
        {
            'codigo': 'basico',
            'nombre': 'Plan Básico',
            'precio': 0.00,
            'edicion_nube': False,
            'marca_agua': True,
            'marca_blanca': False,
            'limite_semanal': 5,
            'asientos': 1,
            'acceso_servicios': False
        },
        {
            'codigo': 'profesional',
            'nombre': 'Plan Profesional',
            'precio': 14900.00,
            'edicion_nube': True,
            'marca_agua': False,
            'marca_blanca': False,
            'limite_semanal': 20,
            'asientos': 1,
            'acceso_servicios': True
        },
        {
            'codigo': 'expert',
            'nombre': 'Plan Expert',
            'precio': 34900.00,
            'edicion_nube': True,
            'marca_agua': False,
            'marca_blanca': False,
            'limite_semanal': 50,
            'asientos': 1,
            'acceso_servicios': True
        },
        {
            'codigo': 'consultora',
            'nombre': 'Plan Consultora',
            'precio': 79900.00,
            'edicion_nube': True,
            'marca_agua': False,
            'marca_blanca': True,
            'limite_semanal': 999999,
            'asientos': 5,
            'acceso_servicios': True
        }
    ]

    for p_info in planes_data:
        plan, created = Plan.objects.update_or_create(
            codigo=p_info['codigo'],
            defaults={
                'nombre': p_info['nombre'],
                'precio': p_info['precio'],
                'edicion_nube': p_info['edicion_nube'],
                'marca_agua': p_info['marca_agua'],
                'marca_blanca': p_info['marca_blanca'],
                'limite_semanal': p_info['limite_semanal'],
                'asientos': p_info['asientos'],
                'acceso_servicios': p_info['acceso_servicios']
            }
        )
        if created:
            print(f"Plan '{plan.nombre}' creado.")
        else:
            print(f"Plan '{plan.nombre}' actualizado.")

    # 2. Plantillas Maestras
    plantillas_data = [
        ("Matriz IPER General", "XLSX", "matriz_iper_base.xlsx"),
        ("Protocolo TMERT Paso a Paso", "DOCX", "protocolo_tmert_base.docx"),
        ("Plan de Emergencia Pyme", "PDF", "plan_emergencia_base.pdf"),
        ("Política de Seguridad y Salud en el Trabajo", "DOCX", "SGI-PLT-02 POLÍTICA DE SEGURIDAD Y SALUD EN EL TRABAJO_PLACEHOLDERS.docx")
    ]

    for nombre, tipo, archivo_nombre in plantillas_data:
        pm, created = PlantillaMaestra.objects.get_or_create(
            nombre=nombre,
            defaults={
                'tipo_archivo': tipo,
            }
        )
        
        # Intentar cargar el archivo real si existe
        import os
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        src_file_path = os.path.join(base_dir, 'plantillas_maestras', archivo_nombre)
        
        if os.path.exists(src_file_path):
            with open(src_file_path, 'rb') as f:
                pm.archivo_fuente.save(archivo_nombre, ContentFile(f.read()), save=True)
            print(f"Plantilla '{nombre}' actualizada con archivo real: {archivo_nombre}")
        elif created:
            pm.archivo_fuente.save(archivo_nombre, ContentFile(b"Placeholder de plantilla maestra oficial"), save=True)
            print(f"Plantilla '{nombre}' creada con archivo placeholder.")
        pm.save()

    # 3. Servicios
    servicios_data = [
        ("Evaluación Ergónomica de Puestos de Trabajo", 
         "Estudio detallado de las condiciones ergonómicas en oficinas y faenas industriales para prevenir lesiones músculo-esqueléticas bajo la norma técnica TMERT.", 
         "activity"),
        ("Asesoría en Constitución de Comité Paritario", 
         "Guía legal completa y acompañamiento para la constitución y correcto funcionamiento del Comité Paritario de Higiene y Seguridad (DS 54).", 
         "users"),
        ("Auditoría de Sistemas de Gestión (Suso / ISO 45001)", 
         "Evaluación del sistema de gestión de seguridad y salud en el trabajo para identificar brechas de cumplimiento respecto al estándar internacional ISO 45001.", 
         "clipboard-list"),
        ("Capacitaciones Obligatorias de Seguridad (ODI)", 
         "Diseño y realización de la Obligación de Informar (ODI / DAS) para el personal de su empresa, asegurando el cumplimiento legal ante fiscalizaciones.", 
         "book-open")
    ]

    for nombre, desc, icono in servicios_data:
        srv, created = Servicio.objects.get_or_create(
            nombre=nombre,
            defaults={
                'descripcion': desc,
                'icono': icono,
                'activo': True
            }
        )
        if created:
            print(f"Servicio '{nombre}' creado.")
        else:
            print(f"Servicio '{nombre}' ya existe.")

    # 4. Noticias
    admin_user = Usuario.objects.filter(is_superuser=True).first()
    if admin_user:
        noticias_data = [
            ("Nueva Ley de Subcontratación en Chile", 
             "Conoce los aspectos clave y obligaciones para empresas principales", 
             "La Inspección del Trabajo ha publicado un dictamen donde detalla las nuevas exigencias de fiscalización para las empresas que subcontratan servicios, haciendo énfasis en la responsabilidad solidaria de la seguridad en faenas.", 
             "REGULACION"),
            ("Tecnología Wearable en la Minería", 
             "El uso de pulseras inteligentes para prevenir fatiga laboral", 
             "Diversas mineras en el norte de Chile han comenzado a implementar dispositivos wearables en sus operadores para monitorear fatiga, ritmos cardíacos y prevenir accidentes graves durante los turnos de noche.", 
             "INNOVACION"),
            ("Uso Obligatorio de Elementos de Protección Personal", 
             "Guía rápida para la selección correcta de cascos y calzado de seguridad", 
             "Recordamos a todas las empresas adheridas que el Decreto Supremo 594 exige que todo elemento de protección personal (EPP) entregado a los trabajadores cuente con la certificación del ISP o ente autorizador.", 
             "CONSEJO")
        ]
        
        for titulo, subtitulo, cont, cat in noticias_data:
            noticia, created = Noticia.objects.get_or_create(
                titulo=titulo,
                defaults={
                    'subtitulo': subtitulo,
                    'contenido': cont,
                    'categoria': cat,
                    'autor': admin_user,
                    'estado': 'PUBLICADO'
                }
            )
            if created:
                print(f"Noticia '{titulo}' creada.")
            else:
                print(f"Noticia '{titulo}' ya existe.")
    else:
        print("No se encontró ningún superusuario para asignar como autor de las noticias. Por favor, crea un superusuario primero.")

    # 5. Plantillas de Inspección (Fase 1)
    plantillas_inspeccion_data = [
        {
            'nombre': 'Inspección de Extintores',
            'descripcion': 'Control mensual de estado y operatividad de extintores portátiles (DS 594).',
            'preguntas': [
                '¿El extintor se encuentra en la ubicación asignada y señalizada?',
                '¿El acceso al extintor se encuentra totalmente despejado?',
                '¿El manómetro indica presión correcta (aguja en zona verde)?',
                '¿El pasador de seguridad y el sello de plástico están intactos?',
                '¿La manguera y la boquilla están en buen estado y libres de obstrucciones?',
                '¿La etiqueta de mantención y recarga anual está vigente?',
                '¿El cilindro no presenta abolladuras, corrosión ni daños visibles?'
            ]
        },
        {
            'nombre': 'Inspección de Orden y Aseo (5S)',
            'descripcion': 'Evaluación periódica de las condiciones de limpieza, orden y despeje de áreas.',
            'preguntas': [
                '¿Los pasillos de tránsito y salidas de emergencia se encuentran despejados?',
                '¿La iluminación del área es suficiente y se encuentra operativa?',
                '¿Las herramientas y materiales se guardan ordenadamente al terminar la jornada?',
                '¿Los residuos están segregados y depositados en sus respectivos contenedores?',
                '¿Los cables eléctricos se encuentran canalizados o protegidos de pisadas/tránsito?',
                '¿Los pisos se encuentran limpios, secos y libres de derrames o aceite?'
            ]
        },
        {
            'nombre': 'Inspección de Uso de EPP',
            'descripcion': 'Verificación de la utilización obligatoria y estado de los Elementos de Protección Personal.',
            'preguntas': [
                '¿Los trabajadores utilizan calzado de seguridad con puntera de acero en el área?',
                '¿Se utilizan antiparras/lentes de seguridad en tareas con riesgo de proyección de partículas?',
                '¿Los trabajadores usan guantes de protección adecuados según el tipo de riesgo expuesto?',
                '¿Se utiliza casco de seguridad en zonas de izaje de cargas o caída de objetos?',
                '¿Se utiliza protección auditiva (tapones/copas) en áreas con nivel de ruido superior a 85 dB?',
                '¿Los EPP se encuentran limpios, en buen estado y son almacenados correctamente?'
            ]
        }
    ]

    for pi_info in plantillas_inspeccion_data:
        pi, created = PlantillaInspeccion.objects.update_or_create(
            nombre=pi_info['nombre'],
            defaults={
                'descripcion': pi_info['descripcion'],
                'preguntas': pi_info['preguntas'],
                'activo': True
            }
        )
        if created:
            print(f"Plantilla de Inspección '{pi.nombre}' creada.")
        else:
            print(f"Plantilla de Inspección '{pi.nombre}' actualizada.")

    # 6. Temas de Capacitación por Defecto (Módulo de Capacitaciones)
    admin_user = Usuario.objects.filter(is_superuser=True).first()
    if not admin_user:
        admin_user = Usuario.objects.first()

    if admin_user:
        temas_capacitacion_data = [
            {
                'titulo': 'Uso Correcto y Cuidado de EPP',
                'descripcion': 'Instruir al personal sobre la selección, postura, limpieza y reposición de Elementos de Protección Personal.',
                'categoria': 'CHARLA_5_MIN',
                'duracion_minutos': 5,
                'contenido_clave': [
                    'Identificar los riesgos específicos de la tarea.',
                    'Inspeccionar el EPP antes de cada uso (casco, lentes, guantes).',
                    'Almacenar el EPP en lugares limpios y secos.',
                    'Solicitar recambio inmediato en caso de daño o desgaste.'
                ]
            },
            {
                'titulo': 'Obligación de Informar (ODI) / Derecho a Saber (DAS)',
                'descripcion': 'Charla de inducción obligatoria para nuevos trabajadores sobre los riesgos de la faena y medidas preventivas según DS 40.',
                'categoria': 'INDUCCION_ODI',
                'duracion_minutos': 60,
                'contenido_clave': [
                    'Riesgos generales del rubro y de la instalación.',
                    'Procedimiento de emergencia y evacuación.',
                    'Uso seguro de herramientas y maquinarias.',
                    'Uso obligatorio de EPP y canales de reporte de incidentes.'
                ]
            },
            {
                'titulo': 'Prevención de Incendios y Uso de Extintores',
                'descripcion': 'Capacitación práctica y teórica sobre la química del fuego, clasificación y técnicas de extinción con extintores portátiles.',
                'categoria': 'CURSO_PRACTICO',
                'duracion_minutos': 30,
                'contenido_clave': [
                    'El triángulo y tetraedro del fuego.',
                    'Clases de fuego (A, B, C, D, K) y agentes de extinción.',
                    'Técnica PASS (Tirar, Apuntar, Presionar, Abanicar).',
                    'Ubicación física y despeje de los extintores.'
                ]
            },
            {
                'titulo': 'Primeros Auxilios Básicos en Obra/Taller',
                'descripcion': 'Conceptos teóricos sobre la conducta PAS (Proteger, Alertar, Socorrer) y reanimación básica ante emergencias médicas comunes.',
                'categoria': 'CURSO_TEORICO',
                'duracion_minutos': 45,
                'contenido_clave': [
                    'Conducta PAS y cómo llamar a emergencias médicas.',
                    'Evaluación primaria del accidentado (conciencia y respiración).',
                    'Tratamiento inicial de heridas, quemaduras y fracturas simples.',
                    'Maniobras ante atragantamientos (Heimlich) y hemorragias.'
                ]
            }
        ]

        for tc_info in temas_capacitacion_data:
            tc, created = TemaCapacitacion.objects.update_or_create(
                titulo=tc_info['titulo'],
                defaults={
                    'descripcion': tc_info['descripcion'],
                    'categoria': tc_info['categoria'],
                    'duracion_minutos': tc_info['duracion_minutos'],
                    'contenido_clave': tc_info['contenido_clave'],
                    'usuario': admin_user
                }
            )
            if created:
                print(f"Tema de capacitación '{tc.titulo}' creado.")
            else:
                print(f"Tema de capacitación '{tc.titulo}' actualizado.")
    else:
        print("No se encontró ningún usuario en el sistema para asociar los temas de capacitación por defecto.")

    print("Sembrado finalizado con éxito.")

if __name__ == '__main__':
    seed()
