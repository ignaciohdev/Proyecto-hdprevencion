# Resumen Ejecutivo de Cumplimiento — Ley N° 21.719 (HD Prevención)

**Fecha de evaluación:** 2026-11-25 (`2026-11-25T06:58:00Z`) · **Estado evaluado:** Working tree post-Bloques 1–4 sobre commit `58e523d` *(sin `git push`)*  
**Marco evaluado:** `ley-21719` (Protección de Datos Personales, vigencia general **1-dic-2026**)  
**Entidad:** [COMPLETAR: Razón Social definitiva en trámite con abogada] · **Tamaño:** Microempresa (Ley N° 20.416)  
**Etapa:** Demostración / Pre-producción (código técnico cerrado previo a migración a planes de pago Render + Vercel)

> **Verificación empírica completa en el repo:**  
> - `python manage.py check`: **0 issues** (`makemigrations --check --dry-run`: sin cambios pendientes; migraciones `0031` y `0032` aplicadas).  
> - `python manage.py test` completo: **87 tests ejecutados — 87 aprobados, 0 fallos, 0 errores** (incluidos los 2 tests legados actualizados a minimización de privacidad y los nuevos suites `Bloque1AdminMfaSessionYQrTenantTestCase`, `Bloque2ConsentimientoInmutabilidadYReadLogsTestCase` y `Bloque3ArcoHmacCifradoYPurgaTestCase`).  
> - `python manage.py auditar_ley21719`: **100% (7/7 suites exitosas)**.  
> - `frontend/ npm run build`: **Compilado sin errores TypeScript** (`36/36` rutas generadas) y `0` referencias a tokens JWT en `localStorage`.

---

## 1. Postura Actual — `ley-21719`: **64% (`0.64`)** *(antes: 54% / `0.54`)*

| Métrica | Corrida inicial (`f5278d2`) | Corrida previa (`58e523d`) | Corrida actual (`58e523d+bloques-1-4`) | Variación vs `58e523d` |
|---|---|---|---|---|
| **Score `ley-21719`** | `40%` (`0.40`) | `54%` (`0.54`) | **`64%` (`0.64`)** | **+10 pp (`+0.10`)** |
| **Cumple (`pass` ✅)** | `1` | `3` | **`8`** | **+5** |
| **Cumple parcialmente (`partial` ⚠️)** | `18` | `21` | **`16`** | **-5** |
| **No cumple (`fail` ❌)** | `6` | `1` | **`1`** | `0` *(infra gratuita)* |
| **Desconocido (`unknown` ❓)** | `0` | `0` | **`0`** | `0` |

- **Fórmula:** `(8 + 0.5 × 16) / 25 = 16 / 25 = 0.64 (64%)`.
- **Regresiones / *drift* negativo:** `0` controles empeoraron.
- **Brechas técnicas de código remanentes (Sección 3.A):** **0 abiertas** — las 10 tareas de los Bloques 1–4 quedaron implementadas y probadas. El 36% restante responde exclusivamente a migración a infraestructura de pago (`sec-backups` ❌, S3/R2 KMS, SMTP, BetterStack/Sentry), DPAs comerciales/Cláusulas Modelo y formalización societaria con abogada.

---

## 2. Cambios vs Última Corrida (`2026-11-25T06:05:03Z` · `58e523d`)

### Controles que subieron a `pass` ✅ (5 avances, 0 drift)
| Control | Antes (`58e523d`) | Ahora | Qué cambió y evidencia verificada |
|---|---|---|---|
| `sec-mfa` | ⚠️ `partial` | ✅ `pass` | [admin.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/admin.py#L679-L725), [mfa_login.html](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/templates/admin/mfa_login.html), [mfa.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/mfa.py): `MFAAdminSite` exige TOTP o backup code en `/sst-control-panel/` con verificación de sesión `mfa_admin_verified_uid`. |
| `data-privacy-by-design` | ⚠️ `partial` | ✅ `pass` | [api.ts](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/frontend/src/app/utils/api.ts), [useAuth.ts](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/frontend/src/app/hooks/useAuth.ts), [offlineStorage.ts](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/frontend/src/app/utils/offlineStorage.ts): tokens retirados de `localStorage`; cookie `HttpOnly` + access en memoria + `SessionStatusView`; TTL (24h/72h) y purga en `IndexedDB`. |
| `sec-tenant` | ⚠️ `partial` | ✅ `pass` | [views.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/views.py#L2281-L2460), [serializers.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/serializers.py): `ReporteRiesgoPublicoCreateView`, `DenunciaLeyKarinPublicaCreateSerializer` y `SugerenciaConsultaPublicaCreateView` validan pertenencia de `centro_trabajo` a `empresa`/`usuarios_grupo` y unifican `get_usuarios_grupo`. |
| `data-consent-text` | ⚠️ `partial` | ✅ `pass` | [reportar/page.tsx](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/frontend/src/app/(public)/participacion/%5Buid%5D/reportar/page.tsx), [views.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/views.py#L2281), [models.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/models.py#L1949-L1975): opt-in no premarcado en reporte identificado QR + `ImmutableAppendOnlyMixin` en `RegistroConsentimiento`. |
| `data-pseudonym` | ⚠️ `partial` | ✅ `pass` | [crypto.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/crypto.py#L65-L106), [models.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/models.py#L1262-L1886), [arco.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/arco.py): `rut_hmac` HMAC-SHA256 con `BLIND_INDEX_KEY` separada en `InvestigacionAccidente` y `DenunciaLeyKarin`, eliminando escaneo en memoria. |

### Controles que cerraron toda brecha de código (mantienen `partial` solo por infra/legal)
- **`data-licitud` / `data-info`**: opt-in + `RegistroConsentimiento` en `reportar/page.tsx` y aviso Art. 14 ter en [ModalQRFirmaMovilEPP.tsx](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/frontend/src/app/(dashboard)/panel/epp-riohs/components/ModalQRFirmaMovilEPP.tsx#L224-L236).
- **`sec-logs`**: `ImmutableAppendOnlyMixin` / `ImmutableAppendOnlyQuerySet` bloqueando mutación ORM en `AuditLogAccesoDenuncia`, `AuditLogEventoSeguridad` y `RegistroConsentimiento`, más `AuditedRetrieveMixin` (`ACCIDENTE_READ`, `TRABAJADOR_READ`, `EPP_READ`).
- **`data-derechos` / `gov-registro`**: [middleware.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/middleware.py) (`ARCOBloqueoProvisionalMiddleware`, HTTP `423 Locked`), `fecha_limite_bloqueo_2d` + aviso rechazo APDP, [arco.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/arco.py) con mapa 100% de esquema (39 modelos / 507 columnas, cero `[verificar]`), endpoints reales `/api/privacidad/{rectificar,suprimir,oponer,ejecutar-solicitud}/` y exportación `?formato=csv` + `ReporteRiesgo`, `Inspeccion`, `SugerenciaLaboral`, `RegistroConsentimiento`.
- **`sec-rest`**: `EncryptedJSONField` en `causas_*`, `analisis_5_porques`, `arbol_de_causas` y `RegistroCapacitacion.asistentes` (migración `0032` con `RunPython`) y exigencia obligatoria de `FIELD_ENCRYPTION_KEY` cuando `not DEBUG`.
- **`inc-brechas`**: campos `datos_economicos_financieros` (Art. 14 sexies inc. 3°) y `empresa_responsable` / `notificado_responsable` / `fecha_notificacion_responsable` / `contacto_responsable_notificado` (Art. 15 bis inc. 4°) en `RegistroBrechaSeguridad` y Admin.
- **`data-minimizacion`**: [purgar_datos_vencidos.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/management/commands/purgar_datos_vencidos.py) extendido a accidentes, denuncias Ley Karin finalizadas y `asistentes` JSON > 5 años (`--incluir-sst`).
- **`sec-monitoring`**: 87/87 tests Django en verde (corregidos `test_detalles_publicos_anonimo` y `test_radiacion_uv_ds594_y_estres_termico_json`), `.github/workflows/security-compliance.yml` ejecutando suite completa + cron semanal `schedule: '0 6 * * 1'`.

---

## 3. Pendientes Remanentes (Solo Infraestructura de Pago y Trámite Legal)

### A. Brechas técnicas de código
*Ninguna brecha técnica remanente del diagnóstico `58e523d`.*

### B. Dependencias exclusivas de infraestructura de pago / servicios externos
1. **PostgreSQL gestionada de pago (`sec-backups` ❌):** reemplazar `plan: free` en [render.yaml](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/render.yaml#L5) por BD de pago con backups diarios cifrados y PITR, más cron activo para `purgar_datos_vencidos`.
2. **Object Storage privado cifrado S3 / Cloudflare R2 (`sec-backups` ❌, `sec-rest`):** reemplazar `FileSystemStorage` efímero ([settings.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/core/settings.py)) para `karin_anexo67/`, `documentos_contratistas/`, `fotos_perfil/` y evidencias con URLs firmadas y SSE-KMS.
3. **Suscripción de DPAs + Cláusulas Modelo RAEX202503748 (`data-transfer`, `data-dpa`):** suscribir DPAs comerciales y Cláusulas Modelo con Render, Vercel, S3/R2 y SMTP.
4. **Proveedor SMTP transaccional con DPA (`gov-denuncias`, `data-rights-channel`, `data-derechos`, `sec-passwords`):** habilitar envío de acuses ARCO-POL, verificación OTP de titulares externos sin cuenta, notificaciones de brecha, desuscripción de novedades y recuperación de clave.
5. **Agregador de logs / alertas y KMS (`sec-logs`, `sec-monitoring`, `sec-secrets`):** conectar `hdprevencion.security` a BetterStack/Sentry con alertas activas y gestionar secretos (`SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, `BLIND_INDEX_KEY`) en KMS.

### C. Formalización societaria y legal (no self-service)
- Concluir escritura con abogada para reemplazar los `[COMPLETAR: ...]` (razón social, RUT, domicilio legal, representante legal y correo oficial de privacidad).
- Incorporar aceptación electrónica/firma del **DPA (Art. 15 bis)** (`21719-dpa.md`) en el onboarding B2B de empresas clientes.

---
*Informe de re-evaluación generado con compliance-cl (pack ley-21719). No constituye asesoría legal.*
