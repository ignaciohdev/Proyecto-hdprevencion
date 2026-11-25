# Resumen Ejecutivo de Cumplimiento — Ley N° 21.719 (HD Prevención)

**Fecha de evaluación:** 2026-11-25 (`2026-11-25T03:57:09Z`) · **Commit auditado:** `f5278d2`  
**Marco evaluado:** `ley-21719` (Protección de Datos Personales, vigencia general **1-dic-2026**)  
**Entidad:** [COMPLETAR: Razón Social definitiva en trámite con abogada] · **Tamaño:** Microempresa (Ley N° 20.416)  
**Etapa:** Demostración / Pre-producción (capa gratuita Render + Vercel, previo a migración a planes de pago)

> **Estado de corrida:** Primera línea base (`baseline`) generada con `compliance-cl`. No existe corrida previa de `.compliance/state.json` contra la cual calcular *drift*; las siguientes ejecuciones compararán control a control contra este snapshot.  
> **Nota importante frente al script interno `auditar_ley21719.py`:** El repositorio contiene una suite interna (`backend/modulo_prevencion/management/commands/auditar_ley21719.py`) enfocada en 7 pruebas técnicas puntuales. Esa suite incluso valida como positivo que `/api/privacidad/portabilidad/?rut=...` devuelva HTTP 200 sin autenticación y no evalúa gobernanza (RAT, DPA, EIPD, transferencias), consentimiento, MFA, retención/purga ni respaldos. La postura real de cumplimiento frente a los 25 controles del pack `ley-21719` es la reportada aquí.

---

## 1. Postura Actual — `ley-21719`: **40% (`0.40`)**

- **Controles requeridos evaluados:** `25`
- **Cumple (`pass` ✅):** `1` (`sec-secrets`)
- **Cumple parcialmente (`partial` ⚠️):** `18`
- **No cumple (`fail` ❌):** `6` (`data-consent-text`, `data-derechos`, `data-transfer`, `sec-mfa`, `sec-backups`, `sec-monitoring`)
- **Fórmula:** `(1 + 0.5 × 18) / 25 = 10 / 25 = 0.40 (40%)`

---

## 2. Decisiones Legales Resueltas (con citas al corpus `sources/`)

| Decisión | Resolución | Fundamento normativo verificado |
|---|---|---|
| **DPO / Encargado de Privacidad** | **No obligatorio** contratar un DPO externo. Al ser **Microempresa (Ley 20.416)**, uno de los co-fundadores asume personalmente las tareas de Responsable / Delegado. | **Art. 50 inc. 3° Ley 21.719** (`sources/ley-21719-texto.txt` L2322–2323): *"En las micro, pequeñas y medianas empresas, el dueño o sus máximas autoridades podrán asumir personalmente las tareas de delegado de protección de datos."* |
| **Evaluación de Impacto (EIPD)** | **OBLIGATORIA** antes de iniciar operación en producción real. | **Art. 15 ter inc. 1° y letra d) Ley 21.719** (`sources/ley-21719-texto.txt` L818–833): tratamiento de **datos sensibles de salud laboral** y **denuncias Ley Karin** bajo hipótesis de excepción del consentimiento (Arts. 16 e/f y 16 bis), en arquitectura multi-tenant con datos fuera de Chile. Documento generado en `.compliance/docs/21719-eipd.md`. |
| **Roles por flujo (Responsable vs. Encargado)** | **Responsable** respecto de usuarios/prevencionistas (`Usuario`, `Suscripcion`), leads (`MensajeContacto`, `SolicitudCapacitacion`) y solicitantes ARCO. **Encargado (Art. 15 bis)** respecto de trabajadores, capacitaciones, EPP, accidentes y denuncias Ley Karin de las empresas clientes. | **Art. 2 x) y Art. 15 bis Ley 21.719** (`sources/ley-21719-texto.txt` L186, L784–816). Exige DPA suscrito/aceptado por cada cliente antes de producción. |
| **Transferencias internacionales** | **Aplica a EE.UU.** (Render para backend/PostgreSQL; Vercel para frontend). **Open-Meteo NO transfiere PII** (solo coordenadas). Sin APIs externas de correo ni IA activas en runtime. Mecanismo válido: **Cláusulas Contractuales Modelo** + DPAs. | **Arts. 27 letra b), 28 y 14 ter letra h) Ley 21.719** (`sources/ley-21719-texto.txt` L655–657, L1286–1378) y **Resolución Exenta RAEX202503748** del Min. Economía (`sources/clausulas-modelo-transferencia-economia.txt`). |
| **Régimen MIPYME y Gracia** | Ventana de **12 meses de amonestación escrita** (1-dic-2026 a 1-dic-2027) y exclusión de multas porcentuales (2%/4% ingresos) en reincidencia por ser empresa de menor tamaño (aplica tope UTM / hasta 3x en reincidencia). | **Art. sexto transitorio** (`L2529–2532`) y **Art. 35 inc. 3° y 4°** (`L1870–1878`, `sources/ley-21719-texto.txt`). *Nota:* la gracia MIPYME no exime de responsabilidad civil ni de medidas de corrección en 60 días. |

---

## 3. Estado de los 25 Controles Evaluados

| ID | Control | Estado | Evidencia clave en el repo | Brecha / Remediación principal |
|---|---|---|---|---|
| `gov-responsable` | Responsable designado | ⚠️ `partial` | `privacidad/page.tsx:36-41` | Formalizar escritura (`[COMPLETAR]`), correo privacidad y publicar datos reales. |
| `gov-registro` | Inventario RAT | ⚠️ `partial` | `.compliance/docs/21719-rat.md` | Completar placeholders tras constitución y validar post-migración a pago. |
| `gov-politicas` | Política de privacidad | ⚠️ `partial` | `privacidad/page.tsx:1-159` | Publicar texto completo Art. 14 ter de `.compliance/docs/21719-politica-privacidad.md`. |
| `gov-denuncias` | Canal contacto/denuncias | ⚠️ `partial` | `derechos-arco/page.tsx`, `views.py:215-225` | `ContactoPermission` exige auth en `POST`; habilitar casilla oficial operativa. |
| `data-rights-channel` | Canal formal de derechos | ⚠️ `partial` | `derechos-arco/page.tsx`, `views.py:3418-3444` | Falta panel de gestión interna, `admin.py`, UI consulta UUID y enlace en footer. |
| `data-licitud` | Bases de licitud | ⚠️ `partial` | `models.py`, formularios públicos | Diferenciar obligación legal SST vs contrato vs consentimiento; firmar DPA clientes. |
| `data-consent-text` | Consentimiento opt-in + prueba | ❌ `fail` | `(auth)/registro/page.tsx`, `(public)/capacitaciones/page.tsx` | Sin checkboxes no premarcados ni tabla `RegistroConsentimiento` ni revocación. |
| `data-derechos` | Derechos ARCO + portabilidad + bloqueo | ❌ `fail` | `views.py:3446-3498` (`PortabilidadDatosView`) | **CRÍTICO:** `PortabilidadDatosView` es `AllowAny` por `?rut=`. Faltan flujos de borrado/anonimización, acceso completo, rectificación y bloqueo transversal real. |
| `data-info` | Deber de información en captura | ⚠️ `partial` | `buzon/page.tsx:545`, `reportar/page.tsx:186`, `firmar/[uid]/page.tsx:360` | Faltan avisos en registro, cotización capacitaciones, contacto y entrega EPP. |
| `data-minimizacion` | Minimización y retención | ⚠️ `partial` | `views.py:422,948,2080,2166,2195,2747` | Bloquea `DELETE` prematuro, pero no verifica vencimiento ni purga/anonimiza tras 5 años / 12 meses. |
| `data-dpa` | DPA Encargado (Art. 15 bis) | ⚠️ `partial` | `.compliance/docs/21719-dpa.md` | Integrar firma/aceptación DPA en onboarding B2B y DPAs con Render/Vercel. |
| `data-transfer` | Transferencias internacionales | ❌ `fail` | `render.yaml`, `vercel.json`, `privacidad/page.tsx:102` | Faltan Cláusulas Modelo RAEX202503748 / DPAs suscritos y declaración en `/privacidad`. |
| `data-eipd` | EIPD (Art. 15 ter) | ⚠️ `partial` | `.compliance/docs/21719-eipd.md` | EIPD obligatoria redactada; cerrar mitigaciones técnicas antes de producción. |
| `data-privacy-by-design` | Privacidad desde el diseño | ⚠️ `partial` | `sw.js:74-84`, `api.ts:83,186`, `serializers.py:589` | `sw.js` usa rutas desactualizadas (no excluye `/api/entregas-epp`, `/api/denuncias-ley-karin`, `/api/registro-capacitacion`); JWT en `localStorage`. |
| `data-pseudonym` | Seudonimización / blind index | ⚠️ `partial` | `models.py:82,1834` | Usa UUIDs y `codigo_seguimiento`; falta blind index HMAC para RUTs cifrados. |
| `sec-tls` | Cifrado en tránsito y headers | ⚠️ `partial` | `next.config.ts:15`, `settings.py:189-192,261` | Falta `SECURE_SSL_REDIRECT`/HSTS en Django; `CORS` tiene wildcard `*.vercel.app`. |
| `sec-rest` | Cifrado en reposo | ⚠️ `partial` | `crypto.py:14-70`, `models.py:1050,1720` | Sin `FIELD_ENCRYPTION_KEY` separada (deriva de `SECRET_KEY`); RUTs, nombres, lesiones, causas, firmas y `FileField` en claro. |
| `sec-passwords` | Hashing y política de claves | ⚠️ `partial` | `settings.py:160`, `serializers.py:97`, `views.py:811` | `RegisterSerializer` y `perfil` no llaman `validate_password()`; cambio de clave sin clave actual. |
| `sec-mfa` | MFA en accesos privilegiados | ❌ `fail` | Sin TOTP/2FA en repo | Implementar TOTP + recovery codes para admins/staff/corporativos; corregir links `/admin/` en UI. |
| `sec-logs` | Logs de acceso y auditoría | ⚠️ `partial` | `AuditLogAccesoDenuncia` (`models.py:1869`, `views.py:2225`) | Solo audita `DenunciaLeyKarin`; faltan logs transversales de `InvestigacionAccidente`, `Trabajador`, ARCO y auth. |
| `sec-tenant` | Segregación multi-tenant | ⚠️ `partial` | `views.py:1876,2070,2133,2205` | Fuga por `PortabilidadDatosView`; `dashboard` contratistas sin grupo; `perform_update` sin revalidar FKs; `activo=True` inválido en `InvestigacionAccidenteViewSet.estadisticas`. |
| `sec-secrets` | Secretos fuera del código | ✅ `pass` | `.gitignore:11-13`, `settings.py:26-31`, `render.yaml:14` | Sin secretos en git. Mantener y separar `FIELD_ENCRYPTION_KEY`. |
| `sec-backups` | Backups, storage y retención | ❌ `fail` | `render.yaml:5` (`free`), `settings.py:204` (`FileSystemStorage`) | BD gratuita sin backups/PITR y disco efímero para adjuntos sensibles; bloqueante para producción. |
| `inc-brechas` | Gestión y registro de brechas | ⚠️ `partial` | `RegistroBrechaSeguridad` (`models.py:3388`), `.compliance/docs/21719-plan-respuesta-brechas.md` | Modelo huérfano (no está en `admin.py`/UI); protocolo anterior citaba 72h GDPR. |
| `sec-monitoring` | Monitoreo y alertas | ❌ `fail` | Sin `.github/workflows/`, sin alertas ni HIBP | Montar secret scanning (Gitleaks), alertas de eventos de seguridad y chequeo HIBP. |

---

## 4. Brechas Priorizadas (Plan de Acción Técnico e Infraestructura)

### P0 — Bloqueantes críticos antes de tratar datos reales
1. **Cerrar fuga de datos en `PortabilidadDatosView` (`backend/modulo_prevencion/views.py:3446-3498`):** Eliminar acceso `AllowAny` por `?rut=`, exigir autenticación y ownership o verificación fuerte de identidad del titular, e incluir mapa completo de tablas.
2. **Desacoplar `FIELD_ENCRYPTION_KEY` de `SECRET_KEY` y ampliar cifrado (`crypto.py`, `settings.py`, `models.py`):** Hoy si se rota `SECRET_KEY` ante un incidente se pierde descifrado de denuncias y accidentes; además los RUTs, identidades de denunciantes/denunciados y diagnósticos/lesiones siguen en texto plano.
3. **Corregir exclusiones de caché PWA (`frontend/public/sw.js:74-84`) y tokens en `localStorage`:** Actualizar `RUTAS_DATOS_PERSONALES` a las rutas reales (`/api/entregas-epp`, `/api/denuncias-ley-karin`, `/api/registro-capacitacion`, `/api/sugerencias-laborales`, `/api/privacidad`, `/api/contratistas`, `/api/comites-paritarios`) y excluir `/panel/*` de `DYNAMIC_CACHE`.
4. **Migración obligatoria de capa gratuita a planes de pago persistentes:**
   - **PostgreSQL de pago** (Render Paid PostgreSQL o Supabase/RDS gestionado) con backups diarios cifrados y Point-in-Time Recovery (en capa gratuita Render expira la BD y no da backups/PITR).
   - **Object Storage privado cifrado** (AWS S3 o Cloudflare R2 con buckets privados y URLs firmadas) reemplazando `FileSystemStorage` efímero para `comprobante_anexo_67`, `documentos_contratistas/` y `fotos_perfil/` (en Render el disco local se borra en cada deploy y `urls.py` solo sirve `MEDIA_URL` si `DEBUG=True`).
   - **DPAs + Cláusulas Modelo (RAEX202503748)** suscritos/incorporados con los proveedores en plan comercial y servicio SMTP transaccional propio (ej. Resend/SES con DPA + Anexo de transferencia) para notificaciones ARCO y verificación de identidad.

### P1 — Altas (cumplimiento funcional Ley 21.719 y seguridad)
5. **Validación de contraseñas y MFA TOTP (`sec-passwords`, `sec-mfa`):** Invocar `validate_password()` en `RegisterSerializer` y `perfil`, exigir contraseña actual al cambiar clave, e implementar MFA TOTP obligatorio para `is_superuser`, `is_staff` y cuentas corporativas; corregir links `/admin/` en `superadmin/page.tsx` y `admin-moderador/page.tsx`.
6. **Hardening multi-tenant y CORS (`sec-tenant`, `sec-tls`):** Validar ownership de FKs en `perform_update`, corregir `ContratistaViewSet.dashboard`, `SugerenciaConsultaViewSet` y `Trabajador.objects.filter(estado='ACTIVO')` en `InvestigacionAccidenteViewSet.estadisticas`; activar `SECURE_SSL_REDIRECT` / HSTS en Django y quitar wildcard `*.vercel.app` en CORS de producción.
7. **Consentimiento verificable y actualización de `/privacidad` (`data-consent-text`, `gov-politicas`, `data-info`):** Crear tabla `RegistroConsentimiento`, agregar checkboxes no premarcados y avisos cortos en `/registro`, `/capacitaciones` (cotizador) y `/contacto` (permitiendo `POST` público con throttling), y publicar en `frontend/src/app/(public)/privacidad/page.tsx` el texto completo generado en `21719-politica-privacidad.md` una vez lista la sociedad.
8. **Gestión operativa ARCO-POL y Registro de Brechas (`data-derechos`, `data-rights-channel`, `inc-brechas`):** Registrar `SolicitudDerechoARCO` y `RegistroBrechaSeguridad` en `admin.py` / panel interno, implementar bloqueo transversal real, flujo de supresión/anonimización con respeto a los 5 años SST y cron de purga al vencimiento (`data-minimizacion`).

### P2 — Medias (observabilidad y automatización continua)
9. **Audit log transversal (`sec-logs`) y monitoreo (`sec-monitoring`):** Ampliar auditoría a accesos de `InvestigacionAccidente`, `Trabajador`, exportaciones ARCO y auth; habilitar Gitleaks en GitHub Actions, alertas sobre eventos críticos y chequeo HIBP.

---

## 5. Documentación Generada en `.compliance/`
- Estado vivo: [state.json](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/.compliance/state.json)
- Instructivo operativo: [INSTRUCTIVO.md](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/.compliance/INSTRUCTIVO.md)
- Documentos legales del pack `ley-21719` en `.compliance/docs/`:
  - `21719-rat.md` — Registro de Actividades de Tratamiento (Responsable + Encargado).
  - `21719-politica-privacidad.md` — Política de Privacidad completa (Art. 14 ter).
  - `21719-consentimiento.md` — Textos de avisos cortos, checkboxes opt-in y modelo probatorio (Arts. 12 y 16).
  - `21719-canal-derechos.md` — Procedimiento interno ARCO-POL y bloqueo 2 días hábiles (Arts. 4–11).
  - `21719-dpa.md` — Contrato de Encargado del Tratamiento con clientes B2B (Art. 15 bis).
  - `21719-anexo-transferencias.md` — Anexo de Transferencia Internacional EE.UU. con Cláusulas Modelo RAEX202503748 (Arts. 27–28).
  - `21719-plan-respuesta-brechas.md` — Plan de respuesta a brechas "sin dilaciones indebidas" (Art. 14 sexies).
  - `21719-registro-vulneraciones.md` — Registro interno append-only de vulneraciones (Art. 14 sexies).
  - `21719-eipd.md` — Evaluación de Impacto obligatoria (Art. 15 ter).

---

## 6. Insumos NO Self-Service (fuera del alcance automático del código)
1. **Formalización societaria y correo oficial:** Concluir escritura con abogada para reemplazar los `[COMPLETAR: ...]` (razón social, RUT, domicilio, representante legal y correo oficial de privacidad).
2. **Suscripción comercial / DPAs de proveedores:** Contratar planes de pago persistentes en Render/Vercel/Storage y aceptar/archivar sus DPAs + Cláusulas Modelo antes de ingresar datos reales.
3. **Monitoreo 24/7 en tiempo real y representación legal:** La skill prepara el plan y puede configurar alertas periódicas/reglas de log, pero no reemplaza vigilancia SOC/DLP 24/7 ni el patrocinio obligatorio de abogado habilitado ante una fiscalización formal o juicio (ver `references/cuando-acudir-a-abogado.md`).

---
*Informe generado con compliance-cl (pack ley-21719). No constituye asesoría legal.*
