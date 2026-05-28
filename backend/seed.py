import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from modulo_prevencion.models import PlantillaMaestra, Servicio, Noticia, Plan
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
            'asientos': 1
        },
        {
            'codigo': 'profesional',
            'nombre': 'Plan Profesional',
            'precio': 14900.00,
            'edicion_nube': True,
            'marca_agua': False,
            'marca_blanca': False,
            'limite_semanal': 20,
            'asientos': 1
        },
        {
            'codigo': 'expert',
            'nombre': 'Plan Expert',
            'precio': 34900.00,
            'edicion_nube': True,
            'marca_agua': False,
            'marca_blanca': False,
            'limite_semanal': 50,
            'asientos': 1
        },
        {
            'codigo': 'consultora',
            'nombre': 'Plan Consultora',
            'precio': 79900.00,
            'edicion_nube': True,
            'marca_agua': False,
            'marca_blanca': True,
            'limite_semanal': 999999,
            'asientos': 5
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
                'asientos': p_info['asientos']
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
             "Recordamos a todas las empresas adheridas que el Decreto Supremo 594 exige que todo elemento de protección personal (EPP) entregado a los trabajadores cuente con la certificación del ISP o ente autorizado.", 
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

    print("Sembrado finalizado con éxito.")

if __name__ == '__main__':
    seed()
