# Resumen Ejecutivo de Cumplimiento — Ley N° 21.719 (HD Prevención)

**Fecha de evaluación:** 2026-11-25 (`2026-11-25T07:37:19Z`) · **Estado evaluado:** Working tree post-re-análisis sobre `3762cca`  
**Marco evaluado:** `ley-21719` (Protección de Datos Personales, vigencia general **1-dic-2026**)  
**Entidad:** [COMPLETAR: Razón Social definitiva en trámite con abogada] · **Tamaño:** Microempresa (Ley N° 20.416)  
**Etapa:** Demostración / Pre-producción (código técnico y UI de cumplimiento cerrados previo a migración a planes de pago Render + Vercel)

> **Verificación empírica completa tras los arreglos de código:**  
> - `python manage.py check` (`DJANGO_DEBUG=False`): **0 issues** (`makemigrations --check --dry-run`: sin cambios pendientes).  
> - `python manage.py test` completo: **90 tests ejecutados en 114.923s — 90 aprobados, 0 fallos, 0 errores** (incluyendo el nuevo `Bloque4ReanalisisCierreBrechasTestCase`).  
> - `python manage.py auditar_ley21719`: **100% (7/7 suites exitosas)**.  
> - `frontend/ npm run build`: **Compilado sin errores TypeScript** (`36/36` rutas generadas).

---

## 1. Postura Actual — `ley-21719`: **64% (`0.64`)**

| Métrica | Inicial (`f5278d2`) | Baseline (`58e523d`) | Re-análisis `3762cca` (antes de arreglos) | **Post-arreglos actual (`3762cca+working-tree`)** | Variación vs `58e523d` |
|---|---|---|---|---|---|
| **Score `ley-21719`** | `40%` (`0.40`) | `54%` (`0.54`) | `62%` (`0.62`) | **`64%` (`0.64`)** | **+10 pp (`+0.10`)** |
| **Cumple (`pass` ✅)** | `1` | `3` | `7` | **`8`** | **+5** |
| **Cumple parcialmente (`partial` ⚠️)** | `18` | `21` | `17` | **`16`** | **-5** |
| **No cumple (`fail` ❌)** | `6` | `1` | `1` | **`1`** | `0` *(infra gratuita)* |
| **Desconocido (`unknown` ❓)** | `0` | `0` | `0` | **`0`** | `0` |

- **Fórmula:** `(8 + 0.5 × 16) / 25 = 16 / 25 = 0.64 (64%)`.
- **Estado de brechas de código:** **0 abiertas** — cerradas todas las brechas reales y recomendaciones técnicas detectadas en el re-análisis de `3762cca`. El 36% restante depende exclusivamente de **infraestructura de pago / servicios externos** (`sec-backups` ❌, S3/R2 KMS, SMTP, BetterStack/Sentry, cron en producción) y **formalización societaria/contractual** (escritura, DPAs y Cláusulas Modelo `RAEX202503748`).

---

## 2. Qué se corrigió en código y cómo quedó cada control

### Cierre del único control bajado en el re-análisis (`sec-tenant`: ⚠️ `partial` → ✅ **`pass`**)
- **`_resolver_alcance_arco_request` ([views.py:4350-4400](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/views.py#L4350-L4400)), `PortabilidadDatosView` ([views.py:4294-4347](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/views.py#L4294-L4347)) y [arco.py](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/arco.py#L832-L1680):**
  - Se prohíbe que usuarios no-staff operen con un `email` externo al pasar un `rut` de trabajador (rechazado con `HTTP 403` si no corresponde a un correo autorizado de ese trabajador dentro de `usuarios_grupo` vía `resolver_emails_trabajador_tenant`).
  - Al operar por `rut` sin `email`, ya no se rellena con `request.user.email`, evitando revocación/supresión accidental de datos del prevencionista; `MensajeContacto` y `SugerenciaConsulta` quedan aislados exclusivamente a cuenta propia o staff.
  - En `_exportar_datos_trabajador_tenant`, `SolicitudDerechoARCO` y `RegistroConsentimiento` retornan vacío si el `rut` no existe dentro de `usuarios_grupo`, impidiendo sondeo cross-tenant.
  - Se valida propiedad de `solicitud_uuid` y duplicidad de correo en rectificaciones (`HTTP 400`). Además, `exportar_datos_titular` ahora fusiona datos de cuenta y trabajador (`ambito='cuenta_y_trabajador'`) cuando coexisten ambos identificadores.

### Mejoras dentro de controles ya evaluados (`partial` ⚠️ / `pass` ✅)
- **`data-derechos` y `data-rights-channel` (⚠️ `partial` — código/UI cerrado; resta solo OTP/acuses SMTP):**
  - [perfil/page.tsx](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/frontend/src/app/(dashboard)/panel/perfil/page.tsx#L392-L1095): controles self-service directos para **Exportar JSON/CSV**, **Rectificar datos**, **Oponerse a opcionales** y **Suprimir cuenta** (con `logoutAuth()` al suprimirse).
  - [derechos-arco/page.tsx](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/frontend/src/app/(public)/derechos-arco/page.tsx#L8-L270): la pestaña de seguimiento UUID ahora renderiza `fecha_limite_bloqueo_2d` (2 días hábiles) y `aviso_apdp_rechazo_bloqueo`.
  - [SolicitudDerechoARCOAdmin](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/admin.py#L482-L618): agregadas las acciones ejecutivas `exportar_portabilidad_arco_json`, `ejecutar_supresion_arco` y `ejecutar_oposicion_arco`.
- **`sec-mfa` (✅ `pass`):** `MFAAdminAuthenticationForm` ([admin.py:706-818](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/admin.py#L706-L818)) incorpora rate limiting / lockout por IP + usuario ante 5 intentos fallidos por 5 minutos (`MFA_FAIL` `rate_limited`).
- **`data-licitud` / `data-consent-text` (✅):** `SugerenciaConsultaPublicaCreateView` ([views.py:2484-2485](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/views.py#L2484-L2485)) homologada con `_parse_bool()`.
- **`sec-logs` / `sec-rest` / `sec-monitoring` (⚠️):** `ImmutableAppendOnlyQuerySet.bulk_update()` bloqueado en ORM ([models.py:1944-1947](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/models.py#L1944-L1947)) y `descifrar_texto()` emite alerta `DECRYPT_INVALID_TOKEN` en `hdprevencion.security` ([crypto.py:128-144](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/modulo_prevencion/crypto.py#L128-L144)).

*(Controles `pass` ✅ totales [8]: `data-consent-text`, `data-privacy-by-design`, `data-pseudonym`, `sec-tls`, `sec-passwords`, `sec-mfa`, `sec-tenant`, `sec-secrets`. `partial` ⚠️ [16]. `fail` ❌ [1]: `sec-backups`.)*

---

## 3. Únicos pendientes antes de producción real (Solo Infraestructura Pagada y Trámite Legal)

### A. Brechas técnicas en código
*Ninguna brecha técnica pendiente.*

### B. Infraestructura de pago y servicios externos
1. **PostgreSQL gestionada de pago (`sec-backups` ❌):** Reemplazar `plan: free` en [render.yaml](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/render.yaml#L5) por BD pagada con backups diarios cifrados + PITR y programar cron para `purgar_datos_vencidos --incluir-sst` (incluyendo borrado de archivos vencidos).
2. **Object Storage privado S3 / Cloudflare R2 (`sec-backups` ❌, `sec-rest`):** Migrar `FileFields` desde `FileSystemStorage` efímero ([settings.py:234-237](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/backend/core/settings.py#L234-L237)) con URLs firmadas y SSE-KMS.
3. **DPAs + Cláusulas Contractuales Modelo `RAEX202503748` (`data-transfer`, `data-dpa`):** Suscribirlos con Render, Vercel, S3/R2 y SMTP; desplegar API/frontend bajo un dominio raíz común para `SameSite=Lax`.
4. **SMTP transaccional con DPA (`gov-denuncias`, `data-rights-channel`, `data-derechos`, `sec-passwords`):** Acuses ARCO-POL, OTP para trabajadores externos sin cuenta, desuscripción en correos comerciales, avisos de brechas y recuperación de clave.
5. **Logs/alertas y KMS (`sec-logs`, `sec-monitoring`, `sec-secrets`, `data-pseudonym`):** Conectar stdout `hdprevencion.security` a BetterStack/Sentry, habilitar `REVOKE UPDATE, DELETE` en PostgreSQL productivo, activar HIBP de dominio y definir `BLIND_INDEX_KEY` y llaves en Secret Manager/KMS.

### C. Formalización societaria y legal (con abogada)
- Completar escritura para reemplazar los `[COMPLETAR: ...]` (razón social, RUT, domicilio, representante y casilla oficial).
- Incorporar aceptación electrónica del **DPA (Art. 15 bis)** ([21719-dpa.md](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/.compliance/docs/21719-dpa.md)) en el onboarding B2B de empresas clientes.

---
*Informe generado con compliance-cl (pack ley-21719). No constituye asesoría legal.*
