"""
Seeder oficial de Requisitos Legales Base de Seguridad y Salud en el Trabajo (SST) para Chile.
Normativa: D.S. 594, Ley 16.744, D.S. 44, Ley Karin 21.643, D.S. 76, D.S. 132, D.S. 43, D.S. 158, Protocolos MINSAL.
"""

from modulo_prevencion.models import RequisitoLegalBase

REQUISITOS_OFICIALES = [
    # -------------------------------------------------------------
    # TRANSVERSALES (APLICAN A TODAS LAS EMPRESAS)
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_LEY,
        "identificacion_norma": "Ley N° 16.744",
        "articulo": "Art. 67",
        "titulo": "Reglamento Interno de Higiene y Seguridad Obligatorio",
        "descripcion_exigencia": "Las empresas o entidades estarán obligadas a mantener al día un reglamento interno de higiene y seguridad en el trabajo, cuyo cumplimiento será obligatorio para los trabajadores.",
        "sancion_multa": "Multa de 10 a 60 UTM aplicada por la Inspección del Trabajo.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 10,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_LEY,
        "identificacion_norma": "Ley N° 16.744",
        "articulo": "Art. 68",
        "titulo": "Gratuidad y Certificación Oficial de Elementos de Protección Personal (EPP)",
        "descripcion_exigencia": "Las empresas deberán proporcionar a sus trabajadores, libre de todo costo y cualquiera sea la función que desempeñen, los equipos e implementos de protección necesarios, no pudiendo cobrar su valor ni compensarlos en dinero. Los EPP deben contar con certificación de calidad de organismos autorizados por el Instituto de Salud Pública (ISP).",
        "sancion_multa": "Multa gravísima de 20 a 60 UTM por trabajador no protegido e imputación de culpa patronal en caso de accidente.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 20,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 594",
        "articulo": "Art. 12 al 15",
        "titulo": "Provisión de Agua Potable y Servicios Higiénicos en Lugares de Trabajo",
        "descripcion_exigencia": "Todo lugar de trabajo debe contar con agua potable para consumo humano y necesidades básicas (mínimo 100 litros diarios por trabajador en faenas sin red). Debe disponer de servicios higiénicos independientes por sexo, lavamanos, duchas con agua caliente para actividades sucias y casilleros individuales.",
        "sancion_multa": "Multa de 5 a 100 UTM por la Seremi de Salud y eventual clausura o paralización de faena.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 30,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 594",
        "articulo": "Art. 36 al 43",
        "titulo": "Ventilación, Calidad del Aire y Control de Contaminantes Ambientales",
        "descripcion_exigencia": "Los locales de trabajo deben mantener por medios naturales o artificiales condiciones atmosféricas adecuadas. No se permite emanación de gases, vapores o polvos que excedan los límites permisibles ponderados (LPP).",
        "sancion_multa": "Sumario sanitario de 10 a 500 UTM con requerimiento de mitigación inmediata.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 40,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 594",
        "articulo": "Art. 44 al 52",
        "titulo": "Extintores de Incendio, Señalética de Emergencia y Vías de Evacuación",
        "descripcion_exigencia": "Dotación de extintores de incendio certificados tipo y potencial adecuado al fuego, con mantención anual vigente, señalización reglamentaria, a no más de 1.30m del suelo, con vías de evacuación despejadas y personal adiestrado en su uso.",
        "sancion_multa": "10 a 50 UTM por la Seremi de Salud e infracción ante la Dirección del Trabajo.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 50,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 594",
        "articulo": "Art. 53",
        "titulo": "Capacitación Obligatoria Teórico-Práctica en Uso de EPP",
        "descripcion_exigencia": "El empleador debe capacitar a los trabajadores en el uso correcto, limitaciones, inspección y conservación adecuada de los elementos de protección personal proporcionados, dejando constancia firmada de la instrucción.",
        "sancion_multa": "Multa de 10 a 40 UTM por falta de acreditación documental en fiscalización.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 60,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 594",
        "articulo": "Art. 109",
        "titulo": "Protección Obligatoria contra Radiación Ultravioleta (UV) de Origen Solar",
        "descripcion_exigencia": "Implementación de programa de protección UV solar: publicación diaria del índice UV, capacitación semestral, provisión de protector solar FPS 30+ o 50+ certificado con reaplicación cada 2-3 horas, lentes con filtro UV 400 y gorros con cubrenuca.",
        "sancion_multa": "Multa de 10 a 60 UTM ante la DT y Seremi de Salud.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 70,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEC,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 8 (Ministerio de Energía)",
        "articulo": "Reglamento de Seguridad Eléctrica (RIC 01 al 19)",
        "titulo": "Seguridad en Instalaciones Eléctricas de Consumo, Puesta a Tierra y Protecciones Diferenciales",
        "descripcion_exigencia": "Las instalaciones de consumo de energía eléctrica de los lugares de trabajo deben proyectarse, ejecutarse y mantenerse según las especificaciones del D.S. N° 8 SEC y pliegos técnicos RIC. Exige inspección periódica de protecciones diferenciales, mantención de tableros con señalética de peligro de muerte, puesta a tierra certificada y personal calificado con licencia SEC vigente.",
        "sancion_multa": "Multas aplicadas por la SEC de 1 a 10.000 UTA y desconexión inmediata de empalmes por riesgo inminente de incendio o electrocución.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 75,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 44",
        "articulo": "Art. 15",
        "titulo": "Información de los Riesgos Laborales (ODI Art. 15 D.S. N° 44)",
        "descripcion_exigencia": "Los empleadores tienen la obligación de informar oportuna y convenientemente a todos sus trabajadores acerca de los riesgos laborales que entrañan sus labores, las medidas preventivas y los métodos de trabajo correctos (Art. 15 D.S. N° 44), mediante inducción y entrega firmada con respaldo formal.",
        "sancion_multa": "Multa gravísima de 10 a 60 UTM por trabajador no informado y responsabilidad civil patronal directa.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 80,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_LEY,
        "identificacion_norma": "Ley N° 21.643",
        "articulo": "Ley Karin",
        "titulo": "Protocolo de Prevención del Acoso Sexual, Laboral y Violencia en el Trabajo",
        "descripcion_exigencia": "Las empresas deben contar con protocolo de prevención del acoso laboral, sexual y violencia en el trabajo; disponer de canal de denuncias protegido; aplicar medidas de resguardo inmediatas y remitir denuncias a la Inspección del Trabajo dentro de 3 días hábiles (72h) si no realiza investigación interna.",
        "sancion_multa": "Multas de hasta 60 UTM e indemnizaciones agravadas del 80% al 100% en demandas por despido indirecto o tutela laboral.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 90,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SUSESO,
        "tipo_norma": RequisitoLegalBase.TIPO_CIRCULAR,
        "identificacion_norma": "Circular N° 3.705 SUSESO / MINSAL",
        "articulo": "Protocolo CEAL-SM / SUSESO",
        "titulo": "Evaluación Periódica de Riesgos Psicosociales en el Trabajo (CEAL-SM)",
        "descripcion_exigencia": "Obligación de constituir el Comité de Aplicación (CdA) paritario y aplicar el Cuestionario de Evaluación de Ambientes Laborales - Salud Mental (CEAL-SM) en sus versiones breve o completa según corresponda, formular plan de medidas de mitigación y remitir resultados a la mutualidad y SUSESO.",
        "sancion_multa": "Reclasificación a Riesgo Psicosocial Alto / Riesgo Cat. 1, sumarios sanitarios Seremi y multas de la DT de 20 a 60 UTM.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 92,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_CODIGO,
        "identificacion_norma": "Código del Trabajo",
        "articulo": "Art. 153 a 157",
        "titulo": "Reglamento Interno de Orden, Higiene y Seguridad (RIOHS) Depositado",
        "descripcion_exigencia": "Obligatorio para empresas con 10 o más trabajadores permanentes. Debe confeccionarse conforme a la ley, entregarse copia gratuita a cada trabajador con constancia firmada, y remitirse copias dentro de los 5 días de vigencia a la Dirección del Trabajo y a la Seremi de Salud.",
        "sancion_multa": "Multa de 10 a 60 UTM por omisión o falta de depósito formal en los organismos fiscalizadores.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "MAS_10_TRABAJADORES",
        "orden": 100,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 44",
        "articulo": "Arts. 23 al 49",
        "titulo": "Constitución y Funcionamiento del Comité Paritario de Higiene y Seguridad (CPHS)",
        "descripcion_exigencia": "En toda empresa, faena, sucursal o agencia en que trabajen más de 25 personas es obligatoria la constitución y funcionamiento de un CPHS integrado por 3 representantes patronales y 3 de los trabajadores (más suplentes). Deben sesionar al menos una vez al mes con quorum legal (Art. 40 D.S. 44) y levantar actas oficiales.",
        "sancion_multa": "Multa de 10 a 60 UTM aplicada por la Inspección del Trabajo.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "MAS_25_TRABAJADORES",
        "orden": 110,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 44",
        "articulo": "Arts. 50 al 56",
        "titulo": "Departamento de Prevención de Riesgos Dirigido por Experto Registrado",
        "descripcion_exigencia": "Toda empresa que cuente con más de 100 trabajadores o que desarrolle actividades de alto riesgo debe contar con un Departamento de Prevención de Riesgos dirigido por un experto profesional o técnico con registro vigente ante el SNS / Seremi de Salud (Arts. 50 al 56 D.S. N° 44).",
        "sancion_multa": "Multa de 20 a 100 UTM e inhabilidad para licitaciones públicas de organismos del Estado.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "MAS_100_TRABAJADORES",
        "orden": 120,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SUSESO,
        "tipo_norma": RequisitoLegalBase.TIPO_CIRCULAR,
        "identificacion_norma": "Circular 3336 SUSESO",
        "articulo": "Título I y II",
        "titulo": "Tramitación de DIAT en 24 Horas y Protocolo de Accidente Grave o Fatal",
        "descripcion_exigencia": "El empleador debe formalizar la Denuncia Individual de Accidente del Trabajo (DIAT) ante la mutualidad dentro de las 24 horas siguientes al siniestro. Ante accidente fatal o grave, debe auto-suspender la faena de inmediato e informar por vía telefónica/web a la Inspección del Trabajo y Seremi de Salud.",
        "sancion_multa": "Multa gravísima de 50 a 150 UTM por no suspender faena o no informar oportunamente a la autoridad.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 130,
    },

    # -------------------------------------------------------------
    # SECTOR CONSTRUCCIÓN Y OBRAS CIVILES
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 76",
        "articulo": "Art. 1 al 10",
        "titulo": "Sistema de Gestión de SST y Reglamento Especial para Contratistas (D.S. 76)",
        "descripcion_exigencia": "En faenas con régimen de subcontratación donde laboren más de 50 trabajadores, la empresa principal debe implementar un Sistema de Gestión de SST, confeccionar el Reglamento Especial para Contratistas, coordinar las actividades preventivas y fiscalizar el cumplimiento de contratistas y subcontratistas.",
        "sancion_multa": "Multa de 20 a 60 UTM a la empresa mandante y responsabilidad solidaria ante accidentes.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_CONSTRUCCION,
        "condicion_activacion": "SUBCONTRATACION",
        "orden": 200,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_RESOLUCION,
        "identificacion_norma": "NCh 349",
        "articulo": "Punto 4 y 5",
        "titulo": "Medidas de Seguridad Obligatorias en Excavaciones y Entibaciones",
        "descripcion_exigencia": "Toda excavación con profundidad superior a 1.20 metros debe contar con entibación o talud según estudio de mecánica de suelos, señalización perimetral, pasarelas seguras con barandas y escalas de acceso/escape cada 15 metros.",
        "sancion_multa": "Paralización inmediata de la excavación por riesgo inminente de derrumbe y multa de 10 a 80 UTM.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_CONSTRUCCION,
        "condicion_activacion": "",
        "orden": 210,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_RESOLUCION,
        "identificacion_norma": "NCh 998 / NCh 1258",
        "articulo": "Norma Andamios y Altura",
        "titulo": "Andamios Certificados y Sistema Personal de Detención de Caídas (SPDC)",
        "descripcion_exigencia": "Para trabajos sobre 1.80 metros de altura es obligatorio el uso de arnés de cuerpo entero con dos cabos de vida y amortiguador de impacto, anclado a línea de vida independiente. Los andamios deben ser modulares certificados, con tarjeta de inspección diaria verde/roja, rodapiés y barandas perimetrales dobles.",
        "sancion_multa": "Suspensión inmediata de labores en altura por peligro inminente y multa de 20 a 60 UTM por trabajador expuesto.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_CONSTRUCCION,
        "condicion_activacion": "TRABAJO_ALTURA",
        "orden": 220,
    },

    # -------------------------------------------------------------
    # SECTOR MINERÍA Y SONDAJES
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SERNAGEOMIN,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 132",
        "articulo": "Art. 22 a 40",
        "titulo": "Reglamento de Seguridad Minera: Inducción, Libros de Obra y Registro Sernageomin",
        "descripcion_exigencia": "Toda faena minera debe contar con método de explotación aprobado por Sernageomin, llevar Libro de Obra Minero foliado, impartir inducción obligatoria de faena a todo personal antes de ingresar y contar con prevencionista acreditado Sernageomin (Categoría A, B o C).",
        "sancion_multa": "Multa de 20 a 1000 UTM aplicada por Sernageomin y clausura temporal o definitiva de la faena minera.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_MINERIA,
        "condicion_activacion": "",
        "orden": 300,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SERNAGEOMIN,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 132",
        "articulo": "Art. 138 al 145",
        "titulo": "Control de Ventilación de Minas Subterráneas y Monitoreo de Gases",
        "descripcion_exigencia": "En minería subterránea se debe garantizar un caudal mínimo de 3 metros cúbicos por minuto por persona, monitoreo continuo de gases (CO, CO2, NOx, CH4 y O2 mínimo 19.5%) y prohibición de ingreso sin detector multigás calibrado.",
        "sancion_multa": "Cierre inmediato de la labor subterránea por riesgo inminente de asfixia/explosión y sumario Sernageomin.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_MINERIA,
        "condicion_activacion": "ESPACIOS_CONFINADOS",
        "orden": 310,
    },

    # -------------------------------------------------------------
    # SECTOR QUÍMICO Y SUSTANCIAS PELIGROSAS
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 43",
        "articulo": "Art. 1 al 25",
        "titulo": "Almacenamiento de Sustancias Peligrosas (Hojas de Seguridad y Contención)",
        "descripcion_exigencia": "Las bodegas de sustancias peligrosas deben contar con autorización sanitaria expresa de la Seremi, muros cortafuego RF-120/180, sistema de contención de derrames con volumen mínimo reglamentario, duchas lavaojos de emergencia y hojas de datos de seguridad (HDS) en español formato NCh 2245.",
        "sancion_multa": "Sumario sanitario de 20 a 500 UTM y decomiso de sustancias no autorizadas.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_QUIMICA,
        "condicion_activacion": "SUSTANCIAS_PELIGROSAS",
        "orden": 400,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 148",
        "articulo": "Art. 10 al 30",
        "titulo": "Manejo y Declaración de Residuos Peligrosos (RESPEL - Sistema SIDREP)",
        "descripcion_exigencia": "Toda empresa que genere más de 12 kilogramos de residuos tóxicos agudos o 12 toneladas de residuos peligrosos al año debe contar con Plan de Manejo de RESPEL aprobado por la autoridad sanitaria, bodega exclusiva techada y declarar transferencias en SIDREP.",
        "sancion_multa": "Multa de 50 a 1000 UTM aplicada por la Superintendencia del Medio Ambiente (SMA) y Seremi de Salud.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_QUIMICA,
        "condicion_activacion": "SUSTANCIAS_PELIGROSAS",
        "orden": 410,
    },

    # -------------------------------------------------------------
    # SECTOR AGRÍCOLA Y FORESTAL
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SAG,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 158 / D.S. 5",
        "articulo": "Art. 3 al 18",
        "titulo": "Condiciones para el Manejo y Aplicación de Plaguicidas Agrícolas",
        "descripcion_exigencia": "Los aplicadores de plaguicidas deben contar con credencial SAG vigente, examen de colinesterasa basal y periódica, bodega exclusiva de fitosanitarios ventilada bajo llave, y aplicar la técnica del triple lavado de envases vacíos antes de su entrega al centro de acopio.",
        "sancion_multa": "Multa de 10 a 200 UTM por el SAG y Seremi de Salud.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_AGRICOLA,
        "condicion_activacion": "",
        "orden": 500,
    },

    # -------------------------------------------------------------
    # SECTOR TRANSPORTE Y LOGÍSTICA
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_DT,
        "tipo_norma": RequisitoLegalBase.TIPO_CODIGO,
        "identificacion_norma": "Código del Trabajo",
        "articulo": "Art. 25 bis",
        "titulo": "Jornadas de Conducción, Descansos Obligatorios y Registro de Asistencia en Transporte",
        "descripcion_exigencia": "La jornada de los choferes de vehículos de carga terrestre interurbana no excederá de 180 horas mensuales. En ningún caso el chofer podrá manejar más de 5 horas continuas, tras las cuales debe tener un descanso mínimo de dos horas. Registro de asistencia con tacógrafo digital o dispositivo automatizado homologado por la DT.",
        "sancion_multa": "Multa de 20 a 60 UTM por conductor con jornada excedida o sin registro fidedigno.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSPORTE,
        "condicion_activacion": "",
        "orden": 600,
    },

    # -------------------------------------------------------------
    # SECTOR ALIMENTOS Y GASTRONOMÍA
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 977",
        "articulo": "Art. 50 al 75",
        "titulo": "Reglamento Sanitario de los Alimentos: Higiene del Personal y Buenas Prácticas (BPM)",
        "descripcion_exigencia": "Todo establecimiento de alimentos debe contar con resolución sanitaria de funcionamiento, uniforme de trabajo limpio exclusivo, cofia, capacitación periódica en manipulación higiénica de alimentos, control de temperaturas y programa de control de plagas certificado.",
        "sancion_multa": "De 10 a 200 UTM y prohibición inmediata de funcionamiento por riesgo de intoxicación alimentaria.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_ALIMENTOS,
        "condicion_activacion": "",
        "orden": 700,
    },

    # -------------------------------------------------------------
    # SECTOR INDUSTRIA MANUFACTURERA Y METALMECÁNICA
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_DS,
        "identificacion_norma": "D.S. N° 594",
        "articulo": "Art. 70 al 82",
        "titulo": "Protección de Maquinarias, Partes Móviles y Bloqueo de Energías Peligrosas (LOTO)",
        "descripcion_exigencia": "Todas las maquinarias, transmisiones, engranajes y partes en movimiento deben contar con resguardos y protecciones fijas que impidan el atrapamiento. Es obligatorio contar con procedimiento de bloqueo de energía cero (Lockout/Tagout - LOTO) para labores de mantención o limpieza.",
        "sancion_multa": "Multa de 20 a 80 UTM por máquina desprotegida y responsabilidad directa en amputaciones o atrapamientos.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_INDUSTRIA,
        "condicion_activacion": "",
        "orden": 800,
    },

    # -------------------------------------------------------------
    # PROTOCOLOS TÉCNICOS MINSAL (VIGILANCIA EPIDEMIOLÓGICA)
    # -------------------------------------------------------------
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_PROTOCOLO,
        "identificacion_norma": "Protocolo PREXOR",
        "articulo": "Res. Ex. 1052 MINSAL",
        "titulo": "Protocolo de Exposición Ocupacional a Ruido (PREXOR)",
        "descripcion_exigencia": "Evaluación cuantitativa de niveles de presión sonora por el organismo administrador (mutualidad) en puestos con riesgo de ruido (>82 dBA). Implementación de medidas de control ingenieril y administrativo, programa de protección auditiva y vigilancia médica de audiometrías periódicas.",
        "sancion_multa": "Sumario sanitario de 10 a 200 UTM por la Seremi de Salud.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "RUIDO_OCUPACIONAL",
        "orden": 900,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_PROTOCOLO,
        "identificacion_norma": "Protocolo PLANESI",
        "articulo": "Res. Ex. 268 MINSAL",
        "titulo": "Plan Nacional para la Erradicación de la Silicosis (PLANESI)",
        "descripcion_exigencia": "Obligatorio en todo puesto con presencia de polvo con sílice libre cristalizada (construcción, minería, canteras, fundición). Exige humectación de cortes, captación localizada de polvo, protección respiratoria de alta eficiencia P100 y radiografías de tórax OIT a trabajadores expuestos.",
        "sancion_multa": "Multa de 30 a 500 UTM por omisión de vigilancia médica y suspensión de faena.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "SILICE_POLVO",
        "orden": 910,
    },
    {
        "organismo": RequisitoLegalBase.ORGANISMO_SEREMI,
        "tipo_norma": RequisitoLegalBase.TIPO_PROTOCOLO,
        "identificacion_norma": "Norma Técnica TMERT",
        "articulo": "D.S. 594 Art. 110a",
        "titulo": "Protocolo de Trastornos Musculoesqueléticos de Extremidades Superiores (TMERT-EESS)",
        "descripcion_exigencia": "Identificación y evaluación de factores de riesgo biomecánicos por movimientos repetitivos, posturas forzadas y manipulación de cargas. Aplicación de lista de chequeo inicial MINSAL, implementación de pausas activas o rediseño ergonómico de puestos de trabajo.",
        "sancion_multa": "Multa de 10 a 100 UTM aplicada por la Inspección del Trabajo o la Seremi de Salud.",
        "rubro_aplicable": RequisitoLegalBase.RUBRO_TRANSVERSAL,
        "condicion_activacion": "",
        "orden": 920,
    },
]


def asegurar_requisitos_base() -> int:
    """
    Puebla el catálogo de requisitos legales base chilenos si no existen en la base de datos.
    Retorna el total de requisitos creados o actualizados.
    """
    total = 0
    for data in REQUISITOS_OFICIALES:
        obj, created = RequisitoLegalBase.objects.update_or_create(
            identificacion_norma=data["identificacion_norma"],
            articulo=data["articulo"],
            defaults={
                "organismo": data["organismo"],
                "tipo_norma": data["tipo_norma"],
                "titulo": data["titulo"],
                "descripcion_exigencia": data["descripcion_exigencia"],
                "sancion_multa": data["sancion_multa"],
                "rubro_aplicable": data["rubro_aplicable"],
                "condicion_activacion": data["condicion_activacion"],
                "orden": data["orden"],
                "activo": True,
            }
        )
        total += 1
    return total
