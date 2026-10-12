# HD Prevención — Auditoría de producto, cumplimiento y plan a producción

**Fecha:** 11-oct-2026 · **Base del análisis:** `MAPA_PROYECTO.md` (no se revisó código fuente; los hallazgos técnicos son hipótesis a validar contra el repositorio) · **Rol:** Ingeniero en Prevención de Riesgos Senior + revisión de producto SaaS.

> Nota: esto no reemplaza la revisión de un abogado laboral. Los textos legales, plantillas y flujos de Ley Karin deberían pasar por uno antes del lanzamiento.

---

## 0. Veredicto ejecutivo

HD Prevención tiene una base funcional sólida y un diferenciador real (participación QR sin login). Lo que lo separa de producción **no es falta de features**, sino cuatro cosas:

1. **Bloqueantes técnicos de producción:** archivos en disco efímero, sin cobros, endpoints públicos enumerables, JWT largo en `localStorage`, Django 4.2 fuera de soporte.
2. **Modelo de datos sin `Empresa` / `Centro de trabajo` / `Trabajador`.** Todo cuelga del usuario prevencionista. Un prevencionista real atiende varias empresas y necesita historial por trabajador. Esto condiciona también el paso a empresas.
3. **Errores y ambigüedades normativas en el propio mapa** (DS 40 como vigente, anonimato en Ley Karin, buzón mezclando sugerencias con denuncias) que en una fiscalización o disputa dañan la credibilidad del producto.
4. **Monetización débil:** la única variable de valor es "descargas semanales"; Profesional y Expert casi no se diferencian.

**Recomendación:** beta cerrada de pago con 20–30 prevencionistas independientes en 6–8 semanas, cerrando todo el bloque P0 y los ítems P1 marcados ★. Empresas (Etapa 2) después, cuando existan `Empresa`/`Trabajador`, CPHS y auditoría.

---

## 1. Opinión sobre la estructura

### Lo que está bien
- Stack moderno y coherente (Next.js 16 + Django/DRF + Postgres), con despliegue declarativo.
- Separación clara de rutas: público / auth / panel por rol / canales móviles sin login.
- **Participación QR sin login** (firma, reporte, buzón): es el mejor activo de producto. En terreno nadie descarga apps.
- Cobertura funcional amplia para un MVP: riesgos, inspecciones, accidentes (Bird + 5 porqués), charlas, contratistas, buzón.
- Freemium con marca de agua: buen mecanismo de adquisición.

### Lo que me preocupa
| Tema | Por qué importa |
|---|---|
| **Django 4.2 LTS** | Su soporte extendido terminó en abril de 2026. Hoy no recibe parches de seguridad. Subir a 5.2 LTS. |
| **IDs secuenciales en endpoints públicos** (`<pk>`, `<prevencionista_pk>`) | Enumerables, spameables y con riesgo de fuga de datos (`detalles-publicos`). Deben ser UUID o tokens firmados de corta vida. |
| **JWT de 24 h en `localStorage`** | Riesgo XSS. Access de 15 min + refresh rotatorio en cookie `HttpOnly`. |
| **Sin `Empresa`/`Trabajador`** | No hay historial por trabajador, ni matriz ODI/capacitación por cargo, ni multi-cliente real. Es la deuda de modelo más cara. |
| **`reportes-riesgo/page.tsx` de +1.800 líneas** | Componente monolítico: difícil de testear y mantener. Dividir en componentes y hooks. |
| **Motor DOCX con `zipfile` + XML a mano** | Frágil ante plantillas distintas. Necesita tests con plantillas reales o migrar a `docxtpl`. |
| **PDF vía `@media print`** | Aceptable para MVP, pero un expediente legal necesita render servidor (WeasyPrint/Playwright), hash y QR de verificación. |
| **Polling cada 4 s** | Sirve al inicio. Con muchas sesiones simultáneas, mover a SSE o subir el intervalo con backoff. |
| **Sin offline** | Faenas mineras/forestales/construcción suelen no tener señal. |
| **No se menciona** | Tests, CI/CD, Sentry, backups, audit log, colas asíncronas, email. |
| **Paneles `consultora` y `superadmin` con datos simulados** | Un cliente que paga por "gestión de clientes" y ve datos falsos pierde confianza al instante. |

---

## 2. Hallazgos normativos (marco chileno)

| # | Hallazgo | Riesgo | Acción |
|---|---|---|---|
| N1 | El mapa cita **"DS 40 / DS 44"** como vigentes. El **DS 44 está vigente desde el 1-feb-2025 y deroga el DS 40 y el DS 54** (ambos de 1969). | Documentos y textos con base legal derogada. | Barrido de landing, plantillas, checklists y textos de ayuda: citar DS 44. Confirmar el artículo exacto de la **Obligación de Informar (ODI)** en el texto oficial antes de citarlo en documentos. |
| N2 | **Ley Karin con "opción de anonimato"**. Mi lectura del art. 211-B del Código del Trabajo es que la denuncia formal exige identificación del denunciante; **no pude confirmarlo en las fuentes consultadas**. | Prometer un procedimiento que la ley no reconoce como denuncia formal. | Validar con abogado laboral. Diseño sugerido: el canal anónimo se rotula como **"aviso/consulta"** que gatilla evaluación del empleador, y la **denuncia formal** exige identificación. |
| N3 | **Buzón único** para sugerencias y denuncias. | Mezclar flujos con plazos y confidencialidad distintos. | Separar en dos flujos. Ley Karin con **receptor designado por la empresa** (no cualquier prevencionista), registro de acceso (audit log), plazos parametrizables (el empleador debe remitir a la DT en **3 días** cuando corresponde y comunicar medidas de resguardo; verificar si son hábiles), plantilla de medidas de resguardo y derivación. |
| N4 | **Accidentes sin DIAT/DIEP.** | Falta el trámite central de la Ley 16.744 ante el organismo administrador. | Campos y checklist DIAT/DIEP, alerta de plazo (24 h), flujo de **accidente grave/fatal** (suspensión inmediata de faenas y aviso a Seremi de Salud / Inspección del Trabajo), y **registro de incidentes y sucesos peligrosos** (tema explícito del DS 44). |
| N5 | **Sin estadísticas legales.** | Un prevencionista las reporta todos los meses. | Tasa de frecuencia, gravedad, accidentabilidad y siniestralidad, días perdidos. Exportable. |
| N6 | **No hay módulo de Comité Paritario (CPHS).** El DS 44 reemplaza al DS 54. | Es la mayor omisión funcional para el prevencionista promedio. | Constitución, elecciones, actas, calendario de sesiones, investigación de accidentes por el CPHS, vencimiento de mandatos. Validar umbrales (25 trabajadores CPHS; Depto. de Prevención) en el texto del DS 44. |
| N7 | **DS 44 trae obligaciones nuevas** que el mapa solo cubre en parte: matriz IPER, Programa de Trabajo Preventivo, delegado SST, mapas de riesgo, gestión de emergencias, capacitaciones. | Producto "alineado" pero incompleto. | Módulos de Programa de Trabajo anual, delegado SST y mapas de riesgo. |
| N8 | **DS 76 cubierto solo como "documentos de contratistas".** | El mandante tiene obligaciones de gestión, no solo de papeles. | Agregar Reglamento Especial para empresas contratistas, programa de trabajo, reuniones de coordinación y alertas de vencimiento F30-1. Validar umbrales de CPHS/Depto. de faena. |
| N9 | **Protocolos MINSAL:** solo TMERT aparece como plantilla. | PREXOR, PLANESI, UV y **riesgos psicosociales (CEAL-SM / SUSESO-ISTAS 21)** son recurrentes y vendibles. | Roadmap P2: asistentes guiados y calendario de re-evaluación. |
| N10 | **Firma en canvas = firma electrónica simple** (Ley 19.799). Válida, pero de bajo peso probatorio. | Cuestionable en fiscalización. | Ver NOR-04: hash SHA-256, timestamp de servidor, IP, user-agent, RUT validado, ventana horaria. No venderla como "firma avanzada". |
| N11 | **Ley 21.719 de datos personales entra en vigencia el 1-dic-2026** (en ~7 semanas). El producto trata datos de salud (accidentes), denuncias y posiblemente biometría. | Bloqueante comercial, sobre todo para empresas. | Política de privacidad, contrato de encargado de tratamiento (DPA), derechos del titular, notificación de brechas, retención y borrado. Está fuera del marco estricto que pediste, pero es bloqueante de lanzamiento. |

---

## 3. Qué sacaría o pospondría

- **Blog de noticias (`/noticias` + admin):** dejar mínimo o llevarlo a una herramienta externa. Prioridad baja hasta tener tráfico. Mejor invertir en páginas SEO por intención ("plantilla matriz IPER DS 44").
- **Paneles `consultora` y `superadmin` con métricas estáticas:** ocultarlos hasta que muestren datos reales.
- **Editor libre de DOCX/XLSX en la nube:** congelar. Es caro de mantener y fácil de romper. Reemplazarlo por **plantillas guiadas por formulario** que se autocompletan con los datos de la empresa y generan DOCX/PDF.
- **"Descargas semanales" como métrica principal de planes:** reemplazar (ver sección 6).
- **Catálogo de asesorías dentro del SaaS:** mantenerlo como generador de leads (formulario), sin desarrollar más funcionalidad.
- **Referencias a DS 40 y DS 54** en cualquier texto.

---

## 4. Qué agregaría (ordenado por valor para el prevencionista promedio)

1. **`Empresa` / `Centro de trabajo` / `Trabajador`** como entidades base (RUT validado, cargo, fecha de ingreso).
2. **CPHS** completo.
3. **DIAT/DIEP, estadísticas legales y flujo de accidente grave/fatal.**
4. **Registro de entrega de EPP y de RIOHS**, con firma (es lo que más se pide en fiscalización y hoy se hace en papel).
5. **Matriz IPER nativa** (no solo Excel) enlazada a hallazgos, inspecciones y acciones.
6. **Programa de trabajo anual con calendario y alertas** (vencimientos de F30-1, mandatos CPHS, capacitaciones).
7. **Modo quiosco** (los trabajadores firman en el dispositivo del relator) y **PWA con cola offline**. En la práctica muchos trabajadores no tienen datos ni quieren escanear un QR.
8. **Matriz de capacitación por cargo** y **certificados con QR de verificación**.
9. **Auditoría de cumplimiento DS 44** con puntaje (cuestionario guiado + brechas + plan). Es el mejor gancho comercial para empresas.
10. **Email transaccional y notificaciones** (denuncias, accidentes, vencimientos).
11. **Asistente de IA con revisión humana**: borradores de investigación de accidentes, sugerencias de medidas de control en IPER, resumen de brechas. Diferenciador, no prioridad.
12. **Onboarding guiado** ("tu primera empresa → tu primera charla firmada en 10 minutos").

---

## 5. Backlog a producción

**Esfuerzo:** S = menos de 2 días · M = 2–5 días · L = 1–3 semanas · ★ = imprescindible para la beta.

### P0 — Bloqueantes (semanas 1–3)

| ID | Tarea | Criterio de aceptación | Esf. |
|---|---|---|---|
| SEC-01 ★ | Migrar a Django 5.2 LTS y actualizar dependencias | Suite verde; sin warnings de deprecación críticos | M |
| SEC-02 ★ | JWT: access 15 min, refresh rotatorio con blacklist, cookies `HttpOnly`+`Secure`+`SameSite`, manejo de CSRF | Sin tokens en `localStorage`; logout invalida refresh | M |
| SEC-03 ★ | Endpoints públicos: UUID o token firmado de vida corta en lugar de `pk`; throttling por IP y por token; captcha (Turnstile) o honeypot; límites de tamaño | No se puede enumerar sesiones ni prevencionistas; spam limitado | M |
| SEC-04 ★ | Autorización multi-tenant: permisos por objeto y tests de IDOR en cada endpoint | Un usuario nunca lee ni modifica datos de otro tenant (tests automáticos) | M |
| SEC-05 ★ | Hardening de producción: `DEBUG=False`, HSTS, CSP, `SECURE_*`, `ALLOWED_HOSTS`, URL de admin no estándar y 2FA en admin | Escaneo básico (Mozilla Observatory / `check --deploy`) sin críticos | S |
| SEC-06 ★ | Subida de archivos: validar MIME y tamaño, reprocesar imágenes con Pillow, antivirus opcional (ClamAV) para PDFs de contratistas | Archivos inválidos rechazados | M |
| INF-01 ★ | Mover media a R2/S3/Supabase Storage con buckets privados y URLs firmadas | Nada se pierde al reiniciar; archivos no accesibles públicamente | M |
| INF-02 ★ | Instancia de pago en Render (sin cold start), backups diarios con restauración probada | Restauración documentada y ejecutada al menos una vez | S |
| INF-03 ★ | Sentry (front y back), logs estructurados, monitor de uptime y status page | Errores llegan con contexto de usuario/tenant | S |
| INF-04 ★ | CI/CD (GitHub Actions): lint, tests, build, migraciones; entornos staging y prod | Merge a main despliega a staging; prod por aprobación | M |
| INF-05 ★ | Email transaccional (Resend/SES) con SPF/DKIM/DMARC: verificación de correo, reset de contraseña, alertas | Correos llegan a bandeja principal en Gmail/Outlook | M |
| QA-01 ★ | Tests: pytest (permisos, cuotas, motor DOCX/XLSX) + Playwright del flujo crítico (registro → charla → QR → firma → cierre) | Flujo crítico verde en CI | L |
| PAY-01 ★ | Cobro recurrente en CLP (Flow o Webpay Oneclick) con webhooks idempotentes | Alta, renovación y fallo de pago actualizan el estado sin intervención manual | L |
| PAY-02 ★ | Ciclo de vida de suscripción: prueba de 14 días, upgrade/downgrade, gracia, cancelación y recordatorios de cobro fallido | Estados `ACTIVA/VENCIDA/CANCELADA` coherentes con la pasarela | M |
| PAY-03 | Boleta/factura electrónica SII vía proveedor DTE | Documento tributario emitido por cada cobro | M |
| LEG-01 ★ | Términos y condiciones, política de privacidad, cookies; aceptación versionada en el registro | Registro de qué versión aceptó cada usuario y cuándo | M |
| LEG-02 ★ | Brecha frente a Ley 21.719 antes del 1-dic-2026: base de licitud, derechos del titular, brechas, retención, borrado | Documento de cumplimiento y funciones de exportar/borrar | M |

### P1 — Producto mínimo vendible (semanas 3–8)

| ID | Tarea | Criterio de aceptación | Esf. |
|---|---|---|---|
| DAT-01 ★ | Entidades `Empresa`, `CentroTrabajo`, `Trabajador` y vinculación de riesgos, inspecciones, accidentes, charlas y EPP | Cada registro pertenece a una empresa; historial por trabajador | L |
| DAT-02 ★ | Tenant = cuenta (prevencionista o consultora); *managers* con filtro por tenant | Tests de aislamiento verdes | L |
| DAT-03 ★ | Audit log inmutable (quién, qué, cuándo, IP) para denuncias, accidentes, firmas y descargas | Cada acceso a una denuncia queda registrado | M |
| DAT-04 | Eliminación lógica, política de retención y exportación de datos del cliente | Exportación completa en formato abierto | M |
| NOR-01 ★ | Barrido de textos: DS 40/54 → DS 44 en landing, plantillas, checklists | Cero referencias a normas derogadas | S |
| NOR-02 ★ | Ley Karin: separar sugerencias de denuncias, receptor designado, plazos parametrizables, medidas de resguardo, derivación a DT, reglas de anonimato validadas con abogado | Flujo revisado por abogado laboral | L |
| NOR-03 ★ | Accidentes: DIAT/DIEP, alerta de 24 h, checklist grave/fatal, índices estadísticos | Reporte mensual exportable | L |
| NOR-04 ★ | Firma robusta: SHA-256, timestamp servidor, IP, user-agent, RUT módulo 11, QR rotatorio con ventana horaria, anti-duplicado | Sello visible en el PDF de asistencia | M |
| NOR-05 | Expediente PDF en servidor con hash y QR de verificación | Verificable públicamente sin login | M |
| NOR-06 | DS 76: Reglamento Especial, programa de trabajo, reuniones de coordinación, alertas de vencimiento por email | Alerta 30 días antes del vencimiento | M |
| FEA-01 ★ | Módulo CPHS (constitución, elecciones, actas, calendario, vencimientos) | Acta imprimible y firmada | L |
| FEA-02 ★ | Entrega de EPP y de RIOHS con firma | Comprobante por trabajador | M |
| FEA-03 ★ | Programa de trabajo anual con calendario y alertas | Vencimientos visibles en el dashboard | M |
| FEA-04 | Modo quiosco + PWA con cola offline | Firmar e inspeccionar sin señal y sincronizar al volver | L |
| FEA-05 | Plantillas guiadas por formulario (reemplazan el editor libre) | Documento generado con datos de la empresa precargados | L |
| FEA-06 ★ | Conectar paneles consultora/superadmin a datos reales (o esconderlos) | Cero métricas estáticas | M |
| FEA-07 ★ | Onboarding guiado de 5–10 minutos | 70 % de los registros crea su primera empresa | M |
| GRO-01 | Analítica de producto (PostHog) y evento de activación | Se mide "primera charla firmada en 7 días" | S |
| GRO-02 | Landing con prueba social y páginas SEO por normativa | 10 páginas indexadas | M |
| GRO-03 | Centro de ayuda, soporte por WhatsApp/chat | Tiempo de primera respuesta definido | S |
| GRO-04 ★ | Programa beta con 20–30 prevencionistas, entrevistas y testimonios | 10 entrevistas completadas | S |

### P2 — Post-lanzamiento y paso a empresas (meses 3–9)

- Riesgo psicosocial (CEAL-SM / SUSESO-ISTAS 21), PREXOR, PLANESI, UV y TMERT guiados, con calendario de re-evaluación.
- Vigilancia de salud y exámenes ocupacionales (con tratamiento reforzado de datos sensibles).
- Auditoría DS 44 con puntaje y plan de cierre de brechas.
- SSO (Google/Microsoft), roles granulares, API pública y webhooks.
- Firma electrónica avanzada vía proveedor, para clientes que la exijan.
- Notificaciones por WhatsApp, calendario (Google/Outlook), exportes a BI.
- Asistente de IA con revisión humana.
- Marketplace de plantillas con reparto de ingresos.
- Roadmap de seguridad de la información para cuentas grandes (cuestionarios de proveedores, SLA, evaluación ISO 27001).

### Checklist de salida a producción

1. Todo P0 con ★ cerrado.
2. Backups con restauración probada.
3. Rate limiting activo en endpoints públicos.
4. Tests de aislamiento multi-tenant en CI.
5. Cobro real probado con tarjeta propia (alta, renovación, rechazo, cancelación).
6. Correos con SPF/DKIM/DMARC.
7. Términos, privacidad y aceptación versionada publicados.
8. Cero referencias a DS 40/54.
9. Flujo de Ley Karin revisado por abogado.
10. Sentry y alertas de uptime activos.
11. Paneles sin datos simulados.
12. Plan de soporte y canal de reporte de errores definidos.

---

## 6. Monetización

### Diagnóstico del esquema actual
- El **"límite semanal de descargas"** mide algo que el usuario percibe poco y que no escala con el valor recibido.
- **Profesional ($14.900) y Expert ($34.900)** se distinguen solo por 20 vs 50 descargas y "prioridad" en asesorías: difícil justificar más del doble de precio.
- Lo que sí está bien pensado: un plan gratuito con marca de agua para adquirir usuarios y un plan de consultora con marca blanca y multi-asiento.

### Métricas de valor sugeridas
**Empresas atendidas** (para consultores), **firmas de asistencia al mes**, **almacenamiento** y **módulos habilitados**. Estas crecen con el negocio del cliente y justifican el upgrade.

### Propuesta de planes para prevencionistas (precios en CLP, netos + IVA)

| | **Gratis** | **Profesional** $14.900 | **Expert** $34.900 | **Consultora** $79.900 |
|---|---|---|---|---|
| Empresas activas | 1 | 3 | 10 | 30 (ampliable) |
| Usuarios | 1 | 1 | 1 | 5 (+$9.900 c/u) |
| Firmas de asistencia / mes | 30 | 300 | 1.500 | Uso justo |
| Descargas de documentos | 5/mes con marca de agua | 40/mes | 120/mes | Ilimitadas |
| Módulos | Riesgos, inspecciones, charlas | + Accidentes, buzón, EPP | + CPHS, contratistas, alertas, auditoría DS 44 | + Marca blanca, portal para clientes, reportes consolidados |
| Almacenamiento | 200 MB | 5 GB | 20 GB | 100 GB |
| Soporte | Centro de ayuda | Email | Prioritario | Onboarding + WhatsApp |

**Ajustes comerciales**
- **Prueba de 14 días de Profesional, sin tarjeta.** En Chile la fricción de pagar es alta; el valor debe verse antes.
- **Plan anual** con 2 meses gratis (se paga 10).
- **Complementos:** empresa extra ($3.900/mes), usuario extra ($9.900/mes), pack de firmas, almacenamiento adicional.
- **Programa de referidos** (un mes gratis por referido que pague) y alianza con comunidades de prevencionistas.
- **Escenario ilustrativo** (no es proyección): 150 Profesional + 40 Expert + 10 Consultora ≈ **$4,43 M CLP/mes** netos (150×14.900 + 40×34.900 + 10×79.900). Es una hipótesis para fijar metas, no una predicción.

### Etapa 2 — Planes para empresas (tomar cuentas directas)

Una idea: bandas por **número de trabajadores**, alineadas con los umbrales legales (delegado SST / CPHS / Departamento de Prevención; validar umbrales en el DS 44), porque el cliente ya piensa así.

| Plan | Para quién | Precio referencial / mes (hipótesis) | Incluye |
|---|---|---|---|
| **Empresa Starter** | Hasta 50 trabajadores, 1 centro | $59.900 | Core + CPHS/delegado, EPP, charlas, buzón Ley Karin |
| **Empresa Business** | Hasta 250 trabajadores, hasta 5 centros | $149.900 | + Contratistas DS 76, auditoría DS 44, alertas, roles |
| **Empresa Corporate** | Sobre 250 o multi-razón social | Desde $390.000 | + SSO, SLA, DPA a medida, API, soporte dedicado |

**Condiciones para venderlo:** modelo `Empresa`/`Trabajador` terminado, Ley 21.719 resuelta, audit log, roles granulares, respaldo y SLA definidos.
**Validación:** hacer 10 entrevistas con jefes de prevención/RRHH antes de fijar precios finales.

### Servicios de una sola vez (como entrada a empresas)
Rangos referenciales a calibrar con tus costos:
- Implementación DS 44 (diagnóstico + matriz IPER + programa de trabajo): $390.000–$990.000 según tamaño.
- Auditoría de pre-fiscalización: $250.000–$600.000.
- Onboarding de consultoras (migración de documentos y capacitación): $150.000–$300.000.

---

## 7. Capacitaciones: cómo cotizar

### Cuatro advertencias antes de poner precios
1. **SENCE/OTEC:** para que la empresa use franquicia tributaria, el que dicta debe ser un OTEC registrado. Si no lo eres, vende como capacitación "sin SENCE" o asóciate a un OTEC.
2. **Competencia gratuita:** las mutualidades (ACHS, Mutual, IST, ISL) ofrecen cursos a sus adherentes. Tu ventaja es lo **a medida, presencial en faena, con registro digital QR y certificado verificable**.
3. **Costo real:** el precio debe salir de tu costo, no del mercado.
4. **Los precios de abajo son hipótesis mías, sin fuente de mercado.** Calíbralos.

### Fórmula

```
Precio = (horas relator × tarifa hora + horas de preparación + traslado + materiales + certificados) ÷ (1 − margen objetivo) + IVA
Margen objetivo sugerido: 40–55 %
```

### Rangos referenciales (CLP netos por sesión, grupo de hasta 20–25 personas)

| Servicio | Rango referencial |
|---|---|
| Charla ODI / inducción (1–2 h) | $90.000–$180.000 |
| Curso de 4 h (extintores teórico-práctico, orden y aseo, etc.) | $250.000–$450.000 |
| Curso de 8 h (ergonomía/TMERT u otros) | $400.000–$750.000 |
| Primeros auxilios / RCP (8 h) | $450.000–$850.000 |
| Ley Karin / psicosocial para jefaturas (2 h) | $250.000–$450.000 |
| E-learning por participante | $9.900–$24.900 |
| Plan anual de capacitación (12 sesiones) | 10–15 % de descuento sobre lista |

**Cargos adicionales:** traslado fuera de la RM, materiales o equipos, mínimo de participantes, política de cancelación.

### Cómo integrarlo al producto
- Cotizador automático con la fórmula de arriba y pipeline simple (cotizada → aceptada → programada → realizada → facturada).
- Cada sesión realizada **se registra en el historial del `Trabajador`** y emite certificado con QR. Es un circuito que obliga a la empresa a quedarse en la plataforma.

---

## 8. Hitos y métricas

| Periodo | Hito |
|---|---|
| Semanas 1–3 | P0 cerrado; Django 5.2; pagos en sandbox; borrador legal |
| Semanas 3–8 | `Empresa`/`Trabajador`, Ley Karin y accidentes corregidos, CPHS, EPP; beta cerrada de pago |
| Semanas 8–12 | Ajustes por feedback; lanzamiento público; SEO |
| Meses 3–9 | Auditoría DS 44, psicosocial, offline/PWA; planes de empresa y primeras cuentas piloto |

**KPIs:** activación (primera charla firmada en 7 días), conversión Gratis→Pago (meta inicial 3–5 %), churn mensual, MRR, tiempo hasta el primer valor, NPS de prevencionistas.

---

## 9. Qué no pude verificar y supuestos

- **No leí código.** Todo lo técnico es inferencia a partir del mapa.
- **Umbrales del DS 44** (CPHS, Depto. de Prevención, delegado SST) y **artículo exacto de la ODI**: no quedaron confirmados en la fuente consultada. Validar en el texto oficial.
- **Anonimato en Ley Karin:** no confirmado. Validar con abogado.
- **Precios:** hipótesis; faltan entrevistas y costos reales.
- **Esto no es asesoría legal.** Textos legales y plantillas requieren revisión profesional.

---

## Fuentes

- [IST — DS N° 44, nuevo reglamento sobre gestión preventiva de los riesgos laborales](https://ist.cl/d-s-n-44-nuevo-reglamento-sobre-gestion-preventiva-de-los-riesgos-laborales/) (vigencia 1-feb-2025; deroga DS 40 y DS 54)
- [ChileAtiende — Denuncia por Ley Karin](https://chileatiende.gob.cl/fichas/140078/1/pdf) (remisión a la DT en 3 días y medidas de resguardo)
- [Diario Constitucional — Ley 21.719 entra en vigor el 1 de diciembre](https://www.diarioconstitucional.cl/2026/06/12/la-ley-21-719-entra-en-vigor-el-1-de-diciembre-y-expone-vacios-en-regulacion-de-pequenas-empresas/)
