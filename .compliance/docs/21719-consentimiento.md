# Consentimiento y avisos en el punto de captura — [COMPLETAR: Razón Social definitiva en trámite con abogada]

> Conforme a los **Artículos 12, 14 ter y 16 de la Ley N° 21.719** (`sources/ley-21719-texto.txt`), el consentimiento debe ser **previo, libre, específico, informado e inequívoco** mediante un **acto afirmativo** (casilla **NO** premarcada) y **revocable** de manera gratuita y expedita. La **carga de la prueba** corresponde al responsable (Art. 12 inc. final).

> **Distinción clave para esta plataforma:** No pidas "consentimiento" cuando el tratamiento sea obligatorio por **ley laboral/SST** (Ley Karin, DIAT, entrega de EPP, inducción ODI) ni para la ejecución esencial del contrato de cuenta; en esos casos entrega un **aviso informativo (Art. 14 ter)** claro de la base legal y reserva el **checkbox de consentimiento opt-in** para comunicaciones comerciales, cotizaciones/contacto voluntario o datos opcionales.

---

## 1. Avisos cortos y opt-in en el punto de captura (`frontend/`)
> *Estado de implementación (post-Bloques 1–4):* implementados en todos los puntos de captura aplicables: `(auth)/registro/page.tsx`, `(public)/contacto/page.tsx`, `(public)/capacitaciones/page.tsx`, `(public)/participacion/[uid]/buzon/page.tsx`, `(public)/participacion/[uid]/reportar/page.tsx` (opt-in condicional si aporta identificación opcional), `capacitaciones/firmar/[uid]/page.tsx`, `ModalNuevaEntrega.tsx` y `ModalQRFirmaMovilEPP.tsx`. Sin pendientes de código.

### 1.1. Registro de usuario / prevencionista (`frontend/src/app/(auth)/registro/page.tsx`)
**Aviso corto bajo el formulario:**
> Tus datos (nombre de usuario, correo electrónico y credenciales) son tratados por **[COMPLETAR: Razón Social definitiva en trámite con abogada]** (Responsable) para crear y administrar tu cuenta y prestarte el servicio conforme a los [Términos del Servicio](/terminos) y la [Política de Privacidad](/privacidad). Puedes ejercer tus derechos ARCO-POL en [COMPLETAR: Correo oficial de privacidad] o en `/derechos-arco`.

**Checkbox obligatorio de lectura/aceptación contractual (NO premarcado):**
> ☐ He leído la [Política de Privacidad](/privacidad) y acepto los [Términos y Condiciones del Servicio](/terminos) para la creación y uso de mi cuenta.

**Checkbox opcional de comunicaciones (separado, NO premarcado):**
> ☐ Quiero recibir actualizaciones normativas SST y novedades de HD Prevención por correo electrónico. *(Opcional; puedes revocarlo en cualquier momento desde Mi Perfil.)*

### 1.2. Formularios comerciales: Contacto y Solicitud de Capacitaciones (`(public)/contacto/page.tsx` y `(public)/capacitaciones/page.tsx`)
**Aviso corto:**
> **[COMPLETAR: Razón Social definitiva en trámite con abogada]** tratará tus datos de contacto y empresa exclusivamente para gestionar y responder tu consulta o cotización de capacitación, conservándolos hasta por 12 meses. Revisa nuestra [Política de Privacidad](/privacidad) y ejerce tus derechos en `/derechos-arco` o en [COMPLETAR: Correo oficial de privacidad].

**Checkbox opt-in (NO premarcado):**
> ☐ Autorizo el tratamiento de mis datos de contacto para gestionar y responder esta solicitud conforme a la [Política de Privacidad](/privacidad).

### 1.3. Portal público QR — Buzón de Sugerencias y Reporte de Riesgos (`(public)/participacion/[uid]/buzon/page.tsx` y `reportar/page.tsx`)
*(Nota: Para sugerencias abiertas o reportes de riesgos donde el trabajador decide identificarse voluntariamente dejando nombre/RUT/contacto cuando existe modalidad anónima; en **Denuncia Ley Karin** NO pedir consentimiento porque el tratamiento es obligatorio por Ley N° 21.643, usar solo el aviso informativo reforzado).*

**Aviso corto para Denuncia Ley Karin (Art. 14 ter + Art. 16 e/f — sin checkbox de consentimiento):**
> 🔒 **Aviso de Protección de Datos Sensibles (Ley N° 21.719 y Ley N° 21.643):** Esta plataforma opera como Encargado del tratamiento por cuenta de tu empleador (**[Razón Social Empresa Cliente]**), quien es el Responsable del tratamiento. Los datos personales y sensibles ingresados son obligatorios por mandato de la Ley Karin para activar medidas de resguardo y tramitar la denuncia ante la Dirección del Trabajo y/o mutualidad, conservándose al menos por 5 años bajo confidencialidad y cifrado. Más información y canal de derechos en nuestra [Política de Privacidad](/privacidad).

**Aviso + Checkbox opcional solo si desmarca "Enviar de forma anónima" en Sugerencias o llena campos opcionales en Reportar Riesgo:**
> ☐ Autorizo voluntariamente que mis datos identificatorios opcionales sean tratados por cuenta de mi empleador para hacer seguimiento y responder este aporte, conforme a la [Política de Privacidad](/privacidad).

### 1.4. Firma pública de Asistencia a Capacitaciones y Entrega de EPP (`capacitaciones/firmar/[uid]/page.tsx` y `ModalNuevaEntrega.tsx`)
**Aviso corto informativo (base legal Art. 13 b / D.S. 44 / Art. 68 Ley 16.744 — sin checkbox de consentimiento):**
> 🔒 **Aviso de Privacidad (Ley N° 21.719):** HD Prevención trata tu nombre, RUT, firma manuscrita digitalizada e IP de registro como Encargado por cuenta de tu empleador, con la única finalidad de acreditar el cumplimiento de la normativa de Seguridad y Salud en el Trabajo (D.S. N° 44, D.S. N° 594, Ley N° 16.744 y Código del Trabajo). Plazo mínimo de conservación legal: 5 años. Revisa la [Política de Privacidad](/privacidad) y canal de derechos en `/derechos-arco`.

---

## 2. Datos sensibles (Art. 16 y Art. 16 bis — consentimiento reforzado cuando no aplique excepción legal)
En los módulos actuales de HD Prevención (`InvestigacionAccidente`, `DenunciaLeyKarin`), los datos de salud laboral y denuncias de acoso se tratan en cumplimiento de obligaciones legales laborales y de seguridad social (**Art. 16 letras e y f** y **Art. 16 bis**).  
**Regla estricta:** Si en el futuro se incorporara cualquier dato sensible **no exigido expresamente por una ley SST/laboral** (por ejemplo, encuestas voluntarias de salud o biometría facial/dactilar), deberá recabarse autorización expresa previa y separada mediante este texto:
> ☐ Autorizo expresamente a **[COMPLETAR: Razón Social definitiva]** a tratar mis datos sensibles de [especificar dato sensible] exclusivamente para [finalidad específica], conforme a la [Política de Privacidad](/privacidad).

---

## 3. Revocación del consentimiento (Art. 12 inc. 3° y 4°)
- Para tratamientos basados en consentimiento (comunicaciones opcionales, consultas/cotizaciones, identificación opcional):
  - Todo correo comercial o informativo deberá incluir un enlace operativo **"Dejar de recibir correos / Revocar consentimiento"**.
  - En `/panel/perfil`, el usuario autenticado dispone de un interruptor operativo (`POST /api/usuarios/consentimiento-comunicaciones/`) para retirar gratuitamente su consentimiento de comunicaciones en un clic.
  - Titulares sin cuenta pueden solicitar la revocación de forma gratuita en `/derechos-arco` o escribiendo a **[COMPLETAR: Correo oficial de privacidad]**.

---

## 4. Registro probatorio del consentimiento (Carga de la prueba — Art. 12 inc. final)
El backend Django incorpora la tabla inmutable append-only **`RegistroConsentimiento`** (`backend/modulo_prevencion/models.py:3644`, heredando `ImmutableAppendOnlyMixin` que bloquea `save()` existente, `delete()`, `QuerySet.update()` y `QuerySet.delete()`, administrada en `admin.py` como solo lectura) y el helper `registrar_consentimiento` (`consentimiento.py:15-49`), que registra por cada otorgamiento o revocación (creando siempre una nueva fila en lugar de sobrescribir):
- `usuario` (nullable si es titular externo) / `identificador_titular` (email o identificador del titular)
- `flujo` (`registro_cuenta`, `marketing_novedades`, `cotizacion_capacitacion`, `contacto`, `sugerencia_identificada`, `reporte_riesgo_identificado`)
- `version_politica` (`"1.0"`) y `hash_politica` (SHA-256 del texto informado/aceptado)
- `otorgado` (`True`/`False`) y `categorias` (JSON)
- `ip_origen` (extraída con `get_client_ip(request)` considerando `NUM_PROXIES`) y `user_agent`
- `fecha_evento` (timestamp automático del servidor en `America/Santiago`)

*(La inmutabilidad ORM queda garantizada en `RegistroConsentimiento`; al habilitar proveedor SMTP transaccional deberá añadirse enlace directo de desuscripción en los correos comerciales).*

---
*Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado.*
