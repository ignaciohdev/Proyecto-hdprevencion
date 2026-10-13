import os
import django

# Si se ejecuta de forma independiente
if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    django.setup()

from django.core.management.base import BaseCommand
from modulo_prevencion.models import TemaCapacitacion, Usuario

CONFERENCIAS_DEDUCIDAS = [
    {
        "titulo": "Inducción de Riesgos Laborales al Ingreso (ODI / DAS D.S. N° 44)",
        "categoria": TemaCapacitacion.CATEGORIA_ODI,
        "duracion_minutos": 120,
        "descripcion": (
            "Inducción formal y obligatoria exigida previo al inicio de las labores para todo nuevo trabajador o ante cambios de procesos. "
            "Cumple con la estricta sustitución del derogado Art. 21 del D.S. 40 por el Artículo 15 del nuevo D.S. N° 44 del Ministerio del Trabajo."
        ),
        "normativa_legal_vigente": "Artículo 15 D.S. N° 44 / Código del Trabajo Art. 184 (Archivo: Decreto-44.md)",
        "organismo_exigente": "Dirección del Trabajo (DT)",
        "relator_predeterminado": "Ingeniero en Prevención de Riesgos (Registro SEREMI / SNS)",
        "precio_clp": 45000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Ámbito de aplicación y obligatoriedad bajo Art. 15 D.S. N° 44",
            "Condiciones ambientales, orden, aseo y características del puesto de trabajo",
            "Peligros inherentes y medidas preventivas operativas",
            "Procedimientos de Trabajo Seguro (PTS) y uso correcto de maquinarias",
            "Hojas de Datos de Seguridad (HDS) de sustancias químicas (NCh 2245)",
            "Plan de emergencia, vías de escape y actuación ante riesgo grave e inminente"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿En qué momento debe impartirse la inducción de riesgos laborales según el Art. 15 del D.S. N° 44?",
                "opciones": [
                    "Dentro de los primeros 30 días posteriores al ingreso",
                    "Previo al inicio efectivo de las labores del trabajador",
                    "Solo cuando la mutualidad realice la fiscalización",
                    "Al finalizar el período de prueba laboral"
                ],
                "correcta": 1,
                "explicacion": "El Art. 15 del D.S. N° 44 exige garantizar que cada persona trabajadora reciba oportunamente la información de riesgos previo al inicio de las labores."
            },
            {
                "id": 2,
                "pregunta": "¿Qué cuerpo reglamentario sustituyó al derogado Decreto Supremo N° 40 en materia de gestión preventiva?",
                "opciones": [
                    "Decreto Supremo N° 594",
                    "Decreto Supremo N° 54",
                    "Decreto Supremo N° 44",
                    "Decreto Supremo N° 76"
                ],
                "correcta": 2,
                "explicacion": "El Decreto Supremo N° 44 del Ministerio del Trabajo derogó y sustituyó integralmente al D.S. N° 40 y D.S. N° 54."
            },
            {
                "id": 3,
                "pregunta": "¿Cuándo debe actualizarse o reiterarse la inducción de riesgos laborales?",
                "opciones": [
                    "Cada vez que cambien tecnologías, procesos productivos o sustancias utilizadas",
                    "Únicamente al renovar el contrato de trabajo a plazo indefinido",
                    "Cada 5 años de antigüedad laboral",
                    "Solo si ocurre un accidente fatal en la faena"
                ],
                "correcta": 0,
                "explicacion": "El Art. 15 inc. 2 del D.S. N° 44 obliga a informar cada vez que se incorporen nuevos procesos, materiales o tecnologías."
            },
            {
                "id": 4,
                "pregunta": "¿Qué información química debe entregarse al trabajador si manipula sustancias peligrosas?",
                "opciones": [
                    "Solo la factura comercial del proveedor",
                    "Fórmula química, modo de empleo, límites permisibles, HDS y primeros auxilios",
                    "Únicamente el precio y fecha de vencimiento",
                    "No se requiere informar nada mientras use guantes"
                ],
                "correcta": 1,
                "explicacion": "El numeral 4 del Art. 15 D.S. 44 exige entregar características, límites permisibles, almacenamiento, EPP y medidas de primeros auxilios."
            }
        ]
    },
    {
        "titulo": "Curso Bienal Obligatorio de 8 Horas con Enfoque de Género (Art. 16 D.S. N° 44)",
        "categoria": TemaCapacitacion.CATEGORIA_CURSO_8H_GENERO,
        "duracion_minutos": 480,
        "descripcion": (
            "Programa formal de capacitación bienal obligatoria de 8 horas cronológicas establecido por el Artículo 16 del D.S. N° 44. "
            "Cubre factores de riesgos, enfermedades profesionales, prestaciones Ley 16.744, emergencias y uso de extintores bajo perspectiva de género."
        ),
        "normativa_legal_vigente": "Artículo 16 D.S. N° 44 / Ley 16.744 / OIT Convenio 190 (Archivo: Decreto-44.md)",
        "organismo_exigente": "Dirección del Trabajo (DT) / SUSESO",
        "relator_predeterminado": "Ingeniero en Prevención de Riesgos (Registro SEREMI / SNS)",
        "precio_clp": 120000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Factores de riesgos específicos en el lugar de trabajo con enfoque de género",
            "Efectos en la salud y enfermedades profesionales vinculadas a la actividad",
            "Medidas preventivas para el control de riesgos evaluados en la matriz",
            "Prestaciones médicas y económicas de la Ley N° 16.744 y canales asistenciales",
            "Plan de gestión de riesgos ante emergencias, catástrofes y desastres",
            "Señalética reglamentaria de seguridad y zonas seguras",
            "Prevención de riesgos de incendio y uso práctico de extintores"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Cuál es la duración mínima y periodicidad del curso general exigido por el Art. 16 del D.S. N° 44?",
                "opciones": [
                    "2 horas cada 6 meses",
                    "Al menos 8 horas cronológicas con periodicidad máxima de dos años (bienal)",
                    "4 horas anuales",
                    "20 horas cada 3 años"
                ],
                "correcta": 1,
                "explicacion": "El Art. 16 D.S. 44 fija expresamente una duración de al menos 8 horas y una periodicidad no superior a dos años."
            },
            {
                "id": 2,
                "pregunta": "¿Qué enfoque transversal debe incorporar obligatoriamente este curso según el D.S. N° 44?",
                "opciones": [
                    "Enfoque estrictamente financiero de la empresa",
                    "Enfoque de género y no discriminación",
                    "Enfoque de comercialización de productos",
                    "Enfoque exclusivo de productividad horaria"
                ],
                "correcta": 1,
                "explicacion": "El Art. 16 D.S. 44 estipula que la capacitación debe considerar expresamente el enfoque de género."
            },
            {
                "id": 3,
                "pregunta": "¿Qué cobertura contempla el Seguro Social de la Ley N° 16.744 enseñado en el curso?",
                "opciones": [
                    "Solo indemnizaciones por despido",
                    "Prestaciones médicas gratuitas al 100% y subsidios económicos ante accidentes y enfermedades laborales",
                    "Créditos hipotecarios de vivienda",
                    "Seguro de cesantía voluntario"
                ],
                "correcta": 1,
                "explicacion": "La Ley 16.744 otorga cobertura integral médica, hospitalaria, quirúrgica, prótesis y subsidios por incapacidad temporal/permanente."
            },
            {
                "id": 4,
                "pregunta": "¿Qué temática de extinción de emergencias debe incluirse en las 8 horas reglamentarias?",
                "opciones": [
                    "Prevención de riesgos de incendio y uso de extintores y mecanismos de extinción",
                    "Solo números de emergencia en un papel",
                    "Construcción de pozos de agua",
                    "Manejo de retroexcavadoras"
                ],
                "correcta": 0,
                "explicacion": "El numeral 7 del Art. 16 D.S. 44 exige 'Prevención de riesgos de incendio, para lo cual se deberá considerar el uso de extintores'."
            }
        ]
    },
    {
        "titulo": "Prevención, Investigación y Sanción del Acoso y Violencia (Ley Karin N° 21.643)",
        "categoria": TemaCapacitacion.CATEGORIA_LEY_KARIN,
        "duracion_minutos": 240,
        "descripcion": (
            "Capacitación especializada en cumplimiento de la Ley N° 21.643 (Ley Karin), Dictamen DT N° 362/19 y Convenio 190 OIT. "
            "Aborda la tipificación del acoso sexual, acoso laboral y violencia externa, protocolos preventivos, canal de denuncias y medidas de resguardo."
        ),
        "normativa_legal_vigente": "Ley N° 21.643 / Dictamen DT N° 362/19 / Arts. 2 y 211-A Código del Trabajo (Archivo: Ley-Karin-21643.md)",
        "organismo_exigente": "Dirección del Trabajo (DT) / SUSESO",
        "relator_predeterminado": "Psicólogo Laboral / Especialista en Convivencia Laboral y SUSESO",
        "precio_clp": 95000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Marco regulatorio de la Ley Karin N° 21.643 y Convenio 190 OIT",
            "Tipificación de Acoso Laboral (incluso si se manifiesta una sola vez)",
            "Definición de Acoso Sexual y Violencia en el Trabajo ejercida por terceros ajenos",
            "Perspectiva de género, dignidad humana y no revictimización",
            "Protocolo de prevención y matriz de riesgos psicosociales",
            "Procedimiento de investigación interna y canal formal de denuncias",
            "Medidas de resguardo inmediato (separación de espacios, atención psicológica temprana)",
            "Confidencialidad, debido proceso, informe técnico y sanciones disciplinarias"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Requiere el acoso laboral reiteración temporal para ser sancionado bajo la Ley Karin N° 21.643?",
                "opciones": [
                    "Sí, debe ocurrir de forma continuada durante más de 6 meses",
                    "No, la ley sanciona la agresión u hostigamiento 'ya sea que se manifieste una sola vez o de manera reiterada'",
                    "Solo si concurren al menos 3 testigos presenciales",
                    "Solo si existe una licencia médica psiquiátrica previa"
                ],
                "correcta": 1,
                "explicacion": "La Ley 21.643 modificó el Art. 2 del Código del Trabajo tipificando el acoso laboral manifestado una sola vez o de manera reiterada."
            },
            {
                "id": 2,
                "pregunta": "¿Qué es la 'violencia en el trabajo ejercida por terceros' introducida por la Ley 21.643?",
                "opciones": [
                    "Conflictos bélicos internacionales",
                    "Conductas que afecten a trabajadores con ocasión de los servicios por parte de clientes, proveedores o usuarios",
                    "Ruidos molestos de construcciones vecinas",
                    "Discusiones entre miembros del sindicato fuera del horario de trabajo"
                ],
                "correcta": 1,
                "explicacion": "El Art. 2 letra c) define violencia de terceros como aquella ejercida por clientes, proveedores o usuarios externos."
            },
            {
                "id": 3,
                "pregunta": "¿Cuáles son los principios rectores del procedimiento de investigación bajo Ley Karin?",
                "opciones": [
                    "Publicidad masiva y difusión en redes sociales",
                    "Confidencialidad, imparcialidad, celeridad y perspectiva de género",
                    "Arbitrariedad y decisión unilateral de la gerencia",
                    "Postergación indefinida del análisis"
                ],
                "correcta": 1,
                "explicacion": "El Art. 211-B del Código del Trabajo establece obligatoriamente confidencialidad, imparcialidad, celeridad y perspectiva de género."
            },
            {
                "id": 4,
                "pregunta": "¿Qué deber periódico tienen los empleadores respecto al canal de denuncias de Ley Karin?",
                "opciones": [
                    "Informar semestralmente los canales de recepción de denuncias e instancias estatales",
                    "Informar cada 10 años",
                    "Solo informar si un trabajador lo solicita ante notario",
                    "Mantenerlo en estricto secreto para que no se use"
                ],
                "correcta": 0,
                "explicacion": "El Art. 211-A inciso final ordena al empleador informar semestralmente los canales de denuncia e instancias fiscalizadoras."
            }
        ]
    },
    {
        "titulo": "Formación y Capacitación de Integrantes de Comités Paritarios CPHS (20 Horas)",
        "categoria": TemaCapacitacion.CATEGORIA_CURSO_20H_CPHS,
        "duracion_minutos": 1200,
        "descripcion": (
            "Curso integral de 20 horas cronológicas obligatorio para miembros de Comités Paritarios de Higiene y Seguridad (CPHS) "
            "conforme al Artículo 32 N° 4 del D.S. N° 44, Ley 16.744 y directrices de Registro Electrónico Laboral (REL D.S. 14)."
        ),
        "normativa_legal_vigente": "D.S. N° 44 Arts. 23 al 49 / D.S. 14 REL / Art. 66 Ley 16.744 (Archivo: Decreto-44.md)",
        "organismo_exigente": "Dirección del Trabajo (DT) / SUSESO",
        "relator_predeterminado": "Ingeniero en Prevención de Riesgos Senior (Registro SEREMI / SNS)",
        "precio_clp": 180000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Roles, funciones y normativa de los Comités Paritarios bajo el D.S. N° 44",
            "Constitución, elección paritaria y registro en el portal REL de la DT (plazo 15 días)",
            "Identificación de peligros y evaluación de riesgos en la matriz preventiva",
            "Investigación de causas de accidentes del trabajo y enfermedades mediante Árbol de Causas",
            "Elaboración, priorización y control del Programa Anual de Trabajo Paritario",
            "Fiscalización paritaria en terreno y actas de reuniones ordinarias/extraordinarias",
            "Coordinación técnica con el Departamento de Prevención y la Mutualidad de la Ley 16.744"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Cuál es la duración mínima legal del curso de formación para integrantes del CPHS según Art. 32 N° 4 D.S. 44?",
                "opciones": [
                    "5 horas pedagógicas",
                    "20 horas cronológicas",
                    "8 horas teóricas",
                    "40 horas obligatorias"
                ],
                "correcta": 1,
                "explicacion": "El Art. 32 numeral 4 inciso 3 del D.S. 44 estipula expresamente una duración de 20 horas para integrantes del CPHS."
            },
            {
                "id": 2,
                "pregunta": "¿En qué plazo debe registrarse el acta de constitución del CPHS en el sitio de la Dirección del Trabajo (REL)?",
                "opciones": [
                    "Dentro de los 15 días hábiles siguientes a la fecha de la elección",
                    "A los 6 meses de constituido",
                    "Al término del mandato de 2 años",
                    "No se requiere registro formal en la DT"
                ],
                "correcta": 0,
                "explicacion": "El Art. 36 del D.S. N° 44 y el D.S. 14 exigen registrar el acta en el sitio de la DT dentro de los 15 días hábiles siguientes a la elección."
            },
            {
                "id": 3,
                "pregunta": "¿Qué metodología técnica debe utilizar el CPHS para investigar accidentes graves?",
                "opciones": [
                    "Juicio sumario inmediato",
                    "Metodología del Árbol de Causas orientada a determinar hechos objetivos",
                    "Búsqueda de culpables para despido disciplinario",
                    "Encuesta informal por WhatsApp"
                ],
                "correcta": 1,
                "explicacion": "El CPHS y las mutualidades investigan siniestros mediante el Árbol de Causas para identificar causas raíz y medidas correctivas."
            },
            {
                "id": 4,
                "pregunta": "¿Cuánto dura el mandato legal de los miembros del Comité Paritario de Higiene y Seguridad?",
                "opciones": [
                    "1 año renovable automáticamente",
                    "2 años en sus funciones (pudiendo ser reelegidos)",
                    "Indefinido mientras trabajen en la empresa",
                    "4 años según el contrato colectivo"
                ],
                "correcta": 1,
                "explicacion": "El Art. 43 del D.S. 44 confirma que los miembros del CPHS durarán dos años en sus funciones."
            }
        ]
    },
    {
        "titulo": "Uso, Chequeo y Mantención de Elementos de Protección Personal (EPP - 1 Hora)",
        "categoria": TemaCapacitacion.CATEGORIA_CURSO_1H_EPP,
        "duracion_minutos": 60,
        "descripcion": (
            "Capacitación teórico-práctica obligatoria de al menos 1 hora cronológica exigida por el Artículo 13 del D.S. N° 44 y "
            "Artículo 53 del D.S. N° 594. Refuerzo obligatorio anual y en cada nuevo ingreso de personal a puestos con EPP."
        ),
        "normativa_legal_vigente": "Art. 13 D.S. N° 44 / Art. 53 D.S. N° 594 / D.S. N° 18 MINSAL (Archivos: Decreto-44.md, Decreto_Supremo_N°_594.md)",
        "organismo_exigente": "MINSAL / Dirección del Trabajo (DT) / SUSESO",
        "relator_predeterminado": "Ingeniero / Técnico en Prevención de Riesgos (Registro SEREMI)",
        "precio_clp": 35000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Prelación preventiva: por qué el EPP es la última barrera de control (Art. 9 y 12 D.S. 44)",
            "Partes componentes de cada tipo de EPP según riesgo específico",
            "Procedimiento de colocación y ajuste ergonómico correcto",
            "Limitaciones de uso y niveles de protección certificada ISP (D.S. 18)",
            "Prueba de chequeo diario pre-uso por el trabajador",
            "Protocolos de limpieza, desinfección y almacenamiento en faena",
            "Criterios de reposición, desgaste y descarte oportuno sin costo para el trabajador"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Qué duración mínima legal exige el D.S. N° 44 para la capacitación en uso de EPP?",
                "opciones": [
                    "15 minutos",
                    "Duración mínima de una hora cronológica (60 minutos)",
                    "4 horas",
                    "Solo una firma en la entrega del equipo"
                ],
                "correcta": 1,
                "explicacion": "El Art. 13 inc. 3 del D.S. 44 establece explícitamente una duración mínima de una hora cronológica."
            },
            {
                "id": 2,
                "pregunta": "¿A costo de quién deben proporcionarse los EPP según el D.S. 594 y D.S. 44?",
                "opciones": [
                    "Descontado por planilla del sueldo del trabajador",
                    "A costo exclusivo de la entidad empleadora y libres de todo costo para el trabajador",
                    "50% empleador y 50% trabajador",
                    "A costo del Comité Paritario"
                ],
                "correcta": 1,
                "explicacion": "El Art. 13 D.S. 44 y Art. 53 D.S. 594 obligan al empleador a proveer los EPP adecuados a su costo íntegro."
            },
            {
                "id": 3,
                "pregunta": "¿Con qué frecuencia debe reforzarse la capacitación obligatoria de EPP?",
                "opciones": [
                    "Anualmente y cada vez que ingrese un nuevo trabajador o cambie el tipo de EPP",
                    "Cada 5 años",
                    "Únicamente cuando se rompa un equipo",
                    "Nunca, se dicta una sola vez de por vida"
                ],
                "correcta": 0,
                "explicacion": "El Art. 13 D.S. 44 ordena reforzar la capacitación anualmente y ante cada nuevo ingreso o cambio de EPP."
            },
            {
                "id": 4,
                "pregunta": "¿Qué certificación deben cumplir los EPP en Chile?",
                "opciones": [
                    "Cualquier sello de supermercado",
                    "Certificación oficial de calidad o estar registrados ante el Instituto de Salud Pública (ISP)",
                    "Ninguna certificación obligatoria",
                    "Solo aprobación verbal del jefe de cuadrilla"
                ],
                "correcta": 1,
                "explicacion": "El D.S. 18 de 1982 y el Art. 13 D.S. 44 exigen certificación registrada ante el Instituto de Salud Pública (ISP)."
            }
        ]
    },
    {
        "titulo": "Uso y Manejo Práctico de Extintores Portátiles de Incendio",
        "categoria": TemaCapacitacion.CATEGORIA_EXTINTORES,
        "duracion_minutos": 120,
        "descripcion": (
            "Entrenamiento técnico sobre clases de fuego, agentes extintores, inspección reglamentaria y maniobra práctica de descarga. "
            "Cumple con la exigencia obligatoria del Artículo 48 del D.S. N° 594 y normas NCh 1430 / NCh 2056."
        ),
        "normativa_legal_vigente": "D.S. N° 594 Arts. 44 al 52 / NCh 1430 / NCh 2056 (Archivo: Decreto_Supremo_N°_594.md)",
        "organismo_exigente": "Ministerio de Salud (MINSAL) / Dirección del Trabajo (DT)",
        "relator_predeterminado": "Instructor Especialista en Fuego y Emergencias / Bombero / Prevencionista",
        "precio_clp": 55000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Química y triángulo/tetraedro del fuego (Combustible, Comburente, Calor, Reacción en cadena)",
            "Clases de fuegos: A (Sólidos), B (Líquidos), C (Equipos eléctricos), D (Metales), K (Aceites de cocina)",
            "Agentes de extinción: Polvo Químico Seco (PQS ABC), Dióxido de Carbono (CO2), Agua Presurizada, Acetato de Potasio",
            "Inspección pre-uso: Manómetro en zona verde, precinto de seguridad, pasador, manguera y tarjeta de mantención anual",
            "Técnica operativa TPAP (Tirar pasador, Probar, Apuntar a la base de la llama, Presionar percutor)",
            "Distancias máximas de traslado y ubicación a altura máxima de 1,30 metros (Art. 46 y 47 D.S. 594)",
            "Plan de evacuación y zonas de seguridad sin quedar atrapado por el humo"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Qué exige el Art. 48 del D.S. N° 594 respecto al personal de la empresa?",
                "opciones": [
                    "Que solo los guardias sepan de incendios",
                    "Que todo el personal que se desempeña en un lugar de trabajo deberá ser instruido y entrenado sobre el uso de extintores",
                    "Que no se usen extintores hasta que llegue Bomberos",
                    "Que se contrate una póliza y se evacue sin instruir a nadie"
                ],
                "correcta": 1,
                "explicacion": "El Art. 48 D.S. 594 indica textualmente: 'Todo el personal que se desempeña en un lugar de trabajo deberá ser instruido y entrenado...'."
            },
            {
                "id": 2,
                "pregunta": "¿A qué altura máxima deben colocarse los extintores según el Art. 47 del D.S. 594?",
                "opciones": [
                    "A 2,50 metros del suelo",
                    "A una altura máxima de 1,30 metros medidos desde el suelo hasta la base del extintor",
                    "En el piso directamente en pasillos",
                    "A la altura que determine el conserje"
                ],
                "correcta": 1,
                "explicacion": "El Art. 47 D.S. 594 estipula altura máxima de 1,30 metros desde el suelo hasta la base del extintor."
            },
            {
                "id": 3,
                "pregunta": "¿Qué tipo de extintor NO debe utilizarse jamás sobre un fuego con presencia de energía eléctrica viva (Clase C)?",
                "opciones": [
                    "Extintores de CO2",
                    "Extintores de agua o soluciones conductoras de electricidad sin desconexión previa",
                    "Extintores de PQS",
                    "Extintores de agente limpio"
                ],
                "correcta": 1,
                "explicacion": "El agua es conductora de electricidad y genera riesgo mortal de electrocución si se descarga en fuegos con corriente."
            },
            {
                "id": 4,
                "pregunta": "¿Con qué periodicidad deben someterse a mantención y revisión los extintores según el D.S. 369 y D.S. 594?",
                "opciones": [
                    "Cada 5 años",
                    "Por lo menos una vez al año por servicio técnico certificado",
                    "Solo cuando se hayan descargado por completo",
                    "Semanalmente por el Comité Paritario"
                ],
                "correcta": 1,
                "explicacion": "El Art. 51 D.S. 594 exige revisión y mantención preventiva de extintores por lo menos una vez al año."
            }
        ]
    },
    {
        "titulo": "Protocolo PREXOR: Vigilancia de Exposición Ocupacional a Ruido (MINSAL)",
        "categoria": TemaCapacitacion.CATEGORIA_PREXOR,
        "duracion_minutos": 120,
        "descripcion": (
            "Capacitación en Protocolo de Exposición Ocupacional a Ruido (PREXOR) según Res. Ex. MINSAL N° 1052/2013 y D.S. N° 594. "
            "Previene la Hipoacusia Sensorineural Laboral mediante jerarquía de controles, dosimetrías y protección auditiva certificada."
        ),
        "normativa_legal_vigente": "Res. Ex. MINSAL N° 1052/2013 / D.S. N° 594 Arts. 70 al 82 (Archivos: protocolo_minsal_prexor_ruido.md, Decreto_Supremo_N°_594.md)",
        "organismo_exigente": "Ministerio de Salud (MINSAL) / ISP / SEREMI",
        "relator_predeterminado": "Higienista Ocupacional / Fonoaudiólogo / Ingeniero en Prevención",
        "precio_clp": 65000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Fisiología auditiva y mecanismo del daño coclear irreversible por ruido",
            "Criterios de acción del PREXOR: Dosis de acción del 50% o Nivel equivalente diario de 82 dBA",
            "Límite permisible ponderado para 8 horas de trabajo: 85 dBA (Art. 75 D.S. 594)",
            "Medidas de ingeniería: Encapsulamiento, barreras acústicas, absorción y mantenimiento mecánico",
            "Medidas administrativas: Rotación de personal y reducción del tiempo de exposición",
            "Selección y cálculo de atenuación de Protectores Auditivos (NRR / SNR)",
            "Vigilancia de la salud: Audiometrías de base y de seguimiento por el Organismo Administrador"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Qué daño produce la exposición ocupacional prolongada a altos niveles de ruido sin control?",
                "opciones": [
                    "Hipoacusia sensorineural laboral bilateral e irreversible",
                    "Infección viral de oído medio recuperable en 48 horas",
                    "Rinitis alérgica estacional",
                    "Astigmatismo miópico"
                ],
                "correcta": 0,
                "explicacion": "El ruido excesivo destruye de forma irreversible las células ciliadas del órgano de Corti, provocando sordera profesional permanente."
            },
            {
                "id": 2,
                "pregunta": "¿Cuál es el Límite Permisible Ponderado de nivel de presión sonora para una jornada laboral de 8 horas según el D.S. 594?",
                "opciones": [
                    "60 dBA",
                    "85 dBA",
                    "100 dBA",
                    "120 dBA"
                ],
                "correcta": 1,
                "explicacion": "El Art. 75 del D.S. 594 fija en 85 dBA el nivel sonoro continuo equivalente para 8 horas diarias de exposición."
            },
            {
                "id": 3,
                "pregunta": "¿Cuál es el criterio de acción para ingresar a vigilancia ambiental y médica según la norma PREXOR?",
                "opciones": [
                    "Dosis de ruido de 50% (0.5) o nivel de presión sonora continuo equivalente de 82 dBA",
                    "Solo si el trabajador no escucha cuando le gritan",
                    "A los 95 dBA",
                    "Únicamente cuando exista reclamo de vecinos"
                ],
                "correcta": 0,
                "explicacion": "El PREXOR define el Criterio de Acción preventivo a partir de 82 dBA o una dosis igual o superior a 0,5 (50%)."
            },
            {
                "id": 4,
                "pregunta": "¿Cómo deben seleccionarse los protectores auditivos (tapones/fonos)?",
                "opciones": [
                    "Por el color más llamativo",
                    "Calculando la atenuación acústica real para asegurar que el nivel bajo el protector quede entre 70 y 80 dBA",
                    "Eligiendo el más barato sin certificación ISP",
                    "Cualquier algodón sirve de protector auditivo"
                ],
                "correcta": 1,
                "explicacion": "La norma exige protectores certificados ISP con cálculo de reducción sonora para no sobre-proteger ni sub-proteger al trabajador."
            }
        ]
    },
    {
        "titulo": "Protocolo TMERT-EESS y Manejo Manual de Cargas (Ley N° 20.949)",
        "categoria": TemaCapacitacion.CATEGORIA_TMERT,
        "duracion_minutos": 120,
        "descripcion": (
            "Capacitación ergonómica basada en la Norma Técnica TMERT-EESS (D.S. N° 594 Art. 110) y Ley N° 20.949 (Ley del Saco). "
            "Instruye en biomecánica postural, identificación de tareas críticas, límites de carga (25 kg / 20 kg) y pausas activas."
        ),
        "normativa_legal_vigente": "Norma Técnica TMERT MINSAL / D.S. N° 594 Art. 110 / Ley N° 20.949 / D.S. N° 48 (Archivos: protocolo_minsal_tmert_eess.md, Decreto_Supremo_N°_594.md)",
        "organismo_exigente": "Ministerio de Salud (MINSAL) / Dirección del Trabajo (DT)",
        "relator_predeterminado": "Kinesiólogo / Ergónomo Ocupacional / Prevencionista de Riesgos",
        "precio_clp": 75000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Definición de Trastornos Musculoesqueléticos en Extremidades Superiores (Tendinitis, Túnel Carpiano, Epicondilitis)",
            "Los 4 factores de riesgo TMERT: Repetitividad, Postura Forzada, Fuerza y Tiempos de Recuperación",
            "Aplicación de la Lista de Chequeo Inicial TMERT y colores de alerta (Verde, Amarillo, Rojo)",
            "Límites de levantamiento manual Ley 20.949: Máximo 25 kg para hombres adultos; 20 kg para mujeres y menores de 18 años",
            "Prohibición absoluta de carga manual para mujeres embarazadas",
            "Técnicas de levantamiento: Espalda recta, carga pegada al cuerpo y flexión de rodillas",
            "Programa de pausas activas compensatorias y rotación de puestos de trabajo"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Cuál es el peso máximo legal de carga humana permitido por la Ley N° 20.949 para hombres adultos?",
                "opciones": [
                    "50 kilogramos",
                    "25 kilogramos",
                    "40 kilogramos",
                    "30 kilogramos"
                ],
                "correcta": 1,
                "explicacion": "La Ley 20.949 ('Ley del Saco') redujo el peso máximo de levantamiento y transporte manual de 50 kg a 25 kg para hombres adultos."
            },
            {
                "id": 2,
                "pregunta": "¿Qué límite de carga humana rige para mujeres y menores de 18 años según la Ley N° 20.949?",
                "opciones": [
                    "20 kilogramos",
                    "25 kilogramos",
                    "15 kilogramos",
                    "30 kilogramos"
                ],
                "correcta": 0,
                "explicacion": "El Código del Trabajo y la Ley 20.949 fijan un límite máximo de 20 kilogramos para mujeres y menores de 18 años."
            },
            {
                "id": 3,
                "pregunta": "¿Cuáles son los 4 factores de riesgo biomecánicos evaluados por la norma técnica TMERT-EESS?",
                "opciones": [
                    "Ruido, calor, vibraciones y radiación",
                    "Repetitividad de movimientos, posturas forzadas, fuerza ejercida y falta de tiempos de recuperación",
                    "Sueldo base, horas extras, locomoción y colación",
                    "Uso de extintor, casco, botas y chaleco"
                ],
                "correcta": 1,
                "explicacion": "La norma TMERT evalúa específicamente movimientos repetitivos, posturas forzadas, uso de fuerza y pausas de descanso."
            },
            {
                "id": 4,
                "pregunta": "¿Qué disposición legal rige respecto a mujeres embarazadas en faenas de carga manual?",
                "opciones": [
                    "Pueden cargar hasta 10 kg si usan faja lumbar",
                    "Se prohíben totalmente las operaciones de carga y descarga manual para trabajadoras embarazadas",
                    "Solo cargan en jornada diurna",
                    "Depende de la autorización del jefe directo"
                ],
                "correcta": 1,
                "explicacion": "El Art. 211-J del Código del Trabajo prohíbe taxativamente que las mujeres embarazadas realicen operaciones de carga y descarga manual."
            }
        ]
    },
    {
        "titulo": "Protocolo de Protección Radiación Ultravioleta Solar (Guía Técnica RUV)",
        "categoria": TemaCapacitacion.CATEGORIA_RADIACION_UV,
        "duracion_minutos": 90,
        "descripcion": (
            "Capacitación semestral/anual obligatoria para trabajadores expuestos a radiación UV de origen solar bajo el D.S. N° 594 "
            "Artículos 109a al 109j y la Guía Técnica MINSAL. Previene queratitis, cataratas y cáncer de piel (melanoma y no melanoma)."
        ),
        "normativa_legal_vigente": "D.S. N° 594 Arts. 109a-109j / D.S. N° 97 / Guía Técnica Radiación UV Solar MINSAL (Archivos: protocolo_minsal_radiacion_uv.md, Decreto_Supremo_N°_594.md)",
        "organismo_exigente": "Ministerio de Salud (MINSAL) / Dirección del Trabajo (DT)",
        "relator_predeterminado": "Enfermero de Salud Ocupacional / Médico Laboral / Ingeniero en Prevención",
        "precio_clp": 45000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Física de la radiación UV: Diferencias entre radiación UVA y UVB",
            "Efectos acumulativos en la salud: Cáncer basocelular, espinocelular, melanoma maligno y daño ocular (cataratas, pterigion)",
            "Publicación diaria del Índice UV (IUV) de la Dirección Meteorológica de Chile y medidas de alerta",
            "Medidas de ingeniería: Sombras naturales, mallas raschel y techumbres en puestos fijos",
            "Protector solar: Exigencia mínima de FPS 30+ (o FPS 50+ en faenas de alto albedo/altura) con registro ISP",
            "Correcta aplicación de fotoprotector: 20 minutos antes de la exposición y reaplicación cada 2 a 3 horas",
            "Ropa de trabajo certificada: Manga larga, cuello alto, cubrenuca (legionario) y lentes de seguridad con filtro UV 99-100%"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Qué factor de protección solar (FPS) mínimo exige la Guía Técnica del MINSAL para trabajadores expuestos?",
                "opciones": [
                    "FPS 15",
                    "FPS 30 como mínimo, y FPS 50+ en zonas de alto albedo, nieve, agua o altura",
                    "Cualquier crema humectante común",
                    "FPS 100 obligatorio en todo momento"
                ],
                "correcta": 1,
                "explicacion": "La Guía Técnica UV establece el uso de productos con FPS 30 como mínimo, y FPS 50+ para faenas de mayor exposición o albedo."
            },
            {
                "id": 2,
                "pregunta": "¿Con qué frecuencia debe reaplicarse el protector solar durante la jornada según el protocolo?",
                "opciones": [
                    "Una sola vez al inicio del día antes de salir de casa",
                    "Cada 2 a 3 horas de forma habitual, y cada 1 hora en condiciones de sudor o superficies de alto reflejo",
                    "Solo después de almuerzo",
                    "Una vez a la semana"
                ],
                "correcta": 1,
                "explicacion": "El fotoprotector pierde eficacia con el sudor y roce, requiriendo reaplicación regular cada 2 a 3 horas."
            },
            {
                "id": 3,
                "pregunta": "¿Cuáles son las horas de mayor intensidad de radiación solar que deben evitarse o protegerse al máximo?",
                "opciones": [
                    "Entre las 06:00 y las 09:00 hrs",
                    "Entre las 11:00 y las 16:00 hrs",
                    "Después de las 18:00 hrs",
                    "Durante la noche"
                ],
                "correcta": 1,
                "explicacion": "El ángulo cenital del sol alcanza su máxima radiación entre las 11:00 y las 16:00 horas."
            },
            {
                "id": 4,
                "pregunta": "¿Qué características deben tener los lentes de seguridad para proteger de la radiación UV de origen solar?",
                "opciones": [
                    "Lentes oscuros comprados en comercio informal sin filtro",
                    "Lentes certificados con protección lateral y filtro contra rayos ultravioleta de al menos 99% a 100%",
                    "Lentes de contacto cosméticos",
                    "Solo antiparras transparentes de natación"
                ],
                "correcta": 1,
                "explicacion": "Los lentes deben estar certificados para filtrar el 99-100% de los rayos UVA y UVB, evitando daño a la córnea y cristalino."
            }
        ]
    },
    {
        "titulo": "Plan Nacional de Erradicación de la Silicosis (PLANESI - Sílice Cristalina)",
        "categoria": TemaCapacitacion.CATEGORIA_PLANESI,
        "duracion_minutos": 120,
        "descripcion": (
            "Capacitación en el marco del PLANESI según Res. Ex. MINSAL N° 268/2015 y D.S. N° 594 Arts. 65-66. "
            "Dirigido a faenas mineras, construcción, canteras, mampostería y cerámica expuestas a polvo de sílice libre cristalizada."
        ),
        "normativa_legal_vigente": "Res. Ex. MINSAL N° 268/2015 / D.S. N° 594 Arts. 65-66 (Archivos: protocolo_minsal_silice_planesi.md, Decreto_Supremo_N°_594.md)",
        "organismo_exigente": "Ministerio de Salud (MINSAL) / ISP / SEREMI",
        "relator_predeterminado": "Higienista Industrial / Ingeniero en Prevención de Riesgos (Registro SEREMI)",
        "precio_clp": 70000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Naturaleza de la sílice libre cristalizada (Cuarzo, Cristobalita, Tridimita) y fracción respirable",
            "Patología de la Silicosis: Enfermedad pulmonar fibrótica crónica, irreversible e incurable, clasificada como cancerígena (Grupo 1 IARC)",
            "Límites permisibles de exposición (LPP): 0.08 mg/m3 para cuarzo respirable (Art. 66 D.S. 594)",
            "Jerarquía de controles: Métodos de corte húmedo, captación y aspiración con filtros HEPA de alta eficiencia",
            "Prohibición estricta del barrido en seco y soplado con aire comprimido en áreas de trabajo",
            "Protección respiratoria: Mascarillas N95/P100 o respiradores de medio rostro con filtros para material particulado P100",
            "Pruebas de ajuste cuantitativas/cualitativas (Fit Test) y no portar barba que comprometa el sello facial",
            "Vigilancia médica: Radiografías de tórax con técnica y lectura según norma OIT cada 1 a 2 años"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Qué es la silicosis y cuál es su pronóstico médico?",
                "opciones": [
                    "Una gripe pulmonar pasajera curable con antibióticos",
                    "Una enfermedad pulmonar fibrótica, irreversible, crónica e incurable causada por inhalación de sílice libre cristalizada",
                    "Una alergia cutánea producida por cemento",
                    "Una afección lumbar por levantar ladrillos"
                ],
                "correcta": 1,
                "explicacion": "La silicosis genera cicatrización fibrótica progresiva en los alvéolos pulmonares sin tratamiento curativo conocido."
            },
            {
                "id": 2,
                "pregunta": "¿Qué práctica operativa está estrictamente prohibida en faenas con polvo de sílice según el PLANESI?",
                "opciones": [
                    "El corte húmedo de adoquines",
                    "El barrido en seco y la limpieza con aire comprimido que resuspenda el polvo respirable",
                    "El uso de sistemas de aspiración con filtro HEPA",
                    "La ventilación localizada"
                ],
                "correcta": 1,
                "explicacion": "Barrer en seco levanta nubes de polvo respirable invisible que permanecen suspendidas por horas; debe usarse aspiración o humectación."
            },
            {
                "id": 3,
                "pregunta": "¿Qué filtro de protección respiratoria certificada debe utilizarse contra el polvo de sílice libre?",
                "opciones": [
                    "Filtro P100 de alta eficiencia (o respirador N95 mínimo según nivel de exposición)",
                    "Mascarilla quirúrgica simple de tela",
                    "Pañuelo húmedo atado al rostro",
                    "Filtro exclusivo para vapores orgánicos sin filtro de partículas"
                ],
                "correcta": 0,
                "explicacion": "Se requiere filtro para partículas de alta eficiencia clasificado como P100 (99.97% de retención) ajustado herméticamente al rostro."
            },
            {
                "id": 4,
                "pregunta": "¿Por qué el vello facial (barba) está contraindicado en trabajadores que usan protección respiratoria para sílice?",
                "opciones": [
                    "Por razones de etiqueta corporativa",
                    "Porque la barba rompe el sello hermético del respirador permitiendo el paso de polvo respirable a los pulmones",
                    "Porque dificulta el uso del casco de seguridad",
                    "No tiene ninguna relevancia técnica"
                ],
                "correcta": 1,
                "explicacion": "Incluso una barba de 24 horas rompe el sello elastomérico de la máscara, anulando la protección contra partículas microscópicas."
            }
        ]
    },
    {
        "titulo": "Manejo Seguro de Plaguicidas y Sustancias Peligrosas",
        "categoria": TemaCapacitacion.CATEGORIA_PLAGUICIDAS,
        "duracion_minutos": 180,
        "descripcion": (
            "Capacitación en uso, almacenamiento y aplicación de productos fitosanitarios y sustancias químicas peligrosas. "
            "Cumple con el D.S. N° 594 Arts. 42 y 111-126, D.S. N° 43/2015, D.S. 157/2005 y directrices del Protocolo Plaguicidas MINSAL / SAG."
        ),
        "normativa_legal_vigente": "D.S. N° 594 / D.S. N° 43 / Protocolo de Vigilancia Plaguicidas MINSAL 2014 (Archivos: protocolo_minsal_plaguicidas.md, Decreto_Supremo_N°_594.md)",
        "organismo_exigente": "Ministerio de Salud (MINSAL) / SEREMI de Salud / SAG",
        "relator_predeterminado": "Ingeniero Agrónomo / Toxicólogo / Ingeniero en Prevención de Riesgos",
        "precio_clp": 85000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Clasificación toxicológica según OMS/SAG (Etiquetas roja, amarilla, azul, verde)",
            "Vías de intoxicación: Dérmica (95% de los casos laborales), respiratoria y digestiva",
            "Interpretación de Hojas de Datos de Seguridad HDS (NCh 2245)",
            "Procedimiento del Triple Lavado e inutilización (perforación) de envases vacíos",
            "Condiciones seguras de bodegas de sustancias peligrosas bajo el D.S. N° 43",
            "Equipo de Protección Personal (EPP) químico: Traje impermeable (Tyvek), botas de goma, guantes de nitrilo y máscara con filtro mixto",
            "Periodos de Carencia y Reingreso a predios tratados",
            "Vigilancia médica: Monitoreo de colinesterasa eritrocitaria para expuestos a organofosforados y carbamatos"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Cuál es la principal vía de ingreso de plaguicidas al organismo en el ámbito laboral agrícola e industrial?",
                "opciones": [
                    "Vía dérmica (a través de la piel y mucosas)",
                    "Vía ocular exclusivamente",
                    "Ingestión accidental por alimentos",
                    "Por picaduras de insectos"
                ],
                "correcta": 0,
                "explicacion": "Más del 95% de las intoxicaciones laborales por plaguicidas ocurren por absorción a través de la piel durante la mezcla y aplicación."
            },
            {
                "id": 2,
                "pregunta": "¿Qué técnica obligatoria debe aplicarse a los envases vacíos de plaguicidas antes de su disposición?",
                "opciones": [
                    "Enterrarlos en el predio o quemarlos al aire libre",
                    "Triple lavado inmediato durante el vaciado, escurrimiento e inutilización mediante perforación sin dañar la etiqueta",
                    "Reutilizarlos para almacenar agua potable o alimentos",
                    "Vaciarlos en cursos de agua o acequias"
                ],
                "correcta": 1,
                "explicacion": "El triple lavado recupera el remanente productivo y descontamina el envase para su posterior reciclaje autorizado."
            },
            {
                "id": 3,
                "pregunta": "¿Qué EPP es indispensable durante la preparación de la mezcla de agroquímicos concentrados?",
                "opciones": [
                    "Solo polera de algodón y lentes de sol",
                    "Traje impermeable completo, delantal químico, guantes de nitrilo largos, botas sin forro y máscara con filtro para gases y vapores",
                    "Guantes de cuero o lana",
                    "No se requiere EPP si se realiza al aire libre"
                ],
                "correcta": 1,
                "explicacion": "La mezcla presenta el mayor riesgo toxicológico por concentración pura del producto, exigiendo barrera química impermeable."
            },
            {
                "id": 4,
                "pregunta": "¿Qué examen de laboratorio monitorea la exposición a plaguicidas organofosforados en trabajadores expuestos?",
                "opciones": [
                    "Hemograma simple",
                    "Actividad de la enzima Colinesterasa eritrocitaria / plasmática",
                    "Examen de orina simple",
                    "Radiografía lumbar"
                ],
                "correcta": 1,
                "explicacion": "El protocolo MINSAL exige vigilar la inhibición de la colinesterasa antes, durante y después de la temporada de aplicación."
            }
        ]
    },
    {
        "titulo": "Protocolo de Riesgos Psicosociales Laborales (Cuestionario CEAL-SM)",
        "categoria": TemaCapacitacion.CATEGORIA_CEAL_SM,
        "duracion_minutos": 120,
        "descripcion": (
            "Instrucción en aplicación e interpretación del Método Cuestionario CEAL-SM / SUSESO de acuerdo a la Circular N° 3.705. "
            "Enseña las 12 dimensiones psicosociales, rol del Comité de Aplicación (CdA), confidencialidad y diseño de medidas de mitigación."
        ),
        "normativa_legal_vigente": "Circular SUSESO N° 3.705 (2022) / Manual Cuestionario CEAL-SM / D.S. N° 594 (Archivo: protocolo_suseso_ceal_sm_psicosocial.md)",
        "organismo_exigente": "Superintendencia de Seguridad Social (SUSESO) / MINSAL",
        "relator_predeterminado": "Psicólogo Laboral / Especialista en Salud Mental y Factores Psicosociales",
        "precio_clp": 80000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Marco regulatorio de la Circular SUSESO N° 3.705 y evolución desde SUSESO/ISTAS21 a CEAL-SM",
            "Las 12 dimensiones psicosociales evaluadas: Carga de trabajo, Exigencias emocionales, Desarrollo, Reconocimiento, Claridad de rol, Conflicto de rol, Compañerismo, Apoyo social, Liderazgo, Equilibrio trabajo-vida privada, Confianza y Violencia/Acoso",
            "Constitución y funcionamiento paritario del Comité de Aplicación (CdA)",
            "Garantías de anonimato, confidencialidad y tasa mínima de respuesta para validez de la muestra",
            "Interpretación de niveles de riesgo: Riesgo Bajo, Riesgo Medio y Riesgo Alto",
            "Formulación participativa del Plan de Medidas de Mitigación e Intervención Organizacional",
            "Seguimiento, reevaluación cada 2 años y fiscalización ante el portal de la SUSESO"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Qué instrumento oficial rige en Chile para la medición de riesgos psicosociales laborales desde 2023 según SUSESO?",
                "opciones": [
                    "Cuestionario de 16 Personalidades",
                    "Cuestionario CEAL-SM / SUSESO (Circular N° 3.705)",
                    "Prueba de Rorschach",
                    "Encuesta de clima laboral comercial no estandarizada"
                ],
                "correcta": 1,
                "explicacion": "La Circular N° 3.705 de la SUSESO estableció el cuestionario CEAL-SM como el método oficial único para medir factores psicosociales."
            },
            {
                "id": 2,
                "pregunta": "¿Cómo debe asegurarse la participación de los trabajadores en la contestación del CEAL-SM?",
                "opciones": [
                    "El jefe de área contesta por todo su equipo",
                    "Respuesta directa, anónima, confidencial y voluntaria garantizada por el Comité de Aplicación",
                    "Identificando nombre y RUT en cada cuestionario",
                    "Solo responden los trabajadores con contrato indefinido"
                ],
                "correcta": 1,
                "explicacion": "El anonimato y la confidencialidad son garantías legales estrictas para evitar sesgos y represalias."
            },
            {
                "id": 3,
                "pregunta": "¿Quién está a cargo de coordinar y vigilar la aplicación del protocolo en el centro de trabajo?",
                "opciones": [
                    "El Comité de Aplicación (CdA), integrado de forma paritaria por representantes de la empresa y los trabajadores",
                    "El auditor contable externo",
                    "La Inspección del Trabajo de forma presencial permanente",
                    "Un único directivo designado a dedo"
                ],
                "correcta": 0,
                "explicacion": "El Comité de Aplicación (CdA) paritario es la entidad responsable de sensibilizar, aplicar y diseñar las medidas."
            },
            {
                "id": 4,
                "pregunta": "¿Qué ocurre si un centro de trabajo resulta con nivel de 'Riesgo Alto' en el cuestionario CEAL-SM?",
                "opciones": [
                    "Se despide a todos los involucrados",
                    "Ingresa a programa de vigilancia del organismo administrador y debe implementar medidas prescriptivas en plazos perentorios",
                    "Se ignora el resultado por 5 años",
                    "Se repite la encuesta de inmediato hasta que salga verde"
                ],
                "correcta": 1,
                "explicacion": "El nivel de Riesgo Alto activa la vigilancia formal de la mutualidad/ISL y la prescripción obligatoria de medidas correctivas."
            }
        ]
    },
    {
        "titulo": "Protocolo y Actuación ante Accidentes Graves y Fatales (Circular N° 3.336 SUSESO)",
        "categoria": TemaCapacitacion.CATEGORIA_ACCIDENTES_GRAVES,
        "duracion_minutos": 120,
        "descripcion": (
            "Procedimiento legal de suspensión de faenas, evacuación, notificación obligatoria e investigación ante siniestros de alto impacto. "
            "Basado en la Circular SUSESO N° 3.336 / 3.335, Artículo 76 de la Ley N° 16.744 y sistema electrónico RALF (eDocs 141 al 147)."
        ),
        "normativa_legal_vigente": "Circular SUSESO N° 3.336 / 3.335 / Ley N° 16.744 Art. 76 (Archivo: directriz_suseso_circular_3336_accidentes_graves_fatales.md)",
        "organismo_exigente": "SUSESO / Dirección del Trabajo (DT) / SEREMI de Salud",
        "relator_predeterminado": "Ingeniero Senior en Prevención de Riesgos / Auditor Legal SST",
        "precio_clp": 75000,
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        "requiere_evaluacion": True,
        "porcentaje_aprobacion": 75,
        "contenido_clave": [
            "Definiciones operacionales: Criterio de Accidente Fatal y Accidente Grave (Amputación, Caída > 1.8m, Rescate, Reanimación, Hiperbárico, Masivo)",
            "Obligación inmediata del empleador: Suspensión inmediata de la faena afectada y evacuación del personal",
            "Notificación telefónica perentoria a la DT y SEREMI de Salud vía número único 600 42 000 22",
            "Emisión formal de la DIAT ante la Mutualidad/ISL dentro de las 24 horas siguientes",
            "Responsabilidades en régimen de subcontratación y Empresas de Servicios Transitorios (EST)",
            "Investigación obligatoria por el Comité Paritario mediante Árbol de Causas e informes RALF (eDoc 141-147)",
            "Condiciones y trámite formal para la autorización de reanudación de faenas por la autoridad fiscalizadora"
        ],
        "preguntas_evaluacion": [
            {
                "id": 1,
                "pregunta": "¿Qué dos acciones inmediatas debe realizar el empleador ante un accidente del trabajo fatal o grave según el Art. 76 Ley 16.744?",
                "opciones": [
                    "Llamar a un abogado y limpiar el lugar del hecho",
                    "Suspender en forma inmediata las faenas afectadas y notificar inmediatamente a la Inspección del Trabajo y a la Seremi de Salud",
                    "Continuar trabajando en otro sector sin avisar a nadie",
                    "Esperar a la reunión mensual del Comité Paritario"
                ],
                "correcta": 1,
                "explicacion": "El Art. 76 Ley 16.744 ordena suspender de inmediato las labores afectadas e informar de inmediato a la DT y SEREMI."
            },
            {
                "id": 2,
                "pregunta": "¿Cuál de los siguientes siniestros califica taxativamente como 'Accidente Grave' según la Circular SUSESO N° 3.336?",
                "opciones": [
                    "Un corte superficial con una hoja de papel",
                    "Caída de altura de más de 1.8 metros (medida tomando como referencia el nivel más bajo)",
                    "Un dolor de cabeza leve al final del turno",
                    "Un esguince leve de tobillo durante el trayecto a pie"
                ],
                "correcta": 1,
                "explicacion": "La caída de altura sobre 1,8 metros está tipificada expresamente en el numeral 2 letra d) de la Circular 3.336 como accidente grave."
            },
            {
                "id": 3,
                "pregunta": "¿A través de qué número único nacional se debe realizar la notificación inmediata a las autoridades?",
                "opciones": [
                    "133 de Carabineros únicamente",
                    "600 42 000 22 (Call Center único DT / SEREMI de Salud)",
                    "Al teléfono móvil personal del prevencionista",
                    "No existe número telefónico oficial"
                ],
                "correcta": 1,
                "explicacion": "La Circular 3.336 instruye la notificación telefónica inmediata al número único fiscalizador 600 42 000 22."
            },
            {
                "id": 4,
                "pregunta": "¿Quién es la única entidad que puede autorizar la reanudación de una faena suspendida por accidente grave o fatal?",
                "opciones": [
                    "El Gerente General de la empresa de forma verbal",
                    "La entidad fiscalizadora (Inspección del Trabajo o SEREMI de Salud) que constató la suspensión, previa verificación de subsanación",
                    "El presidente del sindicato",
                    "Cualquier supervisor de turno"
                ],
                "correcta": 1,
                "explicacion": "El empleador no puede reanudar la faena por decisión propia; requiere verificación y alzamiento por la DT o SEREMI."
            }
        ]
    }
]


def poblar_conferencias():
    admin_user = Usuario.objects.filter(is_superuser=True).first()
    if not admin_user:
        admin_user = Usuario.objects.first()

    total_creados = 0
    total_actualizados = 0

    print("Iniciando poblamiento de Conferencias Grabadas On-Demand basadas en doc_agents...")

    for data in CONFERENCIAS_DEDUCIDAS:
        tema, created = TemaCapacitacion.objects.update_or_create(
            titulo=data["titulo"],
            defaults={
                "usuario": admin_user,
                "categoria": data["categoria"],
                "duracion_minutos": data["duracion_minutos"],
                "descripcion": data["descripcion"],
                "contenido_clave": data["contenido_clave"],
                "es_conferencia_grabada": True,
                "precio_clp": data["precio_clp"],
                "video_url": data["video_url"],
                "normativa_legal_vigente": data["normativa_legal_vigente"],
                "organismo_exigente": data["organismo_exigente"],
                "requiere_evaluacion": data["requiere_evaluacion"],
                "porcentaje_aprobacion": data["porcentaje_aprobacion"],
                "preguntas_evaluacion": data["preguntas_evaluacion"],
                "relator_predeterminado": data["relator_predeterminado"]
            }
        )
        if created:
            total_creados += 1
            print(f" [+] Creado: {tema.titulo} ({tema.normativa_legal_vigente})")
        else:
            total_actualizados += 1
            print(f" [~] Actualizado: {tema.titulo} ({tema.normativa_legal_vigente})")

    print(f"\nListo: {total_creados} conferencias creadas, {total_actualizados} actualizadas.")


class Command(BaseCommand):
    help = 'Puebla el catálogo oficial de conferencias grabadas deducidas de los 19 documentos normativos en doc_agents'

    def handle(self, *args, **options):
        poblar_conferencias()
        self.stdout.write(self.style.SUCCESS("Seeder de conferencias completado con éxito."))


if __name__ == '__main__':
    poblar_conferencias()
