# Anexo de Transferencia Internacional de Datos — [COMPLETAR: Razón Social definitiva en trámite con abogada]

> Para amparar el envío y almacenamiento de datos personales fuera de Chile (infraestructura en **Estados Unidos**: Render y Vercel). Mecanismo legal aplicable: **Cláusulas Contractuales Modelo** aprobadas por el Ministerio de Economía, Fomento y Turismo (**Resolución Exenta N° RAEX202503748**, Diario Oficial N° 44.328 del 19-12-2025, `sources/clausulas-modelo-transferencia-economia.txt`), conforme a los **artículos 27 letra b) y 28 de la Ley N° 21.719** (`sources/ley-21719-texto.txt`, L1278–L1378).

---

## 1. Partes e Importadores de Datos

- **Exportador de datos (Chile):** **[COMPLETAR: Razón Social definitiva en trámite con abogada]**, RUT **[COMPLETAR: RUT empresa tras constitución]**, domicilio **[COMPLETAR: Domicilio legal definitivo, Santiago, Chile]**, actuando como Responsable (para usuarios/contactos) o Sub-exportador/Encargado autorizado por sus clientes (Art. 15 bis).
- **Importadores de datos vigentes (Sub-encargados de infraestructura):**
  1. **Render Services, Inc.** (Estados Unidos) — Alojamiento del servidor backend (Django) y base de datos PostgreSQL (`render.yaml`).
  2. **Vercel Inc.** (Estados Unidos) — Alojamiento del frontend web y edge routing (`frontend/vercel.json`).

### Servicios externos verificados SIN transferencia internacional de datos personales
- **Open-Meteo (`api.open-meteo.com`):** Invocado en `backend/modulo_prevencion/views.py:3308-3348` (`ClimaUvView`) enviando únicamente coordenadas geográficas (`latitude`, `longitude`) de faenas/comunas chilenas y `User-Agent`. **No se transfieren datos personales.**
- **APIs de correo electrónico / Inteligencia Artificial:** Actualmente **inactivas en runtime** (el módulo web no envía correos externos ni datos a Gemini/LLMs en ejecución; si en el futuro se activan servicios como Resend, SES, SendGrid o Gemini en runtime, deberá suscribirse un nuevo Anexo antes de habilitarlos).

---

## 2. Mecanismo de transferencia internacional (Arts. 27 y 28)
Estados Unidos no cuenta actualmente con una resolución de nivel adecuado emitida por la Agencia de Protección de Datos Personales de Chile (Art. 28 inc. 1°). Por tanto, las transferencias se amparan en la letra b) del artículo 27 de la Ley N° 21.719 mediante la adopción de las **Cláusulas Contractuales Modelo** aprobadas por la **Resolución Exenta N° RAEX202503748 del Ministerio de Economía, Fomento y Turismo** ("Guía de Implementación de Cláusulas Contractuales Modelo para la Transferencia Internacional de Datos Personales" — TIDP).

> **Nota crítica de implementación (pre-producción):** No basta el Terms of Service o DPA genérico del proveedor norteamericano (usualmente redactado bajo GDPR/SCC europeas o leyes de EE.UU.) por sí solo si no contempla las garantías exigibles bajo la Ley N° 21.719. Al migrar de capa gratuita a **planes de pago persistentes**:
> 1. Suscribir formalmente el **DPA** ofrecido por Render y Vercel (disponibles en sus planes de equipo/comerciales) verificando las medidas técnicas de cifrado en disco, backups y ubicación de región.
> 2. Incorporar por referencia o adenda las **Cláusulas Contractuales Modelo chilenas (RAEX202503748)** (el texto oficial se conserva en el corpus `sources/clausulas-modelo-transferencia-economia.pdf`), o evaluar alojamiento en regiones con garantías equivalentes / país adecuado una vez que la APDP publique su listado oficial (Art. 28 inc. 3°).
> 3. Mantener respaldo probatorio de dichas garantías para exhibirlo ante la Agencia (Art. 28 inc. 6°: *"Corresponderá al responsable de datos que efectuó la transferencia internacional de datos, acreditar ante la Agencia que ésta se practicó de conformidad a las reglas establecidas en esta ley"*).

---

## 3. Datos transferidos y finalidad
- **Categorías de datos:**
  - Datos de cuentas de usuarios/prevencionistas (`Usuario`, `Suscripcion`, `DocumentoUsuario`).
  - Datos laborales y preventivos de empresas clientes (`Empresa`, `Trabajador`, `EntregaEPP`, `RegistroCapacitacion`, `ComiteParitario`, `Contratista`).
  - Datos sensibles de salud laboral (`InvestigacionAccidente`) y denuncias confidenciales (`DenunciaLeyKarin`, con relatos cifrados en capa de aplicación `enc:v1:` antes de persistir en PostgreSQL).
- **Finalidad:** Alojamiento de aplicación web, procesamiento API REST, persistencia relacional en base de datos PostgreSQL y despacho de contenido estático/SSR de la plataforma SaaS HD Prevención.

---

## 4. Compromisos del importador y medidas suplementarias
Cada importador queda sujeto a:
1. Tratar los datos **exclusivamente conforme a las instrucciones** del exportador y para la prestación de infraestructura contratada, sin usarlos para fines propios ni entrenamiento de modelos.
2. Aplicar medidas de seguridad técnicas y organizativas equivalentes o superiores al Art. 14 quinquies de la Ley 21.719 (TLS en tránsito, cifrado en reposo en almacenamiento y respaldos).
3. No sub-transferir los datos a terceros países sin garantías adecuadas equivalentes y autorización previa.
4. Notificar sin dilación indebida cualquier vulneración de seguridad y asistir ante solicitudes de titulares o requerimientos de la Agencia de Protección de Datos Personales.
5. **Medida suplementaria técnica del exportador (HD Prevención):** Mantener el cifrado en capa de aplicación (`EncryptedTextField` con llave `FIELD_ENCRYPTION_KEY` separada y fuera de la BD) para que, incluso en caso de acceso físico a discos o volcados de respaldo en EE.UU., los datos sensibles queden ilegibles sin la llave controlada por el exportador.

---

## 5. Declaración de transparencia (Art. 14 ter letra h)
Esta transferencia internacional, los países de destino (**EE.UU.**), la ausencia de decisión de adecuación general y el mecanismo de garantías adoptado (**Cláusulas Contractuales Modelo RAEX202503748**) deben declararse expresamente en la sección *"Con quién compartimos los datos y transferencias internacionales"* de la Política de Privacidad pública (`/privacidad`), actualmente omitido en `frontend/src/app/(public)/privacidad/page.tsx`.

---
*Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado.*
