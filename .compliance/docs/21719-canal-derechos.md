# Canal de Ejercicio de Derechos del Titular (ARCO-POL + Bloqueo) — [COMPLETAR: Razón Social definitiva en trámite con abogada]

> Conforme a los **Artículos 4 al 11 y 14 ter de la Ley N° 21.719** (`sources/ley-21719-texto.txt`), el responsable debe disponer de un medio electrónico ágil, sencillo y gratuito para que el titular ejerza sus derechos, acusar recibo y responder dentro de los plazos legales.

---

## 1. Texto público ("Tus derechos", para `/privacidad`, `/derechos-arco` y footer)

> Como titular de tus datos personales puedes ejercer en cualquier momento los derechos de **acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal**, así como **retirar tu consentimiento** cuando el tratamiento se base en él.  
> Ingresa tu solicitud en nuestro **[Portal de Derechos ARCO-POL](/derechos-arco)** o escribe a **[COMPLETAR: Correo oficial de privacidad, ej. privacidad@hdprevencion.cl]**.  
> Respondemos dentro de un plazo máximo de **30 días corridos** (prorrogable una sola vez por hasta 30 días corridos más), y dentro de **2 días hábiles** en solicitudes fundadas de **bloqueo temporal**. La rectificación, supresión y oposición son **siempre gratuitas**, y el acceso es gratuito al menos **una vez por trimestre**. Si no estás conforme con la respuesta o no respondemos en plazo, puedes reclamar ante la **Agencia de Protección de Datos Personales**.

---

## 2. Procedimiento interno operativo (verificado contra Ley 21.719)

### Paso 1: Recepción y verificación de identidad (Art. 11 inc. 1° letra a)
1. Toda solicitud entra por `POST /api/privacidad/solicitar-derecho/` (modelo `SolicitudDerechoARCO`, ticket UUID) o por el correo oficial de privacidad (si llega por correo, registrarla manualmente el mismo día en el sistema).
2. **Verificación obligatoria de identidad (antes de entregar datos o ejecutar cambios):**
   - Si el solicitante tiene cuenta en la plataforma: validar que la solicitud provenga de su sesión autenticada o confirmar mediante desafío enviado al correo registrado en `Usuario.email`.
   - Si es un trabajador de una empresa cliente o titular externo: **NUNCA entregar datos ni portabilidad por la sola digitación del RUT** (`PortabilidadDatosView` ya quedó restringida a sesiones autenticadas y aisladas por tenant en `views.py:4294-4347`, y `_resolver_alcance_arco_request` + `resolver_emails_trabajador_tenant` [`views.py:4350-4400`, `arco.py:832-917`] validan estrictamente pertenencia de `email`, `rut` y `solicitud_uuid`). Para solicitudes externas sin cuenta vía `/derechos-arco` (que ya muestran `fecha_limite_bloqueo_2d` y aviso APDP), verificar identidad exigiendo coincidencia con datos registrados en la ficha (RUT + correo/teléfono) + validación OTP al correo (cuando se habilite SMTP) o validación documental/aprobación conjunta con la empresa cliente Responsable (Art. 15 bis). *(Los titulares con cuenta operan también directamente desde `/panel/perfil` y el equipo staff cuenta con acciones ejecutivas en `SolicitudDerechoARCOAdmin`.)*
3. **Acuse de recibo inmediato:** entregar código de seguimiento UUID, fecha de ingreso y fecha límite legal (`fecha_limite_30d`).

### Paso 2: Rol Responsable vs. Encargado (Art. 15 bis)
- **Si el dato es de un usuario de HD Prevención o contacto/lead (Responsable):** HD Prevención resuelve y responde directamente.
- **Si el dato pertenece a un trabajador, accidentado, denunciante Ley Karin o subcontratado de una empresa cliente (Encargado):** notificar al cliente **Responsable** dentro de **48 horas** para recibir su instrucción documentada y coordinar la verificación de identidad y respuesta dentro del plazo legal de 30 días corridos (o 2 días hábiles en bloqueo).

### Paso 3: Plazos legales estrictos (Art. 11 inc. 2° y 6°; Art. 10)
- **Plazo general (Acceso, Rectificación, Supresión, Oposición, Portabilidad):** **30 días corridos** desde el ingreso. Prorrogable **una sola vez hasta por 30 días corridos** adicionales cuando la complejidad o volumen lo justifique, notificando al titular antes del vencimiento original.
- **Plazo especial de Bloqueo Temporal (Art. 8 ter y Art. 11 inc. 6°):** **2 días hábiles** siguientes a la recepción de una solicitud fundada vinculada a rectificación, supresión u oposición. Mientras no se resuelva el requerimiento principal, **no se pueden tratar** los datos afectados (se mantienen solo almacenados bajo resguardo). Si el bloqueo se rechaza, debe fundarse y **comunicarse electrónicamente la decisión a la Agencia**.
- **Gratuidad (Art. 10 inc. 3° y 4°):**
  - Rectificación, supresión y oposición: **siempre gratuitos**.
  - Acceso y portabilidad: gratuitos **al menos una vez por trimestre** por titular (solo podrían cobrarse costos directos razonables si se solicita más de una vez en el mismo trimestre, conforme a instrucción de la Agencia).

### Paso 4: Ejecución técnica por tipo de derecho
- **Acceso (Art. 5):** ubicar todos los registros asociados en PostgreSQL (`Usuario`, `DocumentoUsuario`, `MensajeContacto`, `SolicitudCapacitacion`, `Trabajador`, `InvestigacionAccidente`, `RegistroCapacitacion`, `EntregaEPP`, `ReporteRiesgo`, `SugerenciaLaboral`, `MiembroCPHS`, `TrabajadorSubcontratado`) excluyendo secretos/hashes de contraseña y respetando reserva legal absoluta de terceros denunciantes/testigos en Ley Karin (Art. 211-B Código del Trabajo). Entregar copia comprensible más origen, finalidad, destinatarios y plazo de conservación.
- **Portabilidad (Art. 9):** verificar si concurre tratamiento automatizado basado en consentimiento (o entregar copia interoperable como buena práctica en acceso). Exportar en **JSON estructurado o CSV (`?formato=csv`, con saneamiento anti-inyección de fórmulas)** desde `/api/privacidad/portabilidad/` **únicamente previa autenticación**, empleando blind index `rut_hmac` e incluyendo todos los módulos (`ReporteRiesgo`, `Inspeccion`, `SugerenciaLaboral`, `RegistroConsentimiento`, resumen reservado Ley Karin).
- **Rectificación (Art. 6):** actualizar datos inexactos o desactualizados en transacción vía `/api/privacidad/rectificar/` o `/api/privacidad/ejecutar-solicitud/<uuid>/` (`arco.py` con mapa declarativo 100% de columnas rectificables) y comunicar el cambio a destinatarios cuando corresponda.
- **Supresión (Art. 7):** verificar deberes legales vigentes vía `/api/privacidad/suprimir/` (y cron `purgar_datos_vencidos --incluir-sst`):
  - *No se suprime* durante los **5 años legales** el expediente de accidente/DIAT (`InvestigacionAccidente`), denuncias Ley Karin (`DenunciaLeyKarin`), constancias de entrega EPP/RIOHS (`EntregaEPP`) ni capacitaciones legales (`RegistroCapacitacion`), ni documentos tributarios dentro del plazo del Código Tributario arts. 17 y 200 (**6 años**). La respuesta informa explícitamente las categorías retenidas con su causal legal.
  - *Sí se suprime o anonimiza irreversiblemente* en transacción atómica todo dato sin deber legal vigente o cuyo plazo ya venció (datos identificatorios opcionales QR, firmas de inspección, contactos, mensajes, cuentas sin bloqueo tributario, tokens y caché offline).
- **Oposición (Art. 8):** suspender de inmediato el tratamiento objetado mediante `/api/privacidad/oponer/`, revocando consentimientos opcionales en `RegistroConsentimiento` y suprimiendo datos identificatorios opcionales.
- **Bloqueo temporal (Art. 8 ter / Art. 11):** `SolicitudDerechoARCO.bloqueo_provisional_activo` (con cálculo automático de `fecha_limite_bloqueo_2d` a 2 días hábiles) detiene la purga automática en `purgar_datos_vencidos.py` y bloquea transversalmente mutaciones operativas en `/api/*` con HTTP `423 Locked` mediante `ARCOBloqueoProvisionalMiddleware` (`middleware.py`, auditado como `ARCO_BLOQUEO_IMPEDIMENTO`). Al rechazar un bloqueo vía `SolicitudDerechoARCOAdmin` o `/api/privacidad/ejecutar-solicitud/<uuid>/` (`accion='rechazar_bloqueo_apdp'`), se registra constancia formal de comunicación electrónica a la Agencia (`aviso_apdp_rechazo_bloqueo`, `fecha_aviso_apdp_bloqueo` y evento `ARCO_RECHAZO_BLOQUEO_APDP`).

### Paso 5: Respuesta por escrito y conservación de respaldo (Art. 11 inc. 3° y 4°)
- Responder **por escrito** al correo o domicilio indicado por el titular.
- **Guardar evidencia probatoria** de la remisión, fecha y contenido íntegro de la respuesta (Art. 11 inc. 3°).
- Si se **deniega total o parcialmente** (por ejemplo, por obligación de conservación legal de 5 años de Ley 16.744 / SUSESO), **fundar expresamente** indicando la norma exacta y los antecedentes que lo justifican, e informar al titular que dispone de **30 días hábiles** para reclamar ante la **Agencia de Protección de Datos Personales** (Art. 11 inc. 4° y Art. 41).

---
*Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado.*
